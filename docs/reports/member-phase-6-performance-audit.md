# Member Phase 6: Performance, Data Integrity, and Scalability Audit

Date: 2026-06-10

## Summary

Phase 6 audited member-facing data loading after the discovery and activity-summary fixes. The biggest remaining risks were not visual; they were hidden read amplification and client-side derivation from bounded-but-incomplete raw activity feeds.

This phase reduced first-load home reads, removed unbounded user workout history reads, capped streak/activity history queries, and moved challenge ranking screens to server-generated leaderboard summaries.

## Files Changed

- `firestore.indexes.json`
- `src/features/Challenges/ChallengeLeaderboardScreen.tsx`
- `src/features/Challenges/CollectiveChallengeScreen.tsx`
- `src/features/Challenges/CompetitiveChallengeScreen.tsx`
- `src/features/Challenges/StreakChallengeScreen.tsx`
- `src/features/Groups/GroupDetailScreen.tsx`
- `src/features/Home/HomeScreen.tsx`
- `src/features/Home/useHomeScreen.ts`
- `src/hooks/useWorkouts.ts`
- `src/services/groupInsightsService.ts`
- `src/services/streakService.ts`
- `src/services/wellnessLogService.ts`
- `src/services/workoutService.ts`

## Member Screen Audit

| Screen/flow | Findings | Action |
| --- | --- | --- |
| Home | `HomeScreen` ran `useHomeScreenData`, plus fallback visible/access challenge reads and membership index reads. `fetchHomeScreenData` also loaded both visible and accessible challenge lists. | Removed component-level fallback queries and removed duplicate accessible challenge read from `fetchHomeScreenData`. |
| Profile | Uses `myGroups`, first-page accessible challenges, bounded user workout history, daily goal analytics, streak, donation settings/total. | User workouts now bounded to 60 newest rows. Remaining challenge count is first-page compatibility only. |
| Profile analytics | Calculated 7d/30d workouts from user workout array. | User workout source now bounded. Phase 7 should materialize user activity analytics for exact long-term totals. |
| Groups discovery | Already cursor-based after Phase 5. | No Phase 6 change. |
| Group detail | Used raw user workouts for non-collective challenge progress. | Removed raw workout dependency; progress uses challenge summary + membership. |
| Group feed/members/leaderboard | Uses `groupActivityFeed`, `groupMemberStats`, `groupLeaderboards`. | Confirmed indexed and bounded. |
| Challenge detail | Uses challenge summary/feed summary; still computes mini leaderboard from first 50 feed rows for preview. | Kept bounded; report as medium residual risk for exact ranking preview. |
| Challenge leaderboard | Ranked from raw/derived activity list. | Switched to `challengeLeaderboards` via `useGroupChallengeLeaderboard`. |
| Competitive challenge | Ranked from raw/derived activity list. | Switched to `challengeLeaderboards`. |
| Streak challenge | Ranked from raw/derived activity list. | Switched ranking to `challengeLeaderboards`; weekly consistency still uses bounded feed summaries. |
| Collective challenge | Participant ranking was derived from activity rows + group members. | Switched top participant rows to `challengeLeaderboards`; weekly bars still use bounded feed summaries. |
| Workout logged/completed | Reads current user's challenge workouts. | Source is now bounded by `userId + challengeId + date desc`. |
| Notifications | Stored in `users/{uid}.notifications.items`, sorted locally and capped at 100. | No code change. Recommend subcollection later if notifications grow. |
| Daily goals | Stored/aggregated on user doc. | No code change. Low read cost. |
| Exercise library | Uses first-page challenge/group hooks to validate context. | No code change. Medium correctness risk if context item is outside first page; recommend exact `useChallenge/useGroup` lookup in Phase 7. |

## Query Hardening Implemented

| Area | Before | After |
| --- | --- | --- |
| `useChallengeWorkouts` | Loaded all user workouts then filtered by challenge. | Queries `workouts` by `userId`, optional `challengeId`, `date desc`, `limit(50)`. |
| `useUserWorkouts` | Loaded all user workouts. | Queries newest bounded user workouts, default `limit(60)`. |
| `workoutService.getWorkoutsByChallenge` | Queried all challenge workouts. | Adds `orderBy(date desc)` and `limit(50)`. |
| `wellnessLogService.getLogsByChallenge/getLogsByGroup` | Queried all matching logs. | Adds `orderBy(date desc)` and `limit(50)`. |
| `streakService` | Primary reads were date-bounded but unlimited; fallbacks were sorted then sliced client-side. | Primary and fallback reads now include `limit(120)`. |
| Home first load | Multiple overlapping challenge reads. | Removed fallback duplicate reads from component and service. |
| Challenge ranking screens | Ranked from bounded feed rows, which could be incomplete. | Read indexed server-generated `challengeLeaderboards`. |

## Home Screen Before/After

Before first load:

- profile setup doc
- user identity doc
- my groups membership + group docs
- challenge membership summaries
- visible challenges
- accessible challenges
- component fallback accessible challenges
- component fallback visible challenges
- component fallback membership index
- daily goals doc

After first load:

- profile setup doc
- user identity doc
- my groups membership + group docs
- challenge membership summaries
- visible challenges
- daily goals doc

Estimated reduction: removes 3 duplicate component queries plus 1 service-level challenge query. For a typical pilot user this is roughly 25-90 fewer reads on home load depending on group/challenge membership size.

## Stale Metric Audit

