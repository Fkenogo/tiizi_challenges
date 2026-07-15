# Challenge Engine Specification
**Version:** 1.0  
**Date:** 2026-06-25  
**Status:** Specification — No code or Firestore changes made  
**Companion doc:** [challenge-data-model.md](./challenge-data-model.md)  
**Prerequisite reading:** [Phase 11 Audit](../reports/member-phase-11-challenge-type-architecture-audit.md)

---

## Executive Summary

The current platform stores three challenge types (`collective`, `competitive`, `streak`) but implements only one completion model: a frequency counter (`activitiesCompleted >= durationDays × activityCount`). This is a streak model applied universally. Competitive and Collective challenges behave identically to Streak challenges at the engine level.

This specification defines three independent **Challenge Engines** that replace the single shared completion path for `engineVersion: 'v2'` challenges while leaving all existing (`engineVersion: undefined`) challenges fully unchanged.

### Core architectural decision

The engine is selected at log-write time based on `challenge.engineVersion` and `challenge.challengeType`:

```
if challenge.engineVersion !== 'v2'  → LegacyEngine  (current behavior, no changes)
else if challengeType === 'streak'   → StreakEngine
else if challengeType === 'competitive' → CompetitiveEngine
else if challengeType === 'collective'  → CollectiveEngine
```

No other code path changes. The three engines are drop-in replacements for the `post-log membership update` section of `workoutService.createWorkout` and `wellnessLogService.writeLog`.

---

## Recommended Implementation Order

| Priority | Task | Rationale |
|---|---|---|
| 1 | **Streak Engine v2** | Lowest risk; schema change (lastLogDate, currentStreak) is purely additive; no group coordination needed; unit-testable in isolation |
| 2 | **Competitive Engine v2** | Medium risk; requires `cumulativeLoggedValue` accumulation; leaderboard semantics change from points to raw value |
| 3 | **Collective Engine v2** | Highest risk; requires atomic group-pool update in the same batch as individual log writes; race condition mitigation needed |
| 4 | **UI updates (all types)** | After engine services are stable; detail screen, logged screen, completed screen, leaderboard screen all need type-aware branches |
| 5 | **Creation wizard v2** | Gate `engineVersion: 'v2'` on new type-specific fields being filled; no behavioral change for existing creation flow |
| 6 | **Template audit** | Review existing templates for `targetValue` semantic correctness under new `targetType` naming |

---

## Shared Engine Interface

All three engines implement the same contract. The caller (`workoutService`, `wellnessLogService`) invokes the engine and applies the returned batch update.

```typescript
// src/services/challengeEngine/types.ts  (NEW FILE — not yet created)

export type EngineVersion = 'v1' | 'v2';

export interface ChallengeContext {
  challengeId: string;
  challengeType: 'streak' | 'competitive' | 'collective';
  engineVersion: EngineVersion;
  targetType: 'daily' | 'cumulative' | 'group-pool';
  durationDays: number;
  activities: ActivityConfig[];
  groupCumulativeTarget?: number;     // Collective only
  requiredConsecutiveDays?: number;   // Streak only
  streakResetOnMiss?: boolean;        // Streak only
  startDate: string;                  // YYYY-MM-DD
  endDate: string;                    // YYYY-MM-DD
}

export interface MembershipSnapshot {
  userId: string;
  challengeId: string;
  status: 'active' | 'completed' | 'abandoned';
  activitiesCompleted: number;
  totalActivities: number;
  completionRate: number;
  totalPoints: number;
  // v2 fields (may be undefined for v1 memberships)
  cumulativeLoggedValue?: number;
  lastLogDate?: string;
  currentStreak?: number;
  longestStreak?: number;
  engineVersion?: 'v2';
}

export interface LogEvent {
  userId: string;
  challengeId: string;
  activityId: string;
  value: number;
  unit: string;
  date: string;            // YYYY-MM-DD — the calendar day the activity occurred
  loggedAt: Date;
  pointsEarned: number;   // pre-computed by computeActivityScore before engine call
}

export interface EngineResult {
  /**
   * Fields to merge into challengeMembers/{challengeId}_{userId} via batch.set/update.
   * The caller applies this; the engine does not write to Firestore.
   */
  membershipUpdate: Partial<MembershipSnapshot> & {
    activitiesCompleted: number;  // always updated (log count, all types)
    totalPoints: number;          // always updated (running sum, all types)
    lastActivityAt: Date;
  };

  /**
   * Fields to merge into challenges/{challengeId} via batch.update.
   * Only populated by CollectiveEngine (group pool update).
   * undefined = no challenge document update needed.
   */
  challengeUpdate?: {
    groupCurrentTotal: number;
  };

  /**
   * Whether to trigger the completion side-effect on the membership.
   * When true: caller sets status = 'completed', completedAt = now.
   */
  isCompleted: boolean;

  /**
   * Human-readable reason for completion, for logging/analytics.
   */
  completionReason?: string;
}

export interface ChallengeEngine {
  /**
   * Compute the membership update for a single log event.
   * Pure function — no Firestore reads or writes.
   */
  computeUpdate(
    context: ChallengeContext,
    membership: MembershipSnapshot,
    logEvent: LogEvent,
    challengeSnapshot?: { groupCurrentTotal?: number },  // CollectiveEngine needs this
  ): EngineResult;
}
```

