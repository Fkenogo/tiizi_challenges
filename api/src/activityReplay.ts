/**
 * Phase C1 engine replay — derive challenge/member progress from the
 * PostgreSQL event ledger using the existing provider-neutral engines.
 *
 * The engines are NOT rewritten: this module folds effective ledger events
 * through the vendored `engine/` sources (logic-identical to
 * `src/services/challengeEngine/` modulo ESM extensions, drift-guarded by
 * test) with the same
 * application semantics as the Firestore write path:
 * - per-member sequential fold in deterministic event order
 *   (occurred_at, recorded_at, event_id);
 * - collective group total accumulates challengeUpdate deltas;
 * - membership status/completedAt writes mirror the service layer
 *   (suppressed for collective estimation; applied via the group-target
 *   cascade, matching `atomicCollectiveGroupUpdate` outcomes).
 *
 * No Firebase import. Inputs are domain-shaped (ChallengeContext built by the
 * caller from Firestore challenge docs; ActivityEventRow from the ledger).
 * Repeated replay of the same inputs is deterministic.
 */

import type { ActivityEventRow } from './activityEvents.js';
import { computeRequiredLogs } from './engine/challengeCompletion.js';
import { selectEngine } from './engine/index.js';
import type {
  ChallengeContext,
  LogEvent,
  MembershipSnapshot,
} from './engine/types.js';

export interface ReplayMemberResult {
  memberId: string;
  snapshot: MembershipSnapshot;
  appliedEvents: number;
}

export interface ReplayResult {
  legacyChallengeId: string;
  challengeType: ChallengeContext['challengeType'];
  members: ReplayMemberResult[];
  /** Collective group total (sum of deltas); 0 for non-collective types. */
  groupTotal: number;
  appliedEvents: number;
}

function initialSnapshot(memberId: string, challengeId: string, context: ChallengeContext): MembershipSnapshot {
  return {
    userId: memberId,
    challengeId,
    status: 'active',
    activitiesCompleted: 0,
    totalActivities: computeRequiredLogs(context.durationDays, Math.max(1, context.activities.length)),
    completionRate: 0,
    totalPoints: 0,
  };
}

function toLogEvent(row: ActivityEventRow): LogEvent {
  return {
    userId: row.member_id,
    challengeId: row.legacy_challenge_id ?? '',
    activityId: row.canonical_key,
    value: row.value,
    unit: row.unit,
    date: row.occurred_day,
    loggedAt: new Date(row.occurred_at),
    pointsEarned: row.points,
  };
}

/** Plain-JSON comparable form (Dates become ISO strings). */
export function snapshotToComparable(snapshot: MembershipSnapshot): Record<string, unknown> {
  return JSON.parse(
    JSON.stringify(snapshot, (_key, value) => (value instanceof Date ? value.toISOString() : value)),
  ) as Record<string, unknown>;
}

export function replayChallengeEvents(
  events: ActivityEventRow[],
  context: ChallengeContext,
  options?: { groupTotalStart?: number },
): ReplayResult {
  const ordered = [...events].sort((a, b) => {
    if (a.occurred_at !== b.occurred_at) return a.occurred_at < b.occurred_at ? -1 : 1;
    if (a.recorded_at !== b.recorded_at) return a.recorded_at < b.recorded_at ? -1 : 1;
    return a.event_id < b.event_id ? -1 : 1;
  });
  const engine = selectEngine({ engineVersion: context.engineVersion, challengeType: context.challengeType });
  const snapshots = new Map<string, MembershipSnapshot>();
  const applied = new Map<string, number>();
  let groupTotal = options?.groupTotalStart ?? 0;
  let appliedEvents = 0;

  const snapshotFor = (memberId: string): MembershipSnapshot => {
    let snapshot = snapshots.get(memberId);
    if (!snapshot) {
      snapshot = initialSnapshot(memberId, context.challengeId, context);
      snapshots.set(memberId, snapshot);
      applied.set(memberId, 0);
    }
    return snapshot;
  };

  for (const row of ordered) {
    if (row.status !== 'committed') continue;
    const snapshot = snapshotFor(row.member_id);
    const logEvent = toLogEvent(row);
    const result = engine.computeUpdate(context, snapshot, logEvent, { groupCurrentTotal: groupTotal });
    const next: MembershipSnapshot = { ...snapshot, ...result.membershipUpdate };
    // Mirror the service layer: collective completion status is decided by the
    // atomic group transaction, not the engine's optimistic estimate.
    if (result.challengeUpdate) {
      next.status = snapshot.status;
      if (snapshot.completedAt) next.completedAt = snapshot.completedAt;
      else delete next.completedAt;
      groupTotal += result.challengeUpdate.groupCurrentTotalDelta;
    }
    snapshots.set(row.member_id, next);
    applied.set(row.member_id, (applied.get(row.member_id) ?? 0) + 1);
    appliedEvents += 1;
  }

  // Collective completion cascade (mirrors atomicCollectiveGroupUpdate):
  // reaching the group target completes every member that logged.
  const groupTarget = context.groupCumulativeTarget ?? 0;
  const autoComplete = context.autoCompleteOnGroupTarget ?? true;
  if (context.challengeType === 'collective' && autoComplete && groupTarget > 0 && groupTotal >= groupTarget) {
    const lastOccurred = ordered.length > 0 ? new Date(ordered[ordered.length - 1].occurred_at) : new Date();
    for (const [memberId, snapshot] of snapshots) {
      snapshots.set(memberId, { ...snapshot, status: 'completed', completedAt: lastOccurred });
    }
  }

  return {
    legacyChallengeId: context.challengeId,
    challengeType: context.challengeType,
    members: [...snapshots.entries()].map(([memberId, snapshot]) => ({
      memberId,
      snapshot,
      appliedEvents: applied.get(memberId) ?? 0,
    })),
    groupTotal,
    appliedEvents,
  };
}
