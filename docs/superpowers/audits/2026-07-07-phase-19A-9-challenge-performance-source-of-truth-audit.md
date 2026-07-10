# Phase 19A-9 — Challenge Performance Source-of-Truth Audit

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers
**Audit type:** Read-only. No code was modified.

---

## 1. Executive Summary

Challenge performance values differ across screens because **five distinct read paths** and **three distinct write paths** each resolve "the same number" from different Firestore fields, often with different staleness profiles and different inclusion rules for the current log's contribution. The root causes divide into three categories:

1. **Multiple sources for the same value.** `challengeMembers.cumulativeLoggedValue` (client-engine-owned), `challengeActivitySummaries.totalValue` (CF-owned), `challenges.groupCurrentTotal` (client-written via `FieldValue.increment`), and raw aggregates over `workouts`/`wellnessLogs` are all in use across different screens. None of these is consistently canonical.

2. **Race between client writes and CF reads.** When a user logs an activity, the client batch commits (writing `challengeMembers.cumulativeLoggedValue`), then the Cloud Function trigger fires asynchronously (incrementing `challengeActivitySummaries.totalValue` and `challengeLeaderboards.cumulativeLoggedValue`). Any screen reading `challengeActivitySummaries` within seconds of a log will see the pre-log value. Any screen reading `challengeMembers.cumulativeLoggedValue` sees the post-log value immediately. These two are used interchangeably.

3. **Home screen's "live enrichment" reads raw logs.** For the first challenge card, `useHomeScreen.ts` re-sums raw `workouts` or `wellnessLogs` documents into a `progressValue`, then passes it as `cumulativeLoggedValue` to `buildChallengeProgress`. This diverges from the `challengeMembers.cumulativeLoggedValue` value read by all other screens, and can double-count if the `challengeMembers` cache is also hot.

4. **`challengeLeaderboards.cumulativeLoggedValue` is now a third copy.** Phase 19A-8C added `cumulativeLoggedValue: FieldValue.increment(input.value)` to the `challengeLeaderboards` doc in the CF. This is now a third copy of the same field (alongside `challengeMembers.cumulativeLoggedValue` and `challengeActivitySummaries.totalValue`). It is incremented by the CF, whereas `challengeMembers.cumulativeLoggedValue` is written as an absolute by the client engine. They will diverge whenever a user logs multiple times or on sessions that arrive out of order.

5. **Competitive "completed" state not gated.** `workoutService.ts` blocks logging when `membership.status === 'completed'` for individual completion, but collective auto-complete only sets `challengeMembers.status = 'completed'` after the CF propagates. Until the CF has run, the client-side membership read does not reflect completion, so a user can log again during the propagation window.

---

## 2. Current Read-Source Map

