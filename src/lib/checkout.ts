import { supabase } from './supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

export async function startCheckout(): Promise<string | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const origin = window.location.origin;
  const res = await fetch(`${SUPABASE_URL}/functions/v1/create-checkout`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({
      successUrl: `${origin}?upgrade=success`,
      cancelUrl: `${origin}?upgrade=cancel`,
    }),
  });

  const json = await res.json();
  if (!res.ok || !json.url) {
    const msg = json?.error;
    if (msg) throw new Error(msg);
    console.error('[checkout] server error:', json);
    throw new Error('Unable to start checkout. Please try again.');
  }
  window.location.href = json.url;
  return null;
}
