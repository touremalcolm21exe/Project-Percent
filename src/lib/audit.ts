import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

// Events that have no session (the auth attempt just failed). The edge
// function accepts these without a JWT and sets actor_id = null.
const UNAUTHENTICATED_EVENTS = new Set([
  'login_failure',
  'signup_failure',
]);

/**
 * Fire-and-forget audit log write via the audit-log edge function.
 * Never throws or surfaces errors to the caller — audit logging must
 * never block or break user-facing flows.
 */
export async function auditLog(
  event_type: string,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };

    if (!UNAUTHENTICATED_EVENTS.has(event_type)) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    await fetch(`${SUPABASE_URL}/functions/v1/audit-log`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ event_type, metadata }),
    });
  } catch (err) {
    console.error('[audit] failed to write log:', err);
  }
}
