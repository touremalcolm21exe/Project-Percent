import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ShareProjectView } from './ShareProjectView';
import type { SharedProject } from '../lib/shareProject';

const sampleProject: SharedProject = {
  name: 'Website Redesign',
  description: 'Client-facing progress tracker',
  progress_percent: 33,
  progress_color: null,
  updated_at: '2026-06-29T12:00:00.000Z',
  milestones: [
    { title: 'Wireframes', description: 'Homepage layout', is_complete: true },
    { title: 'Development', description: '', is_complete: false },
    { title: 'Launch', description: '', is_complete: false },
  ],
  show_branding: false,
};

function renderView(project: SharedProject = sampleProject) {
  return render(
    <MemoryRouter>
      <ShareProjectView project={project} />
    </MemoryRouter>,
  );
}

describe('ShareProjectView read-only access', () => {
  it('renders project content without editable controls', () => {
    renderView();

    expect(screen.getByRole('heading', { level: 1, name: 'Website Redesign' })).toBeInTheDocument();
    expect(screen.getByText('View only')).toBeInTheDocument();
    expect(screen.getByLabelText('Shared project (read-only)')).toBeInTheDocument();
    expect(screen.getByLabelText('Task list (read-only)')).toBeInTheDocument();
    expect(screen.getByText('Wireframes')).toBeInTheDocument();
    expect(screen.getByText('33%')).toBeInTheDocument();

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
    expect(document.querySelector('[data-readonly="true"]')).toBeTruthy();
  });

  it('shows free-tier branding footer when show_branding is true', () => {
    renderView({ ...sampleProject, show_branding: true });

    expect(screen.getByRole('link', { name: 'Made with Project Percent' })).toHaveAttribute('href', '/');
  });

  it('hides branding footer for paid-tier projects', () => {
    renderView({ ...sampleProject, show_branding: false });

    expect(screen.queryByText('Made with Project Percent')).not.toBeInTheDocument();
  });
});
