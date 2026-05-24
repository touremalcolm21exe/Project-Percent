import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

// Closed set of event types the client is permitted to log.
const ALLOWED_CLIENT_EVENTS = new Set([
  "login_success",
  "login_failure",
  "signup_success",
  "signup_failure",
  "password_reset_requested",
  "password_reset_success",
  "password_reset_failure",
  "project_deleted",
  "milestone_deleted",
]);

// These events have no session (the auth attempt just failed), so they are
// accepted without a valid JWT. actor_id is always set to null for these rows.
const UNAUTHENTICATED_EVENTS = new Set([
  "login_failure",
  "signup_failure",
]);

function getClientIp(req: Request): string | null {
  return (
    req.headers.get("cf-connecting-ip") ??
    req.headers.get("x-real-ip") ??
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    null
  );
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    // Parse body first so we can check event_type before deciding auth path.
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: "Invalid JSON" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (
      typeof body !== "object" || body === null ||
      typeof (body as Record<string, unknown>).event_type !== "string"
    ) {
      return new Response(JSON.stringify({ error: "Missing event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { event_type, metadata = {} } = body as {
      event_type: string;
      metadata?: Record<string, unknown>;
    };

    if (!ALLOWED_CLIENT_EVENTS.has(event_type)) {
      return new Response(JSON.stringify({ error: "Invalid event_type" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine actor_id from the verified JWT, unless the event is one of the
    // known unauthenticated failure types (no session exists for those).
    let actor_id: string | null = null;

    if (!UNAUTHENTICATED_EVENTS.has(event_type)) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const userClient = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } },
      );
      const { data: { user }, error: userError } = await userClient.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      actor_id = user.id;
    }

    // Strip any keys that could shadow system fields.
    const safeMetadata: Record<string, unknown> = {};
    if (typeof metadata === "object" && metadata !== null) {
      for (const [k, v] of Object.entries(metadata)) {
        if (!["actor_id", "actor_ip", "event_type", "id", "created_at"].includes(k)) {
          safeMetadata[k] = v;
        }
      }
    }

    const actor_ip = getClientIp(req);

    // Service role bypasses RLS — the anon key has no INSERT policy.
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { error: insertError } = await supabase.from("audit_logs").insert({
      event_type,
      actor_id,
      actor_ip,
      metadata: safeMetadata,
    });

    if (insertError) {
      console.error("[audit-log] insert error:", insertError);
      return new Response(JSON.stringify({ error: "Internal server error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[audit-log] unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
