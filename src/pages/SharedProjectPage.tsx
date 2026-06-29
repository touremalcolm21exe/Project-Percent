import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { CheckCircle2, Circle, Flag, ListChecks, AlertCircle } from 'lucide-react';
import ProgressBar from '../components/ProgressBar';
import { fetchSharedProject, type SharedProject } from '../lib/shareProject';

function calcPercent(milestones: SharedProject['milestones']): number {
  if (milestones.length === 0) return 0;
  const complete = milestones.filter((m) => m.is_complete).length;
  return Math.round((complete / milestones.length) * 100);
}

export function SharedProjectPage() {
  const { token } = useParams<{ token: string }>();
  const [project, setProject] = useState<SharedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await fetchSharedProject(token!);
      if (cancelled) return;

      if (!data) {
        setNotFound(true);
        setProject(null);
      } else {
        setProject(data);
        setNotFound(false);
      }
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-brand-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (notFound || !project) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="w-10 h-10 text-slate-400" />
        <div>
          <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Project not found</h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-1">
            This link may be invalid, disabled, or the project may have been removed.
          </p>
        </div>
        <Link
          to="/"
          className="text-brand-600 dark:text-brand-400 font-medium hover:underline text-sm"
        >
          Go to Project Percent
        </Link>
      </div>
    );
  }

  const completedCount = project.milestones.filter((m) => m.is_complete).length;
  const progressPercent = calcPercent(project.milestones);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <img src="/ProgressPercentLogo copy copy.png" alt="" className="w-6 h-6 object-contain flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Shared project
            </p>
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={project.name}>
              {project.name}
            </p>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6">
        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6">
          <div className="mb-4">
            <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100 break-words">{project.name}</h1>
            {project.description && (
              <p className="text-slate-500 dark:text-slate-400 text-sm mt-1 break-words">{project.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {completedCount} of {project.milestones.length} milestone{project.milestones.length !== 1 ? 's' : ''} complete
              </span>
              <span className={`text-2xl font-bold tabular-nums ${progressPercent === 100 ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'}`}>
                {progressPercent}%
              </span>
            </div>
            <ProgressBar percent={progressPercent} size="md" color={project.progress_color} />
            {progressPercent === 100 && project.milestones.length > 0 && (
              <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1.5 pt-1">
                <Flag className="w-4 h-4" />
                Project complete!
              </p>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="flex items-center gap-2 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <ListChecks className="w-4 h-4 text-slate-400" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Milestones</h2>
          </div>

          {project.milestones.length === 0 ? (
            <div className="px-5 sm:px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No milestones yet.
            </div>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {project.milestones.map((milestone, index) => (
                <li key={`${milestone.title}-${index}`} className="px-5 sm:px-6 py-4 flex items-start gap-3">
                  {milestone.is_complete ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600 flex-shrink-0 mt-0.5" />
                  )}
                  <div className="min-w-0">
                    <p className={`font-medium break-words ${milestone.is_complete ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-900 dark:text-slate-100'}`}>
                      {milestone.title}
                    </p>
                    {milestone.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 break-words">{milestone.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Last updated {new Date(project.updated_at).toLocaleString()}
        </p>
      </main>
    </div>
  );
}
