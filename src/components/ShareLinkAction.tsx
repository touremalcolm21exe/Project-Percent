import { useState } from 'react';
import { Share2, Check, Loader2 } from 'lucide-react';
import { copyToClipboard, getOrCreateShareUrl } from '../lib/shareProject';
import type { Project } from '../lib/database.types';

interface ShareLinkActionProps {
  project: Pick<Project, 'id' | 'is_public' | 'public_id' | 'name'>;
  onProjectUpdate?: (projectId: string, updates: Partial<Project>) => void;
  /** Compact text link style for dashboard rows */
  variant?: 'button' | 'link';
}

export function ShareLinkAction({
  project,
  onProjectUpdate,
  variant = 'link',
}: ShareLinkActionProps) {
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [manualUrl, setManualUrl] = useState<string | null>(null);
  const [error, setError] = useState('');

  async function handleShareLink(e: React.MouseEvent) {
    e.stopPropagation();
    e.preventDefault();
    setError('');
    setManualUrl(null);

    setLoading(true);
    const { url, publicProjectId, enabledSharing, error: shareError } = await getOrCreateShareUrl(project);
    setLoading(false);

    if (shareError || !url) {
      setError(shareError ?? 'Could not get share link.');
      return;
    }

    if (enabledSharing && publicProjectId) {
      onProjectUpdate?.(project.id, { is_public: true, public_id: publicProjectId });
    }

    const didCopy = await copyToClipboard(url);
    if (didCopy) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      setManualUrl(url);
    }
  }

  const label = copied ? 'Copied!' : loading ? 'Sharing…' : 'Share';

  const buttonClassName =
    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-colors disabled:opacity-60 ' +
    (variant === 'button'
      ? 'border-brand-200 dark:border-brand-800 bg-brand-50 dark:bg-brand-950 text-brand-700 dark:text-brand-300 hover:bg-brand-100 dark:hover:bg-brand-900 shadow-sm'
      : 'border-transparent text-brand-600 dark:text-brand-400 hover:text-brand-700 dark:hover:text-brand-300 hover:underline');

  return (
    <div className="relative inline-flex flex-col items-start">
      <button
        type="button"
        onClick={(e) => void handleShareLink(e)}
        disabled={loading}
        className={buttonClassName}
        title={`Share link for ${project.name}`}
        aria-label={`Share ${project.name}`}
      >
        {loading ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : copied ? (
          <Check className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <Share2 className="w-3.5 h-3.5" />
        )}
        {label}
      </button>
      {error && <span className="text-[10px] text-red-500 mt-0.5">{error}</span>}
      {manualUrl && (
        <div className="mt-1 w-full max-w-xs">
          <p className="text-[10px] text-slate-500 dark:text-slate-400 mb-0.5">Copy manually:</p>
          <input
            readOnly
            value={manualUrl}
            onClick={(e) => e.stopPropagation()}
            className="w-full px-2 py-1 rounded border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-[10px] text-slate-700 dark:text-slate-300"
          />
        </div>
      )}
    </div>
  );
}
