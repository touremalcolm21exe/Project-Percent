/*
  # Restore soft-delete UPDATE policy for projects

  ## Problem
  A series of migrations that consolidated the projects UPDATE policy into a
  single immutability-checking policy accidentally removed the dedicated
  soft-delete path. The consolidated WITH CHECK enforces that `user_id` and
  `created_at` are immutable but has no branch that permits `deleted_at`
  transitioning from NULL to a timestamp, so every soft-delete attempt is
  rejected by RLS.

  ## Fix
  Re-add the dedicated soft-delete UPDATE policy that was originally created in
  `add_soft_delete_to_projects_and_milestones`. It allows exactly one thing:
  setting `deleted_at` to a non-null value on a row the authenticated user owns.

  The existing "Users can update own projects" policy continues to cover normal
  field edits (name, description, color, progress_percent) with the immutability
  checks intact. The two policies are OR-ed by Postgres for the UPDATE command,
  so whichever one matches the intended write is used.

  ## Security notes
  - The USING clause still requires `deleted_at IS NULL`, preventing any write
    to an already-deleted row.
  - WITH CHECK requires `deleted_at IS NOT NULL`, so a client cannot use this
    policy path to "un-delete" a row or make any other field change.
  - `total_projects_created` / `projects_created_count` is NOT touched here:
    the lifetime counter lives on user_profiles and is only incremented by the
    AFTER INSERT trigger on projects. Soft-deleting a project does not call
    that trigger and does not decrement the counter — the limit is intentionally
    permanent.
*/

DROP POLICY IF EXISTS "Users can soft-delete own projects" ON public.projects;

CREATE POLICY "Users can soft-delete own projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING  (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id AND deleted_at IS NOT NULL);
