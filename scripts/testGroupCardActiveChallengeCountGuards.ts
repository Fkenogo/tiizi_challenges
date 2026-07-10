/**
 * Phase 19A-10L (rev3) — Group card ongoing challenge count guards.
 *
 * Root cause (rev3): GroupsScreen used `challenge.status !== 'active'` to
 * count challenges, which differs from GroupDetailScreen's `isChallengeOngoing()`
 * (which also checks the date window). Stale Firestore docs with status='active'
 * but endDate in the past were counted in the card but excluded from the Ongoing tab.
 *
 * Fix:
 * - GroupsScreen now uses isChallengeOngoing() — same logic as GroupDetailScreen.
 * - normalizedMyGroups maps myGroups through normalizedGroups; My Groups tab renders it.
 * - Badge label changed to "Ongoing Challenge(s)" to match the GroupDetailScreen tab.
 *
 * Run: npx tsx scripts/testGroupCardActiveChallengeCountGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const groupsScreen = read('src/features/Groups/GroupsScreen.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Uses isChallengeOngoing (not raw status check) to count ongoing challenges
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  groupsScreen,
  /isChallengeOngoing/,
  '10L-1: GroupsScreen must import and use isChallengeOngoing — same logic as GroupDetailScreen Ongoing tab',
);
assert.doesNotMatch(
  groupsScreen,
  /challenge\.status !== ['"]active['"]/,
  '10L-1: Must NOT use status !== "active" alone — stale docs with past endDate would still be counted',
);
assert.doesNotMatch(
  groupsScreen,
  /challenge\.status === ['"]completed['"]/,
  '10L-1: Must NOT use status === "completed" as the sole exclusion',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: My Groups tab renders normalizedMyGroups, NOT raw myGroups
// ─────────────────────────────────────────────────────────────────────────────
// Must NOT render GroupCard from raw myGroups — only the normalizedMyGroups path is allowed.
// The benign `new Set(myGroups.map((group) => group.id))` is fine; we target the JSX render.
assert.doesNotMatch(
  groupsScreen,
  /myGroups\.map\([^)]*\)\s*=>\s*[(<]\s*GroupCard/,
  '10L-1: My Groups must NOT render GroupCard from raw myGroups.map — use normalizedMyGroups',
);
assert.match(
  groupsScreen,
  /normalizedMyGroups/,
  '10L-1: GroupsScreen must define normalizedMyGroups',
);
assert.match(
  groupsScreen,
  /normalizedMyGroups\.map\(/,
  '10L-1: My Groups tab must render normalizedMyGroups.map(...)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Discover tab uses normalizedGroups via discoverGroups
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  groupsScreen,
  /discoverGroups\s*=\s*normalizedGroups/,
  '10L-1: discoverGroups must be derived from normalizedGroups',
);
assert.match(
  groupsScreen,
  /discoverGroups\.map\(/,
  '10L-1: Discover tab must render discoverGroups.map(...)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Badge label says "Ongoing Challenge(s)" — matches GroupDetailScreen wording
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  groupsScreen,
  /Ongoing Challenge/,
  '10L-1: Badge must say "Ongoing Challenge" to match the GroupDetailScreen Ongoing tab',
);
assert.doesNotMatch(
  groupsScreen,
  /activeChallenges === 1 \? ['"]Active Challenge['"] : ['"]Active Challenges['"]/,
  '10L-1: Badge must not say "Active Challenge(s)" — label must be "Ongoing"',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: activeChallenges derived from challengeCountByGroup (not raw Firestore)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  groupsScreen,
  /challengeCountByGroup/,
  '10L-1: activeChallenges must come from challengeCountByGroup, not a raw Firestore field',
);

// ─────────────────────────────────────────────────────────────────────────────
// FIXTURE-STYLE LOGIC TEST — using isChallengeOngoing logic inline
// ─────────────────────────────────────────────────────────────────────────────
{
  type Challenge = { groupId: string; startDate: string; endDate: string; status: string };
  type Group = { id: string };

  const now = Date.now();
  const past = (ms: number) => new Date(now - ms).toISOString();
  const future = (ms: number) => new Date(now + ms).toISOString();
  const DAY = 24 * 60 * 60 * 1000;

  function isChallengeOngoing(c: Pick<Challenge, 'startDate' | 'endDate' | 'status'>, n = Date.now()): boolean {
    const start = Date.parse(c.startDate);
    const end = Date.parse(c.endDate);
    if (Number.isNaN(start) || Number.isNaN(end)) return false;
    const inWindow = n >= start && n <= end;
    const notTerminal = c.status !== 'completed' && c.status !== 'expired' && c.status !== 'draft';
    return inWindow && notTerminal;
  }

  const challenges: Challenge[] = [
    // Group A: 5 ongoing active (date window valid), 3 completed
    ...Array.from({ length: 5 }, () => ({ groupId: 'A', startDate: past(5 * DAY), endDate: future(5 * DAY), status: 'active' })),
    ...Array.from({ length: 3 }, () => ({ groupId: 'A', startDate: past(30 * DAY), endDate: past(1 * DAY), status: 'completed' })),
    // Group B: 2 active ongoing, 1 upcoming (future start), 12 completed
    ...Array.from({ length: 2 }, () => ({ groupId: 'B', startDate: past(3 * DAY), endDate: future(7 * DAY), status: 'active' })),
    { groupId: 'B', startDate: future(2 * DAY), endDate: future(10 * DAY), status: 'active' },
    ...Array.from({ length: 12 }, () => ({ groupId: 'B', startDate: past(20 * DAY), endDate: past(1 * DAY), status: 'completed' })),
    // Group C: 0 ongoing, 4 completed, 1 stale-active (status active but past end date)
    ...Array.from({ length: 4 }, () => ({ groupId: 'C', startDate: past(20 * DAY), endDate: past(1 * DAY), status: 'completed' })),
    { groupId: 'C', startDate: past(20 * DAY), endDate: past(1 * DAY), status: 'active' }, // stale
  ];

  const allGroups: Group[] = [{ id: 'A' }, { id: 'B' }, { id: 'C' }];

  const challengeCountByGroup = new Map<string, number>();
  challenges.forEach((c) => {
    if (!c.groupId || !isChallengeOngoing(c)) return;
    challengeCountByGroup.set(c.groupId, (challengeCountByGroup.get(c.groupId) ?? 0) + 1);
  });

  const normalized = allGroups.map((g) => ({
    ...g,
    activeChallenges: challengeCountByGroup.get(g.id) ?? 0,
  }));

  const groupA = normalized.find((g) => g.id === 'A')!;
  const groupB = normalized.find((g) => g.id === 'B')!;
  const groupC = normalized.find((g) => g.id === 'C')!;

  assert.equal(groupA.activeChallenges, 5, 'FIXTURE: Group A (5 ongoing + 3 completed) → 5 Ongoing Challenges');
  assert.equal(groupB.activeChallenges, 2, 'FIXTURE: Group B (2 ongoing + 1 upcoming-by-date + 12 completed) → 2 Ongoing Challenges');
  assert.equal(groupC.activeChallenges, 0, 'FIXTURE: Group C (0 ongoing + 4 completed + 1 stale-active) → 0 Ongoing Challenges');
  assert.ok(!groupC.activeChallenges, 'FIXTURE: Group C has falsy activeChallenges → no Active Now pill');
}

console.log('✅ All Phase 19A-10L group card ongoing challenge count guards passed (rev3).');
