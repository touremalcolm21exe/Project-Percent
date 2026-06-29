import { supabase } from './supabase';

export interface SharedMilestone {
  title: string;
  description: string;
  is_complete: boolean;
  created_at: string;
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

  return data as unknown as SharedProject;
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
