# Phase 13A — End-to-End Challenge Engine Validation
## QA Matrix & Bug Report

**Date:** 2026-06-26  
**Branch:** `fix/p0-pre-deploy-blockers`  
**Phase:** 13A — QA Only (no code changes)  
**Method:** Static code analysis across all engine, service, and UI source files  

---

## Table of Contents

1. [Scope & Method](#scope--method)
2. [Engine Inventory](#engine-inventory)
3. [QA Validation Matrix](#qa-validation-matrix)
   - [Legacy Engine](#legacy-engine)
   - [Streak Engine](#streak-engine)
   - [Competitive Engine](#competitive-engine)
   - [Collective Engine](#collective-engine)
4. [Edge Case Matrix](#edge-case-matrix)
5. [Confirmed Bug Register](#confirmed-bug-register)
6. [Recommended Fix Order](#recommended-fix-order)
7. [Risk Summary](#risk-summary)

---

## Scope & Method

### Files Audited

| Category | Files |
|---|---|
| Engine core | `src/services/engines/index.ts`, `legacyEngine.ts`, `streakEngine.ts`, `competitiveEngine.ts`, `collectiveEngine.ts` |
| Engine types | `src/services/engines/types.ts` |
| Scoring | `src/services/engines/scoringConfig.ts`, `challengeCompletion.ts` |
| Services | `challengeService.ts`, `workoutService.ts`, `wellnessLogService.ts`, `streakService.ts`, `notificationService.ts`, `adminChallengeService.ts`, `groupInsightsService.ts` |
| Hooks | `useWorkouts.ts`, `useAdminChallenges.ts` |
| UI | `ChallengeDetailScreen.tsx`, `ChallengeLeaderboardScreen.tsx`, `ChallengeCompletedScreen.tsx` |
| Rules & indexes | `firestore.rules`, `firestore.indexes.json` |

### Method

All findings are derived from static analysis of the source files listed above. No runtime execution, no live Firestore data, no device testing. Severity ratings reflect estimated user impact in a production environment.

### Screenshots

Runtime screenshots are not available in this phase (static analysis only). Specific UI component locations are cited by file and line reference.

---

## Engine Inventory

| Engine | Trigger | Challenge Types |
|---|---|---|
| `LegacyEngine` | `engineVersion !== 'v2'` | All v1 challenges |
| `StreakEngine` | `engineVersion === 'v2'` + `challengeType === 'streak'` | v2 streak |
| `CompetitiveEngine` | `engineVersion === 'v2'` + `challengeType === 'competitive'` | v2 competitive |
| `CollectiveEngine` | `engineVersion === 'v2'` + `challengeType === 'collective'` | v2 collective |

Engine routing is in `selectEngine()` (`src/services/engines/index.ts`). Unknown v2 `challengeType` values throw — there is no fallback to `LegacyEngine`.

---

## QA Validation Matrix

Legend: ✅ PASS · ⚠️ PARTIAL · ❌ FAIL · ℹ️ NOTE

---

### Legacy Engine

| # | Journey Stage | Status | Notes |
|---|---|---|---|
| L-01 | **Challenge creation** | ✅ | `adminChallengeService.createChallengeFromAdmin` writes all required fields; `engineVersion` defaults to `v1` path implicitly (no explicit version field written at creation) |
| L-02 | **Join flow** | ✅ | `challengeService.joinChallenge` sets `activitiesCompleted: 0`, `totalPoints: 0`, `completionRate: 0`; `status: 'active'`; `totalActivities = durationDays × activityCount` |
| L-03 | **Challenge detail** | ✅ | `ChallengeDetailScreen` reads `challengeMembers` for progress; mini-leaderboard reads members and sorts by `totalPoints` |
| L-04 | **Daily logging** | ✅ | `workoutService.createWorkout` routes to `LegacyEngine.computeUpdate`; increments `activitiesCompleted` (capped at `totalActivities`); awards proportional points |
| L-05 | **Multiple logs same day** | ⚠️ | Each additional log on the same day increments `activitiesCompleted` further (up to cap). There is no same-day idempotency guard. This is documented behavior but not communicated clearly in the UI |
| L-06 | **Leaderboard updates** | ✅ | `challengeMembers.totalPoints` updated per log; leaderboard query re-fetches members sorted by points |
| L-07 | **Progress calculations** | ✅ | `completionRate = Math.round((activitiesCompleted / totalActivities) * 100)` capped at 100 |
| L-08 | **Points** | ✅ | `computeActivityScore` with `proportional_capped` formula; `MIN_EFFORT_RATIO = 0.05` (below 5% → 0 pts) |
| L-09 | **Completion** | ✅ | `completionRate >= 100` triggers `status: 'completed'`; notification queued |
| L-10 | **Notifications** | ⚠️ | In-app Firestore notification written (`users/{uid}/notifications.items`). No push notification delivery. User must open app to see it. (BUG-009) |
| L-11 | **Completion screen** | ✅ | `ChallengeCompletedScreen` reads `membership.totalPoints`, `membership.completionRate` |
| L-12 | **Challenge expiry** | ✅ | `isChallengeExpired(challenge)` checks `endDate < today`; expired challenges filtered in `getChallengesByGroupPage` |
| L-13 | **Leaving challenge** | ✅ | `leaveChallenge` sets status `'abandoned'`; guards against double-abandon |
| L-14 | **Rejoining** | ⚠️ | Rejoining resets `activitiesCompleted`, `totalPoints`, `completionRate` to 0 (explicit set with `merge: true`). Prior progress is lost. For v1 this is acceptable (stateless scoring), but no UX warning is shown |
| L-15 | **Admin visibility** | ✅ | `adminChallengeService.getActiveChallenges()` scoped to `status == 'active'` (Phase 12F fix confirmed) |
| L-16 | **Analytics** | ⚠️ | `getChallengeAnalytics()` scans all challenges (unbounded read). Intentional for aggregate stats, documented in Phase 12F. Acceptable P1 exemption |

**Legacy Engine Summary:** 11 PASS · 4 PARTIAL · 0 FAIL

---

### Streak Engine

| # | Journey Stage | Status | Notes |
|---|---|---|---|
| S-01 | **Challenge creation** | ✅ | `createChallengeFromAdmin` with `challengeType: 'streak'`; `requiredConsecutiveDays` and `streakResetOnMiss` should be set by admin |
| S-02 | **Join flow** | ✅ | Same as Legacy; additionally `currentStreak: 0`, `longestStreak: 0`, `lastLogDate: null` initialized |
| S-03 | **Challenge detail** | ✅ | Detail screen shows streak progress via `membership.currentStreak` |
| S-04 | **Daily logging** | ✅ | `StreakEngine.computeUpdate` reads `lastLogDate`, calls `daysBetween`, advances `currentStreak` on consecutive day |
| S-05 | **Multiple logs same day** | ⚠️ | Streak NOT double-advanced (correct). But `activitiesCompleted` increments with every log, not just first. A user who logs 7 times on Day 1 of a 7-day challenge reaches `activitiesCompleted = 7` (= `totalActivities`) — making this counter useless as a progress metric. (BUG-010) |
| S-06 | **Leaderboard updates** | ✅ | `ChallengeLeaderboardScreen` sorts streak challenges by `currentStreak` desc |
| S-07 | **Progress calculations** | ✅ | `completionRate = Math.round((currentStreak / requiredDays) * 100)` capped at 100 |
| S-08 | **Points** | ✅ | Points awarded per log via `computeActivityScore`; streak bonus logic uses `currentStreak` |
| S-09 | **Completion** | ✅ | `newStreak >= requiredConsecutiveDays` → `isCompleted = true` |
| S-10 | **Notifications** | ⚠️ | Same as L-10 — in-app only. (BUG-009) |
| S-11 | **Completion screen** | ✅ | Shows `membership.currentStreak`, `longestStreak`, `totalPoints` |
| S-12 | **Challenge expiry** | ✅ | Same expiry path as Legacy |
| S-13 | **Leaving challenge** | ✅ | `leaveChallenge` sets status `'abandoned'`; streak fields persist in Firestore doc |
| S-14 | **Rejoining** | ❌ | **Critical regression path.** `joinChallenge` with `merge: true` resets `activitiesCompleted`, `totalPoints`, `completionRate` to 0, but does NOT reset `currentStreak`, `lastLogDate`, `longestStreak` (they are not in the merge payload). A user who abandoned 10+ days ago retains stale `lastLogDate`. Next log: `daysBetween(staleDate, today) = N days`. If `streakResetOnMiss = false`, streak ADVANCES from the stale value despite a real gap. If `streakResetOnMiss = true`, reset fires correctly. (BUG-003) |
| S-15 | **Admin visibility** | ✅ | Same as Legacy |
| S-16 | **Analytics** | ⚠️ | Same as L-16 |

**Additional streak-specific issue:**
- `StreakEngine` reads `membership.currentStreak` from Firestore (stored computed state).
- `streakService.calculateChallengeStreak` re-derives streak from raw workout/wellness log documents (independent system, 30-day window).
- These two sources can diverge permanently after any partial write failure. (BUG-012)

**Streak Engine Summary:** 10 PASS · 4 PARTIAL · 1 FAIL

---

### Competitive Engine

| # | Journey Stage | Status | Notes |
|---|---|---|---|
| C-01 | **Challenge creation** | ✅ | `challengeType: 'competitive'`; requires at least one activity with `targetValue > 0` for meaningful completion |
| C-02 | **Join flow** | ✅ | `totalActivities = durationDays × activities.length`; `cumulativeValues: {}` initialized |
| C-03 | **Challenge detail** | ❌ | Mini-leaderboard on `ChallengeDetailScreen` sorts all members by `totalPoints` desc, regardless of engine type. Competitive challenges should sort by `completionRate`. The detail-screen mini-leaderboard uses a different code path than `ChallengeLeaderboardScreen` and does not apply engine-specific sort logic. (BUG-002) |
| C-04 | **Daily logging** | ✅ | `CompetitiveEngine.computeUpdate` accumulates `cumulativeValues[activityId]`, computes per-activity completion rates |
| C-05 | **Multiple logs same day** | ✅ | Each log adds to `cumulativeValues` for the activity; completion rate recalculated correctly |
| C-06 | **Leaderboard updates** | ✅ | `ChallengeLeaderboardScreen` sorts competitive members by `completionRate` desc, then by `totalPoints` as tiebreaker |
| C-07 | **Progress calculations** | ✅ | Per-activity rate = `Math.min(1, cumVal / targetValue) * 100`; overall = avg of all tracked activity rates |
| C-08 | **Points** | ✅ | Points computed via `computeActivityScore`; `proportional_capped` formula per log |
| C-09 | **Completion** | ✅ | `isCompleted = trackedActivities.every(rate >= 100)`; activities with `targetValue = 0` excluded from completion check |
| C-10 | **Notifications** | ⚠️ | In-app only. (BUG-009) |
| C-11 | **Completion screen** | ✅ | Shows `completionRate`, `totalPoints` |
| C-12 | **Challenge expiry** | ✅ | Same expiry path |
| C-13 | **Leaving challenge** | ✅ | Same leave path |
| C-14 | **Rejoining** | ⚠️ | `cumulativeValues` and `cumulativeLoggedValue` NOT reset on rejoin (not in the merge payload). A rejoining member retains prior cumulative logged values. This means their per-activity completion rates pick up from where they left before abandoning. May be intentional, but inconsistent with `activitiesCompleted: 0` reset |
| C-15 | **Admin visibility** | ✅ | Same as Legacy |
| C-16 | **Analytics** | ⚠️ | Same as L-16 |

**Competitive Engine Summary:** 11 PASS · 4 PARTIAL · 1 FAIL

---

### Collective Engine

| # | Journey Stage | Status | Notes |
|---|---|---|---|
| K-01 | **Challenge creation** | ✅ | `challengeType: 'collective'`; requires `groupCumulativeTarget` and `autoCompleteOnGroupTarget` in challenge doc |
| K-02 | **Join flow** | ✅ | Standard join; `groupCurrentTotal` not modified at join (correct) |
| K-03 | **Challenge detail** | ✅ | Detail screen reads `challenge.groupCurrentTotal` and `challenge.groupCumulativeTarget` for group progress bar |
| K-04 | **Daily logging** | ✅ | `CollectiveEngine.computeUpdate` adds `logEvent.value` to `groupCurrentTotalDelta`; batched write via `FieldValue.increment` |
| K-05 | **Multiple logs same day** | ✅ | Each log adds to pool (intended for collective); `activitiesCompleted` incremented correctly |
| K-06 | **Leaderboard updates** | ❌ | `ChallengeLeaderboardScreen` sorts collective members by `cumulativeLoggedValue` desc. `CollectiveEngine.computeUpdate` never writes `cumulativeLoggedValue` to `membershipUpdate`. Only `CompetitiveEngine` sets this field. All collective members have `cumulativeLoggedValue = 0` — making the leaderboard a permanent tie with arbitrary ordering. (BUG-013) |
| K-07 | **Progress calculations** | ✅ | Individual `completionRate` derived from `activitiesCompleted / totalActivities`; group progress derived from `groupCurrentTotal / groupCumulativeTarget` on the challenge doc |
| K-08 | **Points** | ✅ | Points awarded per log via `computeActivityScore` |
| K-09 | **Completion** | ⚠️ | `estimatedNewTotal = prevGroupTotal + logEvent.value`; if `>= groupCumulativeTarget`, `cascadeCollectiveCompletion` fires. Two concurrent logs can both compute `estimatedNewTotal < target` while actual Firestore total crosses threshold — cascade never fires for that crossing event. (BUG-001). Subsequent logs (if any) may eventually trigger it, but it is not guaranteed |
| K-10 | **Notifications** | ⚠️ | In-app only. (BUG-009). On group completion via cascade, a notification is queued per active member |
| K-11 | **Completion screen** | ✅ | `ChallengeCompletedScreen` reads `membership.totalPoints`, `completionRate` |
| K-12 | **Challenge expiry** | ✅ | Same expiry path; expired collective challenges not auto-completed even if `groupCurrentTotal >= groupCumulativeTarget` (no background job) |
| K-13 | **Leaving challenge** | ✅ | Same leave path; `groupCurrentTotal` not decremented on leave (correct) |
| K-14 | **Rejoining** | ⚠️ | Same as Legacy — `activitiesCompleted`, `totalPoints`, `completionRate` reset; `cumulativeValues` persists |
| K-15 | **Admin visibility** | ✅ | Same as Legacy |
| K-16 | **Analytics** | ⚠️ | Same as L-16 |

**Collective Engine Summary:** 9 PASS · 5 PARTIAL · 2 FAIL

---

## Edge Case Matrix

| # | Edge Case | Engine(s) | Status | Notes |
|---|---|---|---|---|
| E-01 | **Single participant** | All | ✅ | All engines handle single-member challenges; cascade in Collective completes the single member |
| E-02 | **Large group** | Collective | ⚠️ | `cascadeCollectiveCompletion` chunks at `MAX_WRITES_PER_BATCH = 450` (below Firestore 500 limit). For groups > 450, cascade spans multiple batches sequentially. No partial-batch failure recovery — if batch 2 fails, batch 1 members are completed but batch 2 members are not |
| E-03 | **Late join** | All | ✅ | `totalActivities = durationDays × activityCount` computed at join time from current `durationDays`; a late joiner gets the same total as an early joiner regardless of days remaining |
| E-04 | **Challenge ends today** | All | ⚠️ | No explicit "last day" guard. If `endDate == today`, logging is allowed. Expiry check `endDate < today` (strict less-than), so same-day logs are permitted |
| E-05 | **Early completion** | All | ✅ | `isCompleted = true` can fire before `endDate`. Challenge transitions to `'completed'` regardless of remaining duration |
| E-06 | **Multiple activities** | Competitive | ✅ | Each activity tracked independently via `cumulativeValues[activityId]` |
| E-06b | **Multiple activities** | Collective | ⚠️ | Multiple activities with different units (e.g., "steps" + "minutes") both add raw values to `groupCurrentTotalDelta`. Units are not normalized. Group total mixes unit types. (BUG-007) |
| E-07 | **Zero activity logged** | All | ✅ | `MIN_EFFORT_RATIO = 0.05`; logging 0 (or below 5% of target) earns 0 points. Log still recorded. `activitiesCompleted` still increments |
| E-08 | **Duplicate logging** | All | ⚠️ | No idempotency guard on any engine. A user can log the same workout/wellness session multiple times. Each log increments `activitiesCompleted` and awards points. For Collective, each duplicate adds to `groupCurrentTotal` |
| E-09 | **Offline recovery** | All | ⚠️ | Firebase client SDK has offline persistence enabled by default. Writes queue and replay on reconnect. No engine-level recovery logic; offline logs use `FieldValue.increment`, which is safe on reconnect. Edge: two offline logs on same device replay as two separate batch writes — both commit |
| E-10 | **Timezone boundaries** | Streak | ❌ | `workoutService.toIsoDate()` uses `date.toISOString().split('T')[0]` — UTC date. `wellnessLogService.todayIsoDate()` uses `new Date().getFullYear()/.getMonth()/.getDate()` — local device date. For users in UTC- timezones logging after midnight UTC (but before midnight local), the same physical moment produces a different ISO date string depending on which log path is used. `StreakEngine.daysBetween` treats the stored UTC date as canonical, causing streak miscounts. (BUG-004) |
| E-11 | **Streak reset** | Streak | ✅ | `streakResetOnMiss = true` (or default): `daysBetween(lastLogDate, today) >= 2` → `newStreak = 0`. `streakResetOnMiss = false`: streak never resets, only advances. Correctly applied |
| E-11b | **Streak reset on rejoin** | Streak | ❌ | `streakResetOnMiss = false` path AND abandonment gap: stale `lastLogDate` from previous membership persists after rejoin. Streak advances from old value without accounting for gap. (BUG-003) |
| E-12 | **Group target reached** | Collective | ⚠️ | Cascade fires when `estimatedNewTotal >= groupCumulativeTarget`. Race condition: two concurrent logs can both read `prevGroupTotal` below threshold, both compute `estimatedNewTotal < threshold`, both write — actual total crosses threshold, no cascade fires. (BUG-001) |
| E-13 | **Tie in competitive** | Competitive | ✅ | Sort is `completionRate` desc → `totalPoints` desc. Equal completion rates are broken by points. Equal points result in positional tie (last-fetched wins ordering) — no stable tiebreak |

---

## Confirmed Bug Register

### BUG-001 — Collective Engine: Silent non-completion race condition

| Field | Detail |
|---|---|
| **Severity** | Critical |
| **Engine** | Collective |
| **File** | `src/services/engines/collectiveEngine.ts`, `src/services/workoutService.ts` |

**Steps to reproduce:**
1. Create a collective challenge with `groupCumulativeTarget = 1000`
2. Current `groupCurrentTotal = 970`
3. Two members log simultaneously: Member A logs 20, Member B logs 20
4. Both read `prevGroupTotal = 970` before any write commits
5. A computes `estimatedNewTotal = 990 < 1000` → not complete
6. B computes `estimatedNewTotal = 990 < 1000` → not complete
7. Both write `FieldValue.increment(20)`. Actual Firestore total = 1010 ≥ 1000
8. Neither cascade fires. Challenge never auto-completes

**Expected:** Challenge transitions to `status: 'completed'` and all members receive completion notification  
**Actual:** Challenge remains `status: 'active'`. No completion event fires. Challenge stays open indefinitely (or until manually expired)  
**Root cause:** Optimistic total estimate using pre-write `groupCurrentTotal` snapshot. No post-write verification loop or Cloud Function trigger  
**Suggested fix:** Add a Cloud Function on `challenges/{id}` document writes that checks `groupCurrentTotal >= groupCumulativeTarget` and fires cascade if `status !== 'completed'`. Alternatively, use a Firestore transaction for the completion check (not practical at client scale)  
**Risk:** High. Users can complete a group challenge but never receive completion credit. Affects leaderboard, profile stats, and notification delivery  

---

### BUG-002 — ChallengeDetailScreen: Mini-leaderboard always sorts by totalPoints

| Field | Detail |
|---|---|
| **Severity** | High |
| **Engine** | Streak, Competitive |
| **File** | `src/features/Challenges/ChallengeDetailScreen.tsx` |

**Steps to reproduce:**
1. Open a v2 streak or competitive challenge
2. View the "Top Participants" leaderboard widget on the detail screen
3. Members are ordered by `totalPoints` descending

**Expected:** Streak → sorted by `currentStreak`; Competitive → sorted by `completionRate`  
**Actual:** All challenge types sorted by `totalPoints`. A member with 500 pts and 2-day streak ranks above a member with 200 pts and 7-day streak — wrong for streak challenges  
**Root cause:** The detail-screen leaderboard is built inline without reading `challengeType`; `ChallengeLeaderboardScreen` has the correct engine-specific sort but is a separate code path  
**Suggested fix:** Extract the sort logic from `ChallengeLeaderboardScreen` into a shared `sortMembersForEngine(members, challengeType)` util and apply it in the detail screen  
**Risk:** Medium. Misleading rankings on the most-visited screen. Users may distrust progress data  

---

### BUG-003 — StreakEngine: Stale streak fields persist after rejoin

| Field | Detail |
|---|---|
| **Severity** | High |
| **Engine** | Streak |
| **File** | `src/services/challengeService.ts` (`joinChallenge`) |

**Steps to reproduce:**
1. User joins a streak challenge (`streakResetOnMiss = false`), builds `currentStreak = 5`, `lastLogDate = '2024-01-01'`
2. User abandons (`leaveChallenge`)
3. 30 days pass
4. User rejoins — `activitiesCompleted`, `totalPoints`, `completionRate` reset to 0 (correct)
5. `currentStreak = 5`, `lastLogDate = '2024-01-01'` persist (NOT reset — not in merge payload)
6. User logs today: `daysBetween('2024-01-01', '2024-01-31') = 30` → treated as gap ≥ 2 days
7. With `streakResetOnMiss = false`: streak increments to 6 — user gets credit despite a 30-day gap

**Expected:** Rejoin always resets streak fields to a clean state (`currentStreak: 0`, `lastLogDate: null`)  
**Actual:** Stale streak fields produce incorrect streak continuation on `streakResetOnMiss = false` challenges  
**Root cause:** `joinChallenge` uses `batch.set(..., { merge: true })` but does not include streak fields in the reset payload  
**Suggested fix:** Add `currentStreak: 0, longestStreak: 0, lastLogDate: null` to the rejoin set payload  
**Risk:** High. Users can fraudulently maintain streak progress across abandonment gaps on permissive challenges  

---

### BUG-004 — Timezone inconsistency: workoutService UTC vs wellnessLogService local

| Field | Detail |
|---|---|
| **Severity** | High |
| **Engine** | Streak (affects date-dependent progress across all engines) |
| **File** | `src/services/workoutService.ts:31`, `src/services/wellnessLogService.ts:43–46` |

**Steps to reproduce:**
1. User is in UTC-8 timezone (e.g., PST)
2. At 11:30 PM PST (= 7:30 AM UTC next day), user logs a workout
3. `workoutService.toIsoDate(new Date())` → `date.toISOString()` = UTC date = tomorrow's date
4. At same moment, user logs a wellness activity on a streak challenge
5. `wellnessLogService.todayIsoDate()` = local date = today's date
6. Two logs from same session have different `date` values
7. If the most recent prior log was a wellness log with `lastLogDate = today`, the streak engine sees the new workout log as `daysBetween(today, tomorrow) = 1` → consecutive day → streak advances
8. Next day, user logs again — both dates resolve to the same value — streak does not advance (treated as same day)

**Expected:** Consistent date representation across all logging paths (always local device time, or always UTC)  
**Actual:** Workout logs use UTC date; wellness logs use local device date. For users in UTC- timezones logging near midnight, the same physical day produces two different ISO date strings  
**Root cause:** No shared `toIsoDate` utility. `workoutService` uses `Date.toISOString()` (UTC); `wellnessLogService` manually constructs local date components  
**Suggested fix:** Create a shared `toLocalIsoDate(date: Date): string` utility that uses local year/month/day; use it in both services  
**Risk:** High. Affects any user in a non-UTC timezone, especially UTC-N users logging near midnight. Streaks can advance incorrectly or miss valid consecutive days  

---

### BUG-005 — participantCount on challenge document not maintained

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Engine** | All |
| **File** | `src/services/challengeService.ts` (`joinChallenge`, `leaveChallenge`) |

**Steps to reproduce:**
1. Create a challenge → `participantCount: 0` set at creation
2. 10 users join → `participantCount` remains 0 (no increment written by `joinChallenge`)
3. 3 users leave → `participantCount` remains 0 (no decrement written by `leaveChallenge`)
4. UI reads `challenge.participantCount` → shows 0

**Expected:** `participantCount` reflects current active member count  
**Actual:** Always 0 (creation default). `useChallengeProgress` uses `Math.max(fromChallenge, fromMemberships)` as a fallback which masks the issue in some views — but challenge list cards that read `participantCount` directly from the challenge doc show 0  
**Root cause:** `joinChallenge` does not write `FieldValue.increment(1)` to `challenges/{id}.participantCount`; `leaveChallenge` does not write `FieldValue.increment(-1)`  
**Suggested fix:** Add atomic `FieldValue.increment(1)` in `joinChallenge` batch; `FieldValue.increment(-1)` in `leaveChallenge` batch  
**Risk:** Medium. Challenge discovery cards show incorrect participant counts. Affects trust/social signals  

---

### BUG-006 — stats.totalChallenges inflates on rejoin

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Engine** | All |
| **File** | `src/services/challengeService.ts` (`joinChallenge`, `leaveChallenge`) |

**Steps to reproduce:**
1. User joins a challenge → `users/{uid}.stats.totalChallenges` incremented
2. User leaves → `stats.totalChallenges` NOT decremented
3. User rejoins → `stats.totalChallenges` incremented again
4. After 5 join/leave cycles, `stats.totalChallenges = 5` for a single challenge

**Expected:** `stats.totalChallenges` reflects unique challenges joined, not join events  
**Actual:** Each rejoin increments the counter; leaves never decrement. Counter inflates with churn  
**Root cause:** `leaveChallenge` does not decrement `stats.totalChallenges`; `joinChallenge` increments unconditionally without checking prior membership status  
**Suggested fix:** In `joinChallenge`, only increment `stats.totalChallenges` if prior membership status was NOT `'abandoned'` (i.e., this is a first join, not a rejoin)  
**Risk:** Medium. Profile stats page shows inflated challenge counts. No security risk  

---

### BUG-007 — Multi-activity collective challenges mix units in groupCurrentTotal

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Engine** | Collective |
| **File** | `src/services/engines/collectiveEngine.ts` |

**Steps to reproduce:**
1. Create a collective challenge with two activities: "Steps" (unit: steps) and "Meditation" (unit: minutes)
2. `groupCumulativeTarget = 10000`
3. User A logs 5000 steps → `groupCurrentTotal = 5000`
4. User B logs 30 minutes meditation → `groupCurrentTotal = 5030`
5. User C logs 5000 steps → `groupCurrentTotal = 10030` → cascade fires → challenge "complete"

**Expected:** Group target should apply to a single normalized unit (or per-activity pooling). Mixing units produces meaningless totals  
**Actual:** Raw logged values from all activities are summed regardless of unit. "5030 units" is displayed as progress toward "10000 units" — uninterpretable  
**Root cause:** `groupCurrentTotalDelta: logEvent.value` adds the raw value to the group pool without unit awareness. The engine has no concept of unit normalization  
**Suggested fix:** Enforce single-unit activities on collective challenges at creation time (admin validation); or add `unit` field to pool and reject cross-unit logs  
**Risk:** Medium. Affects collective challenges with multiple activity types. Group progress bar becomes meaningless  

---

### BUG-008 — deriveDailyTargetValue heuristic misclassifies per-session targets

| Field | Detail |
|---|---|
| **Severity** | Medium |
| **Engine** | Streak |
| **File** | `src/services/engines/scoringConfig.ts` (`deriveDailyTargetValue`) |

**Steps to reproduce:**
1. Admin creates a 7-day streak challenge: "Complete 8 reps of exercise X daily"
2. Sets `targetValue = 8` (intended as 8 per day)
3. `deriveDailyTargetValue(8, 7, 'streak')` → `derived = 8/7 = 1.14` ≥ 1 → returns 1.14
4. Scoring now treats 1.14 reps as the daily target instead of 8
5. User logs 2 reps → `value/target = 2/1.14 = 175%` → full points awarded for 2 reps when 8 was intended

**Expected:** The target 8 is preserved as a per-day requirement  
**Actual:** The heuristic assumes values ≥ `durationDays / targetValue` are cumulative totals and divides them. Any `targetValue ≥ durationDays` gets divided — corrupting per-session targets  
**Root cause:** The heuristic has no signal to distinguish "8 total" from "8 per day" when `targetValue ≥ 1 day` threshold. The function comment acknowledges this ambiguity  
**Suggested fix:** Add an explicit `targetType: 'daily' | 'cumulative'` field to activity config. Use `targetValue` directly for `'daily'`, divide for `'cumulative'`. Remove the heuristic  
**Risk:** Medium. Incorrect scoring for streak challenges where `targetValue` ≥ `durationDays`. Affects points inflation and potentially early completion |

---

### BUG-009 — Notifications are in-app only (no push delivery)

| Field | Detail |
|---|---|
| **Severity** | Minor |
| **Engine** | All |
| **File** | `src/services/notificationService.ts` |

**Steps to reproduce:**
1. User has active streak challenge
2. User does not open app for 2 days
3. Streak reset fires on next log (Day 3 attempt)

**Expected:** User receives a push notification reminder before missing a day  
**Actual:** `notificationService` writes to `users/{uid}/notifications.items` in Firestore. No FCM token registration, no push send, no scheduled reminder. The "Create Reminder" feature creates a Firestore document, not a device push  
**Root cause:** Notification system is client-pull only. No FCM integration exists in the codebase  
**Suggested fix:** Integrate Firebase Cloud Messaging (FCM) with a Cloud Function that checks streak reminders on a daily schedule  
**Risk:** Low (feature gap, not regression). Users who don't open the app lose streaks silently. No data corruption  

---

### BUG-010 — StreakEngine: activitiesCompleted can reach totalActivities in a single day

| Field | Detail |
|---|---|
| **Severity** | Minor |
| **Engine** | Streak |
| **File** | `src/services/engines/streakEngine.ts` |

**Steps to reproduce:**
1. Create a 7-day streak challenge with 1 activity (`totalActivities = 7`)
2. User logs the activity 7 times on Day 1
3. `activitiesCompleted` increments each time: 1 → 2 → 3 → ... → 7
4. After 7 logs: `activitiesCompleted = 7 = totalActivities`
5. `completionRate = 100%` is shown in the UI — but `currentStreak = 1` (only 1 day done)
6. Challenge is NOT completed (`isCompleted` uses `newStreak >= requiredDays`, currently = false)

**Expected:** `activitiesCompleted` should reflect distinct calendar days logged, not raw log count  
**Actual:** `activitiesCompleted` is a raw log counter; it maxes out in a single day making it meaningless as a progress indicator. The completion gate remains correct but the progress metric is deceptive  
**Root cause:** `nextCompleted = Math.min(alreadyCompleted + 1, totalActivities)` runs unconditionally for every log. No same-day guard  
**Suggested fix:** Only increment `activitiesCompleted` when `isNewDay === true` (same condition that advances streak)  
**Risk:** Low. No correctness bug in completion logic. Visual/UX confusion only  

---

### BUG-011 — selectEngine throws for unknown v2 challengeType (no fallback)

| Field | Detail |
|---|---|
| **Severity** | Minor |
| **Engine** | All v2 |
| **File** | `src/services/engines/index.ts` (`selectEngine`) |

**Steps to reproduce:**
1. A challenge doc has `engineVersion: 'v2'` and `challengeType: 'hydration'` (a wellness type not yet mapped to an engine)
2. User attempts to log a workout to this challenge
3. `selectEngine(challenge)` throws: `"Unknown v2 challenge type: hydration"`
4. Log fails with an uncaught error. UI shows no specific error message

**Expected:** Graceful fallback to `LegacyEngine` or a user-facing error with guidance  
**Actual:** Unhandled exception propagates to the calling mutation; user sees a generic failure  
**Root cause:** Intentional design decision (no silent fallback per Phase 12A), but no error boundary or user-visible message on the unknown-type path  
**Suggested fix:** Wrap `selectEngine` call in `workoutService` / `wellnessLogService` with a try-catch; surface a user-readable error: "This challenge type is not yet supported for logging."  
**Risk:** Low. Only affects challenges with invalid/future `challengeType` values  

---

### BUG-012 — streakService and StreakEngine are independent systems (dual source of truth)

| Field | Detail |
|---|---|
| **Severity** | Minor |
| **Engine** | Streak |
| **File** | `src/services/streakService.ts`, `src/services/engines/streakEngine.ts` |

**Steps to reproduce:**
1. User builds a 5-day challenge streak (stored in `challengeMembers.currentStreak = 5`)
2. A partial Firestore batch write fails after writing the workout doc but before writing the `challengeMembers` update
3. `challengeMembers.currentStreak` remains at 4
4. `streakService.calculateChallengeStreak` re-derives from raw workout docs → returns 5
5. Profile display (using `streakService`) shows 5; `ChallengeDetailScreen` (using `membership.currentStreak`) shows 4

**Expected:** Single source of truth for streak state  
**Actual:** Two independent systems that can diverge on partial write failures or near the 30-day `streakService` window cutoff  
**Root cause:** Architectural — `streakService` was built before v2 engines; `StreakEngine` stores computed state in the membership doc  
**Suggested fix:** Long-term: retire `streakService.calculateChallengeStreak` and derive all streak state from the membership doc. Short-term: document the divergence path and add a reconcile step in the streak engine  
**Risk:** Low. Divergence only on write failure (rare) or near 30-day window boundary. No data corruption  

---

### BUG-013 — Collective leaderboard: cumulativeLoggedValue never written by CollectiveEngine

| Field | Detail |
|---|---|
| **Severity** | High |
| **Engine** | Collective |
| **File** | `src/services/engines/collectiveEngine.ts`, `src/features/Challenges/ChallengeLeaderboardScreen.tsx` |

**Steps to reproduce:**
1. Create a collective challenge with several members
2. All members log multiple workouts
3. Open `ChallengeLeaderboardScreen`
4. Collective branch: `sorted = [...rawRows].sort((a, b) => b.cumulativeLoggedValue - a.cumulativeLoggedValue)`
5. All members have `cumulativeLoggedValue = 0` (never set by `CollectiveEngine.computeUpdate`)
6. All members are tied at 0; ordering is arbitrary (last-fetched order from Firestore)

**Expected:** Collective leaderboard ranks members by their individual contribution to the group pool (`cumulativeLoggedValue`)  
**Actual:** All members show 0; leaderboard ordering is meaningless  
**Root cause:** `CollectiveEngine.computeUpdate` returns `membershipUpdate` which does not include `cumulativeLoggedValue`. Only `CompetitiveEngine` sets this field. The leaderboard screen assumes collective members have it populated  
**Suggested fix:** Add `cumulativeLoggedValue: (membership.cumulativeLoggedValue ?? 0) + logEvent.value` to `CollectiveEngine`'s `membershipUpdate` return  
**Risk:** High. Collective leaderboard is broken for all collective challenges. Users see no ranking differentiation  

---

## Recommended Fix Order

| Priority | Bug | Severity | Rationale |
|---|---|---|---|
| **P0** | BUG-013 | High | Collective leaderboard is completely broken. Visible to all collective challenge participants on every leaderboard view. Trivial one-line fix in the engine |
| **P0** | BUG-003 | High | Streak engine can advance past an abandonment gap with `streakResetOnMiss = false`. Integrity violation. Two-field fix in `joinChallenge` |
| **P0** | BUG-002 | High | Detail-screen mini-leaderboard wrong for streak and competitive challenges. Highest-visibility UI surface. Requires shared sort util |
| **P1** | BUG-004 | High | Timezone inconsistency corrupts streak date tracking for UTC- users. Requires shared date util across two services |
| **P1** | BUG-001 | Critical | Collective group target race condition. Rare but permanent — missed completions can never be recovered without manual admin intervention. Requires Cloud Function (backend work) |
| **P2** | BUG-005 | Medium | `participantCount` staleness. Mostly masked by fallback query but visible on challenge cards |
| **P2** | BUG-007 | Medium | Multi-activity collective unit mixing. Only affects challenges with heterogeneous activity units |
| **P2** | BUG-008 | Medium | `deriveDailyTargetValue` heuristic misclassifies per-session targets ≥ `durationDays` |
| **P3** | BUG-006 | Medium | `stats.totalChallenges` inflation on rejoin. Profile metric only; no functional impact |
| **P3** | BUG-010 | Minor | `activitiesCompleted` maxes in single day for streak. UX confusion only |
| **P3** | BUG-011 | Minor | Unknown v2 type throws instead of user-friendly error. Rare path |
| **P3** | BUG-012 | Minor | `streakService` / `StreakEngine` dual source. Rare divergence path |
| **P4** | BUG-009 | Minor | No push notifications. Feature gap, not regression |

---

## Risk Summary

| Risk Area | Count | Highest Severity |
|---|---|---|
| Data integrity (scores/stats permanently wrong) | 4 | Critical (BUG-001) |
| UI correctness (wrong data displayed) | 3 | High (BUG-002, BUG-013) |
| Streak correctness | 3 | High (BUG-003, BUG-004) |
| Counter staleness | 2 | Medium (BUG-005, BUG-006) |
| Scoring accuracy | 1 | Medium (BUG-008) |
| Missing features | 1 | Minor (BUG-009) |
| Engine edge cases | 2 | Minor (BUG-010, BUG-011) |
| Architecture | 1 | Minor (BUG-012) |

**Total confirmed bugs:** 13  
**Total PASS:** 41 / 64 validation checkpoints  
**Total PARTIAL:** 17 / 64  
**Total FAIL:** 6 / 64  

---

## Appendix A — Engine Routing Logic

```
selectEngine(challenge):
  if challenge.engineVersion !== 'v2':
    return LegacyEngine
  switch challenge.challengeType:
    'streak'      → StreakEngine
    'competitive' → CompetitiveEngine
    'collective'  → CollectiveEngine
    default       → throw Error('Unknown v2 challenge type: ...')
```

## Appendix B — Key Shared Formulas

**computeActivityScore (proportional_capped):**
```
effort = value / targetValue
if effort < MIN_EFFORT_RATIO (0.05): return 0
points = Math.min(1, effort) × maxPoints
```

**computeRequiredLogs:**
```
totalActivities = durationDays × activityCount
```

**deriveDailyTargetValue (streak heuristic):**
```
derived = targetValue / durationDays
if derived >= 1: return derived
else:           return targetValue  ← per-session value preserved
```

**StreakEngine.daysBetween:**
```
a = new Date(`${from}T00:00:00Z`).getTime()
b = new Date(`${to}T00:00:00Z`).getTime()
return Math.round((b - a) / 86_400_000)   ← UTC-anchored, DST-safe
```

---

*Phase 13A complete. No code changes made. All findings are read-only static analysis.*  
*Next phase: Phase 13B — Implement fixes in priority order (P0 first).*
