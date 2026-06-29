import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { startCheckout } from '../lib/checkout';
import { useUserPlan } from '../hooks/useUserPlan';
import { checkPassword } from '../lib/passwordStrength';
import type { ThemePreference } from '../lib/useTheme';
import {
  ArrowLeft,
  User,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
  Sun,
  Moon,
  Monitor,
  Loader2,
  Lock,
  CreditCard,
  Trash2,
  Eye,
  EyeOff,
  ExternalLink,
  Sparkles,
  XCircle,
  ShieldCheck,
} from 'lucide-react';

interface SettingsPageProps {
  onBack: () => void;
  theme: ThemePreference;
  setTheme: (t: ThemePreference) => void;
}

interface ProfileForm {
  fullName: string;
  email: string;
  phone: string;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

const THEME_OPTIONS: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark',  label: 'Dark',  Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
];

// ── Shared primitives ─────────────────────────────────────────────────────────

function SectionCard({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
        <h2 className="font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}

function StatusBanner({ status, message }: { status: 'success' | 'error'; message: string }) {
  if (status === 'success') {
    return (
      <div className="flex items-center gap-2.5 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-lg px-3 py-2.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
        <p className="text-emerald-700 dark:text-emerald-300 text-sm font-medium">{message}</p>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg px-3 py-2.5">
      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
      <p className="text-red-700 dark:text-red-300 text-sm">{message}</p>
    </div>
  );
}

function TextInput({
  label, icon: Icon, type = 'text', value, onChange, placeholder, hint, rightSlot,
}: {
  label: string; icon: typeof User; type?: string; value: string;
  onChange: (v: string) => void; placeholder?: string; hint?: string;
  rightSlot?: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 dark:text-slate-500 pointer-events-none" />
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full pl-9 pr-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm"
        />
        {rightSlot && <div className="absolute right-3 top-1/2 -translate-y-1/2">{rightSlot}</div>}
      </div>
      {hint && <p className="text-xs text-slate-400 dark:text-slate-500 mt-1">{hint}</p>}
    </div>
  );
}

function PasswordInput({ label, value, onChange, placeholder }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <TextInput
      label={label}
      icon={Lock}
      type={show ? 'text' : 'password'}
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? '••••••••'}
      rightSlot={
        <button type="button" onClick={() => setShow((s) => !s)}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors">
          {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
        </button>
      }
    />
  );
}

// ── Password strength meter ───────────────────────────────────────────────────

const PW_BAR_COLORS = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-400', 'bg-emerald-500'];
const PW_LABEL_COLORS = ['text-red-500', 'text-orange-500', 'text-yellow-500', 'text-emerald-500', 'text-emerald-500'];

function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const result = checkPassword(password);
  return (
    <div className="space-y-2 mt-2">
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${i < result.score ? PW_BAR_COLORS[result.score] : 'bg-gray-200 dark:bg-gray-700'}`} />
        ))}
      </div>
      <div className="flex items-start justify-between gap-2">
        <span className={`text-xs font-medium ${PW_LABEL_COLORS[result.score]}`}>{result.label}</span>
        {result.errors.length > 0 && (
          <ul className="text-xs text-red-600 dark:text-red-400 text-right space-y-0.5">
            {result.errors.map((e) => <li key={e}>{e}</li>)}
          </ul>
        )}
      </div>
    </div>
  );
}

// ── Profile section ───────────────────────────────────────────────────────────

function ProfileSection() {
  const [form, setForm] = useState<ProfileForm>({ fullName: '', email: '', phone: '' });
  const [original, setOriginal] = useState<ProfileForm>({ fullName: '', email: '', phone: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    (async () => {
      const [{ data: userData }, { data: profileData }] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from('user_profiles').select('full_name, phone_number').maybeSingle(),
      ]);
      const loaded = {
        fullName: profileData?.full_name ?? '',
        email: userData.user?.email ?? '',
        phone: profileData?.phone_number ?? '',
      };
      setForm(loaded);
      setOriginal(loaded);
      setLoading(false);
    })();
  }, []);

  const isDirty = form.fullName !== original.fullName || form.email !== original.email || form.phone !== original.phone;

  function setField(field: keyof ProfileForm) {
    return (value: string) => {
      setForm((prev) => ({ ...prev, [field]: value }));
      if (status !== 'idle') setStatus('idle');
    };
  }

  async function handleSave() {
    setSaving(true);
    setStatus('idle');
    setErrorMsg('');

    if (form.phone && !/^[+0-9\s\-().]*$/.test(form.phone)) {
      setErrorMsg('Phone number contains invalid characters.');
      setStatus('error');
      setSaving(false);
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorMsg('Please enter a valid email address.');
      setStatus('error');
      setSaving(false);
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const tasks: Promise<unknown>[] = [];
    if (form.email !== original.email) tasks.push(supabase.auth.updateUser({ email: form.email }));
    if (form.fullName !== original.fullName || form.phone !== original.phone) {
      tasks.push(supabase.from('user_profiles').update({
        full_name: form.fullName.trim(),
        phone_number: form.phone.trim(),
      }).eq('id', user.id));
    }

    try {
      await Promise.all(tasks);
      setOriginal(form);
      setStatus('success');
      setTimeout(() => setStatus('idle'), 3000);
    } catch {
      setStatus('error');
      setErrorMsg('Failed to save changes. Please try again.');
    }
    setSaving(false);
  }

  return (
    <SectionCard title="Profile" subtitle="Update your personal information">
      {loading ? (
        <div className="p-6 space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-4 w-24 bg-gray-100 dark:bg-gray-800 rounded animate-pulse" />
              <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
            </div>
          ))}
        </div>
      ) : (
        <div className="p-6 space-y-4">
          <TextInput label="Full name" icon={User} value={form.fullName} onChange={setField('fullName')} placeholder="Jane Smith" />
          <TextInput label="Email address" icon={Mail} type="email" value={form.email} onChange={setField('email')} placeholder="you@example.com"
            hint="Changing your email will send a confirmation to the new address." />
          <TextInput label="Phone number" icon={Phone} type="tel" value={form.phone} onChange={setField('phone')} placeholder="+1 (555) 000-0000" />
          {status !== 'idle' && <StatusBanner status={status} message={status === 'success' ? 'Changes saved successfully.' : errorMsg} />}
          <div className="flex justify-end pt-1">
            <button onClick={handleSave} disabled={saving || !isDirty}
              className="flex items-center gap-2 bg-brand-gradient text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? 'Saving...' : 'Save changes'}
            </button>
          </div>
        </div>
      )}
    </SectionCard>
  );
}

// ── Password section ──────────────────────────────────────────────────────────

function PasswordSection() {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  const pwCheck = checkPassword(next);

  async function handleSave() {
    setStatus('idle');
    setErrorMsg('');

    if (!current) { setErrorMsg('Enter your current password.'); setStatus('error'); return; }
    if (!pwCheck.valid) {
      setErrorMsg(pwCheck.errors[0] ?? 'New password does not meet requirements.');
      setStatus('error');
      return;
    }
    if (next !== confirm) { setErrorMsg('Passwords do not match.'); setStatus('error'); return; }
    if (next === current) { setErrorMsg('New password must be different from your current password.'); setStatus('error'); return; }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) { setSaving(false); return; }

    const { error: signInErr } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (signInErr) {
      setErrorMsg('Current password is incorrect.');
      setStatus('error');
      setSaving(false);
      return;
    }

    const { error: updateErr } = await supabase.auth.updateUser({ password: next });
    if (updateErr) {
      setErrorMsg('Failed to update password. Please try again.');
      setStatus('error');
    } else {
      setCurrent('');
      setNext('');
      setConfirm('');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 4000);
    }
    setSaving(false);
  }

  return (
    <SectionCard title="Password" subtitle="Change your account password">
      <div className="p-6 space-y-4">
        <div className="flex items-start gap-2 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2.5">
          <ShieldCheck className="w-4 h-4 text-brand-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Passwords must be <strong className="text-slate-700 dark:text-slate-300">12+ characters</strong> and must differ from your current password. Passphrases are encouraged.
          </p>
        </div>
        <PasswordInput label="Current password" value={current} onChange={(v) => { setCurrent(v); if (status !== 'idle') setStatus('idle'); }} />
        <div>
          <PasswordInput label="New password" value={next} onChange={(v) => { setNext(v); if (status !== 'idle') setStatus('idle'); }} placeholder="12+ characters or a passphrase" />
          <PasswordStrengthMeter password={next} />
        </div>
        <PasswordInput label="Confirm new password" value={confirm} onChange={(v) => { setConfirm(v); if (status !== 'idle') setStatus('idle'); }} placeholder="Re-enter new password" />
        {status !== 'idle' && <StatusBanner status={status} message={status === 'success' ? 'Password updated successfully.' : errorMsg} />}
        <div className="flex justify-end pt-1">
          <button onClick={handleSave} disabled={saving || (next.length > 0 && !pwCheck.valid)}
            className="flex items-center gap-2 bg-brand-gradient text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {saving ? 'Updating...' : 'Update password'}
          </button>
        </div>
      </div>
    </SectionCard>
  );
}

// ── Appearance section ────────────────────────────────────────────────────────

function AppearanceSection({ theme, setTheme }: { theme: ThemePreference; setTheme: (t: ThemePreference) => void }) {
  return (
    <SectionCard title="Appearance" subtitle="Choose how Project Percent looks on this device">
      <div className="p-6">
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map(({ value, label, Icon }) => {
            const active = theme === value;
            return (
              <button key={value} onClick={() => setTheme(value)}
                className={`relative flex flex-col items-center gap-2.5 rounded-xl border-2 px-4 py-5 transition-all duration-150 ${
                  active
                    ? 'border-brand-400 bg-brand-50/40 dark:bg-brand-900/20'
                    : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                  value === 'dark' ? 'bg-gray-900 border border-gray-700'
                  : value === 'light' ? 'bg-white border border-gray-200'
                  : 'bg-gradient-to-br from-white to-gray-800 border border-gray-200'
                }`}>
                  <Icon className={`w-5 h-5 ${value === 'dark' ? 'text-slate-300' : 'text-slate-600'}`} />
                </div>
                <span className={`text-sm font-medium ${active ? 'text-brand-700 dark:text-brand-300' : 'text-slate-700 dark:text-slate-300'}`}>
                  {label}
                </span>
                {active && <span className="absolute top-2 right-2 w-2 h-2 rounded-full bg-brand-400" />}
              </button>
            );
          })}
        </div>
        <p className="text-xs text-slate-400 dark:text-slate-500 mt-3">
          {theme === 'system' ? 'Follows your operating system preference.'
            : theme === 'dark' ? 'Dark mode is enabled.'
            : 'Light mode is enabled.'}
        </p>
      </div>
    </SectionCard>
  );
}

// ── Subscription section ──────────────────────────────────────────────────────

function SubscriptionSection() {
  const { plan: userPlan, loading, refresh: refreshPlan } = useUserPlan();
  const plan = loading ? null : userPlan;
  const [portalLoading, setPortalLoading] = useState(false);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelScheduledAt, setCancelScheduledAt] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleUpgrade() {
    setUpgradeLoading(true);
    setError('');
    try {
      await startCheckout();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to start checkout. Please try again.');
      setUpgradeLoading(false);
    }
  }

  async function openBillingPortal() {
    setPortalLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-billing-portal`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ returnUrl: window.location.href }),
      });
      const json = await res.json();
      if (!res.ok || !json.url) throw new Error(json.error ?? 'Could not open billing portal');
      window.location.href = json.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not open billing portal. Please try again.');
      setPortalLoading(false);
    }
  }

  async function cancelSubscription() {
    setCancelLoading(true);
    setError('');
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/cancel-subscription`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Could not cancel subscription');
      setCancelScheduledAt(json.cancelAt);
      setShowCancelConfirm(false);
      void refreshPlan();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not cancel subscription. Please try again.');
    }
    setCancelLoading(false);
  }

  return (
    <SectionCard title="Subscription" subtitle="Manage your plan and billing">
      <div className="p-6 space-y-4">
        {loading ? (
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ) : (
          <>
            {/* Plan badge */}
            <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-100 dark:border-gray-700">
              <div className="flex items-center gap-3">
                {plan === 'premium' ? (
                  <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  </div>
                ) : (
                  <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 flex items-center justify-center flex-shrink-0">
                    <CreditCard className="w-4 h-4 text-slate-500" />
                  </div>
                )}
                <div>
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">
                    {plan === 'premium' ? 'Paid plan' : 'Free'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {plan === 'premium' ? 'Unlimited projects · Shareable links on every project' : '1 project · Shareable link included'}
                  </p>
                </div>
              </div>
              {plan === 'premium' && (
                <span className="flex-shrink-0 inline-flex items-center gap-1 bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Active
                </span>
              )}
            </div>

            {plan === 'premium' ? (
              <div className="space-y-3">
                {cancelScheduledAt && (
                  <div className="flex items-start gap-2.5 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                    <p className="text-amber-700 dark:text-amber-300 text-sm">
                      Your subscription will be cancelled on{' '}
                      <span className="font-semibold">
                        {new Date(cancelScheduledAt).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}
                      </span>. You keep Premium access until then.
                    </p>
                  </div>
                )}

                <button onClick={openBillingPortal} disabled={portalLoading || cancelLoading}
                  className="w-full flex items-center justify-center gap-2 border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 hover:border-brand-400 dark:hover:border-brand-500 hover:text-brand-700 dark:hover:text-brand-400 font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                  {portalLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Opening portal...</>
                  ) : (
                    <><ExternalLink className="w-4 h-4" /> Manage billing &amp; invoices</>
                  )}
                </button>

                {!cancelScheduledAt && !showCancelConfirm && (
                  <button
                    onClick={() => setShowCancelConfirm(true)}
                    disabled={portalLoading || cancelLoading}
                    className="w-full flex items-center justify-center gap-2 border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 font-medium py-2.5 px-4 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <XCircle className="w-4 h-4" />
                    Cancel subscription
                  </button>
                )}

                {showCancelConfirm && (
                  <div className="rounded-xl border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950 p-4 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 dark:text-red-300">Cancel your subscription?</p>
                        <p className="text-sm text-red-700 dark:text-red-400 mt-0.5 leading-relaxed">
                          You'll keep paid access until the end of your current billing period. After that, your account will revert to the free plan (1 project limit).
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowCancelConfirm(false)}
                        disabled={cancelLoading}
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-white dark:hover:bg-gray-900 transition-colors disabled:opacity-50"
                      >
                        Keep Premium
                      </button>
                      <button
                        onClick={cancelSubscription}
                        disabled={cancelLoading}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {cancelLoading ? (
                          <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Cancelling...</>
                        ) : (
                          'Confirm cancellation'
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-xl bg-brand-gradient p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                      <Sparkles className="w-4 h-4 text-white" />
                    </div>
                    <div>
                      <p className="text-white font-semibold text-sm">Upgrade to Monthly</p>
                      <p className="text-blue-100 text-xs mt-0.5">Unlimited projects for just <span className="font-semibold text-white">$9.99/month</span>. Cancel anytime.</p>
                    </div>
                  </div>
                  <button
                    onClick={handleUpgrade}
                    disabled={upgradeLoading}
                    className="flex-shrink-0 flex items-center justify-center gap-2 bg-white text-brand-700 hover:bg-brand-50 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors disabled:opacity-70 shadow-sm"
                  >
                    {upgradeLoading ? (
                      <><Loader2 className="w-4 h-4 animate-spin" /> Redirecting...</>
                    ) : (
                      <><Sparkles className="w-4 h-4" /> Upgrade to Monthly</>
                    )}
                  </button>
                </div>
                <ul className="space-y-1.5 px-1">
                  {[
                    'Unlimited projects',
                    'Shareable link on every project',
                    'Custom progress bar colors',
                  ].map((f) => (
                    <li key={f} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
                      <CheckCircle2 className="w-3.5 h-3.5 text-brand-400 flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {error && <StatusBanner status="error" message={error} />}
          </>
        )}
      </div>
    </SectionCard>
  );
}

// ── MFA section ──────────────────────────────────────────────────────────────

type MfaStep = 'idle' | 'enroll' | 'verify' | 'unenroll-confirm';

function MfaSection() {
  const [factors, setFactors] = useState<{ id: string; friendly_name: string | null; factor_type: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [step, setStep] = useState<MfaStep>('idle');
  const [qrSvg, setQrSvg] = useState('');
  const [secret, setSecret] = useState('');
  const [enrollId, setEnrollId] = useState('');
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [unenrolling, setUnenrolling] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [statusMsg, setStatusMsg] = useState('');

  async function loadFactors() {
    setLoading(true);
    const { data } = await supabase.auth.mfa.listFactors();
    setFactors((data?.totp ?? []).filter((f) => f.status === 'verified'));
    setLoading(false);
  }

  useEffect(() => { loadFactors(); }, []);

  async function startEnroll() {
    setError('');
    setCode('');
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Authenticator app' });
    if (error || !data) { setError('Could not start MFA setup. Please try again.'); return; }
    setEnrollId(data.id);
    setQrSvg(data.totp.qr_code);
    setSecret(data.totp.secret);
    setStep('enroll');
  }

  async function verifyEnroll() {
    if (code.length < 6) { setError('Enter the 6-digit code from your authenticator app.'); return; }
    setVerifying(true);
    setError('');
    const challenge = await supabase.auth.mfa.challenge({ factorId: enrollId });
    if (challenge.error) { setError('Could not create MFA challenge.'); setVerifying(false); return; }
    const { error } = await supabase.auth.mfa.verify({ factorId: enrollId, challengeId: challenge.data.id, code });
    if (error) {
      setError('Incorrect code. Please try again.');
    } else {
      setStep('idle');
      setStatusMsg('Authenticator app enabled successfully.');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 4000);
      loadFactors();
    }
    setVerifying(false);
  }

  async function unenroll(factorId: string) {
    setUnenrolling(true);
    setError('');
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    if (error) {
      setError('Could not remove MFA. Please try again.');
    } else {
      setStep('idle');
      setStatusMsg('Authenticator app removed.');
      setStatus('success');
      setTimeout(() => setStatus('idle'), 4000);
      loadFactors();
    }
    setUnenrolling(false);
  }

  const hasMfa = factors.length > 0;

  return (
    <SectionCard title="Two-factor authentication" subtitle="Add an extra layer of security to your account">
      <div className="p-6 space-y-4">
        {loading ? (
          <div className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
        ) : (
          <>
            {step === 'idle' && (
              <>
                {hasMfa ? (
                  <div className="space-y-3">
                    {factors.map((f) => (
                      <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950">
                        <div className="flex items-center gap-2.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0" />
                          <div>
                            <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                              {f.friendly_name ?? 'Authenticator app'}
                            </p>
                            <p className="text-xs text-emerald-600 dark:text-emerald-500">2FA enabled</p>
                          </div>
                        </div>
                        <button
                          onClick={() => setStep('unenroll-confirm')}
                          className="text-xs font-medium text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-2.5 p-3 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950">
                      <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-amber-700 dark:text-amber-400">
                        Two-factor authentication is not enabled. We recommend enabling it to protect your account.
                      </p>
                    </div>
                    <button
                      onClick={startEnroll}
                      className="flex items-center gap-2 bg-brand-gradient text-white font-medium px-5 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Enable authenticator app
                    </button>
                  </div>
                )}
              </>
            )}

            {step === 'enroll' && (
              <div className="space-y-4">
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Scan this QR code with your authenticator app (e.g. Google Authenticator, Authy), then enter the 6-digit code to confirm.
                </p>
                <div className="flex justify-center">
                  <div
                    className="bg-white p-3 rounded-xl border border-gray-200 dark:border-gray-700 inline-block"
                    dangerouslySetInnerHTML={{ __html: qrSvg }}
                  />
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Can't scan? Enter this secret manually:</p>
                  <code className="text-xs font-mono bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded text-slate-700 dark:text-slate-300 break-all select-all">
                    {secret}
                  </code>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Verification code</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    value={code}
                    onChange={(e) => { setCode(e.target.value.replace(/\D/g, '')); setError(''); }}
                    placeholder="000000"
                    className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent transition text-sm tracking-widest font-mono"
                    autoFocus
                  />
                </div>
                {error && <StatusBanner status="error" message={error} />}
                <div className="flex gap-3">
                  <button onClick={() => { setStep('idle'); setError(''); }} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    Cancel
                  </button>
                  <button onClick={verifyEnroll} disabled={verifying || code.length < 6} className="flex-1 flex items-center justify-center gap-2 bg-brand-gradient text-white font-medium py-2.5 px-4 rounded-lg text-sm transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
                    {verifying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {verifying ? 'Verifying...' : 'Verify & enable'}
                  </button>
                </div>
              </div>
            )}

            {step === 'unenroll-confirm' && (
              <div className="space-y-4">
                <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
                  <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-red-800 dark:text-red-300">Remove two-factor authentication?</p>
                    <p className="text-sm text-red-700 dark:text-red-400 mt-0.5">
                      Your account will be less secure without 2FA.
                    </p>
                  </div>
                </div>
                {error && <StatusBanner status="error" message={error} />}
                <div className="flex gap-3">
                  <button onClick={() => { setStep('idle'); setError(''); }} className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                    Keep 2FA
                  </button>
                  <button onClick={() => unenroll(factors[0]?.id)} disabled={unenrolling} className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 text-white font-medium text-sm transition-colors">
                    {unenrolling && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    {unenrolling ? 'Removing...' : 'Remove 2FA'}
                  </button>
                </div>
              </div>
            )}

            {status !== 'idle' && step === 'idle' && (
              <StatusBanner status={status} message={statusMsg} />
            )}
          </>
        )}
      </div>
    </SectionCard>
  );
}

// ── Delete account section ────────────────────────────────────────────────────

function DeleteAccountSection() {
  const [showConfirm, setShowConfirm] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmText, setConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState('');
  const passwordRef = useRef<HTMLInputElement>(null);

  const CONFIRM_PHRASE = 'delete my account';
  const canDelete = confirmText.toLowerCase() === CONFIRM_PHRASE && password.length >= 1;

  useEffect(() => {
    if (showConfirm) setTimeout(() => passwordRef.current?.focus(), 50);
  }, [showConfirm]);

  async function handleDelete() {
    if (!canDelete) return;
    setDeleting(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const res = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ password }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? 'Failed to delete account.');

      // Sign out locally — the server already deleted the user
      await supabase.auth.signOut({ scope: 'local' });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete account. Please try again.');
      setDeleting(false);
    }
  }

  return (
    <SectionCard title="Danger zone" subtitle="Permanent actions that cannot be undone">
      <div className="p-6">
        {!showConfirm ? (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-slate-800 dark:text-slate-200">Delete account</p>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Permanently remove your account and all project data.
              </p>
            </div>
            <button onClick={() => setShowConfirm(true)}
              className="flex-shrink-0 flex items-center gap-2 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 font-medium px-4 py-2.5 rounded-lg text-sm transition-colors">
              <Trash2 className="w-4 h-4" />
              Delete account
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Warning */}
            <div className="flex gap-3 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-800 dark:text-red-300">This cannot be undone</p>
                <p className="text-sm text-red-700 dark:text-red-400 mt-0.5 leading-relaxed">
                  Your account, all projects, milestones, and billing data will be permanently deleted. Active subscriptions will be cancelled immediately.
                </p>
              </div>
            </div>

            {/* Password confirmation */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Confirm your password
              </label>
              <input
                ref={passwordRef}
                type="password"
                value={password}
                onChange={(e) => { setPassword(e.target.value); if (error) setError(''); }}
                placeholder="••••••••"
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition text-sm"
              />
            </div>

            {/* Type-to-confirm */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Type <span className="font-mono bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded text-red-600 dark:text-red-400 text-xs">{CONFIRM_PHRASE}</span> to confirm
              </label>
              <input
                type="text"
                value={confirmText}
                onChange={(e) => { setConfirmText(e.target.value); if (error) setError(''); }}
                placeholder={CONFIRM_PHRASE}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-400 focus:border-transparent transition text-sm"
              />
            </div>

            {error && <StatusBanner status="error" message={error} />}

            <div className="flex gap-3 pt-1">
              <button onClick={() => { setShowConfirm(false); setPassword(''); setConfirmText(''); setError(''); }}
                className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={!canDelete || deleting}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {deleting ? 'Deleting...' : 'Delete my account'}
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ── Page shell ────────────────────────────────────────────────────────────────

export default function SettingsPage({ onBack, theme, setTheme }: SettingsPageProps) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button onClick={onBack}
            className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors text-sm">
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-2">
            <img src="/ProgressPercentLogo copy copy.png" alt="" className="w-5 h-5 object-contain" />
            <span className="font-semibold text-slate-900 dark:text-slate-100">Settings</span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <ProfileSection />
        <PasswordSection />
        <MfaSection />
        <AppearanceSection theme={theme} setTheme={setTheme} />
        <SubscriptionSection />

        {/* Sign out */}
        <section className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Session</h2>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Sign out of this device</p>
          </div>
          <div className="p-6">
            <button onClick={() => supabase.auth.signOut({ scope: 'local' })}
              className="text-sm font-medium text-slate-600 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition-colors border border-gray-300 dark:border-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800">
              Sign out
            </button>
          </div>
        </section>

        <DeleteAccountSection />
      </main>
    </div>
  );
}