| Screen | Component/File | Hook/Service | Firestore source | Fields used | Risk |
|--------|----------------|--------------|------------------|-------------|------|
| Home — My Challenges carousel (all cards except first) | `src/features/Home/useHomeScreen.ts` line 198 | `buildChallengeProgress` (via `challengeProgressDisplay.ts`) | `challengeMembers` (from `membershipSummaries` already fetched) | `cumulativeLoggedValue`, `completionRate`, `currentStreak`, `groupCurrentTotal` (from challenge doc) | Stale: `challengeMembers` cached via `challengeService.getUserChallengeMemberships`; staleTime unknown — same as challenge cache |
| Home — My Challenges carousel (first card enriched) | `src/features/Home/useHomeScreen.ts` lines 230–278 | Inline `getDocs` over `workouts` or `wellnessLogs` | Raw `workouts` / `wellnessLogs` collection | `value` sum per exerciseId/activityId | **Double-counting risk:** sums raw logs, then passes as `cumulativeLoggedValue`; if `challengeMembers.cumulativeLoggedValue` is also in the `membership` snapshot for the card, `resolveChallengeProgress` takes `max(groupCurrentTotal, memberSumContribution, logSumValue, userContributionTotal)` — currently the raw log sum is the `cumulativeLoggedValue` override, not `logSumValue`. Stale if new logs appear before cache refresh. |
| Challenge Detail | `src/features/Challenges/ChallengeDetailScreen.tsx` line 97–153 | Inline `useQuery` with key `challenge-leaderboard-snapshot` | `challengeMembers` | `cumulativeLoggedValue`, `currentStreak`, `totalPoints`, `completionRate` | staleTime: 60s. After a log, React Query invalidates `challenge-membership` but NOT `challenge-leaderboard-snapshot`, so leaderboard totals may be 60s stale |
| Select Activity | `src/features/Workouts/SelectChallengeActivityScreen.tsx` line 43–96 | Inline `useQuery` with same key `challenge-leaderboard-snapshot` | `challengeMembers` | Same as above | **Shared TanStack cache key** with ChallengeDetailScreen: same query fetches once, re-used. Post-log invalidation path unclear — may or may not invalidate this key |
| Workout Logged (completion) | `src/features/Workouts/WorkoutLoggedScreen.tsx` line 41–46 | `resolveChallengeProgress` | `challengeMembers` via `useChallengeMembership` | `cumulativeLoggedValue`, `completionRate`, `currentStreak` + `groupCurrentTotal` from `useChallenge` | `sessionDelta = value` (URL param) is shown as "+N today" but NOT added to totals. Resolver reads `challengeMembers` which is post-log. However `useChallenge` reads `challenges.groupCurrentTotal` which may be pre-CF (CF increments it via `collectiveGroupUpdate`). **Net: collective total may show pre-log value on this screen until CF propagates.** |
| Challenge Completed Screen | `src/features/Challenges/ChallengeCompletedScreen.tsx` line 14–35 | Inline `useQuery` over `challengeMembers` | `challengeMembers` | `cumulativeLoggedValue`, `currentStreak`, `totalPoints`, `completionRate` | Also queries raw `workouts` for `totalValue` (sum of workout values for per-activity breakdown) — creates two totals on the same screen: `cumulativeLoggedValue` (cumulative membership total) and `totalValue` (raw workout sum, displayed at line 521). These diverge for multi-session challenges. |
| Leaderboard Screen | `src/features/Challenges/ChallengeLeaderboardScreen.tsx` line 25–68 | Inline `useQuery` over `challengeMembers` | `challengeMembers` | `cumulativeLoggedValue` | Sums all members' `cumulativeLoggedValue` for team total (collective). Same 60s staleTime. |
| Group Feed | `src/features/Groups/FeedCard.tsx` | `item.feedProgressSnapshot` (embedded) or `useFeedLiveStats` | `feedProgressSnapshot` in `groupActivityFeed` doc (new) or `challengeActivitySummaries`+`challengeLeaderboards`+`challengeMembers` (live stats fallback) | Snapshot: `teamCumulativeValue`, `userCumulativeValue`, `leaderDelta`, `streakDay`; Live: `totalValue`, `cumulativeLoggedValue`, `currentStreak` | Snapshot is immutable — shows state at log time, not current state. Live stats path reads `challengeActivitySummaries.totalValue` (CF-owned) which may be stale relative to `challengeMembers.cumulativeLoggedValue` for collective. |
| Group Challenge Tab | `src/features/Groups/GroupDetailScreen.tsx` | Not explicitly audited — renders challenge list; does not show granular progress values | `challenges` collection | `groupCurrentTotal`, `status` | Relies on `challenges.groupCurrentTotal` which is incremented by `collectiveGroupUpdate` CF — lag until CF runs. |

---

## 3. Current Write-Source Map

