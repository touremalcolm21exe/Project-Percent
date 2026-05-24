import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { auditLog } from '../lib/audit';
import { useRateLimit } from '../lib/useRateLimit';
import { checkPassword } from '../lib/passwordStrength';
import { AlertCircle, CheckCircle2, ArrowLeft, Eye, EyeOff, Clock, ShieldCheck, Mail, RefreshCw } from 'lucide-react';

export type AuthView = 'login' | 'signup' | 'forgot-password' | 'reset-password' | 'verify-email';

interface AuthPageProps {
  initialView?: AuthView;
  onBack?: () => void;
  /** Email to pre-populate the verify-email view (set after successful signup) */
  pendingEmail?: string;
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5 mb-8">
      <img src="/ProgressPercentLogo copy copy.png" alt="Project Percent" className="w-8 h-8 object-contain" />
      <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg tracking-tight">Project Percent</span>
    </div>
  );
}

interface FieldProps {
  label: string;
  type: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
  showToggle?: boolean;
  disabled?: boolean;
}

function Field({ label, type: baseType, value, onChange, placeholder, autoFocus, showToggle, disabled }: FieldProps) {
  const [show, setShow] = useState(false);
  const type = showToggle ? (show ? 'text' : 'password') : baseType;

  return (
    <div>
      {label && <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>}
      <div className="relative">
        <input
          type={type}
          required
          autoFocus={autoFocus}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm pr-10 disabled:bg-gray-50 dark:disabled:bg-gray-900 disabled:text-slate-400 disabled:cursor-not-allowed"
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setShow((s) => !s)}
            disabled={disabled}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors disabled:opacity-40"
          >
            {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Password strength meter ───────────────────────────────────────────────────

const BAR_COLORS = [
  'bg-red-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-emerald-400',
  'bg-emerald-500',
];
const LABEL_COLORS = [
  'text-red-500',
  'text-orange-500',
  'text-yellow-500',
  'text-emerald-500',
  'text-emerald-500',
];

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const result = checkPassword(password);

  return (
    <div className="space-y-2 mt-2">
      {/* Segmented bar */}
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
              i < result.score ? BAR_COLORS[result.score] : 'bg-gray-200 dark:bg-gray-700'
            }`}
          />
        ))}
      </div>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-medium ${LABEL_COLORS[result.score]}`}>{result.label}</span>
        {result.errors.length > 0 && (
          <ul className="text-xs text-red-600 dark:text-red-400 text-right space-y-0.5">
            {result.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
      {result.valid && result.suggestions.length > 0 && (
        <p className="text-xs text-slate-400 dark:text-slate-500">{result.suggestions[0]}</p>
      )}
    </div>
  );
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
      <p className="text-red-700 dark:text-red-300 text-sm">{message}</p>
    </div>
  );
}

function RateLimitBanner({ secondsLeft }: { secondsLeft: number }) {
  return (
    <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
      <Clock className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
      <p className="text-amber-800 dark:text-amber-300 text-sm">
        Too many attempts. Please wait{' '}
        <span className="font-semibold tabular-nums">{secondsLeft}s</span> before trying again.
      </p>
    </div>
  );
}

// ─── Login ───────────────────────────────────────────────────────────────────

interface LoginProps {
  onSwitchSignup: () => void;
  onForgotPassword: () => void;
  onBack?: () => void;
}

function LoginView({ onSwitchSignup, onForgotPassword, onBack }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rl = useRateLimit({ maxFailures: 5, windowMs: 10 * 60 * 1000, lockoutMs: 2 * 60 * 1000 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!rl.canSubmit()) return;
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      rl.recordFailure();
      setError('Incorrect email or password.');
      auditLog('login_failure', { reason: 'invalid_credentials' });
    } else {
      auditLog('login_success', {});
    }
    setLoading(false);
  }

  const blocked = loading || rl.isLocked;

  return (
    <div>
      <Logo />
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm mb-5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </button>
      )}
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Welcome back</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Sign in to continue to your projects</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus disabled={rl.isLocked} />
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Password</label>
            <button type="button" onClick={onForgotPassword} className="text-xs text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors">
              Forgot password?
            </button>
          </div>
          <Field label="" type="password" value={password} onChange={setPassword} placeholder="••••••••" showToggle disabled={rl.isLocked} />
        </div>
        {rl.isLocked && <RateLimitBanner secondsLeft={rl.secondsLeft} />}
        {!rl.isLocked && error && <ErrorBanner message={error} />}
        <button
          type="submit"
          disabled={blocked}
          className="w-full bg-brand-gradient disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-opacity hover:opacity-90 text-sm mt-1"
        >
          {loading ? 'Signing in...' : rl.isLocked ? `Locked (${rl.secondsLeft}s)` : 'Sign in'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Don't have an account?{' '}
        <button onClick={onSwitchSignup} className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors">
          Sign up
        </button>
      </p>
    </div>
  );
}

