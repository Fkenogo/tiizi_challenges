# Phase 10C-P5G — Date Safety + Log Gating Fix

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all validation passing, not deployed

---

## Root Cause

Three screens used `Date.parse()` / `new Date(...).getTime()` directly on challenge date strings. For missing or malformed dates these return `NaN`, which propagates silently:

- `ChallengeDetailScreen`: `hasStarted`/`hasEnded` derived from `Date.parse(resolvedChallenge.startDate)`. `now >= NaN` is `false` — a challenge with a missing `startDate` is treated as "not yet started" and the Log Workout CTA is permanently hidden.
- `GroupDetailScreen.activeProgress`: raw `Date.parse` on both dates — `totalDays`, `daysRemaining`, `percent` all become `NaN`/`Infinity`, rendering as visible garbage in the Active Challenges card.
- `ChallengeCompletedScreen.totalDays`: `new Date(challenge.startDate).getTime()` → `NaN`. `Math.max(1, NaN + 1)` collapses to `1`, making `completionPct` based on `uniqueDays / 1` which can exceed 100% and award false Gold Tier.

Three in-challenge screens (Collective, Competitive, Streak) had no `hasStarted` check on the Log button, allowing users to navigate to activity logging for challenges that had not yet started. The workout service applies no server-side date enforcement, so early workouts could be written to Firestore.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Added `parseChallengeStartMs`/`parseChallengeEndMs` import; replaced raw `Date.parse` in `summary` memo and `hasStarted`/`hasEnded` derivation; end-date fallback is `Infinity` so a missing end date never falsely triggers `hasEnded` |
| `src/features/Groups/GroupDetailScreen.tsx` | Added `parseChallengeEndMs` to existing lifecycle import; replaced raw `Date.parse` in `activeProgress` memo |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Added `parseChallengeStartMs`/`parseChallengeEndMs` import; replaced raw `new Date` in `totalDays` memo; returns `1` if either date is null, capping `completionPct` correctly |
| `src/features/Challenges/CollectiveChallengeScreen.tsx` | Added `parseChallengeStartMs` import; derived `hasStarted`; FAB hidden when `!hasStarted` |
| `src/features/Challenges/CompetitiveChallengeScreen.tsx` | Same pattern — Log button hidden when `!hasStarted` |
| `src/features/Challenges/StreakChallengeScreen.tsx` | Same pattern — Log button hidden when `!hasStarted` |
| `scripts/testHomeChallengeFeeds.ts` | Added P5G guard section: 10 assertions covering no raw `Date.parse`, correct lifecycle helper usage, and `hasStarted` gating on all three logging screens |

---

## Fix Applied

### Date parsing (ChallengeDetailScreen)

**Before:**
```ts
const challengeStartsAt = resolvedChallenge ? Date.parse(resolvedChallenge.startDate) : 0;
const challengeEndsAt = resolvedChallenge ? Date.parse(resolvedChallenge.endDate) : 0;
```

**After:**
```ts
const challengeStartsAt = parseChallengeStartMs(resolvedChallenge?.startDate) ?? 0;
const challengeEndsAt = parseChallengeEndMs(resolvedChallenge?.endDate) ?? Infinity;
```

### Log button gating (all three in-challenge screens)

**Before:** Unconditional `onClick={() => navigate(logWorkoutRoute)}`

**After:**
```tsx
const hasStarted = (parseChallengeStartMs(challenge?.startDate) ?? 0) <= Date.now();
// ...
{hasStarted && (
  <div className="fixed bottom-[92px] ...">
    <button ...>+ LOG ...</button>
  </div>
)}
```

---

## Validation Output

```
npm run test:home-challenge-feeds        ✓ passed
npm run test:pilot-ux-polish-guards      ✓ passed
npm run test:home-performance-guards     ✓ passed
npm run test:scoring-guards              ✓ passed
npm run test:challenge-creation-backend  ✓ passed
npm run test:group-invite-backend        ✓ passed
npx tsc -b --pretty false               ✓ no errors
npm run build                            ✓ built in 2.92s
```

---

## Remaining Risk

**`CompetitiveChallengeScreen.timelineMeta`** still uses `new Date(challenge.endDate)` for display-only `daysLeft`/`endsLabel` (display metadata, not gating logic). It has a safe 14-day fallback when `endDate` is absent, so there is no NaN risk and no incorrect gating — just an inaccurate fallback shown in the timeline label. This is a cosmetic issue, safe to defer.

---

## Deploy Requirement

No. Rules, indexes, and data unchanged. Client-side code only.
