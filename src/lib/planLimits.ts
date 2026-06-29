/** Free tier: one active project. */
export const FREE_PROJECT_LIMIT = 1;

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

/** All tiers include public share links per project. */
export function canUseShareLinks(_plan?: PlanTier | string | null): boolean {
  return true;
}

export function projectLimitLabel(plan: PlanTier | string | null | undefined): string {
  return isPaidPlan(plan) ? 'Unlimited projects' : '1 project';
}