// ─── Signup ──────────────────────────────────────────────────────────────────

interface SignupProps {
  onSwitchLogin: () => void;
  onBack?: () => void;
  onVerify: (email: string) => void;
}

function SignupView({ onSwitchLogin, onBack, onVerify }: SignupProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const rl = useRateLimit({ maxFailures: 3, windowMs: 10 * 60 * 1000, lockoutMs: 5 * 60 * 1000 });

  const pwCheck = checkPassword(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (!pwCheck.valid) {
      setError(pwCheck.errors[0] ?? 'Password does not meet requirements.');
      return;
    }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    if (!rl.canSubmit()) return;

    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}?confirmed=1`,
      },
    });
    if (error) {
      rl.recordFailure();
      console.error('[signup] auth error:', error);
      setError('Could not create account. Please check your details and try again.');
      auditLog('signup_failure', { reason: 'auth_error' });
    } else {
      auditLog('signup_success', {});
      onVerify(email);
    }
    setLoading(false);
  }

  const blocked = loading || rl.isLocked;

  return (
    <div>
      <Logo />
      {onBack && (
        <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm mb-5 transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to home
        </button>
      )}
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Create your account</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Start tracking your project progress today</p>

      {/* Password policy hint */}
      <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 mb-4">
        <ShieldCheck className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Passwords must be <strong className="text-slate-700 dark:text-slate-300">12+ characters</strong>. Passphrases like <em>"correct-horse-battery"</em> are encouraged.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus disabled={rl.isLocked} />
        <div>
          <Field label="Password" type="password" value={password} onChange={setPassword} placeholder="12+ characters or a passphrase" showToggle disabled={rl.isLocked} />
          <PasswordStrengthMeter password={password} />
        </div>
        <Field label="Confirm password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter your password" showToggle disabled={rl.isLocked} />
        {rl.isLocked && <RateLimitBanner secondsLeft={rl.secondsLeft} />}
        {!rl.isLocked && error && <ErrorBanner message={error} />}
        <button
          type="submit"
          disabled={blocked || (password.length > 0 && !pwCheck.valid)}
          className="w-full bg-brand-gradient disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-opacity hover:opacity-90 text-sm mt-1"
        >
          {loading ? 'Creating account...' : rl.isLocked ? `Locked (${rl.secondsLeft}s)` : 'Create account'}
        </button>
      </form>
      <p className="mt-6 text-center text-sm text-slate-500 dark:text-slate-400">
        Already have an account?{' '}
        <button onClick={onSwitchLogin} className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium transition-colors">
          Sign in
        </button>
      </p>
    </div>
  );
}

// ─── Forgot password ─────────────────────────────────────────────────────────

interface ForgotPasswordProps {
  onBack: () => void;
}

function ForgotPasswordView({ onBack }: ForgotPasswordProps) {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const rl = useRateLimit({ maxFailures: 3, windowMs: 15 * 60 * 1000, lockoutMs: 5 * 60 * 1000 });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!rl.canSubmit()) return;
    setLoading(true);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}?reset=1`,
    });
    if (error) {
      rl.recordFailure();
      setError('If an account exists for that email, a reset link has been sent.');
    } else {
      setSent(true);
      auditLog('password_reset_requested', {});
    }
    setLoading(false);
  }

  const blocked = loading || rl.isLocked;

  if (sent) {
    return (
      <div>
        <Logo />
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 bg-brand-50 dark:bg-brand-950 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-brand-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Check your email</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-xs">
            We sent a password reset link to <span className="font-medium text-slate-700 dark:text-slate-300">{email}</span>. Click the link to set a new password.
          </p>
          <button onClick={onBack} className="text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 font-medium text-sm transition-colors">
            Back to sign in
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Logo />
      <button onClick={onBack} className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm mb-5 transition-colors">
        <ArrowLeft className="w-3.5 h-3.5" /> Back to sign in
      </button>
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Reset your password</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Enter your email and we'll send you a reset link.</p>
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field label="Email address" type="email" value={email} onChange={setEmail} placeholder="you@example.com" autoFocus disabled={rl.isLocked} />
        {rl.isLocked && <RateLimitBanner secondsLeft={rl.secondsLeft} />}
        {!rl.isLocked && error && <ErrorBanner message={error} />}
        <button
          type="submit"
          disabled={blocked}
          className="w-full bg-brand-gradient disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-2.5 px-4 rounded-lg transition-opacity hover:opacity-90 text-sm"
        >
          {loading ? 'Sending...' : rl.isLocked ? `Locked (${rl.secondsLeft}s)` : 'Send reset link'}
        </button>
      </form>
    </div>
  );
}

