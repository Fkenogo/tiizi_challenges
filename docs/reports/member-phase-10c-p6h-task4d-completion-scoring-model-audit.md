# Task 4D — Completion & Scoring Model Audit

**Branch:** fix/p0-pre-deploy-blockers  
**Date:** 2026-06-24  
**Mode:** Read-only — zero writes, zero code changes  
**Sources audited:**  
`src/services/challengeCompletion.ts`, `src/services/scoringConfig.ts`,  
`src/services/workoutService.ts`, `src/services/wellnessLogService.ts`,  
`src/services/activityLogSessionService.ts`, `src/services/challengeService.ts`,  
`functions/src/challengeCreationBackend.ts`, `functions/src/memberActivitySummaries.ts`,  
`functions/src/memberUserMetrics.ts`, `src/features/Challenges/ChallengeLeaderboardScreen.tsx`,  
`src/types/index.ts`, `firestore.rules`

---

## 1. What `completionRate` Represents

`completionRate` is a **derived, denormalized display integer** stored on the `challengeMembers` document, range 0–100. It is computed and written by the client services on every log event:

```ts
completionRate = Math.min(100, Math.round((activitiesCompleted / totalActivities) * 100))
```

It serves two purposes simultaneously:
- **Display:** shown to users as a progress percentage
- **Completion trigger:** `completionRate >= 100` is the condition that sets `status = 'completed'`

Neither purpose requires storing it — both can be derived from `activitiesCompleted` and `totalActivities`. It is stored because Firestore cannot evaluate arithmetic expressions in security rules, and because UI components read it directly without recomputing.

**Key constraint:** `completionRate` has no independent meaning. If `totalActivities` changes (as the Task 4C repair will do), `completionRate` must also be rewritten to remain consistent. They are a pair.

---

## 2. What `activitiesCompleted` Represents

`activitiesCompleted` is a **log-event counter** — the total number of individual activity writes committed by this user against this challenge. It is incremented per commit, capped at `totalActivities`:

```ts
activitiesCompleted = Math.min(current + 1, totalActivities)          // workoutService, wellnessLogService
activitiesCompleted = Math.min(current + entries.length, totalActivities)  // activityLogSessionService
```

**Important:** It counts log **events**, not days, not unique activities, not unique activity types. If a user logs 3 separate activities in one day across `activityLogSessionService`, `activitiesCompleted` increments by 3. If they log the same activity type twice on different days via `workoutService`, it increments by 2.

**It is not a measure of quality**, effort, or target achievement. A log of 1 rep against a 50-rep target increments `activitiesCompleted` by 1 identically to a log of 50 reps. The quality distinction lives in the scoring path (`pointsEarned`, `metTarget`), not in the completion counter.

---

## 3. What `totalActivities` Represents

`totalActivities` is the **required log-event count** for the challenge to be considered complete. It is set at join time:

```ts
totalActivities = computeRequiredLogs(challenge.durationDays, Math.max(1, challenge.activities?.length ?? 1))
               = durationDays × activityCount
```

For a 21-day challenge with 2 activity types, `totalActivities = 42` — the member must submit 42 log events to complete the challenge.

**What it is not:**
- Not a cumulative target value (e.g., not "log 1050 total reps")
- Not a daily quota (e.g., not "log at least 2 activities per day")
- Not a distinct-day count (e.g., not "log on 21 different days")

It is simply the raw count of log writes needed. Whether those writes are evenly spread across days, front-loaded, or bunched is not enforced by any current code.

**Pre–Task 4B:** `totalActivities` was set to `activities.length` only (1 or 2 for most challenges). This caused premature completion after a single day's logs. Task 4B fixed this in client services. The Cloud Function `challengeCreationBackend.ts` still writes `totalActivities: 0` for the creator's auto-join (see §9).

---

## 4. What `activityScore` (`pointsEarned`) Represents

