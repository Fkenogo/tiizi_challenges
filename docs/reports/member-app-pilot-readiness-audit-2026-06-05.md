# Tiizi Member App Pilot-Readiness Audit

Date: 2026-06-05  
Scope: main Tiizi member app only. Admin screens/services were excluded except where shared services or Firestore rules affect normal users.  
Code changes: none. This report is the only added artifact.

## Executive Summary

The member app can build and the major route guards are present, but several pilot-critical flows still depend on raw activity documents and broad read rules. The highest-risk area is wellness/activity progress: normal users cannot read other users' `wellnessLogs` by rule, while member group/challenge screens query group or challenge wellness logs directly. This can produce Firestore permission errors and broken progress, feeds, members, and leaderboards for wellness challenges.

The next fixes should prioritize member progress/feed/leaderboard architecture, activity write rules, and removal of production-reachable placeholder routes before UI polish.

## Critical Blockers

| Area | Files / functions | Finding | Pilot impact | Required fix/deploy |
|---|---|---|---|---|
| Wellness challenge progress and group views | `src/features/Home/useHomeScreen.ts`, `src/features/Groups/GroupDetailScreen.tsx`, `src/hooks/useWorkouts.ts`, `src/services/groupInsightsService.ts`, `src/services/wellnessLogService.ts`; rules `match /wellnessLogs/{logId}` | Member UI queries `wellnessLogs` by `challengeId` or `groupId`, but rules only allow the owner/admin to read each log. Queries containing other users' logs are denied. | Wellness challenge detail, home progress, group detail, feed, members, and leaderboard can fail for normal users. | Replace raw cross-user wellness reads with materialized member-safe summaries/feed/leaderboard docs, or redesign rules and queries. Needs Firestore rules, indexes, hosting deploy, and data backfill/rebuild. |
| Group feed/members/leaderboard raw scans | `src/services/groupInsightsService.ts` `getGroupFeed`, `getGroupMembers`, `getGroupLeaderboard` | Reads all group memberships, challenges, workouts, wellness logs, and user docs for a group, then sorts/slices client-side. | Popular groups will be slow/expensive; wellness portions may hard-fail from permissions. | Materialize `groupActivityFeed`, `groupMemberStats`, and `groupLeaderboards`; paginate. Needs indexes, hosting deploy, and backfill/function refresh. |
| Challenge detail/progress raw scans | `src/hooks/useWorkouts.ts`, `src/services/workoutService.ts` `getWorkoutsByChallenge`, `src/services/wellnessLogService.ts` `getLogsByChallenge`, `src/features/Challenges/ChallengeDetailScreen.tsx` | Challenge progress and activity logs load all workouts/wellness logs for a challenge. | Large challenges will degrade; wellness challenge logs can be blocked by rules. | Use per-user `challengeMembers` progress plus materialized public/group-safe activity summaries. Needs hosting, rules if adding collections, indexes/backfill. |
| Activity write permissions too broad | `firestore.rules` `match /workouts/{workoutId}`, `match /wellnessLogs/{logId}`; `src/services/workoutService.ts` `createWorkout`; `src/services/wellnessLogService.ts` `writeLog` | Normal users can create own workout/wellness records with arbitrary `groupId`/`challengeId`; rules do not verify active challenge membership, active group membership, or challenge dates. | Users can pollute challenge/group stats, log outside eligibility, or spoof membership context. | Harden rules and service validation. Needs Firestore rules deploy; likely indexes if using `exists()` paths only no index. |
| Production placeholder flow reachable | `src/App.tsx` wildcard route and `/app/flow`; `src/features/Help/HelpScreen.tsx` | Unknown routes redirect to `/app/flow`, and Help opens `/app/flow`. `FlowHubScreen` is a development flow catalog. | Pilot users can land in internal route catalog / mock navigation. | Change wildcard to `/app/home` or not-found screen and replace Help feedback route. Needs hosting deploy. |

## High Priority Fixes

