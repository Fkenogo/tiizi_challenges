# Task 4C — Repair Payload Validation

**Branch:** fix/p0-pre-deploy-blockers  
**Date:** 2026-06-24  
**Mode:** DRY-RUN — zero writes performed  
**Script:** `scripts/validateRepairPayload.ts`

---

## 1. Finding: Simple Revert Is Insufficient

**7 of 7 Category A memberships** would be left in a broken state if the repair applies only:

```json
{ "status": "active", "completedAt": null }
```

Every membership currently has `completionRate = 100`. Reverting only `status` and `completedAt` leaves `completionRate = 100` intact. The result:

```
status          = 'active'
completionRate  = 100
```

This is the exact broken state the fix is meant to prevent. The completion guard in `workoutService.ts` and `wellnessLogService.ts` now uses the corrected `computeRequiredLogs(durationDays, activityCount)` for future logs — but the **stale `totalActivities` and `completionRate` fields already in Firestore are not touched by the algorithm fix**. Without correcting them, the next log written by any of these 7 users would:

1. Compute `activitiesCompleted = min(current + 1, totalActivities)` — but `totalActivities` is still the old stale value (1 or 2), so `activitiesCompleted` is capped at the stale max
2. Immediately re-trigger completion on the next log (`nextRate >= 100` stays true)

---

## 2. Root Cause of Stale Fields

The old algorithm set `totalActivities = activities.length` at join time (number of activity types, not days × activities). All 7 memberships joined and logged exactly `activities.length` sessions, driving `activitiesCompleted` to the stale cap and `completionRate` to 100%.

**Task 4B** fixed the algorithm for future joins and future logs — but existing documents in Firestore still carry the stale values.

---

## 3. Per-Membership Detail

All 7 memberships have `activitiesCompleted = totalActivitiesOld`. The correction is `totalActivitiesCorrect = durationDays × activityCount`.

### Challenge: Pushup mania2 (`1S7cXHuHkwAONHhtSgLD`) — endDate 2026-07-05

| Field | Before | After simple revert | After correct revert |
|-------|--------|---------------------|----------------------|
| status | completed | **active** | **active** |
| completedAt | Timestamp | null | null |
| totalActivities | 1 | 1 (unchanged) | **30** |
| activitiesCompleted | 1 | 1 (unchanged) | 1 (unchanged) |
| completionRate | 100% | 100% ⚠ | **3%** |

**Membership:** `1S7cXHuHkwAONHhtSgLD_sMfC7PsPp7cpGwnr3tGvsKSEOB32`  
durationDays=30, activityCount=1 → correctTotal=30

---

### Challenge: 30-Day Pushup Duel (`K4eBvaSLKe4yi1taOWCc`) — endDate 2026-07-05

| Membership doc | activitiesCompleted | totalActivitiesOld | totalActivitiesCorrect | completionRateOld | completionRateCorrect |
|----------------|--------------------|--------------------|----------------------|-------------------|-----------------------|
| `…_0gO19swm…` | 2 | 0 | 60 | 100% | 3% |
| `…_sMfC7PsP…` | 2 | 2 | 60 | 100% | 3% |

durationDays=30, activityCount=2 → correctTotal=60

**Before/After (user 0gO19swm…):**

```
BEFORE:
  status:               'completed'
  completedAt:          Timestamp(...)
  totalActivities:      0          ← stale/missing
  activitiesCompleted:  2
  completionRate:       100

AFTER simple revert:
  status:               'active'   ← changed
  completedAt:          null       ← changed
  totalActivities:      0          ← STILL WRONG ⚠
  completionRate:       100        ← STILL 100% ⚠

AFTER correct revert:
  status:               'active'
  completedAt:          null
  totalActivities:      60         ← fixed
  completionRate:       3          ← fixed (2/60 = 3%)
```

---

### Challenge: Squat + Pushup 50 (`Uqx8beHESmfbyelkkmZ0`) — endDate 2026-06-29

| Membership doc | activitiesCompleted | totalActivitiesOld | totalActivitiesCorrect | completionRateOld | completionRateCorrect |
|----------------|--------------------|--------------------|----------------------|-------------------|-----------------------|
| `…_OAKeNrvR…` | 2 | 0 | 42 | 100% | 5% |
| `…_aBYTQvEA…` | 2 | 0 | 42 | 100% | 5% |
| `…_sMfC7PsP…` | 2 | 2 | 42 | 100% | 5% |

durationDays=21, activityCount=2 → correctTotal=42

**Before/After (user sMfC7PsP…):**

