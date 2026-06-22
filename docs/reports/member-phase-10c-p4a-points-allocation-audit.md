# Phase 10C-P4A — Points Allocation Audit

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: AUDIT COMPLETE — no code changes made

---

## Executive Summary

Tiizi currently uses **two parallel, disconnected scoring systems** that award points inconsistently. Points are mostly hardcoded at 10 per activity regardless of effort, target completion, or challenge type. Leaderboard scores are calculated independently by Cloud Functions using the raw logged value (reps, minutes, ml) — a different metric entirely. The `challengeMembers.totalPoints` field that the client increments is never read by leaderboards or user metrics, making it an orphaned counter. There is no target-based validation, no daily cap, no duplicate prevention at the service level, and no difference between a user logging 1 rep vs 1,000 reps on a 1,200-rep challenge.

---

## 1. Current Behavior: Where Points Are Awarded

### 1A. Client-Side Point Assignment (Fixed 10 pts)

**`src/features/Workouts/LogWorkoutScreen.tsx:119`**
```ts
points: 10,  // hardcoded — no reference to targetValue, challenge type, or logged value
```

**`src/features/Workouts/LogWellnessActivityScreen.tsx:111`**
```ts
points: 10,  // hardcoded — same issue
```

**`src/features/Workouts/SelectChallengeActivityScreen.tsx:195`**
```ts
const points = Number(optional.pointsPerCompletion ?? 10);
```
This is the only UI path that reads `pointsPerCompletion` from the challenge activity config. It is used when the user logs all activities on the challenge's activity selection screen, not for individual activity drill-downs.

**`src/features/Admin/Challenges/CreateChallengeScreen.tsx:145,231,537`**  
Admin can set `pointsPerCompletion` per activity when creating a challenge. Default is 10.

### 1B. Service-Level Point Storage

**`src/services/activityLogSessionService.ts:237`**
```ts
const points = Math.max(1, Math.min(ACTIVITY_WRITE_LIMITS.maxWellnessPoints, Number(entry.points ?? 10)));
totalPoints += points;
```
Accepts client-provided `entry.points`, capped between 1–1000, defaults to 10. The total is written to `challengeMembers.totalPoints` via `increment(totalPoints)`.

**Written to:**
- `wellnessLogs.points` — stored on each wellness log document
- `challengeMembers.totalPoints` — incremented per session

**NOT written to:**
- `workouts` — the workout document has no `points` field; only `value`, `unit`, `userId`, `challengeId`, `exerciseId`

### 1C. Cloud Function Scoring (Value-Based, Not Points-Based)

**`functions/src/memberActivitySummaries.ts`**

On every `workouts` document create:
```ts
score: clampNumber(Math.round(value), 1, 1000)
// e.g., log 50 reps → score = 50
```

On every `wellnessLogs` document create:
```ts
score: clampNumber(Math.round(numberValue(data, 'points') || value || 1), 1, 1000)
// uses points field if present, otherwise falls back to value
```

The score is incremented in:
- `challengeLeaderboards/{challengeId}_{userId}.score`
- `groupLeaderboards/{groupId}_{userId}.score`
- `groupMemberStats/{groupId}_{userId}.score`
- `groupActivityFeed.score` (per event)
- `challengeActivitySummaries.totalScore`

**No trigger exists that recalculates scores.** Each activity log creates an immutable score increment. There is no rollback, recalculation, or target-checking.

---

## 2. Answers to Audit Questions

### Q1: Where are points currently awarded?
**Two places, independently:**
1. Client-side in `activityLogSessionService` → stored in `challengeMembers.totalPoints` (write-only, never read by any display)
2. Server-side in Cloud Function `summarizeWorkoutCreated` / `summarizeWellnessLogCreated` → stored in `challengeLeaderboards.score` (what leaderboards display)

### Q2: Are points awarded client-side, server-side, or both?
**Both, with different formulas.** Client awards fixed 10 pts to `challengeMembers.totalPoints`. Cloud Function awards `Math.round(value)` (raw reps/ml/minutes) to `challengeLeaderboards.score`.

