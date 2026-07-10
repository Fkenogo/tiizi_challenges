# Phase 18I-5B — Correct Leaderboard Calculations & Replace Percentages with Raw Progress Values

**Date:** 2026-06-30
**Branch:** fix/p0-pre-deploy-blockers
**Root cause fixed:** 1400%/1100% bug in competitive mini-leaderboard

---

## 1. Root Cause of the 1400% / 1100% Bug

**File:** `src/features/Challenges/ChallengeDetailScreen.tsx`
**Location:** Mini-leaderboard queryFn, competitive branch

```ts
// Before (BUG):
} else if (ct === 'competitive') {
  score = Math.round(entry.completionRate * 100);  // ← multiplied already-integer % by 100 again
  scoreLabel = '%';
}
```

`competionRate` is stored in Firestore as an integer 0-100, computed by `CompetitiveEngine`:
```ts
return Math.min(100, Math.round((cumVal / act.targetValue) * 100));
// 100 reps logged / 700 reps target → 14 (stored as 14, not 0.14)
```

Multiplying by 100 again: `14 * 100 = 1400` → displayed as "1400%".

For 80 / 700 reps: `Math.round(80/700 * 100) = 11`, then `11 * 100 = 1100` → "1100%".

No other file had the `* 100` bug. The full leaderboard (`ChallengeLeaderboardScreen`) was correctly showing `{row.completionRate}%` (which renders as "14%"), but the task requires replacing `%` labels with raw values throughout.

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Fix `* 100` bug; competitive branch now uses `cumulativeLoggedValue` + `/ target unit` scoreLabel |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | `renderRowScore`, `podiumScore`, my stat card: competitive shows raw `X / Y unit` instead of `completionRate%`; ranking label updated |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Removed `{activity.pct}%` text label from competitive activity cards (raw text already shown below) |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Hero circle and Final Results "Completion" column: competitive shows `cumulativeLoggedValue / totalTarget unit` instead of `completionRate%`; per-activity `pct%` span removed |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | `· {found.pct}%` suffix removed from competitive activity labels; My Progress section header shows raw values; duplicate raw text below bar removed |
| `src/features/Home/useHomeScreen.ts` | Fallback cards for 2nd/3rd competitive challenges show `X / Y unit` if `cumulativeLoggedValue` and `targetValue` are available |
| `scripts/testScoringGuards.ts` | Updated stale guards 18I-2B-4, 18I-2B-8, 18I-2C-D2; added guards 18I-5B-1 through 18I-5B-11 |

---

## 3. Exact Fixes

### Fix 1: ChallengeDetailScreen — mini-leaderboard competitive branch

```ts
// Before (BUG):
} else if (ct === 'competitive') {
  score = Math.round(entry.completionRate * 100);
  scoreLabel = '%';
}

// After (FIXED):
} else if (ct === 'competitive') {
  const totalTarget = (resolvedChallenge!.activities ?? []).reduce((s, a) => s + (a.targetValue ?? 0), 0);
  const activityUnit = resolvedChallenge!.activities?.[0]?.unit ?? '';
  score = entry.cumulativeLoggedValue;
  scoreLabel = totalTarget > 0 ? `/ ${totalTarget.toLocaleString()} ${activityUnit}`.trim() : '';
}
```

Render: `{entry.score} <span>{entry.scoreLabel}</span>` → displays `100 / 700 reps` ✅

### Fix 2: ChallengeLeaderboardScreen — competitive display

Added at component level:
```ts
const totalTarget = (challenge?.activities ?? []).reduce((s, a) => s + (a.targetValue ?? 0), 0);
const activityUnit = challenge?.activities?.[0]?.unit ?? '';
```

`renderRowScore` for competitive: shows `cumulativeLoggedValue` large + `/ totalTarget unit` small below.

`podiumScore` for competitive: `${row.cumulativeLoggedValue.toLocaleString()} / ${totalTarget.toLocaleString()}`.

My stat card: label changed from "Completion" → "Progress"; value from `completionRate%` → `cumulativeLoggedValue`.

`rankingLabel`: `'Ranked by completion % · tiebreaker: points'` → `'Ranked by progress · tiebreaker: points'`.

### Fix 3: WorkoutLoggedScreen — remove pct% label

```tsx
// Removed:
<span className="text-[15px] font-black text-primary">{activity.pct}%</span>
```

Raw values `X / Y unit` already shown below the progress bar — no information lost.

### Fix 4: ChallengeCompletedScreen — competitive section

Added:
```ts
const totalTarget = (challenge?.activities ?? []).reduce((s, a) => s + (a.targetValue ?? 0), 0);
const activityUnit = challenge?.activities?.[0]?.unit ?? '';
```

Hero circle: `{completionRate}%` → `{cumulativeLoggedValue} / {totalTarget} {activityUnit}`, label "Overall Completion" → "Overall Progress".

