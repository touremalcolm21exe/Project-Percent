/*
  # Revoke EXECUTE on recalculate_project_progress from authenticated role

  The function is SECURITY DEFINER and is only meant to be called by internal
  database triggers (milestones_progress_trigger). It must not be callable by
  authenticated users via the REST API (/rest/v1/rpc/).

  This revoke closes that vector while leaving the trigger-based invocation
  (which runs as the trigger owner, not the authenticated role) intact.
*/

REVOKE EXECUTE ON FUNCTION public.recalculate_project_progress(uuid) FROM authenticated;
