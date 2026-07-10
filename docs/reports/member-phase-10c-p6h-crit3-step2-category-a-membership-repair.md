# CRIT-3 Step 2 — Category A Membership Repair
**Branch:** `fix/p0-pre-deploy-blockers`
**Date:** 2026-06-24
**Status:** Complete — 7/7 records repaired, 0 remaining

---

## 1. Files Modified

| File | Change |
|---|---|
| `scripts/repairCategoryAMemberships.ts` | New script: dry-run + live repair of exactly 7 Category A records (no UI, no service, no config changes) |
| `docs/reports/member-phase-10c-change-log.md` | Change log entry |

No source code files (`src/`) were modified. No Firestore rules were changed.

---

## 2. Data Records Updated

**Collection:** `challengeMembers`
**Batch write:** single atomic commit, 7 documents, 4 fields each (`status`, `completedAt`, `totalActivities`, `completionRate`). All other fields untouched (`activitiesCompleted`, `totalPoints`, `joinedAt`, `lastActivityAt`, `userId`, `challengeId`, `groupId`).

| Document ID | challenge | status | completedAt | totalActivities | completionRate |
|---|---|---|---|---|---|
| `1S7cXHuHkwAONHhtSgLD_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | Pushup mania2 | active→active | Timestamp→**null** | 30→30 | 3%→3% |
| `K4eBvaSLKe4yi1taOWCc_0gO19swmbYMrbUoQaHTfzpIr6H42` | 30-Day Pushup Duel | **completed→active** | Timestamp→**null** | **0→60** | **100%→3%** |
| `K4eBvaSLKe4yi1taOWCc_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | 30-Day Pushup Duel | **completed→active** | Timestamp→**null** | **2→60** | **100%→3%** |
| `Uqx8beHESmfbyelkkmZ0_OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | Squat + Pushup 50 | **completed→active** | Timestamp→**null** | **0→42** | **100%→5%** |
| `Uqx8beHESmfbyelkkmZ0_aBYTQvEAIVgkSy621mUg77FyX652` | Squat + Pushup 50 | **completed→active** | Timestamp→**null** | **0→42** | **100%→5%** |
| `Uqx8beHESmfbyelkkmZ0_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | Squat + Pushup 50 | **completed→active** | Timestamp→**null** | **2→42** | **100%→5%** |
| `bIMrgnrblJ0ajQaVtcnF_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | 14-day squats marathon | **completed→active** | Timestamp→**null** | **0→14** | **100%→7%** |

**Note on record 1 (`1S7cXHuHkwAONHhtSgLD_...`):** This record had `status: active` and correct `totalActivities/completionRate` already in Firestore — it was partially repaired in a prior session. However `completedAt` was still set to a Timestamp. This write cleared it to `null`.

---

## 3. Before / After Values Summary

### Dry-run output (before apply)

```
Doc: 1S7cXHuHkwAONHhtSgLD_sMfC7PsPp7cpGwnr3tGvsKSEOB32
  status: active | completedAt: Timestamp(set) | totalActivities: 30 | activitiesCompleted: 1 | completionRate: 3%

Doc: K4eBvaSLKe4yi1taOWCc_0gO19swmbYMrbUoQaHTfzpIr6H42
  status: completed | completedAt: Timestamp(set) | totalActivities: 0 | activitiesCompleted: 2 | completionRate: 100%

Doc: K4eBvaSLKe4yi1taOWCc_sMfC7PsPp7cpGwnr3tGvsKSEOB32
  status: completed | completedAt: Timestamp(set) | totalActivities: 2 | activitiesCompleted: 2 | completionRate: 100%

Doc: Uqx8beHESmfbyelkkmZ0_OAKeNrvRkbPOMPjwdKAjqC0tWQK2
  status: completed | completedAt: Timestamp(set) | totalActivities: 0 | activitiesCompleted: 2 | completionRate: 100%

Doc: Uqx8beHESmfbyelkkmZ0_aBYTQvEAIVgkSy621mUg77FyX652
  status: completed | completedAt: Timestamp(set) | totalActivities: 0 | activitiesCompleted: 2 | completionRate: 100%

