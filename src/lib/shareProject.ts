import { supabase } from './supabase';

/** Fields exposed on the public read-only share page. */
export interface SharedMilestone {
  title: string;
  description: string;
  is_complete: boolean;
}

export interface SharedProject {
  name: string;
  description: string;
  progress_percent: number;
  progress_color: string | null;
  updated_at: string;
  milestones: SharedMilestone[];
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidPublicProjectId(value: string): boolean {
  return UUID_RE.test(value);
}

export function buildShareUrl(publicProjectId: string): string {
  return `${window.location.origin}/share/${publicProjectId}`;
}

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function asBool(value: unknown): boolean {
  return value === true;
}

function asNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Strip any unexpected RPC fields before they reach the UI. */
export function parseSharedProject(payload: unknown): SharedProject | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const record = payload as Record<string, unknown>;
  const rawMilestones = Array.isArray(record.milestones) ? record.milestones : [];

  const milestones: SharedMilestone[] = rawMilestones
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const m = item as Record<string, unknown>;
      return {
        title: asString(m.title),
        description: asString(m.description),
        is_complete: asBool(m.is_complete),
      };
    })
    .filter((m): m is SharedMilestone => m !== null);

  const name = asString(record.name);
  if (!name) {
    return null;
  }

  return {
    name,
    description: asString(record.description),
    progress_percent: Math.min(100, Math.max(0, Math.round(asNumber(record.progress_percent)))),
    progress_color: typeof record.progress_color === 'string' ? record.progress_color : null,
    updated_at: asString(record.updated_at, new Date().toISOString()),
    milestones,
  };
}

/**
 * Load a project by its public UUID for read-only display.
 * Uses the get_shared_project RPC — no direct table access, no auth required.
 */
export async function fetchSharedProject(publicProjectId: string): Promise<SharedProject | null> {
  if (!isValidPublicProjectId(publicProjectId)) {
    return null;
  }

  const { data, error } = await supabase.rpc('get_shared_project', {
    p_public_id: publicProjectId,
  });

  if (error || !data) {
    return null;
  }

  return parseSharedProject(data);
}

export async function setProjectSharing(
  projectId: string,
  isPublic: boolean,
): Promise<{ publicProjectId: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('set_project_sharing', {
    p_project_id: projectId,
    p_is_public: isPublic,
  });

  if (error) {
    const message = error.message || 'Could not update sharing settings.';
    if (message.includes('Premium plan required')) {
      return { publicProjectId: null, error: 'Public sharing is a Premium feature.' };
    }
    return { publicProjectId: null, error: message };
  }

  return { publicProjectId: data ?? null, error: null };
}
