/**
 * Phase C1 engine replay — derive challenge/member progress from Member
 * Activity Evidence using the existing provider-neutral engines.
 *
 * This module models the C2 application step (Evidence -> application ->
 * engine) in one fold: each event's reported measurement is scored against
 * the ChallengeContext activity target via the unified v2 scorer, then folded
 * through the vendored `engine/` sources (logic-identical to
 * `src/services/challengeEngine/` modulo ESM extensions, drift-guarded by
 * test). Scoring is computed here at application time — it is never read
 * from the event, because Evidence carries no points.
 *
 * Application semantics mirror the Firestore write path:
 * - per-member sequential fold in deterministic event order
 *   (occurred_at, recorded_at, event_id);
 * - collective group total accumulates challengeUpdate deltas;
 * - membership status/completedAt writes mirror the service layer
 *   (suppressed for collective estimation; applied via the group-target
 *   cascade, matching `atomicCollectiveGroupUpdate` outcomes).
 *
 * No Firebase import. Inputs are domain-shaped (ChallengeContext built by the
 * caller; ActivityEventRow from the ledger). Repeated replay of the same
 * inputs is deterministic.
 */

import type { ActivityEventRow } from './activityEvents.js';
import { computeRequiredLogs } from './engine/challengeCompletion.js';
import { selectEngine } from './engine/index.js';
import { computeActivityScore } from './engine/scoringConfig.js';
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
  /** The ChallengeContext identity replayed against (application scope, not event content). */
  challengeId: string;
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

/**
 * Build the engine LogEvent for one Evidence row in a Challenge context.
 * Points are derived here (C2 application scoring): the challenge activity
 * target for the row's canonical key drives the unified v2 scorer. Evidence
 * carries no points, so there is nothing to read back.
 */
function toLogEvent(row: ActivityEventRow, context: ChallengeContext): LogEvent {
  const config = context.activities.find(
    (a) => (a.activityId ?? a.exerciseId) === row.canonical_key
      || (a.exerciseId ?? a.activityId) === row.canonical_key,
  );
  const targetValue = config?.activityCumulativeTarget ?? config?.targetValue ?? 0;
  const { pointsEarned } = computeActivityScore({
    value: row.value,
    targetValue,
    challengeType: context.challengeType,
  });
  return {
    userId: row.member_id,
    challengeId: context.challengeId,
    activityId: row.canonical_key,
    value: row.value,
    unit: row.unit,
    date: row.occurred_day,
    loggedAt: new Date(row.occurred_at),
    pointsEarned,
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
    const logEvent = toLogEvent(row, context);
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
    challengeId: context.challengeId,
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
