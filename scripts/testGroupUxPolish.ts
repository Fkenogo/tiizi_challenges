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
  /membership(?:\?\.)cumulativeValues|membership\[['"]cumulativeValues['"]\]/,
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

// ── Issue B: redirect message in GroupLeaderboardScreen ──────────────────────

const groupLeaderboardScreen = readFileSync('src/features/Groups/GroupLeaderboardScreen.tsx', 'utf8');

assert.match(
  groupLeaderboardScreen,
  /Group leaderboard has moved/,
  'GroupLeaderboardScreen must show redirect message "Group leaderboard has moved"',
);

assert.doesNotMatch(
  groupLeaderboardScreen,
  /GroupDetailTabs/,
  'GroupLeaderboardScreen must not render GroupDetailTabs (it is a redirect page)',
);

// ── Issue E: shared GroupHeroHeader ──────────────────────────────────────────

const groupHeroHeader = readFileSync('src/features/Groups/components/GroupHeroHeader.tsx', 'utf8');
const groupMembersScreen = readFileSync('src/features/Groups/GroupMembersScreen.tsx', 'utf8');
const groupDetailScreen = readFileSync('src/features/Groups/GroupDetailScreen.tsx', 'utf8');

assert.match(
  groupHeroHeader,
  /GroupHeroHeader/,
  'GroupHeroHeader component must exist and export GroupHeroHeader',
);

assert.match(
  groupMembersScreen,
  /GroupHeroHeader/,
  'GroupMembersScreen must use GroupHeroHeader',
);

assert.match(
  groupDetailScreen,
  /GroupHeroHeader/,
  'GroupDetailScreen must use GroupHeroHeader',
);

// ── Issue D: clickable member rows + detail modal ─────────────────────────────

const groupMembersScreenV2 = readFileSync('src/features/Groups/GroupMembersScreen.tsx', 'utf8');

assert.match(
  groupMembersScreenV2,
  /selectedMember/,
  'GroupMembersScreen must have selectedMember state for member detail modal',
);

assert.match(
  groupMembersScreenV2,
  /setSelectedMember/,
  'GroupMembersScreen community member rows must call setSelectedMember on click',
);

// ── Issue F: join group retry + home-screen-data invalidation ─────────────────

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

// ── Phase 18I-6K follow-up: Home Log Activity routes to SelectChallengeActivityScreen ──

const activeChallengeCard = readFileSync('src/components/Home/ActiveChallengeCard.tsx', 'utf8');
const competitiveScreen = readFileSync('src/features/Challenges/CompetitiveChallengeScreen.tsx', 'utf8');
const collectiveScreen = readFileSync('src/features/Challenges/CollectiveChallengeScreen.tsx', 'utf8');
const streakScreen = readFileSync('src/features/Challenges/StreakChallengeScreen.tsx', 'utf8');

assert.match(
  activeChallengeCard,
  /select-activity/,
  'ActiveChallengeCard Log button must navigate to /app/workouts/select-activity (SelectChallengeActivityScreen)',
);

assert.match(
  activeChallengeCard,
  /navigate\(logPath\)/,
  'ActiveChallengeCard Log button must use logPath (select-activity) not detailPath (legacy dashboard screen)',
);

assert.doesNotMatch(
  competitiveScreen,
  /No workout logs yet for this challenge\./,
  'CompetitiveChallengeScreen must not render stale "No workout logs yet" text — screen now redirects to ChallengeDetailScreen',
);

assert.doesNotMatch(
  streakScreen,
  /No workout logs yet for this challenge\./,
  'StreakChallengeScreen must not render stale "No workout logs yet" text — screen now redirects to ChallengeDetailScreen',
);

assert.match(
  competitiveScreen,
  /Navigate/,
  'CompetitiveChallengeScreen must redirect to ChallengeDetailScreen (removes duplicated leaderboard logic)',
);

assert.match(
  collectiveScreen,
  /Navigate/,
  'CollectiveChallengeScreen must redirect to ChallengeDetailScreen (removes duplicated leaderboard logic)',
);

assert.match(
  streakScreen,
  /Navigate/,
  'StreakChallengeScreen must redirect to ChallengeDetailScreen (removes duplicated leaderboard logic)',
);

console.log('✅ testGroupUxPolish — 20/20 passed');
