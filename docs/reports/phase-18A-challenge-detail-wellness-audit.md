# Phase 18A — Challenge Detail + Wellness Activity Model Audit

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Type:** Audit only — no code changes

---

## 1. Challenge Detail Screen — Current Data Flow

`ChallengeDetailScreen.tsx` data flow:

```
useChallenge(id)              → resolvedChallenge (Firestore doc)
useChallengeMembership(id)    → membership (completionRate, status, totalPoints)
useChallengeProgress(id, uid) → progress (myLogs, totalLogs, uniqueParticipants)
useCanAccessChallenge(id)     → canAccessChallenge
useGroups() / useGroup()      → challengeGroup (name, isPrivate)
useQuery leaderboard          → direct getDocs on challengeMembers (top 5)
useChallengeContribution()    → contribution (donation state)
```

All data is already fetched correctly. The screen computes a local `summary` object from raw dates and membership state, and a local `leaderboard` sorted via `sortLeaderboardRows(rows, engineVersion, challengeType)` — so sorting is already engine-aware.

---

## 2. Hardcoded / Generic Sections

### "Daily Targets" section (lines 342–372)

The section renders `resolvedChallenge.activities` and is entirely data-driven. Activity name, targetValue, unit, and frequency are all pulled from the challenge doc. **No hardcoding here — data-driven and correct.**

One minor display issue: `activity.exerciseName || activity.exerciseId || 'Activity N'` — for wellness activities, `exerciseName` is the field set by the picker (e.g. "Meditation"). This works today because the wizard always sets `query` → `exerciseName` on pick, but the field name is inconsistent (fitness uses `exerciseName`, wellness also uses `exerciseName` even though the canonical identifier is `activityId`). Not a bug today; becomes a bug if wellness activities ever lack `exerciseName`.

### "How Points Work" section (lines 374–392)

**Fully hardcoded. This is the primary engine-awareness gap:**

