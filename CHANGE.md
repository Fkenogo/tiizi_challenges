# Challenge/Group Data Fetch Stabilization Report

Date: 2026-02-27
Scope: Recurrent challenge/group/home data visibility issues (frontend not reflecting Firestore state reliably).

## Problem Statement
- `Browse Challenges` screen returned empty even when challenges existed.
- `Ongoing Challenges` showed `0 Participants` for challenges with members.
- `Home` sometimes loaded as if user had no groups/challenges.

## Root Causes Identified
1. Membership filtering in `getMyGroups` excluded memberships carrying `seedTag`, causing valid user group memberships to disappear in app queries.
2. Participant count relied heavily on `challenges.participantCount` which can be stale/inconsistent with `challengeMembers` membership records.
3. Browse flow filtered out challenges from user-joined groups, which made the list appear empty depending on user state.
4. Browse query used only `active` filter and gave a narrow catalog for the “view all” flow.

## Fixes Implemented

### 1) Group membership fetch no longer drops valid memberships
- File: `src/services/groupService.ts`
- Change:
  - Removed `seedTag`-based exclusion in `getMyGroups`.
- Impact:
  - Users with valid active/joined memberships now correctly resolve “My Groups”.

### 2) Participant counts now reconcile challenge docs with membership docs
- File: `src/services/challengeService.ts`
- Changes:
  - Updated `getChallengeParticipantCount` to compute from both:
    - `challenges.participantCount`
    - `challengeMembers` active/completed membership count
  - Updated `getChallengeParticipantCounts` (batch) to compute per challenge using:
    - `challenges` documents (persisted count)
    - `challengeMembers` by `challengeId in [...]` (computed count)
  - Result uses `max(persisted, computed)` to avoid regressions.
  - `getUserAccessibleChallenges` now hydrates participant counts using reconciled map.
  - `getVisibleChallengesForUser` now hydrates participant counts using reconciled map.
- Impact:
  - Cards and lists no longer depend solely on stale `participantCount` fields.

### 3) Browse-all now includes public challenges regardless of current membership
- File: `src/features/Challenges/BrowseChallengesScreen.tsx`
- Changes:
  - Removed exclusion of challenges belonging to groups already joined by the user.
  - Expanded status query from `['active']` to `['active', 'completed']` for broader visibility.
  - Removed unnecessary `useMyGroups` loading dependency for this screen.
- Impact:
  - “View All / Browse” now behaves as a true public catalog view.

## Previously Applied Supporting Fixes (still relevant to this issue set)
- File: `src/features/Home/useHomeScreen.ts`
  - Home challenge query uses visibility-safe fetch (`getVisibleChallengesForUser`).
  - Added profile identity fallback via `getUserIdentity(uid)` to reduce “Athlete!” fallback cases.

## Validation Performed
- `npm run build` ✅
- `npm run audit:smoke` ✅ (7/7)
- `npm run audit:data-flow` ✅ (12/12)

## What Is Confirmed Working
- Build passes with current patch set.
- Data-flow/static audits pass.
- Group membership retrieval no longer strips valid memberships due to `seedTag`.
- Challenge lists now use reconciled participant counts from membership docs.
- Browse list logic is less restrictive and should not be empty solely due to “already in my group” filtering.

## Remaining Risks / Open Items
1. Firestore schema consistency risk:
   - Some records may still have mixed status semantics (`active` vs `joined`, draft/active timing usage).
   - This can cause UI state divergence in edge paths.
2. Server-side denormalized count drift:
   - `participantCount` can still drift if not maintained transactionally everywhere.
   - We now mitigate display via runtime reconciliation, but underlying documents may remain inconsistent.
3. Account-specific home blanks:
   - If user profile/group/challenge docs are malformed/missing required fields, home may still show sparse data.
   - Needs targeted production-data inspection per affected UID.

## External Consultant Help Requested
Please assist with a data model + rules hardening pass in these areas:
1. **Canonical participant count strategy**
   - Decide whether to:
     - fully deprecate `challenges.participantCount` and always aggregate from memberships, or
     - enforce strict transactional updates via backend function/admin pathway.
