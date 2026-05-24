/*
  # Convert soft_delete_project and soft_delete_milestone to SECURITY INVOKER

  ## Problem
  The security advisor flags these two functions because authenticated users can
  call SECURITY DEFINER functions via RPC. SECURITY DEFINER runs as the function
  owner (postgres), which is more privilege than needed.

  ## Fix
  Switch both functions to SECURITY INVOKER so they execute as the calling user.
  This means Postgres RLS policies apply naturally. Both functions already check
  auth.uid() internally, so ownership enforcement is unchanged — just stricter.

  ## Impact
  - No change in behavior for legitimate callers
  - REVOKE the explicit authenticated grant since SECURITY INVOKER functions
    don't need it (PUBLIC execute is already revoked; we grant back to
    authenticated so the RPC endpoint remains accessible)
*/

CREATE OR REPLACE FUNCTION public.soft_delete_project(p_project_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.projects
  SET deleted_at = now()
  WHERE id        = p_project_id
    AND user_id   = v_uid
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.soft_delete_milestone(p_milestone_id uuid)
  RETURNS boolean
  LANGUAGE plpgsql
  SECURITY INVOKER
  SET search_path = 'public'
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE public.milestones
  SET deleted_at = now()
  WHERE id         = p_milestone_id
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id      = milestones.project_id
        AND projects.user_id = v_uid
        AND projects.deleted_at IS NULL
    );

  RETURN FOUND;
END;
$$;

-- Re-apply grants: PUBLIC was revoked previously; grant only to authenticated
-- so the RPC endpoint works for signed-in users
REVOKE EXECUTE ON FUNCTION public.soft_delete_project(uuid) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.soft_delete_milestone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_project(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.soft_delete_milestone(uuid) TO authenticated;
