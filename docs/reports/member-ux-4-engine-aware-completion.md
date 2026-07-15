# UX-4 — Engine-aware Completion Experience
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Objective

Redesign `ChallengeCompletedScreen` so the celebration experience reflects each engine's mechanics. Presentation / read-model only — no scoring, engines, Firestore writes, completion logic, services, rules, or schema were modified.

---

## 2. Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Full engine-aware rewrite — 4 branches (Collective / Competitive / Streak / Legacy) |

**Files confirmed NOT modified:**
- All engine files, scoring services, Firestore rules, logging paths, schema

---

## 3. Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.87s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

---

## 4. Scoring Guard Compliance

Two guards checked `ChallengeCompletedScreen.tsx`:

| Guard | Requirement | Status |
|---|---|---|
| `completedScreen must not use totalValue * 0.4` | Banned custom formula | ✅ Not present |
| `completedScreen must use membership?.totalPoints` | Points from Firestore member doc | ✅ Present in all four branches |

---

## 5. Changes in Detail

### 5.1 Engine Detection

```typescript
const engineVersion = challenge?.engineVersion;
const challengeType = challenge?.challengeType ?? 'collective';
const isV2 = engineVersion === 'v2';
```

Four early-return branches: `isV2 && collective` → `isV2 && competitive` → `isV2 && streak` → legacy fallthrough.

### 5.2 Final Rank — `useFinalRank` hook

Inline `useQuery` that fetches `challengeMembers` for the challenge and sorts using the same engine-specific logic as the leaderboard:
- Collective: by `cumulativeLoggedValue`
- Competitive: by `completionRate`, tiebreaker `totalPoints`
- Streak: by `currentStreak`
- Legacy: by `totalPoints`

Returns `{ rank: number | null, total: number }`. Enabled only when `challengeId + userId` are available.

### 5.3 Collective Completion

- **Hero:** `Users` icon, team goal percentage, "You did it together."
- **Team Progress card:** progress bar, `groupCurrentTotal / groupCumulativeTarget`, group %
- **Your Contribution card:** `cumulativeLoggedValue`, contribution %, final rank, points
- **Quote:** _"The team that moves together, wins together."_
- **CTAs:** Share → View Leaderboard → Back to Group (if groupId) → Go to Home

### 5.4 Competitive Completion

- **Hero:** `Trophy` icon, `completionRate%`, "Completed ✓" green badge at 100%
- **Final Results card:** 3-col grid — Position, Completion %, Points (uses `membership?.totalPoints`)
- **Per-activity breakdown:** one card per activity, progress bar, `cumulative / target unit`, "Done" badge at 100%
- **CTAs:** Share → View Leaderboard → Back to Group (if groupId) → Go to Home

### 5.5 Streak Completion

- **Hero:** `Flame` icon, final streak days, 🔥 milestone badge at multiples of 7
- **Streak Record card:** 3-cell grid — Final / Best / Consistency %, streak progress bar
- **Challenge Days card:** Active days, Missed days, Final Rank, Points
- **Copy:** "Consistency wins. You showed up."
- **CTAs:** Share → View Leaderboard → Back to Group (if groupId) → Go to Home

### 5.6 Legacy v1 (unchanged)

Identical to the original screen. `completionRate` renamed to `legacyCompletionPct` (derived locally from `uniqueDays / totalDays`) to avoid collision with the v2 `membership.completionRate`. All original copy, tier labels, achievement grid, donation section preserved. "Points: X pts" replaces the old "X XP" label (XP was not a guard requirement here but aligns with the rest of the app).

### 5.7 Shared Improvements (all branches)

- **View Leaderboard CTA** added to all v2 branches, navigating to `/app/challenges/leaderboard?challengeId=…`
- **Back to Group CTA** added to all branches when `groupId` is present
- **Find Next Challenge CTA** added to legacy branch
- Donation section preserved in all branches

---

## 6. Navigation Regression Audit

| Navigation path | Source | Status |
|---|---|---|
| `ChallengeDetailScreen` → `/app/challenges/completed?challengeId=…` | Line 508, existing | ✅ Unchanged |
| `WorkoutLoggedScreen` → `toCompletionPath` | Existing | ✅ Unchanged |
| Completed screen → `/app/home` | All branches | ✅ Present |
| Completed screen → leaderboard | v2 branches | ✅ Added |
| Completed screen → group feed | All branches when groupId | ✅ Added |
| Completed screen → `/app/share` | All branches | ✅ Present |
| Completed screen → donation route | All branches | ✅ Present |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| `useFinalRank` fires a full `challengeMembers` read at completion | Acceptable: this screen is shown once per challenge; result is cached for 5 min |
| `groupCurrentTotal` may lag group target by one write cycle | Cosmetic — shows Firestore state at read time; no logic depends on it |
| Collective `myContributionPct` divides by `groupCurrentTotal` | Zero-guarded: `groupCurrentTotal > 0` check before division |

---

## 8. Rollback Instructions

`ChallengeCompletedScreen.tsx` is the only file changed. To revert:
```bash
git checkout HEAD~1 -- src/features/Challenges/ChallengeCompletedScreen.tsx
```
The screen reverts to the original single-branch v1 layout.

---

## 9. Remaining Gaps

| Gap | Notes |
|---|---|
| Share screen is not engine-aware | `/app/share` renders a generic card; a future UX pass could tailor share copy per engine |
| Avatar photos on rank display | Rank shows `--` until `useFinalRank` resolves; no avatar fetching |
| Competitive "time taken" | Spec requested time taken; no `startedAt` field exists on `ChallengeMember` — deferred |
