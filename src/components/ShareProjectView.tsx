import { CheckCircle2, Circle, Flag, Eye, ListChecks } from 'lucide-react';
import { Link } from 'react-router-dom';
import ProgressBar from './ProgressBar';
import { calcEqualWeightCompletion, type SharedProject } from '../lib/shareProject';

interface ShareProjectViewProps {
  project: SharedProject;
}

/**
 * Read-only public project view. Intentionally contains no inputs, buttons,
 * forms, or mutation handlers — viewers cannot edit tasks or project data.
 */
export function ShareProjectView({ project }: ShareProjectViewProps) {
  const tasks = project.milestones;
  const completedCount = tasks.filter((t) => t.is_complete).length;
  const completionPercent = calcEqualWeightCompletion(tasks);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col" data-readonly="true">
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 h-16 flex items-center gap-3">
          <img src="/ProgressPercentLogo copy copy.png" alt="" className="w-6 h-6 object-contain flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
              Shared project
            </p>
            <p className="font-semibold text-slate-900 dark:text-slate-100 truncate" title={project.name}>
              {project.name}
            </p>
          </div>
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 px-2.5 py-1 rounded-full flex-shrink-0">
            <Eye className="w-3.5 h-3.5" aria-hidden="true" />
            View only
          </span>
        </div>
      </header>

      <main
        className="flex-1 max-w-3xl mx-auto px-4 sm:px-6 py-8 space-y-6 w-full"
        aria-label="Shared project (read-only)"
      >
        <section
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6"
          aria-readonly="true"
        >
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 break-words">{project.name}</h1>
          {project.description && (
            <p className="text-slate-500 dark:text-slate-400 text-sm mt-2 break-words">{project.description}</p>
          )}

          <div className="mt-6 space-y-2">
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-slate-500 dark:text-slate-400">
                {completedCount} of {tasks.length} task{tasks.length !== 1 ? 's' : ''} complete
              </span>
              <span
                className={`text-3xl font-bold tabular-nums ${
                  completionPercent === 100 ? 'text-emerald-500' : 'text-slate-900 dark:text-slate-100'
                }`}
                role="status"
                aria-label={`${completionPercent} percent complete`}
              >
                {completionPercent}%
              </span>
            </div>
            <ProgressBar percent={completionPercent} size="md" color={project.progress_color} />
            {completionPercent === 100 && tasks.length > 0 && (
              <p className="text-emerald-600 dark:text-emerald-400 text-sm font-medium flex items-center gap-1.5 pt-1">
                <Flag className="w-4 h-4" aria-hidden="true" />
                Project complete!
              </p>
            )}
          </div>
        </section>

        <section
          className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden"
          aria-readonly="true"
          aria-label="Task list (read-only)"
        >
          <div className="flex items-center gap-2 px-5 sm:px-6 py-4 border-b border-gray-100 dark:border-gray-800">
            <ListChecks className="w-4 h-4 text-slate-400" aria-hidden="true" />
            <h2 className="font-semibold text-slate-900 dark:text-slate-100">Tasks</h2>
          </div>

          {tasks.length === 0 ? (
            <p className="px-5 sm:px-6 py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No tasks yet.
            </p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800" role="list">
              {tasks.map((task, index) => (
                <li
                  key={`${task.title}-${index}`}
                  className="px-5 sm:px-6 py-4 flex items-start gap-3 cursor-default"
                  aria-readonly="true"
                >
                  <span className="flex-shrink-0 mt-0.5 pointer-events-none select-none" aria-hidden="true">
                    {task.is_complete ? (
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    ) : (
                      <Circle className="w-5 h-5 text-slate-300 dark:text-slate-600" />
                    )}
                  </span>
                  <div className="min-w-0">
                    <p
                      className={`font-medium break-words ${
                        task.is_complete
                          ? 'text-slate-400 dark:text-slate-500 line-through'
                          : 'text-slate-900 dark:text-slate-100'
                      }`}
                    >
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 break-words">{task.description}</p>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <p className="text-center text-xs text-slate-400 dark:text-slate-500">
          Last updated {new Date(project.updated_at).toLocaleString()} · View-only link
        </p>
      </main>

      {project.show_branding && (
        <footer className="py-6 text-center">
          <Link
            to="/"
            className="text-xs text-slate-400 dark:text-slate-500 hover:text-brand-600 dark:hover:text-brand-400 transition-colors"
          >
            Made with Project Percent
          </Link>
        </footer>
      )}
    </div>
  );
}
