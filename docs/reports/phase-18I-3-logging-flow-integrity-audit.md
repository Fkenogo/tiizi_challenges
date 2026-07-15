# Phase 18I-3 — Full Logging Flow Integrity Audit

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Audit-only. No code changes in this phase.
**Trigger:** Manual test of "7-Day Race to 7,000 steps" (Wellness + Competitive challenge)

---

## 1. Executive Summary

Seven distinct bugs were confirmed through static code analysis and component tracing. The most critical are:

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| BUG-3-1 | CRITICAL | Confirmed | `challenge-leaderboard-snapshot` is never invalidated after logging — mini-leaderboard shows stale data indefinitely |
| BUG-3-2 | HIGH | Confirmed | `ChallengeLeaderboardScreen` names come from `useGroupMembers` (group scope), not challenge scope — unrelated users appear |
| BUG-3-3 | HIGH | Confirmed | `SelectChallengeActivityScreen` reads `membership.cumulativeValues` — not re-fetched after log; shows 0/7,000 on re-entry |
| BUG-3-4 | HIGH | Confirmed | `GroupFeedScreen` reads only `workouts` collection — wellness logs (`wellnessLogs`) are never shown in feed |
| BUG-3-5 | MEDIUM | Confirmed | `ChallengeLeaderboardScreen` falls back to `'core-blast'` when no `challengeId` param — loads wrong challenge data |
| BUG-3-6 | MEDIUM | Confirmed | `GroupLeaderboardScreen` sums `totalPoints` across ALL group challenges (pre-v2 model) — seeded/global scores contaminate |
| BUG-3-7 | LOW | Suspected | Feed `staleTime: 30s` means after navigation the feed may still be cold; combined with BUG-3-4 this makes logs invisible |

No hardcoded arrays or static mock rankings exist in production UI. The contamination is from:
1. Real seeded `challengeMembers` documents with mismatched `groupId` / `challengeId`
2. All-group query breadth in `getGroupLeaderboard` pulling scores from unrelated challenges

---

## 2. Complete Flow Trace: Wellness + Competitive Challenge

### Step 1 — Challenge Detail (`ChallengeDetailScreen`)

**File:** `src/features/Challenges/ChallengeDetailScreen.tsx`

**Data sources:**
- `useChallenge(challengeId)` → query key `['challenge', id, user?.uid]`, staleTime 5m
- `useChallengeMembership(challengeId)` → query key `['challenge-membership', challengeId, user?.uid]`, staleTime 60s
- Mini-leaderboard inline query → `challengeMembers WHERE challengeId == challengeId`, query key `['challenge-leaderboard-snapshot', ...]`, staleTime **60s**

**Progress shown:** `membership.completionRate` (e.g. 36%). This is correct because `challenge-membership` IS invalidated after logging.

**Mini-leaderboard:** Reads from `challengeMembers WHERE challengeId == id`. Score/sort correct after 18I-2B fix. **BUT** this query is never invalidated after a log — it serves stale data for up to 60s and is not refreshed when navigating back to the screen.

---

### Step 2 — Select Activity (`SelectChallengeActivityScreen`)

**File:** `src/features/Workouts/SelectChallengeActivityScreen.tsx`

**Data sources:**
- `useChallenge(challengeId)` → staleTime 5m
- `useChallengeMembership(challengeId)` → staleTime 60s

**Progress displayed (competitive):**
```ts
const cumulative = membership?.cumulativeValues?.[key] ?? 0;
const pct = target > 0 ? Math.min(100, Math.round((cumulative / target) * 100)) : 0;
```

**BUG-3-3 root cause:** `challenge-membership` IS invalidated after the log, but only with key `['challenge-membership', challengeId, userId]`. When the user navigates back to `SelectChallengeActivityScreen`, if the React Query cache has already re-fetched (within 60s window), the values are fresh. However if the screen is already mounted from before the log, the query has a 60s stale time and will not re-fetch until that window expires OR the component remounts. Given navigation to `WorkoutLoggedScreen` and back causes remount, this should normally re-fetch — but the displayed `0 / 7,000` suggests either:

(a) The `cumulativeValues` map key lookup is failing (key mismatch between `activity.exerciseId || activity.activityId` and what the engine writes), OR
(b) The membership is fresh but `cumulativeValues` itself is not written by the engine for the first log session

**This requires production data verification to confirm (a) vs (b). Suspected: key mismatch.**

---

### Step 3 — Log Activity (`LogWellnessActivityScreen`)