The engine is **pure**: it receives current state and a log event, returns what to write. All Firestore I/O remains in the service layer.

---

## Engine 1 — Streak Engine

### Purpose

Rewards sustained daily habits. A user succeeds by logging every day for the required number of days. Missing a day breaks the streak (when `streakResetOnMiss = true`) or simply fails to advance it.

### User Experience

- The progress UI shows "Day N streak" or a calendar grid with filled/empty days.
- The goal is explicit: "Log every day for 30 days."
- A user who logs 30 times in a single day earns 0 streak credit after day 1.
- Points are earned per session (proportional to daily target), but completion is driven by streak count.

### Target Semantics

`targetType = 'daily'`

`activities[].targetValue` is interpreted as the **per-session daily target**. A user who hits it earns 100 points for that session. `deriveDailyTargetValue` is not needed for v2 Streak — `targetValue` is already the daily target.

> **Legacy note:** v1 Streak used `deriveDailyTargetValue` which divided `targetValue` by `durationDays` as a heuristic to guess the daily target from a cumulative one. v2 Streak removes this ambiguity by requiring creators to enter the daily target directly.

### Logging Behavior

1. Receive `logEvent.date` (YYYY-MM-DD, the calendar day the activity occurred).
2. Compare `logEvent.date` to `membership.lastLogDate`.
   - Same day → update points and value, but **do not advance streak** (already counted for today).
   - Next calendar day → advance streak: `currentStreak++`, `lastLogDate = logEvent.date`.
   - Gap of 2+ days and `streakResetOnMiss = true` → reset: `currentStreak = 1`, `lastLogDate = logEvent.date`.
   - Gap of 2+ days and `streakResetOnMiss = false` → advance: `currentStreak++`, `lastLogDate = logEvent.date`.
3. Update `longestStreak = max(longestStreak, currentStreak)`.
4. Increment `activitiesCompleted` by 1 (for analytics/compatibility).
5. Add `pointsEarned` to `totalPoints`.

### Completion Rules

```
isCompleted =
  currentStreak >= requiredConsecutiveDays
  AND currentStreak >= 1
```

When `requiredConsecutiveDays` is undefined (legacy): falls back to v1 (`activitiesCompleted >= totalActivities`).

The completion check fires after each log event. A streak challenge can complete before `endDate` if the user hits the required streak count.

### Points Model

Identical to v1: `pointsEarned = round(min(value / targetValue, 1) × 100)` per session, using `scoringConfig.computeActivityScore`.

Points are decorative for streak completion purposes — they do not drive completion — but they populate `totalPoints` for leaderboard display.

### Leaderboard Model

Primary sort: `currentStreak` descending.  
Tiebreaker: `totalPoints` descending.  
Display: "N-day streak" alongside user name.

### Challenge End Conditions

| Condition | Result |
|---|---|
| `currentStreak >= requiredConsecutiveDays` | Member status → completed |
| `now > endDate` | Challenge expires; remaining active memberships → expired |
| Admin marks challenge closed | All active memberships → abandoned or expired |

### Edge Cases

| Scenario | Behavior |
|---|---|
| User logs twice in one day | Second log: points earned, activitiesCompleted++, streak NOT advanced, lastLogDate unchanged |
| User logs a past date (backfill) | Accepted if `logEvent.date <= today`; streak only advances if date is the next calendar day after lastLogDate |
| User starts mid-challenge | currentStreak starts at 0; they can still complete if they log every day from join date for requiredConsecutiveDays |
| requiredConsecutiveDays > durationDays | Impossible to complete; validation should reject this configuration at creation |
| streakResetOnMiss = false | Streak is cumulative-days count, not consecutive — simpler but less "streak-like" |

### Required Firestore Fields