```
BEFORE:
  status:               'completed'
  completedAt:          Timestamp(...)
  totalActivities:      2          ← stale (activityCount only)
  activitiesCompleted:  2
  completionRate:       100

AFTER simple revert:
  status:               'active'   ← changed
  completedAt:          null       ← changed
  totalActivities:      2          ← STILL WRONG ⚠ (should be 42)
  completionRate:       100        ← STILL 100% ⚠

AFTER correct revert:
  status:               'active'
  completedAt:          null
  totalActivities:      42         ← fixed
  completionRate:       5          ← fixed (2/42 = 5%)
```

---

### Challenge: 14-day squats marathon 2nd edition (`bIMrgnrblJ0ajQaVtcnF`) — endDate 2026-06-30

| Field | Before | After simple revert | After correct revert |
|-------|--------|---------------------|----------------------|
| status | completed | **active** | **active** |
| completedAt | Timestamp | null | null |
| totalActivities | 0 | 0 (unchanged) ⚠ | **14** |
| activitiesCompleted | 1 | 1 (unchanged) | 1 (unchanged) |
| completionRate | 100% | 100% ⚠ | **7%** |

**Membership:** `bIMrgnrblJ0ajQaVtcnF_sMfC7PsPp7cpGwnr3tGvsKSEOB32`  
durationDays=14, activityCount=1 → correctTotal=14

---

## 4. Recommended Repair Payload (per membership)

The correct repair must write **4 fields**, not 2:

```
status          → 'active'
completedAt     → null
totalActivities → computeRequiredLogs(durationDays, activityCount)
completionRate  → round(activitiesCompleted / totalActivitiesCorrect * 100)
```

### Exact payload per doc

| Document ID | status | completedAt | totalActivities | completionRate |
|-------------|--------|-------------|-----------------|----------------|
| `1S7cXHuHkwAONHhtSgLD_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | active | null | 30 | 3 |
| `K4eBvaSLKe4yi1taOWCc_0gO19swmbYMrbUoQaHTfzpIr6H42` | active | null | 60 | 3 |
| `K4eBvaSLKe4yi1taOWCc_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | active | null | 60 | 3 |
| `Uqx8beHESmfbyelkkmZ0_OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | active | null | 42 | 5 |
| `Uqx8beHESmfbyelkkmZ0_aBYTQvEAIVgkSy621mUg77FyX652` | active | null | 42 | 5 |
| `Uqx8beHESmfbyelkkmZ0_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | active | null | 42 | 5 |
| `bIMrgnrblJ0ajQaVtcnF_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | active | null | 14 | 7 |

**Fields NOT touched** (unchanged by repair): `activitiesCompleted`, `totalPoints`, `joinedAt`, `lastActivityAt`, `userId`, `challengeId`, `groupId`

---

## 5. Anomaly: Three memberships have `totalActivities = 0` in Firestore

Three of the 7 memberships have `totalActivities: 0` stored in Firestore — not `2` as expected. These appear to have been created before `totalActivities` was consistently written at join time. The simple revert would leave them with `totalActivities: 0` and `completionRate: 100` — doubly broken. The correct repair payload sets them to the computed correct value.

---

## 6. Quantified Impact

| Scenario | Records affected |
|----------|-----------------|
| Total Category A memberships | 7 |
| Simple revert leaves `completionRate >= 100` AND `status = 'active'` | **7 of 7** |
| Simple revert leaves `totalActivities` wrong (stale or zero) | **7 of 7** |
| `totalActivities` currently = 0 (missing entirely) | 4 of 7 |
| `totalActivities` currently = activityCount only (not × durationDays) | 3 of 7 |

**Conclusion:** The proposed simple revert `{ status: 'active', completedAt: null }` is insufficient for all 7 records. Every record requires `totalActivities` and `completionRate` to be corrected in the same write.

---

## 7. Additional Risk: Next-log re-completion

If the simple revert were applied and a user logged a new workout:

```
activitiesCompleted = min(current + 1, totalActivities)
                    = min(1 + 1, 1)   [for Pushup mania2]
                    = 1               ← capped at stale max
nextRate = round((1 / 1) * 100) = 100
→ status = 'completed' again, immediately
```

The member would be re-completed on their very next log. The corrected `totalActivities = 30` prevents this — `min(2, 30) = 2`, `round(2/30 * 100) = 7%`, no completion.

---

## 8. Validation Confirmation

```
Script:  scripts/validateRepairPayload.ts
Writes:  ZERO — dry-run only
Result:  All 7 Category A memberships validated
         All 4 challenges have durationDays set
         No missing challenge data
```
