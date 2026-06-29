import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import { ShareProjectView } from '../components/ShareProjectView';
import { fetchSharedProject, type SharedProject } from '../lib/shareProject';

/**
 * Public share page — fetch-only. No create/update/delete calls are made here.
 */
export function SharedProjectPage() {
  const { publicProjectId } = useParams<{ publicProjectId: string }>();
  const [project, setProject] = useState<SharedProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!publicProjectId) {
      setNotFound(true);
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function load() {
      setLoading(true);
      const data = await fetchSharedProject(publicProjectId);
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
  }, [publicProjectId]);

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

  return <ShareProjectView project={project} />;
}
