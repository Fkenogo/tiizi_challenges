# Phase 10C-P3C Remaining Smoke-Test Blockers

Date: 2026-06-17  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all three blockers resolved, all validation passes

---

## Summary

This phase resolves the three remaining HIGH-priority smoke-test blockers identified after Phase 10C-P3B:

1. Multi-activity, time-bounded challenges disappear from Active Challenges after a single logging session
2. No clear destination for viewing completed challenges from Profile
3. Guard test suites needed updating to cover the new completion semantics, profile destination, and a P3B regression in testHomeChallengeFeeds

---

## Fix 1: Multi-Activity Challenge Premature Completion

### Root Cause

`src/services/activityLogSessionService.ts` computed `totalActivities` as `Math.max(1, configuredActivities, configuredExerciseIds, membership.totalActivities ?? 1)`.

For a challenge with 2 configured activities (e.g., "Modified Push-Up" and "Bear Crawl Hold"), `configuredActivities = 2`. When a user logs both activities in a single session:

```
nextCompleted = Math.min(0 + 2, 2) = 2
nextRate = Math.min(100, Math.round((2 / 2) * 100)) = 100
→ membershipUpdate.status = 'completed'
```

The membership document was written with `status: 'completed'`. Because `getActiveChallengesForUser` queries `challengeMembers where status == 'active'`, the challenge vanished from the user's Active Challenges rail and the Home Active stat dropped to 0.

This was wrong for any challenge with an `endDate` still in the future. For a 30-day challenge, logging both configured activity slots once in the first session is not the same as completing the 30-day commitment.

### The Fix

`endAt` (already computed from `challenge.endDate` at the top of the function) is `null` for open-ended challenges and a `Date` for time-bounded ones. The Firestore service already throws `'Challenge has already ended.'` if `endAt && nowDate > endAt`, so if we reach the completion logic, `endAt` is either null (no endDate) or a date in the future.

Guard the `status = 'completed'` write behind `!endAt`:

```ts
// Before
if (nextRate >= 100 && membership.status !== 'completed') {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = serverTimestamp();
}

// After
if (nextRate >= 100 && membership.status !== 'completed' && !endAt) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = serverTimestamp();
}
```

**Behaviour after fix:**
- Open-ended challenges (no `endDate`): auto-complete when all activity slots are logged once — correct for badge/one-time challenges.
- Time-bounded challenges (`endDate` present): `completionRate` and `activitiesCompleted` update normally for progress display, but `status` stays `'active'` throughout the challenge window. The challenge remains visible on the Active Challenges rail until the endDate, at which point a Cloud Functions cron or admin action can transition it.

### Files Changed

- `src/services/activityLogSessionService.ts` — added `&& !endAt` to the completion guard (line 321)

---

## Fix 2: Completed Challenges Destination

### Root Cause

`ProfileScreen` showed `wins` (= `userMetrics.completedChallengesCount`) as a static number in a non-interactive stat card. Users had no way to navigate from Profile to see their past challenges.

`/app/challenges` (BrowseChallengesScreen) already renders challenges with `membershipStatus === 'active' || membershipStatus === 'completed'` — it is the correct existing destination for challenge history. It just wasn't reachable from Profile.

### The Fix

Converted the "Wins" stat card (`<article>`) to a `<button>` that navigates to `/app/challenges`, making completed challenge history accessible in one tap from Profile.

```tsx
// Before
<article className="rounded-[20px] border border-slate-200 bg-white py-5 ...">
  <p ...>{wins}</p>
  <p ...>Wins</p>
</article>

// After
<button className="rounded-[20px] border border-slate-200 bg-white py-5 ..."
        onClick={() => navigate('/app/challenges')}>
  <p ...>{wins}</p>
  <p ...>Wins</p>
</button>
```

**Behaviour after fix:**
- Tapping "Wins" on Profile navigates to `/app/challenges` which shows all challenges the user has joined or completed.
- No new route or screen required.
- Home Active Challenges and Trending were already correct — both filtered to `status: 'active'` at the query and lifecycle levels.

### Files Changed

- `src/features/Profile/ProfileScreen.tsx` — Wins stat card converted to tappable button navigating to `/app/challenges`

---

## Fix 3: Guard Test Corrections and P3C Guards

### Regression: testHomeChallengeFeeds P3B copy change

`scripts/testHomeChallengeFeeds.ts` line 54 asserted `"No active challenges yet"` — text that was updated to `"Get Started"` in P3B. This test would have failed on the next CI run.

```ts
// Before (stale)
assert.match(homeScreen, /No active challenges yet/, '...');

// After (updated)
assert.match(homeScreen, /Get Started/, 'Home should show an action-oriented no-active-challenges empty state');
```

### New P3C Guards in testPilotUxPolishGuards

Three new assertions added:

1. **Completion semantics** — `activityLogSessionService` must contain `!endAt` in the completion guard, and must NOT have the unconstrained `nextRate >= 100 && membership.status !== 'completed')` pattern without the endDate check.

2. **Completed challenges destination** — `ProfileScreen` must reference `navigate('/app/challenges')` so there is a tappable path to challenge history from Profile.

3. **Home active filtering** — `useHomeScreen.ts` must contain `statuses: ['active']` or equivalent active-status filtering so completed challenge memberships are never surfaced on the Home Active rail.

### Files Changed

- `scripts/testHomeChallengeFeeds.ts` — updated stale copy assertion
- `scripts/testPilotUxPolishGuards.ts` — added P3C completion, destination, and Home filtering guards

---

## Validation Results

```
npm run test:home-challenge-feeds       → home challenge feed guards passed
npm run test:pilot-ux-polish-guards     → pilot UX polish guards passed
npm run test:home-performance-guards    → home performance guards passed
npm run test:challenge-creation-backend → challenge creation backend tests passed
npm run test:group-invite-backend       → Group invite backend security tests passed
npx tsc -b --pretty false               → (no errors)
npm run build                           → ✓ built in 5.38s
```

---

## Files Changed (Complete List)

| File | Change |
|------|--------|
| `src/services/activityLogSessionService.ts` | Guard `status='completed'` write behind `!endAt` |
| `src/features/Profile/ProfileScreen.tsx` | Wins stat card → tappable button → `/app/challenges` |
| `scripts/testHomeChallengeFeeds.ts` | Update stale "No active challenges yet" assertion |
| `scripts/testPilotUxPolishGuards.ts` | Add P3C completion semantics, destination, and filtering guards |

---

## Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Time-bounded challenges never auto-complete client-side | Low | Expected. Cloud Functions cron or admin action transitions them. If no cron exists, completed challenges stay `active` in the membership until the next batch or manual update — but they will no longer appear erroneously in the Active rail once endDate passes (isChallengeOngoing handles expiry). |
| completionRate hitting 100% while status stays 'active' | Low | Progress display shows 100% for the current session window. On subsequent sessions, nextCompleted stays capped at totalActivities (no-op write). Firestore rules allow `activitiesCompleted >= existingActivitiesCompleted` — no-op is valid. |
| Wins stat card navigation takes user away from Profile | Informational | Expected UX: user taps Wins, lands on Challenges, uses back to return. No deep-link loop. |

---

## Deployment Notes

- No Firestore rules changes.
- No index changes.
- No Cloud Functions changes.
- Do not deploy until P3C is reviewed and approved.
