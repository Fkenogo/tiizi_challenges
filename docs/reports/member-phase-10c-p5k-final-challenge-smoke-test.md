# Phase 10C-P5K — Final Challenge System Smoke Test

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: AUDIT COMPLETE — 9 findings; 2 critical, 1 high, 4 medium, 1 low, 1 cosmetic

---

## Executive Summary

The challenge lifecycle is functional end-to-end for **public groups with open-ended challenges**. Two critical gaps affect the majority of real users:

1. **Time-bounded challenge completion is invisible to the system.** The `membership.status` field is only set to `'completed'` for open-ended challenges (no `endDate`). For the typical challenge with an `endDate`, membership stays at `'active'` forever after it ends. This makes the Profile Wins count always 0, the history screen always empty, and the locked completed detail view unreachable for most users.

2. **Private group members cannot see their Ongoing challenges.** The `getUserAccessibleChallengesPage` query (`where('groupId', 'in', chunk)`) is denied by the Firestore `allow list` rule for private groups, which requires `visibility == 'public' || groupVisibility == 'public'`. The query is not wrapped in try/catch, so the error propagates and the Ongoing section renders empty.

Both issues require code changes. Neither is a security regression.

The P5J rules change (`challengeMembers` privacy) and the P5C rules change (Browse Challenges) are the outstanding deploy requirements.

---

## Audit Trail: Code Paths Verified

### Area 1 — Challenge Creation ✓ MOSTLY OK

**Creator auto-enrollment**: `challengeCreationBackend.ts` writes both the challenge doc and a `challengeMembers` doc (`status: 'active'`) in the same Firestore transaction. Cloud Function trigger `onChallengeMemberCreatedUpdateMemberSummaries` fires on the membership create and processes member data. ✓

**participantCount increment**: Cloud Function `updateParticipantCountForCreate` fires on `challengeMembers/{membershipId}` create. Increments `challenges/{id}.participantCount` by 1 when `isActiveMemberStatus(data.status)` is true. `status: 'active'` is in `ACTIVE_MEMBER_STATUSES = ['active', 'joined']`. ✓

**challenge document fields**: `challengePayload` sets `name`, `description`, `groupId`, `exerciseIds`, `challengeType`, `coverImageUrl`, `activities`, `donation`, `startDate`, `endDate`, `createdBy`, `status`, `createdAt`, `groupVisibility`, `visibility`, `moderationStatus`. No `participantCount` at creation — treated as 0 by all readers via `?? 0`. ✓

**visibility / groupVisibility**: Both set to `normalizeGroupVisibility(group)` — the group's own `visibility` field, normalized to `'public' | 'private'`. **Both fields always have the same value at creation.** See Finding M-1 below.

**discovery after creation**: Challenge with `status: 'active'` and `visibility/groupVisibility: 'public'` appears in Trending (after `isDiscoverableTrendingChallenge` filter), Browse, and the ChallengesScreen public section within cache TTL (2–5 min). ✓

---

### Area 2 — Challenge Discovery

**Home Trending** ✓  
Two queries: `visibility == 'public'` and `groupVisibility == 'public'`. Merged and deduped by ID. Filtered by `isDiscoverableTrendingChallenge`, sorted by `participantCount`. Capped at 5. Correct — but since `visibility === groupVisibility` always, both queries return identical results and the dedup always collapses them. See Finding M-1.

**Browse Challenges** ✓  
`useVisibleChallengesPage → getVisibleChallengesForUserPage`. Runs two public visibility queries (field-only, safe for `allow list`). Member-group query wrapped in try/catch — correctly handles the `allow list` rule enforcement. Public challenges with `visibility/groupVisibility == 'public'` appear. Expired challenges excluded by `isChallengeExpired`. ✓

**ChallengesScreen Ongoing** 🚨  
`useAccessibleChallengesPage → getUserAccessibleChallengesPage`. Reads user's group IDs from `groupMembers`, then queries `challenges` with `where('groupId', 'in', chunk)` — **no visibility constraint**. The `allow list` rule requires `visibility == 'public' || groupVisibility == 'public'`. For any private group with at least one active challenge, this query is denied (Firestore denies the entire query if any document in the result set fails rule evaluation). The query has **no try/catch** — error propagates, React Query retries 3× then enters error state, Ongoing section renders empty. See Finding H-1.

