/*
  # Audit alert trigger functions

  ## Summary
  Three Postgres AFTER INSERT triggers on audit_logs automatically raise alerts
  when anomalous patterns are detected. All logic runs inside the database so it
  cannot be bypassed from the application layer.

  ## Alert rules

  1. **repeated_login_failures**
     Fires when a single IP address accumulates 5 or more `login_failure` events
     within a 10-minute sliding window. Inserts one alert per triggering event
     once the threshold is crossed, with the IP and failure count in `details`.

  2. **rate_limit_spike**
     Fires when a single user accumulates 3 or more `checkout_rate_limited` events
     within a 1-hour sliding window. Captures user_id and count in `details`.

  3. **webhook_error_alert**
     Fires immediately on every `webhook_error` event — these are always
     operator-actionable and should never be silent. Copies the full metadata
     payload into `details` for investigation.

  ## Notes
  - All functions use SECURITY DEFINER so they can insert into audit_alerts
    regardless of the calling role.
  - Functions are deliberately narrow: each handles exactly one alert type.
  - No deduplication window is applied; operators must resolve/dismiss alerts
    via the resolved_at column.
*/

-- ── 1. Repeated login failures ────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION raise_repeated_login_failure_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  failure_count integer;
  window_start  timestamptz := now() - interval '10 minutes';
BEGIN
  -- Only act on login_failure events with an IP address.
  IF NEW.event_type <> 'login_failure' OR NEW.actor_ip IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO failure_count
  FROM public.audit_logs
  WHERE event_type = 'login_failure'
    AND actor_ip   = NEW.actor_ip
    AND created_at >= window_start;

  -- Alert on the 5th failure and every subsequent one from the same IP.
  IF failure_count >= 5 THEN
    INSERT INTO public.audit_alerts (alert_type, details)
    VALUES (
      'repeated_login_failures',
      jsonb_build_object(
        'actor_ip',      NEW.actor_ip,
        'failure_count', failure_count,
        'window',        '10 minutes',
        'triggering_log_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_repeated_login_failure_alert ON public.audit_logs;
CREATE TRIGGER trg_repeated_login_failure_alert
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION raise_repeated_login_failure_alert();

-- ── 2. Rate-limit spike ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION raise_rate_limit_spike_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  hit_count    integer;
  window_start timestamptz := now() - interval '1 hour';
BEGIN
  IF NEW.event_type <> 'checkout_rate_limited' OR NEW.actor_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO hit_count
  FROM public.audit_logs
  WHERE event_type = 'checkout_rate_limited'
    AND actor_id   = NEW.actor_id
    AND created_at >= window_start;

  -- Alert on the 3rd hit and every subsequent one from the same user.
  IF hit_count >= 3 THEN
    INSERT INTO public.audit_alerts (alert_type, details)
    VALUES (
      'rate_limit_spike',
      jsonb_build_object(
        'actor_id',          NEW.actor_id,
        'hit_count',         hit_count,
        'window',            '1 hour',
        'triggering_log_id', NEW.id
      )
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_rate_limit_spike_alert ON public.audit_logs;
CREATE TRIGGER trg_rate_limit_spike_alert
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION raise_rate_limit_spike_alert();

-- ── 3. Webhook error alert ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION raise_webhook_error_alert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.event_type <> 'webhook_error' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.audit_alerts (alert_type, details)
  VALUES (
    'webhook_error',
    jsonb_build_object(
      'triggering_log_id', NEW.id,
      'metadata',          NEW.metadata
    )
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_webhook_error_alert ON public.audit_logs;
CREATE TRIGGER trg_webhook_error_alert
  AFTER INSERT ON public.audit_logs
  FOR EACH ROW
  EXECUTE FUNCTION raise_webhook_error_alert();
