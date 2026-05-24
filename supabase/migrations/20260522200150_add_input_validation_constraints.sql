/*
  # Add server-side input validation constraints

  ## Purpose
  Enforce data integrity at the database level so that invalid values are
  rejected regardless of which client (browser, API, direct SQL) issues the
  write. These constraints are the last line of defense and complement
  client-side validation.

  ## Changes

  ### projects table
  - `name`: must be 1–100 characters after trimming whitespace (non-blank, max 100)
  - `description`: max 500 characters
  - `progress_percent`: must be in the range 0–100 (integer)
  - `progress_color`: must be NULL or a valid 7-character lowercase hex color
    matching the pattern `#[0-9a-f]{6}` (e.g. `#14b8a6`)

  ### milestones table
  - `title`: must be 1–200 characters after trimming whitespace (non-blank, max 200)

  ## Notes
  - All constraints use `IF NOT EXISTS`-style naming — they will not be re-added
    if the migration is run twice.
  - Existing rows that already satisfy the constraints are unaffected.
  - Rows that violate the new constraints (e.g. empty `name`) would block this
    migration; the DEFAULT '' on name/title was set at table creation but the
    NOT NULL + CHECK combination now enforces non-blank values going forward.
    Existing blank rows (if any) are updated to a placeholder before the
    constraint is added to avoid migration failure.
*/

-- ── projects.name ────────────────────────────────────────────────────────────
-- Patch any existing blank names so the constraint can be applied cleanly.
UPDATE projects SET name = '(untitled)' WHERE trim(name) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'projects' AND constraint_name = 'projects_name_length'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_name_length
      CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 100);
  END IF;
END $$;

-- ── projects.description ──────────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'projects' AND constraint_name = 'projects_description_length'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_description_length
      CHECK (char_length(description) <= 500);
  END IF;
END $$;

-- ── projects.progress_percent ─────────────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'projects' AND constraint_name = 'projects_progress_percent_range'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_progress_percent_range
      CHECK (progress_percent >= 0 AND progress_percent <= 100);
  END IF;
END $$;

-- ── projects.progress_color ───────────────────────────────────────────────────
-- Must be NULL or a lowercase 7-char hex string: #rrggbb
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'projects' AND constraint_name = 'projects_progress_color_format'
  ) THEN
    ALTER TABLE projects
      ADD CONSTRAINT projects_progress_color_format
      CHECK (
        progress_color IS NULL OR
        (char_length(progress_color) = 7 AND progress_color ~ '^#[0-9a-f]{6}$')
      );
  END IF;
END $$;

-- ── milestones.title ──────────────────────────────────────────────────────────
UPDATE milestones SET title = '(untitled)' WHERE trim(title) = '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'milestones' AND constraint_name = 'milestones_title_length'
  ) THEN
    ALTER TABLE milestones
      ADD CONSTRAINT milestones_title_length
      CHECK (char_length(trim(title)) >= 1 AND char_length(title) <= 200);
  END IF;
END $$;