**On `challenges` document:**
- `engineVersion: 'v2'`
- `targetType: 'daily'`
- `requiredConsecutiveDays: number` (required for v2 Streak)
- `streakResetOnMiss: boolean` (default: `true`)

**On `challengeMembers` document:**
- `currentStreak: number` (default: 0)
- `lastLogDate: string | null` (YYYY-MM-DD)
- `longestStreak: number` (default: 0)
- `engineVersion: 'v2'`

### Service Responsibilities

`StreakEngine.computeUpdate(context, membership, logEvent)`:
1. Determine whether to advance, reset, or hold streak based on `logEvent.date` vs `lastLogDate`.
2. Return `membershipUpdate` with new streak fields, updated `totalPoints`, incremented `activitiesCompleted`.
3. Set `isCompleted = true` if streak threshold is reached.
4. Never write to Firestore directly.

### UI Responsibilities

- **ChallengeDetailScreen:** Show streak calendar (filled dots for logged days, empty circles for future days, broken indicator for gaps).
- **ChallengeDetailScreen:** Progress bar = `currentStreak / requiredConsecutiveDays × 100`.
- **WorkoutLoggedScreen:** "Day N of your streak!" — show `currentStreak` post-log.
- **ChallengeCompletedScreen:** `completionPct = longestStreak / requiredConsecutiveDays × 100`. Trophy if `currentStreak >= requiredConsecutiveDays`.
- **ChallengeLeaderboardScreen:** Rank by `currentStreak`; show "N-day streak" label.

---

## Engine 2 — Competitive Engine

### Purpose

A personal race to accumulate a target volume (e.g., "log 1,200 pushups total"). The first member to reach the target wins, but all members continue until the challenge ends. Leaderboard ranks members by cumulative logged value.

### User Experience

- The progress UI shows "You've logged X of Y reps."
- Any combination of log sessions can reach the target — 12 sessions of 100 reps, 1 session of 1200 reps, or anything in between.
- There is no daily requirement. The user can log at any pace.
- Points are earned per session (proportional to daily target), which powers a secondary leaderboard.

### Target Semantics

`targetType = 'cumulative'`

`activities[].targetValue` is interpreted as the **personal cumulative target** — the total amount the user must log across all sessions over the challenge lifetime.

> **Example:** If `targetValue = 1200` and `unit = 'reps'`, the user must log a total of 1,200 reps (across any number of sessions) to complete the challenge.

### Logging Behavior

1. Add `logEvent.value` to `membership.cumulativeLoggedValue`.
2. Increment `activitiesCompleted` by 1.
3. Add `pointsEarned` to `totalPoints`.
4. Check completion: `cumulativeLoggedValue >= targetValue`.

For multi-activity challenges: `cumulativeLoggedValue` is summed across all activities (total volume across the challenge). If per-activity tracking is needed, use `activities[].activityCumulativeTarget` and maintain per-activity sub-totals (Phase 11A scope: single-activity Competitive is sufficient).

### Completion Rules

```
isCompleted = membership.cumulativeLoggedValue >= challenge.activities[0].targetValue
```

For multi-activity challenges (future scope):
```
isCompleted = all(
  activityCumulativeValue[a] >= activity.activityCumulativeTarget
  for each activity a
)
```

### Points Model

Points per session: `pointsEarned = round(min(value / targetValue, 1) × 100)` using `computeActivityScore`.

For Competitive, `targetValue` passed to `computeActivityScore` is NOT the cumulative target — it is a per-session reference target (the creator specifies this separately, or the system uses `targetValue / durationDays` as an estimate of daily pace).

**Design decision:** The session-scoring target and the cumulative completion target are the same field (`targetValue`) under the current schema. This creates an ambiguity:
- If `targetValue = 1200` and the user logs 1200 in one session: they score 100 pts and complete the challenge.
- If `targetValue = 1200` and the user logs 100 in one session: they score 8.3 pts.

For v2, the scoring target for per-session proportional points should be `targetValue / durationDays` (estimated daily pace). This matches the intent: scoring rewards "logging at a consistent daily pace" while completion rewards "reaching the total."

```typescript
// StreakEngine scoring target (per session):
const scoringTarget = context.activities[0].targetValue / context.durationDays;
const pointsEarned = computeActivityScore({ value: logEvent.value, targetValue: scoringTarget, ... });

// Completion target (cumulative):
const isCompleted = membership.cumulativeLoggedValue >= context.activities[0].targetValue;
```

### Leaderboard Model

Primary sort: `cumulativeLoggedValue` descending.  
Tiebreaker: `totalPoints` descending.  
Display: "X / Y reps" with a mini progress bar per entry.