`pointsEarned` is the **points awarded for a single log event**. It is computed by `computeActivityScore()` in `src/services/scoringConfig.ts` and stored on the log document (`workouts`, `wellnessLogs`).

It is **not** stored on `challengeMembers` directly — only `totalPoints` (the running sum) is stored there. The per-log score is only accessible by reading the log document.

`pointsEarned` measures how close the logged value came to the activity's effective target, scaled by `basePoints`:

```
pointsEarned ∝ min(value / effectiveTargetValue, cap) × basePoints
```

Where `basePoints = Math.round(100 / totalActivities)` — this normalizes so that a member who hits every target exactly earns exactly 100 total points over the full challenge lifetime.

`pointsEarned` is **independent of challenge completion**. A member can earn 0 points on a log event (value < 5% of target) and still have `activitiesCompleted` increment by 1. Conversely, a member can earn partial points without meeting the target. The completion counter and the scoring system are deliberately decoupled.

---

## 5. How Points Are Awarded

Points are computed per log event by `computeActivityScore(ScoringInput)` in `src/services/scoringConfig.ts`. The path taken depends on `challengeType` and `activityType`:

### Base normalization

```ts
basePoints = Math.round(100 / totalActivities)
```

This ensures that across `totalActivities` perfect logs, a member earns approximately 100 total points. For a 42-log challenge: `basePoints = Math.round(100/42) = 2` per log.

### Streak challenges — `proportional_capped`

Target: `effectiveTargetValue = deriveDailyTargetValue(rawTargetValue, durationDays, 'streak')`  
For streaks where `durationDays > 1` and `rawTarget / durationDays >= 1`: divides to get per-session daily target.

```ts
ratio = value / effectiveTargetValue
pointsEarned = Math.round(Math.min(ratio, 1.0) × basePoints)
```

- Hard cap at 1× (no overperformance bonus)
- `metTarget = value >= effectiveTargetValue`
- Below 0% floor: 0 pts (when `targetValue <= 0`, fixed award)

### Collective challenges — `proportional`

```ts
ratio = value / targetValue
pointsEarned = Math.round(Math.min(ratio, 1.5) × basePoints)
```

- Cap at 1.5× — overperformance is rewarded up to 150%
- Below 5% of target (`MIN_EFFORT_RATIO = 0.05`): 0 pts

### Competitive challenges — `competitive_value`

```ts
cap = targetValue × 3.0
pointsEarned = Math.round((Math.min(value, cap) / cap) × basePoints)
```

- Scores the raw logged value against a 3× ceiling
- Leaderboard displays raw sum of `workout.value` (not `pointsEarned`) — **see §9**

### Collective + wellness activity types — `proportional_capped`

When `challengeType === 'collective'` and `activityType` is `fasting`, `sleep`, `meditation`, or `mindfulness`:

```ts
// Same as streak: hard cap at 1×
pointsEarned = Math.round(Math.min(value / targetValue, 1.0) × basePoints)
```

All other collective wellness types (e.g., `hydration`) use `proportional` (1.5× cap).

### Zero target fallback — `fixed`

If `targetValue <= 0`: `pointsEarned = basePoints`, `scoringMethod = 'fixed'`.

### Stamp

All new logs written by Task 4B services carry `scoringVersion: 'v2'`. Legacy logs pre-Task 4B have no `scoringVersion` field or `scoringVersion: undefined`.

---

## 6. How Challenge Completion Is Determined

Challenge completion fires when:

```ts
if (completionRate >= 100) {        // i.e. activitiesCompleted >= totalActivities
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = Timestamp.now();
}
```

This is enforced identically across all three client log-writing paths:
- `workoutService.ts` (single workout log)
- `wellnessLogService.ts` (single wellness log)
- `activityLogSessionService.ts` (multi-activity session)

**Completion model: required log count.**