2. **Status normalization**
   - Define canonical statuses for:
     - group membership (`active`, `joined`, etc.)
     - challenge lifecycle (`draft`, `active`, `completed`) + scheduled behavior.
3. **Rules-safe write path**
   - Validate whether client should ever update challenge counters directly under current rules.
   - Recommend backend-owned write path for denormalized fields if needed.
4. **Per-user forensic audit**
   - Compare affected user UIDs vs admin UID for:
     - group membership docs
     - challenge docs status/groupId
     - challengeMembers rows
   - Identify exact data-shape mismatch causing blank home for specific users.

## Files Changed In This Pass
- `src/services/groupService.ts`
- `src/services/challengeService.ts`
- `src/features/Challenges/BrowseChallengesScreen.tsx`
- `CHANGE.md` (this report)

---

## 2026-02-27 Full Reset Execution Log

### Objective
- Wipe all mixed app data and users for a fresh start.

### Changes Added
- New script: `scripts/resetAllData.ts`
  - Deletes all docs from core app collections.
  - Deletes all Firebase Auth users.
  - Supports `dry-run` and `--apply`.
- `package.json` scripts added:
  - `reset:all-data`
  - `reset:all-data:apply`

### Commands Run
1. Dry run:
   - `GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=tiizi-challenges npm run reset:all-data`
   - Result:
     - `firestoreTargets: 139`
     - `authUsersTarget: 34`
2. Apply:
   - `GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=tiizi-challenges npm run reset:all-data:apply`
   - Result:
     - `deletedFirestore: 139`
     - `deletedAuthUsers: 34`
3. Post-verify dry run:
   - `GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=tiizi-challenges npm run reset:all-data`
   - Result:
     - `firestoreTargets: 0`
     - `authUsersTarget: 0`

### Current State
- Firestore app data cleared.
- Firebase Auth users cleared.
- Database is now clean for reseeding or fresh manual setup.

---

## 2026-02-27 Minimal Baseline Seed Log

### Objective
- Seed only minimal required static baseline data after full reset.
- Keep runtime data collections empty (`users`, `groups`, `challenges`, memberships, workouts).

### Changes Added
- New script: `scripts/seedBaselineData.ts`
- New npm script:
  - `seed:baseline`

### Command Run
- `GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=tiizi-challenges npm run seed:baseline`

### Output Summary
```json
{
  "projectId": "tiizi-challenges",
  "seedTag": "tiizi_baseline_v1",
  "catalogExercisesLoaded": 0,
  "exerciseInterests": 15,
  "wellnessGoals": 12,
  "onboardingContent": 3,
  "notificationTemplates": 1,
  "settings": 1,
  "users": 0,
  "groups": 0,
  "challenges": 0
}
```

### Current Baseline State
- Seeded:
  - `exerciseInterests`
  - `wellnessGoals`
  - `onboardingContent`
  - `notificationTemplates`
  - `settings`
- Intentionally empty:
  - `users`
  - `admins`
  - `groups`
  - `groupMembers`
  - `challenges`
  - `challengeMembers`
  - `workouts`
  - `wellnessTemplates`
  - `wellnessActivities`

---

## 2026-02-28 Data Consistency Fix Pass (Challenges/Home/Participants)

### Problem
- Recurrent mismatch between Firestore and UI:
  - Ongoing challenge cards showing `0 participants`
  - Blank challenge/home sections after reseed
  - Inconsistent join-state behavior after reset/reseed

### Root Cause Identified
- `seed:app` did not generate any `challengeMembers` documents.
- UI relies on challenge membership documents for:
  - participant reconciliation
  - join-state
  - active challenge behavior

### Code Changes
- File: `scripts/seedAppData.ts`
  - Added `SeedChallengeMember` type.
  - Added `buildChallengeMembers(challenges, memberships, workouts)` to generate membership rows for seeded challenges.
  - Added `challengeMembers` to seed cleanup collections.
  - Added write step: `setDocs('challengeMembers', challengeMembers)`.
  - Recomputed `challenges.participantCount` from generated challenge memberships before writing challenge docs.
  - Extended seed summary output with `challengeMembers`.

