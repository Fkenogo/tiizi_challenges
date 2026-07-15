# Phase 8B-P1 - Secondary UX Cleanup + Legal Content Upgrade

Date: 2026-06-12  
Scope: Member-facing secondary UX cleanup, legal/policy/help content, and production log hygiene  
Deploy status: Not deployed

## Summary

Completed the requested secondary pilot-facing cleanup without changing data models, invite backend architecture, Cloud Functions, Firestore rules, or migration tooling.

## Files Changed

- `src/features/Legal/TermsScreen.tsx`
- `src/features/Legal/PrivacyScreen.tsx`
- `src/features/Help/HelpScreen.tsx`
- `src/features/Notifications/NotificationsScreen.tsx`
- `src/features/Share/ShareScreen.tsx`
- `src/features/Groups/GroupChallengesHighlightedScreen.tsx`
- `src/features/Groups/GroupLeaderboardScreen.tsx`
- `src/features/Groups/GroupsScreen.tsx`
- `src/features/Profile/ProfileScreen.tsx`
- `src/features/Auth/LoginScreen.tsx`
- `src/features/Auth/SignupScreen.tsx`
- `src/features/Challenges/ChallengeCompletedScreen.tsx`
- `src/features/Challenges/CompetitiveChallengeScreen.tsx`
- `src/features/Challenges/StreakChallengeScreen.tsx`
- `src/features/Challenges/SuggestedChallengesScreen.tsx`
- `src/features/Challenges/BrowseChallengesScreen.tsx`
- `src/features/Workouts/LogWorkoutScreen.tsx`
- `src/features/Workouts/SelectChallengeActivityScreen.tsx`
- `src/features/Workouts/WorkoutLoggedScreen.tsx`
- `src/services/activityLogSessionService.ts`
- `docs/reports/member-phase-8b-p1-secondary-ux-cleanup.md`

## What Was Fixed

| Area | Change |
|---|---|
| Terms of Service | Expanded pilot-ready terms around accounts, profile setup, groups/private invites, challenges, activity logging, leaderboards, donations, acceptable use, moderation, and pilot status. Added an in-code editable-content note. |
| Privacy Policy | Expanded privacy copy around account/profile data, privacy settings, group membership, invite/join records, activity summaries, admin/moderator access, notifications, support/payment references, and member visibility. Added an in-code editable-content note. |
| Help / Support | Rewrote FAQ copy to reflect secure invites, approval, multi-activity logging, manual donation verification, privacy visibility, and support/dispute process. Support email remains functional via `mailto:`. |
| Notifications | Notification cards now route safely to challenge detail when `challengeId` exists, group detail when `groupId` exists, and stay passive when no target exists. |
| Share | Removed raw challenge/group IDs from displayed share text. Share text resolves challenge/group names when available, uses safe fallback copy, points to the real challenge/group route, supports Web Share API, and falls back to copy text. |
| Group highlighted challenges | Restricted approval screen to group owner/admin/moderator access. Removed no-op Settings/View All buttons, hard-coded "2 hours ago", and permanent Recent Activity skeleton. |
| Challenge completion / leaderboard defaults | Removed demo fallback challenge IDs/names from completion and challenge-mode routes. Missing challenge context now routes or displays safe challenge-list empty states. |
| Auth buttons | Removed unexplained disabled Apple buttons and replaced them with clear pilot helper text. |
| Copy cleanup | Replaced member-facing admin/developer copy in suggested challenge empty state and removed technical "search applies to loaded challenges" copy. |
| Production console logging | Gated verbose activity session and invite failure diagnostics behind `import.meta.env.DEV` or explicit debug mode. |
| No-op controls | Hid additional dead controls: profile share icon, group leaderboard menu icon, group card decorative menu dots, and challenge mode share icons. |

## Legal / Privacy / Help Content Summary

The upgraded content now reflects current Tiizi behavior:

- Account creation and login.
- Profile setup and privacy preferences.
- Public/private groups, secure invites, and approval.
- Challenge participation and membership requirements.
- Workout/wellness activity logging, including multi-activity challenges.
- Server-generated progress summaries and leaderboards.
- Notification behavior.
- Manual/direct support and donation references.
- Admin/manual verification for payment references.
- Moderator/admin review for safety and disputes.
- Pilot/beta status and feature-change expectations.
- User responsibilities and acceptable use.

The pages explicitly state that the pilot copy is practical product guidance and not final legal advice.

## Remaining UX Issues

Remaining items are not considered P0/P1 blockers from this pass:

- Report flows still use `window.prompt`; a modal would be more polished.
- Notification target existence is handled by routing to the destination screen, not by pre-validating every target before navigation.
- Share text uses safe fallbacks if challenge/group names are not loaded yet.
- Home notification dot is still a separate polish item.
- Some broader challenge creation/upload error logs remain in real action paths, but verbose activity-session diagnostics were gated.

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
✓ built in 2.86s
```

Build note: the large `vendor-firebase` chunk warning remains informational and did not fail the build.

## Functions

No functions files were changed. `npm --prefix functions run build` and `npm --prefix functions run lint` were not required for this phase.

## Deployment

No deploy was run.

Deploy command after review:

```bash
npm run build
firebase deploy --only hosting --project tiizi-challenges
```
