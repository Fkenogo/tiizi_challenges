# Home Challenge Cards Relevance — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace static ordering on the Home page with relevance-based ranking — "My Challenges" by recent user activity, "Most Popular" renamed to "Most Active" and ranked by total log volume.

**Architecture:** All changes live in `useHomeScreen.ts` (data) and `HomeScreen.tsx` (labels). No new services, no schema changes, no Cloud Functions. "My Challenges" sort uses `lastActivityAt` from membership summaries already in memory. "Most Active" batch-reads `challengeActivitySummaries/{id}` docs (maintained by existing Cloud Functions) for the same candidates already fetched for the home page.

**Tech Stack:** TypeScript, React, TanStack Query, Firebase Firestore (`getDocs`, `collection`, `query`, `where`, `documentId`).

## Global Constraints

- Do NOT break privacy scoping: `allChallenges` source unchanged; private group challenges must not leak.
- Do NOT change live progress enrichment on the first My Challenges card.
- Do NOT change `buildChallengeProgress`, `isChallengeOngoing`, `buildChallengeProgress`, or any progress resolver.
- Do NOT change card UI components (`ActiveChallengeCard`, `TrendingChallenges`) or carousel layout.
- Do NOT add schema fields, migrations, or Cloud Function changes.
- Missing `challengeActivitySummaries` doc → treat as `totalLogs = 0`, fall back to `participantCount`. Do NOT exclude the challenge.
- My Challenges limit: **10** (carousel shows 3 at a time, user swipes for more).
- Most Active limit: **5**.
- Section header text: `"Most Active"` (was `"Most Popular"`).
- Stat label on Most Active cards: `"X logs"` when `totalLogs > 0`; `"X members"` as fallback.
- No unbounded Firestore queries: `challengeActivitySummaries` reads use `where(documentId(), 'in', chunk)` in chunks of 10.
- All validation must pass: `npx tsc --noEmit`, `npm run build`, all test scripts below.

---

### Task 1: Sort "My Challenges" by recent user activity

**Files:**
- Modify: `src/features/Home/useHomeScreen.ts`

**Context for implementer:**

`useHomeScreen.ts` exports `fetchHomeScreenData(uid)`. Around line 153 you will find:

```ts
const ongoingMemberChallenges = membershipChallenges
  .filter((c) => isChallengeOngoing(c))
  .slice(0, 3);
```

`membershipSummaries` is a `Map<string, ChallengeMembershipSummary>` where each value has `lastActivityAt?: string` (ISO string or undefined). This map is already populated before this line.

**Interfaces:**
- Consumes: `membershipSummaries: Map<string, ChallengeMembershipSummary>` (already in scope)
- Produces: `ongoingMemberChallenges: Challenge[]` — same type, new sort order, limit 10

- [ ] **Step 1: Write the failing guard**

Open `scripts/testHomeChallengeFeeds.ts`. Before the final `console.log('✅ testHomeChallengeFeeds...')` line, append:

```ts
// ── Phase 18I-6I: My Challenges relevance sort ────────────────────────────

{
  // Guard: My Challenges are sorted by lastActivityAt (Tier 1) before no-activity challenges (Tier 2)
  assert(
    homeHook.includes('lastActivityAt') && homeHook.includes('endDate'),
    'useHomeScreen myChallenges sort must use lastActivityAt (Tier 1) and endDate (Tier 2 fallback)',
  );

  // Guard: Tier 2 challenges sorted by endDate asc (earliest deadline first)
  assert(
    homeHook.includes('Date.parse(a.endDate) - Date.parse(b.endDate)'),
    'useHomeScreen Tier-2 unlogged challenges must sort by endDate asc',
  );

  // Guard: My Challenges limit is 10
  assert(
    homeHook.includes('.slice(0, 10)'),
    'useHomeScreen must limit ongoingMemberChallenges to 10',
  );

  // Guard: My Challenges sort uses membershipSummaries.get() for lastActivityAt (no new Firestore read)
  assert(
    homeHook.includes("membershipSummaries.get(") && homeHook.includes('lastActivityAt'),
    'useHomeScreen must derive lastActivityAt from membershipSummaries (no new Firestore read)',
  );
}
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npx tsx scripts/testHomeChallengeFeeds.ts
```

