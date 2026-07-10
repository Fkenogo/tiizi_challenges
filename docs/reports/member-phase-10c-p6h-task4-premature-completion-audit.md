# Task 4 — CRIT-3: Premature Challenge Completion Audit

**Date:** 2026-06-24  
**Branch:** fix/p0-pre-deploy-blockers  
**Mode:** DRY-RUN — zero writes performed

---

## 1. Root Cause Analysis

### The Algorithm

Member completion is triggered in two places in the client codebase:

**`src/services/workoutService.ts:128`**
```ts
const nextCompleted = Math.min(alreadyCompleted + 1, totalActivities);
const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));

if (nextRate >= 100 && membership.status !== 'completed') {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = Timestamp.now();
}
```

**`src/services/activityLogSessionService.ts:380`**
```ts
const nextCompleted = Math.min(activitiesCompleted + entries.length, totalActivities);
const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));
if (nextRate >= 100) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = serverTimestamp();
}
```

### The Bug

`totalActivities` is set from `challenge.activities.length` at join time — the number of **activity types** defined on the challenge (e.g., 1 for "50 pushups/day", 2 for "squats + pushups"). It is **not** the number of days in the challenge.

For a typical streak challenge with 1 activity type, `totalActivities = 1`. After a member logs **a single workout session**, `activitiesCompleted = 1 = totalActivities`, `completionRate = 100%`, and `status = 'completed'` is written — even though the challenge runs for 7, 14, or 30 more days.

**This is not a new bug introduced by the durationDays backfill.** The backfill exposed it by establishing authoritative `durationDays` values that now conflict with the existing premature completion records.

### Contributing Factor

`durationDays` was previously missing from all challenge documents. Any logic that might have used it to gate completion had no data to work with. Now that `durationDays` is backfilled, any future completion logic can correctly require a member to log across the full duration, not just once.

### Completion Authority

There is currently **no date-based or durationDays-based completion check** in any code path. Completion is driven entirely by `activitiesCompleted >= totalActivities`, where `totalActivities` counts activity types, not days.

---

## 2. Current Completion Algorithm

```
Member joins challenge:
  activitiesCompleted = 0
  totalActivities     = challenge.activities.length  (number of activity types, e.g. 1 or 2)
  completionRate      = 0
  status              = 'active'

Member logs one session:
  activitiesCompleted = min(activitiesCompleted + 1, totalActivities)
  completionRate      = round((activitiesCompleted / totalActivities) * 100), capped at 100
  if completionRate >= 100:
    status     = 'completed'
    completedAt = now()
```

No check against `endDate`, `durationDays`, or current date is performed at completion time.

### Where `status = 'completed'` Is Written

| File | Trigger |
|------|---------|
| `src/services/workoutService.ts:128` | After every `createWorkout` call |
| `src/services/activityLogSessionService.ts:380` | After every `logActivitySession` call |

### Where `status = 'completed'` Is Read

| File | Use |
|------|-----|
| `src/services/challengeService.ts:271` | `getChallengeParticipantCount` counts active+completed members |
| `src/services/challengeService.ts:301` | `getUserChallengeMembershipSummaries` includes completed |
| `src/services/activityLogSessionService.ts:256` | Guards re-completion check |
| `functions/src/memberUserMetrics.ts:84` | `isCompletedMembership` for user stats |
| `functions/src/memberCounters.ts:6` | `ACTIVE_MEMBER_STATUSES` includes completed |

### What `canSummarizeActivity` Checks

`functions/src/memberActivitySummaries.ts:132` — `canSummarizeActivity` verifies that `challengeMember` exists but does **not** check `challengeMember.status`. A member marked `completed` can still have their new logs summarized as long as the challenge itself is `active` and they remain a group member. This means reverting premature members to `active` carries no scoring risk.

---

## 3. Dry-Run Audit Results

### Raw Counts

| Metric | Count |
|--------|-------|
| Total challenges | 30 |
| Total completed memberships | 161 |
| Flagged (completed + challenge=active or endDate future) | **129** |
| Active memberships with completionRate=100 and endDate future | **0** |

### Critical Segmentation

The 129 flagged records fall into two distinct categories that require **different treatments**:

#### Category A — Truly Premature (endDate still in future, 7 records)

These members are on **ongoing live challenges** where the end date has not yet passed. Their `completed` status is unambiguously wrong — the challenge is still running.

| challengeId | challengeName | endDate | affected userId(s) | count |
|-------------|--------------|---------|-------------------|-------|
| 1S7cXHuHkwAONH | Pushup mania2 | 2026-07-05 | sMfC7PsP… | 1 |
| K4eBvaSLKe4yi1 | 30-Day Pushup Duel | 2026-07-05 | 0gO19swm…, sMfC7PsP… | 2 |
| Uqx8beHESmfbye | Squat + Pushup 50 | 2026-06-29 | OAKeNrvR…, aBYTQvEA…, sMfC7PsP… | 3 |
| bIMrgnrblJ0ajQ | 14-day squats marathon 2nd edition | 2026-06-30 | sMfC7PsP… | 1 |

**Total Category A: 7 memberships across 4 live challenges**

**Proposed repair:**
```json
{ "status": "active", "completedAt": null }
```

