# Phase 10C-P4G — Scoring Deployment Readiness Audit

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Verdict: **GO — with noted deploy order**

---

## Validation Results

```
npm run test:scoring-guards          → scoring guards passed   (76 assertions across P4B–P4F)
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npm run test:challenge-creation-backend → challenge creation backend tests passed
npm run test:group-invite-backend    → Group invite backend security tests passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 3.51s
npm --prefix functions run build     → (no errors)
npm --prefix functions run lint      → (no errors)
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges
                                     → rules file compiled successfully ✓
```

---

## Scoring Checklist — All Confirmed

| Check | Finding | Status |
|-------|---------|--------|
| No hardcoded `10` fallback in `workoutService` | `computeActivityScore()` used; `increment(points)` where `points` = engine result | ✅ |
| No hardcoded `10` fallback in `wellnessLogService` | `computeActivityScore()` used; `points ?? 10` removed in P4D | ✅ |
| No hardcoded `10` fallback in `activityLogSessionService` | `computeActivityScore()` used since P4C | ✅ |
| No hardcoded `10` fallback in success path builder | `?? 10` fixed to `?? 0` in P4F | ✅ |
| v2 workout logs can store 0 points | `Math.max(0, scoring.pointsEarned)` — no minimum-1 floor | ✅ |
| v2 wellness logs can store 0 points | Firestore rule: `scoringVersion == 'v2' ? points >= 0 : points > 0` | ✅ |
| Legacy wellness logs still require `points > 0` | Same rule, non-v2 branch | ✅ |
| CF uses `data.points` for v2 workout logs | `isV2 ? clampNumber(storedPoints, 0, ...) : Math.round(value)` | ✅ |
| CF uses `data.points` for v2 wellness logs | Same branch; legacy fallback `storedPoints \|\| value \|\| 1` | ✅ |
| Legacy CF scoring preserved | Both workout and wellness have a `!isV2` path using old behaviour | ✅ |
| All scoring metadata fields in Firestore allowlists | `rawValue`, `targetValue`, `metTarget`, `scoringMethod`, `capped`, `scoringVersion` in both `workoutClientCreateFields()` and `wellnessClientCreateFields()` | ✅ |
| `scoringVersion: 'v2'` written on all new workout docs | `workoutService.ts`, `activityLogSessionService.ts` | ✅ |
| `scoringVersion: 'v2'` written on all new wellness docs | `wellnessLogService.ts`, `activityLogSessionService.ts` | ✅ |
| No raw scoring metadata visible in member UI | Guards confirmed across `WorkoutLoggedScreen`, `ChallengeLeaderboardScreen`, `GroupLeaderboardScreen`, `ChallengeDetailScreen` | ✅ |
| Client and functions `scoringConfig.ts` in sync | Types, constants, scorers, and dispatcher are identical | ✅ |
| Leaderboard `lastScoringVersion` written | `queueActivitySummaryWrites` in `memberActivitySummaries.ts` | ✅ |

---

## Risk Register

### R1 — `maxWorkoutPoints` vs Firestore progress-update cap (Low risk, non-blocking)

`activityWriteGuards.ts` sets `maxWorkoutPoints = 10000`. The `isSafeChallengeProgressUpdate` Firestore rule allows a maximum increment of `activityCount * 1000` per update.

**Scenario where this matters:** A challenge with 1 activity and a workout earning > 1,000 points. The Firestore progress-update write would be rejected at the server.

**Why it won't fire in current deployment:** The scoring engine cannot produce points that large with its current constants:
- `collective/proportional`: max = `basePoints * MAX_OVERPERFORMANCE_MULTIPLIER` = `10 * 1.5` = **15 pts**
- `competitive_value`: max = `targetValue * COMPETITIVE_VALUE_CAP_RATIO` = e.g. `30 * 3` = **90 pts**
- `streak_binary`: max = `basePoints + weekBonus` — practically < 100 pts

The 10,000-point cap in `activityWriteGuards` is a defensive ceiling that is unreachable with current constants. The inconsistency is latent but harmless until scoring constants change.

**Recommended follow-up (P4H or later):** Align `isSafeChallengeProgressUpdate` to use `activityCount * maxWorkoutPoints` or introduce a per-source cap. Not a blocker.

---

### R2 — `workoutService` / `wellnessLogService` auto-completion without `!endAt` guard (Low risk, pre-existing)