Expected: assertion failures about `lastActivityAt`, `endDate`, `.slice(0, 10)`.

- [ ] **Step 3: Implement the sort in `useHomeScreen.ts`**

Find the line:
```ts
const ongoingMemberChallenges = membershipChallenges
  .filter((c) => isChallengeOngoing(c))
  .slice(0, 3);
```

Replace with:
```ts
const ongoingMemberChallenges = membershipChallenges
  .filter((c) => isChallengeOngoing(c))
  .sort((a, b) => {
    const aLast = membershipSummaries.get(a.id)?.lastActivityAt;
    const bLast = membershipSummaries.get(b.id)?.lastActivityAt;
    // Tier 1: has recent activity → sort by lastActivityAt desc
    if (aLast && bLast) return aLast > bLast ? -1 : aLast < bLast ? 1 : 0;
    if (aLast) return -1;
    if (bLast) return 1;
    // Tier 2: no activity → sort by endDate asc (soonest deadline first)
    return Date.parse(a.endDate) - Date.parse(b.endDate);
  })
  .slice(0, 10);
```

- [ ] **Step 4: Run the test to confirm it passes**

```
npx tsx scripts/testHomeChallengeFeeds.ts
```

Expected: all guards pass including the 4 new ones.

- [ ] **Step 5: TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/Home/useHomeScreen.ts scripts/testHomeChallengeFeeds.ts
git commit -m "feat(p18i-6i): sort My Challenges by recent user activity (lastActivityAt)"
```

---

### Task 2: Replace "Most Popular" with "Most Active" ranked by totalLogs

**Files:**
- Modify: `src/features/Home/useHomeScreen.ts`
- Modify: `src/features/Home/HomeScreen.tsx`

**Context for implementer:**

**In `useHomeScreen.ts`:**

The `HomeScreenData` type (around line 12) has:
```ts
mostPopularOngoing: Array<{
  id: string;
  name: string;
  members: string;
  imageUrl?: string;
  joined: boolean;
  daysLabel: string;
  actionLabel: 'Join' | 'View' | 'Log Workout' | 'Log Activity';
  groupId?: string;
  challengeType: 'collective' | 'competitive' | 'streak';
}>;
```

Rename this field to `mostActiveOngoing`. All other shape fields stay the same.

Near the bottom of `fetchHomeScreenData`, you will find a block that builds `mostPopularOngoing`:
```ts
const membershipIndex = await challengeService.getUserChallengeMembershipIndex(uid).catch(...);
const mostPopularOngoing: HomeScreenData['mostPopularOngoing'] = allChallenges
  .filter((challenge) => isChallengeOngoing(challenge, nowMs))
  .sort((a, b) => (b.participantCount ?? 0) - (a.participantCount ?? 0))
  .slice(0, 3)
  .map((challenge) => {
    ...
    return {
      ...
      members: formatCompactCount(challenge.participantCount ?? 0),
      ...
    };
  });
```

Replace this entire block (from `const mostPopularOngoing` to its closing `);`) with the new implementation below.

The `documentId` import is already imported at the top of the file (`import { collection, documentId, getDocs, query, where } from 'firebase/firestore'`). No new imports needed.

**In `HomeScreen.tsx`:**

Two references to rename and one label to change:
1. `data?.mostPopularOngoing` → `data?.mostActiveOngoing`
2. `effectiveMostPopular` → `effectiveMostActive` (two variable names, one useMemo, one useEffect)
3. `fallbackMostPopular` → `fallbackMostActive`
4. `<h3 className="st-section-label">Most Popular</h3>` → `Most Active`
5. All occurrences of `effectiveMostPopular` in JSX → `effectiveMostActive`

**Interfaces:**
- Produces: `HomeScreenData.mostActiveOngoing` — same shape as former `mostPopularOngoing`, `members` field now shows `"X logs"` or `"X members"`

- [ ] **Step 1: Write the failing guards**

Append to the Phase 18I-6I block in `scripts/testHomeChallengeFeeds.ts` (after the Task 1 guards, before the final console.log):

```ts
// ── Phase 18I-6I: Most Active section ────────────────────────────────────

