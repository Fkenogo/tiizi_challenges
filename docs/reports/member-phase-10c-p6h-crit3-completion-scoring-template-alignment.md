# CRIT-3 — Completion, Scoring, Template & Leaderboard Alignment

**Branch:** fix/p0-pre-deploy-blockers  
**Date:** 2026-06-24  
**Status:** PHASE 2 COMPLETE — Tier A + Tier B implemented. All 6 validation checks pass.

---

## Phase 1 — Implementation Plan

### 1.1 Scope Classification

The 8 requested areas split into three risk tiers. These tiers drive implementation order.

| Tier | Area | Schema change? | Migration? | Risk |
|------|------|----------------|-----------|------|
| **A** | Bug fixes (Task 4D) | No | No | Low |
| **A** | Leaderboard → totalPoints | No | No | Low |
| **A** | canSummarizeActivity status check | No | No | Low |
| **A** | Frequency options (add 2x-week, 5x-week) | No | No | Low |
| **A** | Remove pointsPerCompletion from templates/creation | No | No | Low |
| **B** | Points formula simplification | No | No | Medium |
| **C** | Value-based progress model | **Yes** | **Yes** | High |
| **C** | Daily log guard (same-day deduplication) | No | No | Medium |
| **C** | Value-based completion trigger | Depends on C-progress | Depends | High |

**Phase 2 implements Tier A + Tier B only.** Tier C is planned here but requires a separate approval step after Phase 2 ships.

---

### 1.2 Current Affected Files

#### Core logic (write-path)
| File | What changes |
|------|-------------|
| `src/services/scoringConfig.ts` | Remove overperformance (collective 1.5× → 1.0×); remove `basePoints` normalization from completion formula; simplify all types to same proportional_capped formula |
| `src/services/challengeCompletion.ts` | Add `computeTotalTarget(durationDays, activityCount, dailyTargetValue)` |
| `src/services/workoutService.ts` | Use new scoring formula; add same-day duplicate guard |
| `src/services/wellnessLogService.ts` | Use new scoring formula; add same-day duplicate guard |
| `src/services/activityLogSessionService.ts` | Use new scoring formula; add same-day duplicate guard |
| `src/services/challengeService.ts` | `joinChallenge` sets `cumulativeLoggedValue: 0` on new membership (Tier C) |
| `functions/src/challengeCreationBackend.ts` | Fix `totalActivities: 0` → `computeRequiredLogs(durationDays, activityCount)` |
| `functions/src/memberUserMetrics.ts` | Fix progress denominator (`totalActivities` not `primaryActivity.targetValue`) |
| `functions/src/memberActivitySummaries.ts` | Add `challengeMember.status !== 'completed'` guard in `canSummarizeActivity` |

#### UI (display/read-path)
| File | What changes |
|------|-------------|
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Rank by `totalPoints` from `challengeMembers`, not raw `workout.value` |
| `src/services/groupInsightsService.ts` | `getGroupLeaderboard()` → query `challengeMembers` per group, sum `totalPoints` |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Remove Points input; add 2x-week/5x-week frequency options |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Remove Points input; add 2x-week/5x-week frequency options |
| `functions/src/challengeCreationBackend.ts` | Add `2x-week`, `5x-week` to `VALID_FREQUENCIES` |

#### Templates / types
| File | What changes |
|------|-------------|
| `src/services/challengeTemplateService.ts` | Remove `pointsPerCompletion` from activity shape |
| `src/services/wellnessTemplateService.ts` | Remove `pointsPerCompletion` from template shape |
| `src/types/index.ts` | Add `cumulativeLoggedValue?: number` to `ChallengeMember` (Tier C) |

---

### 1.3 Exact Model Changes

#### A1 — Bug: `challengeCreationBackend.ts` creator auto-join totalActivities

**Current:**
```ts
totalActivities: 0,
```

**Fix:** The challenge payload is already built and available in the transaction.  
The `challengePayload.activities` array and `durationDays` are both in scope.

```ts
const activityCount = Math.max(1, (challengePayload.activities as unknown[])?.length ?? 1);
const durationDays = Math.max(1, Number(challengePayload.durationDays ?? 1));
// …
totalActivities: activityCount * durationDays,
```

No import of `computeRequiredLogs` needed — the Cloud Function cannot import from client src. Inline the formula.

