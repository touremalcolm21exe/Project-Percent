import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import {
  fetchBestSubscriptionForCustomer,
  normalizeStripeCustomerId,
  normalizeStripeSubscriptionId,
  resolveUserIdForStripeCustomer,
  SUBSCRIPTION_ENTITLEMENT_EVENTS,
  subscriptionGrantsPremium,
  writeBillingAuditLog,
} from '../_shared/entitlements.ts';

const stripeSecret = Deno.env.get('STRIPE_SECRET_KEY')!;
const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')!;
const stripe = new Stripe(stripeSecret, {
  appInfo: {
    name: 'Project Percent',
    version: '1.0.0',
  },
});

const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

/**
 * Endpoint: POST {SUPABASE_URL}/functions/v1/stripe-webhook
 * Auth: Stripe-Signature header (STRIPE_WEBHOOK_SECRET). No Supabase JWT (verify_jwt=false).
 */
Deno.serve(async (req) => {
  try {
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204 });
    }

    if (req.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      console.error('[stripe-webhook] rejected: missing stripe-signature header');
      return new Response('No signature found', { status: 400 });
    }

    const body = await req.text();

    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, stripeWebhookSecret);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[stripe-webhook] signature verification failed: ${message}`);
      return new Response(`Webhook signature verification failed: ${message}`, { status: 400 });
    }

    console.info(`[stripe-webhook] received event_id=${event.id} type=${event.type}`);

    EdgeRuntime.waitUntil(handleEvent(event));

    return Response.json({ received: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('[stripe-webhook] request handler error:', message);
    return Response.json({ error: message }, { status: 500 });
  }
});

async function handleEvent(event: Stripe.Event) {
  const stripeData = event?.data?.object;
  if (!stripeData || typeof stripeData !== 'object') {
    console.warn(`[stripe-webhook] skipped event_id=${event.id}: empty payload`);
    return;
  }

  if (!SUBSCRIPTION_ENTITLEMENT_EVENTS.has(event.type)) {
    console.info(`[stripe-webhook] ignored event_id=${event.id} type=${event.type}`);
    return;
  }

  const customerId = extractCustomerId(event, stripeData);
  if (!customerId) {
    console.warn(`[stripe-webhook] skipped event_id=${event.id} type=${event.type}: no customer id`);
    return;
  }

  console.info(`[stripe-webhook] processing event_id=${event.id} type=${event.type} customer=${customerId}`);

  if (event.type === 'checkout.session.completed') {
    const session = stripeData as Stripe.Checkout.Session;
    console.info(
      `[stripe-webhook] checkout.session.completed mode=${session.mode} payment_status=${session.payment_status}`,
    );

    if (session.mode !== 'subscription') {
      console.info(`[stripe-webhook] checkout.session.completed non-subscription mode=${session.mode}, skip entitlement`);
      return;
    }

    const subscriptionIdHint = normalizeStripeSubscriptionId(session.subscription);
    await runSubscriptionSync(customerId, {
      subscriptionIdHint,
      preferBestActive: false,
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }

  if (event.type === 'invoice.paid') {
    const invoice = stripeData as Stripe.Invoice;
    if (!invoice.subscription) {
      console.info(`[stripe-webhook] invoice.paid event_id=${event.id} has no subscription, skip entitlement`);
      return;
    }

    const subscriptionIdHint = normalizeStripeSubscriptionId(invoice.subscription);
    console.info(
      `[stripe-webhook] invoice.paid billing_reason=${invoice.billing_reason} subscription=${subscriptionIdHint}`,
    );

    await runSubscriptionSync(customerId, {
      subscriptionIdHint,
      preferBestActive: true,
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }

  if (event.type === 'customer.subscription.deleted') {
    const deleted = stripeData as Stripe.Subscription;
    console.info(
      `[stripe-webhook] customer.subscription.deleted subscription=${deleted.id} status=${deleted.status}`,
    );

    // Deleted subs cannot be retrieved; re-list remaining subs for this customer.
    await runSubscriptionSync(customerId, {
      preferBestActive: true,
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }

  if (event.type === 'customer.subscription.updated' || event.type === 'customer.subscription.created') {
    const sub = stripeData as Stripe.Subscription;
    console.info(
      `[stripe-webhook] ${event.type} subscription=${sub.id} status=${sub.status} cancel_at_period_end=${sub.cancel_at_period_end}`,
    );

    await runSubscriptionSync(customerId, {
      subscriptionIdHint: sub.id,
      preferBestActive: true,
      eventId: event.id,
      eventType: event.type,
    });
    return;
  }
}

function extractCustomerId(event: Stripe.Event, stripeData: Stripe.Event.Data.Object): string | null {
  if (event.type === 'checkout.session.completed') {
    return normalizeStripeCustomerId((stripeData as Stripe.Checkout.Session).customer);
  }

  if (event.type === 'invoice.paid') {
    return normalizeStripeCustomerId((stripeData as Stripe.Invoice).customer);
  }

  if (event.type.startsWith('customer.subscription.')) {
    return normalizeStripeCustomerId((stripeData as Stripe.Subscription).customer);
  }

  if ('customer' in stripeData) {
    const raw = (stripeData as { customer?: string | Stripe.Customer | null }).customer;
    return normalizeStripeCustomerId(raw);
  }

  return null;
}

async function runSubscriptionSync(
  customerId: string,
  opts: {
    subscriptionIdHint?: string | null;
    preferBestActive?: boolean;
    eventId: string;
    eventType: string;
  },
) {
  try {
    await syncCustomerFromStripe(customerId, opts);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `[stripe-webhook] subscription sync failed event_id=${opts.eventId} type=${opts.eventType} customer=${customerId}: ${message}`,
    );
    const userId = await resolveUserIdForStripeCustomer(supabase, stripe, customerId);
    await writeBillingAuditLog(supabase, 'webhook_error', userId, {
      stripe_event_id: opts.eventId,
      stripe_event_type: opts.eventType,
      stripe_customer_id: customerId,
      error: message,
    });
    throw error;
  }
}

async function syncCustomerFromStripe(
  customerId: string,
  opts: {
    subscriptionIdHint?: string | null;
    preferBestActive?: boolean;
    eventId: string;
    eventType: string;
  },
) {
  console.info(
    `[stripe-webhook] subscription sync start customer=${customerId} hint=${opts.subscriptionIdHint ?? 'none'} preferBestActive=${!!opts.preferBestActive}`,
  );

  let subscription: Stripe.Subscription | null = null;

  if (opts.preferBestActive || opts.eventType === 'customer.subscription.deleted') {
    subscription = await fetchBestSubscriptionForCustomer(stripe, customerId);
  } else if (opts.subscriptionIdHint) {
    try {
      subscription = await stripe.subscriptions.retrieve(opts.subscriptionIdHint, {
        expand: ['default_payment_method'],
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[stripe-webhook] retrieve subscription ${opts.subscriptionIdHint} failed (${message}), falling back to list`,
      );
      subscription = await fetchBestSubscriptionForCustomer(stripe, customerId);
    }
  } else {
    subscription = await fetchBestSubscriptionForCustomer(stripe, customerId);
  }

  if (!subscription) {
    console.info(`[stripe-webhook] no subscriptions in Stripe for customer=${customerId}`);
    await upsertStripeSubscriptionPlaceholder(customerId);
    await syncUserProfileEntitlement(customerId, null, opts);
    return;
  }

  await upsertStripeSubscriptionRow(customerId, subscription);
  await syncUserProfileEntitlement(customerId, subscription, opts);

  console.info(
    `[stripe-webhook] subscription sync complete customer=${customerId} subscription=${subscription.id} status=${subscription.status} grants_premium=${subscriptionGrantsPremium(subscription)}`,
  );
}