### Commands Executed
1. Reseed full app data
   - `GOOGLE_APPLICATION_CREDENTIALS=... FIREBASE_PROJECT_ID=tiizi-challenges SEED_PRIMARY_UID=sMfC7PsPp7cpGwnr3tGvsKSEOB32 SEED_PRIMARY_EMAIL=fredkenogo@gmail.com npm run seed:app`
2. Firestore verification (admin SDK read)
   - Verified:
     - `challenges: 18`
     - `challengeMembers: 205`
     - challenge docs now have non-zero participant counts and matching member rows
3. Build + audits
   - `npm run build` ✅
   - `npm run audit:smoke` ✅
   - `npm run audit:data-flow` ✅

### Current Status
- Seeded challenge membership data is now present and consistent.
- Participant counts now have a data source (`challengeMembers`) instead of relying only on denormalized fields.
- Static audits and compile checks all pass.

### Remaining Runtime Verification Needed (manual, browser)
- Sign in as a seeded user and validate:
  - Home active challenge visibility
  - Browse challenges list population
  - Ongoing cards show non-zero participants
- If still blank for specific accounts, capture UID and console/network errors for per-user data forensic follow-up.

### 2026-02-28 Home Feed Fallback Hardening

- File: `src/features/Home/useHomeScreen.ts`
- Issue:
  - Home screen could still render empty `active/trending` while challenge pages had data.
- Fix:
  - Added dual-source loading in `fetchHomeScreenData`:
    - `getVisibleChallengesForUser(...)`
    - `getUserAccessibleChallenges(...)`
  - Home now falls back to accessible challenges when visible challenge query returns empty/fails.
  - `myGroupIds` now derives from both:
    - `groupService.getMyGroups`
    - accessible challenge group IDs
  - Trending source widened to include active challenges from fallback path and then sorted/ranked.
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅
  - `npm run audit:data-flow` ✅

### 2026-02-28 Home Rendering Fallback (UI-level)

- Files:
  - `src/App.tsx`
  - `src/features/Home/HomeScreen.tsx`
- Problem:
  - Home screen remained empty in some sessions even while Challenges/Browse showed real data.
- Fix:
  1. Removed Home prefetch from `RouteWarmup` in `src/App.tsx` to avoid stale-empty cache seeding on auth/session transitions.
  2. Added HomeScreen-level fallback data sources:
     - `useChallenges()` (user-accessible)
     - `getVisibleChallengesForUser(...)` query for trending
     - `getUserChallengeMembershipIndex(...)` for joined-state/CTA accuracy
  3. Home now computes:
     - fallback active challenge card
     - fallback trending list
     when primary `useHomeScreenData()` returns empty.
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅
  - `npm run audit:data-flow` ✅

### 2026-02-28 First Sign-in Home Blank (Auth Timing Fix)

- Files:
  - `src/features/Home/useHomeScreen.ts`
  - `src/features/Home/HomeScreen.tsx`
- Observed behavior:
  - After hard refresh, first sign-in sometimes loaded Home with empty active/trending sections.
  - Signing out/in again often populated data.
- Root causes addressed:
  1. Home query could run before token init was fully stable for first Firestore reads.
  2. Home fallback branch had a bug referencing `neededGroups` before declaration.
  3. First empty payload had no forced second fetch.
- Fixes applied:
  1. `useHomeScreenData()` now:
     - waits for auth readiness (`enabled: !!user?.uid && isReady`)
     - calls `await user.getIdToken()` before Firestore reads
     - adds controlled retry (`retry < 2`) with backoff for first-login timing races
  2. `fetchHomeScreenData()` fallback fixed:
     - removed invalid `neededGroups` reference
     - uses `groupService.getGroups()` + map lookup to resolve public-group visibility safely
  3. `HomeScreen` recovery pass:
     - one-shot refetch if first resolved payload has no active challenge and no trending items
     - retry flag resets when `user.uid` changes
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅

### 2026-02-28 Active Challenge Membership + Metric Progress Tracking

