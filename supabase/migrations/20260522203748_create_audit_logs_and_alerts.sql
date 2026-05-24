/*
  # Create audit_logs and audit_alerts tables

  ## Summary
  Introduces two new tables for security auditing and alerting.

  ## New Tables

  ### audit_logs
  Immutable append-only record of security-relevant events.
  - `id` (uuid, pk) — unique event identifier
  - `event_type` (text) — enumerated event kind; constrained to a closed set
  - `actor_id` (uuid, nullable) — auth.users.id of the acting user; null for
    unauthenticated events (e.g. failed login with unknown email)
  - `actor_ip` (text, nullable) — IP address extracted by the edge function from
    request headers; stored for correlation of abuse patterns
  - `metadata` (jsonb) — event-specific detail (project_id, plan change, etc.)
  - `created_at` (timestamptz) — wall-clock time of the event

  ### audit_alerts
  Records of anomalies detected by Postgres trigger functions.
  - `id` (uuid, pk)
  - `alert_type` (text) — e.g. 'repeated_login_failures', 'rate_limit_spike', 'webhook_error'
  - `details` (jsonb) — context for investigation
  - `created_at` (timestamptz)
  - `resolved_at` (timestamptz, nullable) — set when the alert is acknowledged

  ## Security

  ### audit_logs
  - RLS enabled; users may SELECT only their own rows (actor_id = auth.uid()).
  - INSERT is via the `audit-log` edge function (service role) — no direct client
    inserts are possible through the anon key because there is no INSERT policy
    for authenticated/anon roles.
  - No UPDATE or DELETE policies exist, making the table append-only from the
    client's perspective.

  ### audit_alerts
  - RLS enabled; no policies created here — alerts are for operators only and
    will be accessed via the service role key or a future admin interface.

  ## Notes
  - The `event_type` CHECK constraint is the authoritative list of loggable events.
    Adding a new event type requires a migration — intentional friction to prevent
    log pollution.
  - `actor_ip` is text rather than inet so IPv6 addresses and X-Forwarded-For
    chains can be stored verbatim before normalisation.
*/

-- ── audit_logs ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  text        NOT NULL,
  actor_id    uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_ip    text,
  metadata    jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at  timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT audit_logs_event_type_check CHECK (event_type IN (
    -- auth
    'login_success',
    'login_failure',
    'signup_success',
    'signup_failure',
    'password_reset_requested',
    'password_reset_success',
    'password_reset_failure',
    -- billing
    'checkout_started',
    'checkout_rate_limited',
    'billing_upgraded',
    'billing_downgraded',
    'webhook_error',
    -- destructive actions
    'project_deleted',
    'milestone_deleted'
  ))
);

-- Immutable: no row-level updates or physical deletes permitted.
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Authenticated users may read their own audit rows.
CREATE POLICY "Users can read own audit logs"
  ON public.audit_logs
  FOR SELECT
  TO authenticated
  USING (auth.uid() = actor_id);

-- Index for per-user log retrieval.
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_idx
  ON public.audit_logs (actor_id, created_at DESC);

-- Index for alert trigger queries (event_type + actor_ip + created_at window).
CREATE INDEX IF NOT EXISTS audit_logs_event_type_actor_ip_idx
  ON public.audit_logs (event_type, actor_ip, created_at DESC);

-- Index for actor_id + event_type used by rate-limit spike alert.
CREATE INDEX IF NOT EXISTS audit_logs_actor_id_event_type_idx
  ON public.audit_logs (actor_id, event_type, created_at DESC);

-- ── audit_alerts ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_alerts (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  alert_type   text        NOT NULL,
  details      jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  resolved_at  timestamptz
);

ALTER TABLE public.audit_alerts ENABLE ROW LEVEL SECURITY;
-- No client-facing policies: alerts are operator-only.