{
  // Guard: useHomeScreen reads challengeActivitySummaries for Most Active ranking
  assert(
    homeHook.includes("'challengeActivitySummaries'"),
    'useHomeScreen must read challengeActivitySummaries collection for Most Active ranking',
  );

  // Guard: sorts by totalLogs before participantCount
  assert(
    homeHook.includes('totalLogs') && homeHook.includes('participantCount'),
    'useHomeScreen Most Active must sort by totalLogs then participantCount',
  );

  // Guard: totalLogs sort is primary (appears before participantCount in sort)
  assert(
    (() => {
      const totalLogsIdx = homeHook.indexOf('totalLogs');
      const participantIdx = homeHook.indexOf('participantCount');
      return totalLogsIdx !== -1 && participantIdx !== -1 && totalLogsIdx < participantIdx;
    })(),
    'useHomeScreen Most Active: totalLogs sort must appear before participantCount sort',
  );

  // Guard: Most Active limit is 5
  assert(
    homeHook.includes('.slice(0, 5)'),
    'useHomeScreen must limit mostActiveOngoing to 5',
  );

  // Guard: uses chunked in-query (no unbounded challengeActivitySummaries read)
  assert(
    homeHook.includes("documentId(), 'in'") || homeHook.includes('documentId(), "in"'),
    'useHomeScreen challengeActivitySummaries read must use documentId() in-query (chunked, not unbounded)',
  );

  // Guard: missing summary treated as totalLogs = 0 (not excluded)
  assert(
    homeHook.includes('totalLogs ?? 0') || homeHook.includes("totalLogs ?? 0"),
    'useHomeScreen Most Active must treat missing challengeActivitySummaries as totalLogs = 0',
  );

  // Guard: stat label shows "logs" when totalLogs > 0
  assert(
    homeHook.includes("'logs'") || homeHook.includes('"logs"'),
    'useHomeScreen Most Active card members label must include "logs" string',
  );

  // Guard: HomeScreen renders "Most Active" section label (not "Most Popular")
  assert(
    homeScreen.includes('Most Active') && !homeScreen.includes('Most Popular'),
    'HomeScreen must render "Most Active" section label, not "Most Popular"',
  );

  // Guard: HomeScreen uses mostActiveOngoing field (not mostPopularOngoing)
  assert(
    homeScreen.includes('mostActiveOngoing') && !homeScreen.includes('mostPopularOngoing'),
    'HomeScreen must reference mostActiveOngoing (renamed from mostPopularOngoing)',
  );

  // Guard: useHomeScreen type uses mostActiveOngoing (not mostPopularOngoing)
  assert(
    homeHook.includes('mostActiveOngoing') && !homeHook.includes('mostPopularOngoing'),
    'useHomeScreen HomeScreenData type must use mostActiveOngoing field name',
  );
}
```

- [ ] **Step 2: Run the test to confirm it fails**

```
npx tsx scripts/testHomeChallengeFeeds.ts
```

Expected: 7 new failures about `challengeActivitySummaries`, `totalLogs`, `Most Active`, `mostActiveOngoing`.

- [ ] **Step 3: Update the `HomeScreenData` type in `useHomeScreen.ts`**

Find:
```ts
  mostPopularOngoing: Array<{
```

Replace with:
```ts
  mostActiveOngoing: Array<{
```

- [ ] **Step 4: Replace the `mostPopularOngoing` build block in `useHomeScreen.ts`**

Find the entire block starting with:
```ts
  const membershipIndex = await challengeService.getUserChallengeMembershipIndex(uid).catch(() => new Map<string, string>());
  const mostPopularOngoing: HomeScreenData['mostPopularOngoing'] = allChallenges
    .filter((challenge) => isChallengeOngoing(challenge, nowMs))
    .sort((a, b) => (b.participantCount ?? 0) - (a.participantCount ?? 0))
    .slice(0, 3)
    .map((challenge) => {
```

and ending with its closing `});` and then `return {`.

Replace from `const membershipIndex` up to (but not including) `return {` with:

```ts
  const membershipIndex = await challengeService.getUserChallengeMembershipIndex(uid).catch(() => new Map<string, string>());

  // Batch-read challengeActivitySummaries for all ongoing candidates to rank by totalLogs.
  // Maintained by Cloud Functions on every workout + wellness log. Missing docs → totalLogs = 0.
  const ongoingCandidates = allChallenges.filter((challenge) => isChallengeOngoing(challenge, nowMs));
  const candidateIds = ongoingCandidates.map((c) => c.id).filter(Boolean);
  const activitySummaryMap = new Map<string, { totalLogs: number }>();
  if (candidateIds.length > 0) {
    const chunks: string[][] = [];
    for (let i = 0; i < candidateIds.length; i += 10) {
      chunks.push(candidateIds.slice(i, i + 10));
    }
    const snaps = await Promise.all(
      chunks.map((chunk) =>
        getDocs(
          query(collection(db, 'challengeActivitySummaries'), where(documentId(), 'in', chunk)),
        ).catch(() => null),
      ),
    );
    for (const snap of snaps) {
      if (!snap) continue;
      for (const doc of snap.docs) {
        const data = doc.data() as { totalLogs?: number };
        activitySummaryMap.set(doc.id, { totalLogs: Math.max(0, Number(data.totalLogs ?? 0)) });
      }
    }
  }

  const mostActiveOngoing: HomeScreenData['mostActiveOngoing'] = ongoingCandidates
    .sort((a, b) => {
      const aLogs = activitySummaryMap.get(a.id)?.totalLogs ?? 0;
      const bLogs = activitySummaryMap.get(b.id)?.totalLogs ?? 0;
      if (bLogs !== aLogs) return bLogs - aLogs;
      return (b.participantCount ?? 0) - (a.participantCount ?? 0);
    })
    .slice(0, 5)
    .map((challenge) => {
      const end = Date.parse(challenge.endDate);
      const remaining = !Number.isNaN(end) ? Math.max(0, Math.ceil((end - nowMs) / oneDay)) : 0;
      const memberStatus = membershipIndex.get(challenge.id) ?? membershipSummaries.get(challenge.id)?.status;
      const joined = activeMembershipChallengeIds.has(challenge.id);
      let actionLabel: 'Join' | 'View' | 'Log Workout' | 'Log Activity' = 'Join';
      if (memberStatus === 'completed') {
        actionLabel = 'View';
      } else if (joined) {
        actionLabel = (challenge.category && challenge.category !== 'fitness') ? 'Log Activity' : 'Log Workout';
      }
      const totalLogs = activitySummaryMap.get(challenge.id)?.totalLogs ?? 0;
      return {
        id: challenge.id,
        name: challenge.name,
        groupId: challenge.groupId,
        challengeType: challenge.challengeType ?? 'collective',
        members: totalLogs > 0
          ? `${formatCompactCount(totalLogs)} logs`
          : `${formatCompactCount(challenge.participantCount ?? 0)} members`,
        imageUrl: challenge.coverImageUrl,
        joined,
        daysLabel: `${remaining} Days Left`,
        actionLabel,
      };
    });
```

- [ ] **Step 5: Update the `return` statement in `fetchHomeScreenData`**

Find in the return object:
```ts
    mostPopularOngoing,
```

Replace with:
```ts
    mostActiveOngoing,
```

- [ ] **Step 6: Update `HomeScreen.tsx` — rename variables and field references**

In `HomeScreen.tsx`, make these replacements:

**a)** Find:
```ts
  const effectiveMostPopular =
    (data?.mostPopularOngoing && data.mostPopularOngoing.length > 0)
      ? data.mostPopularOngoing
      : fallbackMostPopular;
```
Replace with:
```ts
  const effectiveMostActive =
    (data?.mostActiveOngoing && data.mostActiveOngoing.length > 0)
      ? data.mostActiveOngoing
      : fallbackMostActive;
```

**b)** Find:
```ts
  const fallbackMostPopular = useMemo(() => {
```
Replace with:
```ts
  const fallbackMostActive = useMemo(() => {
```

**c)** Find in the useEffect dependency array and body:
```ts
    if (effectiveMyChallenges.length > 0 || effectiveMostPopular.length > 0) return;
```
Replace with:
```ts
    if (effectiveMyChallenges.length > 0 || effectiveMostActive.length > 0) return;
```

**d)** Find in the useEffect dependency array:
```ts
  }, [user?.uid, isLoading, isError, effectiveMyChallenges.length, effectiveMostPopular.length, refetch]);
```
Replace with:
```ts
  }, [user?.uid, isLoading, isError, effectiveMyChallenges.length, effectiveMostActive.length, refetch]);
```

**e)** Find the section header:
```tsx
              <h3 className="st-section-label">Most Popular</h3>
```
Replace with:
```tsx
              <h3 className="st-section-label">Most Active</h3>
```

**f)** Find all 4 remaining occurrences of `effectiveMostPopular` in JSX (the `TrendingChallenges` render block):
```tsx
            {effectiveMostPopular.length > 0 && (
              <TrendingChallenges
                challenges={effectiveMostPopular}
                onSelectChallenge={(challengeId) => {
                  const selected = effectiveMostPopular.find((item) => item.id === challengeId);
```
Replace with:
```tsx
            {effectiveMostActive.length > 0 && (
              <TrendingChallenges
                challenges={effectiveMostActive}
                onSelectChallenge={(challengeId) => {
                  const selected = effectiveMostActive.find((item) => item.id === challengeId);
```

**g)** Find the empty state check:
```tsx
            {effectiveMostPopular.length === 0 && (
```
Replace with:
```tsx
            {effectiveMostActive.length === 0 && (
```

- [ ] **Step 7: Run the test**

```
npx tsx scripts/testHomeChallengeFeeds.ts
```

Expected: all guards pass.

- [ ] **Step 8: TypeScript check**

```
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 9: Commit**

```bash
git add src/features/Home/useHomeScreen.ts src/features/Home/HomeScreen.tsx scripts/testHomeChallengeFeeds.ts
git commit -m "feat(p18i-6i): replace Most Popular with Most Active ranked by totalLogs"
```

---

### Task 3: Full validation suite + CHANGELOG + report

**Files:**
- Read only: all test scripts
- Modify: `docs/reports/member-phase-10c-change-log.md`
- Create: `docs/superpowers/reports/phase-18I-6I-home-challenge-relevance.md`

- [ ] **Step 1: Run full validation suite**

Run each command and confirm it passes before proceeding to the next:

```
npx tsc --noEmit
```
Expected: clean.

```
npm run build
```
Expected: built successfully (chunk size warnings are pre-existing, not failures).

```
npx tsx scripts/testHomeChallengeFeeds.ts
```
Expected: all guards pass including the 11 new Phase 18I-6I guards.

```
npx tsx scripts/testChallengeActivityModel.ts
```
Expected: 44/44 passed.

```
npx tsx scripts/testScoringGuards.ts
```
Expected: all passed.

```
npx tsx scripts/testHomeChallengeFeeds.ts && npx tsx scripts/testChallengeCreationBackend.ts
```
Expected: all passed.

```
npx tsx scripts/testChallengeCreation6Combinations.ts
```
Expected: all passed.

```
npx tsx scripts/auditChallengeCreationPayloads.ts
```
Expected: all passed.

```
npx tsx scripts/testAdminChallengeManagement.ts
```
Expected: 66/66 passed.

- [ ] **Step 2: Write the implementation report**

Create `docs/superpowers/reports/phase-18I-6I-home-challenge-relevance.md` with:

```markdown
# Phase 18I-6I: Home Challenge Cards Relevance

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers
**Status:** ✅ Complete

## Changes

### My Challenges — sort by recent user activity

`useHomeScreen.ts`: `ongoingMemberChallenges` now sorted before `.slice(0, 10)`:
- Tier 1: challenges with `lastActivityAt` → descending (most recently logged first)
- Tier 2: no `lastActivityAt` → ascending `endDate` (soonest deadline first)
- Limit raised from 3 → 10 (carousel shows 3 at a time, user swipes for more)
- Zero new Firestore reads: `lastActivityAt` was already in `membershipSummaries`

### Most Active — ranked by totalLogs

`useHomeScreen.ts`:
- `mostPopularOngoing` renamed to `mostActiveOngoing` in type and return value
- Batch-reads `challengeActivitySummaries/{id}` for all ongoing candidate IDs (chunked `in` queries, ≤6 batches)
- Sort: `totalLogs` desc → `participantCount` desc fallback
- Missing docs treated as `totalLogs = 0` (not excluded)
- Stat label: `"X logs"` when `totalLogs > 0`; `"X members"` fallback
- Limit raised from 3 → 5

`HomeScreen.tsx`:
- Section header: `"Most Popular"` → `"Most Active"`
- All `effectiveMostPopular` / `fallbackMostPopular` / `mostPopularOngoing` references renamed

## Guards added

11 new guards in `scripts/testHomeChallengeFeeds.ts`.

## Validation

[Paste actual suite output here]

## Manual Test Checklist

- [ ] My Challenges: a challenge logged today appears before an unlogged joined challenge
- [ ] My Challenges: with no logs anywhere, joined challenges sort by nearest end date
- [ ] My Challenges: up to 10 cards appear (swipe carousel to see cards 4–10)
- [ ] Most Active: section header reads "Most Active"
- [ ] Most Active: a challenge with many logs appears before one with more participants but fewer logs
- [ ] Most Active: card shows "X logs" (not "X people joined") for active challenges
- [ ] Most Active: card shows "X members" for challenges with no activity summary
- [ ] Competitive/Streak challenges still show correct progress on My Challenges cards
- [ ] Live progress enrichment still works on first My Challenges card
- [ ] Privacy: only challenges from accessible groups/public appear
```

- [ ] **Step 3: Update CHANGELOG**

Prepend the following to `docs/reports/member-phase-10c-change-log.md`:

```markdown
## Session: Phase 18I-6I — Home Challenge Cards Relevance (2026-07-03)

**Type:** UX relevance improvement. No schema changes, no Cloud Functions, no migrations.

### Changes

**My Challenges** (`useHomeScreen.ts`):
- Sort changed from `startDate desc` to: Tier 1 `lastActivityAt desc` (recently logged challenges first), Tier 2 `endDate asc` (soonest deadline for unlogged challenges). Uses `lastActivityAt` already in membership summaries — zero new reads.
- Limit raised from 3 → 10 (carousel shows 3 at a time, swipe for more).

**Most Active** (was "Most Popular") (`useHomeScreen.ts` + `HomeScreen.tsx`):
- Section renamed from "Most Popular" → "Most Active".
- Now batch-reads `challengeActivitySummaries/{id}` (Cloud Function–maintained aggregate) for all ongoing candidates.
- Sorted by `totalLogs` desc → `participantCount` desc fallback.
- Missing `challengeActivitySummaries` treated as `totalLogs = 0`; challenge not excluded.
- Stat label: `"X logs"` / `"X members"` fallback.
- Limit raised from 3 → 5.

### Guards

11 new guards in `scripts/testHomeChallengeFeeds.ts`.

### Report

`docs/superpowers/reports/phase-18I-6I-home-challenge-relevance.md`

---
```

- [ ] **Step 4: Commit docs**

```bash
git add docs/reports/member-phase-10c-change-log.md docs/superpowers/reports/phase-18I-6I-home-challenge-relevance.md
git commit -m "docs(p18i-6i): add implementation report and CHANGELOG entry"
```
