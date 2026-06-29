/*
  # Update plan limits and open sharing to all tiers

  - Free: 1 active project, shareable link allowed
  - Paid (premium / Monthly / Founder Deal): unlimited active projects, shareable links
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

  -- Paid tiers (Monthly subscription, Founder Deal, legacy Premium): unlimited projects.
  IF user_plan = 'premium' THEN
    RETURN NEW;
  END IF;

  -- Free tier: one active project at a time.
  IF project_count >= 1 THEN
    RAISE EXCEPTION 'Free plan is limited to 1 project. Upgrade to Monthly or Founder Deal for unlimited projects.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.set_project_sharing(
  p_project_id uuid,
  p_is_public boolean
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_public_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  IF p_is_public THEN
    UPDATE public.projects
    SET
      is_public = true,
      public_id = coalesce(public_id, gen_random_uuid())
    WHERE id = p_project_id
      AND user_id = v_uid
      AND deleted_at IS NULL
    RETURNING public_id INTO v_public_id;

    IF NOT FOUND THEN
      RETURN NULL;
    END IF;

    RETURN v_public_id;
  END IF;

  UPDATE public.projects
  SET is_public = false
  WHERE id = p_project_id
    AND user_id = v_uid
    AND deleted_at IS NULL;

  RETURN NULL;
END;
$$;

REVOKE ALL ON FUNCTION public.set_project_sharing(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_project_sharing(uuid, boolean) TO authenticated;
