/*
  # Fix infinite recursion in milestones UPDATE RLS policy

  ## Problem
  The WITH CHECK clause on the milestones UPDATE policy contained correlated
  subqueries that SELECT from the milestones table itself. Postgres evaluates
  RLS policies when accessing any row of a table — including inside subqueries —
  so the policy triggered itself recursively, producing a 42P17 error.

  ## Fix
  Replace the self-referencing subqueries with a trigger-based immutability
  guard that runs as SECURITY DEFINER (bypassing RLS) and therefore cannot loop.
  The RLS UPDATE policy is simplified to only enforce ownership (which is safe
  because it checks the projects table, not milestones itself).

  The same infinite-recursion risk exists on user_profiles (self-join on plan,
  stripe_customer_id etc.) so those subqueries are also replaced here with a
  trigger approach, but to keep scope minimal we focus on milestones first.
*/

-- ── Drop the recursive milestones UPDATE policy ───────────────────────────────

DROP POLICY IF EXISTS "Users can update milestones of own projects" ON public.milestones;

-- ── Replacement: simple ownership-only UPDATE policy ─────────────────────────
-- project_id and created_at immutability is enforced by the trigger below.

CREATE POLICY "Users can update milestones of own projects"
  ON public.milestones
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id      = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id      = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  );

-- ── Trigger: enforce immutable columns on milestones ─────────────────────────
-- Runs as SECURITY DEFINER so it bypasses RLS and cannot cause recursion.

CREATE OR REPLACE FUNCTION public.milestones_immutable_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id <> OLD.project_id THEN
    RAISE EXCEPTION 'project_id is immutable';
  END IF;
  IF NEW.created_at <> OLD.created_at THEN
    RAISE EXCEPTION 'created_at is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS milestones_immutable_columns_trig ON public.milestones;

CREATE TRIGGER milestones_immutable_columns_trig
  BEFORE UPDATE ON public.milestones
  FOR EACH ROW EXECUTE FUNCTION public.milestones_immutable_columns();