### Q3: Is there one fixed points value per log?
**Yes, on the client side** — 10 points per log in LogWorkoutScreen and LogWellnessActivityScreen. `SelectChallengeActivityScreen` reads `pointsPerCompletion` from challenge config (usually also 10). **On the server side** the score equals the raw logged value, so it varies per log.

### Q4: Are points awarded even when the activity does not meet the target?
**Yes, always.** Neither the client nor the Cloud Function checks whether `value >= targetValue`. A user logging 1 rep on a 1,200-rep pushup target gets the same 10 points to `totalPoints` and a score of 1 on the leaderboard.

### Q5: Are points tied to challenge type?
**No.** Collective, competitive, and streak challenges all use the same fixed-10 client logic and value-based server logic. There is no differentiation.

### Q6: Are points tied to activity quantity, duration, reps, distance, calories, time, or target completion?
- **Client `totalPoints`**: No — fixed at 10 per log, not tied to any metric.
- **Leaderboard `score`**: Yes — directly equals the raw logged value (reps, ml, minutes, etc.). This means 200 reps = score 200, regardless of what the target was.

### Q7: Are wellness activities scored differently from workout activities?
- **Client `totalPoints`**: No — both hardcoded at 10.
- **Leaderboard `score`**: Slightly. Workouts use `Math.round(value)`. Wellness logs use `points || value` (prefers the stored `points` field, which is the client-provided fixed 10 — so wellness scores are capped at 10, while workouts with large values like 200 reps score 200).

**Result**: A user logging 200 pushups scores 200 on the leaderboard. A user logging 2 liters of water (2000ml) scores only 10 (because wellness logs store `points=10` which is used as the score). **Workout logs and wellness logs are scored on completely different scales.**

### Q8: Can users game the system by logging small/incomplete activities repeatedly?
**Yes, trivially.** No per-day limit on number of logs. No minimum value. Logging 1 rep once per minute awards 1 pt per log to the leaderboard (and 10 pts per log to `totalPoints`). The only constraints are:
- `activityLogSessionService` throws if `value <= 0`
- `assertSafeActivityValue` throws if `value > max` (max is 10,000 reps or 1,440 minutes)
- The Firestore rules cap `activitiesCompleted <= configuredActivities` per session, but a new session can be started immediately

### Q9: Do cumulative, competitive, streak, and wellness challenges currently use different progress logic?
**No.** All challenges use the same `activitiesCompleted / configuredActivities` progress calculation in `activityLogSessionService`. The challenge `challengeType` field (`'collective'` | `'competitive'` | `'streak'`) is not read by the logging service. The label "Weekly Consistency" in `CollectiveChallengeScreen` reads leaderboard `score` but it's just the raw value sum, not a streak or consistency metric.

### Q10: Are leaderboards based on points, progress, logs, completion rate, or mixed fields?
`challengeLeaderboards` and `groupLeaderboards` are ordered by `score DESC`. The `score` field is the **cumulative sum of raw logged values** (workout) or `points` (wellness, fixed 10). The leaderboard label "XP" displayed in `ChallengeLeaderboardScreen` and `CollectiveChallengeScreen` is actually this raw-value score, not a meaningful XP metric.

### Q11: Are completed/expired challenge points still counted correctly?
`challengeLeaderboards.score` is incremented for every activity log. Once a challenge membership is `completed`, `activityLogSessionService` still allows logging (line 94: `isAllowedMemberStatus` returns true for `'completed'`). So yes, users can log against a completed membership and continue accumulating score. There is no cap.

### Q12: Are duplicate logs or same-day repeated logs handled safely?
- **Service level**: No. `activityLogSessionService` does not check for existing logs on the same day. Multiple submissions on the same day all increment `challengeLeaderboards.score`.
- **Client display level**: `activityLogMetrics.ts` (`mergeActivityLogs`) deduplicates by `userId|challengeId|groupId|activityId|day` — keeping only the highest-score log for display purposes. But this deduplication is only applied when rendering the client-side activity list. The underlying Firestore data has all the duplicate documents, and the Cloud Function has already incremented `challengeLeaderboards.score` for each.