| Metric | Source | Risk |
| --- | --- | --- |
| `participantCount` | Stored on challenge docs. | Medium: can drift if join/leave writes fail. Recommend Cloud Function reconciliation. |
| `memberCount` | Stored on group docs. | Medium: can drift on membership edge cases. Recommend server-owned aggregate. |
| challenge activity totals | `challengeActivitySummaries`. | Low: server-generated, but dependent on trigger/backfill freshness. |
| group/challenge leaderboards | `groupLeaderboards`, `challengeLeaderboards`. | Low: server-generated; stale if function fails. |
| profile workout counts | client from newest bounded workouts. | Medium: now scalable, not exact lifetime. |
| streaks | client from last 30 days raw logs. | Medium: bounded and cheap, but exact longest streak beyond 30 days requires materialized user metrics. |
| daily goal analytics | stored on user doc. | Low/medium: client-updated aggregate can drift if multiple devices update concurrently. |
| donation support total | confirmed support service/admin-confirmed records. | Existing flow; outside Phase 6 changes. |

## Leaderboard Audit

- `groupLeaderboards`: indexed by `groupId ASC, score DESC`, queried with limit 20.
- `challengeLeaderboards`: indexed by `challengeId ASC, groupId ASC, score DESC`, queried with limit 20.
- `groupMemberStats`: indexed by `groupId ASC, score DESC`, queried with limit 100.
- Challenge leaderboard, competitive challenge, streak challenge, and collective challenge now use summary leaderboard docs for rankings.
- Remaining bounded feed usage is for recent weekly bars/feed previews, not canonical rankings.

## React Query / Cache Audit

Findings:

- Home had overlapping query keys and fallback reads that duplicated `useHomeScreenData`.
- `useChallengeWorkouts` and `useUserWorkouts` were separate keys but one used all-user history as a hidden source.
- Group/challenge summary hooks use short `staleTime` values around 30-60 seconds, reasonable for pilot but can refetch often on tab focus.

Changes:

- Removed Home component fallback challenge queries.
- `useUserWorkouts` query key now includes `pageSize`.
- `useChallengeWorkouts` now reads a challenge-specific bounded query.

Recommended next cache changes:

- Add route-level prefetch for challenge detail after challenge cards are tapped.
- Consider `staleTime: 2-5 minutes` for leaderboard/feed summary docs once Cloud Function refresh reliability is confirmed.
- Move profile analytics to one materialized `userMetrics/{uid}` doc.

## Firestore Cost Review

| Workflow | Before | After |
| --- | --- | --- |
| Home load | Multiple overlapping challenge/membership reads, often 80-150 reads for active users. | Roughly 30-70 reads depending on memberships; no component fallback reads. |
| Open challenge | Challenge doc, group doc, membership doc, summary docs, bounded feed. | Similar, but ranking screens use leaderboard docs instead of raw logs. |
| Join challenge | Challenge doc, group membership doc, challenge member write, user stats write. | No Phase 6 change. |
| Open group | Group doc, membership status, count, bounded group challenges, summary progress. | Removed raw workout dependency in detail progress. |
| Log workout/session | Raw log writes + membership/user updates; summaries via functions. | No Phase 6 write reduction. |
| Open leaderboard | Previously raw/bounded activity logs + members for several screens. | Now one indexed leaderboard query per mode. |

Estimated read reduction:

- Home: 25-90 reads saved per load.
- Challenge leaderboard screens: replaces up to 50 feed rows plus member stats/name joins with 20 leaderboard docs.
- Group detail progress: removes one user workout query per active challenge detail load.
- Profile/activity history: caps worst-case user workout reads at 60/50 instead of unbounded.

Estimated write reduction:

- None in Phase 6. Write model was already server-summary based after earlier phases.

## Indexes Added

- `workouts`: `userId ASC, date DESC`
- `workouts`: `userId ASC, challengeId ASC, date DESC`
- `workouts`: `challengeId ASC, date DESC`
- `wellnessLogs`: `userId ASC, date DESC`
- `wellnessLogs`: `userId ASC, challengeId ASC, date DESC`
- `wellnessLogs`: `challengeId ASC, date DESC`
- `wellnessLogs`: `groupId ASC, date DESC`
- `challenges`: `groupId ASC, startDate DESC`

## Remaining Scalability Risks

- Exercise library context validation still uses first-page group/challenge compatibility hooks.
- Profile analytics is scalable but not exact lifetime analytics because it uses newest bounded workouts.
- Home still performs several independent document/query reads; Phase 7 should materialize `memberHome/{uid}` or `userMetrics/{uid}`.
- Notifications live inside `users/{uid}` and are capped at 100; okay for pilot, not ideal long term.
- `participantCount` and `memberCount` are stored aggregates and require periodic/server reconciliation.
- Some weekly charts use the newest 50 feed items, so they are recent-activity views rather than exact full challenge analytics.

## Recommended Phase 7 Scope

1. Add `userMetrics/{uid}` generated by Cloud Functions:
   - workouts7d/30d
   - wellness7d/30d
   - current/longest streak
   - active/upcoming/completed challenge counts
   - total logged activities

2. Add `memberHome/{uid}` or a small home dashboard materialized doc:
   - active challenge card
   - trending/member-visible challenge cards
   - group counts
   - generatedAt freshness

3. Move notifications to `userNotifications/{uid}/items/{notificationId}` with cursor pagination.

4. Replace exercise library context validation with exact doc lookups:
   - `useChallenge(challengeId)`
   - `useGroup(groupId)`

5. Add server reconciliation jobs for `memberCount` and `participantCount`.

## Validation

`npx tsc -b`

- Result: pass
- Output: no diagnostics

`npm run build`

- Result: pass
- Output summary:

```text
> tiizi@0.0.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
✓ 1832 modules transformed.
✓ built in 6.11s
```
