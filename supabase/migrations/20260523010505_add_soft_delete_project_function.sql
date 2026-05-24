/*
  # Add soft_delete_project security-definer function

  ## Problem
  Despite correct-looking RLS UPDATE policies, authenticated users cannot
  soft-delete their own projects due to an unresolved Postgres RLS WITH CHECK
  interaction. The exact cause (likely involving how Supabase's PostgREST
  translates the request into a SQL UPDATE and how the WITH CHECK is evaluated
  against the post-trigger NEW row) has been difficult to isolate purely through
  policy changes.

  ## Solution
  A SECURITY DEFINER function that:
  1. Verifies the calling user (auth.uid()) owns the project — same ownership
     check that RLS would enforce.
  2. Verifies the project is not already soft-deleted.
  3. Sets deleted_at = now().
  4. Does NOT touch projects_created_count — the lifetime counter is immutable
     and only incremented by the on_project_inserted AFTER INSERT trigger.

  SECURITY DEFINER bypasses RLS for the UPDATE, so the WITH CHECK issue is
  irrelevant. Ownership is enforced explicitly inside the function body.

  ## Security notes
  - auth.uid() is read inside the function, so the caller cannot spoof ownership.
  - Returns boolean: true = deleted, false = not found / already deleted / not owner.
  - Function is granted EXECUTE to authenticated only; anon cannot call it.
*/

CREATE OR REPLACE FUNCTION public.soft_delete_project(p_project_id uuid)
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

  UPDATE projects
  SET deleted_at = now()
  WHERE id         = p_project_id
    AND user_id    = v_uid
    AND deleted_at IS NULL;

  RETURN FOUND;
END;
$$;

-- Only authenticated users may call this function
REVOKE ALL ON FUNCTION public.soft_delete_project(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.soft_delete_project(uuid) TO authenticated;
