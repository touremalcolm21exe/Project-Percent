import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Project, UserProfile } from '../lib/database.types';
import { validateProjectName, validateProjectDescription, LIMITS } from '../lib/validation';
import { downloadProject } from '../lib/downloadProject';
import ProgressBar from './ProgressBar';
import { Plus, LogOut, ChevronRight, FolderOpen, X, AlertCircle, Sparkles, Lock, Zap, CheckCircle2, Download, Settings } from 'lucide-react';
import { startCheckout } from '../lib/checkout';

const FREE_LIMIT = 3;

interface DashboardProps {
  onSelectProject: (id: string) => void;
  onSettings: () => void;
  onPlanLoaded?: (isPremium: boolean) => void;
  upgradeSuccess?: boolean;
}

export default function Dashboard({ onSelectProject, onSettings, onPlanLoaded, upgradeSuccess = false }: DashboardProps) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [showLimitTooltip, setShowLimitTooltip] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [showSuccessBanner, setShowSuccessBanner] = useState(upgradeSuccess);
  const limitBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    loadData();
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email ?? '');
    });
  }, []);

  // After checkout redirect, poll until webhook promotes plan (or give up).
  useEffect(() => {
    if (!upgradeSuccess) return;

    let attempts = 0;
    const maxAttempts = 12;

    async function pollProfile() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) return;

      const { data: profileData } = await supabase
        .from('user_profiles')
        .select('id, plan, stripe_customer_id, stripe_subscription_id, projects_created_count, created_at, updated_at')
        .eq('id', userId)
        .maybeSingle();

      if (profileData) {
        setProfile(profileData);
        onPlanLoaded?.(profileData.plan === 'premium');
      }
    }

    const interval = setInterval(() => {
      attempts += 1;
      void pollProfile();
      if (attempts >= maxAttempts) clearInterval(interval);
    }, 2000);

    void pollProfile();

    return () => clearInterval(interval);
  }, [upgradeSuccess, onPlanLoaded]);

  useEffect(() => {
    if (!showSuccessBanner) return;
    const t = setTimeout(() => setShowSuccessBanner(false), 6000);
    return () => clearTimeout(t);
  }, [showSuccessBanner]);

  async function loadData() {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    const userId = userData.user?.id;

    const [{ data: projectsData }, { data: profileData }] = await Promise.all([
      supabase.from('projects').select('*').order('updated_at', { ascending: false }),
      userId
        ? supabase.from('user_profiles').select('id, plan, stripe_customer_id, stripe_subscription_id, projects_created_count, created_at, updated_at').eq('id', userId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (projectsData) setProjects(projectsData);
    if (profileData) {
      setProfile(profileData);
      onPlanLoaded?.(profileData.plan === 'premium');
    }
    setLoading(false);
  }

  const plan = profile?.plan ?? 'free';
  const isPremium = plan === 'premium';
  const lifetimeCount = profile?.projects_created_count ?? 0;
  const atLimit = !isPremium && lifetimeCount >= FREE_LIMIT;

  async function handleUpgrade() {
    setCheckoutLoading(true);
    setCheckoutError('');
    try {
      await startCheckout();
    } catch (err) {
      setCheckoutError(err instanceof Error ? err.message : 'Unable to start checkout. Please try again.');
      setCheckoutLoading(false);
    }
  }

  async function createProject() {
    setError('');

    const nameErr = validateProjectName(newName);
    const descErr = validateProjectDescription(newDesc);
    setNameError(nameErr);
    if (nameErr || descErr) {
      if (descErr) setError(descErr);
      return;
    }

    setSaving(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setSaving(false); return; }

    const { error: insertError } = await supabase.from('projects').insert({
      user_id: user.id,
      name: newName.trim(),
      description: newDesc.trim(),
    });

    if (insertError) {
      if (
        insertError.message.startsWith('Free plan is limited to') ||
        insertError.message.startsWith('Project limit reached.') ||
        insertError.message.startsWith('Too many requests.')
      ) {
        setError(insertError.message);
      } else {
        console.error('[createProject] db error:', insertError);
        setError('Could not create project. Please try again.');
      }
    } else {
      setShowNewModal(false);
      setNewName('');
      setNewDesc('');
      loadData();
    }
    setSaving(false);
  }

  async function signOut() {
    setProjects([]);
    setProfile(null);
    setUserEmail('');
    setShowNewModal(false);
    setError('');
    setNameError('');
    setCheckoutError('');
    await supabase.auth.signOut({ scope: 'local' });
  }

  const completedCount = projects.filter((p) => p.progress_percent === 100).length;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/ProgressPercentLogo copy copy.png" alt="Project Percent" className="w-8 h-8 object-contain" />
            <span className="font-semibold text-slate-900 dark:text-slate-100 text-lg tracking-tight">Project Percent</span>
          </div>

          <div className="flex items-center gap-3">
            {!loading && (
              isPremium ? (
                <span className="hidden sm:inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                  <Sparkles className="w-3 h-3" />
                  Premium
                </span>
              ) : (
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  className="hidden sm:inline-flex items-center gap-1.5 bg-brand-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60 shadow-sm"
                >
                  {checkoutLoading ? (
                    <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  ) : (
                    <Sparkles className="w-3 h-3" />
                  )}
                  Upgrade to Premium
                </button>
              )
            )}
            <span className="text-slate-400 dark:text-slate-500 text-sm hidden lg:block truncate max-w-[180px]">{userEmail}</span>
            <button
              onClick={onSettings}
              className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm transition-colors px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
              title="Settings"
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </button>
            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm transition-colors px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Sign out</span>
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8">

        {/* Upgrade success banner */}
        {showSuccessBanner && (
          <div className="flex items-center gap-3 bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-xl px-4 py-3 mb-6">
            <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0" />
            <div>
              <p className="text-emerald-800 dark:text-emerald-300 text-sm font-semibold">Welcome to Premium!</p>
              <p className="text-emerald-700 dark:text-emerald-400 text-sm">You now have up to 500 projects. Enjoy!</p>
            </div>
          </div>
        )}

        {/* Page header */}
        <div className="flex items-start justify-between mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Your Projects</h1>
            {loading ? (
              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mt-1" />
            ) : (
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                {projects.length === 0
                  ? 'No projects yet — create your first one'
                  : `${projects.length} project${projects.length !== 1 ? 's' : ''} · ${completedCount} completed`}
              </p>
            )}
          </div>

          <div className="relative flex-shrink-0" ref={limitBtnRef as React.RefObject<HTMLDivElement>}>
            {atLimit ? (
              <>
                <button
                  onClick={() => setShowLimitTooltip((v) => !v)}
                  onBlur={() => setTimeout(() => setShowLimitTooltip(false), 150)}
                  className="flex items-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 font-medium px-4 py-2.5 rounded-lg text-sm cursor-not-allowed border border-gray-200 dark:border-gray-700"
                >
                  <Lock className="w-4 h-4" />
                  <span>New project</span>
                </button>
                {showLimitTooltip && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-slate-900 dark:bg-gray-800 text-white rounded-xl px-4 py-3 shadow-lg z-20">
                    <p className="font-semibold text-sm mb-1">Free plan limit reached</p>
                    <p className="text-slate-300 text-xs leading-relaxed mb-3">Upgrade to Premium for up to 500 projects.</p>
                    <button
                      onClick={() => { setShowLimitTooltip(false); handleUpgrade(); }}
                      disabled={checkoutLoading}
                      className="w-full flex items-center justify-center gap-1.5 bg-brand-gradient text-white text-xs font-semibold px-3 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {checkoutLoading ? (
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Upgrade to Premium
                    </button>
                    <div className="absolute -top-1.5 right-5 w-3 h-3 bg-slate-900 dark:bg-gray-800 rotate-45 rounded-sm" />
                  </div>
                )}
              </>
            ) : (
              <button
                onClick={() => setShowNewModal(true)}
                className="flex items-center gap-2 bg-brand-gradient text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90 shadow-sm"
              >
                <Plus className="w-4 h-4" />
                <span>New project</span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile plan badge / upgrade button */}
        {!loading && (
          <div className="sm:hidden mb-5">
            {isPremium ? (
              <span className="inline-flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-semibold px-2.5 py-1 rounded-full">
                <Sparkles className="w-3 h-3" />
                Premium · Up to 500 projects
              </span>
            ) : (
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="inline-flex items-center gap-1.5 bg-brand-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60 shadow-sm"
              >
                {checkoutLoading ? (
                  <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <Sparkles className="w-3 h-3" />
                )}
                Upgrade to Premium
              </button>
            )}
          </div>
        )}

        {/* Upgrade to Premium banner */}
        {!loading && !isPremium && (
          <div className="bg-brand-gradient rounded-2xl px-5 py-5 mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 shadow-sm">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">Upgrade to Premium</p>
                <p className="text-blue-100 text-sm mt-0.5">Up to 500 projects for just <span className="font-semibold text-white">$9.99/month</span>. Cancel anytime.</p>
              </div>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="flex-shrink-0 flex items-center justify-center gap-2 bg-white text-brand-700 hover:bg-brand-50 font-semibold text-sm px-5 py-2.5 rounded-xl transition-colors duration-150 shadow-sm disabled:opacity-70"
            >
              {checkoutLoading ? (
                <>
                  <span className="w-4 h-4 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
                  Redirecting...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  Upgrade to Premium
                </>
              )}
            </button>
          </div>
        )}

        {/* Checkout error */}
        {checkoutError && (
          <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl px-4 py-3 mb-6">
            <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
            <p className="text-red-700 dark:text-red-300 text-sm">{checkoutError}</p>
          </div>
        )}

        {/* Limit banner */}
        {!loading && atLimit && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-3 mb-6">
            <div className="flex items-start gap-3 flex-1 min-w-0">
              <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-amber-800 dark:text-amber-300 text-sm">
                <span className="font-semibold">Free plan limit reached.</span> You've used all {FREE_LIMIT} free projects.
              </p>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="flex-shrink-0 flex items-center justify-center gap-1.5 bg-brand-gradient text-white text-xs font-semibold px-3.5 py-2 rounded-lg transition-opacity hover:opacity-90 disabled:opacity-60 shadow-sm"
            >
              {checkoutLoading ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Upgrade to Premium
            </button>
          </div>
        )}

        {/* Projects list */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 animate-pulse">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
                <div className="h-2.5 bg-gray-100 dark:bg-gray-800 rounded-full w-full" />
              </div>
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 border-dashed flex flex-col items-center justify-center py-16 px-6 text-center">
            <div className="w-12 h-12 bg-brand-50 dark:bg-brand-950 rounded-xl flex items-center justify-center mb-4">
              <FolderOpen className="w-6 h-6 text-brand-500" />
            </div>
            <h3 className="font-semibold text-slate-800 dark:text-slate-200 mb-1">No projects yet</h3>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-5">Create your first project to start tracking progress</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="flex items-center gap-2 bg-brand-gradient text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90"
            >
              <Plus className="w-4 h-4" />
              New project
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {projects.map((project) => (
              <div
                key={project.id}
                className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 hover:border-brand-300 dark:hover:border-brand-700 hover:shadow-md dark:hover:shadow-gray-950/50 transition-all duration-200 group"
              >
                <button
                  onClick={() => onSelectProject(project.id)}
                  className="w-full p-5 text-left"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="min-w-0 flex-1 pr-4">
                      <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-base leading-tight truncate group-hover:text-brand-700 dark:group-hover:text-brand-400 transition-colors">
                        {project.name}
                      </h3>
                      {project.description && (
                        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5 line-clamp-1">{project.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className={`text-xl font-bold tabular-nums ${project.progress_percent === 100 ? 'text-emerald-500' : 'text-slate-800 dark:text-slate-200'}`}>
                        {project.progress_percent}%
                      </span>
                      <ChevronRight className="w-4 h-4 text-slate-400 dark:text-slate-600 group-hover:text-brand-500 transition-colors" />
                    </div>
                  </div>
                  <ProgressBar percent={project.progress_percent} color={project.progress_color} />
                </button>
                {/* Download row */}
                <div className="px-5 pb-3 flex items-center gap-2">
                  <Download className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600" />
                  <span className="text-xs text-slate-400 dark:text-slate-600 mr-1">Download:</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadProject(project, 'csv'); }}
                    className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors"
                  >
                    CSV
                  </button>
                  <span className="text-slate-300 dark:text-slate-700 text-xs">·</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); downloadProject(project, 'json'); }}
                    className="text-xs font-medium text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline transition-colors"
                  >
                    JSON
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* New project modal */}
      {showNewModal && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-gray-950 w-full max-w-md border border-transparent dark:border-gray-800">
            <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">New project</h2>
              <button
                onClick={() => { setShowNewModal(false); setError(''); setNameError(''); setNewName(''); setNewDesc(''); }}
                className="text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Project name <span className="text-red-400">*</span>
                  </label>
                  <span className={`text-xs tabular-nums ${newName.length > LIMITS.projectName.max ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                    {newName.length}/{LIMITS.projectName.max}
                  </span>
                </div>
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => { setNewName(e.target.value); if (nameError) setNameError(''); }}
                  onKeyDown={(e) => e.key === 'Enter' && createProject()}
                  maxLength={LIMITS.projectName.max}
                  className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:border-transparent text-sm transition ${nameError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-brand-400'}`}
                  placeholder="e.g. Website Redesign"
                />
                {nameError && <p className="text-red-500 text-xs mt-1">{nameError}</p>}
              </div>
              <div>
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Description <span className="text-slate-400 dark:text-slate-500 font-normal">(optional)</span>
                  </label>
                  <span className={`text-xs tabular-nums ${newDesc.length > LIMITS.projectDescription.max ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                    {newDesc.length}/{LIMITS.projectDescription.max}
                  </span>
                </div>
                <textarea
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  rows={3}
                  maxLength={LIMITS.projectDescription.max}
                  className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm transition resize-none"
                  placeholder="What is this project about?"
                />
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
                  <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  <p className="text-red-700 dark:text-red-300 text-sm">{error}</p>
                </div>
              )}

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setShowNewModal(false); setError(''); setNameError(''); setNewName(''); setNewDesc(''); }}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={createProject}
                  disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-lg bg-brand-gradient disabled:opacity-60 text-white font-medium text-sm transition-opacity hover:opacity-90 flex items-center justify-center gap-2"
                >
                  {saving ? (
                    <>
                      <span className="w-3.5 h-3.5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Creating...
                    </>
                  ) : 'Create project'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