> Note: This requires a new Firestore index on `(challengeId, cumulativeLoggedValue DESC)`.

### Challenge End Conditions

| Condition | Result |
|---|---|
| `cumulativeLoggedValue >= targetValue` | Member status → completed (individual) |
| `now > endDate` | Challenge expires; remaining active memberships → expired |

Each member completes individually when they reach the target. The challenge itself only expires by date or admin action.

### Edge Cases

| Scenario | Behavior |
|---|---|
| User logs more than the target in one session | Capped: `cumulativeLoggedValue = min(cumulativeLoggedValue + value, targetValue)` for display; raw value still stored in log doc |
| Multi-activity: user logs only one activity | Partial progress; completion requires all activities to reach their targets |
| Target is 0 (misconfigured) | Guard in service: throw before engine call (same as existing `totalActivities <= 0` guard) |
| Two users complete on the same log write | Both get status = 'completed'; no tiebreaker needed at engine level (leaderboard timestamps can be used for display) |
| User leaves and rejoins | `cumulativeLoggedValue` resets to 0 on rejoin (membership doc is recreated) |

### Required Firestore Fields

**On `challenges` document:**
- `engineVersion: 'v2'`
- `targetType: 'cumulative'`
- `activities[].targetValue` — the personal cumulative target (e.g., 1200 reps)

**On `challengeMembers` document:**
- `cumulativeLoggedValue: number` (default: 0)
- `engineVersion: 'v2'`

### Service Responsibilities

`CompetitiveEngine.computeUpdate(context, membership, logEvent)`:
1. Add `logEvent.value` to `membership.cumulativeLoggedValue`.
2. Compute `pointsEarned` using daily-pace scoring target (`targetValue / durationDays`).
3. Return `membershipUpdate` with updated `cumulativeLoggedValue`, `totalPoints`, `activitiesCompleted`.
4. Set `isCompleted = true` if `cumulativeLoggedValue >= targetValue`.
5. No `challengeUpdate` (Competitive is per-member, not group).

### UI Responsibilities

- **ChallengeDetailScreen:** Progress bar = `cumulativeLoggedValue / targetValue × 100`. Label: "X of Y reps."
- **WorkoutLoggedScreen:** "Total: X / Y reps logged."
- **ChallengeCompletedScreen:** `completionPct = cumulativeLoggedValue / targetValue × 100`.
- **ChallengeLeaderboardScreen:** Rank by `cumulativeLoggedValue`; show "X / Y reps" per entry.

---

## Engine 3 — Collective Engine

### Purpose

The group works together to accumulate a shared total (e.g., "Log 20,000 reps as a team"). Individual members contribute to a group pool. The challenge completes when the pool reaches the group target — or the challenge expires.

### User Experience

- Progress UI shows "Group: 14,200 / 20,000 reps — 71%."
- Every member can see the pool growing with each log.
- Individual members do not "complete" the challenge individually — the group completes it together.
- Points are still earned per session for personal leaderboard ranking.

### Target Semantics

`targetType = 'group-pool'`

`challenge.groupCumulativeTarget` is the shared target the group must collectively reach.  
`activities[].targetValue` is the **per-session reference target** for proportional scoring only (not for completion).

> **Example:** Group target = 20,000 reps. Alice logs 500, Bob logs 300, Carol logs 200. Group total = 1,000. Completion fires when group total reaches 20,000.

### Logging Behavior

1. Add `logEvent.value` to `challenge.groupCurrentTotal` (batch-atomic with membership write).
2. Increment `membership.activitiesCompleted` by 1.
3. Compute `pointsEarned` using `logEvent.value / activities[0].targetValue` (per-session scoring).
4. Add `pointsEarned` to `membership.totalPoints`.
5. Check completion: `groupCurrentTotal >= groupCumulativeTarget`.

**Atomicity requirement:** The `groupCurrentTotal` update on the challenge document and the membership update must be in the same Firestore batch write. This is the same batch already used for `activitiesCompleted` and `totalPoints` updates — add `challenges/{challengeId}` to the batch.

### Completion Rules

```
isCompleted (challenge-level) = challenge.groupCurrentTotal >= challenge.groupCumulativeTarget
```

When the group completes:
- Challenge document `status` → `'completed'`.
- All `challengeMembers` where `status === 'active'` → `status = 'completed'`.

This is a multi-document write. The challenge service handles the cascade, not the engine. The engine returns `isCompleted = true` and the caller triggers the cascade.

### Points Model

Per-session proportional scoring identical to Streak:
```
pointsEarned = round(min(value / activities[0].targetValue, 1) × 100)
```

