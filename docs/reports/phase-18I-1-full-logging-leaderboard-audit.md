# Phase 18I-1 — Full Challenge Logging + Leaderboard Audit

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Audit only — no code changes in this phase.

---

## 1. Executive Summary

A full audit of challenge logging, leaderboard display, and Firestore security rules was completed across both v1 and v2 engine paths. Two confirmed bugs and one design concern were identified. The logging pipeline is largely sound after phases 18G-2D and 18G-2E; however, `wellnessLogService` still lacks a `removeUndefinedDeep` call, causing potential Firestore write failures for optional fields. The `ChallengeDetailScreen` mini-leaderboard always displays `totalPoints` regardless of challenge type after correct sorting. The group leaderboard is operating on a pre-v2 model.

| ID | Severity | Status | Description |
|----|----------|--------|-------------|
| BUG-I-1 | High | Confirmed | Mini-leaderboard score always shows `totalPoints` (not engine-appropriate metric) |
| BUG-I-2 | High | Confirmed | `wellnessLogService` missing `removeUndefinedDeep` → undefined Firestore writes |
| CONCERN-I-3 | Medium | Design concern | Group leaderboard uses pre-v2 totalPoints-sum model; not engine-sensitive |

---

## 2. Files Audited

| File | Purpose |
|------|---------|
| `src/services/workoutService.ts` | Fitness/workout logging |
| `src/services/wellnessLogService.ts` | Wellness activity logging (fasting, hydration, sleep, meditation) |
| `src/services/challengeService.ts` | Challenge join/leave, membership management |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Challenge detail + mini-leaderboard |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Full leaderboard screen |
| `src/utils/leaderboardSort.ts` | Canonical sorting utility |
| `src/services/groupInsightsService.ts` | Group-level leaderboard data |
| `src/features/Groups/GroupLeaderboardScreen.tsx` | Group leaderboard UI |
| `firestore.rules` | Firestore security rules |
| `scripts/testScoringGuards.ts` | Static regression guards |

---

## 3. Logging Flow Findings

### 3A. `workoutService.ts` — PASS

- `removeUndefinedDeep(payload)` applied at line 204 before `batch.set()` ✅
- Group membership validation added in Phase 18G-2D ✅
- `targetType` derived from `activityConfig?.targetType ?? 'daily'` ✅
- `leaveChallenge` guard added in Phase 18G-2E (`activitiesCompleted > 0` blocks leave) ✅

### 3B. `wellnessLogService.ts` — BUG-I-2 CONFIRMED

**Location:** `src/services/wellnessLogService.ts`, lines 183–218

**Root cause:** `batch.set(logRef, logPayload)` is called without sanitizing `undefined` values from the payload. Firestore rejects `undefined` field values with: `WriteBatch.set() called with invalid data. Unsupported field value: undefined`.

**Affected fields:**

| Line | Field | How undefined enters |
|------|-------|----------------------|
| 192 | `notes` | `input.notes?.trim() \|\| undefined` |
| 251 | `metadata.moodBefore` | Spread of optional input |
| 251 | `metadata.moodAfter` | Spread of optional input |
| 262 | `metadata.startTime` | Spread of optional input |
| 262 | `metadata.endTime` | Spread of optional input |
| 271 | `metadata.intakeMl` | Spread of optional input |
| 280 | `metadata.bedtime` | Spread of optional input |
| 280 | `metadata.wakeTime` | Spread of optional input |
| 280 | `metadata.quality` | Spread of optional input |

**Contrast:** `workoutService.ts` is protected; `wellnessLogService.ts` is not.

**Fix plan (Phase 18I-2A):** Add `removeUndefinedDeep` import and apply it to `logPayload` before `batch.set(logRef, logPayload)`. The utility already exists in the codebase.

### 3C. `challengeService.ts` — PASS

- `leaveChallenge` guard: members with `activitiesCompleted > 0` cannot leave ✅
- Group membership validation via `groupMembers` collection present in wellnessLogService ✅

---

## 4. Leaderboard Findings

### 4A. `ChallengeLeaderboardScreen.tsx` — PASS

- Queries `challengeMembers WHERE challengeId == challengeId` (correct scope) ✅
- Uses `sortLeaderboardRows(rawRows, engineVersion, challengeType)` ✅
- Engine-sensitive rendering: `renderRowScore`, `renderMyStatCard`, `podiumScore` all branch on `challengeType` ✅
- Ranking label copy matches engine: "total contribution" (collective), "completion %" (competitive), "current streak" (streak) ✅

### 4B. `leaderboardSort.ts` — PASS

Correct engine-aware sort logic:
- Collective → `cumulativeLoggedValue DESC`
- Competitive → `completionRate DESC → totalPoints DESC`
- Streak → `currentStreak DESC → longestStreak DESC → totalPoints DESC`
- Default → `totalPoints DESC`

### 4C. `ChallengeDetailScreen.tsx` mini-leaderboard — BUG-I-1 CONFIRMED

**Location:** `src/features/Challenges/ChallengeDetailScreen.tsx`, line 116

```ts
const sorted = sortLeaderboardRows(rows, resolvedChallenge!.engineVersion, resolvedChallenge!.challengeType);
return sorted
  .slice(0, 5)
  .map((entry, index) => ({ rank: index + 1, userId: entry.userId, score: entry.totalPoints }));
```

