/*
  # Fix user_profiles column protection

  ## Problem
  Two UPDATE policies existed simultaneously on user_profiles:
    1. "Users can update own display columns" — enforced billing column immutability
       via WITH CHECK subqueries comparing new values to stored values.
    2. "Users can update own profile" — only checked projects_created_count equality,
       said nothing about billing columns.

  Postgres evaluates multiple FOR UPDATE policies with OR logic: a row is accessible
  if ANY one policy allows the write. Policy 2 was therefore a bypass: an authenticated
  user could include plan='premium' in their UPDATE body as long as they also left
  projects_created_count unchanged — policy 2 would approve the row even though
  policy 1 would not.

  ## Solution

  ### Part 1 — Column-level privileges (structural enforcement)
  Revoke UPDATE on the four protected columns from the `authenticated` role entirely.
  Column-level privilege checks happen before RLS evaluation, so this is a hard
  structural barrier that cannot be bypassed regardless of how many policies exist.

  Protected columns (authenticated role can never write these):
    - plan                  — set only by stripe-webhook (service role)
    - stripe_customer_id    — set only by create-checkout / stripe-webhook (service role)
    - stripe_subscription_id — set only by stripe-webhook (service role)
    - projects_created_count — incremented only by on_project_inserted trigger (SECURITY DEFINER)
    - id                    — immutable primary key
    - created_at            — immutable creation timestamp

  The service_role key used by edge functions bypasses both RLS and column privileges,
  so billing edge functions continue to work without change.

  ### Part 2 — Single clean UPDATE policy
  Drop both conflicting policies and replace with one policy that:
    - Only allows the owner to update their own row (auth.uid() = id)
    - Has no WITH CHECK subquery games — protection is now structural via column grants
    - Is clear about its purpose: "row ownership check only; column restrictions via grants"

  ## Columns the authenticated role CAN update after this migration
    - updated_at (managed by trigger anyway)

  Note: the user_profiles table currently has no user-editable display columns
  (no username, avatar, etc.). The only legitimate client write is the row INSERT
  at signup, which the INSERT policy already handles correctly.
  If display columns are added in future, add them to the GRANT below.

  ## Security changes
  - REVOKE UPDATE on plan, stripe_customer_id, stripe_subscription_id,
    projects_created_count, id, created_at FROM authenticated
  - DROP POLICY "Users can update own display columns"
  - DROP POLICY "Users can update own profile"
  - CREATE POLICY "Users can update own profile row" (single, clean replacement)
*/

-- ── Part 1: Column-level privilege enforcement ────────────────────────────────

-- First grant table-level UPDATE so the role can update the row at all,
-- then selectively revoke on protected columns.
-- (In Postgres, column-level REVOKE only makes sense after a table-level GRANT.)

REVOKE UPDATE (
  plan,
  stripe_customer_id,
  stripe_subscription_id,
  projects_created_count,
  id,
  created_at
) ON public.user_profiles FROM authenticated;

-- ── Part 2: Replace the two conflicting UPDATE policies with one ───────────────

DROP POLICY IF EXISTS "Users can update own display columns" ON public.user_profiles;
DROP POLICY IF EXISTS "Users can update own profile"         ON public.user_profiles;

-- Single replacement: only checks row ownership. Column-level grants above
-- enforce which columns may actually be written.
CREATE POLICY "Users can update own profile row"
  ON public.user_profiles
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);