Points rank members individually within the Collective challenge (who contributed most effectively per session).

### Leaderboard Model

Two leaderboard views:

**Group progress (primary):**
- Single bar: `groupCurrentTotal / groupCumulativeTarget × 100`.
- Not a ranked list — this is a shared goal view.

**Individual contribution (secondary):**
- Ranked by `totalPoints` (same as current leaderboard).
- Shows each member's contribution in points.
- Label: "Top contributors."

### Challenge End Conditions

| Condition | Result |
|---|---|
| `groupCurrentTotal >= groupCumulativeTarget` | Challenge status → completed; all active memberships → completed |
| `now > endDate` | Challenge expires; all active memberships → expired |
| Admin closes | All active memberships → abandoned |

### Edge Cases

| Scenario | Behavior |
|---|---|
| Two users log simultaneously | Firestore batch writes are atomic per document, but `groupCurrentTotal` updates from two concurrent batches can interleave. Use `FieldValue.increment()` not read-then-write to prevent race conditions. |
| groupCumulativeTarget is 0 or undefined | Guard at engine entry: throw if `groupCumulativeTarget <= 0` for v2 Collective |
| Challenge completes mid-session (group hits target while a user is mid-log) | The triggering log write sets `groupCurrentTotal` over the target; the batch also sets challenge `status = 'completed'`. Subsequent log attempts are blocked by the service-layer check `challenge.status !== 'active'`. |
| Group target is unrealistically large | No platform guard; challenge will expire without completing. Admin should set a realistic target during creation. |
| Member joins after group has already accumulated significant total | New member starts with 0 contribution. Group total is unchanged. New member's logs add to the existing group total. |

### Required Firestore Fields

**On `challenges` document:**
- `engineVersion: 'v2'`
- `targetType: 'group-pool'`
- `groupCumulativeTarget: number` (required for v2 Collective)
- `groupCurrentTotal: number` (default: 0; updated atomically)
- `autoCompleteOnGroupTarget: boolean` (default: `true`)

**On `challengeMembers` document:**
- `engineVersion: 'v2'`
- No new fields required beyond the shared `engineVersion` tag.

### Service Responsibilities

`CollectiveEngine.computeUpdate(context, membership, logEvent, challengeSnapshot)`:
1. Compute new `groupCurrentTotal = challengeSnapshot.groupCurrentTotal + logEvent.value`.
2. Compute `pointsEarned` using per-session scoring (`value / activities[0].targetValue`).
3. Return:
   - `membershipUpdate` with `activitiesCompleted++`, `totalPoints += points`, `lastActivityAt`.
   - `challengeUpdate = { groupCurrentTotal: newTotal }`.
   - `isCompleted = newTotal >= context.groupCumulativeTarget`.
4. When `isCompleted = true`: caller triggers cascade (challenge status + all memberships).

**Caller responsibility (workoutService / wellnessLogService):**
- Add `challenges/{challengeId}` update to the existing batch (FieldValue.increment for `groupCurrentTotal`).
- When `isCompleted = true`: run a secondary batch to update all active `challengeMembers` to `status = 'completed'`.
- The secondary batch must be guarded by a transaction or the cascade must be idempotent (check `status !== 'completed'` before writing).

### UI Responsibilities

- **ChallengeDetailScreen:** Large group progress bar. "The group has logged X of Y reps."
- **ChallengeDetailScreen:** Individual stats row shows MY LOGS (personal count) + GROUP TOTAL + PARTICIPANTS.
- **WorkoutLoggedScreen:** "You contributed X reps. Group total: Y / Z."
- **ChallengeCompletedScreen:** "Your group did it!" — show group total vs target.
- **ChallengeLeaderboardScreen:** Group progress bar at top; individual contributor ranking below.

---

## Sequence Diagrams

### Sequence A — Streak Engine (v2) Log Write

