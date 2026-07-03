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

// ── Task 3: GroupHeroHeader extraction ────────────────────────────────────────

const groupHeroHeader = readFileSync('src/features/Groups/components/GroupHeroHeader.tsx', 'utf8');
const groupMembersScreen = readFileSync('src/features/Groups/GroupMembersScreen.tsx', 'utf8');
const groupDetailScreen = readFileSync('src/features/Groups/GroupDetailScreen.tsx', 'utf8');

assert.match(
  groupHeroHeader,
  /GroupHeroHeader/,
  'GroupHeroHeader component must exist',
);

assert.match(
  groupMembersScreen,
  /GroupHeroHeader/,
  'GroupMembersScreen must use GroupHeroHeader',
);

assert.doesNotMatch(
  groupMembersScreen,
  /sticky top-0.*h-10.*ArrowLeft|ArrowLeft.*sticky top-0/s,
  'GroupMembersScreen must not have old sticky header with ArrowLeft outside the hero',
);

assert.match(
  groupDetailScreen,
  /GroupHeroHeader/,
  'GroupDetailScreen must use GroupHeroHeader',
);

// ── Task 4: Clickable member rows + member detail modal ───────────────────────

const groupMembersScreenV2 = readFileSync('src/features/Groups/GroupMembersScreen.tsx', 'utf8');

assert.match(
  groupMembersScreenV2,
  /selectedMember/,
  'GroupMembersScreen must have selectedMember state for member detail modal',
);

assert.match(
  groupMembersScreenV2,
  /onClick.*setSelectedMember|setSelectedMember.*onClick/s,
  'GroupMembersScreen community member rows must call setSelectedMember on click',
);

// ── Task 5: useJoinGroup retry and home-screen-data invalidation ──────────────

const useGroupsHook = readFileSync('src/hooks/useGroups.ts', 'utf8');

assert.match(
  useGroupsHook,
  /retry.*1|retryDelay/,
  'useJoinGroup must have retry: 1 to handle first-click auth token race',
);

assert.match(
  useGroupsHook,
  /home-screen-data/,
  'useJoinGroup onSuccess must invalidate home-screen-data so Home feed reflects membership',
);

console.log('✅ testGroupUxPolish — 12/12 passed (competitive progress source, leaderboard tab removed, GroupHeroHeader extracted, clickable member rows with detail modal, useJoinGroup retry + home-screen-data invalidation)');