// ─── Reset password ───────────────────────────────────────────────────────────

function ResetPasswordView() {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const pwCheck = checkPassword(password);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!pwCheck.valid) {
      setError(pwCheck.errors[0] ?? 'Password does not meet requirements.');
      return;
    }
    if (password !== confirm) { setError('Passwords do not match.'); return; }
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      console.error('[resetPassword] auth error:', error);
      setError('Could not update password. Please try again or request a new reset link.');
      auditLog('password_reset_failure', { reason: 'update_user_error' });
    } else {
      setDone(true);
      auditLog('password_reset_success', {});
    }
    setLoading(false);
  }

  if (done) {
    return (
      <div>
        <Logo />
        <div className="flex flex-col items-center text-center py-4">
          <div className="w-12 h-12 bg-brand-50 dark:bg-brand-950 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-6 h-6 text-brand-400" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Password updated</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">You're now signed in with your new password.</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <Logo />
      <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-1">Set new password</h2>
      <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">Choose a strong new password for your account.</p>

      <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5 mb-4">
        <ShieldCheck className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Passwords must be <strong className="text-slate-700 dark:text-slate-300">12+ characters</strong>. Passphrases like <em>"correct-horse-battery"</em> are encouraged.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Field label="New password" type="password" value={password} onChange={setPassword} placeholder="12+ characters or a passphrase" autoFocus showToggle />
          <PasswordStrengthMeter password={password} />
        </div>
        <Field label="Confirm new password" type="password" value={confirm} onChange={setConfirm} placeholder="Re-enter your password" showToggle />
        {error && <ErrorBanner message={error} />}
        <button
          type="submit"
          disabled={loading || (password.length > 0 && !pwCheck.valid)}
          className="w-full bg-brand-gradient disabled:opacity-50 text-white font-semibold py-2.5 px-4 rounded-lg transition-opacity hover:opacity-90 text-sm"
        >
          {loading ? 'Updating...' : 'Update password'}
        </button>
      </form>
    </div>
  );
}

// ─── Verify email ─────────────────────────────────────────────────────────────

interface VerifyEmailProps {
  email: string;
  onSwitchLogin: () => void;
}

function VerifyEmailView({ email, onSwitchLogin }: VerifyEmailProps) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const rl = useRateLimit({ maxFailures: 3, windowMs: 10 * 60 * 1000, lockoutMs: 5 * 60 * 1000 });

  async function handleResend() {
    if (!rl.canSubmit()) return;
    setResending(true);
    setError('');
    setResent(false);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}?confirmed=1` },
    });
    if (error) {
      rl.recordFailure();
      setError('Could not resend confirmation email. Please try again shortly.');
    } else {
      setResent(true);
    }
    setResending(false);
  }

  return (
    <div>
      <Logo />
      <div className="flex flex-col items-center text-center py-2">
        <div className="w-14 h-14 bg-brand-50 dark:bg-brand-950 rounded-full flex items-center justify-center mb-5">
          <Mail className="w-7 h-7 text-brand-400" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 dark:text-slate-100 mb-2">Confirm your email</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-1 max-w-xs leading-relaxed">
          We sent a confirmation link to
        </p>
        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-5 break-all">{email}</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 max-w-xs leading-relaxed">
          Click the link in that email to activate your account. Check your spam folder if you don't see it.
        </p>

        {resent && (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2.5 mb-4 w-full">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <p className="text-emerald-700 dark:text-emerald-300 text-sm">Confirmation email resent.</p>
          </div>
        )}

        {rl.isLocked && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 mb-4 w-full">
            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-amber-800 dark:text-amber-300 text-sm">
              Too many attempts. Wait <span className="font-semibold tabular-nums">{rl.secondsLeft}s</span>.
            </p>
          </div>
        )}

        {error && !rl.isLocked && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 mb-4 w-full">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={resending || rl.isLocked}
          className="flex items-center gap-2 text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-4"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
          {resending ? 'Resending...' : 'Resend confirmation email'}
        </button>

        <button onClick={onSwitchLogin} className="text-sm text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
          Back to sign in
        </button>
      </div>
    </div>
  );
}

// ─── Unconfirmed gate ─────────────────────────────────────────────────────────

interface UnconfirmedGateProps {
  email: string;
  onSignOut: () => void;
}

export function UnconfirmedGate({ email, onSignOut }: UnconfirmedGateProps) {
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const rl = useRateLimit({ maxFailures: 3, windowMs: 10 * 60 * 1000, lockoutMs: 5 * 60 * 1000 });

  async function handleResend() {
    if (!rl.canSubmit()) return;
    setResending(true);
    setError('');
    setResent(false);
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: { emailRedirectTo: `${window.location.origin}?confirmed=1` },
    });
    if (error) {
      rl.recordFailure();
      setError('Could not resend. Please try again shortly.');
    } else {
      setResent(true);
    }
    setResending(false);
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 text-center">
        <div className="w-14 h-14 bg-amber-50 dark:bg-amber-950 rounded-full flex items-center justify-center mx-auto mb-5">
          <Mail className="w-7 h-7 text-amber-500" />
        </div>
        <h2 className="text-xl font-bold text-slate-900 dark:text-slate-100 mb-2">Confirm your email to continue</h2>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-1 leading-relaxed">
          A confirmation link was sent to
        </p>
        <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm mb-5 break-all">{email}</p>
        <p className="text-slate-500 dark:text-slate-400 text-sm mb-6 leading-relaxed">
          Click that link to activate your account. Check your spam folder if you don't see it.
        </p>

        {resent && (
          <div className="flex items-center gap-2 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2.5 mb-4">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
            <p className="text-emerald-700 dark:text-emerald-300 text-sm">Confirmation email resent.</p>
          </div>
        )}

        {rl.isLocked && (
          <div className="flex items-center gap-2 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5 mb-4">
            <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
            <p className="text-amber-800 dark:text-amber-300 text-sm">
              Too many attempts. Wait <span className="font-semibold tabular-nums">{rl.secondsLeft}s</span>.
            </p>
          </div>
        )}

        {error && !rl.isLocked && (
          <div className="flex items-start gap-2 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5 mb-4">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
          </div>
        )}

        <button
          onClick={handleResend}
          disabled={resending || rl.isLocked}
          className="flex items-center gap-2 mx-auto text-sm font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 transition-colors disabled:opacity-40 disabled:cursor-not-allowed mb-5"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${resending ? 'animate-spin' : ''}`} />
          {resending ? 'Resending...' : 'Resend confirmation email'}
        </button>

        <button
          onClick={onSignOut}
          className="text-sm text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