```
User                  LogWorkoutScreen     workoutService        StreakEngine       Firestore
 │                         │                    │                    │                 │
 │── taps Log ────────────>│                    │                    │                 │
 │                         │── createWorkout() >│                    │                 │
 │                         │                    │── get challenge ──>│                 │
 │                         │                    │<─ context ─────────│                 │
 │                         │                    │── get membership ──────────────────>│
 │                         │                    │<── snapshot ───────────────────────│
 │                         │                    │                    │                 │
 │                         │                    │── engineVersion === 'v2'?            │
 │                         │                    │── challengeType === 'streak'?        │
 │                         │                    │                    │                 │
 │                         │                    │── computeUpdate(context,            │
 │                         │                    │    membership, logEvent) ──────────>│
 │                         │                    │                    │                 │
 │                         │                    │            compare logEvent.date    │
 │                         │                    │            to lastLogDate           │
 │                         │                    │            advance or reset streak  │
 │                         │                    │            check completion         │
 │                         │                    │                    │                 │
 │                         │                    │<── EngineResult ───│                 │
 │                         │                    │   membershipUpdate │                 │
 │                         │                    │   isCompleted      │                 │
 │                         │                    │                    │                 │
 │                         │                    │── batch.set(workouts/{id}) ────────>│
 │                         │                    │── batch.update(challengeMembers) ──>│
 │                         │                    │   [if isCompleted: status=completed] │
 │                         │                    │── batch.commit() ──────────────────>│
 │                         │                    │<── success ────────────────────────│
 │                         │<── navigate to     │                    │                 │
 │                              WorkoutLogged   │                    │                 │
```

### Sequence B — Competitive Engine (v2) Log Write

```
User                  workoutService           CompetitiveEngine       Firestore
 │                         │                         │                     │
 │── createWorkout() ─────>│                         │                     │
 │                         │── get challenge ────────────────────────────>│
 │                         │── get membership ───────────────────────────>│
 │                         │                         │                     │
 │                         │── computeUpdate() ─────>│                     │
 │                         │                         │ add value to        │
 │                         │                         │ cumulativeLoggedValue│
 │                         │                         │ compute points      │
 │                         │                         │ check: cumulative   │
 │                         │                         │ >= targetValue?     │
 │                         │<── EngineResult ─────────│                     │
 │                         │                         │                     │
 │                         │── batch: workouts, challengeMembers ─────────>│
 │                         │   [cumulativeLoggedValue updated]             │
 │                         │   [if isCompleted: status=completed]          │
 │                         │── batch.commit() ───────────────────────────>│
```

### Sequence C — Collective Engine (v2) Log Write + Group Completion

```
User            workoutService          CollectiveEngine        Firestore
 │                   │                        │                     │
 │── createWorkout() >│                        │                     │
 │                   │── get challenge ──────────────────────────>│
 │                   │── get membership ─────────────────────────>│
 │                   │                        │                     │
 │                   │── computeUpdate(       │                     │
 │                   │    context,            │                     │
 │                   │    membership,         │                     │
 │                   │    logEvent,           │                     │
 │                   │    {groupCurrentTotal})>│                     │
 │                   │                        │ newTotal = current  │
 │                   │                        │   + logEvent.value  │
 │                   │                        │ compute points      │
 │                   │                        │ isCompleted =       │
 │                   │                        │  newTotal >=        │
 │                   │                        │  groupTarget        │
 │                   │<── EngineResult ────────│                     │
 │                   │   challengeUpdate:      │                     │
 │                   │     groupCurrentTotal   │                     │
 │                   │   isCompleted: true     │                     │
 │                   │                        │                     │
 │                   │── batch: workouts ─────────────────────────>│
 │                   │── batch: challengeMembers ──────────────────>│
 │                   │── batch: challenges/{id} ───────────────────>│
 │                   │   [groupCurrentTotal: FieldValue.increment(v)]│
 │                   │── batch.commit() ──────────────────────────>│
 │                   │                        │                     │
 │                   │ [isCompleted === true]  │                     │
 │                   │── batch2: challenge status → completed ─────>│
 │                   │── batch2: all active memberships → completed >│
 │                   │── batch2.commit() ─────────────────────────>│
```

### Sequence D — Completion Check (all engines)

```
EngineResult.isCompleted === true
       │
       ▼
membershipUpdate.status = 'completed'
membershipUpdate.completedAt = Timestamp.now()
       │
       ▼
[CollectiveEngine only]
  challengeService.markChallengeCompleted(challengeId)
    → challenges/{id}.status = 'completed'
    → challengeMembers where challengeId=X and status=active → status='completed'
       │
       ▼
[All engines]
  navigate to ChallengeCompletedScreen
  push notification: "🎉 You completed [challenge name]!"
```

---

## API / Service Boundaries

### Files to create (new)

| File | Responsibility |
|---|---|
| `src/services/challengeEngine/types.ts` | `ChallengeEngine` interface, `EngineResult`, `LogEvent`, `ChallengeContext`, `MembershipSnapshot` types |
| `src/services/challengeEngine/streakEngine.ts` | `StreakEngine` implementation |
| `src/services/challengeEngine/competitiveEngine.ts` | `CompetitiveEngine` implementation |
| `src/services/challengeEngine/collectiveEngine.ts` | `CollectiveEngine` implementation |
| `src/services/challengeEngine/legacyEngine.ts` | `LegacyEngine` — wraps current v1 logic, no behavior change |
| `src/services/challengeEngine/index.ts` | `selectEngine(challenge): ChallengeEngine` — routes by type + version |

