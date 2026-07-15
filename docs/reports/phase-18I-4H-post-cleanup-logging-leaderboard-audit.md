# Phase 18I-4H — Post-Cleanup Leaderboard and Logging Smoke Audit

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Audit-only phase — no code changes

---

## 1. Seeded challengeMembers Audit

`npm run audit:seeded-challenge-members` requires `GOOGLE_APPLICATION_CREDENTIALS` (firebase-admin service account). The credential is **not set** in this environment. The env guard fires immediately:

```
Error: Missing GOOGLE_APPLICATION_CREDENTIALS. Set it to the service-account JSON path.
```

**Operator action required:**
```bash
export GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
npm run audit:seeded-challenge-members
```

The script will then print a dry-run report of all seeded/orphaned `challengeMembers` docs. Until this is run and reviewed, the candidateDeleteCount is unknown. The script is confirmed safe (dry-run default, `--execute` required for deletions).

---

## 2. Static Code Audit — All Four Screens

### 2A — ChallengeDetailScreen mini-leaderboard

**Data source:** `challengeMembers where challengeId == resolvedChallenge.id`
(line 91 — `ChallengeDetailScreen.tsx`)

**Name resolution:** Targeted `users/{uid}` fetch for each leaderboard entry's userId only — stored in `leaderboardNames` map (lines 141–164). No `groupMembers` consulted.

**Display:** `leaderboardNames.get(entry.userId) ?? 'Member XXXXXX'` — safe fallback for missing profiles. No raw `userId.slice(0, 8)` remains (Phase 18I-4D).

**Cache invalidation:** `challenge-leaderboard-snapshot` key invalidated by both `useLogWorkout` and `useLogWellnessActivity` after logging (Phase 18I-4A).

**Sorting:** delegated to `sortLeaderboardRows(rows, engineVersion, challengeType)` — no inline `.sort()` (Phase 18I-2C guard confirms this).

**Findings:** ✅ Clean. Only challenge participants appear. Names are resolved or fall back gracefully.

---

### 2B — ChallengeLeaderboardScreen

**Data source:** `challengeMembers where challengeId == challengeId`
(line 29 — `ChallengeLeaderboardScreen.tsx`)

**Name resolution:** `useChallengeParticipantNames(participantUserIds)` where `participantUserIds = rawRows.map(r => r.userId)` — exactly the set of challenge members, fetched as `users/{uid}` docs. No `useGroupMembers` call (Phase 18I-4D).

**Missing challengeId guard:** `const challengeId = params.get('challengeId') ?? ''` — queries disabled when empty (`enabled: !!challengeId`). Early redirect: `if (!challengeId) return <Navigate to="/app/challenges" replace />` (line 133). (Phase 18I-4F)

**Fallback name display:** `Member ${uid.slice(0, 6).toUpperCase()}` — safe, scoped only to actual participants.

**Sorting:** `sortLeaderboardRows(rawRows, engineVersion, challengeType)` — no inline sort.

**Engine-aware scoring display:** competitive → `%`, streak → `days`, collective → contribution value, legacy → `pts`. All branches present.

**Findings:** ✅ Clean. Unrelated group members cannot appear. Missing `challengeId` redirects safely.

---

### 2C — GroupFeedScreen

**Data flow:**
```
GroupFeedScreen
  → useGroupFeed(groupId)                          [src/hooks/useGroupInsights.ts:8]
  → queryKey: ['group-feed', groupId, user?.uid]
  → groupInsightsService.getGroupFeed(groupId)     [src/services/groupInsightsService.ts]
  → reads workouts (completedAt desc, limit 10)    [Phase 18I-4B]
  → reads wellnessLogs (loggedAt desc, limit 10)   [Phase 18I-4B]
  → merges, deduplicates, sorts newest-first, slice(0, 10)
```

**Cache invalidation:** `['group-feed']` broad key invalidated by both `useLogWorkout` (line 93) and `useLogWellnessActivity` (line 142) in `useWorkouts.ts`. (Phase 18I-4G)

**Wellness log visibility:** wellnessLogs are now read and merged into the feed alongside workouts — previously invisible. (Phase 18I-4B)

**Challenge-created fallback:** only shown when both `workouts` and `wellnessLogs` are empty for the group. (Phase 18I-4B)

**Findings:** ✅ Clean. Feed refreshes immediately after any log. Wellness entries visible. No `groupMembers` consulted for feed content.

---

### 2D — SelectChallengeActivityScreen progress display

**Key resolution:** `resolveActivityKey(activity)` helper returns `activity.activityId ?? activity.exerciseId ?? activity.exerciseName ?? ''` — matching the engine's `primaryKey = act.activityId ?? act.exerciseId ?? ''`. (Phase 18I-4C)

**CumulativeValues lookup:** `membership?.cumulativeValues?.[resolveActivityKey(activity)] ?? 0` — correct order, no reversed fallback.

