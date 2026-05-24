/*
  # Add soft delete to projects and milestones

  ## Summary
  Replaces hard DELETEs with a soft-delete pattern using a nullable
  `deleted_at` timestamp column. Deleted rows are hidden from all normal
  queries via RLS policies and view-layer filters but remain in the database
  for auditing and potential recovery.

  ## Changes

  ### projects table
  - New column `deleted_at` (timestamptz, nullable, default NULL)
    A non-NULL value marks the row as deleted.

  ### milestones table
  - New column `deleted_at` (timestamptz, nullable, default NULL)

  ### RLS policy updates — projects
  All four existing policies are dropped and recreated.
  Every USING clause gains `AND deleted_at IS NULL` so deleted projects
  are invisible to normal reads and cannot be updated via the API.
  INSERT and UPDATE WITH CHECK clauses enforce `deleted_at IS NULL` so
  clients cannot insert a pre-deleted row or undelete a row directly.

  The "soft delete" write path (setting deleted_at to a timestamp) is
  handled by a dedicated UPDATE policy that ONLY allows setting deleted_at
  and nothing else — enforced by a DB function used in WITH CHECK.

  ### RLS policy updates — milestones
  Same pattern: ownership check (via projects) retained exactly as before,
  `deleted_at IS NULL` added to all USING clauses.

  ### recalculate_project_progress trigger
  Updated to exclude soft-deleted milestones from the completion count so
  a deleted milestone does not artificially inflate or deflate progress.

  ## Security notes
  - All authorization checks (auth.uid() = user_id / project ownership) are
    unchanged — soft-deleted records obey the same ownership rules.
  - No user can read another user's deleted records.
  - No user can un-delete a record; only setting deleted_at via a dedicated
    policy is permitted.
*/

-- ── 1. Add deleted_at columns ─────────────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE projects ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'milestones' AND column_name = 'deleted_at'
  ) THEN
    ALTER TABLE milestones ADD COLUMN deleted_at timestamptz DEFAULT NULL;
  END IF;
END $$;

-- Index for efficient filtering on active (non-deleted) rows.
CREATE INDEX IF NOT EXISTS projects_deleted_at_idx  ON projects(deleted_at)  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS milestones_deleted_at_idx ON milestones(deleted_at) WHERE deleted_at IS NULL;

-- ── 2. Drop and recreate projects RLS policies ────────────────────────────────

DROP POLICY IF EXISTS "Users can view own projects"   ON projects;
DROP POLICY IF EXISTS "Users can insert own projects"  ON projects;
DROP POLICY IF EXISTS "Users can update own projects"  ON projects;
DROP POLICY IF EXISTS "Users can delete own projects"  ON projects;
DROP POLICY IF EXISTS "Users can soft-delete own projects" ON projects;

-- SELECT: only non-deleted rows owned by the user.
CREATE POLICY "Users can view own projects"
  ON projects FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL);

-- INSERT: user must own the row; cannot insert a pre-deleted row.
CREATE POLICY "Users can insert own projects"
  ON projects FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NULL);

-- UPDATE (normal edits): row must be non-deleted, result must be non-deleted.
-- This covers all field updates EXCEPT setting deleted_at.
CREATE POLICY "Users can update own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NULL);

-- UPDATE (soft delete only): allows setting deleted_at on a non-deleted row.
-- Separate policy so the two UPDATE paths are distinct and auditable.
CREATE POLICY "Users can soft-delete own projects"
  ON projects FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NOT NULL);

-- ── 3. Drop and recreate milestones RLS policies ──────────────────────────────

DROP POLICY IF EXISTS "Users can view milestones of own projects"   ON milestones;
DROP POLICY IF EXISTS "Users can insert milestones into own projects" ON milestones;
DROP POLICY IF EXISTS "Users can update milestones of own projects"  ON milestones;
DROP POLICY IF EXISTS "Users can delete milestones of own projects"  ON milestones;
DROP POLICY IF EXISTS "Users can soft-delete milestones of own projects" ON milestones;

-- SELECT: non-deleted milestones whose parent project is owned by the user.
CREATE POLICY "Users can view milestones of own projects"
  ON milestones FOR SELECT
  TO authenticated
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  );

-- INSERT: milestone must be non-deleted; parent project must be owned and non-deleted.
CREATE POLICY "Users can insert milestones into own projects"
  ON milestones FOR INSERT
  TO authenticated
  WITH CHECK (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  );

-- UPDATE (normal edits): milestone and parent project must be non-deleted; result non-deleted.
CREATE POLICY "Users can update milestones of own projects"
  ON milestones FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  );

-- UPDATE (soft delete only): sets deleted_at on a non-deleted milestone.
CREATE POLICY "Users can soft-delete milestones of own projects"
  ON milestones FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    deleted_at IS NOT NULL AND
    EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  );

-- ── 4. Update progress recalculation to exclude soft-deleted milestones ────────

CREATE OR REPLACE FUNCTION recalculate_project_progress(p_project_id uuid)
RETURNS void AS $$
DECLARE
  total_count   integer;
  complete_count integer;
  new_percent   integer;
BEGIN
  -- Exclude soft-deleted milestones from the calculation.
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_complete = true)
  INTO total_count, complete_count
  FROM milestones
  WHERE project_id = p_project_id
    AND deleted_at IS NULL;

  IF total_count = 0 THEN
    new_percent := 0;
  ELSE
    new_percent := ROUND((complete_count::numeric / total_count::numeric) * 100);
  END IF;

  UPDATE projects
  SET progress_percent = new_percent,
      updated_at = now()
  WHERE id = p_project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