### Q13: Are there Firestore rule risks if points are user-writable?
**Yes, significant risk.** `challengeMembers.totalPoints` is written by the client via `increment(totalPoints)`. The Firestore rules (`isSafeChallengeProgressUpdate`) allow this as long as the increment doesn't exceed `totalActivities * maxWellnessPoints` (1000) per session. However:
- `maxWellnessPoints = 1000` means a single session can claim up to 1000 points
- The client sends `entry.points` which the service trusts (capped at 1000)
- A malicious client could send `points: 1000` for every activity, awarding 1000 * configuredActivities per session

The Cloud Function scoring is safer (it reads the stored value, not a client-declared score), but workouts don't store a `points` field — the leaderboard score for workouts equals the logged value, which a user could inflate to 10,000 reps.

### Q14: Are there migration/backfill implications if scoring logic changes?
**Yes, major.** Changing scoring rules retroactively would require:
1. Recalculating `challengeLeaderboards.score` for all existing activity logs
2. Recalculating `challengeMembers.totalPoints` for all existing memberships (or discarding it)
3. Potentially re-ranking every leaderboard entry

The `rebuildUserMetricsForUser` function in `memberUserMetrics.ts` provides a pattern for full rebuild. A similar `rebuildLeaderboardScores` function would be needed.

---

## 3. Root Causes

| # | Root Cause | Impact |
|---|-----------|--------|
| RC-1 | `LogWorkoutScreen` and `LogWellnessActivityScreen` hardcode `points: 10` — do not read challenge activity `pointsPerCompletion` | Client `totalPoints` is meaningless |
| RC-2 | Cloud Function scores workouts by raw value, wellness by points field — different scales, both uncapped | Leaderboard reflects volume, not effort relative to target |
| RC-3 | `challengeMembers.totalPoints` is incremented but never read by any leaderboard, display, or metric | Dead field; scoring system has no unified denominator |
| RC-4 | No target-completion check before awarding points or score | 1 rep on a 1200-rep challenge scores the same as meeting the target |
| RC-5 | No per-day logging limit | Spam logging is possible and undetected |
| RC-6 | Duplicate log prevention is client-side display only, not enforced in Firestore or Cloud Functions | Multiple logs per day accumulate real scores |
| RC-7 | Challenge type not used in scoring logic | Streak, competitive, and collective challenges are scored identically |
| RC-8 | `activityLogSessionService` allows logging against `status='completed'` memberships | Unlimited post-completion score accumulation |

---

## 4. Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Pilot users with high reps (e.g., 200 pushups) will dominate leaderboards purely by volume | High | Score = raw reps, so a strong user logging 200 reps per day accumulates 200/day vs a beginner logging 20/day |
| Wellness and workout participants compete on incomparable scales | High | Pushup score is reps; fasting score is 10 fixed |
| Users can inflate points by logging minimal effort repeatedly | High | No floor based on % of target met |
| `challengeMembers.totalPoints` grows but is invisible — false sense of a points system | Medium | Points shown in `WorkoutLoggedScreen` (hardcoded 10) feel arbitrary |
| Any scoring change requires retroactive leaderboard rebuild | Medium | Changing the formula after launch invalidates existing rankings |
| Score accumulation after challenge completion | Low-Medium | Doesn't affect pilot significantly but creates data inconsistency |

---

## 5. Recommended Scoring Framework

### A. Cumulative Challenges
**Example: 30-Day Pushup Duel — 1200 total reps over 30 days**

**Recommended model: contribution points = proportional to target progress, capped per day**

```
dailyTarget = challenge.targetValue / challenge.durationDays
               (1200 / 30 = 40 reps/day target)

pointsEarned = min(loggedValue / dailyTarget, 1.5) × basePointsPerDay
```

- Meeting the daily target (40 reps): 100% of basePointsPerDay (e.g., 10 pts)
- Exceeding by 50% (60 reps): 1.5× = 15 pts (capped at 1.5×)
- Falling short (20 reps): 0.5× = 5 pts
- Logging 1 rep: `1/40 = 0.025` → 0.25 pts (rounds to 0 — no gaming incentive)

**Leaderboard field**: `totalPoints` or new `adjustedScore` = cumulative proportional points

### B. Competitive Challenges
**Example: Who logs the most reps this week**

**Recommended model: raw value with daily log cap**

