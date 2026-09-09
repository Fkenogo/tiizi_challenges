/**
 * Phase C1 shadow derived-truth comparison: replay output vs existing
 * Firestore derived fields.
 *
 * Compares per-member progress fields (activitiesCompleted, completionRate,
 * totalPoints, current/longest streak, cumulativeLoggedValue, status) and,
 * for collective challenges, the team total. Every difference is reported
 * with exact values and classified:
 * - A: exact parity;
 * - B: explainable legacy-stale candidate — every diff fits the stale pattern
 *   (Firestore cumulative counters strictly behind replay with an older
 *   lastActivityAt, i.e. increments the live path demonstrably missed);
 * - C: material engine/event mismatch — blocks C2.
 *
 * Only C blocks. Inputs are plain data; no Firebase import.
 */

import { snapshotToComparable, type ReplayResult } from './activityReplay.js';

/** Firestore challengeMembers document, plain-data form. */
export interface FirestoreMemberSnapshot {
  memberId: string;
  status?: string;
  activitiesCompleted?: number;
  completionRate?: number;
  totalPoints?: number;
  currentStreak?: number;
  longestStreak?: number;
  cumulativeLoggedValue?: number;
  lastActivityAt?: string | null;
}

export type ShadowClassification = 'A' | 'B' | 'C';

export interface ShadowFieldDiff {
  field: string;
  replay: unknown;
  firestore: unknown;
  stalePattern: boolean;
}

export interface ShadowMemberComparison {
  memberId: string;
  classification: ShadowClassification;
  appliedEvents: number;
  diffs: ShadowFieldDiff[];
}

export interface ShadowReport {
  legacyChallengeId: string;
  challengeType: string;
  members: ShadowMemberComparison[];
  groupTotal?: {
    replay: number;
    firestore: number;
    firestoreSource: string;
    classification: ShadowClassification;
  };
  counts: { A: number; B: number; C: number };
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  return null;
}

function closeEnough(a: number, b: number): boolean {
  return Math.abs(a - b) < 1e-9;
}

export function compareReplayToFirestore(
  replay: ReplayResult,
  firestoreMembers: FirestoreMemberSnapshot[],
  options?: {
    firestoreGroupTotal?: number;
    firestoreGroupTotalSource?: string;
    lastReplayOccurredAt?: string;
  },
): ShadowReport {
  const fsByMember = new Map(firestoreMembers.map((m) => [m.memberId, m]));
  const members: ShadowMemberComparison[] = [];

  for (const result of replay.members) {
    const comparable = snapshotToComparable(result.snapshot);
    const fs = fsByMember.get(result.memberId);
    const diffs: ShadowFieldDiff[] = [];
    if (!fs) {
      diffs.push({ field: '(member)', replay: 'present', firestore: 'missing', stalePattern: false });
      members.push({ memberId: result.memberId, classification: 'C', appliedEvents: result.appliedEvents, diffs });
      continue;
    }
    const fsLastActivity = typeof fs.lastActivityAt === 'string' ? Date.parse(fs.lastActivityAt) : NaN;
    const replayLastActivity = Date.parse(String(comparable.lastActivityAt ?? ''));
    const firestoreOlder = Number.isFinite(fsLastActivity) && Number.isFinite(replayLastActivity)
      && fsLastActivity < replayLastActivity;

    const checkInt = (field: string, replayValue: unknown, firestoreValue: unknown) => {
      const r = num(replayValue);
      const f = num(firestoreValue);
      if (r == null || f == null || !Number.isInteger(r) || !Number.isInteger(f) || r !== f) {
        const stale = r != null && f != null && f < r && firestoreOlder;
        diffs.push({ field, replay: replayValue ?? null, firestore: firestoreValue ?? null, stalePattern: stale });
      }
    };
    const checkSum = (field: string, replayValue: unknown, firestoreValue: unknown) => {
      const r = num(replayValue);
      const f = num(firestoreValue);
      if (r == null || f == null || !closeEnough(r, f)) {
        const stale = r != null && f != null && f < r && firestoreOlder;
        diffs.push({ field, replay: replayValue ?? null, firestore: firestoreValue ?? null, stalePattern: stale });
      }
    };
    checkInt('activitiesCompleted', comparable.activitiesCompleted, fs.activitiesCompleted);
    checkInt('completionRate', comparable.completionRate, fs.completionRate);
    checkInt('totalPoints', comparable.totalPoints, fs.totalPoints);
    if (replay.challengeType === 'streak') {
      checkInt('currentStreak', comparable.currentStreak, fs.currentStreak);
      checkInt('longestStreak', comparable.longestStreak, fs.longestStreak);
    }
    if (replay.challengeType !== 'streak') {
      checkSum('cumulativeLoggedValue', comparable.cumulativeLoggedValue, fs.cumulativeLoggedValue);
    }
    const replayStatus = String(comparable.status ?? '');
    const fsStatus = String(fs.status ?? '');
    if (replayStatus !== fsStatus) {
      // A Firestore 'completed' the replay has not derived (or vice versa)
      // never fits the stale-counter pattern — it is material.
      diffs.push({ field: 'status', replay: replayStatus || null, firestore: fsStatus || null, stalePattern: false });
    }
    const classification: ShadowClassification = diffs.length === 0
      ? 'A'
      : diffs.every((d) => d.stalePattern)
        ? 'B'
        : 'C';
    members.push({ memberId: result.memberId, classification, appliedEvents: result.appliedEvents, diffs });
  }

  for (const fs of firestoreMembers) {
    if (!replay.members.some((m) => m.memberId === fs.memberId)) {
      members.push({
        memberId: fs.memberId,
        classification: 'C',
        appliedEvents: 0,
        diffs: [{ field: '(member)', replay: 'missing', firestore: 'present', stalePattern: false }],
      });
    }
  }

  let groupTotal: ShadowReport['groupTotal'];
  if (options?.firestoreGroupTotal != null && replay.challengeType === 'collective') {
    const r = replay.groupTotal;
    const f = options.firestoreGroupTotal;
    groupTotal = {
      replay: r,
      firestore: f,
      firestoreSource: options.firestoreGroupTotalSource ?? 'unknown',
      classification: closeEnough(r, f) ? 'A' : f < r ? 'B' : 'C',
    };
  }

  const counts = { A: 0, B: 0, C: 0 };
  for (const m of members) counts[m.classification] += 1;
  if (groupTotal && groupTotal.classification !== 'A') counts[groupTotal.classification] += 1;

  return { legacyChallengeId: replay.legacyChallengeId, challengeType: replay.challengeType, members, groupTotal, counts };
}
