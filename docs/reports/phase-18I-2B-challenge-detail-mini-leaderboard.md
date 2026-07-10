# Phase 18I-2B — ChallengeDetailScreen Mini-Leaderboard Engine-Sensitive Display

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Fixes:** BUG-I-1 from Phase 18I-1 audit

---

## 1. Problem

`ChallengeDetailScreen` mini-leaderboard sorted entries correctly using `sortLeaderboardRows` (engine-aware), but then mapped every entry's display score unconditionally to `entry.totalPoints`:

```ts
.map((entry, index) => ({ rank: index + 1, userId: entry.userId, score: entry.totalPoints }));
```

The rendered JSX then showed `{entry.score} pts` for all challenge types, meaning:
- Streak challenges showed total points, not streak length
- Collective challenges showed total points, not cumulative contribution
- Competitive challenges showed total points, not completion percentage

The full `ChallengeLeaderboardScreen` was already engine-sensitive; only the mini-leaderboard on the detail screen was wrong.

---

## 2. Fix

### `src/features/Challenges/ChallengeDetailScreen.tsx`

**Query map (lines ~113–130):** Added engine-sensitive `score` and `scoreLabel` derivation:

```ts
const ct = resolvedChallenge!.challengeType;
return sorted
  .slice(0, 5)
  .map((entry, index) => {
    let score: number;
    let scoreLabel: string;
    if (ct === 'streak') {
      score = entry.currentStreak;
      scoreLabel = score === 1 ? 'day streak' : 'days';
    } else if (ct === 'competitive') {
      score = Math.round(entry.completionRate * 100);
      scoreLabel = '%';
    } else if (ct === 'collective') {
      score = entry.cumulativeLoggedValue;
      scoreLabel = '';
    } else {
      score = entry.totalPoints;
      scoreLabel = 'pts';
    }
    return { rank: index + 1, userId: entry.userId, score, scoreLabel };
  });
```

**JSX (line ~656):** Renders `scoreLabel` conditionally (no label for collective where the unit is embedded in activity context):

```tsx
<p className="text-[14px] font-black text-slate-900">
  {entry.score}{entry.scoreLabel
    ? <span className="text-[11px] font-normal text-slate-400"> {entry.scoreLabel}</span>
    : null}
</p>
```

**Score display by challenge type:**

| Type | Score field | Label |
|------|------------|-------|
| streak | `currentStreak` | "day streak" / "days" |
| competitive | `completionRate × 100` (rounded) | "%" |
| collective | `cumulativeLoggedValue` | (none) |
| legacy/default | `totalPoints` | "pts" |

The `completionRate` stored in Firestore is a decimal (0–1); multiplying by 100 and rounding gives the percentage integer to display.

---

## 3. What Was Not Changed

- `leaderboardSort.ts` — untouched ✅
- `ChallengeLeaderboardScreen.tsx` — untouched ✅
- Scoring engines — untouched ✅
- Firestore query scope (still `WHERE challengeId == ...`) — untouched ✅
- `workoutService`, `wellnessLogService` — untouched ✅
- All raw data fields fetched from Firestore — still fetched (they were already present in the query)

---

## 4. Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Engine-sensitive `score`/`scoreLabel` in map; JSX renders `scoreLabel` |
| `scripts/testScoringGuards.ts` | Added guards 18I-2B-1 through 18I-2B-10 |

---

## 5. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-2B-1 | `sortLeaderboardRows` still imported and used |
| 18I-2B-2 | `score` not unconditionally mapped from `totalPoints` |
| 18I-2B-3 | Streak branch uses `entry.currentStreak` |
| 18I-2B-4 | Competitive branch uses `entry.completionRate` |
| 18I-2B-5 | Collective branch uses `entry.cumulativeLoggedValue` |
| 18I-2B-6 | JSX renders `entry.scoreLabel` |
| 18I-2B-7 | Streak label is `"day streak"` |
| 18I-2B-8 | Competitive label is `"%"` |
| 18I-2B-9 | `leaderboardSort.ts` export unchanged |
| 18I-2B-10 | `ChallengeLeaderboardScreen` still uses `sortLeaderboardRows` |

---

## 6. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 4.35s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-2B-1…10)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```