**Engine write path matches:**
- Wellness logging → `wellnessLogService` sets `logEvent.activityId = input.activityId` → engine writes `cumulativeValues[activityId]` → screen reads `cumulativeValues[activityId]` ✅
- Fitness logging → `workoutService` sets `logEvent.activityId = input.exerciseId` → engine writes `cumulativeValues[exerciseId]` → screen reads `cumulativeValues[exerciseId]` ✅

**Findings:** ✅ Clean. 0/7,000 bug resolved. Progress accumulates correctly for both workout and wellness challenge types.

---

## 3. Confirmation: No Banned Patterns Remain

| Pattern | Files checked | Found |
|---------|--------------|-------|
| `core-blast` | All 4 UI screens | None ✅ |
| `coreBlast` | All 4 UI screens | None ✅ |
| `useGroupMembers` | ChallengeLeaderboardScreen, ChallengeDetailScreen | None ✅ |
| `userId.slice(0, 8)` raw display | ChallengeDetailScreen | None ✅ |
| Inline `.sort()` in leaderboard | ChallengeDetailScreen, ChallengeLeaderboardScreen | None ✅ |
| Reversed `exerciseId \|\| activityId` key | SelectChallengeActivityScreen | None ✅ |
| `seed_` / `tiizi_seed` in UI | All 4 UI screens | None ✅ |

---

## 4. Known Remaining Issues (Out of Scope for 18I Series)

| ID | Issue | Status |
|----|-------|--------|
| BUG-3-6 | `getGroupLeaderboard` totals `totalPoints` across **all** challenges in the group (all-time model), not just one active challenge. Located in `groupInsightsService.getGroupLeaderboard` (line 253–276). | Deferred — architectural change, not a data correctness emergency |
| CONCERN-I-3 | Group leaderboard labels don't distinguish v1 vs v2 point models | Deferred |
| Seed data cleanup | `GOOGLE_APPLICATION_CREDENTIALS` not set → `audit:seeded-challenge-members` cannot run | Operator action required (set credentials, then run dry-run) |

---

## 5. Files Changed

None. This is a pure audit phase. All fixes were applied in Phases 18I-4A through 18I-4G.

---

## 6. Manual Retest Steps

These steps require a live Firebase-connected browser session:

### Mini-leaderboard (ChallengeDetailScreen)
1. Open a competitive wellness challenge with 2–3 real users
2. Confirm leaderboard shows real display names (not raw UIDs like `abc12345`)
3. Log an activity → return to challenge detail → confirm mini-leaderboard updates immediately (stale cache ≤ 60s)

### Full leaderboard (ChallengeLeaderboardScreen)
1. Navigate to `/app/challenges/leaderboard?challengeId=<id>&groupId=<gid>`
2. Confirm only challenge participants appear (users who joined via challengeMembers)
3. Confirm names match real user profiles
4. Remove `challengeId` from URL → confirm redirect to `/app/challenges`

### Group feed (GroupFeedScreen)
1. Navigate to group feed
2. Log a **workout** for a challenge in that group
3. Return to feed immediately — new entry should appear without refresh
4. Log a **wellness activity** (e.g., steps) for the same group's challenge
5. Return to feed — wellness entry should appear alongside workout entry

### SelectChallengeActivityScreen progress
1. Open a competitive challenge's activity selection screen
2. Confirm progress bars show accumulated values (not 0/target after having logged)
3. Log another activity
4. Return to the activity screen — progress bars should update

---

## 7. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 2.99s
npm run test:scoring-guards               → ✅ All guards passed
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
npm run audit:seeded-challenge-members    → ⚠️  GOOGLE_APPLICATION_CREDENTIALS not set
                                              Operator must configure credentials and re-run
```

---

## 8. Phase 18I Series Summary

All phases from 18I-2A through 18I-4H are complete. Total fixes delivered:

| Phase | Bug | Fix |
|-------|-----|-----|
| 18I-2A | BUG-I-2 | `wellnessLogService` undefined Firestore payloads — `removeUndefinedDeep` applied |
| 18I-2B | BUG-I-1 | Mini-leaderboard always showed `totalPoints` — engine-sensitive score/label |
| 18I-2C | — | Regression guards for logging + leaderboard invariants |
| 18I-3 | — | Full logging flow integrity audit |
| 18I-4A | BUG-3-1 | Mini-leaderboard stale cache — `challenge-leaderboard-snapshot` invalidated |
| 18I-4B | BUG-3-4 | Wellness logs invisible in group feed — `wellnessLogs` merged into `getGroupFeed` |
| 18I-4C | BUG-3-3 | `SelectChallengeActivityScreen` showed 0/target — `resolveActivityKey` helper, key order fixed |
| 18I-4D | BUG-3-2 | Leaderboard showed unrelated group members — targeted `users/{uid}` fetch |
| 18I-4E | — | Safe cleanup script for seeded/orphaned `challengeMembers` (operator runs when ready) |
| 18I-4F | BUG-3-5 | `core-blast` fallbacks removed — safe redirects replace fake IDs |
| 18I-4G | BUG-3-7 | Group feed not invalidated after log — `group-feed` key added to both mutation handlers |
| 18I-4H | — | Post-cleanup smoke audit (this report) |
