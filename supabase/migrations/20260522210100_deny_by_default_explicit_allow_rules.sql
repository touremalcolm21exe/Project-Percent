/*
  # Deny by default — explicit allow rules for every table and action

  ## Design principle
  RLS enabled with no policy = deny by default for that action. This is correct
  but silent: the intent is invisible, and a future developer adding a permissive
  policy for one action may not realise other actions are uncovered.

  This migration makes every denial EXPLICIT using two complementary techniques:

  1. RESTRICTIVE policies on actions that must NEVER be allowed from the client
     regardless of any future permissive policies that might be added.
     RESTRICTIVE policies are AND-ed with permissive ones: even if a future
     permissive INSERT policy is mistakenly added to audit_logs, the RESTRICTIVE
     policy here ensures it can never succeed for authenticated/anon users.

  2. Explicit documentation of the deny-by-default stance for tables where
     RLS already provides the right default (no rows pass = no access).

  ## Coverage matrix after this migration

  ### projects
  | Action | Rule | Who |
  |--------|------|-----|
  | SELECT | PERMISSIVE allow | authenticated (own, not deleted) |
  | INSERT | PERMISSIVE allow | authenticated (own row, defaults only) |
  | UPDATE | PERMISSIVE allow | authenticated (own, immutable cols locked) |
  | DELETE | RESTRICTIVE deny | all — hard deletes forbidden; use soft-delete |

  ### milestones
  | Action | Rule | Who |
  |--------|------|-----|
  | SELECT | PERMISSIVE allow | authenticated (own project's milestones) |
  | INSERT | PERMISSIVE allow | authenticated (own project) |
  | UPDATE | PERMISSIVE allow | authenticated (own project, immutable cols locked) |
  | DELETE | RESTRICTIVE deny | all — hard deletes forbidden; use soft-delete |

  ### user_profiles
  | Action | Rule | Who |
  |--------|------|-----|
  | SELECT | PERMISSIVE allow | authenticated (own row) |
  | INSERT | PERMISSIVE allow | authenticated (own row, billing cols locked to defaults) |
  | UPDATE | PERMISSIVE allow | authenticated (own row, billing/system cols immutable) |
  | DELETE | RESTRICTIVE deny | all — profiles must persist for audit/billing history |

  ### audit_logs
  | Action | Rule | Who |
  |--------|------|-----|
  | SELECT | PERMISSIVE allow | authenticated (own actor_id rows only) |
  | INSERT | RESTRICTIVE deny | all — only service-role edge function may insert |
  | UPDATE | RESTRICTIVE deny | all — append-only; no row may ever be modified |
  | DELETE | RESTRICTIVE deny | all — immutable audit trail |

  ### audit_alerts
  | Action | Rule | Who |
  |--------|------|-----|
  | SELECT | RESTRICTIVE deny | all authenticated/anon — operator-only via service role |
  | INSERT | RESTRICTIVE deny | all — only SECURITY DEFINER triggers may insert |
  | UPDATE | RESTRICTIVE deny | all — only service role may mark resolved |
  | DELETE | RESTRICTIVE deny | all |

  ### rate_limits
  | Action | Rule | Who |
  |--------|------|-----|
  | SELECT | RESTRICTIVE deny | all — internal state; clients must not read |
  | INSERT | RESTRICTIVE deny | all — only create-checkout edge function (service role) |
  | UPDATE | RESTRICTIVE deny | all — same |
  | DELETE | RESTRICTIVE deny | all — same |

  ## Notes
  - Service role (used by all edge functions) bypasses RLS entirely regardless
    of RESTRICTIVE policies. This is Postgres behaviour; RESTRICTIVE policies
    only constrain non-owner roles (authenticated, anon).
  - SECURITY DEFINER trigger functions also bypass RLS and are unaffected.
  - RESTRICTIVE policies that use USING (false) or WITH CHECK (false) are
    absolute: no permissive policy can ever override them for the covered roles.
*/

-- ══════════════════════════════════════════════════════════════════════════════
-- projects: deny hard DELETE for all roles
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "Hard deletes are forbidden — use soft-delete"
  ON public.projects
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- ══════════════════════════════════════════════════════════════════════════════
-- milestones: deny hard DELETE for all roles
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "Hard deletes are forbidden — use soft-delete"
  ON public.milestones
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- ══════════════════════════════════════════════════════════════════════════════
-- user_profiles: deny DELETE for all roles
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "Profile deletion is forbidden"
  ON public.user_profiles
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- ══════════════════════════════════════════════════════════════════════════════
-- audit_logs: append-only — deny INSERT, UPDATE, DELETE from all client roles
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "Audit log rows may not be inserted by clients"
  ON public.audit_logs
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Audit log rows are immutable"
  ON public.audit_logs
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (false);

CREATE POLICY "Audit log rows may not be deleted"
  ON public.audit_logs
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- ══════════════════════════════════════════════════════════════════════════════
-- audit_alerts: operator-only — deny all access from all client roles
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "Audit alerts are operator-only — no client reads"
  ON public.audit_alerts
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated, anon
  USING (false);

CREATE POLICY "Audit alerts may not be inserted by clients"
  ON public.audit_alerts
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Audit alerts may not be updated by clients"
  ON public.audit_alerts
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (false);

CREATE POLICY "Audit alerts may not be deleted by clients"
  ON public.audit_alerts
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);

-- ══════════════════════════════════════════════════════════════════════════════
-- rate_limits: internal state — deny all access from all client roles
-- ══════════════════════════════════════════════════════════════════════════════

CREATE POLICY "Rate limit state is internal — no client reads"
  ON public.rate_limits
  AS RESTRICTIVE
  FOR SELECT
  TO authenticated, anon
  USING (false);

CREATE POLICY "Rate limit rows may not be inserted by clients"
  ON public.rate_limits
  AS RESTRICTIVE
  FOR INSERT
  TO authenticated, anon
  WITH CHECK (false);

CREATE POLICY "Rate limit rows may not be updated by clients"
  ON public.rate_limits
  AS RESTRICTIVE
  FOR UPDATE
  TO authenticated, anon
  USING (false);

CREATE POLICY "Rate limit rows may not be deleted by clients"
  ON public.rate_limits
  AS RESTRICTIVE
  FOR DELETE
  TO authenticated, anon
  USING (false);
