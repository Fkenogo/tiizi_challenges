# Phase 12 — Production Readiness Audit

**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Auditor:** Claude (automated)  
**Scope:** Full codebase audit — engines, user journeys, UI, Firestore rules, performance, regressions  

---

## Executive Summary

| Dimension | Score | Notes |
|---|---|---|
| Engine correctness | 62/100 | Critical: streak engine missing required context fields |
| User journeys | 78/100 | Self-heal logic good; leaderboard detail screen inconsistent |
| UI / UX | 82/100 | Good skeleton/empty/error states; profile wins count off |
| Firestore / security | 58/100 | Critical: permissive membershipget rule; unbounded collections scan |
| Performance | 70/100 | Collective cascade batch risk; unbounded group queries |
| Regressions | 90/100 | Legacy routing intact; scoring guards pass |

### Overall Production Readiness Score: **67 / 100**

### Release Recommendation: **NOT READY**

Two critical defects must be fixed before release:
1. Streak engine context missing `requiredConsecutiveDays` / `streakResetOnMiss` — makes streak completion unreliable
2. `getVisibleChallengesForUser` unbounded `getDocs(collection(db, 'groups'))` — scales to O(N) on every call

---

## Validation Baseline

Commands run at audit start (all passed):

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

---

## Part 1 — Engine Verification

### 1.1 Engine Routing (`src/services/challengeEngine/index.ts`)

`selectEngine()` correctly routes v2 challenges on `engineVersion + challengeType`. Unknown v2 types throw loudly (no silent fallback). All four engines loaded: LegacyEngine, StreakEngine, CompetitiveEngine, CollectiveEngine. ✅

### 1.2 Streak Engine Context — CRITICAL BUG

**File:** `src/services/workoutService.ts` and `src/services/wellnessLogService.ts`

Both services build a `ChallengeContext` for the engine call. Neither reads `requiredConsecutiveDays` or `streakResetOnMiss` from the Firestore document, and neither passes them to the context object.

`StreakEngine.computeUpdate()` uses:
```typescript
const requiredDays = context.requiredConsecutiveDays ?? context.durationDays;
```