**ChallengesScreen Browse section** ✓  
`useVisibleChallengesPage` (same as Browse Challenges — field-only queries, safe). Filters out own-group challenges (`!myGroupIds.has(challenge.groupId)`), includes only public challenges.

---

### Area 3 — Challenge Joining ✓ MOSTLY OK

**Flow**: `challengeService.joinChallenge(userId, challengeId)` →
1. Reads challenge doc; verifies it exists and has a `groupId`
2. Reads `groupMembers/{groupId}_{userId}`; verifies `status` is active
3. Reads `challengeMembers/{challengeId}_{userId}`; if `status: 'active'` already, returns early
4. Batch-writes `challengeMembers` doc + increments `users.stats.totalChallenges`

**Duplicate join prevention**: Only prevents re-join when `existing.status === 'active'`. If a user's membership is `'completed'` or `'abandoned'`, the batch-set with `merge: true` overwrites all fields back to zero. Re-enrollment after completion is permitted — **may or may not be intentional** (no product spec). See Finding M-3.

**participantCount**: Cloud Function trigger increments on create. Does NOT double-count — if the membership doc already exists (prior join) and the batch-set is a re-enrollment, it fires an update trigger, not a create trigger; `updateParticipantCountForUpdate` computes the transition delta. ✓

**Firestore rule**: `isValidChallengeMemberCreate` requires `challengeId`, `userId`, `groupId`, `joinedAt`, `status`, zeroed numeric fields. Requires `challenge.data.status == 'active'` and `isGroupMember(challenge.data.groupId)`. Client join goes through the rule; Creator join is server-side (Admin SDK bypasses rules). ✓

---

### Area 4 — Challenge Logging ✓ MOSTLY OK

**Pre-start gating**: `startAt && nowDate < startAt → throw Error('Challenge has not started yet.')`. Also gated at UI level by `hasStarted` in Collective/Competitive/Streak screens (P5G fix). ✓

**Post-end gating**: `endAt && nowDate > endAt → throw Error('Challenge has already ended.')`. Also gated at UI level by `canLogWorkout = !!membership && status==='active' && hasStarted && !hasEnded`. ✓

**Progress updates**: `activitiesCompleted`, `totalPoints`, `lastActivityAt`, `completionRate` all computed and merged into `challengeMembers`. Rules (`isSafeChallengeProgressUpdate`) enforce monotonic increase, total-points cap, and non-negative values. ✓

**Auto-completion**: `if (nextRate >= 100 && membership.status !== 'completed' && !endAt)` — **only triggers for open-ended challenges**. For time-bounded challenges, this code path is never taken. See Finding C-1.

---

### Area 5 — Leaderboards ✓ OK

**Data source**: `challengeLeaderboards` collection — written by Cloud Functions (`memberActivitySummaries.ts`), NOT by client code. Separate from `challengeMembers`. ✓

**Access rule**: `allow read: if canReadGroupSummary(resource.data)` → `isGroupMember(data.groupId) || canAccessAdmin()`. This uses `get()`/`exists()` calls (1–3 per document). For list queries, this is called per document; with a page size of 20, that's up to 60 rule-level reads. Performance concern, not a correctness issue. ✓

**ChallengeDetailScreen inline leaderboard**: Lines 64–72 aggregate `activityLogs` client-side (top-5 by summed score). Uses the `workouts` or `wellnessLogs` collection, not `challengeLeaderboards`. Scores may diverge from the official leaderboard because the scoring formula differs (session-based vs. Cloud Function aggregation). See Finding L-1.

**ChallengeLeaderboardScreen**: Uses `useGroupChallengeLeaderboard` → `getChallengeLeaderboard` → `challengeLeaderboards`. Correct. ✓

---

### Area 6 — Challenge Completion 🚨 CRITICAL

**ChallengeCompletedScreen (post-log celebration)**: Reached when `WorkoutLoggedScreen` detects completion (unclear trigger — not audited fully). Screen reads workouts for the challenge and computes `completionPct = uniqueDays / totalDays`. Does NOT read `membership.status`. Functions independently of `membership.status`. ✓