#### A2 — Bug: `memberUserMetrics.ts` progress denominator

**Current:**
```ts
const progressValue = Math.max(0, numberValue(membership, 'activitiesCompleted'));
const progress = targetValue > 0
  ? Math.min(100, Math.round((progressValue / targetValue) * 100))   // ← uses activity targetValue
  : completionRate;
```

**Fix:**
```ts
const progressValue = Math.max(0, numberValue(membership, 'activitiesCompleted'));
const memberTotalActivities = Math.max(1, numberValue(membership, 'totalActivities'));
const progress = memberTotalActivities > 0
  ? Math.min(100, Math.round((progressValue / memberTotalActivities) * 100))
  : completionRate;
```

#### A3 — Bug: `canSummarizeActivity` no status check

**Current:** checks `challengeMemberSnap.exists` but not `status`.

**Fix:** add one condition:

```ts
return groupMemberSnap.exists
  && challengeMemberSnap.exists
  && isActiveStatus(groupMember?.status)
  && isActiveStatus(challengeMember?.status)   // ← add this line
  && String(challengeMember?.groupId ...)
```

#### A4 — Leaderboard: use `totalPoints` not raw `workout.value`

**ChallengeLeaderboardScreen.tsx** currently:
```ts
const byUser = new Map<string, number>();
workouts.forEach((w) => byUser.set(w.userId, (byUser.get(w.userId) || 0) + Math.max(1, Math.round(w.value))));
```

**Fix:** Stop using workouts hook for leaderboard ranking. Query `challengeMembers` for this challenge and sort by `totalPoints`.

```ts
const { data: memberships = [] } = useChallengeMemberships(challengeId);
const ranking = useMemo(() => {
  return [...memberships]
    .sort((a, b) => (b.totalPoints ?? 0) - (a.totalPoints ?? 0))
    .slice(0, 20)
    .map((m, idx) => ({
      rank: idx + 1,
      name: namesById.get(m.userId) ?? `Member ${m.userId.slice(0, 6)}`,
      score: m.totalPoints ?? 0,
      me: m.userId === user?.uid,
    }));
}, [memberships, members, user?.uid]);
```

A `useChallengeMemberships(challengeId)` hook already exists or can be added trivially.

**GroupLeaderboardScreen / groupInsightsService.getGroupLeaderboard()** — same change: query `challengeMembers where groupId == groupId`, sum `totalPoints` per user.

```ts
// Current: queries workouts, sums workout.value
// Fix: queries challengeMembers, sums totalPoints
const membersSnap = await getDocs(
  query(collection(db, 'challengeMembers'), where('groupId', '==', groupId))
);
const scores = new Map<string, number>();
membersSnap.docs.forEach((doc) => {
  const m = doc.data();
  scores.set(m.userId, (scores.get(m.userId) ?? 0) + Math.max(0, Number(m.totalPoints ?? 0)));
});
```

#### A5 — Frequency options: add 2x-week, 5x-week

Three places:
- `VALID_FREQUENCIES` set in `challengeCreationBackend.ts`: add `'2x-week'`, `'5x-week'`
- `ActivityRow` type in `CreateChallengeWizard.tsx` and `CreateChallengeScreen.tsx`: add to union
- Frequency `<select>` in both wizard/admin screens: add `<option>` tags

**Format note:** Current code uses `3x-week` (hyphen, not slash). Keeping the same format: `2x-week`, `5x-week`.

#### A6 — Remove pointsPerCompletion from creation screens

Already partially done (Tasks 4A/4B). Confirm it is absent from:
- `CreateChallengeWizard.tsx` activity payload
- `CreateChallengeScreen.tsx` activity payload
- `challengeCreationBackend.ts` `normalizeActivities()` — `pointsPerCompletion` is still accepted there (pass-through for backwards compat) but should not be promoted in UI

**Plan:** Keep `pointsPerCompletion` in the backend normalization for backwards compat with existing challenge documents that have it. Remove from all creation UIs. This is already done per prior tasks — verify only.

---

#### B1 — Points formula simplification

**Current formula per challenge type:**
```
collective: proportional  — ratio × basePoints, cap at 1.5×, floor at 5% effort
streak:     proportional_capped — ratio × basePoints, cap at 1×
competitive: competitive_value — (value / 3×target) × basePoints
wellness binary: proportional_capped
wellness other: proportional
basePoints = Math.round(100 / totalActivities)
```