`activityLogSessionService` skips auto-completing time-bounded challenges (`if (nextRate >= 100 && membership.status !== 'completed' && !endAt)`). Neither `workoutService.createWorkout` nor `wellnessLogService.writeLog` checks `!endAt`, so they will auto-complete time-bounded challenges when `completionRate >= 100`.

This is a pre-existing issue that predates P4 — not introduced by scoring changes. Scoring correctness is unaffected. Flag for a separate fix.

---

### R3 — `scoringConfig.ts` dual-copy maintenance risk (Low, ongoing)

The scoring engine lives in two files:
- `src/services/scoringConfig.ts` (client)
- `functions/src/scoringConfig.ts` (Cloud Functions)

They are currently identical. There is no compile-time check that they stay in sync. A future change to one that misses the other would silently diverge scoring between the client display layer and Cloud Function storage.

The P4E decision to have Cloud Functions read stored `data.points` (not recompute) means divergence has no immediate scoring effect — but it would affect the client-side preview (`LogWorkout` scoring preview before save). Low risk while the convention holds.

**Recommendation:** Add a guard in `testScoringGuards.ts` that verifies key constants are identical across both files, or add a CI note in the codebase.

---

### R4 — Leaderboard backfill gap (Known, deferred to P4H)

All logs written before this branch's deployment will have no `scoringVersion` field. The Cloud Function leaderboard scoring treats them as legacy: workout logs are scored from `Math.round(value)`, wellness logs from `storedPoints || value || 1`. This means:

- Legacy leaderboard entries reflect raw values, not engine-computed points.
- New (v2) leaderboard entries reflect engine points.
- Mixed-era challenges will have an inconsistent leaderboard until P4H backfill runs.

This is the intended and documented state. **No action needed at deploy time.**

---

## Deployment Order

Rules must be deployed before or simultaneous with client code, because the new wellness write path sends `points: 0` which the old rules would reject.

```bash
# 1. Firestore rules — must deploy first
firebase deploy --only firestore:rules --project tiizi-challenges

# 2. Cloud Functions — deploy simultaneously or right after rules
firebase deploy --only functions --project tiizi-challenges

# 3. Client hosting — after rules and functions are live
firebase deploy --only hosting --project tiizi-challenges
```

A combined deploy is also safe:
```bash
firebase deploy --only firestore:rules,functions,hosting --project tiizi-challenges
```

Firebase applies rules and functions deploys before routing new traffic to the updated hosting bundle, so the combined command respects the correct order.

---

## P4H Leaderboard Backfill — Readiness

P4H can proceed immediately after this branch is deployed. The backfill job should:

1. Read all `workouts` and `wellnessLogs` documents with `scoringVersion == 'v2'`.
2. For each, read `points` (engine-computed, already stored).
3. Re-tally `challengeLeaderboards.score` by summing `points` per `(challengeId, userId)` pair across all v2 logs.
4. Leave legacy documents (`scoringVersion` absent) with their existing raw-value scores in place, or optionally score them through the engine using stored `value` and `targetValue` fields.

The CF infrastructure already writes `lastScoringVersion` on each leaderboard update, which the backfill job can use to distinguish v2-scored entries from legacy entries.

**Constraint:** Run backfill as a one-time admin script using service account credentials — not as a client-triggered operation. No Firestore write rules allow client-side leaderboard updates.

---

## Files Covered by This Audit

| File | Phase | Status |
|------|-------|--------|
| `src/services/scoringConfig.ts` | P4B | ✅ No issues |
| `functions/src/scoringConfig.ts` | P4B | ✅ In sync with client copy |
| `src/services/activityLogSessionService.ts` | P4C/P4D | ✅ Engine wired, 0-point floor correct |
| `src/services/workoutService.ts` | P4D | ✅ Engine wired; R2 pre-exists |
| `src/services/wellnessLogService.ts` | P4D | ✅ Engine wired; R2 pre-exists |
| `functions/src/memberActivitySummaries.ts` | P4E | ✅ v2 branch reads stored points; legacy preserved |
| `firestore.rules` — scoring fields | P4C/P4D | ✅ All v2 fields allowed; 0-pt wellness allowed under v2 |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | P4F | ✅ No raw metadata; 0-pt copy present |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | P4F | ✅ Scoring explanation per type; no raw metadata |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | P4F | ✅ XP removed; helper text added |
| `src/features/Groups/GroupLeaderboardScreen.tsx` | P4F | ✅ XP removed |