**membership.status transition**: ONLY set to `'completed'` for open-ended challenges (`!endAt`). Line 353 in `activityLogSessionService.ts`:
```ts
if (nextRate >= 100 && membership.status !== 'completed' && !endAt) {
  membershipUpdate.status = 'completed';
  membershipUpdate.completedAt = serverTimestamp();
}
```
For time-bounded challenges (the common case), status stays `'active'` after the challenge ends. See Finding C-1.

**Locked completed view in ChallengeDetailScreen (P5I)**: Only triggers when `membership?.status === 'completed'`. For time-bounded challenge completions, this condition is never true. Time-bounded ended-challenge members see the disabled "Completed" button (from the `hasEnded` branch) instead. See Finding M-2.

**Removal from Ongoing**: `visibleChallenges` in ChallengesScreen filters `!isChallengeExpired(challenge)` and `challenge.status === 'active'`. Completed-membership filter (P5I fix) also applied. Time-bounded challenges with `endDate` in the past are excluded by `isChallengeExpired`. ✓

---

### Area 7 — Challenge History 🚨 CRITICAL

**CompletedChallengesScreen**: Queries `challengeMembers where userId == uid AND status == 'completed'`. For time-bounded challenge participants (majority of users), this returns 0 results — history page is always empty. See Finding C-1.

**Profile Wins count**: `userMetrics?.completedChallengesCount` — computed by `memberUserMetrics.ts` Cloud Function counting `challengeMembers` docs where `isCompletedMembership(status) === true` (`status === 'completed'`). For time-bounded challenge participants, this is always 0. See Finding C-1.

**Wins route**: Navigates to `/app/challenges/history`. Route exists, not behind `RequireGroupRoute`. ✓

**Revisiting completed challenges**: For open-ended completions, locked view in `ChallengeDetailScreen` shows correctly. For time-bounded completions, only the disabled "Completed" button shows — no View Results CTA. See Finding M-2.

---

### Area 8 — Security ✓ OK (post-P5J)

**`challengeMembers`**: `allow get` (self ∥ isGroupMember ∥ moderator) + `allow list` (self ∥ moderator). No more `isAuthenticated()` alone. ✓ (P5J)

**`challenges allow get`**: `canReadChallenge` (self ∥ public ∥ isGroupMember ∥ moderator). ✓ (P5C)

**`challenges allow list`**: `status == 'active' && (visibility == 'public' || groupVisibility == 'public')` for non-admins. ✓ (P5C)

**`challengeLeaderboards`**: `canReadGroupSummary` → group member or admin. ✓

**Deploy requirement**: P5J rules change must be deployed to close the `challengeMembers` privacy gap. P5C already deployed.

---

## Findings by Severity

### 🚨 C-1 — CRITICAL: Time-bounded challenge completion invisible to system

**Affected areas**: Challenge History, Profile Wins, Locked Completed View, CompletedChallengesScreen

**Root cause**: `activityLogSessionService.ts` line 353: `if (nextRate >= 100 && membership.status !== 'completed' && !endAt)`. The `!endAt` guard prevents `status` from being set to `'completed'` for time-bounded challenges. The guard exists to prevent a multi-session time-bounded challenge from being "completed" after the first full session. But it means time-bounded challenge participants never have `status: 'completed'` in their membership doc — even after the challenge ends.

**Impact**:
- `getCompletedChallengesForUser` (history screen query) returns 0 results for users who only did time-bounded challenges
- `completedChallengesCount` in `userMetrics` is always 0 for these users
- Profile Wins stat is always 0
- Locked completed view in ChallengeDetailScreen never shows (falls through to disabled "Completed" button)
- `CompletedChallengesScreen` always shows empty state

**Fix required**: Extend `getCompletedChallengesForUser` to also include memberships where `status == 'active'` AND the associated challenge has `endDate` in the past. OR: add a Cloud Function that transitions `status → 'completed'` on challenge doc status change. The simpler client-side fix is to query ended-challenge memberships (active memberships where the challenge has already ended).

**Files**: `src/services/challengeService.ts` (query), `src/features/Challenges/ChallengeDetailScreen.tsx` (CTA condition), `src/features/Challenges/CompletedChallengesScreen.tsx` (hook)

---

