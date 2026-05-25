import Stripe from 'npm:stripe@17.7.0';
import { SupabaseClient } from 'npm:@supabase/supabase-js@2.49.1';

/** Stripe subscription statuses that grant premium access. */
export const PREMIUM_SUBSCRIPTION_STATUSES = new Set([
  'active',
  'trialing',
  'past_due',
]);

/** Events that drive user_profiles.plan sync. */
export const SUBSCRIPTION_ENTITLEMENT_EVENTS = new Set([
  'checkout.session.completed',
  'invoice.paid',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'customer.subscription.created',
]);

export function subscriptionGrantsPremium(subscription: Stripe.Subscription | null): boolean {
  return subscription !== null && PREMIUM_SUBSCRIPTION_STATUSES.has(subscription.status);
}

export function normalizeStripeCustomerId(
  customer: string | Stripe.Customer | Stripe.DeletedCustomer | null | undefined,
): string | null {
  if (!customer) return null;
  if (typeof customer === 'string') return customer;
  if ('deleted' in customer && customer.deleted) return null;
  return customer.id;
}

export function normalizeStripeSubscriptionId(
  subscription: string | Stripe.Subscription | null | undefined,
): string | null {
  if (!subscription) return null;
  return typeof subscription === 'string' ? subscription : subscription.id;
}

export async function resolveUserIdForStripeCustomer(
  supabase: SupabaseClient,
  stripe: Stripe,
  customerId: string,
): Promise<string | null> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();

  if (profile?.id) return profile.id;

  const { data: stripeCustomer } = await supabase
    .from('stripe_customers')
    .select('user_id')
    .eq('customer_id', customerId)
    .is('deleted_at', null)
    .maybeSingle();

  if (stripeCustomer?.user_id) return stripeCustomer.user_id;

  const customer = await stripe.customers.retrieve(customerId);
  if (customer.deleted) return null;

  return customer.metadata?.supabase_user_id ?? customer.metadata?.userId ?? null;
}

export async function fetchBestSubscriptionForCustomer(
  stripe: Stripe,
  customerId: string,
): Promise<Stripe.Subscription | null> {
  const subscriptions = await stripe.subscriptions.list({
    customer: customerId,
    limit: 20,
    status: 'all',
    expand: ['data.default_payment_method'],
  });

  if (subscriptions.data.length === 0) return null;

  const premiumSub = subscriptions.data.find((s) => PREMIUM_SUBSCRIPTION_STATUSES.has(s.status));
  return premiumSub ?? subscriptions.data[0];
}

export async function writeBillingAuditLog(
  supabase: SupabaseClient,
  event_type: 'billing_upgraded' | 'billing_downgraded' | 'webhook_error',
  actor_id: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from('audit_logs').insert({
    event_type,
    actor_id,
    actor_ip: null,
    metadata,
  });
  if (error) console.error('[stripe-webhook] audit insert error:', error);
}
