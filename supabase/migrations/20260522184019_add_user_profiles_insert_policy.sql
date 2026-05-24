/*
  # Add INSERT policy to user_profiles

  ## Summary
  The user_profiles table was missing an INSERT policy for authenticated users.
  Without it, a user could not create their own profile row via the client SDK
  (only the service-role key, used by edge functions, could do so).

  ## Changes
  - Adds "Users can insert own profile" INSERT policy on user_profiles,
    scoped to the authenticated role with WITH CHECK (auth.uid() = id).

  ## Notes
  - All other operations (SELECT, UPDATE) were already correctly restricted to
    the row owner. This closes the last gap.
  - Service-role writes (stripe-webhook) bypass RLS entirely and are unaffected.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'user_profiles'
      AND cmd = 'INSERT'
  ) THEN
    CREATE POLICY "Users can insert own profile"
      ON public.user_profiles
      FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = id);
  END IF;
END $$;