**Requested formula (all types):**
```
pointsEarned = round(min(value / dailyTargetValue, 1) × 100)
```

**Proposed implementation:**

1. `SCORING_CONSTANTS.BASE_POINTS_PER_TARGET` stays `100` — it is now the per-log maximum, not the per-challenge maximum.

2. `computeActivityScore()` no longer accepts `basePoints` from the caller — it always uses `100`. Remove `basePoints` from `ScoringInput`. (This is a breaking interface change but safe because callers are internal.)

3. Scoring logic collapses to one path for all types:
   ```ts
   const ratio = targetValue > 0 ? value / targetValue : (value > 0 ? 1 : 0);
   const pointsEarned = Math.round(Math.min(ratio, 1) * 100);
   ```

4. For **competitive** challenges: keep `competitive_value` scoring method label (for legibility) but use the same `min(ratio, 1) × 100` formula. The 3× cap on raw value is removed — the point formula is now target-relative for all types.

5. Collective overperformance (1.5× cap): **removed**. No bonus for MVP. `MAX_OVERPERFORMANCE_MULTIPLIER` stays in constants but is unused (guard test verifies it's set to `1.0` or removed).

6. The `5% effort floor` (`MIN_EFFORT_RATIO = 0.05`) stays — prevents gaming via 1-rep logs.

7. `normalizedBase` computation (`Math.round(100 / totalActivities)`) in all three services is **removed**. `basePoints` parameter to `computeActivityScore()` is **removed**.

**Impact on existing test guards:**

Existing `testScoringGuards.ts` tests assert specific point values based on `BASE_POINTS_PER_TARGET`. With the formula simplified, the tests become simpler:
```ts
// 10 reps vs 50 target = 20 pts
assert.equal(computeActivityScore({value:10, targetValue:50, challengeType:'collective'}).pointsEarned, 20);
// 50 reps vs 50 target = 100 pts
assert.equal(computeActivityScore({value:50, targetValue:50, challengeType:'collective'}).pointsEarned, 100);
// 75 reps vs 50 target = 100 pts (capped, no overperformance)
assert.equal(computeActivityScore({value:75, targetValue:50, challengeType:'collective'}).pointsEarned, 100);
```

**Open question flagged:** The existing guard file asserts `overperformance at 1.5×` behavior. These tests must be updated to reflect the new cap-at-1× behavior. If any external system depends on collective challenges earning > 100 pts per log, that breaks. Confirm no external system relies on the 1.5× bonus.

**Implication for totalPoints accumulation:**
- Old model: perfect 42-log challenge → ≈100 `totalPoints` total
- New model: perfect 42-log challenge → 4200 `totalPoints` total (100 per log)
- Existing memberships have stale `totalPoints` under the old model. New logs append correctly under the new model, but `totalPoints` for existing users will be a mix of old (<100/log) and new (100/log) values.
- **No migration is required for correctness** — leaderboard ranking by `totalPoints` still ranks correctly (monotonic increase). The absolute numbers just differ between old and new users. Cosmetically impure but not broken.

---

#### C — Value-based progress + daily log guard (TIER C — plan only, not implemented in Phase 2)

**This tier requires a separate approval step.**

##### C1 — New field: `cumulativeLoggedValue`

Add to `challengeMembers` documents at log-write time:
```
cumulativeLoggedValue: increment(min(value, dailyTargetValue))
```

Why `min(value, dailyTargetValue)` not `value`: prevents front-loading. Even if a user logs 200 reps against a 50-rep target, only 50 is counted toward cumulative progress for that log event.

Additionally, add `totalTarget` at join time:
```ts
totalTarget: durationDays × dailyTargetValue × activityCount
```

For multi-activity challenges, `totalTarget` = sum of (`durationDays × targetValue`) across all activities.

`completionRate` is then:
```ts
completionRate = Math.min(100, Math.round((cumulativeLoggedValue / totalTarget) * 100))
```

##### C2 — Daily log guard (same-day deduplication)

**Approach: pre-write Firestore query**

Before incrementing `cumulativeLoggedValue`, query:
```ts
const sameDay = await getDocs(query(
  collection(db, logCollection),
  where('challengeId', '==', challengeId),
  where('userId', '==', userId),
  where('activityId', '==', activityId),
  where('date', '==', todayIsoDate()),
  limit(1),
));
if (!sameDay.empty) {
  throw new Error('You have already logged this activity today. Come back tomorrow.');
}
```

**Cost:** +1 Firestore read per log event. Acceptable for correctness.

**Requires a composite Firestore index:** `challengeId + userId + activityId + date`. This index does not currently exist — it must be added to `firestore.indexes.json` and deployed.

**Behavior change for users:** Existing behavior allows multiple logs per day per activity. This guard blocks it. Users on ongoing challenges may notice this change on their next log attempt. Risk: frustration for users who were intentionally logging multiple times daily as a workaround.

**Alternative (softer):** Allow multiple logs per day but only count the **highest value** per day for progress purposes (soft cap rather than hard block). More complex to implement but less disruptive to users.

##### C3 — Completion trigger change

Currently: `completionRate >= 100` (log count based)  
After Tier C: `completionRate >= 100` (value based — same trigger, different definition of completionRate)

No code change needed to the completion conditional — only `completionRate` computation changes.

##### C4 — Firestore schema migration

For existing `challengeMembers` documents:
- Add `cumulativeLoggedValue: 0` (or backfill from actual logs)
- Add `totalTarget: durationDays × primaryActivity.targetValue × activityCount`
- Recompute `completionRate` from new formula

**This is a production write requiring separate approval.** The repair script from Task 4C can be extended to cover this.

---

### 1.4 Firestore Fields Affected

| Field | Collection | Current | After Tier A+B | After Tier C |
|-------|-----------|---------|----------------|-------------|
| `totalActivities` | `challengeMembers` | log count (durationDays × activityCount) | unchanged | unchanged |
| `activitiesCompleted` | `challengeMembers` | log event count | unchanged | unchanged (kept for backwards compat) |
| `completionRate` | `challengeMembers` | `activitiesCompleted / totalActivities × 100` | unchanged | `cumulativeLoggedValue / totalTarget × 100` |
| `totalPoints` | `challengeMembers` | sum of scoring.pointsEarned (basePoints-normalized) | sum of `min(v/t,1)×100` per log | unchanged |
| `cumulativeLoggedValue` | `challengeMembers` | **does not exist** | does not exist | `sum of min(value, dailyTarget) per log` |
| `totalTarget` | `challengeMembers` | **does not exist** | does not exist | `durationDays × sum(targetValue) × activityCount` |
| `pointsPerCompletion` | `challenges.activities[]` | exists in some documents | no longer written by new code | no longer written |
| `frequency` | `challenges.activities[]` | `daily\|weekly\|3x-week\|custom` | adds `2x-week\|5x-week` | unchanged |
| `totalActivities` | `challengeMembers` (creator auto-join) | `0` (bug) | `durationDays × activityCount` (fixed) | unchanged |

---

### 1.5 Migration / Backfill Required

| Change | Migration needed? | When |
|--------|-------------------|------|
| A1–A6 (bug fixes + leaderboard + frequency) | No | Phase 2 |
| B1 (points formula) | No (cosmetically impure mixed totals, not broken) | Phase 2 |
| C1–C3 (value-based progress) | **Yes** — add `cumulativeLoggedValue`, `totalTarget` to existing docs | Tier C, separate approval |
| C4 (completion trigger) | No code change; driven by C1–C3 | Tier C |
| Task 4C repair (7 Category A memberships) | **Yes** — separate approval already flagged | Pending |

---

### 1.6 Deploy Steps Required

| Change | Deploy required |
|--------|----------------|
| Client-side changes (src/) | Vite build → hosting deploy |
| `functions/src/challengeCreationBackend.ts` | **Functions deploy** |
| `functions/src/memberUserMetrics.ts` | **Functions deploy** |
| `functions/src/memberActivitySummaries.ts` | **Functions deploy** |
| Firestore rules | **Rules deploy** (no rule changes in Tier A+B) |
| Firestore indexes (Tier C daily guard) | **Index deploy** (new composite index) |

---

### 1.7 Risk Areas

#### High risk — do not implement in Phase 2
- **Tier C (value-based progress + daily log guard):** Changing `completionRate` semantics while existing memberships have stale data is a data integrity issue. Requires migration + user communication plan.
- **Daily log guard hard block:** Breaking multi-log-per-day behavior mid-challenge will confuse active users. The softer "highest value per day" approach is safer.

#### Medium risk — implement carefully in Phase 2
- **Points formula change:** `totalPoints` on existing memberships becomes a mixed-model sum (old normalized + new unnormalized values). Not broken for ranking (monotonic) but cosmetically inconsistent. Accept for MVP.
- **Leaderboard to totalPoints:** The group leaderboard currently queries `workouts`. After the change it queries `challengeMembers`. Performance characteristics differ (challengeMembers is smaller than workouts). Safe.
- **Existing guard tests:** `testScoringGuards.ts` has ~40 assertions that will need updating because the scoring formula changes. These must all be updated atomically in Phase 2.

#### Low risk — safe in Phase 2
- All Tier A changes (bug fixes, frequency options)
- `canSummarizeActivity` status check (additive guard, no behavioral change for valid requests)
- Frequency option expansion (additive, no existing data affected)

---

### 1.8 Open Questions for Confirmation

1. **Competitive challenges:** The requested formula `round(min(value/dailyTarget, 1) × 100)` applies the same cap to competitive challenges as streak/collective. Competitive challenges have historically allowed higher scores for higher raw values (3× cap, `competitive_value` scoring). Confirm: competitive challenges should also be capped at 100 pts per log, no raw-value bonus?

2. **Collective overperformance removal:** Currently collective challenges reward over-delivery up to 150% of `basePoints`. Removing this means logging 100 reps against a 50-rep collective target earns the same as logging exactly 50. Confirm: no overperformance for MVP.

3. **Frequency slug format:** Current code uses `3x-week` (hyphen, no slash). Requested format is `3x/week` (slash). Using hyphens throughout for consistency (`2x-week`, `5x-week`). Confirm this is acceptable.

4. **Leaderboard for multi-challenge groups:** `getGroupLeaderboard` currently aggregates raw workout values across all workouts in a group, not challenge-specific. After the change it aggregates `totalPoints` across all `challengeMembers` in a group. This is a richer signal. Confirm this is the intent, not per-challenge leaderboards.

5. **Tier C timing:** Implement Tier C (value-based progress) in a future separate PR after Tier A+B ships, or include in Phase 2 of this task? Recommendation: separate PR, since it requires production data migration approval.

---

### 1.9 Phase 2 Implementation Order

Assuming approval of the above plan, Phase 2 will implement in this order:

1. `functions/src/challengeCreationBackend.ts` — fix A1 (`totalActivities: 0`)
2. `functions/src/memberUserMetrics.ts` — fix A2 (wrong denominator)
3. `functions/src/memberActivitySummaries.ts` — fix A3 (status check)
4. `src/services/scoringConfig.ts` — B1 (simplified formula; remove basePoints normalization; remove 1.5× cap; remove competitive_value divergence)
5. `functions/src/scoringConfig.ts` — B1 mirror (functions has its own copy)
6. `src/services/challengeCompletion.ts` — add `computeTotalTarget()`
7. `src/services/workoutService.ts` — use new scoring; remove `normalizedBase`
8. `src/services/wellnessLogService.ts` — same
9. `src/services/activityLogSessionService.ts` — same
10. `src/services/groupInsightsService.ts` — A4 (leaderboard fix)
11. `src/features/Challenges/ChallengeLeaderboardScreen.tsx` — A4
12. `src/features/Challenges/CreateChallengeWizard.tsx` — A5/A6 (frequency + pointsPerCompletion)
13. `src/features/Admin/Challenges/CreateChallengeScreen.tsx` — A5/A6
14. `functions/src/challengeCreationBackend.ts` — A5 (VALID_FREQUENCIES)
15. `scripts/testScoringGuards.ts` — Phase 3 guard updates
16. Phase 4 validation runs

---

**STOP — Phase 1 complete. Awaiting approval to proceed to Phase 2.**

---

## Phase 2 — Implementation (Tier A + Tier B)

**Date:** 2026-06-24  
**Status:** COMPLETE — all 6 validation checks pass.

### 2.1 Files Changed

| File | Change |
|------|--------|
| `functions/src/challengeCreationBackend.ts` | Fix `totalActivities: 0` → `activities.length × durationDays`; extract `durationDays` to outer scope; add `durationDays` to challenge payload; add `'2x-week'`, `'5x-week'` to `VALID_FREQUENCIES` |
| `functions/src/memberUserMetrics.ts` | Fix progress denominator: `membership.totalActivities` replaces `primaryActivity.targetValue`; progressLabel now shows sessions count |
| `functions/src/memberActivitySummaries.ts` | Add `isActiveStatus(challengeMember?.status)` guard in `canSummarizeActivity` — completed members can no longer post activity summaries |
| `src/services/scoringConfig.ts` | Replace 3 per-type scorers + dispatcher with single `computeActivityScore` unified formula: `round(min(value/target, 1) × 100)`. Remove `MAX_OVERPERFORMANCE_MULTIPLIER`, `COMPETITIVE_VALUE_CAP_RATIO`, `STREAK_BONUS_PER_WEEK`, `BINARY_WELLNESS_TYPES`, `wellnessScoringModeFor`, `basePoints` param. Update `ScoringMethod` union — `proportional_capped` is now the only live value. |
| `functions/src/scoringConfig.ts` | Mirror all client changes exactly |
| `src/services/workoutService.ts` | Remove `normalizedBase` / `basePoints` from `computeActivityScore` call |
| `src/services/wellnessLogService.ts` | Same |
| `src/services/activityLogSessionService.ts` | Same; clean up stale JSDoc comments referencing `basePoints` |
| `src/services/groupInsightsService.ts` | `getGroupLeaderboard()` now queries `challengeMembers` and sums `totalPoints` instead of querying `workouts` and summing raw `value` |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Inline `useChallengeLeaderboard` hook queries `challengeMembers` and ranks by `totalPoints`; remove `useChallengeWorkouts` dependency |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Add `'2x-week'`, `'5x-week'` to `ActivityRow['frequency']` type and dropdown |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Same |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Add `'2x-week'` → `2×/week`, `'5x-week'` → `5×/week` to frequency label map |
| `src/services/challengeService.ts` | Update `CreateChallengeInput` activity `frequency` union |
| `src/services/challengeTemplateService.ts` | Update `frequency` union in template activity shape + cast |
| `src/services/adminChallengeService.ts` | Update `frequency` union |
| `src/hooks/useAdminChallenges.ts` | Update `frequency` union |
| `src/types/index.ts` | Update both `frequency` unions to include `'2x-week'` and `'5x-week'` |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Remove `activityType` from `computeActivityScore` call (field removed from `ScoringInput`) |
| `firestore.rules` | Fix `configuredChallengeActivityCountFrom` to use ternary instead of invalid `if` reassignment for `effectiveDays` |
| `scripts/testScoringGuards.ts` | Rewrite sections 1-8 and update sections 15, 22-24 for unified formula; remove per-type scorer imports; invert normalizedBase guards to `doesNotMatch` |

### 2.2 Key Formula Changes

#### Before (three divergent paths)
- Collective: `round(min(value/target, 1.5) × basePoints)` where `basePoints = round(100/totalActivities)`
- Competitive: `round((cappedValue / (target×3)) × basePoints)` — up to 3× raw value cap
- Streak: `round(min(value/target, 1) × basePoints)` — already proportional_capped

#### After (unified formula)
```ts
pointsEarned = Math.round(Math.min(value / dailyTargetValue, 1) * 100)
```
- Applies to ALL challenge types
- Max 100 pts per log regardless of overperformance
- 5% effort floor still enforced (below-minimum earns 0)
- No `basePoints` parameter — base is always 100

### 2.3 Validation Results

| Command | Result |
|---------|--------|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ built in 9.16s |
| `npm run test:home-challenge-feeds` | ✅ all guards passed |
| `npm run test:scoring-guards` | ✅ scoring guards passed |
| `cd functions && npm run build` | ✅ 0 errors |
| `firebase deploy --only firestore:rules --dry-run --project tiizi-challenges` | ✅ compiled successfully |

### 2.4 Deferred (Tier C — separate approval required)

- `cumulativeLoggedValue` field on `challengeMembers`
- Value-based progress model (% toward cumulative target, not log count)
- Value-based completion trigger
- Same-day log deduplication guard

---

<!-- Phase 2–5 content will be filled in after approval -->