| Action | File/Function | Writes to | Fields updated | Triggered CF | Risk |
|--------|---------------|-----------|----------------|--------------|------|
| User logs workout (v2 engine) | `src/services/workoutService.ts` `createWorkout()` | `workouts` (create), `challengeMembers` (merge), `users` (merge), optionally `challenges` (groupCurrentTotalDelta increment) | `challengeMembers.cumulativeLoggedValue` (absolute, via engine result), `challengeMembers.currentStreak`/`lastLogDate` (streak), `challenges.groupCurrentTotal` (FieldValue.increment, collective only) | `summarizeWorkoutCreated` CF → writes `groupActivityFeed`, `groupMemberStats`, `groupLeaderboards`, `challengeLeaderboards`, `challengeActivitySummaries` | `challengeLeaderboards.cumulativeLoggedValue` is incremented by CF after `challengeMembers.cumulativeLoggedValue` is already set to absolute by client. **Divergence accumulates over multiple logs.** |
| User logs multi-activity session (wellness) | `src/services/activityLogSessionService.ts` `createActivitySession()` | `wellnessLogs` (create, one per entry), `challengeMembers` (merge) | `challengeMembers.activitiesCompleted`, `completionRate`, `totalPoints`, `lastActivityAt` — **does NOT write `cumulativeLoggedValue`** | `summarizeWellnessLogCreated` CF (one per log entry) → same CF as above | **Critical gap:** `activityLogSessionService` does not write `cumulativeLoggedValue` to `challengeMembers`. The CF snapshot reads `challengeMembers.cumulativeLoggedValue` and gets the pre-log value (or 0 for first log), then increments `challengeLeaderboards.cumulativeLoggedValue`. These two diverge immediately. |
| User logs single wellness activity | `src/services/wellnessLogService.ts` `createWellnessLog()` | `wellnessLogs` (create), `challengeMembers` (merge), optionally `challenges` (increment) | `challengeMembers.cumulativeLoggedValue` (absolute, via engine result), plus streak/streak fields | `summarizeWellnessLogCreated` CF | Same double-write pattern as workout path — CF increments `challengeLeaderboards.cumulativeLoggedValue` after client writes absolute to `challengeMembers`. |
| CF: workout or wellness doc created | `functions/src/memberActivitySummaries.ts` | `groupActivityFeed` (create/merge), `groupMemberStats` (merge), `groupLeaderboards` (merge), `challengeLeaderboards` (merge), `challengeActivitySummaries` (merge) | `challengeLeaderboards.cumulativeLoggedValue += input.value`, `challengeActivitySummaries.totalValue += input.value`, `challengeActivitySummaries.totalLogs += 1`, `feedProgressSnapshot` embedded | None | `challengeLeaderboards.cumulativeLoggedValue` is incremented by CF by `input.value`, but `challengeMembers.cumulativeLoggedValue` was set to absolute `(prev + value)` by client. After first log both equal `value`; after second log `challengeMembers` = `2×value` but `challengeLeaderboards` = `value + value` = `2×value` only if CF fires twice. **They stay in sync only if no log is lost.** |
| CF: `challengeMembers` created | `functions/src/memberActivitySummaries.ts` `summarizeChallengeMemberCreated()` | `challengeActivitySummaries` | `participantCount += 1`, `uniqueParticipantIds` | None | Only increments participant count — never writes progress values. |
| Collective group update | `src/services/collectiveCompletion.ts` / `collectiveGroupUpdate.ts` | `challenges` (merge), `challengeMembers` (bulk status update) | `challenges.status = 'completed'`, all members' `status = 'completed'` | None directly | Completion propagation is client-side — depends on client calling this after batch commit. |

---

## 4. Challenge-Type Rules (Current vs. Expected)

### Collective

| Value | Current source(s) | Should be source of truth |
|-------|-------------------|---------------------------|
| Team total | `challenges.groupCurrentTotal` (client-incremented) OR `challengeActivitySummaries.totalValue` (CF-incremented) OR `sum(challengeMembers.cumulativeLoggedValue)` — screens pick different ones | `challengeActivitySummaries.totalValue` (CF-owned, most reliable for multi-user aggregates) |
| User contribution | `challengeMembers.cumulativeLoggedValue` (client-engine-owned) | `challengeMembers.cumulativeLoggedValue` — already correct owner |
| Group target | `challenges.groupCumulativeTarget` | `challenges.groupCumulativeTarget` — already correct |
| Completion | `challengeMembers.status === 'completed'` (CF propagates to all members) | Same, but propagation gap exists |

### Competitive

