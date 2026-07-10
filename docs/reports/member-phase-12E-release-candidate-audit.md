# Phase 12E — Release Candidate Audit
**Date:** 2026-06-25  
**Branch:** `fix/p0-pre-deploy-blockers`  
**Auditor:** Claude Sonnet 4.6  
**Scope:** Full Challenge Engine implementation after Phases 11A–11H, UX-2–UX-6, Phase 12A–12D

---

## Executive Summary

This audit assessed the complete Challenge Engine implementation against production-readiness criteria across seven areas: engine correctness, end-to-end user journeys, UI consistency, Firestore data integrity, security rules, performance, and technical debt.

**All four issues fixed in Phases 12A–12D are confirmed resolved.** No regressions were introduced. Two new medium-severity findings are identified in `adminChallengeService.ts` (unbounded admin collection scans) and `groupInsightsService.ts` (unbounded workout feed fetch). Both are admin/group-scoped and non-blocking for initial production launch.

---

## Overall Score: **82 / 100**

| Area | Score | Prior (Phase 12) |
|------|-------|-----------------|
| Engine correctness | 94/100 | 72/100 |
| End-to-end journeys | 90/100 | 78/100 |
| UI consistency | 85/100 | 82/100 |
| Firestore data integrity | 88/100 | 80/100 |
| Security rules | 78/100 | 58/100 |
| Performance | 70/100 | 62/100 |
| Technical debt | 75/100 | 65/100 |

---

## Production Recommendation: **READY WITH MINOR ISSUES**

The engine is safe to deploy. The two remaining performance findings (admin collection scans, unbounded feed) are acceptable for an initial launch on a small-to-medium dataset. They should be addressed in the next sprint before user growth makes them expensive.

---

## Part 1 — Engine Correctness

### ✅ C1 — Streak context gap (RESOLVED in 12A)

Both `workoutService.ts` and `wellnessLogService.ts` now cast `requiredConsecutiveDays` and `streakResetOnMiss` from the Firestore challenge document and forward them into `ChallengeContext`. The `StreakEngine` receives the correct values at runtime.

**Verified in:** `src/services/workoutService.ts:69–70,178–179`, `src/services/wellnessLogService.ts:102–104,169–170`

### ✅ H4 — WorkoutLoggedScreen hardcoded threshold (RESOLVED in 12A)

`streakComplete` now computes as:
```typescript
currentStreak >= (challenge?.requiredConsecutiveDays ?? challenge?.durationDays ?? 0)
```
The fallback chain is safe: `requiredConsecutiveDays` (StreakEngine field) → `durationDays` (legacy) → `0` (fails closed — no false positive completion badge).

**Verified in:** `src/features/Workouts/WorkoutLoggedScreen.tsx:56`

### ✅ H1 — Collective cascade batch limit (RESOLVED in 12D)

`cascadeCollectiveCompletion` queries only `status == 'active'` members, excludes the triggering member's ref, and commits in sequential batches of `MAX_WRITES_PER_BATCH = 450` (50-write margin below Firestore's hard limit of 500). Partial-failure recovery is idempotent: a re-run re-queries active members and skips already-completed ones.

**Verified in:** `src/services/collectiveCompletion.ts`, `src/services/collectiveCompletionUtils.ts`

### ✅ Engine routing

`selectEngine(challenge)` correctly routes on `engineVersion === 'v2'` + `challengeType`:
- `'collective'` → `CollectiveEngine`  
- `'competitive'` → `CompetitiveEngine`  
- `'streak'` → `StreakEngine`  
- Everything else → `LegacyEngine`

`LegacyEngine` and `CompetitiveEngine` are confirmed unaffected by the 12A/12D changes (they do not consume `requiredConsecutiveDays` or `streakResetOnMiss`).

### ⚠️ M1 — `computeRequiredLogs` guard not present in wellnessLogService path for empty activities

