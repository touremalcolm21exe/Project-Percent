/*
  # Fix milestone progress recalculation permission error

  ## Problem
  The `milestones_progress_trigger` fires `trigger_recalculate_progress()` after
  INSERT/UPDATE/DELETE on milestones. That function calls
  `public.recalculate_project_progress(uuid)`.

  `trigger_recalculate_progress` was SECURITY INVOKER, meaning it ran as the
  calling role (authenticated). A prior migration revoked EXECUTE on
  `recalculate_project_progress` from the authenticated role (to close a direct
  RPC vector), which caused the trigger path to also fail with
  "permission denied for function recalculate_project_progress".

  ## Fix
  Recreate `trigger_recalculate_progress` as SECURITY DEFINER so the trigger
  wrapper executes as its owner (postgres) and can call the inner function
  regardless of what the calling role can directly execute. The authenticated
  role still cannot call `recalculate_project_progress` directly via RPC.
*/

CREATE OR REPLACE FUNCTION public.trigger_recalculate_progress()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path = public
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

-- Revoke direct execution from non-superuser roles — the only entry point
-- should be the trigger, not the RPC endpoint.
REVOKE EXECUTE ON FUNCTION public.trigger_recalculate_progress() FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trigger_recalculate_progress() FROM authenticated;
