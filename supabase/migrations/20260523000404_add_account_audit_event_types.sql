/*
  # Add account management audit event types

  ## Changes
  - Adds new allowed values to the audit_logs.event_type CHECK constraint:
    - `billing_portal_accessed` — user opened Stripe billing portal
    - `account_deleted` — user deleted their own account

  ## Notes
  - The constraint is dropped and recreated to add the new values alongside existing ones
  - This is additive only — no existing data is modified
*/

ALTER TABLE audit_logs
  DROP CONSTRAINT IF EXISTS audit_logs_event_type_check;

ALTER TABLE audit_logs
  ADD CONSTRAINT audit_logs_event_type_check CHECK (
    event_type = ANY (ARRAY[
      'login_success',
      'login_failure',
      'signup_success',
      'signup_failure',
      'password_reset_requested',
      'password_reset_success',
      'password_reset_failure',
      'checkout_started',
      'checkout_rate_limited',
      'billing_upgraded',
      'billing_downgraded',
      'billing_portal_accessed',
      'webhook_error',
      'project_deleted',
      'milestone_deleted',
      'account_deleted'
    ])
  );
