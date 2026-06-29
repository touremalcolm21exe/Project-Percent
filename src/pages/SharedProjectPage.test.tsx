import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SharedProjectPage } from './SharedProjectPage';

vi.mock('../lib/shareProject', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/shareProject')>();
  return {
    ...actual,
    fetchSharedProject: vi.fn(),
  };
});

import { fetchSharedProject } from '../lib/shareProject';

const VALID_PUBLIC_ID = 'a1b2c3d4-e5f6-4789-a012-3456789abcde';

function renderPage(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/share/:publicProjectId" element={<SharedProjectPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('SharedProjectPage public loading', () => {
  beforeEach(() => {
    vi.mocked(fetchSharedProject).mockReset();
  });

  it('loads and displays a shared project', async () => {
    vi.mocked(fetchSharedProject).mockResolvedValue({
      name: 'Roadmap',
      description: 'Public milestone tracker',
      progress_percent: 0,
      progress_color: null,
      updated_at: '2026-06-29T12:00:00.000Z',
      milestones: [],
      show_branding: false,
    });

    renderPage(`/share/${VALID_PUBLIC_ID}`);

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: 'Roadmap' })).toBeInTheDocument();
    });
    expect(fetchSharedProject).toHaveBeenCalledWith(VALID_PUBLIC_ID);
    expect(screen.getByText('View only')).toBeInTheDocument();
  });

  it('shows not found when the shared project cannot be loaded', async () => {
    vi.mocked(fetchSharedProject).mockResolvedValue(null);

    renderPage(`/share/${VALID_PUBLIC_ID}`);

    await waitFor(() => {
      expect(screen.getByText('Project not found')).toBeInTheDocument();
    });
  });
});
