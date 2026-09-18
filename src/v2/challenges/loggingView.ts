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
  | { kind: 'hidden'; reason: 'not-joined' | 'read-only' | 'no-configured-activities' };

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
  if (choices.length === 0) return { kind: 'hidden', reason: 'no-configured-activities' };
  return { kind: 'loggable', choices };
}