The challenge is complete when the member has submitted `durationDays × activityCount` log events. No date check, no minimum daily quota, no quality threshold. A member who logs all their sessions on day 1 of a 30-day challenge would be marked complete after `30 × activityCount` total logs — even though all were written on day 1.

**Guard against re-completion:**

An early throw at the top of each service prevents re-entry on already-completed memberships:

```ts
if (membership.status === 'completed') {
  throw new Error('Challenge already completed.');
}
```

**`completionRate` is the stored proxy for the arithmetic expression** — it is not an independent gate. The real invariant is `activitiesCompleted >= totalActivities`.

---

## 7. How Streak Challenges Differ

| Property | Streak | Collective | Competitive |
|----------|--------|------------|-------------|
| `targetValue` in Firestore | Often cumulative (e.g., 1050 reps over 21 days) | Per-session target | Per-session target |
| Effective target per log | `deriveDailyTargetValue()` divides if result ≥ 1 | `targetValue` as-is | `targetValue` as-is |
| Scoring method | `proportional_capped` — no overperformance | `proportional` — 1.5× cap | `competitive_value` — 3× ceiling |
| Overperformance bonus | None | Yes (up to 150%) | None (raw value ceiling) |
| Completion mechanism | Same as others: `activitiesCompleted >= totalActivities` | Same | Same |
| `totalActivities` | `durationDays × activityCount` | Same | Same |

**The key streak-specific fix (Task 4B / P6C):** Streak challenges stored `targetValue` as the full cumulative total (e.g., `1050` for "50 reps/day over 21 days"). Without `deriveDailyTargetValue`, a user logging 50 reps against a target of 1050 scored near-zero. After the fix, the daily target is derived as `1050 / 21 = 50`, and the user scores proportionally against that.

**`deriveDailyTargetValue` safety check:** If `rawTarget / durationDays < 1`, the original value is treated as the already-correct per-session target (e.g., `8 hours of sleep`, `1 social interaction`) and is not divided. This prevents under-scoring goals whose natural unit is already per-session.

---

## 8. What the Completion Model Is Based On

**Current model: required log count.**

`challenge.completionRate >= 100` ⟺ `activitiesCompleted >= durationDays × activityCount`

This is **not** based on:
- **Cumulative target achievement**: No check that total logged values sum to any threshold
- **Daily target achievement**: No enforcement that each day had a log, or that any log met its daily target
- **Date-based advancement**: No check of `endDate` at completion time; a challenge can be "completed" before its end date

**Implication:** Quality of effort is captured only in `pointsEarned`, not in completion eligibility. A member who logs 1 rep per session (earning 0 points each time due to `MIN_EFFORT_RATIO`) will still advance `activitiesCompleted` toward completion. The log-count gate and the scoring system are fully decoupled.

This is an intentional MVP design choice. A stricter model (e.g., "must log on each calendar day" or "cumulative value must reach the full target") would require date-tracking per log entry and is outside current scope.

---

## 9. Remaining Mixed-Concern Locations

These are places where activity completion and challenge completion concerns are interleaved or where the model is applied inconsistently:

### 9A. `functions/src/challengeCreationBackend.ts:338` — Creator auto-join writes `totalActivities: 0`

```ts
const challengeMemberPayload = {
  activitiesCompleted: 0,
  totalActivities: 0,   // ← BUG: should be computeRequiredLogs(durationDays, activityCount)
  completionRate: 0,
};
```

The Cloud Function path that auto-joins the challenge creator sets `totalActivities: 0`, not `durationDays × activityCount`. This is the exact inconsistency that produced 4 of the 7 Category A memberships (Task 4C confirmed `totalActivities: 0` for those records). Any creator-auto-joined membership created by this path has a broken completion counter until a repair is applied.

**Client `challengeService.joinChallenge()` is correct** — it uses `computeRequiredLogs()`. The Cloud Function does not import or call that function.

### 9B. `functions/src/memberUserMetrics.ts:160-161` — Progress re-derived with wrong denominator

