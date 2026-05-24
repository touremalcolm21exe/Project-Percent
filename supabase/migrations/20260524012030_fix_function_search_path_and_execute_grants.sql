/*
  # Fix function security issues

  ## Summary
  Addresses two classes of Supabase security advisor warnings:

  1. **Mutable search_path** — All SECURITY DEFINER (and SECURITY INVOKER trigger)
     functions now have `SET search_path = 'public'` so an attacker cannot shadow
     built-in objects by manipulating the caller's search_path.

  2. **Public/authenticated EXECUTE on internal SECURITY DEFINER functions** —
     Trigger functions and internal helpers that should never be called directly
     via REST/RPC have EXECUTE revoked from `anon` and `authenticated`.
     - `soft_delete_project` and `soft_delete_milestone` are legitimately called
       by the frontend, so `authenticated` retains EXECUTE; `anon` is revoked.
     - `check_creation_rate_limit` is an internal helper only called by trigger
       functions, so both roles are revoked.

  3. **Dev-only test functions** — Dropped entirely; they have no place in
     production.

  ## Functions recreated with fixed search_path
  - create_user_profile
  - recalculate_project_progress
  - trigger_recalculate_progress
  - update_updated_at
  - increment_projects_created_count
  - check_project_limit
  - check_milestone_limit
  - check_creation_rate_limit
  - trg_project_creation_rate_limit
  - trg_milestone_creation_rate_limit

  ## Functions dropped
  - test_soft_delete_rls
  - test_auth_uid
  - test_plain_update
  - test_softdelete
  - test_soft_delete_fn
*/

-- ============================================================
-- 1. Recreate all affected functions with SET search_path
-- ============================================================

CREATE OR REPLACE FUNCTION public.create_user_profile()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  INSERT INTO public.user_profiles (id)
  VALUES (NEW.id)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalculate_project_progress(p_project_id uuid)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  total_count    integer;
  complete_count integer;
  new_percent    integer;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE is_complete = true)
  INTO total_count, complete_count
  FROM public.milestones
  WHERE project_id = p_project_id
    AND deleted_at IS NULL;

  IF total_count = 0 THEN
    new_percent := 0;
  ELSE
    new_percent := ROUND((complete_count::numeric / total_count::numeric) * 100);
  END IF;

  UPDATE public.projects
  SET progress_percent = new_percent,
      updated_at       = now()
  WHERE id = p_project_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trigger_recalculate_progress()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalculate_project_progress(OLD.project_id);
  ELSE
    PERFORM public.recalculate_project_progress(NEW.project_id);
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_updated_at()
  RETURNS trigger
  LANGUAGE plpgsql
  SET search_path = 'public'
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.increment_projects_created_count()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  UPDATE public.user_profiles
  SET projects_created_count = projects_created_count + 1
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_project_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
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
  WHERE user_id  = NEW.user_id
    AND deleted_at IS NULL;

  IF project_count >= 500 THEN
    RAISE EXCEPTION 'Project limit reached. A single account may have at most 500 projects.';
  END IF;

  IF user_plan = 'free' AND project_count >= 3 THEN
    RAISE EXCEPTION 'Free plan is limited to 3 projects. Upgrade to Premium for unlimited projects.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.check_milestone_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
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
$$;

CREATE OR REPLACE FUNCTION public.check_creation_rate_limit(p_user_id uuid, p_action text)
  RETURNS void
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  v_attempts     integer;
  v_window_start timestamptz;
  v_limit        integer := 30;
  v_window_secs  integer := 60;
BEGIN
  INSERT INTO public.rate_limits (key, action, attempts, window_start)
  VALUES (p_user_id::text, p_action, 1, now())
  ON CONFLICT (key, action) DO UPDATE
  SET
    attempts     = CASE
                     WHEN now() - rate_limits.window_start > (v_window_secs || ' seconds')::interval
                     THEN 1
                     ELSE rate_limits.attempts + 1
                   END,
    window_start = CASE
                     WHEN now() - rate_limits.window_start > (v_window_secs || ' seconds')::interval
                     THEN now()
                     ELSE rate_limits.window_start
                   END
  RETURNING attempts, window_start
  INTO v_attempts, v_window_start;

  IF v_attempts > v_limit THEN
    RAISE EXCEPTION 'Too many requests. You can create at most % items per minute. Please wait a moment and try again.', v_limit
      USING ERRCODE = 'P0001';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_project_creation_rate_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
BEGIN
  PERFORM public.check_creation_rate_limit(NEW.user_id, 'create_item');
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_milestone_creation_rate_limit()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = 'public'
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_user_id IS NOT NULL THEN
    PERFORM public.check_creation_rate_limit(v_user_id, 'create_item');
  END IF;
  RETURN NEW;
END;
$$;

-- ============================================================
-- 2. Revoke EXECUTE from anon/authenticated on functions that
--    must never be called directly via REST/RPC
-- ============================================================

-- Trigger-only / internal helpers — revoke from both roles
REVOKE EXECUTE ON FUNCTION public.create_user_profile() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.recalculate_project_progress(uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trigger_recalculate_progress() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.increment_projects_created_count() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_project_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_milestone_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.check_creation_rate_limit(uuid, text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_project_creation_rate_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_milestone_creation_rate_limit() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.milestones_immutable_columns() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.raise_rate_limit_spike_alert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.raise_repeated_login_failure_alert() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.raise_webhook_error_alert() FROM anon, authenticated;

-- soft_delete_* are legitimately called by the app — keep authenticated, revoke anon only
REVOKE EXECUTE ON FUNCTION public.soft_delete_project(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.soft_delete_milestone(uuid) FROM anon;

-- ============================================================
-- 3. Drop dev-only test functions
-- ============================================================

DROP FUNCTION IF EXISTS public.test_soft_delete_rls(uuid, uuid);
DROP FUNCTION IF EXISTS public.test_auth_uid(uuid);
DROP FUNCTION IF EXISTS public.test_plain_update(uuid, uuid);
DROP FUNCTION IF EXISTS public.test_softdelete(uuid, uuid);
DROP FUNCTION IF EXISTS public.test_soft_delete_fn(uuid, uuid);
