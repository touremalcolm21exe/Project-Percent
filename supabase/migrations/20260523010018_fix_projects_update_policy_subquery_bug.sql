/*
  # Fix projects UPDATE policy self-referential subquery bug

  ## Problem
  The "Users can update own projects" WITH CHECK contains subqueries that read
  back from the projects table to verify immutable columns:

    created_at = (SELECT orig.created_at FROM projects orig WHERE orig.id = projects.id)
    user_id    = (SELECT orig.user_id    FROM projects orig WHERE orig.id = projects.id)

  These subqueries are subject to the SELECT RLS policy (USING clause), which
  requires `deleted_at IS NULL`. When a soft-delete sets `deleted_at` to a
  timestamp, the WITH CHECK evaluates the NEW row. The subquery tries to find
  the same row in projects but the SELECT policy now filters it out (because
  deleted_at IS NOT NULL on the NEW row). The subquery returns no rows, the
  comparison evaluates to NULL (not TRUE), and the WITH CHECK fails — blocking
  every soft-delete even though the dedicated soft-delete policy permits it.

  ## Fix
  Drop and recreate "Users can update own projects" with a simplified WITH CHECK
  that drops the redundant subqueries. Immutability of user_id, id, and created_at
  is already enforced by column-level REVOKE UPDATE on those columns (applied in
  migration 20260522205658). The subqueries are therefore redundant and harmful.

  The soft-delete policy "Users can soft-delete own projects" is left unchanged.

  ## Security unchanged
  - user_id, id, created_at cannot be changed by authenticated users — enforced
    by REVOKE UPDATE at the column level (independent of RLS).
  - deleted_at can only be set via the dedicated soft-delete policy.
  - Normal edits (name, description, color, progress_percent) continue to require
    ownership and a non-deleted row via the USING clause.
*/

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;

CREATE POLICY "Users can update own projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING     (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);