| Area | Files / functions | Finding | Recommended fix | Deploy/backfill |
|---|---|---|---|---|
| Home screen duplicate and unbounded reads | `src/features/Home/useHomeScreen.ts`, `src/features/Home/HomeScreen.tsx`, `src/App.tsx` `RouteWarmup` | Home loads accessible challenges multiple ways, warms up challenge/group/goal queries, then scans all selected challenge logs for progress. | Consolidate home data into one bounded query set plus materialized progress summary. | Hosting, indexes, metrics/progress backfill. |
| Public challenge/group discovery completeness | `src/features/Challenges/ChallengesScreen.tsx`, `src/features/Challenges/BrowseChallengesScreen.tsx`, `src/hooks/useGroups.ts`, `src/services/groupService.ts` | Discovery is bounded, but `useGroups()` only loads the first 50 groups. Challenge browsing filters public challenges using only those loaded groups, so valid challenges in later public groups can disappear. | Query challenges by visibility/public group fields directly, or denormalize `groupIsPrivate`/`visibility` onto challenge docs. | Hosting, indexes, data backfill for denormalized fields. |
| Challenge participant counts | `src/services/challengeService.ts` `getChallengeParticipantCount`, `getChallengeParticipantCounts`, `joinChallenge` | Counts are computed from `challengeMembers`; `joinChallenge` does not increment `challenges.participantCount`. | Counts can be expensive and inconsistent. | Increment/decrement materialized counts transactionally or via Cloud Function. Backfill counts. |
| Group member counts | `src/services/groupService.ts` `getGroupMemberCount` | Reads all `groupMembers` for a group to count active/joined members. | Popular groups cause high reads on detail cards. | Trust maintained `groups.memberCount` or use `getCountFromServer` with status query. |
| Create challenge group policy | `src/features/Groups/CreateGroupScreen.tsx`, `src/services/challengeService.ts` `createChallenge`, `firestore.rules` `match /challenges/{challengeId}` | Groups expose `allowMemberChallenges`, but challenge create does not enforce it in service/rules. | Members may create challenges in groups that disabled member challenges. | Enforce in service and Firestore rules by checking related group. Rules + hosting deploy. |
| Signup error feedback | `src/features/Auth/SignupScreen.tsx` | Signup catches Firebase auth errors with generic messages. Login has normalized messages, signup does not. | Pilot users may not understand invalid email/password/provider failures. | Reuse normalized auth error handling from login. Hosting deploy. |
| Auth user document timestamp consistency | `src/context/AuthContext.tsx` `ensureUserDocument` | `createdAt` is set on every periodic merge. | Member-since dates and user growth data can drift. | Only set `createdAt` on first create; update `lastActive` separately. Hosting deploy, optional data repair. |
| Profile onboarding skip loop | `src/features/Profile/ProfileCompletionScreen.tsx`, `src/features/Profile/ProfileSetupFinishScreen.tsx`, `src/components/Auth/RequireProfileSetup.tsx` | Skip buttons navigate to `/app/home` while `onboardingCompleted` remains false. Completed-route guard can send the same user back to onboarding. | Confusing loop during pilot onboarding. | Remove skip, make skip complete a minimal profile, or route to the correct next onboarding step. Hosting deploy. |
| Support donation aggregate | `src/services/donationService.ts` `getConfirmedSupportTotal`, `src/hooks/useDonations.ts`, `src/features/Donate/DonateScreen.tsx`, `src/features/Profile/ProfileScreen.tsx` | Reads all confirmed `supportDonations` to compute public total/donor count. Rules allow all authenticated users to read confirmed donation docs. | Scalability issue and possible donor-data exposure. | Add public-safe aggregate doc, read only aggregate from member UI. Rules, hosting, backfill/function refresh. |

## Medium Priority Fixes

| Area | Files / functions | Finding | Recommended fix |
|---|---|---|---|
| Catalog/template scans | `src/services/exerciseService.ts`, `src/services/wellnessActivityService.ts`, `src/services/challengeTemplateService.ts`, `src/services/wellnessTemplateService.ts` | Exercise/activity/template libraries still use broad reads or client-side filtering. | Accept for small pilot catalogs, then paginate/index category/status search. |
| User support donation history | `src/services/donationService.ts` `getUserSupportDonations` | Reads all donations for the current user. | Add date/status ordering and pagination. |
| Streak/progress fallback reads | `src/services/streakService.ts` | Some fallback queries read recent user workouts/wellness logs. | Keep bounded by user/date; verify indexes and cap result sizes. |
| Notifications storage model | `src/services/notificationService.ts` | Notifications are stored as an array under `users/{uid}` capped at 100. | Fine for pilot; move to subcollection if notifications grow or need server send tracking. |
| Create group moderation | `src/services/groupService.ts` `createGroup` | New groups are created with `status: active` while review state is pending. | For pilot, decide whether unreviewed public groups should be visible immediately. |

