/*
  # Add user profiles table with plan field

  1. New Tables
    - `user_profiles`
      - `id` (uuid, primary key, references auth.users)
      - `plan` (text, 'free' | 'premium', default 'free')
      - `created_at` (timestamptz)
      - `updated_at` (timestamptz)

  2. Security
    - Enable RLS on `user_profiles`
    - Users can read and update only their own profile
    - Insert is handled by a trigger on auth.users

  3. Automation
    - Trigger on auth.users INSERT to auto-create a profile row for every new signup
    - updated_at trigger

  4. Notes
    - Enforcing the free-plan 3-project limit is done in the UI and via a DB function
      called before insert on projects.
    - The function check_project_limit raises an exception if a free user already has
      3 or more projects, providing a backend guard against API abuse.
*/

-- Profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- updated_at trigger (reuse existing function)
DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION create_user_profile()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION create_user_profile();

-- Backfill profiles for any existing users
INSERT INTO user_profiles (id)
SELECT id FROM auth.users
ON CONFLICT (id) DO NOTHING;

-- Backend guard: prevent free users from exceeding 3 projects
CREATE OR REPLACE FUNCTION check_project_limit()
RETURNS trigger AS $$
DECLARE
  user_plan text;
  project_count integer;
BEGIN
  SELECT plan INTO user_plan
  FROM user_profiles
  WHERE id = NEW.user_id;

  IF user_plan IS DISTINCT FROM 'premium' THEN
    SELECT COUNT(*) INTO project_count
    FROM projects
    WHERE user_id = NEW.user_id;

    IF project_count >= 3 THEN
      RAISE EXCEPTION 'Free plan limit reached. Upgrade to create more projects.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_project_limit ON projects;
CREATE TRIGGER enforce_project_limit
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION check_project_limit();