```
dailyLogCap = max(1, configuredDailyFrequency) logs per activity per day
sessionMaxValue = challenge activity targetValue × 2 (hard cap)
score = min(loggedValue, sessionMaxValue)
```

- Single-log cap prevents spam (multiple logs same day don't all count)
- Value cap (2× target) prevents absurd inflation
- Leaderboard score = cumulative value across all non-duplicate sessions

**Note**: The existing `mergeActivityLogs` deduplication (keep highest per day per activity) is the correct approach — enforce it at write time, not just display time.

### C. Streak Challenges
**Example: Log any workout 7 days in a row**

**Recommended model: binary daily completion + streak multiplier**

```
dailyPoints = basePoints (e.g., 10 pts) if value >= targetValue, else 0
streakBonus = floor(currentStreak / 7) × streakBonusPoints (e.g., 5 pts per full week)
```

- Partial effort (below target) earns 0 streak points — streak challenges are binary
- Streak multiplier rewards consistency without capping leaderboard unfairly
- Missing a day resets the streak bonus (but doesn't claw back earned points)

### D. Wellness Challenges
**Example: Fast 16h/day, drink 2L/day, sleep 7h/night**

**Recommended model: binary target threshold (not proportional)**

```
binary wellness (fasting, sleep):
  - Met target (≥ targetValue): 100% of pointsPerCompletion (e.g., 10 pts)
  - Partially met (50–99%): 50% of pointsPerCompletion (5 pts)
  - Below 50% of target: 0 pts

quantity wellness (hydration):
  - Scale: min(value / targetValue, 1.5) × pointsPerCompletion
  - Cap at 1.5× to prevent gaming (logging 10L of water for 15 pts)
```

**Current bug**: Wellness `score` in Cloud Function = `points` field (10 fixed), not the logged value. For wellness, the `points` field should be calculated based on target completion, not hardcoded.

### E. Multi-Activity Challenges
**Example: Push-Up + Bear Crawl Hold (2 activities per session)**

**Recommended model: per-activity proportional scoring, session score = sum of all activity scores**

```
for each activity in session:
  activityScore = proportionalScore(loggedValue, activity.targetValue, activity.pointsPerCompletion)

sessionScore = sum(activityScores)
membershipProgress = sessionCount / expectedSessionCount (NOT activitiesCompleted / configuredActivities)
```

**Key fix needed**: `activitiesCompleted` currently counts "activity slots logged in a session" (0 → configuredActivities per session). For a multi-session challenge, this should count "sessions completed" toward a target session count (e.g., 30 sessions for a 30-day challenge).

This replaces the P3C fix: instead of blocking auto-completion by checking `!endAt`, the correct model would be:
- `totalActivities` = expected session count (set at join time from challenge duration/frequency)
- `activitiesCompleted` = sessions completed (incremented by 1 per session, not by `entries.length`)
- Completion condition: `activitiesCompleted >= totalActivities`

### F. Anti-Gaming Rules

| Rule | Implementation |
|------|---------------|
| **Daily log cap** | One log per activity per day per user enforced in Cloud Function (reject duplicate; current client-side dedup is insufficient) |
| **Minimum valid effort** | `loggedValue >= targetValue × 0.05` to earn any points (5% floor prevents 1-rep gaming) |
| **Session value cap** | `loggedValue <= activity.targetValue × 3` hard cap to prevent absurdly inflated scores |
| **Post-completion logging** | Block new logs once `membership.status === 'completed'` (current code allows it) |
| **Retroactive scoring** | Cloud Function trigger rejects logs with `createdAt` older than 7 days (already implemented at `maxPastAgeMs`) |
| **Spam session rate limit** | Minimum 30 minutes between sessions for the same challenge (needs new Cloud Function check) |

### G. Data Model Impact

**`challenge.activities[]`** (add if missing):
```ts
{
  targetValue: number,        // ✅ exists
  pointsPerCompletion: number,  // ✅ exists, but defaults to 10 — needs semantic meaning
  dailyFrequency: number,     // ✅ exists
  scoringMethod: 'proportional' | 'binary' | 'value';  // ← NEW: drives score formula
}
```

**`workouts`** (add):
```ts
{
  points: number,    // ← NEW: store computed points at log time (currently missing)
  targetValue?: number, // ← NEW: store the target at log time for audit trail
  metTarget: boolean,   // ← NEW: did value meet or exceed targetValue?
}
```

**`wellnessLogs`** (already has `points`; change meaning):
```ts
{
  points: number,  // ✅ exists — change from hardcoded 10 to computed proportional/binary score
  metTarget: boolean,  // ← NEW
}
```

**`challengeMembers`** (add):
```ts
{
  sessionsCompleted: number,   // ← NEW: counts sessions, not activity slots
  totalSessions: number,       // ← NEW: expected total sessions (replaces totalActivities for duration-based challenges)
  totalValue: number,          // ← NEW: cumulative value toward target (for cumulative challenges)
  targetValue: number,         // ← NEW: total target value for the challenge (sum of all activity targets × frequency)
  dailyStreak: number,         // ← NEW: current consecutive days logged
  lastLogDate: string,         // ← NEW: ISO date of last log (for streak calculation at log time)
}
```

**`challengeLeaderboards`**:
```ts
{
  score: number,          // ✅ exists — keep, but change formula
  totalValue: number,     // ← NEW: raw cumulative value (separate from score)
  daysActive: number,     // ← NEW: distinct days logged (for streak/consistency ranking)
  lastActivityAt: Timestamp, // ✅ exists
}
```

**`userMetrics`**:
```ts
{
  totalPointsEarned: number,  // ← NEW: cross-challenge lifetime points
  // currentStreak ✅ exists — but definition needs clarification (any log vs. target-met log)
}
```

**`memberHome`**:
```ts
{
  primaryActiveChallenge.progress: number, // ✅ exists — ensure it uses totalValue/targetValue
  primaryActiveChallenge.progressLabel: string, // ✅ exists
}
```

**`challenge` (definition)**:
```ts
{
  challengeType: 'collective' | 'competitive' | 'streak',  // ✅ exists
  scoringVersion: string,  // ← NEW: 'v1-fixed' | 'v2-proportional' for migration
}
```

---

## 6. Implementation Phases

### Phase P4B: Scoring Constants and Config
**Goal**: Define the scoring model without changing any live code.
- Create `src/services/scoringConfig.ts` with scoring formulas, constants, challenge-type rules
- No live impact, no migration

### Phase P4C: Client-Side Points Fix
**Goal**: Fix `LogWorkoutScreen` and `LogWellnessActivityScreen` to compute points from challenge config instead of hardcoding 10.
**Files**: `LogWorkoutScreen.tsx`, `LogWellnessActivityScreen.tsx`, `SelectChallengeActivityScreen.tsx`

### Phase P4D: Service-Level Target Validation
**Goal**: `activityLogSessionService` reads `challenge.activities[i].targetValue` and computes proportional/binary points before writing.
**Files**: `activityLogSessionService.ts`, `activityWriteGuards.ts`
**Risk**: Firestore rules cap `totalPoints increment <= totalActivities × 1000`. If new per-activity scores are higher, rules need updating.

### Phase P4E: Cloud Function Score Fix
**Goal**: `summarizeWorkoutCreated` computes score from target-proportional formula instead of raw value. `summarizeWellnessLogCreated` uses same formula.
**Files**: `functions/src/memberActivitySummaries.ts`
**Risk**: Changes all future leaderboard increments; historical scores remain uncorrected until backfill.

### Phase P4F: Daily Duplicate Prevention
**Goal**: Cloud Function rejects duplicate activity logs (same user/challenge/activity/day) at write time.
**Files**: `functions/src/memberActivitySummaries.ts`, possibly Firestore rules
**Note**: The existing 7-day timestamp rejection is already in place.

### Phase P4G: Sessions Model for Multi-Activity Challenges
**Goal**: Change `activitiesCompleted` semantics from "activity slots per session" to "sessions completed".
**Files**: `activityLogSessionService.ts`, Firestore rules (`isSafeChallengeProgressUpdate`)
**Risk**: High — breaks existing progress tracking for all challenges in flight. Requires coordination with Firestore rules change.

### Phase P4H: Leaderboard Backfill
**Goal**: Recalculate `challengeLeaderboards.score` for all existing activity logs using new scoring formula.
**Files**: New `scripts/backfillLeaderboardScores.ts` using the `rebuildUserMetricsForUser` pattern

### Phase P4I: UI Copy and Display Updates
**Goal**: Update "XP" labels to reflect actual score semantics. Add progress labels showing value vs. target.
**Files**: `ChallengeLeaderboardScreen.tsx`, `CollectiveChallengeScreen.tsx`, `WorkoutLoggedScreen.tsx`

### Phase P4J: Guard Tests
**New test script**: `scripts/testScoringGuards.ts`
- Points must not be hardcoded to 10 in LogWorkoutScreen or LogWellnessActivityScreen
- Service must read targetValue for proportional scoring
- Cloud Function score must not equal raw value for non-competitive challenges

---

## 7. Files Likely Needing Changes

| File | Phase | Change |
|------|-------|--------|
| `src/features/Workouts/LogWorkoutScreen.tsx` | P4C | Compute points from challenge config |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | P4C | Compute points from challenge config |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | P4C | Ensure pointsPerCompletion is always passed |
| `src/services/activityLogSessionService.ts` | P4D | Target-proportional points, per-session cap |
| `src/services/activityWriteGuards.ts` | P4D | Add target-aware score calculation helper |
| `functions/src/memberActivitySummaries.ts` | P4E, P4F | Score formula fix, duplicate prevention |
| `firestore.rules` | P4D, P4G | Update points increment cap, sessions model |
| `src/types/index.ts` | P4B | Add new fields to ChallengeMember, Workout, etc. |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | P4I | Update XP label, scoring semantics |
| `src/features/Challenges/CollectiveChallengeScreen.tsx` | P4I | Score display copy |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | P4I | Show actual points, not hardcoded 10 |
| New: `src/services/scoringConfig.ts` | P4B | Scoring constants and formulas |
| New: `scripts/backfillLeaderboardScores.ts` | P4H | Backfill script |
| New: `scripts/testScoringGuards.ts` | P4J | Guard tests for scoring |

---

## 8. Validation Commands (for future implementation phases)

```
npm run test:home-challenge-feeds
npm run test:home-performance-guards
npm run test:pilot-ux-polish-guards
npm run test:challenge-creation-backend
npm run test:group-invite-backend
npx tsc -b --pretty false
npm run build
```

New commands to add in P4J:
```
npm run test:scoring-guards
```

---

## 9. Current Validation (Audit Run)

```
npm run test:home-challenge-feeds       → home challenge feed guards passed
npm run test:home-performance-guards    → home performance guards passed
npm run test:pilot-ux-polish-guards     → pilot UX polish guards passed
npx tsc -b --pretty false               → (no errors)
npm run build                           → ✓ built in 3.42s
```

No code changes made. Audit only.

---

## Appendix: Points Flow Diagram

```
User logs activity
        │
        ▼
LogWorkoutScreen / LogWellnessActivityScreen / SelectChallengeActivityScreen
        │ entry.points = 10 (hardcoded) or pointsPerCompletion (config)
        ▼
activityLogSessionService.createActivitySession()
        │
        ├─── writes: workouts/{id} (no points field)
        │           or wellnessLogs/{id} (with points=10)
        │
        └─── writes: challengeMembers/{id} (totalPoints += 10 per entry)
                     ← NEVER READ by leaderboards or userMetrics

        │ (Firestore document create trigger)
        ▼
Cloud Functions: summarizeWorkoutCreated / summarizeWellnessLogCreated
        │
        ├─── workout: score = Math.round(value)   ← raw reps/mins
        │    wellness: score = points || value    ← usually 10 (fixed)
        │
        ├─── writes: challengeLeaderboards/{id} (score += X) ← LEADERBOARD
        ├─── writes: groupLeaderboards/{id}      (score += X)
        ├─── writes: groupMemberStats/{id}       (score += X)
        └─── writes: challengeActivitySummaries  (totalScore += X)

        │ (also triggers)
        ▼
rebuildUserMetricsForUser()
        │ (reads: workouts, wellnessLogs, challengeMembers, groupMembers)
        │ (does NOT use score or points — counts documents and timestamps)
        ▼
userMetrics / memberHome ← displayed on Home and Profile
```
