// Mirrors the CHECK constraints in add_input_validation_constraints migration.
// Keep limits in sync with the DB constraints.

export const LIMITS = {
  projectName: { min: 1, max: 50 },
  projectDescription: { max: 100 },
  milestoneTitle: { min: 1, max: 200 },
  milestoneDescription: { max: 300 },
} as const;

// Valid hex colors accepted by the progress_color column.
const HEX_COLOR_RE = /^#[0-9a-f]{6}$/;

export function validateProjectName(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Project name is required.';
  if (trimmed.length > LIMITS.projectName.max)
    return `Project name must be ${LIMITS.projectName.max} characters or fewer.`;
  return '';
}

export function validateProjectDescription(value: string): string {
  if (value.length > LIMITS.projectDescription.max)
    return `Description must be ${LIMITS.projectDescription.max} characters or fewer.`;
  return '';
}

export function validateProgressColor(value: string | null): string {
  if (value === null) return '';
  if (!HEX_COLOR_RE.test(value))
    return 'Color must be a valid hex value (e.g. #14b8a6).';
  return '';
}

export function validateMilestoneTitle(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length === 0) return 'Milestone title is required.';
  if (trimmed.length > LIMITS.milestoneTitle.max)
    return `Milestone title must be ${LIMITS.milestoneTitle.max} characters or fewer.`;
  return '';
}

export function validateMilestoneDescription(value: string): string {
  if (value.length > LIMITS.milestoneDescription.max)
    return `Description must be ${LIMITS.milestoneDescription.max} characters or fewer.`;
  return '';
}