### 🚨 H-1 — HIGH: Private group Ongoing challenges invisible to members

**Affected areas**: ChallengesScreen Ongoing section

**Root cause**: `getUserAccessibleChallengesPage` queries `challenges where groupId in [userGroupIds]` with no visibility constraint. The Firestore `allow list` rule requires `visibility == 'public' || groupVisibility == 'public'` for non-admin reads. For private groups (`visibility: 'private', groupVisibility: 'private'`), any challenge document in the result set fails the rule check — Firestore denies the entire query. Unlike `getVisibleChallengesForUserPage`, there is no try/catch to handle this.

**Impact**: Any user who is a member of a private group with active challenges sees an empty Ongoing section. The React Query hook retries 3× then silently fails — no error shown, just no content.

**Fix required**: Either (a) wrap the challenge query in `getUserAccessibleChallengesPage` in try/catch (same pattern as `getVisibleChallengesForUserPage`), or (b) add `visibility: 'public'` and `groupVisibility: 'public'` queries separately and merge with fallback logic, or (c) add `allow list: if isGroupMember(resource.data.groupId)` to the challenges rule (re-introduces the get() budget concern — needs care).

**Simplest fix**: Wrap the `getDocs` call in `getUserAccessibleChallengesPage` (lines 502–514) in try/catch, silently skipping denied chunks. Private group challenges are already covered by the `groupId`-based `allow get` path; the issue is only the list query.

**Files**: `src/services/challengeService.ts` (`getUserAccessibleChallengesPage`)

---

### ⚠️ M-1 — MEDIUM: `visibility` and `groupVisibility` are always equal

**Affected areas**: Home Trending (two queries produce identical results)

**Root cause**: `challengeCreationBackend.ts` sets `visibility: groupVisibility` (both fields = `normalizeGroupVisibility(group)`). The two Trending queries (visibility and groupVisibility) always return the same challenges. The dedup in P5H is correct but the second query adds a Firestore read that produces no unique results.

**Impact**: Minor performance overhead (one extra Firestore read per Home load). No functional impact — dedup handles it. No incorrect data shown.

**Fix**: Either (a) remove the second Trending query and rely only on `visibility`, or (b) make `visibility` and `groupVisibility` independently settable (requires creation flow changes and a product decision). Not a blocker.

---

### ⚠️ M-2 — MEDIUM: Time-bounded ended challenge shows disabled button instead of locked completed view

**Affected areas**: ChallengeDetailScreen CTA for ended time-bounded challenges

**Root cause**: The P5I locked completed view triggers on `membership?.status === 'completed'`. For time-bounded challenges, this is never true (see C-1). The `hasEnded` branch (disabled "Completed" button) handles the ended state but provides no View Results CTA, no progress summary, and no navigation to leaderboard.

**Impact**: Users who participated in and survived a time-bounded challenge see a grey disabled "Completed" button with no further actions. Linked to C-1 — fixing C-1 fixes this.

---

### ⚠️ M-3 — MEDIUM: Re-enrollment after completion resets progress

**Affected areas**: Challenge Joining

**Root cause**: `joinChallenge` only early-returns if `existing.status === 'active'`. If `status` is `'completed'` or `'abandoned'`, the merge-set resets `activitiesCompleted: 0`, `totalPoints: 0`, `completionRate: 0`, `status: 'active'`. A user who completed an open-ended challenge and re-visits the detail screen could accidentally trigger a re-join if they tap Join.

**Impact**: Lost progress data and completion records for users who re-enroll. The P5I detail view now shows the completed view for `status === 'completed'` members (no Join button visible), so this only affects users with `status === 'abandoned'`.

**Fix**: Add a guard in `joinChallenge` — if `existing.status === 'completed'`, do not re-enroll. Or show a confirmation UI before re-enrolling an abandoned member.

---

### ⚠️ M-4 — MEDIUM: `participantCount` decrements when member completes challenge

**Affected areas**: Challenge cards (participant count display), Home Trending sort

**Root cause**: `ACTIVE_MEMBER_STATUSES = ['active', 'joined']` in `memberCounters.ts`. `'completed'` is not in the set. When `status: 'active' → 'completed'`, `updateParticipantCountForUpdate` computes `beforeActive=true, afterActive=false`, `delta=-1` → decrements `participantCount`.

