/*
  # Add Stripe fields to user_profiles

  ## Summary
  Adds Stripe-specific columns to the user_profiles table to support subscription management.

  ## Changes to user_profiles
  - `stripe_customer_id` (text, nullable) — Stripe Customer ID, set when checkout is initiated
  - `stripe_subscription_id` (text, nullable) — Active Stripe Subscription ID, set on successful payment, cleared on cancellation

  ## Notes
  - No data is destroyed; columns are nullable and added safely with IF NOT EXISTS checks
  - Existing RLS policies remain in effect
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_customer_id text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'user_profiles' AND column_name = 'stripe_subscription_id'
  ) THEN
    ALTER TABLE user_profiles ADD COLUMN stripe_subscription_id text;
  END IF;
END $$;