Doc: Uqx8beHESmfbyelkkmZ0_sMfC7PsPp7cpGwnr3tGvsKSEOB32
  status: completed | completedAt: Timestamp(set) | totalActivities: 2 | activitiesCompleted: 2 | completionRate: 100%

Doc: bIMrgnrblJ0ajQaVtcnF_sMfC7PsPp7cpGwnr3tGvsKSEOB32
  status: completed | completedAt: Timestamp(set) | totalActivities: 0 | activitiesCompleted: 1 | completionRate: 100%
```

### Post-repair verification output

```
✓ 1S7cXHuHkwAONHhtSgLD_sMfC7PsPp7cpGwnr3tGvsKSEOB32
✓ K4eBvaSLKe4yi1taOWCc_0gO19swmbYMrbUoQaHTfzpIr6H42
✓ K4eBvaSLKe4yi1taOWCc_sMfC7PsPp7cpGwnr3tGvsKSEOB32
✓ Uqx8beHESmfbyelkkmZ0_OAKeNrvRkbPOMPjwdKAjqC0tWQK2
✓ Uqx8beHESmfbyelkkmZ0_aBYTQvEAIVgkSy621mUg77FyX652
✓ Uqx8beHESmfbyelkkmZ0_sMfC7PsPp7cpGwnr3tGvsKSEOB32
✓ bIMrgnrblJ0ajQaVtcnF_sMfC7PsPp7cpGwnr3tGvsKSEOB32

Remaining Category A repair candidates: 0
✓ All 7 records successfully repaired.
```

---

## 4. Commands Executed

```
# Dry-run (zero writes)
npx tsx scripts/repairCategoryAMemberships.ts

# Live apply
DRY_RUN=false npx tsx scripts/repairCategoryAMemberships.ts

# Validation
npx tsc -b --pretty false
npm run build
npm run test:scoring-guards
npm run test:home-challenge-feeds
```

---

## 5. Test Results

| Command | Result |
|---|---|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ built in 8.26s |
| `npm run test:scoring-guards` | ✅ scoring guards passed |
| `npm run test:home-challenge-feeds` | ✅ all guards passed |

---

## 6. Risks

**Low overall.** The repair targets only the 7 documents identified in Task 4 audit and re-validated in Task 4C. No other documents were touched (confirmed by atomic batch with explicit doc IDs — no query-based updates).

**Residual risk — re-completion on next log:** With `totalActivities` now corrected (30, 60, 42, or 14) and `activitiesCompleted` unchanged (1 or 2), these users are in a correct partial-completion state. Their next log will compute:

```
nextCompleted = min(activitiesCompleted + 1, totalActivities)
             = min(2 + 1, 60) = 3   [example: Pushup Duel user]
nextRate = round(3/60 * 100) = 5%   → no completion triggered
```

The CRIT-3 Step 1 guard (`totalActivities <= 0` throw) adds a further safety net for any future misconfigured records.

**Challenge end-date risk:** One challenge (`Uqx8beHESmfbyelkkmZ0`, Squat + Pushup 50) has `endDate: 2026-06-29` — 5 days from now. The 3 affected users are now `active` and can log until that date. If they do not log, their membership will expire as `active` rather than `completed` — which is the correct state given their actual log history.

---

## 7. Rollback Instructions

The batch write used `merge: true`, so rollback requires re-applying the original values per doc. There is no one-command undo; each affected membership would need to be manually set back to:

```
status:         'completed'
completedAt:    <original Timestamp — not captured, cannot restore automatically>
totalActivities: <old value (0 or 2)>
completionRate: 100
```

**Practical rollback:** Since these memberships were in a broken state (premature completion) prior to repair, a true rollback would restore the broken state. There is no legitimate reason to rollback. If a specific user reports an issue, their membership can be individually inspected and corrected via the Admin panel or a targeted script.

---

## 8. What Was NOT Done

Per constraints:
- No UI changes
- No service code changes (beyond Step 1 guard, already applied)
- No Category B seed/stale data touched
- No Firestore rules changes
- No schema changes
- The repair script (`scripts/repairCategoryAMemberships.ts`) is a one-time migration utility; it was not added to `package.json` scripts
