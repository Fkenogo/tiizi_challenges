# Phase 18I-5G — Sweeping Progress Source-of-Truth Audit and Fix

**Date:** 2026-07-01
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Root Cause Analysis

### The Double-Count Bug

After Phase 18I-5F, users observed:
- **WorkoutLoggedScreen**: showed 400 / 5,000 reps
- **ChallengeDetailScreen**: showed 200 / 5,000 reps

The root cause was optimistic double-counting introduced in 18I-5F:

```ts
// 18I-5F code (WorkoutLoggedScreen) — WRONG
const cachedGroupTotal = safeNum(challenge?.groupCurrentTotal);
const groupCurrentTotal = challengeType === 'collective' ? cachedGroupTotal + value : cachedGroupTotal;
```

**Why this double-counts:**

1. User logs 200 reps. Firebase Cloud Function writes `groupCurrentTotal = 200` atomically.
2. `useWorkouts.onSuccess` invalidates `['challenge', challengeId]`.
3. React Query re-fetches: `challenge.groupCurrentTotal` now equals `200` (the real Firestore value).
4. `WorkoutLoggedScreen` renders: `cachedGroupTotal (200) + value (200) = 400`. **Double-counted.**
5. `ChallengeDetailScreen` reads the same `challenge.groupCurrentTotal = 200` without adding anything: shows `200`.

Same issue for `myTotalContrib = safeNum(membership?.cumulativeLoggedValue) + value`: `cumulativeLoggedValue` was already updated to include `value` before navigation.

### The Architecture Problem

Screens were independently computing percentages, labels, and remaining values from raw Firestore fields using `safeNum()` inline — meaning 7+ screens each had their own interpretation of the same data, guaranteed to diverge over time.

---

## 2. Architecture: Single Canonical Resolver

**New file: `src/features/Challenges/challengeProgressResolver.ts`**

```
Firestore
  ├── challenges/{id}.groupCurrentTotal       ← authoritative group total
  ├── challenges/{id}.groupCumulativeTarget
  └── challengeMembers/{id}.cumulativeLoggedValue  ← user's personal total

challengeProgressResolver.ts::resolveChallengeProgress({
  challenge, membership, leaderboard, currentUserId, sessionDelta
}) → ResolvedProgress

ResolvedProgress consumed by ALL screens:
  WorkoutLoggedScreen      groupTotal, groupPercent, groupRemaining, userContributionTotal, sessionDelta
  ChallengeDetailScreen    groupTotal, groupTarget, groupPercent, groupRemaining, userContributionTotal
                           competitiveLeaderTotal, competitiveGap, isCurrentUserLeading
  ChallengeLeaderboardScreen  groupTotal, groupTarget, groupPercent
  ChallengeCompletedScreen    groupTotal, groupTarget, groupPercent, userContributionTotal
  LogWorkoutScreen         groupTotal, groupTarget, groupPercent
  LogWellnessActivityScreen   groupTotal, groupTarget, groupPercent, streakCurrentDays, streakTargetDays
  SelectChallengeActivityScreen  groupTotal, groupTarget, groupPercent, streakCurrentDays, streakTargetDays
  useHomeScreen (via shim) primaryLabel, secondaryLabel, progressPercent
```

**Key design decisions (documented once in the resolver):**

| Field | Source | Rationale |
|-------|--------|-----------|
| `groupTotal` | `challenge.groupCurrentTotal` | Authoritative; written atomically by Cloud Function |
| `userContributionTotal` | `membership.cumulativeLoggedValue` | Authoritative per-user Firestore total |
| `sessionDelta` | URL param (`value`) | Display-only — "just logged N today". NEVER added to totals. |

---

## 3. Changes Made

### 3a. Created `src/features/Challenges/challengeProgressResolver.ts`

New canonical resolver. Exports:
- `safeNum(v: unknown): number` — coerces any value to finite number (guards NaN, Infinity, undefined)
- `resolveChallengeProgress(input: ProgressInput): ResolvedProgress` — single function all screens call
- `ProgressInput` / `ResolvedProgress` — shared types

Internally computes all progress fields from Firestore values only. `sessionDelta` is stored on the output object but never added to `groupTotal` or `userContributionTotal`.

### 3b. Made `challengeProgressDisplay.ts` a thin shim

`buildChallengeProgress` now delegates to `resolveChallengeProgress` and returns the subset needed by home cards. All `safeNum` / clamping / branching logic removed from this file.

### 3c. Removed double-count from `WorkoutLoggedScreen.tsx`

**Before (18I-5F, double-counting):**
```ts
const cachedGroupTotal = safeNum(challenge?.groupCurrentTotal);
const groupCurrentTotal = challengeType === 'collective' ? cachedGroupTotal + value : cachedGroupTotal;
const myTotalContrib = safeNum(membership?.cumulativeLoggedValue) + (challengeType === 'collective' ? value : 0);
```

**After (18I-5G, resolver):**
```ts
const resolved = resolveChallengeProgress({
  challenge: challenge ?? null,
  membership: membership ?? null,
  currentUserId: user?.uid,
  sessionDelta: value,  // shown as "+N today" only
});
const groupCurrentTotal = resolved.groupTotal;          // authoritative, no + value
const myTotalContrib = resolved.userContributionTotal;  // authoritative, no + value
```

The UI still shows `+{value} today` as a separate line, so the user sees their contribution clearly without the total being wrong.

### 3d. Migrated all remaining screens to resolver

