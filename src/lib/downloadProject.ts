import { supabase } from './supabase';
import type { Project, Milestone } from './database.types';

interface ProjectExport {
  name: string;
  description: string;
  progress_percent: number;
  progress_color: string | null;
  exported_at: string;
  milestones: Array<{
    title: string;
    description: string;
    status: 'complete' | 'incomplete';
  }>;
}

function toSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function buildCsv(project: Project, milestones: Milestone[]): string {
  const rows: string[] = [
    `"Project","${project.name.replace(/"/g, '""')}"`,
    `"Description","${(project.description ?? '').replace(/"/g, '""')}"`,
    `"Progress","${project.progress_percent}%"`,
    `"Progress Color","${project.progress_color ?? 'auto'}"`,
    `"Exported At","${new Date().toISOString()}"`,
    ``,
    `"Milestone","Description","Status"`,
    ...milestones.map(
      (m) => `"${m.title.replace(/"/g, '""')}","${(m.description ?? '').replace(/"/g, '""')}","${m.is_complete ? 'Complete' : 'Incomplete'}"`
    ),
  ];
  return rows.join('\n');
}

function buildJson(project: Project, milestones: Milestone[]): string {
  const payload: ProjectExport = {
    name: project.name,
    description: project.description ?? '',
    progress_percent: project.progress_percent,
    progress_color: project.progress_color,
    exported_at: new Date().toISOString(),
    milestones: milestones.map((m) => ({
      title: m.title,
      description: m.description ?? '',
      status: m.is_complete ? 'complete' : 'incomplete',
    })),
  };
  return JSON.stringify(payload, null, 2);
}

function triggerDownload(content: string, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Defer revocation so the browser has time to start reading the blob
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export async function downloadProject(
  project: Project,
  format: 'csv' | 'json',
  cachedMilestones?: Milestone[]
): Promise<void> {
  let milestones: Milestone[];

  if (cachedMilestones) {
    milestones = cachedMilestones;
  } else {
    const { data } = await supabase
      .from('milestones')
      .select('*')
      .eq('project_id', project.id)
      .is('deleted_at', null)
      .order('created_at', { ascending: true });
    milestones = data ?? [];
  }

  const slug = toSlug(project.name) || 'project';

  if (format === 'csv') {
    triggerDownload(buildCsv(project, milestones), `${slug}.csv`, 'text/csv;charset=utf-8;');
  } else {
    triggerDownload(buildJson(project, milestones), `${slug}.json`, 'application/json');
  }
}