// ─── Shell ────────────────────────────────────────────────────────────────────

export default function AuthPage({ initialView = 'login', onBack, pendingEmail: initialEmail = '' }: AuthPageProps) {
  const [view, setView] = useState<AuthView>(initialView);
  const [pendingEmail, setPendingEmail] = useState(initialEmail);

  useEffect(() => {
    setView(initialView);
  }, [initialView]);

  useEffect(() => {
    if (initialEmail) setPendingEmail(initialEmail);
  }, [initialEmail]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex">
      {/* Left decorative panel */}
      <div
        className="hidden lg:flex lg:w-1/2 flex-col justify-between p-12"
        style={{ background: 'linear-gradient(160deg, #1e2070 0%, #2d3091 35%, #0088a8 70%, #00c8d4 100%)' }}
      >
        <div className="flex items-center gap-3">
          <img src="/ProgressPercentLogo copy copy.png" alt="Project Percent" className="w-9 h-9 object-contain brightness-0 invert" />
          <span className="text-white text-xl font-semibold tracking-tight">Project Percent</span>
        </div>
        <div className="space-y-6">
          <h1 className="text-4xl font-bold text-white leading-tight">
            Track progress,<br />
            <span className="text-cyan-200">milestone by milestone.</span>
          </h1>
          <p className="text-blue-100 text-lg leading-relaxed">
            Break your projects into milestones and watch your completion percentage climb with every achievement.
          </p>
          <div className="space-y-3">
            {[
              'Create projects with clear milestones',
              'Track completion with live percentages',
              'Stay motivated with visual progress bars',
            ].map((item) => (
              <div key={item} className="flex items-center gap-3">
                <CheckCircle2 className="w-5 h-5 text-cyan-300 flex-shrink-0" />
                <span className="text-blue-100">{item}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-blue-300 text-sm">Built for solo makers who ship.</p>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md bg-white dark:bg-gray-900 rounded-2xl shadow-sm dark:shadow-gray-950 border border-gray-200 dark:border-gray-800 p-8">
          {view === 'login' && (
            <LoginView
              onSwitchSignup={() => setView('signup')}
              onForgotPassword={() => setView('forgot-password')}
              onBack={onBack}
            />
          )}
          {view === 'signup' && (
            <SignupView
              onSwitchLogin={() => setView('login')}
              onBack={onBack}
              onVerify={(email) => { setPendingEmail(email); setView('verify-email'); }}
            />
          )}
          {view === 'verify-email' && (
            <VerifyEmailView
              email={pendingEmail}
              onSwitchLogin={() => setView('login')}
            />
          )}
          {view === 'forgot-password' && (
            <ForgotPasswordView onBack={() => setView('login')} />
          )}
          {view === 'reset-password' && (
            <ResetPasswordView />
          )}
        </div>
      </div>
    </div>
  );
}
