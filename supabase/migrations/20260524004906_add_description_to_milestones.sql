/*
  # Add description field to milestones

  ## Summary
  Adds an optional free-text description column to the milestones table so users
  can store more detail than the title alone.

  ## Changes

  ### milestones table
  - `description` (text, NOT NULL, DEFAULT ''): optional detail text, max 300 characters.

  ## Security
  - No RLS changes needed; existing policies on milestones already cover all columns.

  ## Constraints
  - `milestones_description_length`: CHECK (char_length(description) <= 300)
*/

ALTER TABLE milestones
  ADD COLUMN IF NOT EXISTS description text NOT NULL DEFAULT '';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.constraint_column_usage
    WHERE table_name = 'milestones' AND constraint_name = 'milestones_description_length'
  ) THEN
    ALTER TABLE milestones
      ADD CONSTRAINT milestones_description_length
      CHECK (char_length(description) <= 300);
  END IF;
END $$;