### Files to modify (minimal)

| File | Change |
|---|---|
| `src/services/workoutService.ts` | In `createWorkout`: replace inline completion block with `const result = selectEngine(challenge).computeUpdate(...)` + batch application |
| `src/services/wellnessLogService.ts` | Same as above |
| `src/services/challengeService.ts` | Add `markChallengeCompleted(challengeId)` — sets challenge status and cascades to memberships |

### Files NOT to modify

- `src/services/challengeCompletion.ts` — `computeRequiredLogs` and `deriveDailyTargetValue` remain for v1 (LegacyEngine uses them)
- `src/services/scoringConfig.ts` — `computeActivityScore` unchanged
- `firestore.rules` — no new rule surfaces; existing rules cover new fields
- All UI components — not part of engine implementation (separate UI task)

---

## Test Strategy

### Unit tests — each engine in isolation

Each engine must be covered by pure unit tests (no Firestore emulator required):

```typescript
// Streak Engine unit tests
describe('StreakEngine', () => {
  it('advances streak on next calendar day', ...)
  it('does not advance streak on same day re-log', ...)
  it('resets streak on missed day when streakResetOnMiss = true', ...)
  it('does not reset streak when streakResetOnMiss = false', ...)
  it('sets isCompleted when currentStreak >= requiredConsecutiveDays', ...)
  it('updates longestStreak when currentStreak exceeds prior record', ...)
  it('awards correct points per session', ...)
})

// Competitive Engine unit tests
describe('CompetitiveEngine', () => {
  it('accumulates cumulativeLoggedValue across logs', ...)
  it('sets isCompleted when cumulative >= target', ...)
  it('uses daily-pace as scoring target', ...)
  it('does not set challengeUpdate (group update not needed)', ...)
})

// Collective Engine unit tests
describe('CollectiveEngine', () => {
  it('increments groupCurrentTotal by logged value', ...)
  it('sets isCompleted when groupCurrentTotal >= groupCumulativeTarget', ...)
  it('sets challengeUpdate with new groupCurrentTotal', ...)
  it('does not mark individual membership status (caller does cascade)', ...)
})
```

### Integration tests — service layer with Firestore emulator

```typescript
// workoutService integration tests
describe('workoutService.createWorkout (v2 engines)', () => {
  it('routes to StreakEngine for streak v2 challenge', ...)
  it('routes to CompetitiveEngine for competitive v2 challenge', ...)
  it('routes to CollectiveEngine for collective v2 challenge', ...)
  it('routes to LegacyEngine for undefined engineVersion', ...)
  it('applies batch atomically (all fields updated or none)', ...)
  it('cascades to challenge status on Collective completion', ...)
})
```

### Backward compatibility tests

```typescript
describe('v1 legacy challenges (engineVersion undefined)', () => {
  it('behaves identically to pre-v2 code for streak challenges', ...)
  it('behaves identically to pre-v2 code for competitive challenges', ...)
  it('behaves identically to pre-v2 code for collective challenges', ...)
})
```

### Existing test scripts

The existing `npm run test:scoring-guards` and `npm run test:home-challenge-feeds` scripts must continue to pass without modification after engine implementation. They validate v1 behavior and must not break.

---

## Risks and Mitigation

### Risk 1 — Collective race condition on `groupCurrentTotal`

**Risk:** Two users log simultaneously. Both read `groupCurrentTotal = 14,000`. Both add their values. One writes `14,500`, the other writes `14,800`. The first write is lost.

**Mitigation:** Use `FieldValue.increment(logEvent.value)` instead of `set({ groupCurrentTotal: newTotal })`. Firestore processes `increment` atomically. The engine's `challengeUpdate` should carry the delta, not the absolute value:

```typescript
// CollectiveEngine returns:
challengeUpdate: {
  groupCurrentTotalDelta: logEvent.value,  // NOT the new total
}

// Service applies:
batch.update(challengeRef, {
  groupCurrentTotal: FieldValue.increment(result.challengeUpdate.groupCurrentTotalDelta)
})
```

The engine's `isCompleted` check uses the estimated new total (snapshot + delta); the actual completion check is re-evaluated in the batch commit via a Firestore transaction if atomicity is critical.