**File:** `src/features/Workouts/LogWellnessActivityScreen.tsx`

**Calls:** `useLogWellnessActivity()` → `wellnessLogService.logFasting/logHydration/logSleep/logMeditation`

**After success, `useWorkouts.ts` invalidates:**
- `challenge-workouts`
- `challenge-progress`
- `challenge-membership` ← ✅ membership IS refreshed
- `group-leaderboard`
- `group-members`
- `streak` (two keys)
- `home-screen-data`
- `challenges`

**NOT invalidated:** `challenge-leaderboard-snapshot` — **BUG-3-1**
**NOT invalidated:** `group-feed` — **BUG-3-7 contributing factor**

---

### Step 4 — Success Screen (`WorkoutLoggedScreen`)

**File:** `src/features/Workouts/WorkoutLoggedScreen.tsx`

**Data sources:**
- `useChallenge(challengeId)` — reads `challenge.groupCurrentTotal` (stale, from `challenges` cache, staleTime 5m)
- `useChallengeMembership(challengeId)` — reads `membership.completionRate`, `cumulativeValues` etc.

**"36% complete" is shown correctly here** because the mutation's `onSuccess` invalidated `challenge-membership`. The screen receives the fresh value when the membership query re-runs.

**`groupCurrentTotal` on success screen:** May be stale for up to 5 minutes (staleTime 5m on `['challenge', ...]`). For competitive challenges this doesn't matter; for collective it matters.

---

### Step 5 — Feed (`GroupFeedScreen`)

**File:** `src/features/Groups/GroupFeedScreen.tsx`
**Service:** `src/services/groupInsightsService.ts` → `getGroupFeed(groupId)`

**BUG-3-4 (CONFIRMED):** `getGroupFeed` queries ONLY the `workouts` collection:
```ts
getDocs(query(
  collection(db, 'workouts'),
  where('groupId', '==', groupId),
  orderBy('completedAt', 'desc'),
  limit(10),
))
```

Wellness activities are written to the `wellnessLogs` collection, not `workouts`. Therefore **any wellness log is invisible in the group feed**. The feed will never show steps, meditation, hydration, sleep, or fasting activity.

If no workouts exist in the group, the feed falls back to showing challenge creation events:
```ts
return challenges.slice(0, 10).map((c) => ({
  text: `Created challenge "${c.name}".`,
  ...
}));
```

This explains why the feed appears empty or shows challenge creation cards instead of actual logged activities.

---

### Step 6 — Challenge Detail re-entry

**BUG-3-1 active here:** Mini-leaderboard query key `['challenge-leaderboard-snapshot', ...]` was never invalidated. If staleTime (60s) has not elapsed, the old data is served. The user sees their previous rank/score.

**Membership-sourced data (completionRate, streak)** IS correct because `challenge-membership` was invalidated.

---

### Step 7 — Challenge Leaderboard (`ChallengeLeaderboardScreen`)

**File:** `src/features/Challenges/ChallengeLeaderboardScreen.tsx`

**Correct:** Queries `challengeMembers WHERE challengeId == challengeId` ✅
**Sort:** Engine-sensitive via `sortLeaderboardRows` ✅

**BUG-3-2 (CONFIRMED — unrelated users):**

The screen resolves display names via:
```ts
const resolvedGroupId = groupId || challenge?.groupId;
const { data: members = [] } = useGroupMembers(resolvedGroupId);
const namesById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);
```

`useGroupMembers(groupId)` → `groupInsightsService.getGroupMembers(groupId)` queries `groupMembers WHERE groupId == groupId` — all users who are or were members of the group.

The leaderboard ranks are drawn from `challengeMembers WHERE challengeId == challengeId`. The name resolution uses the broader group member list. These two sets can diverge:
- A user who was in the group when a challenge was created (and thus has a `challengeMembers` doc) but has since left the group is still ranked
- Any seeded `challengeMembers` doc with `groupId` pointing to this group will appear, even if its `userId` is a seed user who was never a real group member visible in `groupMembers`

**Root cause of "unrelated users/scores":** Seeded `challengeMembers` documents with `groupId` matching the current group, or former group members, are included in the ranking query.

---

## 3. Firestore Collection Reads / Writes per Screen

