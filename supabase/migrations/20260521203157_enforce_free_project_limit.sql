/*
  # Enforce free plan project limit at the database level

  ## Summary
  Adds a database-level check so free-plan users cannot insert more than 3 projects,
  even if someone bypasses the UI. Premium users are unaffected.

  ## Changes
  1. New function `check_project_limit()` — called by a BEFORE INSERT trigger on `projects`.
     Raises an exception with a user-readable message if a free-plan user already has 3+ projects.
  2. Trigger `enforce_project_limit` — fires BEFORE INSERT on `projects` for each row.

  ## Notes
  - Uses SECURITY DEFINER so it can read `user_profiles` regardless of RLS.
  - The exception message is surfaced directly to the client as a Postgres error,
    which the frontend catches and displays inline.
*/

CREATE OR REPLACE FUNCTION check_project_limit()
RETURNS trigger AS $$
DECLARE
  user_plan text;
  project_count integer;
BEGIN
  -- Look up the user's plan (defaults to 'free' if no profile row exists yet)
  SELECT COALESCE(plan, 'free')
  INTO user_plan
  FROM public.user_profiles
  WHERE id = NEW.user_id;

  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  -- Only enforce the limit for free-plan users
  IF user_plan = 'free' THEN
    SELECT COUNT(*)
    INTO project_count
    FROM public.projects
    WHERE user_id = NEW.user_id;

    IF project_count >= 3 THEN
      RAISE EXCEPTION 'Free plan is limited to 3 projects. Upgrade to Premium for unlimited projects.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_project_limit ON projects;
CREATE TRIGGER enforce_project_limit
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION check_project_limit();
