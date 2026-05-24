/*
  # Enforce free-tier project limit using a lifetime creation counter

  ## Summary
  Replaces the active-project count check with a never-decrementing lifetime
  counter (`projects_created_count`). This means a free-plan user who creates
  3 projects, deletes them all, and tries to create a 4th is still blocked —
  the limit reflects how many projects they have ever created, not how many
  currently exist. Soft-deleting a project does not reclaim a slot.

  ## Changes

  ### user_profiles table
  - New column `projects_created_count` (integer, NOT NULL, DEFAULT 0)
    Monotonically increasing; never decremented by any code path.

  ### Trigger: increment_projects_created_count
  - Fires AFTER INSERT on projects (FOR EACH ROW).
  - Increments `projects_created_count` on the owning user_profile.
  - Uses SECURITY DEFINER so it can bypass RLS on user_profiles.

  ### Function: check_project_limit (replaced)
  - Now reads `projects_created_count` instead of counting current projects.
  - Free-plan users are blocked when projects_created_count >= 3.
  - Runs BEFORE INSERT so the block fires before the row is written.

  ### Backfill
  - Sets `projects_created_count` for all existing users to the number of
    projects they have ever inserted (including soft-deleted ones), based on
    the current projects table. This is a one-time catch-up; from this point
    the trigger maintains the counter going forward.

  ## Security notes
  - Both functions use SECURITY DEFINER so they can read user_profiles
    without depending on caller permissions.
  - No RLS policies on user_profiles are changed; users still cannot
    directly write projects_created_count via the API.
*/

-- ── 1. Add the lifetime counter column ────────────────────────────────────────

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'projects_created_count'
  ) THEN
    ALTER TABLE user_profiles
      ADD COLUMN projects_created_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

-- ── 2. Backfill: count ALL projects ever inserted (including soft-deleted) ─────

UPDATE user_profiles up
SET projects_created_count = (
  SELECT COUNT(*)
  FROM projects p
  WHERE p.user_id = up.id
);

-- ── 3. Trigger to increment the counter on every new project ──────────────────

CREATE OR REPLACE FUNCTION increment_projects_created_count()
RETURNS trigger AS $$
BEGIN
  UPDATE public.user_profiles
  SET projects_created_count = projects_created_count + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_project_inserted ON projects;
CREATE TRIGGER on_project_inserted
  AFTER INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION increment_projects_created_count();

-- ── 4. Replace the limit-check trigger to use the lifetime counter ────────────
--    Runs BEFORE INSERT so it fires before the counter is incremented.

CREATE OR REPLACE FUNCTION check_project_limit()
RETURNS trigger AS $$
DECLARE
  user_plan             text;
  lifetime_count        integer;
BEGIN
  SELECT
    COALESCE(plan, 'free'),
    COALESCE(projects_created_count, 0)
  INTO user_plan, lifetime_count
  FROM public.user_profiles
  WHERE id = NEW.user_id;

  -- Default to 'free' if no profile row exists (should not happen, but safe)
  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  IF user_plan != 'premium' AND lifetime_count >= 3 THEN
    RAISE EXCEPTION 'Free plan is limited to 3 projects. Upgrade to Premium for unlimited projects.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recreate the BEFORE INSERT trigger (may already exist; drop first for clean state)
DROP TRIGGER IF EXISTS enforce_project_limit ON projects;
CREATE TRIGGER enforce_project_limit
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION check_project_limit();

-- ── 5. Lock down projects_created_count in RLS ────────────────────────────────
--    The existing "Users can update own profile" policy allows updating any
--    column on the user's own row. Add a restrictive policy that prevents
--    direct client writes to projects_created_count.
--
--    The cleanest approach is a SECURITY DEFINER function owned by postgres
--    for writes made by triggers, which already bypasses RLS. For the user-
--    facing UPDATE policy we add a WITH CHECK that rejects any attempt to
--    change the counter via the API.

DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    -- Prevent the client from directly modifying the lifetime counter.
    -- The trigger (SECURITY DEFINER) bypasses RLS entirely, so legitimate
    -- increments are unaffected.
    AND projects_created_count = (SELECT projects_created_count FROM user_profiles WHERE id = auth.uid())
  );