| Screen | Old | New |
|--------|-----|-----|
| `ChallengeDetailScreen.tsx` | inline `safeNum(resolvedChallenge.groupCurrentTotal)` | `resolveChallengeProgress(...)` |
| `ChallengeLeaderboardScreen.tsx` | inline `safeNum(challenge?.groupCurrentTotal)` | `resolveChallengeProgress(...)` |
| `ChallengeCompletedScreen.tsx` | inline `safeNum(challenge?.groupCurrentTotal)` | `resolveChallengeProgress(...)` |
| `LogWorkoutScreen.tsx` | inline `safeNum(challenge?.groupCurrentTotal)` | `resolveChallengeProgress(...)` |
| `LogWellnessActivityScreen.tsx` | inline `safeNum(challenge?.groupCurrentTotal)` + inline streak | `resolveChallengeProgress(...)` |
| `SelectChallengeActivityScreen.tsx` | inline `safeNum(challenge?.groupCurrentTotal)` + inline streak | `resolveChallengeProgress(...)` |

### 3e. Updated guards 18I-5E-2 through 18I-5E-5 and 18I-5F-7/8/13

These guards checked `challengeProgressDisplay.ts` for patterns that now live in `challengeProgressResolver.ts`. Updated to check the resolver (with notes explaining the migration) so the invariants are preserved correctly.

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/challengeProgressResolver.ts` | **CREATED** — canonical resolver |
| `src/features/Challenges/challengeProgressDisplay.ts` | Converted to thin shim |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Resolver call; double-count removed |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Resolver for collective + competitive leader sections |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Resolver for group total/pct header |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Resolver for collective completion stats |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Resolver for pre-log collective context |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Resolver for pre-log context + streak |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Resolver for activity-selection context + streak |
| `scripts/testScoringGuards.ts` | Guards 18I-5G-1 through 18I-5G-16; updated 18I-5E-2…5E-5, 18I-5F-7, 18I-5F-8, 18I-5F-13 |

---

## 5. Regression Guards (18I-5G-1 … 18I-5G-16)

| ID | What it guards |
|----|----------------|
| 18I-5G-1 | `resolveChallengeProgress` is exported from resolver |
| 18I-5G-2 | `safeNum` is exported from resolver |
| 18I-5G-3 | `groupTotal` derived from `challenge.groupCurrentTotal` only |
| 18I-5G-4 | `sessionDelta` documented as display-only |
| 18I-5G-5 | `challengeProgressDisplay.ts` is a thin shim (no inline clamping) |
| 18I-5G-6/6b | `WorkoutLoggedScreen` passes `sessionDelta: value`; never adds to groupTotal |
| 18I-5G-7 | `ChallengeDetailScreen` uses resolver for group totals |
| 18I-5G-8 | `ChallengeLeaderboardScreen` uses resolver |
| 18I-5G-9 | `ChallengeCompletedScreen` uses resolver |
| 18I-5G-10 | `LogWorkoutScreen` uses resolver |
| 18I-5G-11 | `LogWellnessActivityScreen` uses resolver |
| 18I-5G-12 | `SelectChallengeActivityScreen` uses resolver |
| 18I-5G-13 | Resolver produces finite output for null inputs (no NaN) |
| 18I-5G-14 | Collective: `userContributionTotal` = `membership.cumulativeLoggedValue`; `groupTotal` = `groupCurrentTotal`; `secondaryLabel` includes contribution |
| 18I-5G-15 | Competitive: leader total, gap, and `isCurrentUserLeading` all correct |
| 18I-5G-16 | No double-count: `groupTotal` stays authoritative; `sessionDelta` not included in totals |

---

## 6. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 3.75s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-5G-1…16)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```

---

## 7. Manual Test Checklist

### Verify the double-count is fixed
1. Join a collective challenge. Note the current team total (e.g. 200 reps).
2. Log a workout (e.g. 150 reps).
3. `WorkoutLoggedScreen` should show:
   - Team Progress: `350 / 5,000 reps` (the actual Firestore total, not 200 + 150 + 150 = 500)
   - Your Contribution: `+150 reps today` · `350 reps total`
4. Navigate to `ChallengeDetailScreen` — same `350 / 5,000 reps` shown.

### Verify collective screens consistent
5. All of: WorkoutLoggedScreen, ChallengeDetailScreen, ChallengeLeaderboardScreen, ChallengeCompletedScreen show the same team total.

### Verify wellness collective (same fix)
6. Log a wellness activity on a collective wellness challenge.
7. Same totals should appear on completion screen and detail screen.

### Verify no NaN
8. No screen should ever show `NaN` in progress labels or percentages.

### Verify competitive leader comparison
9. Open a competitive challenge. Detail screen always shows "You are leading 🏆" or leader comparison with gap.

---

## 8. Invariants Locked In

These invariants are now enforced by guards 18I-5G-1 through 18I-5G-16 and cannot silently break:

1. **One resolver** — `resolveChallengeProgress` is the single source of truth
2. **No independent math** — no screen computes `groupTotal`, `userContributionTotal`, `groupPercent`, `streakCurrentDays`, `streakTargetDays`, `competitiveLeaderTotal`, or `competitiveGap` independently
3. **No sessionDelta in totals** — `sessionDelta` is a display-only annotation; the resolver never adds it to any aggregate
4. **NaN-proof** — `safeNum` at every Firestore field boundary; output is always finite
5. **Label consistency** — same challenge on different screens always shows the same total