| Value | Current source(s) | Should be source of truth |
|-------|-------------------|---------------------------|
| User cumulative | `challengeMembers.cumulativeLoggedValue` (client-owned) OR `challengeLeaderboards.cumulativeLoggedValue` (CF-owned) | `challengeMembers.cumulativeLoggedValue` (written atomically by client in same batch as workout doc) |
| Leader rank | `challengeLeaderboards.score` (CF-incremented points) OR `challengeMembers.cumulativeLoggedValue` sorted in-app | `challengeLeaderboards.score` for rank; `challengeMembers.cumulativeLoggedValue` for displayed value |
| Target | `challenges.activities[0].targetValue` | Same — no issue |
| Completion | `completionRate >= 100` OR `cumulativeLoggedValue >= target` — inconsistent between screens | `challengeMembers.completionRate >= 100` (written by engine) |

### Streak

| Value | Current source(s) | Should be source of truth |
|-------|-------------------|---------------------------|
| Current streak | `challengeMembers.currentStreak` (client-streakEngine-owned) | `challengeMembers.currentStreak` — already correct |
| Daily target | `challenges.activities[0].dailyTarget ?? targetValue` | Same |
| Completion | `currentStreak >= requiredConsecutiveDays` | Same |

### Days remaining

Computed from `challenge.endDate` everywhere — no issue.

---

## 5. Root-Cause Findings

### Finding 1 — Home vs. other screens: different values for user contribution (collective)

**Location:** `src/features/Home/useHomeScreen.ts` lines 229–278

**Evidence:** The first card re-sums raw `workouts` or `wellnessLogs` documents directly (filtering by `challengeId` + `userId`) and passes the result as `cumulativeLoggedValue` to `buildChallengeProgress`. All other screens use `challengeMembers.cumulativeLoggedValue`. The raw log sum includes every workout doc ever created; `cumulativeLoggedValue` is computed by the engine and may exclude capped/invalid values. They diverge whenever the engine applies caps or when a log is corrected.

**Why it matters:** If a user has logged 500 steps but their last log was worth 0 (capped), the raw sum shows 500 and the membership shows 490. Home card shows 500, Challenge Detail shows 490.

### Finding 2 — Home competitive leaderboard reads `challengeMembers` not `challengeLeaderboards`

**Location:** `src/features/Home/useHomeScreen.ts` lines 171–186

**Evidence:** The competitive leaderboard for home cards queries `challengeMembers` and sorts by `cumulativeLoggedValue`. `SelectChallengeActivityScreen` and `ChallengeDetailScreen` also query `challengeMembers`. `ChallengeLeaderboardScreen` also queries `challengeMembers`. Only the feed live stats path reads `challengeLeaderboards`. This is consistent across the main screens — the inconsistency is that `challengeLeaderboards.cumulativeLoggedValue` (CF-owned) grows separately from `challengeMembers.cumulativeLoggedValue` (client-owned), creating two diverging copies.

### Finding 3 — `activityLogSessionService` does NOT write `cumulativeLoggedValue`

**Location:** `src/services/activityLogSessionService.ts` lines 371–394

**Evidence:** The membership update in `activityLogSessionService` includes `activitiesCompleted`, `totalPoints`, `lastActivityAt`, `completionRate`, `status` — but **not** `cumulativeLoggedValue`. This service is used for multi-activity wellness sessions. After such a session, `challengeMembers.cumulativeLoggedValue` is unchanged (stays at 0 for new users), but the CF snapshot reads it and embeds that 0 in the feed doc. The leaderboard then shows 0 reps even though the user logged.

**Impact:** All screens reading `challengeMembers.cumulativeLoggedValue` for wellness multi-session users will show 0 or stale values.

### Finding 4 — `challengeLeaderboards.cumulativeLoggedValue` drifts from `challengeMembers.cumulativeLoggedValue`

**Location:** `functions/src/memberActivitySummaries.ts` line 415 (CF) vs. `src/services/challengeEngine/competitiveEngine.ts` line 46 (client)

**Evidence:**
- Client: `newTotalCumulative = (membership.cumulativeLoggedValue ?? 0) + logEvent.value` → writes absolute value
- CF: `cumulativeLoggedValue: FieldValue.increment(Math.max(0, input.value))` → increments

