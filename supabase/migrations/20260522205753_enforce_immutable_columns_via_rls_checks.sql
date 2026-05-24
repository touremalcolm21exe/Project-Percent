/*
  # Enforce immutable columns via RLS WITH CHECK

  ## Background
  In Supabase's managed Postgres, the `authenticated` role receives table-level
  UPDATE privilege through ownership inheritance, not explicit GRANTs. REVOKE
  on individual columns has no effect because the privilege is not column-level.
  RLS WITH CHECK clauses are therefore the correct and supported enforcement layer.

  ## Problem with the previous approach
  Two UPDATE policies coexisted on user_profiles:
    1. "Users can update own display columns" — blocked billing columns via subqueries
    2. "Users can update own profile" — only checked projects_created_count

  Postgres FOR UPDATE policies are evaluated with OR logic: any policy that
  approves the write allows it. Policy 2 was a bypass: a user could set
  plan='premium' while satisfying policy 2 (projects_created_count unchanged),
  regardless of policy 1 rejecting it.

  ## Fix

  ### user_profiles
  Drop all UPDATE policies. Replace with a single policy whose WITH CHECK
  asserts that every protected column equals its current stored value.
  Uses IS NOT DISTINCT FROM for nullable columns to handle NULL = NULL correctly.
  Protected: plan, stripe_customer_id, stripe_subscription_id,
             projects_created_count, id, created_at

  ### projects
  Replace the two UPDATE policies (regular + soft-delete) with a single policy.
  WITH CHECK asserts that user_id and created_at cannot change.
  id is the PK and cannot change regardless.

  ### milestones
  Replace the two UPDATE policies (regular + soft-delete) with a single policy.
  WITH CHECK asserts that project_id and created_at cannot change.

  ## Why single policies are safer than multiple
  Multiple FOR UPDATE policies create invisible OR bypass paths whenever a new
  policy is added that does not repeat all the column restrictions of older ones.
  A single policy with all checks combined is auditable at a glance.
*/

-- ── user_profiles ─────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own profile row"        ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own display columns"    ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"            ON public.user_profiles;

CREATE POLICY "Users can update own profile row"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    -- Row ownership
    auth.uid() = id
    -- Billing columns are immutable from the client; only the service-role
    -- stripe-webhook function may change these.
    AND plan IS NOT DISTINCT FROM (
          SELECT plan FROM public.user_profiles WHERE id = auth.uid())
    AND stripe_customer_id IS NOT DISTINCT FROM (
          SELECT stripe_customer_id FROM public.user_profiles WHERE id = auth.uid())
    AND stripe_subscription_id IS NOT DISTINCT FROM (
          SELECT stripe_subscription_id FROM public.user_profiles WHERE id = auth.uid())
    -- Immutable system columns
    AND projects_created_count = (
          SELECT projects_created_count FROM public.user_profiles WHERE id = auth.uid())
    AND created_at = (
          SELECT created_at FROM public.user_profiles WHERE id = auth.uid())
  );

-- ── projects ──────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update own projects"           ON public.projects;
DROP POLICY IF EXISTS "Users can soft-delete own projects"      ON public.projects;
DROP POLICY IF EXISTS "Users can update own active projects"    ON public.projects;

CREATE POLICY "Users can update own projects"
  ON public.projects
  FOR UPDATE
  TO authenticated
  USING  (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (
    -- Ownership anchor must not change
    auth.uid() = user_id
    AND user_id = (SELECT user_id FROM public.projects WHERE id = projects.id)
    -- Creation timestamp is immutable
    AND created_at = (SELECT created_at FROM public.projects WHERE id = projects.id)
  );

-- ── milestones ────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can update milestones of own projects"         ON public.milestones;
DROP POLICY IF EXISTS "Users can soft-delete milestones of own projects"    ON public.milestones;
DROP POLICY IF EXISTS "Users can update milestones of own active projects"  ON public.milestones;

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
    -- project_id reassignment is not permitted
    project_id = (SELECT project_id FROM public.milestones WHERE id = milestones.id)
    -- Creation timestamp is immutable
    AND created_at = (SELECT created_at FROM public.milestones WHERE id = milestones.id)
    -- The target project must still be owned by the caller
    AND EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id      = milestones.project_id
        AND projects.user_id = auth.uid()
        AND projects.deleted_at IS NULL
    )
  );
