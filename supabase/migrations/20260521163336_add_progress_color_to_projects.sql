/*
  # Add progress_color to projects

  1. Modified Tables
    - `projects`
      - `progress_color` (text, nullable) — hex color string chosen by the user
        for their project's progress bar (e.g. '#14b8a6'). NULL means "use default".

  2. Notes
    - Nullable so existing rows are unaffected and continue to use the automatic
      color logic in the UI.
    - No RLS change needed; the existing projects policies cover this column.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'projects' AND column_name = 'progress_color'
  ) THEN
    ALTER TABLE projects ADD COLUMN progress_color text;
  END IF;
END $$;
