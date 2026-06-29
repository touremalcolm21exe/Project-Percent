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

export function buildShareUrl(shareToken: string): string {
  return `${window.location.origin}/share/${shareToken}`;
}

export async function fetchSharedProject(token: string): Promise<SharedProject | null> {
  const { data, error } = await supabase.rpc('get_shared_project', {
    p_share_token: token,
  });

  if (error || !data) {
    return null;
  }

  return data as unknown as SharedProject;
}

export async function setProjectSharing(
  projectId: string,
  isPublic: boolean,
): Promise<{ shareToken: string | null; error: string | null }> {
  const { data, error } = await supabase.rpc('set_project_sharing', {
    p_project_id: projectId,
    p_is_public: isPublic,
  });

  if (error) {
    const message = error.message || 'Could not update sharing settings.';
    if (message.includes('Premium plan required')) {
      return { shareToken: null, error: 'Public sharing is a Premium feature.' };
    }
    return { shareToken: null, error: message };
  }

  return { shareToken: data ?? null, error: null };
}