async function upsertStripeSubscriptionPlaceholder(customerId: string) {
  const { error } = await supabase.from('stripe_subscriptions').upsert(
    {
      customer_id: customerId,
      status: 'not_started',
      subscription_id: null,
      price_id: null,
    },
    { onConflict: 'customer_id' },
  );

  if (error) {
    console.error('[stripe-webhook] placeholder subscription upsert error:', error);
    throw new Error('Failed to update subscription placeholder in database');
  }
}

async function upsertStripeSubscriptionRow(customerId: string, subscription: Stripe.Subscription) {
  const { error: subError } = await supabase.from('stripe_subscriptions').upsert(
    {
      customer_id: customerId,
      subscription_id: subscription.id,
      price_id: subscription.items.data[0]?.price.id ?? null,
      current_period_start: subscription.current_period_start,
      current_period_end: subscription.current_period_end,
      cancel_at_period_end: subscription.cancel_at_period_end,
      ...(subscription.default_payment_method && typeof subscription.default_payment_method !== 'string'
        ? {
            payment_method_brand: subscription.default_payment_method.card?.brand ?? null,
            payment_method_last4: subscription.default_payment_method.card?.last4 ?? null,
          }
        : {}),
      status: subscription.status,
    },
    { onConflict: 'customer_id' },
  );

  if (subError) {
    console.error('[stripe-webhook] stripe_subscriptions upsert error:', subError);
    throw new Error('Failed to sync subscription in database');
  }
}

async function syncUserProfileEntitlement(
  customerId: string,
  subscription: Stripe.Subscription | null,
  opts: { eventId: string; eventType: string },
) {
  const userId = await resolveUserIdForStripeCustomer(supabase, stripe, customerId);
  if (!userId) {
    console.warn(
      `[stripe-webhook] profile sync skipped: no user for customer=${customerId} event=${opts.eventId}`,
    );
    return;
  }

  const isPremium = subscriptionGrantsPremium(subscription);
  const plan = isPremium ? 'premium' : 'free';
  const stripeSubscriptionId = isPremium && subscription ? subscription.id : null;

  const { data: current, error: readError } = await supabase
    .from('user_profiles')
    .select('plan, stripe_subscription_id, stripe_customer_id')
    .eq('id', userId)
    .maybeSingle();

  if (readError) {
    console.error('[stripe-webhook] profile read error:', readError);
    throw new Error('Failed to read user profile for entitlement sync');
  }

  const { error: updateError } = await supabase
    .from('user_profiles')
    .update({
      plan,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSubscriptionId,
    })
    .eq('id', userId);

  if (updateError) {
    console.error('[stripe-webhook] profile update error:', updateError);
    throw new Error('Failed to update user profile entitlement');
  }

  console.info(
    `[stripe-webhook] profile sync user=${userId} customer=${customerId} plan=${plan} subscription=${stripeSubscriptionId ?? 'none'} stripe_status=${subscription?.status ?? 'none'} previous_plan=${current?.plan ?? 'unknown'}`,
  );

  if (current?.plan !== plan) {
    const auditType = plan === 'premium' ? 'billing_upgraded' : 'billing_downgraded';
    await writeBillingAuditLog(supabase, auditType, userId, {
      stripe_event_id: opts.eventId,
      stripe_event_type: opts.eventType,
      stripe_customer_id: customerId,
      stripe_subscription_id: stripeSubscriptionId,
      stripe_subscription_status: subscription?.status ?? null,
      previous_plan: current?.plan ?? null,
    });
  }
}
