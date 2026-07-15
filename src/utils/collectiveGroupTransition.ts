/** Snapshot of a challenge document fed into the transition computation. */
export type GroupTransitionInput = {
  status: string;
  groupCurrentTotal: number;
  groupCumulativeTarget: number;
  autoCompleteOnGroupTarget: boolean;
};

/** What the Firestore transaction must write, derived from a pure computation. */
export type GroupTransitionResult = {
  isAlreadyCompleted: boolean;
  clampedTotal: number;
  shouldComplete: boolean;
};

/**
 * Pure, side-effect-free computation — extracted for deterministic testing.
 *
 * Given the current challenge state and a new log delta, returns what the
 * transaction should write:
 *
 *   isAlreadyCompleted — challenge is already done; transaction must exit without writes.
 *   clampedTotal       — groupCurrentTotal = min(current + delta, target). Never exceeds target.
 *   shouldComplete     — true if this increment crosses the threshold (exactly-once gate).
 */
export function computeGroupTransition(
  input: GroupTransitionInput,
  delta: number,
): GroupTransitionResult {
  if (input.status === 'completed') {
    return { isAlreadyCompleted: true, clampedTotal: input.groupCurrentTotal, shouldComplete: false };
  }

  const rawPrev = Number(input.groupCurrentTotal ?? 0);
  const prevTotal = Number.isFinite(rawPrev) ? rawPrev : 0;
  const newTotal = prevTotal + delta;
  const target = Number(input.groupCumulativeTarget ?? 0);
  const clampedTotal = target > 0 ? Math.min(newTotal, target) : newTotal;
  const autoComplete = input.autoCompleteOnGroupTarget ?? true;
  const shouldComplete = autoComplete && target > 0 && newTotal >= target;

  return { isAlreadyCompleted: false, clampedTotal, shouldComplete };
}
