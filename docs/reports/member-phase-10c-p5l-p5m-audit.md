# Phase 10C-P5L/P5M — Pre-Deploy Audit Report

Date: 2026-06-19  
Branch: fix/p0-pre-deploy-blockers  
Status: AUDIT COMPLETE — no code changes made  
Scope: Three issues identified in P5K smoke test (C-1, Issue 2, Issue 3)

---

## Issue 1 — Time-Bounded Challenge Completion Invisible (P5K C-1)

### Symptom
Users who complete all activities in a time-bounded challenge (one with an `endDate`) never see their membership move to `status: 'completed'`. Their history screen is empty. Profile Wins count is 0. The locked detail view is unreachable.

### Root Cause

**File**: `src/services/activityLogSessionService.ts`  
**Line 353** (inside `markChallengeCompleteIfNeeded`):

```ts
if (!endAt) {
  // only auto-complete open-ended challenges
  await updateDoc(membershipRef, { status: 'completed', ... });
}
```

The auto-completion path is guarded by `!endAt`. If the challenge has an `endDate`, `endAt` is set, and the guard prevents the status update. For time-bounded challenges, `membership.status` remains `'active'` forever, even after the user has completed all activities.

### Scope
All time-bounded challenges — i.e., any challenge where `endDate` is set. This is the majority of real-world challenges (e.g., "8-Hour Sleep Streak", "Squat + Pushup 50"). Open-ended challenges (no `endDate`) work correctly.

### Impact
- `useCompletedChallengesForUser` queries `where('status', '==', 'completed')` → returns nothing for time-bounded challenges
- `memberUserMetrics.ts` `completedChallengesCount` also counts only `status === 'completed'` → Profile Wins = 0
- `ChallengeDetailScreen` completed-view branch (`membership?.status === 'completed'`) never renders
- The completed challenges stay visible in the user's Ongoing section (P5I filter removes `status === 'completed'`, but these are still `'active'`)

### Proposed Fix Direction
Remove the `!endAt` guard or change it to: auto-complete when ALL activities are logged, regardless of whether the challenge has an `endDate`. A challenge can be time-bounded AND completable. The presence of `endDate` should not prevent completion status from being set.

---

## Issue 2 — "Challenge group does not match" Error

### Symptom
Users see an error ("Challenge group does not match") when attempting to log activities for specific challenges ("8-Hour Sleep Streak" — streak type, "Squat + Pushup 50" — collective type). The error occurs after tapping the Log button from the Collective/Streak challenge screen.

### Root Cause

**File**: `src/services/activityLogSessionService.ts:195`

```ts
if (!challenge.groupId || challenge.groupId !== input.groupId) {
  throw new Error('Challenge group does not match.');
}
```

`input.groupId` comes from the URL search params at the activity logging screen. The chain is:

```
ChallengesScreen (Ongoing card) 
  → handleJoinChallenge(challengeId, challengeType)   [line 132–138]
  → navigate(`/app/challenges/${challengeType}?challengeId=X&groupId=${effectiveGroupId}`)
```

`effectiveGroupId` is derived from the URL of ChallengesScreen:

```ts
const effectiveGroupId = useMemo(
  () => (groupId && myGroups.some((g) => g.id === groupId) ? groupId : undefined),
  [groupId, myGroups],
);
```

**The gap**: When the user arrives at `/app/challenges` without a `?groupId=` param in the URL, `effectiveGroupId` is `undefined`. The Ongoing card filter:

```ts
.filter((c) => !effectiveGroupId || c.groupId === effectiveGroupId)
```

passes ALL challenges when `effectiveGroupId` is `undefined` — including group-scoped challenges. But `handleJoinChallenge` then navigates to the challenge type screen with no `groupId` param. The log route constructed in StreakChallengeScreen/CollectiveChallengeScreen also carries no `groupId`, so `input.groupId` is `undefined` when logging is attempted. The validation at line 195 fails because `challenge.groupId` (set to the group the challenge belongs to) `!== undefined`.

### Why ChallengeDetailScreen doesn't have this problem

`ChallengeDetailScreen` has its own redirect guard (lines 89–105):
```ts
if (resolvedChallenge && challengeGroupId && groupId !== challengeGroupId) {
  navigate(`/app/challenge/${resolvedChallenge.id}?groupId=${challengeGroupId}`, { replace: true });
}
```
And the "Log Workout" button uses `normalizedGroupId = challengeGroupId ?? activeGroupId`, always passing the challenge's own `groupId`. So the path that goes through ChallengeDetailScreen is safe. Only the direct "Log" shortcut from the Ongoing card in ChallengesScreen is affected.

### Scope
Any group-scoped challenge (has `groupId` set) accessed from `/app/challenges` without an active group context (`?groupId=` in the URL). The named challenges — "8-Hour Sleep Streak" and "Squat + Pushup 50" — are group-scoped challenges that surface in Ongoing for users who are members of those groups but didn't navigate via a group context link.

