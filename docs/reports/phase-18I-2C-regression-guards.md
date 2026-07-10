# Phase 18I-2C — Logging + Leaderboard Regression Guards

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Test-only phase — no production behaviour changes.

---

## 1. Goal

Strengthen automated regression protection around:
- The wellness logging pipeline (BUG-I-2 fix from Phase 18I-2A)
- The mini-leaderboard engine-sensitive display (BUG-I-1 fix from Phase 18I-2B)
- `sortLeaderboardRows` as the single canonical ranking implementation
- Display label invariants across both leaderboard screens

---

## 2. Gap Analysis (what was already covered vs. what was missing)

### Already covered by prior phases
| Area | Covered by |
|------|-----------|
| `removeUndefinedDeep` defined in wellnessLogService | 18I-2A-1 |
| `batch.set(logRef, removeUndefinedDeep(...))` | 18I-2A-2 |
| Raw logPayload not written directly | 18I-2A-3 |
| All four wellness log methods present | 18I-2A-4 |
| workoutService sanitized payload pattern | 18I-2A-5 |
| `sortLeaderboardRows` imported and used in ChallengeDetailScreen | 18I-2B-1 |
| Streak/competitive/collective score branches in mini-leaderboard | 18I-2B-3/4/5 |
| Streak "day streak" label, competitive "%" label | 18I-2B-7/8 |
| `leaderboardSort.ts` export intact | 18I-2B-9 |
| ChallengeLeaderboardScreen still uses sortLeaderboardRows | 18I-2B-10 |

### Gaps addressed in this phase
- Behavioural test for `removeUndefinedDeep` (nested + deep stripping)
- Behavioural tests for `sortLeaderboardRows` (all four engine paths)
- Guard: no inline `.sort()` in either leaderboard screen
- Guard: collective `scoreLabel` is empty (not "pts")
- Guard: ChallengeLeaderboardScreen renders "%" / "day(s)" / "pts" per engine
- Guard: both leaderboard queries scoped to `challengeId` (not group-wide)
- Guard: workoutService `removeUndefinedDeep` regression protection (belt-and-suspenders)
- Guard: `scoringVersion: 'v2'` stamp still present in wellness logs

---

## 3. New Guards

### Logging pipeline (18I-2C-L)

| ID | Type | What it guards |
|----|------|---------------|
| 18I-2C-L1 | Textual | `workoutService` still applies `removeUndefinedDeep` before Firestore write |
| 18I-2C-L2 | Textual | `wellnessLogService` still applies `removeUndefinedDeep` before `batch.set(logRef, ...)` |
| 18I-2C-L3 | Textual | Raw `logPayload` is never passed directly to `batch.set` (BUG-I-2 regression) |
| 18I-2C-L4a–f | Behavioural | `removeUndefinedDeep` correctly strips `undefined` at top level, one level deep, and two levels deep; preserves defined values |
| 18I-2C-L5 | Textual | All four wellness log methods (`logFasting`, `logHydration`, `logSleep`, `logMeditation`) still exported |
| 18I-2C-L6 | Textual | `wellnessLogService` still stamps `scoringVersion: 'v2'` on every log write |

### sortLeaderboardRows single-source-of-truth (18I-2C-S)

| ID | Type | What it guards |
|----|------|---------------|
| 18I-2C-S1 | Textual | `sortLeaderboardRows` still exported from `leaderboardSort.ts` |
| 18I-2C-S2 | Textual | `ChallengeDetailScreen` has no inline `.sort()` — all ranking goes through `sortLeaderboardRows` |
| 18I-2C-S3 | Textual | `ChallengeLeaderboardScreen` has no inline `.sort()` — all ranking goes through `sortLeaderboardRows` |
| 18I-2C-S4a–b | Behavioural | v2 streak sort: highest `currentStreak` first, lowest last |
| 18I-2C-S5a–b | Behavioural | v2 competitive sort: highest `completionRate` first, lowest last |
| 18I-2C-S6a–b | Behavioural | v2 collective sort: highest `cumulativeLoggedValue` first, lowest last |
| 18I-2C-S7 | Behavioural | Legacy (v1): `totalPoints DESC` regardless of `challengeType` |

### Display label invariants (18I-2C-D)

| ID | Type | What it guards |
|----|------|---------------|
| 18I-2C-D1 | Textual | Collective `scoreLabel` is `''` (no suffix unit) in mini-leaderboard |
| 18I-2C-D2 | Textual | `ChallengeLeaderboardScreen` renders `completionRate%` for competitive |
| 18I-2C-D3 | Textual | `ChallengeLeaderboardScreen` renders `currentStreak` with "day"/"days" for streak |
| 18I-2C-D4 | Textual | `ChallengeLeaderboardScreen` renders "pts" for legacy |
| 18I-2C-D5 | Textual | `ChallengeDetailScreen` legacy branch assigns `scoreLabel = 'pts'` |
| 18I-2C-D6 | Textual | `ChallengeLeaderboardScreen` query scoped to `challengeId` (not group-wide) |
| 18I-2C-D7 | Textual | `ChallengeDetailScreen` mini-leaderboard query scoped to `challengeId` |

---

## 4. Files Changed

| File | Change |
|------|--------|
| `scripts/testScoringGuards.ts` | Added 18I-2C-L1–6, 18I-2C-S1–7 (with sub-cases), 18I-2C-D1–7 |

---

## 5. What Was Not Changed

- All production source files — untouched ✅
- `leaderboardSort.ts` — untouched ✅
- `ChallengeLeaderboardScreen.tsx` — untouched ✅
- `ChallengeDetailScreen.tsx` — untouched ✅
- `workoutService.ts` — untouched ✅
- `wellnessLogService.ts` — untouched ✅
- Firestore rules — untouched ✅
- Scoring engines — untouched ✅

---

## 6. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 4.21s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-2C-L/S/D sections)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```