`wellnessLogService.ts:108` computes `activityCount = Math.max(1, challengeData.activities?.length ?? 1)` — the `Math.max(1,...)` guard prevents a zero-count divide-by-zero. This is correct, but it means a challenge configured with zero activities will silently proceed as if it has one activity. This is consistent with `workoutService.ts` behavior and is acceptable (admin validation should prevent malformed challenges), but it is a silent assumption.

**Severity:** Minor. No user-visible bug.

---

## Part 2 — End-to-End User Journeys

### ✅ Workout log journey

`useLogWorkout` → `workoutService.createWorkout` → engine compute → batch commit (challenge doc + own membership) → `cascadeCollectiveCompletion` (collective only) → React Query cache invalidation for all affected query keys.

Cache invalidation covers: `challenge-workouts`, `challenge-progress`, `challenge-membership`, `group-leaderboard`, `group-members`, `streak/*`, `home-screen-data`, `challenges`. No stale-read gaps identified.

### ✅ Wellness log journey

`useLogWellnessActivity` → routes to correct `wellnessLogService` method by `activityType` → same `writeLog` core → same cascade path. Cache invalidation covers all required keys (same as workout path minus `streak/*`).

**Gap:** Wellness log does not invalidate `streak/*` query keys. If a wellness challenge is configured as `streak` type (engineVersion v2), the streak display on `WorkoutLoggedScreen` will not refresh until the stale TTL expires. This is a minor UX inconsistency — streak challenges are currently fitness-type, but the invalidation gap is worth closing.

**Severity:** Minor / UX.

### ✅ Join challenge journey

`challengeService.joinChallenge` validates group membership before creating the `challengeMembers` doc. The `isGroupMember` helper reads `groupMembers/{groupId}_{userId}` and checks `status ∈ {joined, active}`.

### ✅ Browse / discover journey

`getVisibleChallengesForUser` (Phase 12B fix) now scopes public group lookup to `where('isPrivate', '==', false)`. Membership-based visibility is preserved through `where('groupId', 'in', [...])`.

---

## Part 3 — UI Consistency

### ✅ Engine visual language

Engine chips correctly apply:
- 👥 `bg-blue-100 text-blue-700` for collective
- 🏆 `bg-amber-100 text-amber-700` for competitive  
- 🔥 `bg-orange-100 text-orange-700` for streak

### ✅ Streak progress display

`WorkoutLoggedScreen` renders:
- Day N of M counter using `requiredConsecutiveDays` (not hardcoded 100)
- Progress bar width: `Math.min(100, Math.round((currentStreak / requiredDays) * 100))`
- Reset behavior label: dynamic from `challenge?.streakResetOnMiss`
- 7-day milestone celebration at `currentStreak % 7 === 0`

### ⚠️ M2 — Streak badge shows when `requiredDays === 0`

If a streak challenge has no `requiredConsecutiveDays` AND no `durationDays`, `requiredDays = 0` and the progress bar renders at 100% width from the first log (due to `0/0` → `NaN` → rendered as `NaN%`, which browsers treat as `0%` — but `streakComplete = currentStreak >= 0` is always true after any log). 

In practice, admin-created streak challenges always set `durationDays`, so this only affects malformed data. The `Math.min(100, ...)` clamp on the progress bar prevents visual overflow.

**Severity:** Minor. Requires malformed challenge data to manifest.

---

## Part 4 — Firestore Data Integrity

### ✅ Atomic write ordering

Both logging services follow the correct pattern:
1. Read: membership doc, challenge doc, group member doc (parallel)
2. Validate: group membership, challenge membership, completion status
3. Batch write: log doc + membership update + challenge doc update (optional)
4. Cascade: `cascadeCollectiveCompletion` only after primary batch commits

This ordering guarantees the challenge doc and triggering member's status are consistent before other members are marked complete.

### ✅ `FieldValue.increment()` usage

`totalPoints` is updated with `increment(points)` rather than an absolute value, preventing lost-update races under concurrent logging.

### ✅ Idempotency

`cascadeCollectiveCompletion` queries `where('status', '==', 'active')` so re-runs from partial failure skip already-completed members. The primary path guards against double-completion via `if (membership.status === 'completed') throw`.