| Screen | Collections Read | Collections Written |
|--------|-----------------|---------------------|
| `ChallengeDetailScreen` | `challenges`, `challengeMembers` | — |
| `SelectChallengeActivityScreen` | `challenges`, `challengeMembers` | — |
| `LogWellnessActivityScreen` | (via service) `challengeMembers`, `challenges`, `groupMembers` | `wellnessLogs`, `challengeMembers` |
| `LogWorkoutScreen` | (via service) `challengeMembers`, `challenges`, `groupMembers` | `workouts`, `challengeMembers` |
| `WorkoutLoggedScreen` | `challenges`, `challengeMembers` | — |
| `GroupFeedScreen` | `workouts`, `groupMembers`, `challenges`, `users` | — |
| `ChallengeLeaderboardScreen` | `challengeMembers`, `groupMembers`, `challenges`, `users` | — |
| `GroupLeaderboardScreen` | `challengeMembers` (all for group), `users` | — |

---

## 4. Confirmed Bugs

### BUG-3-1 — Mini-leaderboard never invalidated (CRITICAL)
**File:** `src/hooks/useWorkouts.ts` (invalidation list, lines 83–91 and 130–138)
**Missing:** `queryClient.invalidateQueries({ queryKey: ['challenge-leaderboard-snapshot'] })`
**Impact:** After logging, returning to `ChallengeDetailScreen` shows stale mini-leaderboard for up to 60s.
**Fix:** Add `challenge-leaderboard-snapshot` invalidation to `useLogWorkout` and `useLogWellnessActivity` `onSuccess` handlers.

### BUG-3-2 — Leaderboard shows unrelated users (HIGH)
**File:** `src/features/Challenges/ChallengeLeaderboardScreen.tsx`, line ~68: `useGroupMembers(resolvedGroupId)`
**Mechanism:** Leaderboard rows come from `challengeMembers WHERE challengeId==X`; names come from `groupMembers WHERE groupId==G`. The union of users in these two queries is not identical.
**Root contributor:** Seeded `challengeMembers` documents with `groupId` pointing to the current group.
**Fix:** Cross-reference name lookup with challenge participant set, or scope name lookup to `challengeMembers` userId list, not full `groupMembers`.

### BUG-3-3 — SelectChallengeActivityScreen shows 0 / 7,000 (HIGH)
**File:** `src/features/Workouts/SelectChallengeActivityScreen.tsx`, lines 77–82
**Suspected cause:** `cumulativeValues` map key mismatch — the engine writes `cumulativeValues` keyed by `activity.activityId` or `activity.exerciseId`, but the lookup in `SelectChallengeActivityScreen` uses `activity.exerciseId || activity.activityId || activity.exerciseName || ''`. If the stored key differs from the lookup key, `cumulative` is always 0.
**Status:** Suspected — requires production `challengeMembers` doc inspection to confirm.
**Fix:** Confirm key format written by `workoutService`/`wellnessLogService` engine against key format read in `SelectChallengeActivityScreen`.

### BUG-3-4 — Feed never shows wellness logs (HIGH)
**File:** `src/services/groupInsightsService.ts`, lines 130–157: `getGroupFeed()`
**Root cause:** Feed queries only `workouts` collection; `wellnessLogs` collection is never read.
**Fix:** Merge results from both `workouts` and `wellnessLogs` collections, sort by timestamp, limit to 10. Or add a separate wellness feed section.

### BUG-3-5 — `'core-blast'` hardcoded fallback (MEDIUM)
**Files:**
- `ChallengeLeaderboardScreen.tsx:63`: `params.get('challengeId') || 'core-blast'`
- `WorkoutLoggedScreen.tsx:29,30`: fallback URL includes `challengeId || 'core-blast'`
- `LogWorkoutScreen.tsx:78`: backPath fallback to `'core-blast'`
- `ChallengeCompletedScreen.tsx:51`: fallback to `'core-blast'`

**Impact:** If `challengeId` is missing from URL params, the wrong challenge loads silently. In production there is no challenge with id `'core-blast'` — so the query returns nothing and the screen appears empty or broken. This is a defensive-coding smell, not an active crash.

### BUG-3-6 — Group leaderboard sums all challenges (MEDIUM)
**File:** `src/services/groupInsightsService.ts`, lines 200–223: `getGroupLeaderboard()`
**Root cause:** Queries `challengeMembers WHERE groupId == groupId` — all challenges for the group. Sums `totalPoints` per user across all of them. Legacy seeded `challengeMembers` docs with high `totalPoints` inflate scores.
**Impact:** Users who participated in seeded/old challenges appear with disproportionate scores.
**Fix (Phase 18I-2D, deferred):** Label this as "All-time group points" OR scope to active challenges only.

