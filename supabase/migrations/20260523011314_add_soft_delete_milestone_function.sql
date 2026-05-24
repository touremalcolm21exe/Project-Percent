/*
  # Add soft_delete_milestone security-definer function

  ## Problem
  The milestones UPDATE policy WITH CHECK only verifies that the parent project
  is owned by the caller and not deleted. It does not permit setting
  deleted_at to a non-null value, so any soft-delete attempt from an
  authenticated client is rejected by RLS with "new row violates row-level
  security policy".

  ## Solution
  A SECURITY DEFINER function that:
  1. Verifies auth.uid() owns the parent project of the milestone.
  2. Verifies the milestone is not already soft-deleted.
  3. Sets deleted_at = now() on the milestone.
  4. Returns boolean: true = deleted, false = not found / already deleted / not owner.

  SECURITY DEFINER bypasses RLS for the UPDATE. Ownership is enforced
  explicitly inside the function body, so security is equivalent to what
  the policy intended.

  The milestones_progress_trigger fires after the UPDATE and calls
  recalculate_project_progress(), which updates projects.progress_percent.
  This is unchanged — the trigger still fires correctly.
*/

CREATE OR REPLACE FUNCTION public.soft_delete_milestone(p_milestone_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN
    RETURN false;
  END IF;

  UPDATE milestones
  SET deleted_at = now()
  WHERE id         = p_milestone_id
    AND deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM projects
      WHERE projects.id      = milestones.project_id
        AND projects.user_id = v_uid
        AND projects.deleted_at IS NULL
    );

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.soft_delete_milestone(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_milestone(uuid) TO authenticated;