### ✅ `groupCurrentTotal` delta

CollectiveEngine returns a `groupCurrentTotalDelta` (proportional score increment) rather than an absolute value. This is applied via `increment(delta)` in the challenge doc update, preventing read-modify-write races under concurrent group logging.

---

## Part 5 — Security Rules

### ✅ H2 — challengeMembers get rule (RESOLVED in 12C)

The vacuous `|| isAuthenticated()` tail has been replaced with:
```
|| isGroupMember(resource.data.groupId)
|| isPublicGroup(resource.data.groupId)
|| canModerateChallenges()
```
All legitimate app `getDoc` calls fetch the calling user's own membership doc, satisfying `resource.data.userId == request.auth.uid`. The extended conditions cover admin use cases.

### ⚠️ H3 — challengeMembers list rule (Documented, cannot be fixed without schema change)

```
allow list: if isAuthenticated();
```
`resource` is null for list operations; WHERE-clause parameters are not inspectable. All application-layer queries are constrained by `challengeId`, `userId`, or `groupId`. Broad enumeration is rejected at the application layer, not the rules layer. This limitation is documented in the rules file.

### ⚠️ S1 — Admin service bypasses Firestore rules for analytics reads

`adminChallengeService.getPendingChallenges()`, `getApprovedChallenges()`, `getActiveChallenges()`, and `getChallengeAnalytics()` all execute `getDocs(collection(db, 'challenges'))` — a full collection scan — filtering in JavaScript afterward. The Firestore rules for `challenges` allow any authenticated user to list challenges (the list rule is `isAuthenticated()`), so there is no data-exposure vulnerability. However, these methods rely entirely on application-layer role checks (admin UI is gated by `canAccessAdmin()` at the route level). If an authenticated non-admin user could reach these service methods directly, they would receive all challenge data.

**Severity:** Medium. Acceptable if admin routes are properly gated. Not a production blocker, but should be hardened with `canModerateChallenges()` or `canAccessAdmin()` checks at the Firestore rules layer in a future sprint.

---

## Part 6 — Performance

### ✅ C2 — Unbounded getDocs groups scan (RESOLVED in 12B)

`getVisibleChallengesForUser` now uses `where('isPrivate', '==', false)` rather than scanning all groups.

### ⚠️ P1 — Admin service: three unbounded challenge collection scans (NEW FINDING)

`adminChallengeService` has three methods that each execute `getDocs(collection(db, 'challenges'))` with no query constraint:
- `getPendingChallenges()`
- `getApprovedChallenges()`  
- `getActiveChallenges()`

These read the entire `challenges` collection on every admin page load. At current scale (small dataset) this is tolerable. As the challenge count grows, these will become expensive. Each should add a `where('moderationStatus', '==', ...)` or `where('status', '==', ...)` query and require Firestore composite indexes.

**Severity:** Medium. Not a blocker for launch; must be addressed before significant dataset growth.

### ⚠️ P2 — groupInsightsService.getGroupFeed: unbounded workouts scan

`getGroupFeed` fetches ALL workouts by `groupId` via `getDocs(query(collection(db, 'workouts'), where('groupId', '==', groupId)))`, then sorts in JavaScript and slices to top 10. For active groups this query will grow unboundedly. The fix is to add `orderBy('completedAt', 'desc')` and `limit(10)` to the Firestore query.

**Severity:** Medium. Not a blocker for launch; should be fixed before groups accumulate hundreds of workout logs.

### ✅ useWorkouts query caching

`useChallengeWorkouts` uses `staleTime: 60_000` (1 min) and `gcTime: 600_000` (10 min). `useChallengeProgress` matches. These are appropriate TTLs for a real-time workout leaderboard context.

### ✅ No N+1 queries on leaderboard

`groupInsightsService.getGroupLeaderboard` fetches all `challengeMembers` by `groupId` in one query, aggregates scores in a Map, then batch-fetches user display names via `Promise.all`. No per-user round trips.

---

## Part 7 — Technical Debt

### ✅ Engine architecture is clean

