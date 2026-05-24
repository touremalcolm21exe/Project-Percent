/*
  # Add RLS and query performance indexes

  ## Summary
  Adds four indexes that eliminate heap fetches and sequential scans identified
  through analysis of every RLS policy, trigger function, and edge function query.

  ## Analysis of existing indexes
  The following indexes already exist and are not changed:
  - projects(user_id) — covers projects RLS `auth.uid() = user_id`
  - projects(deleted_at) WHERE deleted_at IS NULL — covers soft-delete filter on projects
  - milestones(project_id) — covers basic project_id lookups
  - milestones(deleted_at) WHERE deleted_at IS NULL — covers soft-delete filter on milestones
  - rate_limits(key, action) UNIQUE — covers checkRateLimit SELECT
  - audit_logs(actor_id, created_at DESC) — covers audit_logs RLS SELECT
  - audit_logs(event_type, actor_ip, created_at DESC) — covers repeated-login-failure trigger
  - audit_logs(actor_id, event_type, created_at DESC) — covers rate-limit-spike trigger
  - user_profiles(id) PRIMARY KEY — covers all user_profiles RLS point lookups

  ## New Indexes

  ### 1. projects(id, user_id) WHERE deleted_at IS NULL
  Every RLS policy on the milestones table runs an EXISTS correlated subquery:
    EXISTS (SELECT 1 FROM projects
            WHERE projects.id = milestones.project_id
              AND projects.user_id = auth.uid()
              AND projects.deleted_at IS NULL)
  Without this index, Postgres resolves `projects.id = milestones.project_id` via
  the primary key, then fetches the heap row to check user_id and deleted_at.
  This composite partial index (id leading, user_id included, restricted to
  non-deleted rows) allows the entire EXISTS lookup — including the ownership and
  soft-delete checks — to be resolved from the index alone, avoiding the heap
  fetch on every milestone row access.
  Applies to: all four milestones RLS policies (SELECT, INSERT, UPDATE × 2).

  ### 2. milestones(project_id, is_complete) WHERE deleted_at IS NULL
  The recalculate_project_progress() trigger function runs after every milestone
  INSERT, UPDATE, or DELETE:
    SELECT COUNT(*), COUNT(*) FILTER (WHERE is_complete = true)
    FROM milestones WHERE project_id = p_project_id AND deleted_at IS NULL
  The existing milestones_project_id_idx covers the project_id predicate but
  forces a heap fetch for the is_complete column used in the filtered COUNT.
  This composite partial index includes both columns so the aggregation can be
  satisfied entirely from the index, which is important because this trigger fires
  on every milestone toggle, add, and delete.
  This index also makes the milestones_project_id_idx redundant for queries that
  filter on deleted_at IS NULL (the common case), though the simple index is kept
  for the rare case of querying deleted milestones.

  ### 3. user_profiles(stripe_customer_id) WHERE stripe_customer_id IS NOT NULL
  The stripe-webhook edge function looks up users by Stripe customer ID on every
  billing event:
    .from('user_profiles').select('id').eq('stripe_customer_id', customerId)
    .from('user_profiles').update({...}).eq('stripe_customer_id', customerId)
  Without an index these are full sequential scans on user_profiles. The partial
  index (restricted to non-null values) is smaller and faster than a full index
  because most rows will have stripe_customer_id = NULL (free-plan users who have
  never initiated checkout).

  ### 4. audit_alerts(resolved_at) WHERE resolved_at IS NULL
  Operators querying open (unresolved) alerts will filter WHERE resolved_at IS NULL.
  This partial index makes that scan O(open alerts) rather than O(all alerts),
  which matters as the table grows over time.
*/

-- ── 1. Composite covering index for milestones RLS EXISTS subquery ────────────
-- Allows the full (id, user_id, deleted_at IS NULL) check on projects to be
-- resolved from the index during every milestone policy evaluation.
CREATE INDEX IF NOT EXISTS projects_id_user_id_active_idx
  ON public.projects (id, user_id)
  WHERE deleted_at IS NULL;

-- ── 2. Composite partial index for recalculate_project_progress() ─────────────
-- Lets the COUNT(*) / COUNT(*) FILTER (WHERE is_complete) aggregation run
-- entirely from the index on every milestone trigger invocation.
CREATE INDEX IF NOT EXISTS milestones_project_id_is_complete_active_idx
  ON public.milestones (project_id, is_complete)
  WHERE deleted_at IS NULL;

-- ── 3. Stripe customer ID lookup index ───────────────────────────────────────
-- Covers the eq('stripe_customer_id', ...) queries in the stripe-webhook
-- edge function that run on every billing event.
CREATE INDEX IF NOT EXISTS user_profiles_stripe_customer_id_idx
  ON public.user_profiles (stripe_customer_id)
  WHERE stripe_customer_id IS NOT NULL;

-- ── 4. Open audit alerts index ───────────────────────────────────────────────
-- Makes WHERE resolved_at IS NULL queries on audit_alerts index-only scans.
CREATE INDEX IF NOT EXISTS audit_alerts_unresolved_idx
  ON public.audit_alerts (created_at DESC)
  WHERE resolved_at IS NULL;