After N logs they should be equal if the CF fires exactly once per log and no logs are lost. In practice CF triggers are at-least-once: if a CF invocation retries (e.g., timeout), the increment fires twice and `challengeLeaderboards.cumulativeLoggedValue` exceeds `challengeMembers.cumulativeLoggedValue`. The feed snapshot reads `challengeLeaderboards.cumulativeLoggedValue` as `leaderValue` for leader comparison — it will appear to show the leader ahead by more than they actually are.

### Finding 5 — WorkoutLoggedScreen collective total may be pre-CF

**Location:** `src/features/Workouts/WorkoutLoggedScreen.tsx` line 41–48

**Evidence:** `resolved.groupTotal` comes from `resolveChallengeProgress` which takes `max(challenge.groupCurrentTotal, ...)`. `challenge.groupCurrentTotal` is written by the client via `FieldValue.increment` in the same batch as the workout. `challengeActivitySummaries.totalValue` (CF-owned) is NOT read on this screen. So the WorkoutLoggedScreen shows the client-incremented value — which is correct for the user who just logged. However, if two users log simultaneously, each sees only their own increment (not the other's) until the page re-fetches the challenge doc.

**Why it matters:** Collective total shown on WorkoutLoggedScreen is optimistic for the current user but may lag behind actual Firestore total for concurrent logs.

### Finding 6 — ChallengeCompletedScreen shows two different "my total" values

**Location:** `src/features/Challenges/ChallengeCompletedScreen.tsx` lines 98 and 129

**Evidence:**
- Line 98: `cumulativeLoggedValue = membership?.cumulativeLoggedValue ?? 0` → from challengeMembers
- Line 129: `totalValue = myWorkouts.reduce(...)` → sum of raw workout docs

Both are displayed in different sections of the same screen. For competitive challenges, `cumulativeLoggedValue` is shown in the hero stat (line 196) and the progress bar (line 278/303). `totalValue` from raw workouts is shown in a separate section (line 521). These will differ whenever the engine applies caps, or when the user has wellness logs that aren't in `myWorkouts` (which queries only the `workouts` collection).

### Finding 7 — Competitive completed state: logging not blocked server-side

**Location:** `src/services/workoutService.ts` line 139

**Evidence:**
```typescript
if (membership.status === 'completed') {
  throw new Error('Challenge already completed.');
}
```
This client-side read of `membership.status` works for individual completion (status set in same batch). For collective auto-complete, `challenges.status = 'completed'` is set by `collectiveCompletion.ts` but `challengeMembers.status = 'completed'` for all members requires a separate bulk write — which may not have run yet. During this gap, other members can still log. Firestore rules do not appear to enforce this (not audited deeply here).

### Finding 8 — Feed snapshot vs. live stats show different team totals (collective)

**Location:** `FeedCard.tsx` → `SnapshotProgress` (reads embedded `feedProgressSnapshot.teamCumulativeValue`) vs. `feedLiveStatsService` (reads `challengeActivitySummaries.totalValue`)

**Evidence:**
- Snapshot: `teamCumulativeValue = prevTotal + input.value` where `prevTotal` was read from `challengeActivitySummaries` at CF-trigger time (pre-log)
- Live stats: reads current `challengeActivitySummaries.totalValue` (post-log for all logs to date)

These will differ for any feed card that was created before a subsequent log by another team member. The snapshot is frozen at log-time. The live stats path, by contrast, always shows current CF-computed total.

---

## 6. Recommended Source-of-Truth Architecture

### Single source per value type

| Value | Authoritative collection | Field | Owner | Notes |
|-------|--------------------------|-------|-------|-------|
| Collective team total | `challengeActivitySummaries` | `totalValue` | Cloud Function | Most durable aggregate; CF increments atomically. Remove reads of `challenges.groupCurrentTotal` from progress display. |
| User cumulative logged value | `challengeMembers` | `cumulativeLoggedValue` | Client engine (workoutService / wellnessLogService) | Already correct for workout path. Must also be written by `activityLogSessionService`. |
| Competitive rank score | `challengeLeaderboards` | `score` | Cloud Function | Used for ranking only; not for displaying raw value. |
| Competitive displayed value | `challengeMembers` | `cumulativeLoggedValue` | Client engine | Remove `challengeLeaderboards.cumulativeLoggedValue` — it duplicates the membership field and can drift. |
| Streak current day | `challengeMembers` | `currentStreak` | Client streakEngine | Already correct. |
| Completion status | `challengeMembers` | `status` | Client engine (immediate) + CF (collective bulk) | No change needed, but completion propagation gap must be documented. |
| Days remaining | Derived from `challenge.endDate` | — | N/A | Already consistent. |

### Screens that should be migrated

| Screen | Current source | Target source |
|--------|---------------|---------------|
| Home first-card "live enrichment" | Raw `workouts`/`wellnessLogs` sum | `challengeMembers.cumulativeLoggedValue` |
| ChallengeCompletedScreen `totalValue` (line 521) | Raw `workouts` sum | `challengeMembers.cumulativeLoggedValue` |
| WorkoutLoggedScreen collective total | `challenges.groupCurrentTotal` (via `resolveChallengeProgress`) | After cache invalidation, re-read `challengeActivitySummaries.totalValue`; or accept the optimistic client value as-is with a note |

### Fields to retire

| Field | Collection | Why |
|-------|------------|-----|
| `challenges.groupCurrentTotal` (for display) | `challenges` | Written by client only; CF also writes `challengeActivitySummaries.totalValue`. These diverge. Use `challengeActivitySummaries.totalValue` for all display. Keep `groupCurrentTotal` only for engine completion check (can be removed once CF-owned). |
| `challengeLeaderboards.cumulativeLoggedValue` | `challengeLeaderboards` | Duplicates `challengeMembers.cumulativeLoggedValue`. Incremented by CF (at-least-once), absolute by client — guaranteed to drift on CF retry. The feed snapshot reads it for leader comparison; switch to reading `challengeMembers.cumulativeLoggedValue` directly. |

---

## 7. Fix Plan

### Phase 19A-10A — Fix `activityLogSessionService` missing `cumulativeLoggedValue` write (Critical)

**Scope:** `src/services/activityLogSessionService.ts`

The wellness multi-session service does not write `cumulativeLoggedValue` to `challengeMembers`. This is the highest-impact fix because it means all wellness multi-activity users have `cumulativeLoggedValue = 0` until they log via the single-activity path.

Steps:
1. Read current `challengeMembers.cumulativeLoggedValue` before building the membership update (already reads `membership` object).
2. Compute `nextCumulative = (membership.cumulativeLoggedValue ?? 0) + sum(entries.map(e => e.value))`.
3. Add `cumulativeLoggedValue: nextCumulative` to the `membershipUpdate` object (absolute, matching the engine pattern).
4. Verify the CF snapshot path does not double-count (it reads `challengeMembers.cumulativeLoggedValue` post-log — this is correct since the client batch commits before CF fires).

### Phase 19A-10B — Remove `challengeLeaderboards.cumulativeLoggedValue` from CF writes (Important)

**Scope:** `functions/src/memberActivitySummaries.ts`

Remove `cumulativeLoggedValue: FieldValue.increment(...)` from `challengeLeaderboardPayload`. This field is a third copy that drifts from `challengeMembers.cumulativeLoggedValue` on CF retries. The CF feed snapshot already reads from `challengeMembers` directly (fixed in 8D); the only remaining reader of `challengeLeaderboards.cumulativeLoggedValue` is `feedLiveStatsService.fetchCompetitive`. Update that reader to use `challengeMembers` instead.

### Phase 19A-10C — Unify Home first-card enrichment (Medium)

**Scope:** `src/features/Home/useHomeScreen.ts` lines 229–278

Remove the raw `workouts`/`wellnessLogs` query for the first card. Replace `progressValue` with `membership?.cumulativeLoggedValue ?? 0` directly — same field used by all other screens. This also eliminates one extra Firestore read per Home screen load.

### Phase 19A-10D — Fix ChallengeCompletedScreen dual totals (Low)

**Scope:** `src/features/Challenges/ChallengeCompletedScreen.tsx`

Remove the `totalValue` computed from raw workouts (line 129). Replace all uses with `cumulativeLoggedValue` from `challengeMembers`. The raw workouts sum is misleading for wellness challenges and for challenges where the engine applies caps.

### Phase 19A-10E — Add post-log `challengeActivitySummaries` invalidation (Low)

**Scope:** `src/hooks/useWorkouts.ts` mutation `onSuccess` handlers

After a workout or wellness log, invalidate the `challenge-leaderboard-snapshot` query key. Currently only `challenge-membership` is invalidated, so the leaderboard snapshot can be stale for up to 60 seconds after a log.

---

## 8. Tests Needed

### Guard: `activityLogSessionService` must write `cumulativeLoggedValue`
```
assert.match(activityLogSessionService, /cumulativeLoggedValue/, ...)
assert.match(activityLogSessionService, /nextCumulative|cumulativeLoggedValue.*entries|entries.*cumulativeLoggedValue/, ...)
```

### Guard: `challengeLeaderboards` must NOT have duplicate `cumulativeLoggedValue` write (after 10B)
```
assert.doesNotMatch(cf, /challengeLeaderboardPayload[\s\S]{0,50}cumulativeLoggedValue/, ...)
```

### Guard: `feedLiveStatsService.fetchCompetitive` must read from `challengeMembers` not `challengeLeaderboards.cumulativeLoggedValue` (after 10B)
```
assert.doesNotMatch(feedLiveStats, /challengeLeaderboards[\s\S]{0,100}cumulativeLoggedValue/, ...)
```

### Guard: Home first card must not query `workouts` or `wellnessLogs` for progress (after 10C)
```
assert.doesNotMatch(homeScreen, /where.*workouts.*challengeId.*userId|where.*wellnessLogs.*challengeId.*userId/, ...)
```

### Guard: `ChallengeCompletedScreen` must not sum raw workouts for display value (after 10D)
```
assert.doesNotMatch(completedScreen, /myWorkouts\.reduce.*sum.*value/, ...)
```

### Guard: `useLogWorkout` / `useLogWellnessActivity` must invalidate `challenge-leaderboard-snapshot` (after 10E)
```
assert.match(useWorkouts, /challenge-leaderboard-snapshot/, ...)
assert.match(useWorkouts, /invalidateQueries[\s\S]{0,50}challenge-leaderboard-snapshot/, ...)
```

---

## 9. Commands Run

```bash
grep -Rn "cumulativeLoggedValue|challengeActivitySummaries|challengeMembers|challengeLeaderboards|groupActivityFeed|totalValue" src/ functions/src/
grep -Rn "useQuery|useFeedLiveStats|useChallengeProgress|useChallengeMembership" src/
npx tsc --noEmit    # ✅ 0 errors
npm run build       # ✅ built in 3.51s
# functions build verified clean (from prior phase)
```

---

## 10. Files Audited

| File | Purpose |
|------|---------|
| `src/features/Home/useHomeScreen.ts` | Home screen data fetching + card construction |
| `src/features/Home/HomeScreen.tsx` | Home screen render |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Challenge detail + embedded leaderboard |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Activity picker + leaderboard |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Post-log confirmation |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Completion summary |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Full leaderboard |
| `src/features/Groups/FeedCard.tsx` | Feed card + SnapshotProgress |
| `src/services/workoutService.ts` | Workout log write path |
| `src/services/wellnessLogService.ts` | Single wellness log write path |
| `src/services/activityLogSessionService.ts` | Multi-activity wellness session write path |
| `src/services/feedLiveStatsService.ts` | Live stats for feed (fallback path) |
| `src/services/challengeEngine/collectiveEngine.ts` | Collective engine |
| `src/services/challengeEngine/competitiveEngine.ts` | Competitive engine |
| `src/features/Challenges/challengeProgressResolver.ts` | Canonical progress resolver |
| `src/features/Challenges/challengeProgressDisplay.ts` | Resolver shim for home cards |
| `functions/src/memberActivitySummaries.ts` | CF trigger: writes feed, leaderboards, summaries |
| `src/hooks/useWorkouts.ts` | `useChallengeProgress`, workout mutation hooks |
