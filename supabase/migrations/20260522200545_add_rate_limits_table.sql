/*
  # Add rate_limits table for server-side request throttling

  ## Purpose
  Provides a generic, durable rate-limiting store for edge functions.
  Each row tracks a sliding window of attempts for a (key, action) pair.
  The edge function increments the counter, checks it against the allowed
  maximum, and rejects the request when exceeded.

  ## New Tables
  - `rate_limits`
    - `id`          (uuid, primary key)
    - `key`         (text) — identifier for the subject being limited, e.g. user_id or IP
    - `action`      (text) — the action being limited, e.g. 'create_checkout'
    - `attempts`    (integer) — number of attempts in the current window
    - `window_start`(timestamptz) — when the current window opened
    - `created_at`  (timestamptz)

  ## Security
  - RLS enabled; no direct-client access — only the service-role key used by
    edge functions may read or write this table.
  - No authenticated-user policies are created deliberately: the table is
    internal infrastructure, not user-facing data.

  ## Notes
  - A unique index on (key, action) allows efficient upsert.
  - Old rows are cheap to leave in place; a periodic cleanup can be added later.
*/

CREATE TABLE IF NOT EXISTS rate_limits (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  key          text        NOT NULL,
  action       text        NOT NULL,
  attempts     integer     NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now(),
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS rate_limits_key_action_idx
  ON rate_limits (key, action);

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No user-facing policies — this table is only accessible via the
-- service-role key from edge functions.
