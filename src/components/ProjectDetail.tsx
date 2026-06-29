import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { auditLog } from '../lib/audit';
import { buildShareUrl, setProjectSharing } from '../lib/shareProject';
import { downloadProject } from '../lib/downloadProject';
import type { Project, Milestone } from '../lib/database.types';
import {
  validateProjectName,
  validateProjectDescription,
  validateProgressColor,
  validateMilestoneTitle,
  validateMilestoneDescription,
  LIMITS,
} from '../lib/validation';
import ProgressBar from './ProgressBar';
import CompletionCelebration from './CompletionCelebration';
import {
  ArrowLeft,
  Plus,
  CheckCircle2,
  Circle,
  Pencil,
  Trash2,
  Check,
  X,
  AlertCircle,
  Flag,
  ListChecks,
  Download,
  Settings,
  Sparkles,
  Share2,
  Copy,
  Lock,
} from 'lucide-react';
import { startCheckout } from '../lib/checkout';

const PRESET_COLORS = [
  { label: 'Ocean',   hex: '#0088a8' },
  { label: 'Cyan',    hex: '#00b8d9' },
  { label: 'Sky',     hex: '#0ea5e9' },
  { label: 'Navy',    hex: '#2d3091' },
  { label: 'Emerald', hex: '#10b981' },
  { label: 'Rose',    hex: '#f43f5e' },
  { label: 'Orange',  hex: '#f97316' },
  { label: 'Amber',   hex: '#f59e0b' },
];

interface ProjectDetailProps {
  projectId: string;
  onBack: () => void;
  onSettings: () => void;
  isPremium?: boolean;
}