### Proposed Fix Direction
In `handleJoinChallenge`, use `challenge.groupId` from the challenge data (available in `visibleChallenges` which includes the full challenge object) rather than `effectiveGroupId` from the URL. Alternatively, pass the challenge's own `groupId` from the Ongoing card data instead of relying on the URL context.

---

## Issue 3 — "0 Participants" on Some Challenges

### Symptom
Some challenges display "0 Participants" on their cards even though the creator is enrolled and other users may have joined.

### Root Cause

`participantCount` on a challenge document is maintained exclusively by Cloud Function triggers (`onChallengeMemberCreated`, `onChallengeMemberUpdated`, `onChallengeMemberDeleted`) defined in `functions/src/index.ts` and implemented in `functions/src/memberCounters.ts`.

**The challenge creation payload** (`functions/src/challengeCreationBackend.ts:310–328`) does NOT include a `participantCount: 0` field. The challenge document starts with no `participantCount` field. The trigger is expected to fire asynchronously when the creator's `challengeMembers` document is written (in the same transaction), adding 1.

There are three distinct cases that produce 0:

#### Case A — Cloud Functions not deployed (most likely for existing data)
`ACTIVE_MEMBER_STATUSES = new Set(['active', 'joined'])`. The trigger increments by 1 when a membership is created with `status: 'active'`. If Cloud Functions were not deployed when challenges were created (or if deployments were behind), the trigger never fired. The field remains missing and the client reads it as `item.participantCount ?? 0`.

#### Case B — Completion decrement with no re-enrollment
`onChallengeMemberUpdated` decrements when a membership transitions from an active status to any non-active status. `'completed'` is NOT in `ACTIVE_MEMBER_STATUSES`. So when any member completes a challenge (open-ended), `participantCount` decrements. If the creator completes and no one else joins, `participantCount` reaches 0.

#### Case C — P5B side effect (no longer written client-side)
P5B removed the client-side `participantCount` write from `joinChallenge`. This was correct (it avoided double-counting), but any challenge created or joined during a period when Cloud Functions were unavailable no longer has any path to update the count.

### Key Observation
The triggers are registered with `retry: true`, so transient failures are retried. The most likely explanation for production challenges showing 0 is that Cloud Functions were not deployed or not yet active when those challenges were created, and no backfill has run to correct the counts.

### Proposed Fix Direction
Add a `participantCount: 0` to the initial challenge document payload in `challengeCreationBackend.ts`. This ensures the field always exists and the first trigger increment works against a known baseline. Separately, a one-time backfill script should recount `participantCount` for all existing challenges by querying `challengeMembers where challengeId == X AND status in ['active', 'joined']`.

---

## Summary Table

| Issue | Root cause file | Root cause line | Impact | Fix type |
|-------|----------------|-----------------|--------|----------|
| 1 — Time-bounded completion | `activityLogSessionService.ts` | 353 (`!endAt` guard) | Critical — history empty, Wins = 0 for most users | Remove guard; auto-complete regardless of `endDate` |
| 2 — Group mismatch error | `ChallengesScreen.tsx handleJoinChallenge` | 136 (`effectiveGroupId` instead of `challenge.groupId`) | High — logging broken when accessed without group context | Pass `challenge.groupId` from card data, not URL |
| 3 — 0 Participants | `challengeCreationBackend.ts` (no init field) + `memberCounters.ts` (ACTIVE status excludes 'completed') | 310–328 | Medium — misleading display; no functional impact | Initialize `participantCount: 0`; backfill script |

---

## Files Read (Audit Only — No Changes Made)

| File | Purpose |
|------|---------|
| `src/services/activityLogSessionService.ts` | Traced `!endAt` guard (line 353) and group-match check (line 195) |
| `src/features/Challenges/ChallengesScreen.tsx` | Traced `handleJoinChallenge`, `effectiveGroupId`, `ongoingCards` filter |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Confirmed groupId redirect guard works correctly for this path |
| `src/services/challengeActivityFlow.ts` | Confirmed `groupId` propagation through activity log route construction |
| `functions/src/challengeCreationBackend.ts` | Confirmed `participantCount` not initialized in challenge payload |
| `functions/src/memberCounters.ts` | Confirmed `ACTIVE_MEMBER_STATUSES` excludes 'completed'; trigger delta logic |
| `functions/src/index.ts` | Confirmed triggers are registered with `retry: true` |

---

## Recommended Next Phases

1. **P5L — Fix time-bounded completion** (Critical): Remove `!endAt` guard in `activityLogSessionService.ts`. Add backfill script to set `status: 'completed'` for existing memberships where `activitiesCompleted >= totalActivities` on challenges with `endDate` in the past.

2. **P5M — Fix group-mismatch error** (High): In `ChallengesScreen.tsx` `handleJoinChallenge`, pass the challenge's own `groupId` (available via `visibleChallenges`) rather than `effectiveGroupId` from the URL.

3. **P5N — Fix participant count** (Medium): Initialize `participantCount: 0` in `challengeCreationBackend.ts`. Create a backfill script using Admin SDK to recount all challenges.

4. **P5O — Deploy**: firestore.rules (P5J privacy fix), functions (member counter triggers), and all client changes.
