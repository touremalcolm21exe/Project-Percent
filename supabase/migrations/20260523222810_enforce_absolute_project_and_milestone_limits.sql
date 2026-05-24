/*
  # Enforce absolute limits for all users

  ## Summary
  Adds hard upper-bound limits that apply regardless of plan:
  - Max 500 active projects per user (any plan)
  - Max 100 active milestones per project

  The existing free-plan limit of 3 projects is preserved; this migration
  layers the absolute caps on top.

  ## Changes

  ### 1. `check_project_limit()` — extended
  Now raises a distinct error when any user (including premium) reaches 500
  active (non-deleted) projects.

  ### 2. New `check_milestone_limit()` function + trigger
  Raises an error when an INSERT on `milestones` would push a project past
  100 active milestones.

  ## Error messages (surfaced directly to the client)
  - "Project limit reached. A single account may have at most 500 projects."
  - "Milestone limit reached. A project may have at most 100 milestones."

  ## Notes
  - Both functions use SECURITY DEFINER so they can read past RLS.
  - Soft-deleted rows (deleted_at IS NOT NULL) are excluded from counts.
*/

-- ── 1. Extend check_project_limit to also enforce the 500-project absolute cap ──

CREATE OR REPLACE FUNCTION check_project_limit()
RETURNS trigger AS $$
DECLARE
  user_plan     text;
  project_count integer;
BEGIN
  SELECT COALESCE(plan, 'free')
  INTO user_plan
  FROM public.user_profiles
  WHERE id = NEW.user_id;

  IF user_plan IS NULL THEN
    user_plan := 'free';
  END IF;

  SELECT COUNT(*)
  INTO project_count
  FROM public.projects
  WHERE user_id = NEW.user_id
    AND deleted_at IS NULL;

  -- Absolute cap: applies to every plan
  IF project_count >= 500 THEN
    RAISE EXCEPTION 'Project limit reached. A single account may have at most 500 projects.';
  END IF;

  -- Free-plan cap
  IF user_plan = 'free' AND project_count >= 3 THEN
    RAISE EXCEPTION 'Free plan is limited to 3 projects. Upgrade to Premium for unlimited projects.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger already exists; recreate it to pick up the new function body.
DROP TRIGGER IF EXISTS enforce_project_limit ON projects;
CREATE TRIGGER enforce_project_limit
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION check_project_limit();

-- ── 2. Milestone limit: 100 per project ──────────────────────────────────────

CREATE OR REPLACE FUNCTION check_milestone_limit()
RETURNS trigger AS $$
DECLARE
  milestone_count integer;
BEGIN
  SELECT COUNT(*)
  INTO milestone_count
  FROM public.milestones
  WHERE project_id = NEW.project_id
    AND deleted_at IS NULL;

  IF milestone_count >= 100 THEN
    RAISE EXCEPTION 'Milestone limit reached. A project may have at most 100 milestones.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_milestone_limit ON milestones;
CREATE TRIGGER enforce_milestone_limit
  BEFORE INSERT ON milestones
  FOR EACH ROW EXECUTE FUNCTION check_milestone_limit();
