/*
  # Tighten project name and description length limits

  ## Summary
  Reduces the maximum allowed length for project names from 100 to 50 characters
  and project descriptions from 500 to 100 characters, enforced at the database level.

  ## Changes
  - `projects.name`: max length reduced from 100 to 50 characters
  - `projects.description`: max length reduced from 500 to 100 characters

  ## Process
  1. Drop the old CHECK constraints by name.
  2. Truncate any existing rows that exceed the new limits so the new constraints apply cleanly.
  3. Re-add the constraints with the tighter limits.

  ## Notes
  - Existing rows longer than the new limits are trimmed to fit before the constraint
    is applied, preventing migration failure on live data.
  - Client-side LIMITS constants in validation.ts are kept in sync (50 / 100).
*/

-- Drop old constraints so we can replace them
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_name_length;
ALTER TABLE projects DROP CONSTRAINT IF EXISTS projects_description_length;

-- Trim any existing rows that exceed the new limits
UPDATE projects
  SET name = left(trim(name), 50)
  WHERE char_length(trim(name)) > 50;

UPDATE projects
  SET description = left(description, 100)
  WHERE char_length(description) > 100;

-- Re-add with tighter limits
ALTER TABLE projects
  ADD CONSTRAINT projects_name_length
  CHECK (char_length(trim(name)) >= 1 AND char_length(name) <= 50);

ALTER TABLE projects
  ADD CONSTRAINT projects_description_length
  CHECK (char_length(description) <= 100);
