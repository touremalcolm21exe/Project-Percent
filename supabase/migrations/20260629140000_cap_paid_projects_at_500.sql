/*
  # Cap paid tiers at 500 projects; free tier remains at 1

  - Free: 1 active project, shareable link allowed
  - Paid (Monthly / Founder Deal / premium): up to 500 active projects, each shareable
*/

CREATE OR REPLACE FUNCTION public.check_project_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
AS $$
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

  -- Absolute cap for paid tiers (Monthly, Founder Deal).
  IF user_plan = 'premium' AND project_count >= 500 THEN
    RAISE EXCEPTION 'Project limit reached. Paid plans may have at most 500 projects.';
  END IF;

  -- Free tier: one active project.
  IF user_plan = 'free' AND project_count >= 1 THEN
    RAISE EXCEPTION 'Free plan is limited to 1 project. Upgrade to Monthly or Founder Deal for up to 500 projects.';
  END IF;

  RETURN NEW;
END;
$$;
