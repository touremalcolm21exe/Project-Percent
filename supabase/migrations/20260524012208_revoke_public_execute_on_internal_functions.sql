/*
  # Revoke PUBLIC EXECUTE on all internal SECURITY DEFINER functions

  ## Problem
  When PostgreSQL creates a function it grants EXECUTE to PUBLIC by default.
  The previous migration only revoked from named roles (anon, authenticated)
  but left the implicit PUBLIC grant in place, which is what Supabase's
  security advisor detects.

  ## Changes
  - REVOKE EXECUTE FROM PUBLIC on every internal/trigger function that must
    never be called directly via REST/RPC.
  - For soft_delete_project and soft_delete_milestone: revoke PUBLIC but keep
    the explicit GRANT to `authenticated` because the frontend calls these via
    RPC and they already enforce ownership via auth.uid() internally.

  ## Functions locked down (no direct RPC access)
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
  - milestones_immutable_columns
  - raise_rate_limit_spike_alert
  - raise_repeated_login_failure_alert
  - raise_webhook_error_alert

  ## Functions kept accessible to authenticated users only
  - soft_delete_project
  - soft_delete_milestone
*/

-- Revoke from PUBLIC (covers anon, authenticated, and all other roles)
REVOKE EXECUTE ON FUNCTION public.create_user_profile() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.recalculate_project_progress(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_recalculate_progress() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_updated_at() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_projects_created_count() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_project_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_milestone_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_creation_rate_limit(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_project_creation_rate_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_milestone_creation_rate_limit() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.milestones_immutable_columns() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.raise_rate_limit_spike_alert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.raise_repeated_login_failure_alert() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.raise_webhook_error_alert() FROM PUBLIC;

-- soft_delete_* are called by the app — revoke PUBLIC but keep authenticated
REVOKE EXECUTE ON FUNCTION public.soft_delete_project(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_milestone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_milestone(uuid) TO authenticated;
