# Phase 10C-P5L — Completion Detection + Group Context Fix

Date: 2026-06-19  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all validation passing, not deployed

---

## Fix 1 — Time-Bounded Challenge Completion Invisible

### Root Cause

All three client-side activity logging services (`activityLogSessionService.ts`, `workoutService.ts`, `wellnessLogService.ts`) had a `!endAt` guard on the auto-completion branch:

```ts
// activityLogSessionService.ts (before)
if (nextRate >= 100 && membership.status !== 'completed' && !endAt) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = serverTimestamp();
}

// workoutService.ts (before)
if (nextRate >= 100 && membership.status !== 'completed' && !endAt) { ... }

// wellnessLogService.ts (before)
if (completionRate >= 100 && membership.status !== 'completed' && !endAt) { ... }
```

`endAt` is set to `new Date(challenge.endDate)` when an `endDate` exists. For time-bounded challenges — which represent the majority of real-world challenges — `endAt` is always truthy, so the condition was always false. `membership.status` was permanently stuck at `'active'` even after a user completed every activity.

The guard was originally added to avoid what the comment called "premature completion" on multi-day challenges. However, `nextRate >= 100` / `completionRate >= 100` already guards correctly: completion only fires when `activitiesCompleted >= totalActivities`. The `!endAt` guard was redundant and wrong — a challenge being time-bounded does not mean the user cannot finish it.

### Files Changed

| File | Change |
|------|--------|
| `src/services/activityLogSessionService.ts` | Removed `&& !endAt` from the `nextRate >= 100` completion condition; removed stale comment |
| `src/services/workoutService.ts` | Same removal and comment removal |
| `src/services/wellnessLogService.ts` | Same removal and comment removal (`completionRate >= 100` variant) |
| `scripts/testHomeChallengeFeeds.ts` | P5L guard section — 8 assertions (see Tests Added) |
| `scripts/testPilotUxPolishGuards.ts` | P3C section updated: `!endAt` assertions inverted to assert the guard is absent |
| `scripts/testScoringGuards.ts` | P4I section updated: all three services now verified to have no `!endAt`; canonical pattern updated |

### Tests Added

**P5L section in `scripts/testHomeChallengeFeeds.ts`** (assertions 1–4 cover Fix 1):

1. `activityLogSessionService` must not contain `&& !endAt` — verifies the guard is gone
2. Completion condition still reads `nextRate >= 100 && membership.status !== 'completed'` — verifies the threshold still exists
3. `completedAt` timestamp is still written alongside `status: 'completed'` — verifies no regression on completion metadata
4. Date boundary guard `endAt && nowDate > endAt` is still present — verifies logging is still blocked after end date

**Stale guards updated** (these previously asserted `!endAt` must exist — now assert it must not):
- `testPilotUxPolishGuards.ts` P3C: two assertions inverted to match the P5L intent
- `testScoringGuards.ts` P4I: three service assertions + canonical pattern updated

### Validation Commands Run

```
npm run test:home-challenge-feeds        ✓ passed
npm run test:home-performance-guards     ✓ passed
npm run test:pilot-ux-polish-guards      ✓ passed
npm run test:scoring-guards              ✓ passed
npm run test:challenge-creation-backend  ✓ passed
npm run test:group-invite-backend        ✓ passed
npx tsc -b --pretty false               ✓ no errors
npm run build                            ✓ built in 3.12s
```

### Deploy Requirements

**Client bundle only — no Firestore rules or Cloud Functions changes required.** The three modified files are client-side services compiled into the web bundle. The fix takes effect as soon as the updated bundle is deployed. No migration is required for new activity sessions going forward.

### Remaining Risks

- **Historical time-bounded completions not backfilled**: Any membership where the user logged all activities before this fix still has `status: 'active'`. Those records will not appear in the Completed Challenges history screen or count toward Profile Wins. A separate backfill script should query `challengeMembers where completionRate == 100 AND status == 'active'` and update them to `status: 'completed'`. This is safe to run after deploy.
- **Multi-activity daily challenges**: If a challenge is configured with 2 activities (e.g., squats + pushups as a daily pair) but `totalActivities` is set to 2 (not `2 × number_of_days`), a user who logs both on day 1 reaches `completionRate = 100%` and is immediately marked complete. The `!endAt` guard was masking this by preventing completion for time-bounded challenges entirely. The root cause is incorrect `totalActivities` data — an admin tool or creation form fix is the correct resolution, not the `!endAt` guard.

---

## Fix 2 — "Challenge group does not match" Error

### Root Cause

In `src/features/Challenges/ChallengesScreen.tsx`, the Ongoing section's Log/Join button was constructed using `effectiveGroupId` derived from the `?groupId=` URL param:

```ts
// Before — Log button handler
const qs = new URLSearchParams({ challengeId: item.id });
if (effectiveGroupId) qs.set('groupId', effectiveGroupId);  // ← wrong source
navigate(`/app/workouts/select-activity?${qs.toString()}`);

// Before — handleJoinChallenge
const handleJoinChallenge = async (challengeId: string, challengeType: ChallengeCardType) => {
  const query = new URLSearchParams({ challengeId });
  if (effectiveGroupId) query.set('groupId', effectiveGroupId);  // ← wrong source
  navigate(`/app/challenges/${challengeType}?${query.toString()}`);
};
```

`effectiveGroupId` is `undefined` when the user navigates to `/app/challenges` without a `?groupId=` URL param. The Ongoing card filter (`!effectiveGroupId || challenge.groupId === effectiveGroupId`) still includes group-scoped challenges when `effectiveGroupId` is undefined. The result: the challenge card renders in Ongoing, but the Log button builds a URL with no `groupId`. When the activity is logged, `activityLogSessionService.ts:195` throws:

```ts
if (!challenge.groupId || challenge.groupId !== input.groupId) {
  throw new Error('Challenge group does not match.');
}
```

`challenge.groupId` is the group the challenge belongs to; `input.groupId` (from the URL-param-less log flow) is `undefined`. They do not match.

The path through `ChallengeDetailScreen` was not affected because it has its own redirect guard that corrects the `groupId` before the Log Workout button renders. Only the direct Log shortcut from the Ongoing card was broken.

The reported challenges — "8-Hour Sleep Streak" (streak type) and "Squat + Pushup 50" (collective type) — are group-scoped challenges whose members accessed them from `/app/challenges` without a group URL context.

### Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengesScreen.tsx` | Added `groupId: item.groupId ?? undefined` to `ongoingCards` mapped object; `handleJoinChallenge` signature extended to `(challengeId, challengeType, groupId?)` and uses `groupId` instead of `effectiveGroupId`; Log button and Join call both pass `item.groupId` |

**Before / after for the Log button handler:**

```ts
// Before
if (effectiveGroupId) qs.set('groupId', effectiveGroupId);

// After
if (item.groupId) qs.set('groupId', item.groupId);
```

**Before / after for `handleJoinChallenge`:**

```ts
// Before
const handleJoinChallenge = async (challengeId: string, challengeType: ChallengeCardType) => {
  const query = new URLSearchParams({ challengeId });
  if (effectiveGroupId) query.set('groupId', effectiveGroupId);
  navigate(`/app/challenges/${challengeType}?${query.toString()}`);
};

// After
const handleJoinChallenge = async (challengeId: string, challengeType: ChallengeCardType, groupId?: string) => {
  const query = new URLSearchParams({ challengeId });
  if (groupId) query.set('groupId', groupId);
  navigate(`/app/challenges/${challengeType}?${query.toString()}`);
};
```

**Call site:**

```ts
// Before
handleJoinChallenge(item.id, item.challengeType);

// After
handleJoinChallenge(item.id, item.challengeType, item.groupId);
```

### Tests Added

**P5L section in `scripts/testHomeChallengeFeeds.ts`** (assertions 5–8 cover Fix 2):

5. `handleJoinChallenge` signature contains `groupId?:` parameter
6. The Log button block does not reference `effectiveGroupId` — asserts the wrong source was removed
7. `handleJoinChallenge` call site passes `item.groupId`
8. `ongoingCards` mapped objects include `groupId` from the source challenge

### Validation Commands Run

```
npm run test:home-challenge-feeds        ✓ passed
npm run test:home-performance-guards     ✓ passed
npm run test:pilot-ux-polish-guards      ✓ passed
npm run test:scoring-guards              ✓ passed
npm run test:challenge-creation-backend  ✓ passed
npm run test:group-invite-backend        ✓ passed
npx tsc -b --pretty false               ✓ no errors
npm run build                            ✓ built in 3.12s
```

### Deploy Requirements

**Client bundle only — no Firestore rules or Cloud Functions changes required.** The modified file is a client-side React screen compiled into the web bundle. The fix takes effect immediately on deploy.

### Remaining Risks

- None identified for this fix. `item.groupId` is sourced directly from the challenge document returned by `useAccessibleChallengesPage`, which fetches from Firestore. If a challenge has no `groupId` (open-group or global challenge), `item.groupId` is `undefined` and no `groupId` param is added — the same fallback behavior as before.
- `effectiveGroupId` is still used for the card-tap navigation to `ChallengeDetailScreen` (line 287 in the unchanged portion of `ChallengesScreen.tsx`). This is intentional — `ChallengeDetailScreen` has its own redirect guard and handles the mismatch transparently. No behavior change.