function ShareButton({
  project,
  isPremium,
  onProjectUpdate,
  onUpgrade,
  upgradeLoading,
}: {
  project: Project;
  isPremium: boolean;
  onProjectUpdate: (updates: Partial<Project>) => void;
  onUpgrade: () => void;
  upgradeLoading: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(t);
  }, [copied]);

  const shareUrl = project.share_token ? buildShareUrl(project.share_token) : '';

  async function handleToggle(enabled: boolean) {
    if (!isPremium) {
      onUpgrade();
      return;
    }

    setLoading(true);
    setError('');
    const { shareToken, error: shareError } = await setProjectSharing(project.id, enabled);
    setLoading(false);

    if (shareError) {
      setError(shareError);
      return;
    }

    onProjectUpdate({
      is_public: enabled,
      share_token: enabled ? shareToken ?? project.share_token : project.share_token,
    });
  }

  async function handleCopy() {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
    } catch {
      setError('Could not copy link. Please copy it manually.');
    }
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 p-2 rounded-lg transition-colors ${
          project.is_public
            ? 'text-brand-600 bg-brand-50 dark:bg-brand-950 hover:bg-brand-100 dark:hover:bg-brand-900'
            : 'text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950'
        }`}
        title="Share project"
      >
        <Share2 className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-80 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-gray-950 z-20 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Public share link</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Anyone with the link can view this project&apos;s progress.
            </p>
          </div>

          <div className="px-4 py-3 space-y-3">
            {!isPremium ? (
              <div className="rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 px-3 py-2.5">
                <div className="flex items-start gap-2">
                  <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Premium feature</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
                      Upgrade to share a public read-only link to this project.
                    </p>
                    <button
                      onClick={onUpgrade}
                      disabled={upgradeLoading}
                      className="mt-2 inline-flex items-center gap-1.5 bg-brand-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60"
                    >
                      {upgradeLoading ? (
                        <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      Upgrade
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
                <label className="flex items-center justify-between gap-3">
                  <span className="text-sm text-slate-700 dark:text-slate-300">Enable public link</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={project.is_public}
                    disabled={loading}
                    onClick={() => void handleToggle(!project.is_public)}
                    className={`relative inline-flex h-6 w-11 flex-shrink-0 rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:ring-offset-2 disabled:opacity-60 ${
                      project.is_public ? 'bg-brand-500' : 'bg-gray-200 dark:bg-gray-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
                        project.is_public ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </label>

                {project.is_public && shareUrl && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-slate-500 dark:text-slate-400 uppercase tracking-wide">Share URL</p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={shareUrl}
                        className="flex-1 min-w-0 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 text-xs text-slate-700 dark:text-slate-300"
                      />
                      <button
                        onClick={() => void handleCopy()}
                        className="flex items-center gap-1 px-2.5 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-slate-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-gray-900 text-xs font-medium transition-colors"
                      >
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                        {copied ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {error && (
              <p className="text-xs text-red-500">{error}</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function DownloadButton({ project, milestones }: { project: Project; milestones: Milestone[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function close(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 p-2 text-slate-400 hover:text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950 rounded-lg transition-colors"
        title="Download project"
      >
        <Download className="w-4 h-4" />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1.5 w-44 bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-lg dark:shadow-gray-950 z-20 overflow-hidden">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide">Download as</p>
          </div>
          <button
            onClick={() => { downloadProject(project, 'csv', milestones); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-950 hover:text-brand-700 dark:hover:text-brand-400 transition-colors text-left"
          >
            <span className="w-6 h-6 rounded bg-green-50 dark:bg-green-950 text-green-700 dark:text-green-400 text-[10px] font-bold flex items-center justify-center">CSV</span>
            Spreadsheet (.csv)
          </button>
          <button
            onClick={() => { downloadProject(project, 'json', milestones); setOpen(false); }}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-brand-50 dark:hover:bg-brand-950 hover:text-brand-700 dark:hover:text-brand-400 transition-colors text-left"
          >
            <span className="w-6 h-6 rounded bg-amber-50 dark:bg-amber-950 text-amber-700 dark:text-amber-400 text-[10px] font-bold flex items-center justify-center">JSON</span>
            Data file (.json)
          </button>
        </div>
      )}
    </div>
  );
}

function calcPercent(milestones: Milestone[]): number {
  if (milestones.length === 0) return 0;
  return Math.round((milestones.filter((m) => m.is_complete).length / milestones.length) * 100);
}

function ProjectDetail({ projectId, onBack, onSettings, isPremium = true }: ProjectDetailProps) {
  const [project, setProject] = useState<Project | null>(null);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  const [addingNew, setAddingNew] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [savingNew, setSavingNew] = useState(false);
  const newInputRef = useRef<HTMLInputElement>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDesc, setEditDesc] = useState('');

  const [editingProject, setEditingProject] = useState(false);
  const [editProjectName, setEditProjectName] = useState('');
  const [editProjectDesc, setEditProjectDesc] = useState('');
  const [editProjectColor, setEditProjectColor] = useState<string | null>(null);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deletingProject, setDeletingProject] = useState(false);

  const [error, setError] = useState('');
  const [newTitleError, setNewTitleError] = useState('');
  const [newDescError, setNewDescError] = useState('');
  const [editTitleError, setEditTitleError] = useState('');
  const [editDescError, setEditDescError] = useState('');
  const [projectEditError, setProjectEditError] = useState('');
  const [toggleError, setToggleError] = useState('');
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [showCelebration, setShowCelebration] = useState(false);
  const [deletingProjectLoading, setDeletingProjectLoading] = useState(false);

  async function handleUpgrade() {
    setUpgradeLoading(true);
    try {
      await startCheckout();
    } catch {
      setUpgradeLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [projectId]);

  useEffect(() => {
    if (addingNew) newInputRef.current?.focus();
  }, [addingNew]);

  async function loadData() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }
    setUserId(user.id);

    const [{ data: proj }, { data: miles }] = await Promise.all([
      supabase.from('projects').select('*').eq('id', projectId).eq('user_id', user.id).maybeSingle(),
      supabase.from('milestones').select('*').eq('project_id', projectId).order('created_at', { ascending: true }),
    ]);
    if (proj) setProject(proj);
    if (miles) setMilestones(miles);
    setLoading(false);
  }

  async function toggleMilestone(milestone: Milestone) {
    setToggleError('');
    const newComplete = !milestone.is_complete;

    const nextMilestones = milestones.map((m) =>
      m.id === milestone.id ? { ...m, is_complete: newComplete } : m
    );
    setMilestones(nextMilestones);

    const newPercent = calcPercent(nextMilestones);
    setProject((prev) => prev ? { ...prev, progress_percent: newPercent } : prev);

    const [{ error: milestoneErr }] = await Promise.all([
      supabase.from('milestones').update({ is_complete: newComplete }).eq('id', milestone.id).eq('project_id', projectId),
      userId
        ? supabase.from('projects').update({ progress_percent: newPercent }).eq('id', projectId).eq('user_id', userId)
        : Promise.resolve({ error: null }),
    ]);

    if (milestoneErr) {
      setMilestones(milestones);
      setProject((prev) => prev ? { ...prev, progress_percent: calcPercent(milestones) } : prev);
      setToggleError('Failed to save. Please try again.');
    } else if (newPercent === 100 && calcPercent(milestones) < 100) {
      setShowCelebration(true);
    }
  }

  async function addMilestone() {
    const titleErr = validateMilestoneTitle(newTitle);
    const descErr = validateMilestoneDescription(newDesc);
    setNewTitleError(titleErr);
    setNewDescError(descErr);
    if (titleErr || descErr) return;
    setSavingNew(true);
    const { data, error } = await supabase
      .from('milestones')
      .insert({ project_id: projectId, title: newTitle.trim(), description: newDesc.trim() })
      .select()
      .maybeSingle();

    if (!error && data) {
      const nextMilestones = [...milestones, data];
      setMilestones(nextMilestones);
      setNewTitle('');
      setNewDesc('');
      setAddingNew(false);
      const newPercent = calcPercent(nextMilestones);
      setProject((prev) => prev ? { ...prev, progress_percent: newPercent } : prev);
      if (userId) {
        await supabase.from('projects').update({ progress_percent: newPercent }).eq('id', projectId).eq('user_id', userId);
      }
    } else if (error) {
      // PostgREST surfaces trigger RAISE EXCEPTION text in error.message for
      // P0001 errors, but falls back to a generic HTTP message for others.
      // Check all fields so nothing gets swallowed.
      const raw = error.message || error.details || error.hint || '';
      if (raw.includes('Milestone limit reached.')) {
        setError('Milestone limit reached. A project may have at most 100 milestones.');
      } else if (raw.includes('Too many requests.') || raw.includes('too many requests')) {
        setError('Too many requests. Please wait a moment and try again.');
      } else if (raw.includes('row-level security') || raw.includes('violates row-level')) {
        setError('Permission denied. Make sure you are signed in and own this project.');
      } else if (raw.includes('title') && (raw.includes('length') || raw.includes('check'))) {
        setNewTitleError(`Milestone title must be ${LIMITS.milestoneTitle.max} characters or fewer.`);
      } else if (raw.includes('description') && (raw.includes('length') || raw.includes('check'))) {
        setNewDescError(`Description must be ${LIMITS.milestoneDescription.max} characters or fewer.`);
      } else {
        console.error('[addMilestone] db error:', error);
        setError(raw || 'Could not add milestone. Please try again.');
      }
    }
    setSavingNew(false);
  }

  async function saveEdit(id: string) {
    const titleErr = validateMilestoneTitle(editTitle);
    const descErr = validateMilestoneDescription(editDesc);
    setEditTitleError(titleErr);
    setEditDescError(descErr);
    if (titleErr || descErr) return;
    const { error } = await supabase
      .from('milestones')
      .update({ title: editTitle.trim(), description: editDesc.trim() })
      .eq('id', id)
      .eq('project_id', projectId);

    if (!error) {
      setMilestones((prev) =>
        prev.map((m) => (m.id === id ? { ...m, title: editTitle.trim(), description: editDesc.trim() } : m))
      );
      setEditingId(null);
      setEditTitleError('');
      setEditDescError('');
    } else {
      setEditTitleError('Failed to save. Please try again.');
    }
  }

  async function deleteMilestone(id: string) {
    const milestone = milestones.find((m) => m.id === id);
    const { data: deleted, error } = await supabase
      .rpc('soft_delete_milestone', { p_milestone_id: id });
    if (!error && deleted) {
      auditLog('milestone_deleted', { milestone_id: id, project_id: projectId, title: milestone?.title });
      const nextMilestones = milestones.filter((m) => m.id !== id);
      setMilestones(nextMilestones);
      setDeletingId(null);
      const newPercent = calcPercent(nextMilestones);
      setProject((prev) => prev ? { ...prev, progress_percent: newPercent } : prev);
      const q = supabase.from('projects').update({ progress_percent: newPercent }).eq('id', projectId);
      if (userId) await q.eq('user_id', userId); else await q;
    }
  }

  function openProjectEdit() {
    if (!project) return;
    setEditProjectName(project.name);
    setEditProjectDesc(project.description ?? '');
    setEditProjectColor(project.progress_color ?? null);
    setProjectEditError('');
    setEditingProject(true);
  }

  async function saveProjectEdit() {
    const nameErr = validateProjectName(editProjectName);
    const descErr = validateProjectDescription(editProjectDesc);
    const colorErr = validateProgressColor(editProjectColor);
    const combined = nameErr || descErr || colorErr;
    setProjectEditError(combined);
    if (combined) return;
    const q = supabase
      .from('projects')
      .update({
        name: editProjectName.trim(),
        description: editProjectDesc.trim(),
        progress_color: editProjectColor,
      })
      .eq('id', projectId);
    const { error } = userId ? await q.eq('user_id', userId) : await q;

    if (!error) {
      setProject((prev) =>
        prev
          ? { ...prev, name: editProjectName.trim(), description: editProjectDesc.trim(), progress_color: editProjectColor }
          : prev
      );
      setEditingProject(false);
    } else {
      setProjectEditError('Failed to save changes. Please try again.');
    }
  }

  async function deleteProject() {
    setDeletingProjectLoading(true);
    const uid = userId ?? (await supabase.auth.getUser()).data.user?.id;
    if (!uid) { setDeletingProjectLoading(false); return; }
    const { data: deleted, error } = await supabase
      .rpc('soft_delete_project', { p_project_id: projectId });
    setDeletingProjectLoading(false);
    setDeletingProject(false);
    if (!error && deleted) {
      auditLog('project_deleted', { project_id: projectId, project_name: project?.name });
      onBack();
    } else {
      setError('Failed to delete project. Please try again.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4">
        <p className="text-slate-500">Project not found.</p>
        <button onClick={onBack} className="text-brand-600 font-medium hover:underline">
          Back to dashboard
        </button>
      </div>
    );
  }

  const completedCount = milestones.filter((m) => m.is_complete).length;
  const progressPercent = calcPercent(milestones);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-100 transition-colors text-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Projects</span>
          </button>
          <div className="h-4 w-px bg-gray-200 dark:bg-gray-700" />
          <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
            <img src="/ProgressPercentLogo copy copy.png" alt="" className="w-5 h-5 object-contain flex-shrink-0" />
            <span
              className="font-semibold text-slate-900 dark:text-slate-100 truncate"
              title={project.name}
            >{project.name}</span>
          </div>
          {!isPremium && (
            <button
              onClick={handleUpgrade}
              disabled={upgradeLoading}
              className="hidden sm:inline-flex items-center gap-1.5 bg-brand-gradient text-white text-xs font-semibold px-3 py-1.5 rounded-full transition-opacity hover:opacity-90 disabled:opacity-60 shadow-sm flex-shrink-0"
            >
              {upgradeLoading ? (
                <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Sparkles className="w-3 h-3" />
              )}
              Upgrade
            </button>
          )}
          <button
            onClick={onSettings}
            className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 text-sm transition-colors px-2 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-800 flex-shrink-0"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
            <span className="hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Project card */}
        {editingProject ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 space-y-5">
            <h2 className="font-semibold text-slate-800 dark:text-slate-200 text-sm uppercase tracking-wide">Edit project</h2>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Name</label>
                <span className={`text-xs tabular-nums ${editProjectName.length > LIMITS.projectName.max ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {editProjectName.length}/{LIMITS.projectName.max}
                </span>
              </div>
              <input
                autoFocus
                type="text"
                value={editProjectName}
                onChange={(e) => { setEditProjectName(e.target.value); if (projectEditError) setProjectEditError(''); }}
                maxLength={LIMITS.projectName.max}
                className={`w-full px-3.5 py-2.5 rounded-lg border bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:border-transparent text-sm transition ${projectEditError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-brand-400'}`}
              />
              {projectEditError && <p className="text-red-500 text-xs mt-1">{projectEditError}</p>}
            </div>
            <div>
              <div className="flex items-baseline justify-between mb-1.5">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">Description</label>
                <span className={`text-xs tabular-nums ${editProjectDesc.length > LIMITS.projectDescription.max ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                  {editProjectDesc.length}/{LIMITS.projectDescription.max}
                </span>
              </div>
              <textarea
                value={editProjectDesc}
                onChange={(e) => setEditProjectDesc(e.target.value)}
                rows={2}
                maxLength={LIMITS.projectDescription.max}
                className="w-full px-3.5 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-brand-400 focus:border-transparent text-sm transition resize-none"
              />
            </div>

            {/* Color picker */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Progress bar color</label>
              <div className="flex flex-wrap gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditProjectColor(null)}
                  title="Auto (default)"
                  className={`w-9 h-9 rounded-full border-2 transition-all duration-150 flex items-center justify-center bg-brand-gradient ${
                    editProjectColor === null
                      ? 'border-slate-700 dark:border-slate-300 scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                >
                  {editProjectColor === null && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                </button>
                {PRESET_COLORS.map(({ label, hex }) => (
                  <button
                    key={hex}
                    type="button"
                    onClick={() => setEditProjectColor(hex)}
                    title={label}
                    className={`w-9 h-9 rounded-full border-2 transition-all duration-150 flex items-center justify-center ${
                      editProjectColor === hex
                        ? 'border-slate-700 dark:border-slate-300 scale-110 shadow-md'
                        : 'border-transparent hover:scale-105'
                    }`}
                    style={{ backgroundColor: hex }}
                  >
                    {editProjectColor === hex && <Check className="w-3.5 h-3.5 text-white drop-shadow" />}
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <p className="text-xs text-slate-400 dark:text-slate-500 mb-1.5">Preview</p>
                <ProgressBar percent={progressPercent} size="md" color={editProjectColor} showLabel />
              </div>
            </div>

            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setEditingProject(false)}
                className="px-4 py-2.5 rounded-lg border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveProjectEdit}
                disabled={!editProjectName.trim()}
                className="px-4 py-2.5 rounded-lg bg-brand-gradient disabled:opacity-50 text-white font-medium text-sm transition-opacity hover:opacity-90"
              >
                Save changes
              </button>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div className="min-w-0">
                <h1
                  className="text-xl font-bold text-slate-900 dark:text-slate-100 break-words"
                  title={project.name}
                >{project.name}</h1>
                {project.description && (
                  <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 break-words">{project.description}</p>
                )}
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <ShareButton
                  project={project}
                  isPremium={!!isPremium}
                  onProjectUpdate={(updates) => setProject((prev) => prev ? { ...prev, ...updates } : prev)}
                  onUpgrade={handleUpgrade}
                  upgradeLoading={upgradeLoading}
                />
                <DownloadButton project={project} milestones={milestones} />
                <button
                  onClick={openProjectEdit}
                  className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
                  title="Edit project"
                >
                  <Pencil className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setDeletingProject(true)}
                  className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors"
                  title="Delete project"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-500 dark:text-slate-400">
                  {completedCount} of {milestones.length} milestone{milestones.length !== 1 ? 's' : ''} complete
                </span>
                <span className={`text-2xl font-bold tabular-nums ${progressPercent === 100 ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'}`}>
                  {progressPercent}%
                </span>
              </div>
              <ProgressBar percent={progressPercent} size="md" color={project.progress_color} />
              {progressPercent === 100 && milestones.length > 0 && (
                <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1.5 pt-1">
                  <Flag className="w-4 h-4" />
                  Project complete!
                </p>
              )}
            </div>
          </div>
        )}

        {/* Milestones */}
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Milestones</h2>
            <button
              onClick={() => setAddingNew(true)}
              className="flex items-center gap-1.5 text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 text-sm font-medium transition-colors py-1.5 px-2 -mr-2 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-950 active:bg-brand-100"
            >
              <Plus className="w-4 h-4" />
              <span>Add</span>
            </button>
          </div>

          {(error || toggleError) && (
            <div className="mx-5 sm:mx-6 my-3 flex items-start gap-2.5 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-300 text-sm">{error || toggleError}</p>
            </div>
          )}

          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {milestones.length === 0 && !addingNew && (
              <li className="flex flex-col items-center justify-center py-14 px-6 text-center">
                <div className="w-12 h-12 bg-slate-50 dark:bg-gray-800 border border-slate-100 dark:border-gray-700 rounded-2xl flex items-center justify-center mb-3">
                  <ListChecks className="w-6 h-6 text-slate-400 dark:text-slate-500" />
                </div>
                <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm mb-1">No milestones yet</p>
                <p className="text-slate-400 dark:text-slate-500 text-sm mb-5 max-w-xs">
                  Break your project into steps. Each completed milestone moves the percentage forward.
                </p>
                <button
                  onClick={() => setAddingNew(true)}
                  className="flex items-center gap-2 bg-brand-gradient text-white font-medium px-4 py-2.5 rounded-lg text-sm transition-opacity hover:opacity-90 active:scale-95"
                >
                  <Plus className="w-4 h-4" />
                  Add first milestone
                </button>
              </li>
            )}

            {milestones.map((milestone) => (
              <li key={milestone.id} className="group">
                {editingId === milestone.id ? (
                  <div className="px-5 sm:px-6 py-4 space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <input
                          autoFocus
                          type="text"
                          value={editTitle}
                          onChange={(e) => { setEditTitle(e.target.value); if (editTitleError) setEditTitleError(''); }}
                          onKeyDown={(e) => {
                            if (e.key === 'Escape') { setEditingId(null); setEditTitleError(''); setEditDescError(''); }
                          }}
                          maxLength={LIMITS.milestoneTitle.max}
                          placeholder="Title"
                          className={`flex-1 px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 text-sm ${editTitleError ? 'border-red-400 focus:ring-red-400' : 'border-brand-400 focus:ring-brand-400'}`}
                        />
                        <button
                          onClick={() => saveEdit(milestone.id)}
                          className="p-2 text-brand-600 hover:bg-brand-50 dark:hover:bg-brand-950 rounded-lg transition-colors flex-shrink-0"
                          title="Save"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setEditingId(null); setEditTitleError(''); setEditDescError(''); }}
                          className="p-2 text-slate-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                          title="Cancel"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      {editTitleError && <p className="text-red-500 text-xs mt-1 pl-1">{editTitleError}</p>}
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between mb-1">
                        <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Description <span className="font-normal text-slate-400">(optional)</span></label>
                        <span className={`text-xs tabular-nums ${editDesc.length > LIMITS.milestoneDescription.max ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                          {editDesc.length}/{LIMITS.milestoneDescription.max}
                        </span>
                      </div>
                      <textarea
                        value={editDesc}
                        onChange={(e) => { setEditDesc(e.target.value); if (editDescError) setEditDescError(''); }}
                        rows={2}
                        maxLength={LIMITS.milestoneDescription.max}
                        placeholder="Add more detail…"
                        className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 text-sm resize-none transition ${editDescError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-brand-400'}`}
                      />
                      {editDescError && <p className="text-red-500 text-xs mt-1 pl-1">{editDescError}</p>}
                    </div>
                  </div>
                ) : deletingId === milestone.id ? (
                  <div className="flex items-center justify-between gap-3 px-5 sm:px-6 py-3 bg-red-50 dark:bg-red-950">
                    <p className="text-sm text-slate-700 dark:text-slate-300 min-w-0 truncate">
                      Delete <span className="font-medium">"{milestone.title}"</span>?
                    </p>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={() => setDeletingId(null)}
                        className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-slate-600 dark:text-slate-400 text-xs font-medium hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => deleteMilestone(milestone.id)}
                        className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-medium transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-5 sm:px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <button
                      onClick={() => toggleMilestone(milestone)}
                      className="flex-shrink-0 transition-transform hover:scale-110 active:scale-95 p-0.5 -m-0.5 touch-manipulation mt-0.5"
                      aria-label={milestone.is_complete ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {milestone.is_complete ? (
                        <CheckCircle2 className="w-6 h-6 text-brand-500" />
                      ) : (
                        <Circle className="w-6 h-6 text-slate-300 dark:text-slate-600 hover:text-brand-400 transition-colors" />
                      )}
                    </button>
                    <div className="flex-1 min-w-0">
                      <span
                        className={`block text-sm leading-snug transition-colors ${
                          milestone.is_complete
                            ? 'line-through text-slate-400 dark:text-slate-600'
                            : 'text-slate-800 dark:text-slate-200'
                        }`}
                      >
                        {milestone.title}
                      </span>
                      {milestone.description && (
                        <p className={`text-xs mt-0.5 leading-relaxed break-words ${
                          milestone.is_complete
                            ? 'text-slate-300 dark:text-slate-700'
                            : 'text-slate-400 dark:text-slate-500'
                        }`}>
                          {milestone.description}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity flex-shrink-0">
                      <button
                        onClick={() => { setEditingId(milestone.id); setEditTitle(milestone.title); setEditDesc(milestone.description ?? ''); }}
                        className="p-2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation"
                        aria-label="Edit milestone"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setDeletingId(milestone.id)}
                        className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-950 rounded-lg transition-colors touch-manipulation"
                        aria-label="Delete milestone"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                )}
              </li>
            ))}

            {/* New milestone input */}
            {addingNew && (
              <li className="border-t border-brand-100 dark:border-brand-900 bg-brand-50/50 dark:bg-brand-950/30">
                <div className="px-5 sm:px-6 py-4 space-y-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <Plus className="w-4 h-4 text-brand-400 flex-shrink-0" />
                      <input
                        ref={newInputRef}
                        type="text"
                        value={newTitle}
                        onChange={(e) => { setNewTitle(e.target.value); if (newTitleError) setNewTitleError(''); if (error) setError(''); }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') addMilestone();
                          if (e.key === 'Escape') { setAddingNew(false); setNewTitle(''); setNewDesc(''); setNewTitleError(''); setNewDescError(''); }
                        }}
                        maxLength={LIMITS.milestoneTitle.max}
                        placeholder="Milestone title…"
                        className={`flex-1 bg-white dark:bg-gray-800 px-3 py-2 rounded-lg border text-sm text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 focus:outline-none focus:ring-2 transition ${newTitleError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-brand-400'}`}
                      />
                      <button
                        onClick={addMilestone}
                        disabled={savingNew}
                        className="px-3 py-2 rounded-lg bg-brand-gradient disabled:opacity-60 text-white text-xs font-medium transition-opacity hover:opacity-90 touch-manipulation flex items-center gap-1.5 flex-shrink-0"
                      >
                        {savingNew ? (
                          <>
                            <span className="w-3 h-3 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                            Adding…
                          </>
                        ) : 'Add'}
                      </button>
                      <button
                        onClick={() => { setAddingNew(false); setNewTitle(''); setNewDesc(''); setNewTitleError(''); setNewDescError(''); }}
                        className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors touch-manipulation flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                    {newTitleError && <p className="text-red-500 text-xs mt-1 pl-6">{newTitleError}</p>}
                  </div>
                  <div className="pl-6">
                    <div className="flex items-baseline justify-between mb-1">
                      <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Description <span className="font-normal text-slate-400">(optional)</span></label>
                      <span className={`text-xs tabular-nums ${newDesc.length > LIMITS.milestoneDescription.max ? 'text-red-500' : 'text-slate-400 dark:text-slate-500'}`}>
                        {newDesc.length}/{LIMITS.milestoneDescription.max}
                      </span>
                    </div>
                    <textarea
                      value={newDesc}
                      onChange={(e) => { setNewDesc(e.target.value); if (newDescError) setNewDescError(''); }}
                      rows={2}
                      maxLength={LIMITS.milestoneDescription.max}
                      placeholder="Add more detail…"
                      className={`w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 text-sm resize-none transition ${newDescError ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 dark:border-gray-600 focus:ring-brand-400'}`}
                    />
                    {newDescError && <p className="text-red-500 text-xs mt-1">{newDescError}</p>}
                  </div>
                </div>
              </li>
            )}
          </ul>
        </div>
      </main>

      {/* Completion celebration */}
      {showCelebration && (
        <CompletionCelebration
          projectId={projectId}
          onDone={() => setShowCelebration(false)}
        />
      )}

      {/* Delete project confirmation modal */}
      {deletingProject && (
        <div className="fixed inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-xl dark:shadow-gray-950 w-full max-w-sm p-6 border border-transparent dark:border-gray-800">
            <div className="w-10 h-10 bg-red-100 dark:bg-red-950 rounded-xl flex items-center justify-center mb-4">
              <Trash2 className="w-5 h-5 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100 mb-1">Delete project?</h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm mb-6">
              This will permanently delete <span className="font-medium text-slate-700 dark:text-slate-300">"{project.name}"</span> and all its milestones. This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setDeletingProject(false)}
                disabled={deletingProjectLoading}
                className="flex-1 px-4 py-3 rounded-xl border border-gray-300 dark:border-gray-600 text-slate-700 dark:text-slate-300 font-medium text-sm hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={deleteProject}
                disabled={deletingProjectLoading}
                className="flex-1 px-4 py-3 rounded-xl bg-red-600 hover:bg-red-700 text-white font-medium text-sm transition-colors disabled:opacity-70 flex items-center justify-center gap-2"
              >
                {deletingProjectLoading ? (
                  <>
                    <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Deleting…
                  </>
                ) : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectDetail;
