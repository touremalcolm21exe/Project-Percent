import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  buildShareUrl,
  calcEqualWeightCompletion,
  fetchSharedProject,
  getOrCreateShareUrl,
  isValidPublicProjectId,
  parseSharedProject,
} from './shareProject';

vi.mock('./supabase', () => ({
  supabase: {
    rpc: vi.fn(),
  },
}));

import { supabase } from './supabase';

const VALID_PUBLIC_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

const sampleRpcPayload = {
  name: 'Launch App',
  description: 'Q2 roadmap',
  progress_percent: 50,
  progress_color: '#336699',
  updated_at: '2026-06-29T12:00:00.000Z',
  show_branding: true,
  milestones: [
    { title: 'Design', description: '', is_complete: true },
    { title: 'Build', description: '', is_complete: false },
  ],
};

describe('shareProject', () => {
  beforeEach(() => {
    vi.mocked(supabase.rpc).mockReset();
    vi.stubGlobal('window', { location: { origin: 'https://projectpercent.app' } });
  });

  describe('share URL generation', () => {
    it('buildShareUrl uses the current origin and public id', () => {
      expect(buildShareUrl(VALID_PUBLIC_ID)).toBe(
        `https://projectpercent.app/share/${VALID_PUBLIC_ID}`,
      );
    });

    it('isValidPublicProjectId accepts well-formed UUIDs', () => {
      expect(isValidPublicProjectId(VALID_PUBLIC_ID)).toBe(true);
    });

    it('isValidPublicProjectId rejects malformed values', () => {
      expect(isValidPublicProjectId('not-a-uuid')).toBe(false);
      expect(isValidPublicProjectId('')).toBe(false);
    });

    it('getOrCreateShareUrl returns an existing public link without calling RPC', async () => {
      const result = await getOrCreateShareUrl({
        id: 'project-internal-id',
        is_public: true,
        public_id: VALID_PUBLIC_ID,
      });

      expect(result).toEqual({
        url: buildShareUrl(VALID_PUBLIC_ID),
        publicProjectId: VALID_PUBLIC_ID,
        enabledSharing: false,
        error: null,
      });
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('getOrCreateShareUrl enables sharing when the project is not yet public', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: VALID_PUBLIC_ID, error: null });

      const result = await getOrCreateShareUrl({
        id: 'project-internal-id',
        is_public: false,
        public_id: null,
      });

      expect(supabase.rpc).toHaveBeenCalledWith('set_project_sharing', {
        p_project_id: 'project-internal-id',
        p_is_public: true,
      });
      expect(result).toEqual({
        url: buildShareUrl(VALID_PUBLIC_ID),
        publicProjectId: VALID_PUBLIC_ID,
        enabledSharing: true,
        error: null,
      });
    });

    it('getOrCreateShareUrl surfaces RPC errors', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Not allowed', name: 'PostgrestError', details: '', hint: '', code: '' },
      });

      const result = await getOrCreateShareUrl({
        id: 'project-internal-id',
        is_public: false,
        public_id: null,
      });

      expect(result.url).toBeNull();
      expect(result.error).toBe('Not allowed');
    });
  });

  describe('public project loading', () => {
    it('parseSharedProject normalizes RPC payload and ignores extra fields', () => {
      const parsed = parseSharedProject({
        ...sampleRpcPayload,
        user_id: 'secret-user',
        id: 'secret-project',
      });

      expect(parsed).toEqual({
        name: 'Launch App',
        description: 'Q2 roadmap',
        progress_percent: 50,
        progress_color: '#336699',
        updated_at: '2026-06-29T12:00:00.000Z',
        show_branding: true,
        milestones: [
          { title: 'Design', description: '', is_complete: true },
          { title: 'Build', description: '', is_complete: false },
        ],
      });
      expect(calcEqualWeightCompletion(parsed!.milestones)).toBe(50);
    });

    it('parseSharedProject returns null when name is missing', () => {
      expect(parseSharedProject({ milestones: [] })).toBeNull();
    });

    it('fetchSharedProject loads via get_shared_project RPC', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({ data: sampleRpcPayload, error: null });

      const project = await fetchSharedProject(VALID_PUBLIC_ID);

      expect(supabase.rpc).toHaveBeenCalledWith('get_shared_project', {
        p_public_id: VALID_PUBLIC_ID,
      });
      expect(project?.name).toBe('Launch App');
      expect(project?.show_branding).toBe(true);
    });

    it('fetchSharedProject returns null for invalid public ids', async () => {
      expect(await fetchSharedProject('bad-token')).toBeNull();
      expect(supabase.rpc).not.toHaveBeenCalled();
    });

    it('fetchSharedProject returns null when RPC fails', async () => {
      vi.mocked(supabase.rpc).mockResolvedValue({
        data: null,
        error: { message: 'Not found', name: 'PostgrestError', details: '', hint: '', code: '' },
      });

      expect(await fetchSharedProject(VALID_PUBLIC_ID)).toBeNull();
    });
  });
});
