import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // PKCE prevents auth-code interception attacks on redirect flows.
    flowType: 'pkce',
    // Always persist sessions in localStorage so a page refresh keeps the user
    // logged in, but only within this app's namespaced key.
    persistSession: true,
    storageKey: 'pp_session',
    // Automatically refresh the access token before it expires.
    autoRefreshToken: true,
    // Parse tokens from the URL on load (needed for magic links / OAuth / password reset).
    detectSessionInUrl: true,
  },
});
