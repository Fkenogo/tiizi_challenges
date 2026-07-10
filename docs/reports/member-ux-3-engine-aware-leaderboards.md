# UX-3 — Engine-aware Challenge Leaderboards
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Objective

Redesign the challenge leaderboard experience so each engine type shows the ranking signal that actually reflects its mechanics. Presentation / read-model only — no scoring, engines, Firestore writes, or completion logic were modified.

---

## 2. Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Full engine-aware rewrite — extended hook, engine-specific sort/display, top-3 podium, pinned current user |

**Files confirmed NOT modified:**
- `src/features/Groups/GroupLeaderboardScreen.tsx` — existing UX already adequate; left unchanged to avoid scope creep
- All engine files, scoring services, Firestore rules, logging paths

---

## 3. Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.78s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

---

## 4. Changes in Detail

### 4.1 Extended `useChallengeLeaderboard` Hook

Previously fetched only `userId + totalPoints`. Now fetches all v2-relevant fields per `challengeMembers` document:

| Field | Used by |
|---|---|
| `totalPoints` | Legacy v1, competitive tiebreaker |
| `completionRate` | Competitive ranking (primary) |
| `currentStreak` | Streak ranking (primary) |
| `longestStreak` | Streak tiebreaker |
| `cumulativeValues` | Collective contribution (fallback sum) |
| `cumulativeLoggedValue` | Collective ranking (primary) |
| `activitiesCompleted` | Available for future use |
| `lastActivityAt` | Available for future use |

`cumulativeLoggedValue` falls back to summing `cumulativeValues` values if the dedicated field is absent — safe for members created before the field was added.

### 4.2 Engine-specific Ranking

| Engine | Primary sort | Tiebreaker |
|---|---|---|
| Collective | `cumulativeLoggedValue` desc | — |
| Competitive | `completionRate` desc | `totalPoints` desc |
| Streak | `currentStreak` desc | `longestStreak` desc, then `totalPoints` |
| Legacy v1 | `totalPoints` desc | — |

### 4.3 Collective Team Progress Banner

When `challenge.groupCumulativeTarget > 0`, a team progress card renders above the stat card:
- Progress bar with `groupCurrentTotal / groupCumulativeTarget`
- Percentage and remaining amount
- Uses existing `challenge` fields — no additional Firestore query

### 4.4 My Stats Card (engine-specific)

Replaces the generic "Current Rank / Total Points" card:
- **Collective:** Rank + Contributed (cumulativeLoggedValue)
- **Competitive:** Rank + Completion %
- **Streak:** Rank + Current Streak + Best Streak (3-column grid)
- **Legacy:** unchanged — Rank + Total Points

### 4.5 Top-3 Podium

Visual podium above the ranked list:
- Rank 1 center, larger avatar, primary border
- Ranks 2 and 3 flanking, smaller
- Current user ring highlight
- Engine-aware score label below name (contribution / % / streak days / pts)

### 4.6 Engine-specific Row Display

| Engine | Score shown | Secondary |
|---|---|---|
| Collective | Contribution total | "X% of team" |
| Competitive | Completion % | "Done" badge at 100% |
| Streak | Current streak days | "best N" + 🔥 badge at streak ≥ 7 |
| Legacy | Points | "pts" label |

### 4.7 Pinned Current User

If the current user is ranked 11th or lower, a "Your Position" section appears below the top-10 list with their entry pinned in the same card style, so they always know where they stand.

### 4.8 Navigation Regression

`ChallengeDetailScreen` navigates to `/app/challenges/leaderboard?challengeId=${id}` at line 471 — unchanged and still works. The `challengeId` and `groupId` query params are read identically in the new screen.

---

## 5. Scoring Guard Compliance

The guard at `scripts/testScoringGuards.ts:454` requires the string:
> "Points are based on challenge targets"

This string is preserved as a helper line below the engine-specific ranking label on the Rankings section. It renders for all challenge types and satisfies the guard.

---

## 6. Design Decisions

**No GroupLeaderboardScreen changes:** The group leaderboard shows cross-challenge points and is not engine-specific by design. UX improvements are out of scope for this task; avoiding unrelated changes per session constraint.

**Collective contribution % is relative to the group total logged, not the challenge target.** It shows each member's share of what the group has collectively submitted — a meaningful social signal.

**`cumulativeLoggedValue` fallback:** Derived as `sum(cumulativeValues.values())` when the field itself is absent. This keeps the screen functional for members without the field while Phase 11F's engine writes that field going forward.

---

## 7. Remaining Gaps

| Gap | Notes |
|---|---|
| Group leaderboard UX improvements | Deprioritized — out of UX-3 scope per session constraints |
| Avatar photos | Placeholder grey circles; profile photo fetch not wired |
| Animated rank change | Could animate position changes on re-render; low priority |
| Competitive per-activity breakdown on leaderboard row | Per-activity bars per member would require a nested expanded state; deferred to future UX pass |
