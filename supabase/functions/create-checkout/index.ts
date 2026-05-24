import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// 5 checkout attempts per user per hour.
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000;

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

async function writeAuditLog(
  supabase: ReturnType<typeof createClient>,
  event_type: string,
  actor_id: string | null,
  actor_ip: string | null,
  metadata: Record<string, unknown>,
): Promise<void> {
  const { error } = await supabase.from("audit_logs").insert({
    event_type,
    actor_id,
    actor_ip,
    metadata,
  });
  if (error) console.error("[audit] insert error:", error);
}

/**
 * Checks and increments the rate-limit counter for (key, action).
 * Returns { allowed: true } or { allowed: false, retryAfterSeconds }.
 */
async function checkRateLimit(
  supabase: ReturnType<typeof createClient>,
  key: string,
  action: string,
): Promise<{ allowed: boolean; retryAfterSeconds?: number }> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS);

  const { data: existing } = await supabase
    .from("rate_limits")
    .select("id, attempts, window_start")
    .eq("key", key)
    .eq("action", action)
    .maybeSingle();

  if (!existing) {
    await supabase.from("rate_limits").insert({ key, action, attempts: 1, window_start: now.toISOString() });
    return { allowed: true };
  }

  const existingWindowStart = new Date(existing.window_start);

  if (existingWindowStart < windowStart) {
    await supabase
      .from("rate_limits")
      .update({ attempts: 1, window_start: now.toISOString() })
      .eq("id", existing.id);
    return { allowed: true };
  }

  if (existing.attempts >= RATE_LIMIT_MAX) {
    const windowEndsAt = new Date(existingWindowStart.getTime() + RATE_LIMIT_WINDOW_MS);
    const retryAfterSeconds = Math.ceil((windowEndsAt.getTime() - now.getTime()) / 1000);
    return { allowed: false, retryAfterSeconds };
  }

  await supabase
    .from("rate_limits")
    .update({ attempts: existing.attempts + 1 })
    .eq("id", existing.id);

  return { allowed: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const actor_ip = getClientIp(req);

    // ── Rate limit check ──────────────────────────────────────────────────
    const rl = await checkRateLimit(supabase, user.id, "create_checkout");
    if (!rl.allowed) {
      const minutes = Math.ceil((rl.retryAfterSeconds ?? 3600) / 60);

      // Log the rate-limit hit — triggers raise_rate_limit_spike_alert if ≥3/hour.
      await writeAuditLog(supabase, "checkout_rate_limited", user.id, actor_ip, {
        retry_after_seconds: rl.retryAfterSeconds,
      });

      return new Response(
        JSON.stringify({
          error: `Too many checkout attempts. Please wait ${minutes} minute${minutes !== 1 ? "s" : ""} before trying again.`,
          retryAfterSeconds: rl.retryAfterSeconds,
        }),
        {
          status: 429,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
            "Retry-After": String(rl.retryAfterSeconds ?? 3600),
          },
        }
      );
    }

    const priceId = Deno.env.get("STRIPE_PRICE_ID");
    if (!priceId) {
      console.error("[checkout] STRIPE_PRICE_ID secret not configured");
      return new Response(JSON.stringify({ error: "Checkout is not configured. Please contact support." }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    if (
      typeof body !== "object" || body === null ||
      typeof body.successUrl !== "string" ||
      typeof body.cancelUrl !== "string"
    ) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { successUrl, cancelUrl } = body as {
      successUrl: string;
      cancelUrl: string;
    };

    if (successUrl.length > 2000 || cancelUrl.length > 2000) {
      return new Response(JSON.stringify({ error: "Invalid field values" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate redirect URLs are well-formed HTTPS URLs.
    // Stripe additionally enforces that redirect domains are registered in the
    // Stripe dashboard, so a secondary origin allowlist here is redundant and
    // breaks the app whenever the deployment URL changes.
    let successParsed: URL;
    let cancelParsed: URL;
    try {
      successParsed = new URL(successUrl);
      cancelParsed  = new URL(cancelUrl);
    } catch {
      return new Response(JSON.stringify({ error: "Invalid redirect URL" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (successParsed.protocol !== "https:" || cancelParsed.protocol !== "https:") {
      return new Response(JSON.stringify({ error: "Redirect URLs must use HTTPS" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, {
      apiVersion: "2024-04-10",
    });

    // Get or create Stripe customer
    const { data: profile } = await supabase
      .from("user_profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    let customerId = profile?.stripe_customer_id;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
      await supabase
        .from("user_profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { supabase_user_id: user.id },
    });

    // Log the checkout session creation.
    await writeAuditLog(supabase, "checkout_started", user.id, actor_ip, {
      stripe_session_id: session.id,
      stripe_customer_id: customerId,
    });

    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