Final Results "Completion" column: `{completionRate}%` → `{cumulativeLoggedValue} / {totalTarget} {activityUnit}`, header "Completion" → "Progress".

Per-activity: removed `{activity.pct}%` span; "Done" badge retained.

### Fix 5: SelectChallengeActivityScreen

Activity list suffix: removed `· {found.pct}%` — line now ends with `{found.unit}`.

My Progress section: header now shows raw `X / Y unit` (replaced `{activity.pct}%`); duplicate raw text below bar removed.

### Fix 6: useHomeScreen — 2nd/3rd challenge home cards

Competitive cards with a known `cumulativeLoggedValue` and `targetValue` now show `X / Y unit` as `progressLabel` instead of `fallbackPercent% complete`.

---

## 4. What Was NOT Changed

- `CompetitiveEngine` scoring — `completionRate` still computed and stored as 0-100 integer. Sorting still uses it internally. No write paths changed.
- `sortLeaderboardRows` — unchanged; still sorts competitive by `completionRate` descending (correct).
- `ChallengeDetailScreen` hero `{summary.completionPct}% Complete` — this is a duration-based day progress bar, not a leaderboard label. Left unchanged.
- All non-competitive challenge types — streak/collective display unchanged.
- Firestore rules, indexes, cloud functions — untouched.

---

## 5. Regression Guards

| ID | What it guards |
|----|----------------|
| 18I-2B-4 | (updated) competitive branch uses `entry.cumulativeLoggedValue`, not `entry.completionRate` |
| 18I-2B-8 | (updated) competitive scoreLabel uses raw target format, not `'%'` |
| 18I-2C-D2 | (updated) ChallengeLeaderboardScreen competitive renders `cumulativeLoggedValue` |
| 18I-5B-1 | ChallengeDetailScreen does NOT multiply `completionRate * 100` |
| 18I-5B-2 | ChallengeDetailScreen competitive uses `entry.cumulativeLoggedValue` |
| 18I-5B-3 | ChallengeDetailScreen competitive scoreLabel includes `totalTarget.toLocaleString()` |
| 18I-5B-4 | ChallengeLeaderboardScreen competitive `renderRowScore` uses `cumulativeLoggedValue` |
| 18I-5B-5 | ChallengeLeaderboardScreen does NOT render `{row.completionRate}%` |
| 18I-5B-6 | ChallengeLeaderboardScreen my stat card uses `myEntry.cumulativeLoggedValue` |
| 18I-5B-7 | WorkoutLoggedScreen does NOT render `{activity.pct}%` as visible text label |
| 18I-5B-8 | ChallengeCompletedScreen does NOT render `{completionRate}%` |
| 18I-5B-9 | ChallengeCompletedScreen renders `cumulativeLoggedValue.toLocaleString()` |
| 18I-5B-10 | SelectChallengeActivityScreen does NOT render `found.pct%` suffix |
| 18I-5B-11 | ChallengeLeaderboardScreen `podiumScore` uses `cumulativeLoggedValue` |

---

## 6. Validation

```
npx tsc --noEmit                → ✅ No errors
npm run build                   → ✅ Built in 3.33s
npm run test:scoring-guards     → ✅ All guards passed (incl. 18I-5B-1…11)
npm run test:home-challenge-feeds → ✅ All guards passed
```

---

## 7. Manual Retest Steps

### Test 1 — 1400% bug is gone
1. Open a v2 competitive challenge where you have ~100 reps logged toward 700 reps target
2. Navigate to Challenge Detail screen
3. **Expected:** Mini-leaderboard shows "100 / 700 reps", NOT "1400%"
4. **Before fix:** "1400%" was shown

### Test 2 — Full leaderboard competitive
1. Open the Leaderboard screen for the same challenge
2. **Expected:**
   - Row score shows large number (e.g., "100") with "/ 700 reps" below
   - Podium shows "100 / 700" on cards
   - My stat card shows "Progress: 100" with "/ 700 reps" below
   - Ranking label: "Ranked by progress · tiebreaker: points"

### Test 3 — Workout logged screen
1. Log an activity for a competitive challenge
2. On WorkoutLoggedScreen, look at the competitive activity cards
3. **Expected:** Activity card shows name, progress bar, and "X / Y unit" text — NO percentage label
4. **Before fix:** "14%" was shown next to activity name

### Test 4 — Challenge Completed screen
1. Open a completed competitive challenge
2. **Expected:**
   - Hero circle shows "X / Y unit" with "Overall Progress" label
   - Final Results grid shows "Progress: X / Y unit" column
   - Per-activity: no percentage, "Done" badge shows for ≥100%

### Test 5 — Correct cases (non-competitive types)
1. Open a streak challenge — leaderboard should still show "X days" ✅
2. Open a collective challenge — leaderboard should still show contribution + "% of team" ✅
3. Legacy challenges — should still show "X pts" ✅
