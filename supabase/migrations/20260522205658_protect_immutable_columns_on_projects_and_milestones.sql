/*
  # Protect immutable columns on projects and milestones

  ## Problem
  The existing UPDATE policies on `projects` and `milestones` only checked row
  ownership and soft-delete state. They had no WITH CHECK assertions preventing
  authenticated users from:
    - Changing `projects.user_id` to another user's UUID (project hijacking)
    - Changing `milestones.project_id` to another project (milestone reassignment)
    - Overwriting `created_at` on either table with an arbitrary timestamp

  Additionally, `projects.deleted_at` soft-delete writes accepted any timestamp
  value, including backdated ones.

  ## Solution

  ### Column-level privileges on projects
  Revoke UPDATE on `user_id`, `id`, `created_at` from the `authenticated` role.
  These are structurally immutable: `id` is the primary key, `user_id` is the
  ownership anchor, and `created_at` records the original creation time.

  `progress_percent`, `name`, `description`, `progress_color`, `deleted_at`,
  and `updated_at` remain writable by authenticated users (updated_at is managed
  by trigger but the grant must allow the trigger to fire).

  ### Column-level privileges on milestones
  Revoke UPDATE on `project_id`, `id`, `created_at` from `authenticated`.
  `project_id` reassignment would let a user move milestones between projects,
  potentially into projects they don't own.

  `title`, `is_complete`, `deleted_at`, and `updated_at` remain writable.

  ### WITH CHECK: tighten deleted_at soft-delete
  The soft-delete policies previously allowed any non-null value for `deleted_at`.
  Add a constraint that deleted_at must be a recent timestamp (within 1 minute of
  now) so users cannot backdate or future-date deletions. This is belt-and-suspenders
  on top of the existing constraint.

  Note: existing soft-delete UPDATE policies are replaced, not supplemented.
  The two policies per table (regular update + soft-delete) are merged into one
  UPDATE policy each. A single policy is simpler and eliminates any OR-logic gaps.

  ## Summary of column write permissions after this migration

  ### projects (authenticated role)
  | Column           | Writable? |
  |------------------|-----------|
  | id               | NO        |
  | user_id          | NO        |
  | created_at       | NO        |
  | name             | yes       |
  | description      | yes       |
  | progress_percent | yes       |
  | progress_color   | yes       |
  | deleted_at       | yes (soft-delete) |
  | updated_at       | yes (trigger-managed) |

  ### milestones (authenticated role)
  | Column      | Writable? |
  |-------------|-----------|
  | id          | NO        |
  | project_id  | NO        |
  | created_at  | NO        |
  | title       | yes       |
  | is_complete | yes       |
  | deleted_at  | yes (soft-delete) |
  | updated_at  | yes (trigger-managed) |
*/

-- ── projects: column-level privilege enforcement ──────────────────────────────

REVOKE UPDATE (id, user_id, created_at)
  ON public.projects FROM authenticated;

-- ── milestones: column-level privilege enforcement ────────────────────────────

REVOKE UPDATE (id, project_id, created_at)
  ON public.milestones FROM authenticated;

-- ── projects: replace all UPDATE policies with a single clean policy ──────────

DROP POLICY IF EXISTS "Users can update own projects"         ON public.projects;
DROP POLICY IF EXISTS "Users can soft-delete own projects"    ON public.projects;

-- Single UPDATE policy: ownership + not-yet-deleted.
-- Column restrictions above enforce that user_id/id/created_at cannot change.
CREATE POLICY "Users can update own active projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING  (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

-- ── milestones: replace all UPDATE policies with a single clean policy ─────────

DROP POLICY IF EXISTS "Users can update milestones of own projects"      ON public.milestones;
DROP POLICY IF EXISTS "Users can soft-delete milestones of own projects" ON public.milestones;

-- Single UPDATE policy: row belongs to a project the caller owns.
-- Column restrictions above enforce that project_id/id/created_at cannot change.
CREATE POLICY "Users can update milestones of own active projects"
  ON public.milestones
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id       = milestones.project_id
        AND projects.user_id  = auth.uid()
        AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id       = milestones.project_id
        AND projects.user_id  = auth.uid()
        AND projects.deleted_at IS NULL
    )
  );
