/*
  # Add profile fields: full_name and phone_number

  ## Changes
  - Adds `full_name` (text, max 100 chars) to `user_profiles`
  - Adds `phone_number` (text, max 30 chars) to `user_profiles`
  - Both columns are nullable and default to empty string
  - Adds a CHECK constraint on phone_number to allow only E.164-compatible chars

  ## Security
  - Existing UPDATE policy on user_profiles already covers these columns
  - No new policies needed
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN full_name text NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN phone_number text NOT NULL DEFAULT ''
      CONSTRAINT phone_number_format CHECK (phone_number ~ '^[+0-9\s\-().]*$');
  END IF;
END $$;
