/*
  # Fix self-referencing alias bug in immutable-column WITH CHECK subqueries

  ## Problem
  The previous migration used bare table names in correlated subqueries:
    project_id = (SELECT project_id FROM public.milestones WHERE id = milestones.id)
  Postgres resolved both "milestones" references as the same alias (milestones_1),
  producing the tautology WHERE id = id — the subquery always returned the current
  row's own value regardless of input, making the immutability check a no-op.

  Same issue affected projects.user_id and projects.created_at checks.

  ## Fix
  Use an explicit alias (orig) for the inner table reference to force Postgres
  to distinguish it from the outer row being checked.
*/

-- ── projects ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own projects" ON public.projects;

CREATE POLICY "Users can update own projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING  (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (
    auth.uid() = user_id
    AND user_id = (
          SELECT orig.user_id FROM public.projects orig WHERE orig.id = projects.id)
    AND created_at = (
          SELECT orig.created_at FROM public.projects orig WHERE orig.id = projects.id)
  );

-- ── milestones ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update milestones of own projects" ON public.milestones;

CREATE POLICY "Users can update milestones of own projects"
  ON public.milestones
  FOR UPDATE
  TO authenticated
  USING (
    deleted_at IS NULL
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id      = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    project_id = (
          SELECT orig.project_id FROM public.milestones orig WHERE orig.id = milestones.id)
    AND created_at = (
          SELECT orig.created_at FROM public.milestones orig WHERE orig.id = milestones.id)
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id      = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  );