- Files:
  - `src/features/Home/useHomeScreen.ts`
  - `src/features/Home/HomeScreen.tsx`
  - `src/components/Home/ActiveChallengeCard.tsx`
- Fixes:
  1. **Stopped implicit challenge participation on Home card**
     - Active Challenge now requires explicit challenge membership (`challengeMembers` status active/completed).
     - Removed fallback behavior that showed any active group challenge as user’s active challenge after joining a group.
  2. **Progress now uses metric totals instead of date percentage**
     - For active card, progress now computes from actual logged values:
       - `collective`: sums group logs for the primary activity.
       - `competitive/streak`: sums the signed-in user’s logs for the primary activity.
       - pulls from `workouts` for fitness and `wellnessLogs` for wellness.
     - Progress label now renders as:
       - `X unit of Y unit`
       - example: `100 reps of 2000 reps`
  3. **Card copy/UI update**
     - `ActiveChallengeCard` now displays `progressLabel` (metric text) instead of `% Complete`.
  4. **Fallback alignment in Home screen**
     - Home UI fallback active card now also requires membership and no longer assumes membership from group join.
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅

### 2026-02-28 Home Trending Visibility + Completed Status CTA Fix

- Files:
  - `src/features/Home/useHomeScreen.ts`
  - `src/features/Home/HomeScreen.tsx`
  - `src/components/Home/TrendingChallenges.tsx`
- Fixes:
  1. **Trending availability for authenticated users**
     - Home trending derivation now keeps public visibility semantics and no longer requires group-join state to derive challenge candidates.
     - Public challenge candidates include both active and completed statuses (for clear historical visibility).
  2. **Completed challenge behavior in trending**
     - If challenge is completed by status or by end-date, Home now labels it `Completed`.
     - Completed challenges now use CTA `View` (never `Join` or `Log`).
  3. **Active challenge membership strictness retained**
     - Home active card remains membership-driven only (no implicit enrollment from group membership).
  4. **Fallback trending alignment**
     - Home component fallback trending logic now matches status-aware rules:
       - Active/upcoming: Join/View/Log based on membership + start window.
       - Completed: View only.
  5. **Trending card subtitle**
     - Completed cards now show `Challenge completed` helper copy.
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅
  - `npm run audit:data-flow` ✅

### 2026-02-28 Home First-Signin Trending + Active Membership Hydration

- Files:
  - `src/features/Home/useHomeScreen.ts`
  - `src/features/Challenges/ChallengeDetailScreen.tsx`
- Issues addressed:
  1. **Trending could be empty on first sign-in**
     - Root cause: Home applied a second group-lookup visibility filter after already loading visibility-safe challenges, and that filter could collapse to empty during first auth hydration.
  2. **Joined active challenge could be missing from Home active card**
     - Root cause: Home challenge fetch was capped and could omit a joined challenge outside the top list window.
  3. **Completed challenge detail primary action**
     - Root cause: Completed challenges still showed the reminder primary CTA path.
- Fixes:
  1. Removed redundant group-based re-filter from Home trending source.
     - Home now treats `allChallenges` as already visibility-safe (public + member-visible).
  2. Added membership-driven backfill in Home:
     - For any challenge IDs present in `challengeMembers` but missing from fetched lists, Home now fetches them directly by document ID and merges them.
     - Ensures active joined challenges can render on Home even when outside general list caps.
  3. Updated challenge detail primary CTA:
     - Completed challenges now show disabled `Completed` button (no log/reminder primary action).
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅
  - `npm run audit:data-flow` ✅

### 2026-02-28 Consultant Report + Mobile Screen Alignment Pass

- Files added:
  - `docs/HOME_DATA_INCIDENT_REPORT_2026-02-28.md`
  - `docs/SCREEN_ALIGNMENT_AUDIT_2026-02-28.md`
- Why:
  - Home first-signin hydration issue remains intermittent and requires external consultant deep-dive.
  - Requested screen-by-screen layout normalization pass for mobile parity.