#### Category B — Stale Challenge Status (endDate passed, challenge.status still 'active', 122 records)

These members are on challenges whose **endDate has already passed** but the challenge document still has `status = 'active'` (Firestore stale state). The members who were marked `completed` are **correctly marked** — they did complete within the challenge window. The problem is with the challenge document's own status, not the member record.

Sub-counts:
- 3 live challenges (7 day squat, 14-day squats marathon, 7-day squats marathon) with 4 members — challenges effectively expired
- 18 seed challenges with 119 seed/real user memberships — seed data all past end dates

**Proposed repair for Category B:** Update `challenge.status` → `'expired'` on the stale challenge documents, not the member records. This is a separate task.

### B. Change Counts (Category A only — the repair scope)

| Transition | Count |
|-----------|-------|
| `completed` → `active` (premature reversal) | **7** |
| `active` → `completed` (no change proposed) | 0 |
| No change | 122 (Category B — different fix needed) |

### C. Challenges Affected (Category A only)

| challengeId | challengeName | endDate | Members to repair |
|-------------|--------------|---------|------------------|
| 1S7cXHuHkwAONHhtSgLD | Pushup mania2 | 2026-07-05 | 1 |
| K4eBvaSLKe4yi1taOWCc | 30-Day Pushup Duel | 2026-07-05 | 2 |
| Uqx8beHESmfbyelkkmZ0 | Squat + Pushup 50 | 2026-06-29 | 3 |
| bIMrgnrblJ0ajQaVtcnF | 14-day squats marathon 2nd edition | 2026-06-30 | 1 |

### D. Proposed Repair — Exact Fields Written

For each of the **7 Category A memberships** (document ID = `{challengeId}_{userId}`):

```json
{
  "status": "active",
  "completedAt": null
}
```

Written via `batch.update()` — no other fields touched. `activitiesCompleted`, `completionRate`, `totalPoints`, `totalActivities`, `joinedAt`, `lastActivityAt` all remain unchanged.

> **Note on `completedAt: null`:** Firestore Admin SDK supports writing `null` to a field. This removes the timestamp but does not delete the field. If a full field delete is preferred, `FieldValue.delete()` can be used instead. This decision should be confirmed before apply.

---

## 4. Validation Results

| Command | Result |
|---------|--------|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ Built in 4.25s |
| `npm run test:home-challenge-feeds` | ✅ All guards passed |
| Audit script (dry-run) | ✅ Zero writes performed |

---

## 5. Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Reverting `completed` → `active` re-enables "Leave Challenge" button | Low | `ChallengeDetailScreen` shows Leave only when `membership.status === 'active'` and `progress?.myLogs === 0`. Since these members already have logs (myLogs > 0 once CRIT-2 fix propagates), Leave will not appear. |
| `canLogWorkout` re-enabled for reverted members | Intended | `canLogWorkout = membership.status === 'active' && hasStarted && !hasEnded`. These are ongoing challenges — members should be able to keep logging. This is the correct behavior. |
| `completionRate` remains at 100 after revert | Low | `completionRate` is a display metric. With `status = 'active'` and `completionRate = 100`, the member card will show 100% progress but still allow logging. This is acceptable until the completion algorithm is fixed to be date-aware. It does not break any data invariant. |
| `canSummarizeActivity` not blocked by member status | Non-issue | Cloud Function summarizer only checks that the challengeMember doc exists, not its status. Reverted members can have new logs summarized without any code change. |
| Category B (122 stale-challenge memberships) untouched | Intentional | Those members completed correctly within expired challenges. They should not be reverted. The fix for Category B is to update `challenge.status` on 3 live challenges + 18 seed challenges — a separate task. |
| Repair script re-run safety | Safe | Script checks `endDate > now` before flagging. A re-run after apply will find 0 records (challenges will either have ended or member status already reverted). |

---

## 6. Zero Writes Confirmation

The audit script (`scripts/auditPrematureCompletions.ts`) performs:
- Two Firestore reads: `challenges` collection scan + `challengeMembers where status==completed` query
- One Firestore read: `challengeMembers where status==active AND completionRate==100`
- **Zero writes** — no `batch.commit()`, no `setDoc`, no `updateDoc` calls

Output confirmed: `Zero writes performed — DRY-RUN only.`

---

## 7. Recommended Next Steps

**Step 1 (this task):** Repair 7 Category A memberships — write `{ status: 'active', completedAt: null }`. Requires explicit approval.

**Step 2 (separate task):** Fix the root cause — update the completion algorithm in `workoutService.ts` and `activityLogSessionService.ts` to require `activitiesCompleted >= durationDays` (not just `>= activities.length`) before marking a member completed. Or: gate completion on `now >= endDate`.

**Step 3 (separate task):** Update stale `challenge.status` for challenges past their `endDate` that still read `active` — the 3 live expired challenges and the 18 seed challenges.

**Out of scope for this task:** Category B member records, root-cause algorithm fix, challenge status cleanup.

---

## 8. Script Location

Audit script (dry-run): `scripts/auditPrematureCompletions.ts`

To re-run the dry-run at any time:
```bash
npx tsx scripts/auditPrematureCompletions.ts
```
