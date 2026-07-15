# Phase 10C-P5I — Completed Challenge Experience

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all validation passing, not deployed

---

## Root Cause

Three gaps existed in the completed challenge experience:

1. **ChallengeDetailScreen**: When a user's `challengeMembers` document has `status: 'completed'`, the condition `!membership || membership.status !== 'active'` is true — so completed members were shown the **Join Challenge** button on revisit instead of a locked completed view.

2. **ChallengesScreen Ongoing section**: The `ongoingCards` memo included challenges where `membershipIndex.get(item.id) === 'completed'`, so completed-membership challenges could appear in the Ongoing list alongside active ones.

3. **Profile Wins button**: Navigated to `/app/challenges` (the general challenges hub) with no way to reach a history/completed section. There was no route or screen for completed challenge history.

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/challengeService.ts` | Added `getCompletedChallengesForUser(userId, maxResults)` — queries `challengeMembers` by `status == 'completed'`, fetches challenge docs via `allow get`, returns `UserActiveChallengeSummary[]` |
| `src/hooks/useChallenges.ts` | Added `useCompletedChallengesForUser(maxResults)` hook |
| `src/features/Challenges/CompletedChallengesScreen.tsx` | NEW — lists the user's completed challenges; navigates to `ChallengeDetailScreen` on tap; shows locked completion card with progress bar and percentage |
| `src/App.tsx` | Lazy import + `/app/challenges/history` route (no `RequireGroupRoute` — accessible without group context) |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Added `membership?.status === 'completed'` branch BEFORE the Join CTA branch; shows locked green "🏆 Challenge Completed" summary card + "View Results" leaderboard button; Leave Challenge guard changed from `active || completed` → `active` only |
| `src/features/Challenges/ChallengesScreen.tsx` | Added `.filter((item) => membershipIndex.get(item.id) !== 'completed')` before `.slice(0, 3)` in `ongoingCards` |
| `src/features/Profile/ProfileScreen.tsx` | Wins button navigates to `/app/challenges/history` |
| `scripts/testHomeChallengeFeeds.ts` | Added P5I guard section: 8 assertions |

---

## Fix Detail

### ChallengeDetailScreen — locked completed view

**Before:** `!membership || membership.status !== 'active'` was the first CTA check. A completed member (`status: 'completed'`) satisfies this condition (`!== 'active'` is true), so they were shown the **Join Challenge** button — wrong.

**After:** New branch inserted first:
```tsx
{membership?.status === 'completed' ? (
  <>
    <div className="rounded-xl bg-green-50 border border-green-200 p-4 text-center">
      <p className="text-sm font-bold text-green-700">🏆 Challenge Completed</p>
      <p className="text-xs text-green-600 mt-1">
        {membership.activitiesCompleted} of {membership.totalActivities} activities • {pct}%
      </p>
    </div>
    <button onClick={() => navigate(leaderboardPath)}>View Results</button>
  </>
) : !membership || membership.status !== 'active' ? (
  // Join CTA (unchanged)
```

Leave Challenge is now only shown for `status === 'active'` (not completed).

### ChallengesScreen — Ongoing exclusion

```ts
.filter((item) => membershipIndex.get(item.id) !== 'completed')
.slice(0, 3)
```

### getCompletedChallengesForUser — Firestore query path

Queries `challengeMembers` by `userId + status == 'completed'` (allowed by `allow read: if isAuthenticated()`). Fetches challenge documents individually via `getDoc` (uses `allow get` + `canReadChallenge`, safe for group members). Does not use `allow list` with `status: 'completed'` — that path would be denied by the `allow list` rule which restricts to `status == 'active'` challenges.

---

## Validation Output

```
npm run test:home-challenge-feeds        ✓ passed
npm run test:home-performance-guards     ✓ passed
npm run test:pilot-ux-polish-guards      ✓ passed
npm run test:scoring-guards              ✓ passed
npm run test:challenge-creation-backend  ✓ passed
npm run test:group-invite-backend        ✓ passed
npx tsc -b --pretty false               ✓ no errors
npm run build                            ✓ built in 3.45s
```

---

## Deploy Requirement

No. Client-side code only. No Firestore rule or index changes.

---

## Remaining Risk

- The `challengeMembers` rule (`allow read: if isAuthenticated()`) allows any authenticated user to read all memberships. This is a pre-existing product decision flagged in P5F; the completed challenges query depends on it and is scoped to the current user's UID by the `where('userId', '==', uid)` constraint. No new exposure.
- If a user's completed challenge document becomes inaccessible (e.g., they left the group), the `getCompletedChallengesForUser` method silently skips it in the try/catch — the challenge will not appear in the history list.