- Layout fixes applied:
  - `src/features/Groups/GroupsScreen.tsx`
    - Standardized container to `bg-slate-50` and `pb-[96px]`.
  - `src/features/Challenges/ChallengesScreen.tsx`
  - `src/features/Challenges/BrowseChallengesScreen.tsx`
  - `src/features/Challenges/WellnessTemplateGalleryScreen.tsx`
  - `src/features/Challenges/WellnessTemplateDetailScreen.tsx`
  - `src/features/Profile/ProfileScreen.tsx`
    - Standardized to sticky top header with border + consistent background.
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅
  - `npm run audit:data-flow` ✅

### 2026-02-28 Group Detail Family Layout Parity Pass

- Files updated:
  - `src/features/Groups/GroupDetailScreen.tsx`
  - `src/features/Groups/GroupFeedScreen.tsx`
  - `src/features/Groups/GroupMembersScreen.tsx`
  - `src/features/Groups/GroupLeaderboardScreen.tsx`
- Why:
  - Group-detail screens had inconsistent mobile shell behavior vs. the normalized app screens:
    - mixed background colors (`white` vs `slate-50`)
    - non-sticky headers on long content screens.
- Fixes:
  1. Standardized each screen root to `bg-slate-50` with existing bottom-safe padding.
  2. Converted top bars in detail/members/leaderboard to sticky headers (`sticky top-0 z-20`) with consistent border/background styling.
  3. Kept screen logic and data flows unchanged (layout-only pass).
- Validation:
  - `npm run build` ✅

### 2026-02-28 Auth + Workout Screen Layout Parity Pass

- Files updated:
  - `src/features/Auth/LoginScreen.tsx`
  - `src/features/Auth/SignupScreen.tsx`
  - `src/features/Workouts/SelectChallengeActivityScreen.tsx`
  - `src/features/Workouts/LogWorkoutScreen.tsx`
  - `src/features/Workouts/LogWellnessActivityScreen.tsx`
- Why:
  - Second-pass mobile normalization requested; these screens still had mixed header behavior compared with the app shell.
- Fixes:
  1. Standardized Auth top section to sticky mobile header + sticky auth tab rail (`Sign Up` / `Login`) with consistent border/background.
  2. Standardized workout flow headers (`Select Activity`, `Log Workout`, `Log Wellness Activity`) to sticky top bars with border/background parity.
  3. Kept all interaction/data logic unchanged (layout-only pass).
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅

### 2026-02-28 Exercise Detail Shell Normalization

- File updated:
  - `src/features/Exercises/ExerciseDetailScreen.tsx`
- Why:
  - `ExerciseDetail` was still using a custom full-width bottom nav and non-sticky top bar, causing shell drift from the standardized mobile canvas.
- Fixes:
  1. Replaced custom bottom nav block with shared `BottomNav` component.
  2. Converted top bar to sticky header with consistent border/background treatment.
  3. Preserved exercise-detail content and CTA behavior (`START EXERCISE`) unchanged.
- Validation:
  - `npm run build` ✅
  - `npm run audit:smoke` ✅

### 2026-02-28 Challenge Progress Metric Alignment (Value-Based)

- Files updated:
  - `src/features/Workouts/LogWorkoutScreen.tsx`
  - `src/features/Workouts/WorkoutLoggedScreen.tsx`
  - `src/features/Groups/GroupDetailScreen.tsx`
  - `src/features/Home/useHomeScreen.ts`
- Why:
  - Progress displays were mixing day/count-derived percentages with metric values, leading to false 100% states and entry-count tracking instead of value tracking.
- Fixes:
  1. Workout success flow now passes workout `unit` in route params for correct metric rendering.
  2. Workout success card now computes completion from **summed logged values** (filtered by activity/exercise) versus target, not workout entry count.
  3. Group Detail active challenge progress now computes from activity values:
     - uses primary activity target/unit
     - supports fitness (`workouts`) and wellness (`wellnessLogs`)
     - applies collective vs individual logic by challenge type
     - displays metric label (`X unit of Y unit`) next to the progress bar.
  4. Home active challenge no longer inflates progress with day-based minimums:
     - metric-based progress now drives the bar when targets exist
     - fallback uses membership completion only when activity target is unavailable.