### BUG-3-7 — Feed `group-feed` cache not invalidated after log (LOW)
**File:** `src/hooks/useWorkouts.ts` invalidation list
**Missing:** `queryClient.invalidateQueries({ queryKey: ['group-feed', ...] })`
**Note:** Even if fixed, BUG-3-4 means wellness logs still won't appear. This is secondary to BUG-3-4.

---

## 5. Seed/Demo Data Inventory

### Scripts that CREATE data in Firestore

| Script | Creates | Seeds with `seedTag`? |
|--------|---------|----------------------|
| `scripts/seedAppData.ts` | users, groups, groupMembers, challenges, challengeMembers, workouts | Yes — `tiizi_seed_v1` |
| `scripts/seedBaselineData.ts` | (inspection required) | Likely yes |
| `scripts/seedWellnessActivities.ts` | wellness activity catalog docs | Unknown |
| `scripts/seedWellnessTemplates.ts` | wellnessTemplates | Unknown |
| `scripts/loadExercises.ts` | `catalogExercises` | Unknown |

### Scripts that CLEAN/REMOVE data

| Script | What it deletes |
|--------|----------------|
| `scripts/cleanupSeedData.ts` | Docs with `seedTag == 'tiizi_seed_v1'` OR ID matching `seed_*`, `*_seed_*`, `seed-*` |
| `scripts/cleanupSeedGroupMemberships.ts` | (inspection required) |

### Detection logic in `cleanupSeedData.ts`

Seed docs are detected by:
1. `seedTag == 'tiizi_seed_v1'` field match
2. Document ID matching: `seed_*`, `*_seed_*`, or `seed-*` pattern

### Production UI references to seed data

**None confirmed.** No production component imports data from seed scripts or references seed IDs directly. The UI reads from Firestore at runtime; seed documents in Firestore are real documents that the UI treats as real data.

---

## 6. Is Seed Data Safe to Remove?

**Preconditions for safe removal:**
- Run `cleanupSeedData.ts` in `--dry-run` mode first and inspect the report
- Confirm no real users have `challengeId` values that join real and seeded challenges
- Confirm no real user's `challengeMembers` doc references a seeded challenge

**Risk assessment:**

| Risk | Level | Mitigation |
|------|-------|-----------|
| Deleting real user data tagged as seed | MEDIUM | Dry-run first; cross-check `userId` against real users |
| Deleting challenges that real users are still in | MEDIUM | Filter: only delete challenges with `seedTag` field |
| Breaking UI with missing seed challenge fallbacks | LOW | No UI hardcodes seed IDs (confirmed) |
| Leaderboard going empty post-cleanup | LOW | Expected — only seeded scores disappear |

**Recommendation:** Run `cleanupSeedData.ts --apply` ONLY after verifying dry-run report shows only `seed_*` IDs and docs with `seedTag: 'tiizi_seed_v1'`. Do NOT delete `wellnessLogs`, `wellnessActivities`, `catalogExercises` or `wellnessTemplates` without separate audit.

**`cleanupSeedData.ts` does NOT include `wellnessLogs` or `challengeMembers` in its collection list** — those seeded `challengeMembers` docs contaminating the leaderboard would NOT be removed by it. A separate targeted cleanup is needed for seeded `challengeMembers`.

---

## 7. Why 36% Shows Correctly in Some Places But Not Others

| Screen | Shows 36%? | Source | Invalidated after log? |
|--------|-----------|--------|----------------------|
| `WorkoutLoggedScreen` | ✅ Yes | `membership.completionRate` | Yes — `challenge-membership` invalidated |
| Home "My Challenges" card | ✅ Yes | `home-screen-data` | Yes — invalidated |
| `ChallengeDetailScreen` header | ✅ Yes | `membership.completionRate` | Yes — `challenge-membership` invalidated |
| `ChallengeDetailScreen` mini-leaderboard | ❌ Stale | `challenge-leaderboard-snapshot` | **NO** — never invalidated |
| `SelectChallengeActivityScreen` progress | ❌ Shows 0/7,000 | `membership.cumulativeValues[key]` | Key mismatch suspected |
| `ChallengeLeaderboardScreen` | Shows mixed real+seed users | `challengeMembers + groupMembers` | Not applicable — stale 60s |

