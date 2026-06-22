# Phase 10C-P5A — Challenge Lifecycle Display Alignment

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — lifecycle filtering applied, guards added, all validation passes

---

## Problem

P5 audit identified three categories of lifecycle display bugs across member-facing challenge screens:

1. **Expired challenges shown as Ongoing/Browse** — Firestore returns all `status: 'active'` challenges regardless of `endDate`. `ChallengesScreen` Ongoing section and both Browse sections had no date filter, so challenges past their `endDate` appeared as active.

2. **Expired challenges shown as Upcoming in GroupDetailScreen** — `upcomingChallenge` was selected with `!isChallengeOngoing(...)`, which matches both future (not-yet-started) and past (expired) challenges. An expired challenge could silently occupy the Upcoming slot.

3. **"NaN Days Left" for missing `endDate`** — `ChallengesScreen` and `BrowseChallengesScreen` computed days remaining via `new Date(item.endDate).getTime()`. If `endDate` is absent or invalid, this produces `NaN` and the card renders "NaN Days Left".

---

## Fixes

### 1. `src/features/Challenges/ChallengesScreen.tsx`

**Added import**: `isChallengeExpired, parseChallengeEndMs, parseChallengeStartMs` from `challengeLifecycle`.

**`visibleChallenges`** — now excludes expired challenges:
```ts
challengeData.filter((challenge) =>
  challenge.status === 'active'
  && !isChallengeExpired(challenge)
  && (!effectiveGroupId || challenge.groupId === effectiveGroupId),
)
```

**`browseChallenges`** — also excludes expired:
```ts
.filter((challenge) => !isChallengeExpired(challenge))
```
Added before the groupId and visibility filters.

**`ongoingCards` and `browseCards`** — replaced `new Date(item.endDate)` / `new Date(item.startDate)` with lifecycle helpers:
```ts
const nowMs = now.getTime();
const startMs = parseChallengeStartMs(item.startDate) ?? nowMs;
const endMs = parseChallengeEndMs(item.endDate) ?? nowMs;
const hasStarted = localDateKey(now) >= localDateKey(new Date(startMs));
const days = hasStarted
  ? Math.max(0, Math.ceil((endMs - nowMs) / msPerDay))
  : Math.max(0, Math.ceil((startMs - nowMs) / msPerDay));
```

`parseChallengeEndMs` returns `null` for missing/invalid dates; the `?? nowMs` fallback produces `0 Days Left` rather than `NaN Days Left`.

**Button CTA logic**: unchanged — `hasStarted` already gates "Log Workout" vs "View" correctly. With expired challenges now filtered out, only ongoing (started, not expired) and upcoming (not started) challenges reach `ongoingCards`. The existing `hasStarted` check handles the upcoming case.

### 2. `src/features/Challenges/BrowseChallengesScreen.tsx`

**Added import**: `isChallengeExpired, parseChallengeEndMs, parseChallengeStartMs`.

**`publicBrowseChallenges`** — excludes expired:
```ts
.filter((challenge) => !isChallengeExpired(challenge))
```

**Inline days computation in render** — same `parseChallengeStartMs`/`parseChallengeEndMs` pattern replacing raw `new Date()` calls.

### 3. `src/features/Groups/GroupDetailScreen.tsx`

**Added import**: `parseChallengeStartMs` (alongside existing `isChallengeOngoing`).

**`upcomingChallenge`** — now only picks challenges whose `startDate` is in the future:
```ts
const nowMs = Date.now();
const upcomingChallenge = groupChallenges.find((challenge) => {
  const startMs = parseChallengeStartMs(challenge.startDate);
  return startMs !== null && startMs > nowMs && challenge.id !== activeChallenge?.id;
}) ?? null;
```

Previously `!isChallengeOngoing(challenge)` matched both upcoming and expired challenges. The new check requires a valid `startDate` strictly in the future.

**"Starts in X days" label** — replaced `Date.parse(upcomingChallenge.startDate)` with `parseChallengeStartMs(upcomingChallenge.startDate) ?? nowMs`, eliminating the NaN path for missing startDates.

---

## Guard Tests Added — `scripts/testHomeChallengeFeeds.ts`

8 new assertions in a `P5A lifecycle screen filtering guards` section:

| # | Guard |
|---|-------|
| 1 | `ChallengesScreen` uses `isChallengeExpired` in Ongoing and Browse filters |
| 2 | `BrowseChallengesScreen` uses `isChallengeExpired` in browse filter |
| 3 | `ChallengesScreen` log CTA is gated by `hasStarted` (upcoming → View only) |
| 4 | `ChallengesScreen` does not use `new Date(item.endDate)` (NaN guard) |
| 5 | `BrowseChallengesScreen` does not use `new Date(item.endDate)` (NaN guard) |
| 6 | Both screens use `parseChallengeEndMs` for safe days calculation |
| 7 | `GroupDetailScreen` uses `parseChallengeStartMs` + `startMs > nowMs` for upcoming filter |
| 8 | `isChallengeExpired` / `isChallengeOngoing` unit tests for expired, future, wellness, completed |

---

## Lifecycle Behavior After Fix

| Challenge state | Ongoing section | Browse section | Group upcoming |
|----------------|-----------------|----------------|---------------|
| `active`, started, not expired | ✓ included | ✓ included | N/A |
| `active`, not yet started (upcoming) | ✓ included, "View" CTA only | ✓ included | ✓ shown |
| `active`, expired (`endDate` past) | ✗ excluded | ✗ excluded | ✗ excluded |
| `completed` | ✗ excluded (status filter) | ✗ excluded | N/A |
| `active`, missing `endDate` | ✓ included, "0 Days Left" | ✓ included, "0 Days Left" | N/A |

---

## Validation Results

```
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npm run test:pilot-ux-polish-guards  → pilot UX polish guards passed
npm run test:scoring-guards          → scoring guards passed
npx tsc -b --pretty false            → (no errors)
npm run build                        → ✓ built in 3.21s
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengesScreen.tsx` | Added `isChallengeExpired` filter to Ongoing and Browse; replaced raw Date with lifecycle helpers |
| `src/features/Challenges/BrowseChallengesScreen.tsx` | Added `isChallengeExpired` filter; replaced raw Date with lifecycle helpers |
| `src/features/Groups/GroupDetailScreen.tsx` | Fixed `upcomingChallenge` to only match future-start challenges; safe startDate label |
| `scripts/testHomeChallengeFeeds.ts` | Added P5A section with 8 new guard assertions |

---

## Deployment Notes

No Firestore, rules, or index changes. Purely client-side filtering. Safe to deploy with the rest of the branch.
