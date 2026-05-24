/*
  # Set up premium test account with known credentials and Stripe test IDs

  ## What this does
  1. Ensures premium@projectpercent.com exists with a known password
  2. Sets realistic Stripe test-mode IDs on the user profile
     (cus_test_* / sub_test_* format used by Stripe test mode)
  3. Sets plan = 'premium' via the same columns the webhook would write

  ## Test credentials
  - Email:    premium@projectpercent.com
  - Password: PremiumTest123!

  ## Stripe test IDs written
  These are realistic test-mode IDs. The webhook logic reads
  stripe_customer_id to match subscription events, so having
  these set allows cancel-subscription and billing-portal flows
  to work once a real Stripe secret key is configured.

  ## Notes
  - Password uses bcrypt cost 10 (same as Supabase's default)
  - This migration is idempotent: safe to run multiple times
*/

-- Ensure the user exists with known credentials
DO $$
DECLARE
  v_user_id uuid;
BEGIN
  SELECT id INTO v_user_id FROM auth.users WHERE email = 'premium@projectpercent.com';

  IF v_user_id IS NULL THEN
    -- Create fresh
    INSERT INTO auth.users (
      id,
      instance_id,
      email,
      encrypted_password,
      email_confirmed_at,
      created_at,
      updated_at,
      raw_app_meta_data,
      raw_user_meta_data,
      aud,
      role,
      confirmation_token,
      recovery_token,
      email_change_token_new,
      email_change
    ) VALUES (
      gen_random_uuid(),
      '00000000-0000-0000-0000-000000000000',
      'premium@projectpercent.com',
      crypt('PremiumTest123!', gen_salt('bf', 10)),
      now(),
      now(),
      now(),
      '{"provider":"email","providers":["email"]}',
      '{}',
      'authenticated',
      'authenticated',
      '', '', '', ''
    )
    RETURNING id INTO v_user_id;

    -- Create identity row so Supabase auth recognises the email provider
    INSERT INTO auth.identities (
      id,
      user_id,
      provider_id,
      identity_data,
      provider,
      created_at,
      updated_at,
      last_sign_in_at
    ) VALUES (
      gen_random_uuid(),
      v_user_id,
      'premium@projectpercent.com',
      jsonb_build_object('sub', v_user_id, 'email', 'premium@projectpercent.com'),
      'email',
      now(),
      now(),
      now()
    );
  ELSE
    -- Reset password to known value
    UPDATE auth.users
    SET encrypted_password = crypt('PremiumTest123!', gen_salt('bf', 10)),
        email_confirmed_at  = COALESCE(email_confirmed_at, now()),
        updated_at          = now()
    WHERE id = v_user_id;
  END IF;

  -- Ensure user_profile row exists with premium plan + Stripe test IDs
  INSERT INTO public.user_profiles (id, plan, stripe_customer_id, stripe_subscription_id)
  VALUES (
    v_user_id,
    'premium',
    'cus_test_premiumaccount0001',
    'sub_test_premiumaccount0001'
  )
  ON CONFLICT (id) DO UPDATE
    SET plan                   = 'premium',
        stripe_customer_id     = COALESCE(user_profiles.stripe_customer_id, 'cus_test_premiumaccount0001'),
        stripe_subscription_id = COALESCE(user_profiles.stripe_subscription_id, 'sub_test_premiumaccount0001');
END $$;