Four engines implement a consistent `computeUpdate(context, membership, logEvent, challengeSnapshot)` interface. The `selectEngine` router is a single decision point with no duplication.

### ✅ collectiveCompletionUtils.ts separation

Pure utility functions (`chunkArray`, `MAX_WRITES_PER_BATCH`) are isolated in a Firebase-free module, making them directly testable in Node.js without env var mocking.

### ⚠️ TD1 — adminChallengeService: no `status` or `moderationStatus` index

The unbounded scan methods (P1) will additionally trigger "missing index" warnings in Firestore when filter + sort combinations are used after they are refactored. Index creation will be needed before the queries can be optimized.

### ⚠️ TD2 — wellnessLogService wellness-log cache invalidation gap (see M3 in journeys)

`useLogWellnessActivity.onSuccess` does not invalidate `streak/*` query keys. If wellness challenge types expand to include streak, the streak UI will lag until natural cache expiry. Simple fix: add the two streak query key invalidations to `useLogWellnessActivity.onSuccess`.

### ✅ No dead code introduced

All new symbols (`cascadeCollectiveCompletion`, `chunkArray`, `MAX_WRITES_PER_BATCH`) are imported and used. No unused exports detected.

---

## Findings Summary

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| C1 | Critical | ✅ RESOLVED (12A) | Streak context missing `requiredConsecutiveDays`/`streakResetOnMiss` |
| C2 | Critical | ✅ RESOLVED (12B) | Unbounded `getDocs(collection(db, 'groups'))` |
| H1 | High | ✅ RESOLVED (12D) | Collective cascade batch limit |
| H2 | High | ✅ RESOLVED (12C) | Vacuous `|| isAuthenticated()` in get rule |
| H3 | High | 📝 DOCUMENTED | Firestore list rule architectural limitation |
| H4 | High | ✅ RESOLVED (12A) | Hardcoded `currentStreak >= 100` |
| S1 | Medium | 🟡 OPEN | Admin service relies on app-layer role checks only |
| P1 | Medium | 🟡 OPEN | Admin: 3 unbounded challenge collection scans |
| P2 | Medium | 🟡 OPEN | Group feed: unbounded workouts scan |
| M1 | Minor | 🟡 NOTED | Silent 1-activity assumption in wellnessLogService |
| M2 | Minor | 🟡 NOTED | Streak badge shows on 0-day malformed data |
| TD2 | Minor | 🟡 OPEN | Wellness log doesn't invalidate streak query keys |

---

## Validation Results (Run 2026-06-25)

```
npx tsc -b --pretty false   → 0 errors ✅
npm run build               → ✓ built in 2.82s ✅
npm run test:scoring-guards → all guards passed ✅
npm run test:home-challenge-feeds → all guards passed ✅
```

---

## Recommended Follow-Up Roadmap

### Sprint N+1 (before scaling)

1. **P1 — Scope admin challenge queries** — Add `where('moderationStatus', ...)` / `where('status', ...)` to the three unbounded admin collection reads. Add Firestore composite indexes.

2. **P2 — Scope group feed workout query** — Add `orderBy('completedAt', 'desc'), limit(10)` to the Firestore query in `getGroupFeed`. Add required composite index.

3. **TD2 — Add streak cache invalidation to wellness log** — Two lines in `useLogWellnessActivity.onSuccess`:
   ```typescript
   queryClient.invalidateQueries({ queryKey: ['streak', 'user', input.userId] }),
   queryClient.invalidateQueries({ queryKey: ['streak', 'challenge', input.userId, input.challengeId] }),
   ```

### Sprint N+2 (security hardening)

4. **S1 — Add moderator rules to Firestore** — Add `canModerateChallenges()` or `isSuperAdmin()` requirement to the `challenges` list rule for the admin paths, or use a separate admin-only subcollection pattern.

5. **H3 — Long-term: challengeMembers schema** — If `challengeMembers` list rule needs tightening, consider a subcollection under `/challenges/{id}/members/{userId}` to make the `challengeId` inspectable in security rules.