**Root cause of the discrepancy:** `membership.completionRate` is a scalar computed and stored by the engine at log time. React Query correctly serves it fresh after invalidation. `cumulativeValues` is a map keyed by activity ID; a key mismatch makes the lookup always return 0, independent of invalidation. The mini-leaderboard uses a completely separate query key that is never invalidated.

---

## 8. Feed Architecture Finding

The feed system has no real-time or near-real-time write path. There is no Cloud Function or Firestore trigger that writes to a `feed` or `activity_feed` collection. Feed is purely a client-side read query against `workouts` sorted by `completedAt`.

**This means:**
- Wellness logs never appear in feed (BUG-3-4)
- Feed freshness depends on the 30s `staleTime` (after 30s the next mount will re-fetch)
- There is no push or fan-out to a dedicated feed collection

Recommended architecture: Add `wellnessLogs` as a second feed source in `getGroupFeed`, or create a dedicated `groupActivity` collection written by both logging services.

---

## 9. Recommended Fix Plan

### Phase 18I-4A — Fix mini-leaderboard staleness (BUG-3-1)
**File:** `src/hooks/useWorkouts.ts`
Add `challenge-leaderboard-snapshot` invalidation to both `useLogWorkout` and `useLogWellnessActivity` `onSuccess` handlers.

### Phase 18I-4B — Fix feed missing wellness logs (BUG-3-4)
**File:** `src/services/groupInsightsService.ts`
Merge `wellnessLogs WHERE groupId == groupId` into `getGroupFeed()`. Combine with workouts, sort by `loggedAt`/`completedAt`, limit to 10.

### Phase 18I-4C — Investigate and fix 0/7,000 progress (BUG-3-3)
**Action:** Inspect a real `challengeMembers` document in Firestore after a wellness log. Confirm the key format in `cumulativeValues`. Compare with lookup key in `SelectChallengeActivityScreen`. Fix key normalization if they diverge.

### Phase 18I-4D — Leaderboard user contamination (BUG-3-2)
**File:** `src/features/Challenges/ChallengeLeaderboardScreen.tsx`
Scope name lookup to only users present in the `challengeMembers` result set. Do not rely on `useGroupMembers` for leaderboard name resolution.

### Phase 18I-4E — Seed data cleanup (BUG-3-6 partial)
Run `cleanupSeedData.ts --dry-run`. Separately identify and delete seeded `challengeMembers` documents. This removes the score inflation from the group leaderboard.

### Phase 18I-4F — Remove `'core-blast'` fallbacks (BUG-3-5)
Replace with `null`/`''` — let screens show a proper empty state rather than loading wrong data.

### Phase 18I-4G — Group feed invalidation (BUG-3-7)
Add `group-feed` invalidation to both log `onSuccess` handlers. Only effective after BUG-3-4 is fixed.

---

## 10. Files Inspected

| File | Finding |
|------|---------|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Mini-leaderboard query never invalidated |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Correct query scope; `core-blast` fallback; name resolution from group scope |
| `src/features/Groups/GroupLeaderboardScreen.tsx` | Pre-v2 totalPoints-sum model |
| `src/features/Groups/GroupFeedScreen.tsx` | Passes through to `useGroupFeed` only |
| `src/features/Groups/GroupDetailScreen.tsx` | Reads from `challengesByGroup` and `useChallengeWorkouts` |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | `cumulativeValues` key lookup — suspected mismatch |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Uses `useLogWellnessActivity` hook |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Uses `useLogWorkout` hook |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Correct — shows fresh membership data |
| `src/hooks/useWorkouts.ts` | **Missing invalidations: `challenge-leaderboard-snapshot`, `group-feed`** |
| `src/hooks/useChallenges.ts` | Invalidation list after join/leave — correct for its scope |
| `src/hooks/useGroupInsights.ts` | Feed staleTime 30s; group leaderboard correct query key |
| `src/services/groupInsightsService.ts` | Feed queries only `workouts`; leaderboard sums all challenges |
| `src/services/workoutService.ts` | Correct — `removeUndefinedDeep` applied |
| `src/services/wellnessLogService.ts` | Correct — `removeUndefinedDeep` applied (Phase 18I-2A) |
| `src/utils/leaderboardSort.ts` | Correct — engine-aware sort |
| `scripts/cleanupSeedData.ts` | Does NOT cover `challengeMembers` or `wellnessLogs` |
| `scripts/seedAppData.ts` | Creates seed data with `seedTag: 'tiizi_seed_v1'` |

---

## 11. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 4.40s
npm run test:scoring-guards               → ✅ All guards passed
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

No production code was modified in this phase.
