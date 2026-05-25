/**
 * One-time backfill: sync user_profiles.plan from Stripe for users who already paid.
 *
 * Usage (dry run — no writes):
 *   curl -X POST "$SUPABASE_URL/functions/v1/backfill-premium-entitlements" \
 *     -H "Authorization: Bearer $BACKFILL_PREMIUM_SECRET" \
 *     -H "Content-Type: application/json" \
 *     -d '{"dry_run": true}'
 *
 * Apply updates:
 *   curl -X POST ... -d '{"dry_run": false}'
 *
 * Requires Supabase secret: BACKFILL_PREMIUM_SECRET (long random string).
 * Uses STRIPE_SECRET_KEY and SUPABASE_SERVICE_ROLE_KEY like other edge functions.
 */
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'npm:stripe@17.7.0';
import { createClient } from 'npm:@supabase/supabase-js@2.49.1';
import { subscriptionGrantsPremium } from '../_shared/entitlements.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization, Content-Type',
};

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  appInfo: { name: 'Project Percent Backfill', version: '1.0.0' },
});

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

interface BackfillBody {
  dry_run?: boolean;
}

interface BackfillResult {
  user_id: string;
  stripe_customer_id: string;
  previous_plan: string;
  new_plan: string;
  stripe_subscription_id: string | null;
  stripe_status: string | null;
  action: 'upgraded' | 'downgraded' | 'unchanged' | 'skipped' | 'error';
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  const secret = Deno.env.get('BACKFILL_PREMIUM_SECRET');
  if (!secret) {
    return new Response(JSON.stringify({ error: 'BACKFILL_PREMIUM_SECRET is not configured' }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const auth = req.headers.get('Authorization') ?? '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  if (token !== secret) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  let body: BackfillBody = { dry_run: true };
  try {
    const text = await req.text();
    if (text) body = JSON.parse(text) as BackfillBody;
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const dryRun = body.dry_run !== false;
  console.info(`[backfill-premium] starting dry_run=${dryRun}`);

  const { data: profiles, error: listError } = await supabase
    .from('user_profiles')
    .select('id, plan, stripe_customer_id, stripe_subscription_id');

  if (listError) {
    console.error('[backfill-premium] list profiles error:', listError);
    return new Response(JSON.stringify({ error: listError.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  const { data: legacyCustomers } = await supabase
    .from('stripe_customers')
    .select('user_id, customer_id')
    .is('deleted_at', null);

  const worklist = new Map<string, { id: string; plan: string; stripe_subscription_id: string | null }>();

  for (const profile of profiles ?? []) {
    if (profile.stripe_customer_id) {
      worklist.set(profile.stripe_customer_id, {
        id: profile.id,
        plan: profile.plan,
        stripe_subscription_id: profile.stripe_subscription_id,
      });
    }
  }

  for (const row of legacyCustomers ?? []) {
    if (!worklist.has(row.customer_id)) {
      const profile = profiles?.find((p) => p.id === row.user_id);
      worklist.set(row.customer_id, {
        id: row.user_id,
        plan: profile?.plan ?? 'free',
        stripe_subscription_id: profile?.stripe_subscription_id ?? null,
      });
    }
  }

  const results: BackfillResult[] = [];

  for (const [customerId, profile] of worklist.entries()) {
    try {
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        limit: 1,
        status: 'all',
      });

      const subscription = subscriptions.data[0] ?? null;
      const isPremium = subscriptionGrantsPremium(subscription);
      const newPlan = isPremium ? 'premium' : 'free';
      const newSubId = isPremium && subscription ? subscription.id : null;
      const previousPlan = profile.plan;

      let action: BackfillResult['action'] = 'unchanged';
      if (previousPlan !== newPlan || profile.stripe_subscription_id !== newSubId) {
        action = newPlan === 'premium' ? 'upgraded' : 'downgraded';
      }

      if (!dryRun && action !== 'unchanged') {
        const { error: updateError } = await supabase
          .from('user_profiles')
          .update({
            plan: newPlan,
            stripe_customer_id: customerId,
            stripe_subscription_id: newSubId,
          })
          .eq('id', profile.id);

        if (updateError) throw updateError;

        const auditType = newPlan === 'premium' ? 'billing_upgraded' : 'billing_downgraded';
        await supabase.from('audit_logs').insert({
          event_type: auditType,
          actor_id: profile.id,
          actor_ip: null,
          metadata: {
            source: 'backfill_premium_entitlements',
            stripe_customer_id: customerId,
            stripe_subscription_id: newSubId,
            stripe_subscription_status: subscription?.status ?? null,
            previous_plan: previousPlan,
            dry_run: false,
          },
        });
      }

      if (dryRun && action !== 'unchanged') {
        console.info(
          `[backfill-premium] would ${action} user=${profile.id} customer=${customerId} ${previousPlan} -> ${newPlan}`,
        );
      }

      results.push({
        user_id: profile.id,
        stripe_customer_id: customerId,
        previous_plan: previousPlan,
        new_plan: newPlan,
        stripe_subscription_id: newSubId,
        stripe_status: subscription?.status ?? null,
        action,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(`[backfill-premium] error user=${profile.id} customer=${customerId}: ${message}`);
      results.push({
        user_id: profile.id,
        stripe_customer_id: customerId,
        previous_plan: profile.plan,
        new_plan: profile.plan,
        stripe_subscription_id: profile.stripe_subscription_id,
        stripe_status: null,
        action: 'error',
        error: message,
      });
    }
  }

  const summary = {
    dry_run: dryRun,
    scanned: results.length,
    would_upgrade: results.filter((r) => r.action === 'upgraded').length,
    would_downgrade: results.filter((r) => r.action === 'downgraded').length,
    unchanged: results.filter((r) => r.action === 'unchanged').length,
    errors: results.filter((r) => r.action === 'error').length,
  };

  console.info(`[backfill-premium] complete ${JSON.stringify(summary)}`);

  return new Response(JSON.stringify({ summary, results }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
