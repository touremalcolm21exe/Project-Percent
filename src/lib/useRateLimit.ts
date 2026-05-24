import { useState, useRef, useCallback } from 'react';

interface RateLimitConfig {
  /** Max *failed* attempts before lockout triggers. */
  maxFailures: number;
  /** Lock-out duration in milliseconds once the failure limit is hit. */
  lockoutMs: number;
  /** Sliding window for counting failures (ms). Failures older than this are forgotten. */
  windowMs: number;
}

interface RateLimitState {
  /** True when the caller is locked out and must not submit. */
  isLocked: boolean;
  /** Seconds remaining in the current lockout (0 when not locked). */
  secondsLeft: number;
  /** Human-readable message to show the user when locked. */
  lockoutMessage: string;
  /**
   * Call this before submitting to check whether the form is currently locked.
   * Returns true if submission is allowed, false if locked.
   * Does NOT count as a failure — call recordFailure() only when the server
   * rejects the attempt.
   */
  canSubmit: () => boolean;
  /**
   * Call this after a confirmed authentication failure.
   * Increments the failure counter; triggers lockout when the limit is reached.
   */
  recordFailure: () => void;
  /** Reset all state (e.g. on successful login or when the view changes). */
  reset: () => void;
}

/**
 * In-memory sliding-window lockout tracker for auth forms.
 *
 * Lockout is driven by *failures*, not submission attempts, so a successful
 * login never counts against the user. The lockout countdown is shown live
 * so the user knows exactly when they can try again.
 *
 * This is a UX-layer safeguard; server-side enforcement is the real line of
 * defense. A page refresh clears this state, which is acceptable — the point
 * is to slow down casual brute-force in the same browser session.
 */
export function useRateLimit(config: RateLimitConfig): RateLimitState {
  const { maxFailures, lockoutMs, windowMs } = config;

  const failuresRef = useRef<number[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [isLocked, setIsLocked] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(0);

  function startLockout(durationMs: number) {
    setIsLocked(true);
    const unlockAt = Date.now() + durationMs;

    function tick() {
      const remaining = Math.ceil((unlockAt - Date.now()) / 1000);
      if (remaining <= 0) {
        setIsLocked(false);
        setSecondsLeft(0);
        failuresRef.current = [];
        if (timerRef.current) clearInterval(timerRef.current);
      } else {
        setSecondsLeft(remaining);
      }
    }

    tick();
    timerRef.current = setInterval(tick, 500);
  }

  const canSubmit = useCallback((): boolean => {
    return !isLocked;
  }, [isLocked]);

  const recordFailure = useCallback(() => {
    if (isLocked) return;

    const now = Date.now();
    // Prune failures outside the sliding window.
    failuresRef.current = failuresRef.current.filter((t) => now - t < windowMs);
    failuresRef.current.push(now);

    if (failuresRef.current.length >= maxFailures) {
      startLockout(lockoutMs);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLocked, maxFailures, lockoutMs, windowMs]);

  const reset = useCallback(() => {
    failuresRef.current = [];
    if (timerRef.current) clearInterval(timerRef.current);
    setIsLocked(false);
    setSecondsLeft(0);
  }, []);

  const lockoutMessage = isLocked
    ? `Too many failed attempts. Please wait ${secondsLeft}s before trying again.`
    : '';

  return { isLocked, secondsLeft, lockoutMessage, canSubmit, recordFailure, reset };
}
