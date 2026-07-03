/**
 * Phase 18I-6J — Group UX and Log Activity Polish guards
 *
 * Uses readFileSync-only pattern (no Firestore calls).
 * Run: npm run test:group-ux-polish
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ── Issue A: competitive progress uses resolver, not cumulativeValues ─────────

const selectScreen = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');

assert.doesNotMatch(
  selectScreen,
  /cumulativeValues/,
  'SelectChallengeActivityScreen must not read membership.cumulativeValues — use resolveChallengeProgress output instead',
);

const groupDetailTabs = readFileSync('src/features/Groups/components/GroupDetailTabs.tsx', 'utf8');

assert.doesNotMatch(
  groupDetailTabs,
  /leaderboard/,
  'GroupDetailTabs must not contain a leaderboard tab entry',
);

assert.doesNotMatch(
  groupDetailTabs,
  /'feed' \| 'challenges' \| 'members' \| 'leaderboard'/,
  "GroupDetailTabs active prop type must be 3-way union (no 'leaderboard')",
);

assert.match(
  groupDetailTabs,
  /grid-cols-3/,
  'GroupDetailTabs must use grid-cols-3 after removing the leaderboard tab',
);

console.log('✅ testGroupUxPolish — 4/4 passed (competitive progress source, leaderboard tab removed)');
