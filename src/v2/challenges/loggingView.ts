import type { V2ChallengeDetail, V2ConfigActivity } from '../../api/v2ChallengeApi';

/**
 * S3b — activity-logging view derivation (pure, React-free so it is
 * directly testable — same convention as `participationView.ts`).
 *
 * Derives the member-facing logging view ONLY from the authoritative
 * read model (`detail.myParticipation?.status`, `detail.status`,
 * `detail.finalized`, `detail.config.activities`). Never infers
 * eligibility from unrelated fields; never manufactures canonical
 * score/progress; never invents configuration values.
 *
 * The eligible input choices are exactly the governing configuration
 * activities already exposed on the detail read. A choice carries the
 * locked unit/kind/variant the server enforces — the member supplies
 * only the amount and when it happened.
 */
export interface S3bLoggableChoice {
  /** Stable option identity within this governing config version. */
  optionId: string;
  canonicalKey: string;
  activityVariant: string | null;
  activityKind: 'fitness' | 'wellness';
  /** Locked unit the server enforces (exact match). Displayed, not edited. */
  unit: string;
  /** Governing target shown for context (never submitted as authority). */
  targetValue: number;
  metric: string | null;
}

export type S3bLoggingView =
  | { kind: 'loggable'; choices: S3bLoggableChoice[] }
  | { kind: 'empty'; reason: 'no-configured-activities' }
  | { kind: 'hidden'; reason: 'not-joined' | 'read-only' };

export function choiceForActivity(activity: V2ConfigActivity): S3bLoggableChoice {
  return {
    optionId: `${activity.canonicalKey}::${activity.activityVariant ?? ''}`,
    canonicalKey: activity.canonicalKey,
    activityVariant: activity.activityVariant,
    activityKind: activity.activityKind,
    unit: activity.unit,
    targetValue: activity.targetValue,
    metric: activity.metric ?? null,
  };
}

export function loggingViewFor(detail: V2ChallengeDetail): S3bLoggingView {
  // Logging is a joined-active affordance only. Ended/finalized Challenges
  // are read-only regardless of episode state; non-participants are denied
  // by the same gate the server enforces (no bypass).
  if (detail.status !== 'active' || detail.finalized) return { kind: 'hidden', reason: 'read-only' };
  if (detail.myParticipation?.status !== 'active') return { kind: 'hidden', reason: 'not-joined' };
  const choices = detail.config.activities.map(choiceForActivity);
  // CORR-001 bounded UX: a joined Challenge with zero configured activities
  // is an honest empty state — never silent nothing, never loggable.
  if (choices.length === 0) return { kind: 'empty', reason: 'no-configured-activities' };
  return { kind: 'loggable', choices };
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * CORR-001 bounded UX: humanize a canonical key for participant-facing
 * labels. UUID keys are NEVER exposed to participants (they render as a
 * generic "Activity"); coded keys render title-cased with separators as
 * spaces (the resolved Knowledge name stays primary where fetched).
 */
export function humanizeCanonicalKey(canonicalKey: string): string {
  if (UUID_RE.test(canonicalKey)) return 'Activity';
  return canonicalKey
    .split(/[-_:]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Activity';
}

/**
 * Participant-facing selector label. The human-readable name is primary
 * (resolved async where shown); this synchronous label never exposes a
 * UUID — the canonical code appears only as secondary context for coded
 * keys, never for UUID keys.
 */
export function choiceOptionLabel(choice: S3bLoggableChoice): string {
  const variant = choice.activityVariant ? ` (${choice.activityVariant})` : '';
  if (UUID_RE.test(choice.canonicalKey)) {
    return `Activity${variant} — target ${choice.targetValue} ${choice.unit}`;
  }
  return `${humanizeCanonicalKey(choice.canonicalKey)}${variant} — target ${choice.targetValue} ${choice.unit}`;
}

/**
 * CORR-001 Blocker 3: separate "can submit another activity" from "show
 * the authoritative outcome just received".
 *
 * An authoritative accepted result already received MUST remain visible
 * even if the refetched Challenge becomes ended/finalized. Ended/finalized
 * state prevents NEW logging (no new form, no Log-another submission) but
 * never hides the outcome already rendered. No progress state is preserved
 * or manufactured here — only the accepted result object the server
 * returned.
 */
export function shouldShowAcceptedResult(accepted: unknown): boolean {
  return accepted !== null && accepted !== undefined;
}

/** True only while the current detail read still permits a new submission. */
export function isNewEntryAllowed(detail: V2ChallengeDetail): boolean {
  return loggingViewFor(detail).kind === 'loggable';
}

/** Bounded empty-state copy for zero configured activities. */
export const NO_CONFIGURED_ACTIVITIES_COPY =
  'This Challenge currently has no activities available to log.';

export type LoggingSectionRender =
  | { render: 'null' }
  | { render: 'empty' }
  | { render: 'form'; choices: S3bLoggableChoice[] }
  | { render: 'accepted'; allowNewEntry: boolean };

/**
 * Pure render-state derivation for the logging section (React-free).
 * `accepted` is the authoritative server result already received (or null).
 * An accepted result always renders (`accepted`), even when the current
 * read is ended/finalized; only a loggable read renders the entry form.
 */
export function loggingSectionStateFor(
  detail: V2ChallengeDetail,
  accepted: unknown,
): LoggingSectionRender {
  if (shouldShowAcceptedResult(accepted)) {
    return { render: 'accepted', allowNewEntry: isNewEntryAllowed(detail) };
  }
  const view = loggingViewFor(detail);
  if (view.kind === 'hidden') return { render: 'null' };
  if (view.kind === 'empty') return { render: 'empty' };
  return { render: 'form', choices: view.choices };
}
