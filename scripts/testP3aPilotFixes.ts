/**
 * P3A pilot fix guards
 *
 * 1. Firestore rules include dailyGoals / dailyGoalsAnalytics in userSelfWritableFields
 * 2. Group discovery query uses visibility == 'public'
 * 3. GroupDetailScreen uses isChallengeOngoing (not raw status check)
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isChallengeOngoing } from '../src/services/challengeLifecycle';
import type { Challenge } from '../src/types';

const now = Date.parse('2026-06-15T12:00:00.000Z');

function challenge(patch: Partial<Challenge>): Challenge {
  return {
    id: patch.id ?? 'challenge',
    name: patch.name ?? 'Challenge',
    description: '',
    groupId: 'group-1',
    exerciseIds: [],
    startDate: '2026-06-01',
    endDate: '2026-06-30',
    createdBy: 'user-1',
    status: 'active',
    visibility: 'public',
    groupVisibility: 'public',
    ...patch,
  };
}

// ── Fix 1: Firestore rules ────────────────────────────────────────────────────

const rules = readFileSync('firestore.rules', 'utf8');

assert.match(
  rules,
  /['"]dailyGoals['"]/,
  'firestore.rules must include dailyGoals in userSelfWritableFields so users can save Home goals',
);

assert.match(
  rules,
  /['"]dailyGoalsAnalytics['"]/,
  'firestore.rules must include dailyGoalsAnalytics in userSelfWritableFields so analytics can be updated',
);

// ── Fix 2: Group discovery query ─────────────────────────────────────────────

const groupService = readFileSync('src/services/groupService.ts', 'utf8');

assert.ok(
  groupService.includes("where('visibility', '==', 'public')") ||
  groupService.includes('where("visibility", "==", "public")'),
  'groupService.getGroupsPage must filter by visibility == public so the query satisfies Firestore read rules',
);

const indexes = readFileSync('firestore.indexes.json', 'utf8');
const parsedIndexes = JSON.parse(indexes) as {
  indexes: Array<{ collectionGroup: string; fields: Array<{ fieldPath: string; order: string }> }>;
};

const groupDiscoveryIndex = parsedIndexes.indexes.find((idx) => {
  if (idx.collectionGroup !== 'groups') return false;
  const paths = idx.fields.map((f) => f.fieldPath);
  return (
    paths.includes('status') &&
    paths.includes('isPrivate') &&
    paths.includes('visibility') &&
    paths.includes('createdAt')
  );
});

assert.ok(
  groupDiscoveryIndex,
  'firestore.indexes.json must include a composite index on groups(status, isPrivate, visibility, createdAt) for public group discovery',
);

// ── Fix 3: Group detail lifecycle filtering ───────────────────────────────────

assert.equal(
  isChallengeOngoing(challenge({ status: 'active', endDate: '2026-06-14' }), now),
  false,
  'expired active challenges must not be considered ongoing',
);

assert.equal(
  isChallengeOngoing(challenge({ status: 'completed', endDate: '2026-06-30' }), now),
  false,
  'completed challenges must not be considered ongoing',
);

assert.equal(
  isChallengeOngoing(challenge({ status: 'archived' as Challenge['status'], endDate: '2026-06-30' }), now),
  false,
  'archived challenges must not be considered ongoing',
);

assert.equal(
  isChallengeOngoing(challenge({ status: 'cancelled' as Challenge['status'], endDate: '2026-06-30' }), now),
  false,
  'cancelled challenges must not be considered ongoing',
);

assert.equal(
  isChallengeOngoing(challenge({ status: 'active', startDate: '2026-06-01', endDate: '2026-06-30' }), now),
  true,
  'active challenge within date range must be considered ongoing',
);

const groupDetail = readFileSync('src/features/Groups/GroupDetailScreen.tsx', 'utf8');

assert.match(
  groupDetail,
  /isChallengeOngoing/,
  'GroupDetailScreen must import and use isChallengeOngoing from challengeLifecycle',
);

assert.doesNotMatch(
  groupDetail,
  /challenge\.status\s*===\s*['"]active['"]/,
  'GroupDetailScreen must not use raw status === active comparison for active challenge selection',
);

console.log('P3A pilot fix guards passed');
