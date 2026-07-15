# Phase 8B-P0 - Pilot Blocker Cleanup

Date: 2026-06-12  
Scope: Member-facing UX blockers from Phase 8A only  
Deploy status: Not deployed

## Summary

Implemented the Phase 8A pilot-blocking UX cleanup without changing invite migration code, backend invite architecture, or data models.

## Files Changed

- `src/App.tsx`
- `src/features/Legal/TermsScreen.tsx`
- `src/features/Legal/PrivacyScreen.tsx`
- `src/features/Profile/ProfileSettingsScreen.tsx`
- `src/features/Profile/ProfilePrivacySettingsScreen.tsx`
- `src/features/Help/HelpScreen.tsx`
- `src/features/QuickActions/QuickActionsScreen.tsx`
- `src/features/Groups/GroupFeedScreen.tsx`
- `src/features/Groups/GroupMembersScreen.tsx`
- `src/features/Groups/GroupDetailScreen.tsx`
- `src/features/Challenges/ChallengeLeaderboardScreen.tsx`
- `docs/reports/member-phase-8b-p0-pilot-blockers.md`

## Before / After Behavior

| Area | Before | After |
|---|---|---|
| Legal pages | Profile Settings showed placeholder toast messages for Terms and Privacy. | `/app/terms` and `/app/privacy` are working member routes with pilot-safe content. Profile Settings routes to them. |
| Internal flow exposure | `/app/flow` was reachable by normal members, and wildcard routes redirected to it. | `/app/flow` is dev-only. Wildcard routes redirect to `/app/home`. |
| Help feedback | Help sent users to `/app/flow` via "Open Feedback Flow." | Help has a functional prefilled `mailto:` support action and updated member-facing FAQ copy. |
| Quick Actions Log Activity | Log Activity could navigate to activity selection with only `groupId`, causing an empty challenge state. | Quick Actions chooses an accessible active challenge when available. If none exists, it sends users to Challenges with a clear toast. |
| Profile privacy preview | Showed fake "Alex Rivers", `@alex_r`, mock height/weight, placeholder bio, and onboarding back navigation. | Shows real profile/auth values or safe empty states, saves back to settings, and back navigation returns to `/app/profile/settings`. |
| Group Feed no-op controls | Share update, Reply, Share, Bookmark, and More were visible without working actions. | Dead controls hidden. Feed remains read-only from server-generated activity items. |
| Group Members no-op controls | Header More, Message buttons, row chevrons, and Load More Members had no functional action. | Dead controls hidden. Search and report actions remain. |
| Group Detail no-op control | Upcoming challenge "Remind Me" button was visible but unwired. | Button hidden until reminder behavior is implemented. |
| Challenge Leaderboard no-op control | Search button was visible but unwired; missing `challengeId` fell back to demo `core-blast`. | Search button hidden. Missing challenge context now shows a safe "Open a challenge" empty state. |

## Remaining Unresolved UX Items

These were intentionally left for later phases to avoid scope creep:

- Profile header share icon still appears and should be wired or hidden in a follow-up.
- Notification cards still need target navigation to challenge/group pages.
- Share screen still needs name resolution and better share destinations.
- Group highlighted challenges screen still needs manager-only gating or completion.
- Challenge completed screen still has broader polish opportunities from Phase 8A.
- Apple auth buttons remain a medium-priority polish item.
- Home notification dot still needs unread-state binding.

## Recommended Next Phase

Phase 8B-P1 should clean the remaining high/medium UX items:

1. Notification target navigation.
2. Share screen cleanup.
3. Group highlighted challenges manager gating or route removal.
4. Challenge completion/leaderboard copy polish.
5. Hide or explain unavailable auth providers.
6. Replace remaining rough empty-state and technical copy.

## Validation Output

`npm run test:group-invite-backend`

```text
> tiizi@0.0.0 test:group-invite-backend
> tsx scripts/testGroupInviteBackend.ts

Group invite backend security tests passed
```

`npx tsc -b`

```text
Passed with no output.
```

`npm run build`

```text
> tiizi@0.0.0 build
> tsc -b && vite build

vite v5.4.21 building for production...
✓ 1842 modules transformed.
rendering chunks...
computing gzip size...
dist/assets/vendor-firebase-DX9I8gMV.js 528.33 kB │ gzip: 124.40 kB

(!) Some chunks are larger than 500 kB after minification.
✓ built in 10.95s
```

Build note: the large `vendor-firebase` chunk warning remains informational and did not fail the build.

## Deployment

No deployment was performed.

Recommended deployment command after review:

```bash
npm run build
firebase deploy --only hosting --project tiizi-challenges
```