**Problem:** The sort order is correctly engine-sensitive (via `sortLeaderboardRows`), but the `score` field in the mapped result is always `entry.totalPoints`. The rendered JSX (line 656) then displays `{entry.score} pts` for all challenge types.

**Impact by challenge type:**

| Type | Expected score display | Actual display |
|------|----------------------|----------------|
| Competitive | completion % | pts |
| Collective | cumulative logged value | pts |
| Streak | current streak count | pts |
| Legacy | pts | pts ✅ |

**Fix plan (Phase 18I-2B):** Map `score` to the engine-appropriate field:
- `streak` → `entry.currentStreak`
- `collective` → `entry.cumulativeLoggedValue`
- `competitive` → `entry.completionRate`
- default → `entry.totalPoints`

Also update the label `"pts"` to reflect the display unit (streak: "day streak", collective: raw number, competitive: "%").

### 4D. `GroupLeaderboardScreen.tsx` / `groupInsightsService.ts` — CONCERN-I-3

**Location:** `src/services/groupInsightsService.ts`, lines 200–223

```ts
async getGroupLeaderboard(groupId: string) {
  // queries challengeMembers WHERE groupId == groupId
  // sums totalPoints across ALL challenges for a user
  // sorts by totalPoints DESC
}
```

**Concern:** This is a pre-v2-engine model. It sums `totalPoints` across all of a user's challenges in the group regardless of challenge type. For a group containing collective or streak challenges, this model does not reflect meaningful progress metrics — a user who led a streak challenge is ranked by accumulated points, not streak performance.

**Scope of concern:** The group leaderboard is a global/lifetime points view, which may be an intentional product decision (all-time group standing). If that's the intent, the model is acceptable but should be clearly labeled ("All-time group points"). If the intent is to show engine-specific group performance, it needs redesign.

**Fix recommendation (Phase 18I-2D):** Add a comment or UI label making the "total group points" nature explicit. Defer engine-sensitive group leaderboard to a future phase unless product decides otherwise.

---

## 5. Firestore Rules Findings

### 5A. `wellnessLogs` — PASS (after Phase 18G-2E fix)

```js
? request.resource.data.points >= 0
: request.resource.data.points >= 0
```

Both v1 and v2 branches now allow zero-point logs ✅ (previously `>= 1` was blocking legitimate zero-point logs).

### 5B. `challengeMembers` write rules — PASS

Field-scoped `affectedKeys().hasOnly([...])` gates are in place for client-writable fields. `participantCount` is owned exclusively by Cloud Function triggers.

### 5C. `groupMembers` read — PASS

Used in `workoutService` and `wellnessLogService` to validate group membership before writing logs. Read access confirmed in rules.

---

## 6. Manual Test Matrix (Simulated)

| Scenario | Expected | Audit Result |
|----------|----------|-------------|
| Log workout for fitness challenge (competitive) | `workoutService` writes, group membership validated | ✅ PASS |
| Log wellness for streak challenge | `wellnessLogService` writes — **undefined metadata fields may cause error** | ⚠️ BUG-I-2 |
| Log meditation with moodBefore/After provided | `metadata.moodBefore` written correctly if defined | ✅ PASS (if provided) |
| Log meditation with no mood fields | `metadata.moodBefore: undefined` → Firestore error | ❌ BUG-I-2 |
| View challenge detail mini-leaderboard (streak) | Should show streak count as score | ❌ BUG-I-1 (shows pts) |
| View full leaderboard (streak) | Shows current streak, sorted correctly | ✅ PASS |
| Leave challenge after logging | Blocked with user-facing error | ✅ PASS |
| Leave challenge before logging | Succeeds | ✅ PASS |

---

## 7. Regression Risk Assessment

| Risk | Mitigated? |
|------|-----------|
| `workoutService` undefined write | ✅ `removeUndefinedDeep` present |
| `wellnessLogService` undefined write | ❌ Missing — BUG-I-2 |
| Mini-leaderboard incorrect score display | ❌ Always totalPoints — BUG-I-1 |
| `leaveChallenge` after logging | ✅ Service-level guard present |
| Points rule blocking zero-point logs | ✅ Fixed in Phase 18G-2E |
| Group membership not validated in workoutService | ✅ Fixed in Phase 18G-2D |

---

## 8. Recommended Fix Plan

### Phase 18I-2A — wellnessLogService undefined fix (BUG-I-2)
Apply `removeUndefinedDeep` to `logPayload` before `batch.set(logRef, logPayload)` in `wellnessLogService.writeLog`. Also filter metadata objects in `logFasting`, `logHydration`, `logSleep`, `logMeditation` — or apply `removeUndefinedDeep` at the top-level payload that includes them.

### Phase 18I-2B — mini-leaderboard engine-appropriate score (BUG-I-1)
In `ChallengeDetailScreen` mini-leaderboard map, derive `score` and `scoreLabel` from `challengeType`:
- `streak` → `currentStreak`, label "day streak"
- `collective` → `cumulativeLoggedValue`, label unit from activity
- `competitive` → `completionRate`, label "%"
- default → `totalPoints`, label "pts"

### Phase 18I-2D — Group leaderboard label clarity (CONCERN-I-3)
Add "All-time group points" label to `GroupLeaderboardScreen` to clarify this is a global points view, not an engine-specific leaderboard. Defer full engine-sensitive group leaderboard to a later phase.

---

## 9. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 3.77s
npm run test:scoring-guards               → ✅ All guards passed
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

No code was changed in this phase.