**Residual risk:** The `isCompleted` flag in `EngineResult` may be wrong by up to the value of concurrent logs. For most challenges, overshooting by a small margin is acceptable (the group "wins" slightly early). For exact-boundary challenges, wrap the batch in a Firestore transaction.

### Risk 2 — Cascade write on Collective completion

**Risk:** Marking all active memberships as completed requires a read + batch write. If there are hundreds of members, this exceeds Firestore's 500-write-per-batch limit.

**Mitigation:** Use Cloud Functions trigger: when `challenges/{id}.status` changes to `'completed'`, a Firestore trigger updates all `challengeMembers`. The log write that triggers completion only needs to update its own membership — the cascade is async via the trigger.

**Alternative (no Cloud Functions):** Batch in chunks of 400. Accept eventual consistency on the cascade (some members show 'active' for a few seconds after group completion).

### Risk 3 — Streak date timezone mismatch

**Risk:** A user in UTC+3 logs at 11pm local time. The server records UTC date as the previous day. Their streak breaks.

**Mitigation:** `logEvent.date` must be the **user's local calendar date** (YYYY-MM-DD in their timezone), not the UTC timestamp. The client should send the local date explicitly alongside the log event. Do not derive the date from `loggedAt` Timestamp on the server.

### Risk 4 — LegacyEngine drift

**Risk:** A change to the engine routing logic accidentally affects v1 challenges.

**Mitigation:** `LegacyEngine` is a wrapper that calls the existing `workoutService` inline functions directly. It cannot drift because it calls the same code — it just moves it behind the interface. The existing test suite validates v1 behavior independently.

### Risk 5 — Creation wizard allows impossible configurations

**Risk:** Creator sets `requiredConsecutiveDays = 60` for a 30-day Streak challenge. No user can complete it.

**Mitigation:** Validation at creation time:
- Streak: `requiredConsecutiveDays <= durationDays`
- Competitive: `targetValue > 0`
- Collective: `groupCumulativeTarget > 0`

These are client-side guards + Firestore rules denying writes where the invariant is violated.

### Risk 6 — Points model divergence between engines

**Risk:** The CompetitiveEngine uses `targetValue / durationDays` as the scoring target, but v1 challenges use `targetValue` directly. Mixed leaderboards (group challenges with v1 and v2 members) will show incomparable points.

**Mitigation:** Points are decorative within Competitive (completion is by cumulative value). Document that `totalPoints` across v1 and v2 members in the same group leaderboard is approximate and not directly comparable. Add a `scoringVersion` field to `challengeMembers` to distinguish (already partially done via `scoringVersion: 'v2'` in `workouts` documents).

---

## Backward Compatibility Strategy

### Invariant

Any `challenges` document where `engineVersion` is `undefined` or missing uses `LegacyEngine`. All v1 behavior is preserved exactly. No existing data requires migration.

### Engine selection (pseudocode)

```typescript
function selectEngine(challenge: Challenge): ChallengeEngine {
  if (challenge.engineVersion !== 'v2') {
    return new LegacyEngine();
  }
  switch (challenge.challengeType) {
    case 'streak':       return new StreakEngine();
    case 'competitive':  return new CompetitiveEngine();
    case 'collective':   return new CollectiveEngine();
    default:             return new LegacyEngine();
  }
}
```

### Feature flag (optional)

During rollout, `engineVersion: 'v2'` can be treated as a feature flag. Only challenges explicitly created with the new wizard (which sets `engineVersion: 'v2'`) enter the new engines. Existing active challenges are never auto-upgraded.

---

## Appendix — Open Questions

These decisions are deferred to implementation:

| Question | Options | Recommendation |
|---|---|---|
| Multi-activity Competitive (per-activity vs. total) | (A) Sum all activities into one `cumulativeLoggedValue`; (B) Track per-activity sub-totals | Start with (A). Simpler schema, covers 95% of use cases. |
| Collective cascade timing | (A) Synchronous batch (chunk by 400); (B) Cloud Function trigger (async) | (B) if Cloud Functions available; otherwise (A) with chunks. |
| Streak timezone handling | (A) Trust client-sent date; (B) Derive from Timestamp + user timezone | (A) simpler; document the contract. |
| Leaderboard for Collective | (A) Group progress bar only; (B) Group bar + individual contributor ranking | (B) — more engaging; aligns with current `totalPoints` leaderboard. |
| Points for Collective | (A) Keep proportional per session; (B) Replace with contribution % of group target | (A) — no schema change, compatible with group leaderboard. |
| `targetValue` semantic for Competitive scoring | (A) `targetValue / durationDays`; (B) Separate `scoringTargetValue` field | (A) simpler; document the derivation. |
