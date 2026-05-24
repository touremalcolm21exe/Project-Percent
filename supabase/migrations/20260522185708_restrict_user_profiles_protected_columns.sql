/*
  # Restrict user_profiles protected columns from client writes

  ## Problem
  The existing UPDATE policy only checks row ownership (auth.uid() = id).
  It does not prevent a client from setting `plan`, `stripe_customer_id`,
  or `stripe_subscription_id` directly — columns that must only be written
  by the service-role (stripe-webhook edge function).

  The existing INSERT policy allows a client to supply any value for those
  same columns at row creation time.

  ## Changes

  ### Policies dropped
  - "Users can update own profile"  — replaced with column-restricted version
  - "Users can insert own profile"  — replaced with column-restricted version

  ### Policies added
  - "Users can update own display columns"
      UPDATE allowed only when the incoming row leaves plan,
      stripe_customer_id, and stripe_subscription_id unchanged from their
      current DB values. Uses both USING and WITH CHECK scoped to auth.uid().

  - "Users can insert own profile row"
      INSERT allowed only when plan = 'free' (the column default) and both
      Stripe columns are NULL. Prevents clients from bootstrapping a premium
      profile at signup.

  ## Security notes
  - Service-role writes (the stripe-webhook edge function) bypass RLS entirely
    and are unaffected by these policies.
  - The SELECT policy is unchanged; users can still read their full row.
  - No DELETE policy exists intentionally — profiles must not be deleted from
    the client.
*/

-- Drop the policies being replaced
DROP POLICY IF EXISTS "Users can update own profile" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can insert own profile" ON public.user_profiles;

-- UPDATE: row must belong to the caller AND the three protected columns must
-- not be changed by the incoming write.
CREATE POLICY "Users can update own display columns"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (
    auth.uid() = id
    AND plan             = (SELECT plan             FROM public.user_profiles WHERE id = auth.uid())
    AND stripe_customer_id IS NOT DISTINCT FROM (SELECT stripe_customer_id FROM public.user_profiles WHERE id = auth.uid())
    AND stripe_subscription_id IS NOT DISTINCT FROM (SELECT stripe_subscription_id FROM public.user_profiles WHERE id = auth.uid())
  );

-- INSERT: only allowed when billing columns are at their safe defaults.
CREATE POLICY "Users can insert own profile row"
  ON public.user_profiles
  FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND plan = 'free'
    AND stripe_customer_id IS NULL
    AND stripe_subscription_id IS NULL
  );