## UX Issues

| Flow | Files | Issue |
|---|---|---|
| Help | `src/features/Help/HelpScreen.tsx` | Feedback button opens `/app/flow`; FAQ copy refers to "privacy placeholders." |
| Profile settings | `src/features/Profile/ProfileSettingsScreen.tsx` | Terms and Privacy buttons only show placeholder toasts. |
| Profile preview | `src/features/Profile/ProfilePrivacySettingsScreen.tsx` | Public profile preview hardcodes "Alex Rivers", `@alex_r`, and fallback body stats. |
| Profile | `src/features/Profile/ProfileScreen.tsx` | Header share button has no action; "Top 5% Contributor" appears derived from group presence, not verified ranking. |
| Groups | `src/features/Groups/GroupMembersScreen.tsx` | "Load More Members" button has no handler. |
| Group detail | `src/features/Groups/GroupDetailScreen.tsx` | "Remind Me" button has no handler; report uses `window.prompt`. |
| Group feed | `src/features/Groups/GroupFeedScreen.tsx` | Reply/share/bookmark controls appear non-functional. |
| Join group | `src/features/Groups/JoinGroupScreen.tsx` | Invite link CTA only shows a toast; no actual deep-link consume path. |
| Activity logging | `src/features/Workouts/LogWorkoutScreen.tsx`, `src/features/Workouts/WorkoutLoggedScreen.tsx`, `src/features/Challenges/ChallengeCompletedScreen.tsx`, `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Missing challenge context falls back to `core-blast`, which can confuse pilot users. |
| Share | `src/features/Share/ShareScreen.tsx` | Share text uses raw IDs/generic preview rather than real deep links. |

## Data Issues

- Existing or newly created user docs may have unreliable `createdAt` because auth sync merges a fresh timestamp in `src/context/AuthContext.tsx`.
- Challenge `participantCount` can be stale because `joinChallenge` writes `challengeMembers` but does not update the challenge count.
- New public groups can appear while `reviewStatus`/`moderationStatus` is still pending.
- Seed/test identifiers like `core-blast` are production-reachable fallback values.
- Public profile preview contains placeholder identity/body-stat data.
- Wellness challenge completion is inconsistent: `workoutService.createWorkout` can set challenge membership complete, but `wellnessLogService.writeLog` updates progress without setting completed status when the target is reached.

## Security / Rules Issues Affecting Normal Users

| Rule area | Current concern | Impact |
|---|---|---|
| `users/{uid}` reads | Any authenticated user can read user docs. | User profile/privacy fields may be broader than intended. Consider public profile projection docs. |
| `groupMembers` reads | Any authenticated user can read all membership docs. | Private-group membership visibility is too broad. |
| `groups` reads | Any authenticated user can read all groups. | Private group metadata can be read directly even if UI hides it. |
| `workouts` reads | Any authenticated user can read all workout docs. | Activity privacy risk; currently used to power group/challenge views. |
| `wellnessLogs` reads | Owner/admin only. | More private, but conflicts with current member UI cross-user queries. |
| `workouts` / `wellnessLogs` creates | Owner-only create, but no rule check for challenge membership/date/group validity. | Users can create activity records attached to arbitrary groups/challenges. |
| `supportDonations` confirmed reads | All authenticated users can read confirmed support donation docs. | Use an aggregate for public totals rather than exposing records. |

## Firestore Read Scalability Issues Affecting Normal Users

| Risk | Files / functions | Current read pattern | Replacement |
|---|---|---|---|
| Critical | `groupInsightsService.getGroupFeed` | All group workouts, wellness logs, memberships, challenges, user docs; client sort/slice. | Materialized paginated group feed. |
| Critical | `groupInsightsService.getGroupMembers` / `getGroupLeaderboard` | All group members + all activity docs + user doc joins. | Materialized member stats/leaderboard with pagination. |
| Critical | `useHomeScreen` active progress | All logs/workouts for selected challenge. | Per-user progress from `challengeMembers` plus aggregate challenge summary. |
| High | `useWorkouts.useChallengeProgress` / `useChallengeActivityLogs` | All workouts and wellness logs by challenge. | Paginated activity feed + aggregate progress. |
| High | `challengeService.getUserAccessibleChallenges` | All user group memberships plus group challenge scans. | Paginated, status-filtered challenge discovery with visibility fields. |
| High | `challengeService.getChallengesByGroup` | All challenges for group. | `where(groupId,status)` + `orderBy(startDate)` + `limit/startAfter`. |
| High | `groupService.getGroupMemberCount` | All memberships for group. | Stored `memberCount` or count aggregation. |
| High | `donationService.getConfirmedSupportTotal` | All confirmed support donation records. | Public-safe aggregate doc. |
| Medium | `exerciseService`, `wellnessActivityService`, template services | Full catalog/template reads. | Accept for small pilot; add indexed category/status pagination before production. |

## Recommended Fix Order

### P0 Before Pilot

1. Replace member-facing wellness/workout cross-user raw reads with materialized summaries for home, challenge detail, group detail, group feed, members, and leaderboard.
2. Harden Firestore rules for activity creation so workouts/wellness logs require active challenge membership, correct group, owner UID, valid dates, immutable identity fields, and bounded safe payloads.
3. Remove `/app/flow` from production fallback/help and replace with a real not-found/help feedback route.
4. Fix onboarding skip behavior so incomplete users do not bounce between completed-only routes and onboarding.
5. Remove `core-blast` production fallbacks from workout completion/leaderboard routes.

### P1 Early Pilot

1. Paginate `getUserAccessibleChallenges`, `getChallengesByGroup`, group feed/members/leaderboard, and current-user donation history.
2. Move support donation totals to a public-safe materialized aggregate.
3. Enforce `allowMemberChallenges` in service and rules.
4. Fix auth `createdAt` preservation and normalize signup errors.
5. Make Terms, Privacy, Feedback, Share, Remind Me, Load More, and invite deep-link actions real or hide them.

### P2 Before Wider Production

1. Add indexed/paginated catalog and template browsing.
2. Move notifications to a subcollection or server-generated model if notification volume grows.
3. Add duplicate/abuse controls for activity logging.
4. Backfill public/profile projection docs and reduce broad `users`, `groupMembers`, `workouts`, and `groups` reads.

## Deployment / Data Impact Matrix

| Fix area | Firestore rules | Firestore indexes | Hosting deploy | Data backfill / job |
|---|---:|---:|---:|---:|
| Activity write hardening | Yes | Maybe | Maybe | No |
| Materialized group/challenge progress/feed/leaderboards | Yes | Yes | Yes | Yes |
| `/app/flow` removal | No | No | Yes | No |
| Onboarding skip repair | No | No | Yes | Optional if stuck users exist |
| Support donation aggregate | Yes | Maybe | Yes | Yes |
| Challenge/group discovery denormalization | Maybe | Yes | Yes | Yes |
| `allowMemberChallenges` enforcement | Yes | No | Yes | No |
| Auth `createdAt` preservation | No | No | Yes | Optional repair |
| Legal/help/share/deep-link UX | Maybe for content docs | Maybe | Yes | Optional content seed |

## Validation Output

### `npx tsc -b`

Exit code: 0

```text
<no output>
```

### `npm run build`

Exit code: 0

```text
> tiizi@0.0.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
transforming...
✓ 1829 modules transformed.
rendering chunks...
computing gzip size...
...
✓ built in 3.62s
```

### `firebase deploy --only firestore:indexes --dry-run`

Exit code: 0

```text
=== Deploying to 'tiizi-challenges'...

i  deploying firestore
i  firestore: ensuring required API firestore.googleapis.com is enabled...
i  firestore: ensuring required API firestore.googleapis.com is enabled...
i  firestore: reading indexes from firestore.indexes.json...
i  cloud.firestore: checking firestore.rules for compilation errors...
✔  cloud.firestore: rules file firestore.rules compiled successfully

✔  Dry run complete!

Project Console: https://console.firebase.google.com/project/tiizi-challenges/overview
```
