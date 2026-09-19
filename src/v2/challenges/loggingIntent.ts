/**
 * CORR-001 — S3b submission-intent / idempotency-key model (pure, React-free).
 *
 * One idempotency key represents ONE immutable submission intent: the exact
 * activity facts submitted under it. Semantics enforced here and mirrored
 * by the server's key binding (`isSameSubmissionPayload`):
 *
 * - Same unchanged intent retried after a retryable infrastructure failure:
 *   SAME key (safe replay; the server converges without a duplicate).
 * - Exact replay of the same submitted intent: SAME key where replay is
 *   intended.
 * - Participant changes activity choice, amount, or occurrence time after
 *   an attempt: NEW key before submission.
 * - Governed rejection followed by corrected facts: NEW key.
 * - An already accepted intent must not silently mutate under the old key:
 *   changed facts always mint a new key; the accepted record is untouched.
 *
 * The component keeps ONE draft key plus the last attempt's
 * (key, facts). Key rotation is derived at submit time from fact equality —
 * not scattered across change handlers — so every submit path (submit,
 * retry, resubmit-after-edit) obeys the same rule.
 */

export interface LoggingFacts {
  canonicalKey: string;
  activityVariant: string | null;
  activityKind: 'fitness' | 'wellness';
  value: number;
  unit: string;
  /** Canonical occurrence instant (ISO string of the submitted Date). */
  occurredAtISO: string;
}

export interface LoggingAttempt {
  key: string;
  facts: LoggingFacts;
}

export function loggingFactsEqual(a: LoggingFacts, b: LoggingFacts): boolean {
  if (a.canonicalKey !== b.canonicalKey) return false;
  if ((a.activityVariant ?? null) !== (b.activityVariant ?? null)) return false;
  if (a.activityKind !== b.activityKind) return false;
  if (a.value !== b.value) return false;
  if (a.unit !== b.unit) return false;
  const aTime = new Date(a.occurredAtISO).getTime();
  const bTime = new Date(b.occurredAtISO).getTime();
  if (!Number.isFinite(aTime) || !Number.isFinite(bTime)) return false;
  return aTime === bTime;
}

export interface DeriveSubmitKeyInput {
  /** Facts currently on the form (the intent about to be submitted). */
  currentFacts: LoggingFacts;
  /** The draft key minted for a fresh entry (no attempt yet). */
  draftKey: string;
  /** The most recent attempt under this draft, if any. */
  lastAttempt: LoggingAttempt | null;
  /** Key mint (defaults to a `v2-` random key; injectable for tests). */
  mintKey?: () => string;
}

export interface DerivedSubmitKey {
  key: string;
  /** True when the submit reuses the previous attempt's key (true replay). */
  reused: boolean;
}

function defaultMint(): string {
  return `v2-${Date.now().toString(36)}-${Math.floor(Math.random() * 0xffffffff).toString(16).padStart(8, '0')}`;
}

/**
 * Derive the idempotency key for the upcoming submission.
 *
 * - No prior attempt: use the draft key (first submit of this entry).
 * - Prior attempt with identical facts: reuse that attempt's key.
 * - Prior attempt with ANY fact difference: mint a NEW key.
 */
export function deriveSubmitKey(input: DeriveSubmitKeyInput): DerivedSubmitKey {
  const mint = input.mintKey ?? defaultMint;
  if (!input.lastAttempt) return { key: input.draftKey, reused: false };
  if (loggingFactsEqual(input.lastAttempt.facts, input.currentFacts)) {
    return { key: input.lastAttempt.key, reused: true };
  }
  return { key: mint(), reused: false };
}

/** Build the facts snapshot for one submission from form state. */
export function factsForSubmit(args: {
  canonicalKey: string;
  activityVariant: string | null;
  activityKind: 'fitness' | 'wellness';
  value: number;
  unit: string;
  occurredAt: Date;
}): LoggingFacts {
  return {
    canonicalKey: args.canonicalKey,
    activityVariant: args.activityVariant ?? null,
    activityKind: args.activityKind,
    value: args.value,
    unit: args.unit,
    occurredAtISO: args.occurredAt.toISOString(),
  };
}