```ts
const progressValue = Math.max(0, numberValue(membership, 'activitiesCompleted'));
const progress = targetValue > 0
  ? Math.min(100, Math.round((progressValue / targetValue) * 100))  // ← wrong denominator
  : completionRate;
```

`targetValue` here is `primaryActivity.targetValue` (the activity's value target, e.g., 50 reps) — **not** `totalActivities`. So `progress` in the user profile metrics is computed as `activitiesCompleted / 50`, not `activitiesCompleted / 42`. For a member who has completed 2 logs against a 42-log challenge with a 50-rep target, this function returns `progress = 4%` rather than the correct `5%`. The stored `completionRate` is used as a fallback only when `targetValue === 0`.

This affects the "profile summary" card shown in user metrics, not the authoritative `completionRate` stored on the membership document.

### 9C. `ChallengeLeaderboardScreen.tsx` — Leaderboard ranks by raw `workout.value`, not by `totalPoints`

```ts
workouts.forEach((w) => byUser.set(w.userId, (byUser.get(w.userId) || 0) + Math.max(1, Math.round(w.value))));
```

The leaderboard ignores `pointsEarned` entirely and sums raw logged values (e.g., raw rep counts). This means:
- Scoring method (proportional, capped, competitive) has zero effect on leaderboard rank
- `totalPoints` on `challengeMembers` is not used by the leaderboard
- A user who logs 1000 low-quality reps outranks a user who logs 50 perfect reps

This creates a semantic disconnect: the points system communicates "how well did you do", but the leaderboard communicates "how much raw volume did you produce". For competitive challenges these may align; for streak/wellness challenges they diverge significantly.

### 9D. `memberActivitySummaries.canSummarizeActivity()` — Does not check `challengeMember.status`

```ts
return groupMemberSnap.exists
  && challengeMemberSnap.exists
  && isActiveStatus(groupMember?.status)    // checks groupMember status
  // challengeMember.status is NOT checked — completed members pass this gate
  && String(challengeMember?.groupId ...)
  && String(challengeMember?.userId ...);
```

A `challengeMember` with `status = 'completed'` can still trigger activity summary writes. This is currently harmless (completed members cannot write new logs via the client early-throw guard), but the Cloud Function summarizer does not enforce this independently. If an admin-written log were ever committed for a completed member, the summarizer would process it silently.

### 9E. `activityLogSessionService.ts` — `activitiesCompleted` increments by `entries.length`

The session service increments `activitiesCompleted` by the number of activities in the session in one batch write. `workoutService` and `wellnessLogService` each increment by 1 per call. These are consistent with the model's definition ("one log event = one increment"), but a session with 2 activities in a single commit increments the same amount as two separate service calls. This is correct behavior — it's worth noting only because `activitiesCompleted` is the completion counter, and multi-activity sessions advance it faster per transaction.

### 9F. Term overloading: "activity" means three different things

| Usage | Meaning |
|-------|---------|
| `challenge.activities[]` | Activity type definitions on the challenge (e.g., "50 pushups/day") |
| `activitiesCompleted` | Count of log events submitted by the member |
| Session `entries[]` | Individual log rows in a multi-activity session batch |

This overloading creates reading ambiguity. `activitiesCompleted = 2` can mean "submitted 2 log events" or "completed 2 out of N activity types" depending on context. The field name implies the latter but the implementation tracks the former.

---

## 10. Recommended Production-Ready Model

### 10.1 Retain the required-log-count completion model

The `activitiesCompleted >= totalActivities` model is sound for MVP. It is simple, queryable, and does not require date-aware server-side logic. The fix in Task 4B makes `totalActivities` correct. **No change to the completion trigger is recommended at this time.**

### 10.2 Fix `challengeCreationBackend.ts` (Cloud Function path) — CRITICAL

The Cloud Function that auto-joins the challenge creator at creation time must be updated to write the correct `totalActivities`:

```ts
// Replace:
totalActivities: 0,

// With:
totalActivities: computeRequiredLogs(durationDays, Math.max(1, activities?.length ?? 1)),
```

This requires importing `computeRequiredLogs` from a shared module or inlining the formula. This is the root cause of the `totalActivities: 0` records found in 4 of 7 Category A memberships. Until this is fixed, every challenge created via the Cloud Function path produces a broken creator membership.

### 10.3 Fix `memberUserMetrics.ts` progress calculation

Replace the incorrect denominator:

```ts
// Current (wrong for multi-day challenges):
const progress = targetValue > 0
  ? Math.min(100, Math.round((progressValue / targetValue) * 100))
  : completionRate;

// Correct:
const totalActivities = computeRequiredLogs(challengeDoc.durationDays, activities.length);
const progress = totalActivities > 0
  ? Math.min(100, Math.round((progressValue / totalActivities) * 100))
  : completionRate;
```

### 10.4 Align leaderboard to use `totalPoints`

The leaderboard should rank by `totalPoints` from `challengeMembers`, not by raw `workout.value` sum. Raw value ranking is meaningful for competitive challenges but is misleading for streak/collective challenges where quality (meeting the daily target) matters more than raw volume.

For competitive challenges specifically, consider a separate "competitive ranking" mode that uses raw value — but this should be an explicit switch, not the default for all challenge types.

### 10.5 Rename `activitiesCompleted` → `logsSubmitted` (long-term)

The current name implies "completed N activities" (quality gate) when it means "submitted N log entries" (count gate). Renaming would eliminate the semantic ambiguity described in §9F. This is a migration-level change and should be deferred until a full schema migration is planned.

### 10.6 Store `totalActivities` as authoritative — never recompute on the fly for completion

`totalActivities` on the membership document is the single source of truth for completion thresholds. Do not recompute `durationDays × activityCount` at log-write time to re-derive this threshold — if the challenge definition changes after join (e.g., admin edits `durationDays`), the stored value governs. The stored value must be set correctly at join time (client and Cloud Function), and must be updated in repair operations as in Task 4C.

### 10.7 Make `completionRate` read-only after `status = 'completed'`

Currently, a completed membership can have `completionRate` corrected by a repair script (Task 4C). Once `status = 'completed'` is set, `completionRate` should be treated as frozen at 100. Only the Task 4C repair scenario (where completion was premature and status is being reverted) justifies writing a `completionRate < 100` to an existing document. This should be enforced at the service layer, not via a Firestore rule.

---

## Summary Table

| Concept | Current Implementation | Status |
|---------|----------------------|--------|
| Completion model | Required log count (`activitiesCompleted >= totalActivities`) | ✅ Correct after Task 4B |
| `totalActivities` at client join | `computeRequiredLogs(durationDays, activityCount)` | ✅ Fixed in Task 4B |
| `totalActivities` at Cloud Function auto-join | Hardcoded `0` | ❌ Bug — §9A |
| Streak target derivation | `deriveDailyTargetValue()` divides cumulative target | ✅ Fixed in Task 4B |
| `basePoints` normalization | `Math.round(100 / totalActivities)` | ✅ Correct |
| `completionRate` stored | Derived integer 0–100, pair to `totalActivities` | ✅ Correct (must be repaired for Category A) |
| Leaderboard ranking | Raw `workout.value` sum | ⚠ Disconnected from `pointsEarned` — §9C |
| User profile progress | `activitiesCompleted / primaryActivity.targetValue` | ❌ Wrong denominator — §9B |
| `canSummarizeActivity` | Does not check `challengeMember.status` | ⚠ Latent risk — §9D |
| `scoringVersion: 'v2'` stamp | Applied to all new logs | ✅ Fixed in Task 4B |
| Term "activity" overloading | Three distinct meanings in codebase | ⚠ Technical debt — §9F |
