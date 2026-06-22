# Phase 10C-P2 Authenticated Production Smoke Test

Date: 2026-06-15  
Environment: Production, https://tiizi-challenges.web.app  
Mode: Audit only. No code changes, no deploys. Production writes were limited to normal smoke-test user actions.

## Executive Summary

Status: NO-GO for closed pilot until the High findings below are addressed.

Production is no longer blank and the core authenticated app renders. Existing seeded-user Home, groups, member roster, group leaderboard, challenge leaderboard, challenge detail, notifications, profile, settings, privacy, terms, and help pages all loaded without browser console errors in the tested paths. Fresh signup, onboarding completion, private invite redemption, challenge join, and unified multi-activity workout save also completed successfully.

However, the smoke test found several pilot-facing defects:

- Fresh users cannot save Home goals because Firestore denies the write.
- Fresh public group discovery shows no public groups even though production has public groups.
- Group Detail can show expired/stale challenges as active.
- A multi-activity 30-day challenge can appear completed after one logging session, which conflicts with visible long-term targets.
- Onboarding allows continuing with Birthday blank.
- Password reset is not exposed on the login screen.

## Test Accounts

- Existing seeded user: Fred Kenogo, `fredkenogo@gmail.com`, UID `sMfC7PsPp7cpGwnr3tGvsKSEOB32`.
- Fresh user created through production UI: `pilot.smoke.20260615.1100@tiizi.test`, UID `0gO19swmbYMrbUoQaHTfzpIr6H42`.

Passwords are intentionally not stored in this report.

## Screenshots And Evidence

Key screenshots captured in repo root:

- Existing Home: `phase-10c-p2-home.png`
- Existing Groups: `phase-10c-p2-groups.png`
- Existing Group Detail: `phase-10c-p2-group-detail.png`
- Existing Group Members: `phase-10c-p2-group-members.png`
- Existing Group Leaderboard: `phase-10c-p2-group-leaderboard.png`
- Existing Challenge Leaderboard mode: `phase-10c-p2-challenge-leaderboard-mode.png`
- Existing Challenges: `phase-10c-p2-challenges.png`
- Existing Challenge Detail: `phase-10c-p2-challenge-detail.png`
- Existing Notifications: `phase-10c-p2-notifications.png`
- Existing Profile: `phase-10c-p2-profile.png`
- Fresh Profile Completion: `phase-10c-p2-fresh-profile-completion.png`
- Fresh Setup Finish: `phase-10c-p2-fresh-setup-finish.png`
- Fresh Home: `phase-10c-p2-fresh-home.png`
- Fresh Goal Add attempt: `phase-10c-p2-fresh-home-goal-after-add.png`
- Fresh Groups: `phase-10c-p2-fresh-groups.png`
- Fresh Invite Join Result: `phase-10c-p2-fresh-group-after-invite.png`
- Fresh Valid Challenge Detail: `phase-10c-p2-fresh-valid-challenge-detail.png`
- Fresh Multi-Activity Success: `phase-10c-p2-fresh-log-success.png`
- Fresh Home After Log: `phase-10c-p2-fresh-home-after-log.png`

Console and network captures were saved as `phase-10c-p2-console-*.md` and `phase-10c-p2-network-*.md`.

## Findings

### High: Home Goals Cannot Save

Screen: Home, Today's Goals  
Reproduction:

1. Sign in as fresh member.
2. Open `/app/home`.
3. Enter a goal, for example “Walk for 10 minutes”.
4. Click Add.

Observed:

- UI keeps the typed goal but does not add it.
- Browser console reports `Missing or insufficient permissions`.
- Evidence: `phase-10c-p2-console-goal-add.md`.

Root cause hypothesis:

- `src/services/dailyGoalsService.ts` writes `dailyGoals` and `dailyGoalsAnalytics` to `users/{uid}`.
- `firestore.rules` does not include these fields in normal user self-writable fields.

Recommended fix:

- Either add a dedicated user-owned `dailyGoals/{uid}` or `userDailyGoals/{uid}` document with scoped rules, or explicitly allow safe `dailyGoals`/`dailyGoalsAnalytics` updates on `users/{uid}` if that remains the model.

### High: Fresh Public Group Discovery Shows Empty

Screen: Groups, Discover tab  
Reproduction:

1. Sign in as a fresh user with no groups.
2. Open `/app/groups`.
3. Click Find Groups / Discover.

Observed:

- UI shows “No new groups to show.”
- Production has public active groups such as Early Birds, Hydration Crew, Squad 254, and Fit 50s.

Root cause hypothesis:

- `src/services/groupService.ts` `getGroupsPage()` queries `status == active` and `isPrivate == false` but not `visibility == public`.
- Firestore rules require public group reads to prove `visibility == public`, so the query cannot safely satisfy the rules.
- The UI collapses the failure/empty response into an empty state.

Recommended fix:

- Add `where('visibility', '==', 'public')` to public group discovery, ensure the matching composite index is deployed, and show a friendly error state when discovery query fails.

### High: Group Detail Shows Expired/Stale Challenges As Active

Screen: Group Detail, Active Challenges  
Reproduction:

1. Fresh user redeems `EARLY-BIRDS` invite.
2. Open Early Birds group detail.
3. Inspect Active Challenges.

Observed:

- Group Detail surfaced `7 day squat + Pushup madness` as an active challenge even though detail page computed it as Completed and its end date was 2026-06-14.
- Evidence: `phase-10c-p2-fresh-active-challenge-detail.md`.

Root cause hypothesis:

- `src/features/Groups/GroupDetailScreen.tsx` selects `groupChallenges.find((challenge) => challenge.status === 'active') || groupChallenges[0]`.
- It does not apply the same lifecycle/date filter used in Home challenge feeds.

Recommended fix:

- Reuse the lifecycle helper for group detail active challenge selection and exclude expired/completed/cancelled/archived challenges from “Active Challenges.”

### High: Multi-Activity Challenge Completion Semantics Are Confusing

Screen: Log Activities, Home, Profile  
Reproduction:

1. Fresh user joins `30-Day Pushup Duel`.
2. Log both configured activities once: Modified Push-Up 10 reps, Bear Crawl Hold 30 seconds.
3. Return to Home/Profile.

Observed:

- Save succeeds and success screen shows both activities.
- Home updates streak to 1 and Recent to 2.
- Active Challenges rail shows no active challenges and Active stat is 0.
- Profile shows Wins 1.
- The challenge itself is labeled 30 days and shows large targets: 1200 reps and 1000 seconds.

Root cause hypothesis:

- Challenge completion appears tied to completing configured activity slots once, rather than progress toward duration/target totals for this challenge type.

Recommended fix:

- Clarify challenge completion rules by challenge type. For target/duration challenges, do not mark the challenge complete after one session unless the stored target is actually met.

### High: Birthday Can Be Skipped During Profile Completion

Screen: Profile Completion  
Reproduction:

1. Complete fresh signup.
2. On profile completion, leave Birthday blank.
3. Click Next.

Observed:

- User advances to Interests/Goals without a visible validation error.

Root cause hypothesis:

- Required-field enforcement is incomplete or the Birthday field is treated as optional despite being presented in the required setup step.

Recommended fix:

- Either mark Birthday clearly optional or enforce validation before leaving `/app/profile/completion`.

### Medium: Password Reset Is Not Exposed

Screen: Login  
Observed:

- Login screen has email, password, Continue, Google, Apple pilot note, and Sign up.
- No visible “Forgot password?” or password reset action was found.

Recommended fix:

- Add a clear password reset link using Firebase password reset flow and normalized error messages.

### Medium: Existing Challenge Detail Shows Conflicting Actions

Screen: Challenge Detail, existing seeded user  
Observed:

- Existing challenge detail showed both `Join Challenge` and `Leave Challenge` actions on the same page.
- Evidence: `phase-10c-p2-challenge-detail-snapshot.md`.

Root cause hypothesis:

- Challenge membership state and button rendering are not using one canonical joined/not-joined value.

Recommended fix:

- Render a single primary action from challenge membership status.

### Medium: Fresh User Profile Overstates Status

Screen: Profile  
Observed:

- A fresh user after one session shows “Top 5% Contributor,” “Community Leader,” and Wins 1.

Root cause hypothesis:

- `src/features/Profile/ProfileScreen.tsx` uses `joinedGroupsCount > 0 ? 'Top 5% Contributor' : 'New Member'` and hard-coded “Community Leader” copy.

Recommended fix:

- Use neutral member copy until real ranking/achievement criteria exist.

### Low: Notifications Creation Was Not Exercised

Screen: Notifications  
Observed:

- Notifications screen loads a clean empty state for the existing user.
- No normal member action in this smoke test generated a visible notification.

Recommended fix:

- Add a dedicated notification QA seed or callable test path before pilot so notification target routing can be verified end to end.

### Low: Static Page Navigation Was Slow In Playwright

Screens: Terms, Help  
Observed:

- Terms and Help direct navigations eventually loaded real content with no console errors.
- Playwright navigation waited unusually long for these pages.

Recommended fix:

- Monitor production navigation timings. No functional blocker found in this smoke pass.

## Passed Smoke Checks

- Existing user session persisted when reopening `/app/home`.
- Existing Home loaded without console errors.
- Existing Home Active count matched the visible active challenge rail: 3 active.
- Completed/expired challenges did not appear in existing Home Trending during this pass.
- Existing group detail loaded.
- Existing member roster loaded with “Group Managers” language.
- Existing group leaderboard loaded, including challenge-specific leaderboard data.
- Existing notifications screen loaded cleanly.
- Existing profile loaded real user data.
- Fresh signup succeeded through Firebase Auth.
- Fresh onboarding completed without route loops.
- Fresh invite redemption through `redeemGroupInvite` succeeded for `EARLY-BIRDS`.
- Fresh valid challenge join succeeded with no console errors.
- Fresh unified multi-activity workout save succeeded and routed once to the success screen.
- Success screen showed both logged activities and total points.
- Profile settings and privacy settings loaded without console errors.
- Terms, Privacy, and Help routes render real content.

## Console And Network Summary

No Firebase permission errors, missing index errors, callable failures, runtime exceptions, or React errors were observed on these passing screens:

- Existing Home
- Existing Groups
- Existing Group Detail
- Existing Group Members
- Existing Group Leaderboard
- Existing Challenge Leaderboard mode
- Existing Challenges
- Existing Challenge Detail
- Existing Notifications
- Existing Profile
- Fresh Profile Completion
- Fresh Setup Finish
- Fresh Home initial load
- Fresh Invite Join
- Fresh Valid Challenge Join
- Fresh Multi-Activity Save
- Fresh Profile
- Fresh Profile Settings
- Fresh Privacy Settings
- Terms / Privacy / Help

Known console error:

- Home goal add: `Missing or insufficient permissions`.

Known non-app browser noise:

- Chrome DOM verbose messages about password fields not being inside forms.
- Browser extension/Grammarly-style noise should be ignored when present.

## Final Recommendation

Internal testing: GO  
Closed pilot: NO-GO until the High findings are fixed  
Public beta: NO-GO

Recommended immediate fix order:

1. Fix Home goals write permissions or move goals to a scoped user-owned collection.
2. Fix public group discovery query/rules/index alignment.
3. Apply lifecycle filtering to Group Detail active challenges.
4. Reconcile multi-activity completion semantics for long-duration/target challenges.
5. Enforce or relabel Birthday in onboarding.
6. Add password reset action.
7. Clean challenge detail action rendering and profile badge copy.
