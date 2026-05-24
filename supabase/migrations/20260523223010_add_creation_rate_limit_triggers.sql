/*
  # Rate-limit project and milestone creation

  ## Summary
  Enforces a server-side sliding-window rate limit so a single user cannot
  create more than 30 projects or milestones (combined) per minute.
  The limit is applied via BEFORE INSERT triggers on both tables, using
  the existing `rate_limits` table as the backing store.

  ## How it works
  - A shared `check_creation_rate_limit(user_id, action)` function performs
    an atomic upsert into `rate_limits`:
      • If the current row is older than 60 seconds, the window resets.
      • Otherwise, the counter increments.
      • If the resulting count exceeds 30, the INSERT is aborted with a
        clear error message.
  - Two BEFORE INSERT triggers wire this up:
      • `enforce_project_creation_rate_limit`  on `projects`
      • `enforce_milestone_creation_rate_limit` on `milestones`

  ## Error message (surfaced directly to the client)
  "Too many requests. You can create at most 30 items per minute. Please wait a moment and try again."

  ## Security
  - SECURITY DEFINER so the function can write to `rate_limits` regardless
    of RLS (the table has no user-facing policies by design).
  - The rate-limit key is the authenticated user's UUID, so it is tied to
    the account, not the client IP or session.

  ## Notes
  - The 60-second window is a fixed tumbling window anchored to `window_start`;
    it resets fully once more than 60 s have elapsed since the window opened.
  - Soft-deleted rows still count — a DELETE-then-recreate pattern cannot be
    used to circumvent the limit.
*/

CREATE OR REPLACE FUNCTION check_creation_rate_limit(p_user_id uuid, p_action text)
RETURNS void AS $$
DECLARE
  v_attempts    integer;
  v_window_start timestamptz;
  v_limit       integer := 30;
  v_window_secs integer := 60;
BEGIN
  -- Atomic upsert: reset window if expired, otherwise increment
  INSERT INTO public.rate_limits (key, action, attempts, window_start)
  VALUES (p_user_id::text, p_action, 1, now())
  ON CONFLICT (key, action) DO UPDATE
    SET
      attempts     = CASE
                       WHEN now() - rate_limits.window_start > (v_window_secs || ' seconds')::interval
                       THEN 1
                       ELSE rate_limits.attempts + 1
                     END,
      window_start = CASE
                       WHEN now() - rate_limits.window_start > (v_window_secs || ' seconds')::interval
                       THEN now()
                       ELSE rate_limits.window_start
                     END
  RETURNING attempts, window_start
  INTO v_attempts, v_window_start;

  IF v_attempts > v_limit THEN
    RAISE EXCEPTION 'Too many requests. You can create at most % items per minute. Please wait a moment and try again.', v_limit
      USING ERRCODE = 'P0001';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger function for projects
CREATE OR REPLACE FUNCTION trg_project_creation_rate_limit()
RETURNS trigger AS $$
BEGIN
  PERFORM check_creation_rate_limit(NEW.user_id, 'create_item');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_project_creation_rate_limit ON projects;
CREATE TRIGGER enforce_project_creation_rate_limit
  BEFORE INSERT ON projects
  FOR EACH ROW EXECUTE FUNCTION trg_project_creation_rate_limit();

-- Trigger function for milestones (looks up the project owner)
CREATE OR REPLACE FUNCTION trg_milestone_creation_rate_limit()
RETURNS trigger AS $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT user_id INTO v_user_id
  FROM public.projects
  WHERE id = NEW.project_id;

  IF v_user_id IS NOT NULL THEN
    PERFORM check_creation_rate_limit(v_user_id, 'create_item');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_milestone_creation_rate_limit ON milestones;
CREATE TRIGGER enforce_milestone_creation_rate_limit
  BEFORE INSERT ON milestones
  FOR EACH ROW EXECUTE FUNCTION trg_milestone_creation_rate_limit();