**Impact**: A challenge with 50 participants that are all completing it shows a declining count. Trending sort by `participantCount` would deprioritize popular maturing challenges.

**Fix**: Add `'completed'` to `ACTIVE_MEMBER_STATUSES` in `memberCounters.ts`, OR use a separate `totalJoinedCount` field that never decrements.

---

### ℹ️ L-1 — LOW: ChallengeDetailScreen inline leaderboard uses different scoring than official leaderboard

**Affected areas**: ChallengeDetailScreen leaderboard snapshot section

**Root cause**: Lines 64–72 in `ChallengeDetailScreen.tsx` aggregate `activityLogs` client-side (sum of `score` field per userId). The `ChallengeLeaderboardScreen` reads from `challengeLeaderboards` (Cloud Function aggregated). Different aggregation paths may produce different rankings.

**Impact**: A user sees a different top-5 on the detail screen than on the dedicated leaderboard screen. Cosmetic confusion.

**Fix**: Use `useChallengeActivitySummary` or `useGroupChallengeLeaderboard` in `ChallengeDetailScreen` instead of client-aggregating `activityLogs`. Low priority.

---

### 🔵 Cosmetic-1 — `ChallengeCompletedScreen` tier computed from workout days, not membership completionRate

**Root cause**: `completionPct = uniqueDays / totalDays` (workout count). The official `membership.completionRate` stores the activity-based completion. These may differ if a user logs multiple workouts per day.

**Impact**: A user who logs 2 workouts on day 1 of a 2-day challenge has `uniqueDays = 1`, `totalDays = 2`, `completionPct = 50%` (Bronze). But `membership.completionRate` would be 100% (both activities done). They see Bronze when they've completed everything.

**Fix**: Read `membership.completionRate` directly in `ChallengeCompletedScreen` instead of recomputing from workouts.

---

## Production Blockers

| ID | Severity | Deploy Required? | Description |
|----|----------|-----------------|-------------|
| C-1 | Critical | No (client-side fix) | Time-bounded completion invisible — history empty, Wins=0 |
| H-1 | High | No (client-side fix) | Private group Ongoing section always empty |
| P5J rules | Security | **Yes** | `challengeMembers` privacy rule — must deploy to close overly-broad read access |

---

## Files Requiring Changes (Next Phase)

| File | Change Needed | Finding |
|------|--------------|---------|
| `src/services/challengeService.ts` | Extend `getCompletedChallengesForUser` to include time-bounded ended-challenge memberships | C-1 |
| `src/services/challengeService.ts` | Wrap challenge query in `getUserAccessibleChallengesPage` in try/catch | H-1 |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Expand completed-member detection to include `hasEnded && !!membership` | C-1, M-2 |
| `functions/src/memberCounters.ts` | Add `'completed'` to `ACTIVE_MEMBER_STATUSES` or use separate non-decrementing counter | M-4 |

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
npm run build                            ✓ built in 3.12s
```

No code changes made in P5K. Audit only.

---

## Deploy Requirements

| Component | Status | Command |
|-----------|--------|---------|
| `firestore.rules` (P5J: `challengeMembers` privacy) | **PENDING** | `firebase deploy --only firestore:rules` |
| `firestore.rules` (P5C: Browse Challenges) | Already deployed (2026-06-17) | — |
| Client code (P5A–P5I) | Not yet deployed | `firebase deploy --only hosting` |
| Cloud Functions | Not modified in P5A–P5K | — |

---

## Recommended Next Phase

**P5L — Complete the Completion Experience** (addresses C-1, M-2):

1. Extend `getCompletedChallengesForUser` to return time-bounded challenge memberships where the challenge `endDate` is in the past (query active memberships + fetch challenges + filter by `parseChallengeEndMs < Date.now()`)
2. Update `ChallengeDetailScreen` completed-member detection: `membership?.status === 'completed' || (!!membership && hasEnded)` → show locked view for both cases
3. Add guard tests
4. Report + change-log update

**P5M — Private Group Challenge Discovery** (addresses H-1):

1. Add try/catch to the challenge query in `getUserAccessibleChallengesPage`
2. Verify the Ongoing section now works for private group members
3. Add guard test
4. Report + change-log update
