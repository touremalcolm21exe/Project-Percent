/** Free tier: one active project. */
export const FREE_PROJECT_LIMIT = 1;

/** Paid tiers (Monthly, Founder Deal): max active projects. */
export const PAID_PROJECT_LIMIT = 500;

export type PlanTier = 'free' | 'premium';

/**
 * Paid tiers (Monthly subscription, Founder Deal) are stored as `premium` in user_profiles.
 */
export function isPaidPlan(plan: PlanTier | string | null | undefined): boolean {
  return plan === 'premium';
}

export function freeProjectLimitReached(activeProjectCount: number): boolean {
  return activeProjectCount >= FREE_PROJECT_LIMIT;
}

export function paidProjectLimitReached(activeProjectCount: number): boolean {
  return activeProjectCount >= PAID_PROJECT_LIMIT;
}

export function projectLimitReached(
  plan: PlanTier | string | null | undefined,
  activeProjectCount: number,
): boolean {
  return isPaidPlan(plan)
    ? paidProjectLimitReached(activeProjectCount)
    : freeProjectLimitReached(activeProjectCount);
}

/** All tiers include public share links per project. */
export function canUseShareLinks(_plan?: PlanTier | string | null): boolean {
  return true;
}

export function projectLimitLabel(plan: PlanTier | string | null | undefined): string {
  return isPaidPlan(plan) ? `Up to ${PAID_PROJECT_LIMIT} projects` : '1 project';
}

export function maxProjectsForPlan(plan: PlanTier | string | null | undefined): number {
  return isPaidPlan(plan) ? PAID_PROJECT_LIMIT : FREE_PROJECT_LIMIT;
}
