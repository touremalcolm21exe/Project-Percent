/*
  # Grant EXECUTE on recalculate_project_progress to authenticated role

  The function was only executable by postgres and service_role.
  Authenticated users need EXECUTE so the milestones_progress_trigger
  (which fires on INSERT/UPDATE/DELETE on milestones) can run it on their behalf.
*/

DO $$
DECLARE
  func_sig text;
BEGIN
  SELECT oid::regprocedure::text INTO func_sig
  FROM pg_proc
  WHERE proname = 'recalculate_project_progress'
    AND pronamespace = 'public'::regnamespace
  LIMIT 1;

  IF func_sig IS NOT NULL THEN
    EXECUTE 'GRANT EXECUTE ON FUNCTION ' || func_sig || ' TO authenticated';
  END IF;
END $$;