- Always says "each activity can earn up to 100 points per log. Hitting the daily target earns 100 points."
- Always gives the proportional-points example (`100 reps → log 50 → 50 pts`).
- This copy is correct for competitive mode, but:
  - **Collective:** scoring is pool-based toward a group target, not 100 pts/log. The copy misleads members.
  - **Streak:** scoring is binary (you either logged the day or you didn't toward your streak). The copy implies partial credit.

### Stats row (lines 318–330)

Shows: `My Logs`, `Total Logs`, `Participants`. These are generic across all engine types. Missing engine-specific stats:

| challengeType | Missing stats |
|---|---|
| collective | Group cumulative progress toward `groupCumulativeTarget` |
| streak | Current streak, longest streak (both exist on the membership doc) |

---

## 3. Challenge Document Fields Not Displayed

The following fields exist on the challenge doc but are never rendered in `ChallengeDetailScreen`:

| Field | Where it lives | Missing display |
|---|---|---|
| `engineVersion` | challenge doc | Not shown (internal — OK to omit) |
| `groupCumulativeTarget` | challenge doc (collective only) | Not shown at all |
| `autoCompleteOnGroupTarget` | challenge doc (collective only) | Not shown |
| `requiredConsecutiveDays` | challenge doc (streak only) | Not shown at all |
| `streakResetOnMiss` | challenge doc (streak only) | Not shown |
| `cumulativeLoggedValue` (per member) | challengeMembers doc | Leaderboard uses it for sorting but never displays raw value to member |
| `currentStreak` / `longestStreak` | challengeMembers doc | Fetched in leaderboard query but score shown as `totalPoints` only |

The leaderboard query (lines 79–104) fetches `currentStreak`, `longestStreak`, `cumulativeLoggedValue`, but then sorts by `totalPoints` and displays `entry.score` (= `totalPoints`) for every challenge type, regardless of whether streak or collective has a more meaningful primary metric.

---

## 4. Engine-Aware Detail Requirements Per Combination

### Fitness + Competitive (baseline)
Current screen is correct: Daily Targets → proportional points. Only gap is the generic "How Points Work" copy, which happens to be accurate for this combination.

### Fitness + Collective
- Missing: Progress bar toward `groupCumulativeTarget` (e.g., "Group has logged 4,200 / 10,000 reps")
- "How Points Work" copy is misleading — members contribute to a pool, not individual 100-pt buckets
- Leaderboard should show `cumulativeLoggedValue` as the primary sort key for collective (already done in `sortLeaderboardRows` but not surfaced in the score label)

### Fitness + Streak
- Missing: Current streak and required streak displayed prominently
- Missing: `requiredConsecutiveDays` shown (e.g., "Goal: 30-day streak")
- "How Points Work" should describe binary daily completion, not proportional points
- Leaderboard should show `currentStreak` as primary metric for streak, not `totalPoints`

### Wellness + Competitive
Same as Fitness + Competitive. CTA correctly says "Log Activity" (line 567: `isWellnessChallenge ? 'Log Activity' : 'Log Workout'`). Correct.

### Wellness + Collective
Same gaps as Fitness + Collective.

### Wellness + Streak
Same gaps as Fitness + Streak.

---

## 5. Root Cause of the 7-Day Streak Duration Mismatch

### The three date computations in play

**Client Wizard — `challengeDurationDays` useMemo (line 286):**
```ts
Math.floor((end.getTime() - start.getTime()) / msPerDay) + 1
```
This is **inclusive** (counts both the start day and the end day). Aug 1 → Aug 7 = **7 days**.

**Cloud Function backend — fallback formula (line 296):**
```ts
Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY))
```
This is **exclusive** (no +1). Aug 1 → Aug 7 = difference of 6 days = **6 days**.

**Client detail screen — local summary `durationDays` (line 54):**
```ts
Math.max(1, Math.ceil((endMs - startMs) / oneDay) + 1)
```
This is **inclusive** again (ceil + 1). Aug 1 → Aug 7 = **7 days**.

### What actually happens in the Wizard flow

The Wizard sends **all three** in the payload (lines 430–436):
```ts
{ startDate, endDate, durationDays: challengeDurationDays }
```

The backend (lines 293–296) resolves: if `durationDays` is provided explicitly, use it directly — the date-difference formula is only the fallback.

**The Wizard path is safe:** `durationDays: 7` is sent explicitly, the backend uses `7`, and `requiredConsecutiveDays: 7` passes the `<= durationDays` check.

### When does the bug surface?

The mismatch becomes real if:
1. A caller sends only `startDate` + `endDate` without `durationDays` — the backend computes 6, then a `requiredConsecutiveDays: 7` payload fails.
2. The Admin Create screen (`CreateChallengeScreen`) uses a different payload shape — needs verification (not audited here).
3. Any future API caller or direct Firestore write that omits `durationDays`.

### Detail screen inconsistency (cosmetic only)

The detail screen recomputes duration client-side from raw dates using the inclusive formula, so it will always display "7 days" for an Aug 1–Aug 7 challenge. If the backend stored `durationDays: 6` (fallback path), the detail screen would show 7 while the backend engine computed 6 — a cosmetic discrepancy, not a scoring error.

**Root cause summary:** Two different formulas exist — `+1 inclusive` on the client, `round exclusive` on the backend fallback. The Wizard avoids this by sending `durationDays` explicitly. The risk lives in any path that omits `durationDays`.

---

## 6. Wellness Activity Model Audit

### Current catalog state

57 total activities across 8 categories:
- 8 fasting · 8 hydration · 7 sleep · 8 mindfulness · 7 nutrition · 8 habits · 7 stress · 6 social

### Activity naming — embedded targets in names

Several activity names bake the target value into the name string. This conflicts with the user-editable `targetValue` field — if a user sets "5-Min Meditation" to 15 minutes, the name still says "5-Min."

| Activity name | Embedded quantity | `defaultTargetValue` |
|---|---|---|
| `16-Hour Fast (16/8)` | "16-Hour" | 16 hours |
| `18-Hour Fast (18/6)` | "18-Hour" | 18 hours |
| `20-Hour Fast (20/4)` | "20-Hour" | 20 hours |
| `48-Hour Fast` | "48-Hour" | 48 hours |
| `72-Hour Fast` | "72-Hour" | 72 hours |
| `8-Hour Sleep Streak` | "8-Hour" | 8 hours |
| `Daily Hydration 2L` | "2L" | 2000 ml |
| `Enhanced Hydration 3L` | "3L" | 3000 ml |
| `Athlete Hydration 4L` | "4L" | 4000 ml |
| `5-a-Day Vegetables` | "5-a-Day" | 5 servings |
| `7-a-Day Produce` | "7-a-Day" | 7 servings |
| `5-Min Meditation` | "5-Min" | 5 minutes |
| `10-Min Mindfulness` | "10-Min" | 10 minutes |
| `20-Min Deep Practice` | "20-Min" | 20 minutes |

### Naming fix recommendations

The ID is derived from `shortName` (line 44: `` `${category}-${slugify(seed.shortName || seed.name)}` ``), **not** from `name`. So renaming `name` while leaving `shortName` unchanged preserves all existing IDs — no migration required.

| Category | Current `name` | Recommended `name` |
|---|---|---|
| fasting | `16-Hour Fast (16/8)` | `Intermittent Fasting (16/8)` |
| fasting | `18-Hour Fast (18/6)` | `Extended Fasting (18/6)` |
| fasting | `20-Hour Fast (20/4)` | `Aggressive Fasting (20/4)` |
| fasting | `48-Hour Fast` | `Extended 2-Day Fast` |
| fasting | `72-Hour Fast` | `3-Day Therapeutic Fast` |
| sleep | `8-Hour Sleep Streak` | `Full Night Sleep` |
| hydration | `Daily Hydration 2L` | `Daily Hydration` |
| hydration | `Enhanced Hydration 3L` | `Enhanced Hydration` |
| hydration | `Athlete Hydration 4L` | `Athlete Hydration` |
| nutrition | `5-a-Day Vegetables` | `Daily Vegetables` |
| nutrition | `7-a-Day Produce` | `Full Produce Day` |
| mindfulness | `5-Min Meditation` | `Meditation` |
| mindfulness | `10-Min Mindfulness` | `Mindfulness Session` |
| mindfulness | `20-Min Deep Practice` | `Deep Meditation` |

### Missing activity: Steps

**Steps is the most critical missing wellness activity.** Step counting is the highest-engagement wellness metric on mobile health apps and is completely absent from all 8 categories. Best fit: `habits` category.

**Proposed entry:**
```ts
{
  name: 'Daily Steps',
  shortName: 'Daily Steps',
  difficulty: 'beginner',
  defaultTargetValue: 10000,
  defaultMetricUnit: 'steps',
}
```

### Other notable gaps

| Missing activity | Proposed category | Notes |
|---|---|---|
| Walking distance | `habits` | "Nature Walk Reset" in stress tracks minutes, not distance |
| Yoga / Stretching | `mindfulness` | Entirely absent |
| Generic fasting | `fasting` | No entry for users who just want to track any fast without named protocol |
| Calorie tracking | `nutrition` | May be intentional to avoid disordered-eating risk |

### Flexible schema — current state

The current `WellnessActivity` schema already correctly separates identity from target:

```ts
interface WellnessActivity {
  id: string;
  name: string;               // identity — should NOT include quantity
  shortName: string;          // short label — should NOT include quantity
  defaultTargetValue: number; // pre-fill value — user can override
  defaultMetricUnit: string;  // pre-fill unit — user can override
  // ... protocol, benefits, tags, etc.
}
```

The `buildActivity()` pipeline in `wellnessActivitiesCatalog.ts` supports arbitrary `defaultTargetValue` and `defaultMetricUnit` per activity. The `ActivityRow` in the wizard correctly separates the picked activity's identity (`activityId`, `activityType`) from the user-set target (`targetValue`, `unit`). When a wellness activity is picked, `defaultTargetValue` pre-fills `targetValue` and the user can override it.

**No schema changes required.** The fix is naming discipline in the catalog data only.

---

## 7. Proposed Implementation Phases

### Phase 18B — Fix Duration Discrepancy (small, targeted)

**Risk:** Very low. Only affects the fallback path; the Wizard is unaffected.

**Scope:** Audit `CreateChallengeScreen` (Admin Create) payload to confirm it also sends `durationDays` explicitly alongside `startDate`/`endDate`. If it doesn't, add it. Optionally, normalize the backend fallback formula to `Math.round(...) + 1` to match the client's inclusive formula.

**Files:** `src/features/Admin/Challenges/CreateChallengeScreen.tsx`, optionally `functions/src/challengeCreationBackend.ts` line 296.

---

### Phase 18C — Engine-Aware Challenge Detail (medium)

**Risk:** Medium. UI-only change, no backend or schema changes required.

**Scope:** Replace the single generic "How Points Work" card with three engine-aware variants. Add streak stats and collective progress display. Update leaderboard score label per engine type.

**Files:** `src/features/Challenges/ChallengeDetailScreen.tsx` only.

**Breakdown:**

1. **Streak block:** show `requiredConsecutiveDays` as goal, `currentStreak` from the membership doc. The current `useChallengeMembership` hook may need `currentStreak` + `longestStreak` added to its return shape, or these can be read from the already-fetched leaderboard data for the current user.

2. **Collective block:** show group cumulative progress (`cumulativeLoggedValue` summed across all leaderboard members) toward `groupCumulativeTarget`. Can be derived from the already-fetched leaderboard snapshot without a new query.

3. **"How Points Work" replacement — 3 variants:**
   - Competitive: current copy (proportional points per activity log)
   - Collective: "Your logs contribute to the group's shared progress toward [X] total [unit]. Hit the group target to complete the challenge."
   - Streak: "Log your daily target every consecutive day. Miss a day and your streak resets. Reach [N] consecutive days to complete the challenge."

4. **Leaderboard score label:**
   - competitive → `{score} pts`
   - streak → `{currentStreak} day streak`
   - collective → `{cumulativeLoggedValue} {unit}`

---

### Phase 18D — Wellness Catalog Refresh (low risk, no schema change)

**Risk:** Low. Catalog-only change. IDs preserved by keeping `shortName` unchanged.

**Scope:** Rename embedded-quantity `name` fields in `wellnessActivitiesCatalog.ts`. Add Steps, Walking distance, and Yoga entries. Re-seed Firestore (requires production write approval).

**Files:** `src/data/wellnessActivitiesCatalog.ts` only.

**Sequence:**
1. Rename 14 activities with embedded quantities to quantity-free `name` values (see table in §6). Keep `shortName` unchanged to preserve IDs.
2. Add `Daily Steps` under `habits` (`defaultTargetValue: 10000`, `defaultMetricUnit: 'steps'`).
3. Add `Walking` under `habits` (`defaultTargetValue: 5`, `defaultMetricUnit: 'km'`).
4. Add `Yoga` under `mindfulness` (`defaultTargetValue: 20`, `defaultMetricUnit: 'minutes'`).
5. Run `npm run seed:wellness-activities` — **production write, requires explicit approval**.

---

### Phase 18E — Manual Test Checklist

| # | Test | Pass criteria |
|---|---|---|
| 1 | Create 7-day streak challenge; join; open detail screen | `requiredConsecutiveDays: 7` and `currentStreak: 0` displayed |
| 2 | Log activity day 1 of streak challenge | Streak counter increments to 1 |
| 3 | Create collective with `groupCumulativeTarget: 500`; 2 members join and log | Group progress bar reflects combined logs |
| 4 | Inspect Firestore for a 7-day challenge (Aug 1–Aug 7) | `durationDays: 7` in challenge doc |
| 5 | Create streak with `requiredConsecutiveDays: 7` on a 7-day challenge | Should succeed — no backend error |
| 6 | Open wellness picker after Phase 18D | "Meditation" shows instead of "5-Min Meditation"; "Daily Steps" present |
| 7 | Create wellness challenge using Steps; log 8,000 steps | Challenge accepts log; scored proportionally toward 10,000 |
| 8 | Join challenge; check `participantCount` in Firestore | Confirm value (monitor for ARCH-1 double-write) |

---

## Summary of Findings

| ID | Severity | Description |
|---|---|---|
| GAP-1 | High | "How Points Work" copy is hardcoded to competitive/proportional — misleads collective and streak members |
| GAP-2 | High | Streak: `requiredConsecutiveDays` and `currentStreak` not displayed on the detail screen |
| GAP-3 | Medium | Collective: group progress toward `groupCumulativeTarget` not displayed |
| GAP-4 | Medium | Leaderboard score shown as `totalPoints` for all engine types — streak/collective have more meaningful primary metrics |
| GAP-5 | Medium | 14 wellness activity names embed quantity in the name string — conflicts with user-editable target |
| GAP-6 | Medium | Steps activity missing from wellness catalog |
| GAP-7 | Low | Duration mismatch (client +1 inclusive vs. backend round exclusive) in fallback path only — Wizard unaffected because it sends `durationDays` explicitly |
| GAP-8 | Low | Walking distance and Yoga absent from wellness catalog |
| ARCH-1 | Pre-existing | `joinChallenge` double-writes `participantCount` alongside the trigger (documented Phase 17G) |

---

## Files Audited (No Changes)

| File | Purpose |
|---|---|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Main audit target |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Duration formula, payload shape |
| `functions/src/challengeCreationBackend.ts` | Backend date resolution, streak validation |
| `src/data/wellnessActivitiesCatalog.ts` | Wellness activity catalog and naming |
| `src/hooks/useWellnessActivities.ts` | Query hook (read only) |
| `scripts/seedWellnessActivities.ts` | Seed script (read only) |
