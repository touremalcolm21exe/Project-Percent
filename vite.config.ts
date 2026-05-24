import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const commonHeaders = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(self "https://js.stripe.com")',
};

// Dev CSP: 'unsafe-inline' + 'unsafe-eval' are required by Vite HMR and
// @vitejs/plugin-react (the preamble is an inline script).
// upgrade-insecure-requests is omitted (localhost is http).
// Production uses public/_headers which has a tighter policy.
const devCsp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: https://images.pexels.com https://bolt.new",
  "connect-src 'self' https://ofvwzcdnhtnvncuxojwc.supabase.co wss://ofvwzcdnhtnvncuxojwc.supabase.co https://api.stripe.com ws://localhost:* http://localhost:*",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "font-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  server: {
    headers: { ...commonHeaders, 'Content-Security-Policy': devCsp },
  },
  // preview serves the production build; public/_headers already sets the
  // production CSP via Netlify/Cloudflare response headers.
  preview: {
    headers: commonHeaders,
  },
});