When `requiredConsecutiveDays` is undefined (because the service didn't pass it), the engine falls back to `durationDays`. For a 7-required-days streak on a 30-day challenge, the engine will require **30 consecutive days** to complete — effectively uncompletable.

Similarly, `streakResetOnMiss` defaults to `true` in the engine when undefined, which may not match the challenge configuration.

**Impact:** All Streak v2 challenges produce incorrect completion detection and streak reset behavior.

**Fix required (both files):**
1. Add `requiredConsecutiveDays?: number; streakResetOnMiss?: boolean` to the local data type cast for `challengeData`
2. Include both fields in the `ChallengeContext` object passed to `selectEngine`

### 1.3 Collective Engine

Race condition on `groupCurrentTotal` accepted and documented. `FieldValue.increment()` handles atomicity. `autoCompleteOnGroupTarget` flag correctly gates cascade. ✅

### 1.4 Competitive Engine

`cumulativeValues[activityId]` per-activity tracking correct. Primary key lookup with `activityId ?? exerciseId` fallback consistent across service and UI. ✅ (Caution: key `act.activityId ?? act.exerciseId` must stay in sync with workout service key `exerciseId` — currently aligned.)

### 1.5 Legacy Engine

Unmodified. Routes correctly on `engineVersion !== 'v2'`. ✅

### 1.6 Scoring

`computeActivityScore` pure, consistent across all engines. `MIN_EFFORT_RATIO = 0.05` applied uniformly. Points capped at 100. ✅

---

## Part 2 — User Journey Audit

### 2.1 Create Challenge

Wizard UX-6 guides 4-step flow with per-step validation. Template pre-fills preserved. Engine-specific fields (Collective: `groupCumulativeTarget`; Streak: `requiredConsecutiveDays`) validated before advancement. ✅

### 2.2 Browse Challenges

`BrowseChallengesScreen`: Group-scoped path uses `getChallengesByGroup` (efficient). Non-group path uses `getChallengesForMyGroups` (one-per-group queries). Filter chips (status, category, type) work client-side on returned results. ✅

### 2.3 Join Challenge

`joinChallenge` in `challengeService` writes `totalActivities = computeRequiredLogs(durationDays, activityCount)`. Firestore rule validates this. Consistent. ✅

### 2.4 Log Workout / Log Wellness

Self-heal present: if membership missing, service calls `joinChallenge` and retries. Engine call correct. Parallel reads for efficiency. ✅

**Caution — `wellnessLogService` accepts `'joined'` status:** GroupMember validation at line ~130 accepts `status === 'active' || status === 'joined'`. If `'joined'` is a pending-approval state, users not yet approved could log against challenges. Risk depends on whether `'joined'` status is granted pre- or post-approval.

### 2.5 Leaderboard

`ChallengeLeaderboardScreen` uses engine-specific sort: Collective → cumulativeLoggedValue; Competitive → completionRate; Streak → currentStreak; Legacy → totalPoints. ✅

**Issue — ChallengeDetailScreen inline leaderboard uses legacy sort:** Lines 74–91 sort by `totalPoints` only, ignoring the challenge's engine. Users see different rankings on the detail screen vs. the dedicated leaderboard screen.

### 2.6 Completion

`ChallengeCompletedScreen` uses engine-specific `useFinalRank` — correct. `staleTime: 5min` appropriate for post-completion data. ✅

**Bug — WorkoutLoggedScreen streak completion check hardcoded:**
```typescript
const streakComplete = currentStreak >= 100;   // line 56
```
Should be `currentStreak >= (challenge.requiredConsecutiveDays ?? challenge.durationDays)`. As written, the "streak complete" celebration never triggers on challenges configured with fewer than 100 required days, and always shows "in progress" for 99-day streaks that are complete.

### 2.7 Group Detail

Progress computation correctly handles both fitness (workouts) and wellness (wellnessLogs). Active challenge display correct. ✅

**Issue:** `activeChallengeWellnessLogs` and `activeChallengeWorkouts` queries have no status filter — they load post-completion logs too, increasing read counts unnecessarily for closed challenges.

### 2.8 Home Screen

`getVisibleChallengesForUser` bounded with `maxResults: 60`. Fallback logic via `accessibleChallenges + membershipIndex` correct. ✅ (Root `getVisibleChallengesForUser` implementation is still critical — see Part 4.)

### 2.9 Profile Screen

**Issue — wins counts group completions, not user completions:**
```typescript
wins = challenges.filter(c => myChallengeIds.has(c.id) && c.status === 'completed').length
```
This counts challenges where the group status is `'completed'`, not where the user's membership has `status: 'completed'`. A user who quit a challenge before completion still gets a win if the group completed it.

### 2.10 Admin Challenges

`CreateChallengeScreen` (admin) not part of member-facing flows — not audited for P0.

---

## Part 3 — UI Audit

### 3.1 States

| Screen | Loading | Empty | Error |
|---|---|---|---|
| ChallengeDetailScreen | ✅ skeleton | ✅ not-found state | ✅ access-denied state |
| ChallengesScreen | Not verified | Partially | Not verified |
| ChallengeLeaderboardScreen | ✅ | ✅ empty podium | Not verified |
| GroupDetailScreen | Partially | Not verified | Not verified |

### 3.2 Engine Visual Language

Consistent across all audit-scope screens: Collective `bg-blue-100 text-blue-700`, Competitive `bg-amber-100 text-amber-700`, Streak `bg-orange-100 text-orange-700`. ✅

### 3.3 Responsive

`max-w-mobile` (480px) container wrapping present. No hardcoded pixel widths observed. ✅

### 3.4 Typography / Spacing

Consistent use of Tailwind utility classes. Primary orange `#ff6b00` / `var(--primary)` used consistently. ✅

---

## Part 4 — Firestore Audit

### 4.1 CRITICAL — Unbounded Collection Scan

**File:** `src/services/challengeService.ts` — `getVisibleChallengesForUser`

```typescript
getDocs(collection(db, 'groups'))   // fetches ALL groups
```

This is an O(N) read on the entire groups collection, called on every render of ChallengesScreen and HomeScreen. As the group count grows, this will exceed Firestore read quotas and cause performance degradation.

**Fix:** Replace with a scoped query: `where('memberIds', 'array-contains', userId)` or use the user's group membership list already available from `useGroups()`.

### 4.2 HIGH — Collective Cascade Batch Limit

**Files:** `src/services/workoutService.ts` and `src/services/wellnessLogService.ts`

When a collective challenge's group target is reached, the service reads all active `challengeMembers` and updates each to `status: 'completed'` in a single batch. Firestore batch writes are capped at **500 operations**. A challenge with 500+ members will silently fail the batch write — leaving members in incomplete state permanently.

**Fix:** Chunk members into batches of 450 (leave safety margin), commit each batch sequentially.

### 4.3 HIGH — Permissive `challengeMembers` Security Rule

**File:** `firestore.rules`, line 182–184

```
allow get: if isAuthenticated() && (
  resource == null || resource.data == null ||
  resource.data.userId == request.auth.uid || isAuthenticated()
);
```

The final `|| isAuthenticated()` makes the `userId` check always true for any logged-in user — any authenticated user can read any challenge membership document.

**Fix:** Remove the trailing `|| isAuthenticated()`:
```
allow get: if isAuthenticated() && (
  resource == null || resource.data == null ||
  resource.data.userId == request.auth.uid
);
```

### 4.4 HIGH — `challengeMembers` List Rule Too Broad

```
allow list: if isAuthenticated();
```
Any authenticated user can list all challenge memberships with no scope restriction. Should require at least a challengeId filter (`request.query.filters` check) or restrict to admin + challenge creators.

### 4.5 MEDIUM — `challenges` Create Rule — Missing Donation Field

**File:** `firestore.rules`, line 165

```
request.resource.data.donation.enabled != true
```

If the `donation` field is absent from the document being created, this will throw a `rules/no-such-field` error in Firestore rules evaluation, blocking valid challenge creation. Should be:
```
!('donation' in request.resource.data) || request.resource.data.donation.enabled != true
```

### 4.6 MEDIUM — Duplicate Reads in ChallengesScreen

`ChallengesScreen` loads challenges via both `useChallenges()` hook and a direct `getVisibleChallengesForUser` call. These may return overlapping data, causing doubled Firestore reads on screen load.

### 4.7 LOW — `completedAt` Type Inconsistency

**File:** `src/services/workoutService.ts`

```typescript
payload.completedAt = now.toISOString()       // workout doc: ISO string
membershipUpdate.completedAt = Timestamp.now() // membership doc: Firestore Timestamp
```

Same conceptual field stored as different types across documents. Queries filtering by `completedAt` would need two formats. Standardize to Firestore `Timestamp` in both.

### 4.8 LOW — `getChallengesForMyGroups` Fan-out

One Firestore query per group the user belongs to. Acceptable at small group counts but will fan out with no concurrency limit if user has many groups. Consider `Promise.allSettled` with a concurrency cap.

---

## Part 5 — Performance Audit

### 5.1 Challenge Loading

`ChallengeDetailScreen`: `useGroups()` (line 29) loads all groups — unbounded. Only used to derive group name. Replace with a targeted `getDoc(groupRef)` using the challenge's `groupId`.

### 5.2 Leaderboard Loading

`ChallengeLeaderboardScreen` fetches all `challengeMembers` for a challenge without pagination. Large challenges (1000+ members) will be slow. Acceptable for current scale; flag for future pagination.

### 5.3 Logging Latency

Parallel reads in both logging services (`Promise.all([membershipSnap, challengeSnap, groupMemberSnap])`) are good. Batch writes include the membership, workout/wellness log, and user stats in one commit. ✅

### 5.4 Wizard Rendering

4-step wizard renders one step at a time. All modals (exercise picker, wellness picker) rendered outside step conditionals — no remount on step change. Good. ✅

### 5.5 Query Count on Home Load

`HomeScreen` path: `getVisibleChallengesForUser` (critical: all groups scan) + `getUserChallengeMembershipIndex` (staleTime 30s). Once the group scan is fixed, this should be acceptable.

---

## Part 6 — Regression Audit

### 6.1 Engine Routing

`selectEngine` routing unchanged from prior passing state. Legacy challenges continue to route to LegacyEngine. ✅

### 6.2 Scoring

`computeActivityScore` is pure and unchanged. Scoring guard tests pass. ✅

### 6.3 Navigation

All navigation paths confirmed intact:
- Create → `/app/create-challenge`
- Browse → `/app/challenges`
- Detail → `/app/challenges/:id`
- Leaderboard → `/app/challenges/:id/leaderboard`
- Log workout → `/app/log-workout`
- Log wellness → `/app/log-wellness`
- Post-log → `buildActivitySuccessPath` ✅

### 6.4 Template Pre-fills

UX-6 wizard preserves all `useEffect` template pre-fills. Template `useEffect` runs regardless of current step — fields are populated in state before user reaches step 2. ✅

### 6.5 Streak Idempotency

Same-day re-log: `StreakEngine` does not advance streak (idempotent). `lastLogDate === today` check. ✅

---

## Part 7 — Issue Summary

### Critical (must fix before release)

| # | Issue | File | Impact |
|---|---|---|---|
| C1 | Streak engine context missing `requiredConsecutiveDays` / `streakResetOnMiss` | `workoutService.ts`, `wellnessLogService.ts` | All Streak v2 challenges use wrong completion threshold and reset behavior |
| C2 | Unbounded `getDocs(collection(db, 'groups'))` in `getVisibleChallengesForUser` | `challengeService.ts` | O(N) full-collection scan on every page load |

### High (fix before release or document accepted risk)

| # | Issue | File | Impact |
|---|---|---|---|
| H1 | Collective cascade batch write unbounded — Firestore 500-doc batch limit | `workoutService.ts`, `wellnessLogService.ts` | Silent failure for challenges with 500+ members |
| H2 | `challengeMembers` get rule: trailing `\|\| isAuthenticated()` makes ownership check vacuous | `firestore.rules:184` | Any authenticated user reads any membership doc |
| H3 | `challengeMembers` list rule: no scope restriction | `firestore.rules` | Any authenticated user can list all memberships |
| H4 | WorkoutLoggedScreen streak completion hardcoded at 100 | `WorkoutLoggedScreen.tsx:56` | Streak complete celebration never shown for <100-day configs |

### Medium

| # | Issue | File | Impact |
|---|---|---|---|
| M1 | `challenges` create Firestore rule throws on absent `donation` field | `firestore.rules:165` | Challenge creation may fail when donation field omitted |
| M2 | ChallengeDetailScreen leaderboard sorted by totalPoints, not engine-aware | `ChallengeDetailScreen.tsx:83–91` | Detail-screen ranking inconsistent with leaderboard screen |
| M3 | `wellnessLogService` accepts `'joined'` status for logging | `wellnessLogService.ts:~130` | Pending-approval group members may log |
| M4 | Duplicate reads: ChallengesScreen loads challenges from two sources | `ChallengesScreen.tsx` | Double Firestore reads on mount |
| M5 | GroupDetailScreen log queries load post-completion logs (no status filter) | `GroupDetailScreen.tsx` | Unnecessary reads for closed challenges |
| M6 | Profile "wins" counts group-level completions, not user membership completions | `ProfileScreen.tsx` | User wins count inflated for challenges user abandoned |
| M7 | `ChallengeDetailScreen` `useGroups()` — unbounded group read for one group name | `ChallengeDetailScreen.tsx:29` | Over-read; should be a single `getDoc(groupRef)` |

### Low

| # | Issue | File | Impact |
|---|---|---|---|
| L1 | `completedAt` stored as ISO string in workouts doc, Timestamp in membership doc | `workoutService.ts` | Type inconsistency complicates cross-collection queries |
| L2 | `getChallengesForMyGroups` fan-out — one query per group, no concurrency cap | `challengeService.ts` | Performance risk for users with many groups |
| L3 | SelectChallengeActivityScreen session score uses `value === targetValue` (always 100%) | `SelectChallengeActivityScreen.tsx:94` | Display-only: shows max score in session preview regardless of actual progress |

---

## Recommended Fix Order

**P0 — Before any release:**

1. **C1 — Streak engine context** (`workoutService.ts` + `wellnessLogService.ts`): Add `requiredConsecutiveDays` and `streakResetOnMiss` to the `challengeData` type cast and the `ChallengeContext` object.

2. **C2 — Unbounded groups scan** (`challengeService.ts`): Replace `getDocs(collection(db, 'groups'))` with a user-scoped query.

3. **H2 / H3 — Firestore membership rules** (`firestore.rules`): Remove trailing `|| isAuthenticated()` from get rule; scope list rule.

4. **H4 — Streak complete threshold** (`WorkoutLoggedScreen.tsx:56`): Replace `>= 100` with `>= (challenge.requiredConsecutiveDays ?? challenge.durationDays)`.

**P1 — Before scale (document accepted risk if deferring):**

5. **H1 — Collective cascade batch chunking**: Chunk member updates into 450-doc batches.

6. **M1 — Donation field null-safety in rule**: Add `'donation' in resource` guard.

7. **M2 — Detail screen leaderboard**: Use engine-specific sort matching `ChallengeLeaderboardScreen`.

---

## Files Inspected During Audit

| File | What Was Audited |
|---|---|
| `src/services/challengeEngine/index.ts` | Engine routing, selectEngine logic |
| `src/services/challengeEngine/types.ts` | ChallengeEngine interface, EngineResult |
| `src/services/challengeEngine/collectiveEngine.ts` | Group total estimation, cascade trigger |
| `src/services/challengeEngine/streakEngine.ts` | Streak advance, reset, idempotency |
| `src/services/challengeEngine/competitiveEngine.ts` | Per-activity tracking, key consistency |
| `src/services/workoutService.ts` | Engine call, batch writes, cascade, context construction |
| `src/services/wellnessLogService.ts` | GroupMember status check, context construction, cascade |
| `src/services/challengeService.ts` | getVisibleChallengesForUser, getChallengesByGroupPage, joinChallenge |
| `src/services/scoringConfig.ts` | computeActivityScore, MIN_EFFORT_RATIO |
| `src/services/challengeCompletion.ts` | deriveDailyTargetValue, streak daily target |
| `firestore.rules` | All challenge, challengeMembers, wellnessLogs rules |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Leaderboard snapshot, access gates, useGroups |
| `src/features/Challenges/ChallengesScreen.tsx` | Dual data sources |
| `src/features/Challenges/BrowseChallengesScreen.tsx` | Filter chips, browse queries |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Engine-specific sort, podium |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | useFinalRank, engine sort |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Engine context reads, navigation |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | cumulativeValues lookup |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Session score display, lastLogDate detection |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Hardcoded streak threshold |
| `src/features/Home/HomeScreen.tsx` | getVisibleChallengesForUser maxResults |
| `src/features/Groups/GroupDetailScreen.tsx` | Log query, progress computation |
| `src/features/Profile/ProfileScreen.tsx` | Wins count logic |

---

## Rollback

No code changes were made during this audit. All findings are documentation only.

To fix the critical issues, the following files will require modification:

```
src/services/workoutService.ts           # C1: streak context
src/services/wellnessLogService.ts       # C1: streak context
src/services/challengeService.ts         # C2: unbounded scan
firestore.rules                          # H2, H3, M1: security rules
src/features/Workouts/WorkoutLoggedScreen.tsx   # H4: streak threshold
```
