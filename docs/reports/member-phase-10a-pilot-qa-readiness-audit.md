# Phase 10A - Pilot QA Readiness Audit

Date: 2026-06-14  
Scope: Member app pilot readiness after Phases 8 and 9  
Mode: Audit only; no code or data changes were made beyond this report.

## Pilot Readiness Score

**82 / 100**

The member app is no longer blocked by compile/build failures, auth route loops, the Phase 7G Firebase chunk regression, or missing legal/help routes. Core journeys are substantially in place. The score is held back by several runtime/data readiness risks that can still confuse pilot users or create Firestore cost/performance issues at modest growth.

## Validation Output

| Command | Result | Output |
| --- | --- | --- |
| `npm run test:group-invite-backend` | PASS | `Group invite backend security tests passed` |
| `npx tsc -b --pretty false` | PASS | No TypeScript errors |
| `npm run build` | PASS | Vite built successfully; Firebase is collapsed into one `vendor-firebase-*.js` chunk. Only warning: `vendor-firebase-DX9I8gMV.js` is larger than 500 kB. |

## Critical Blockers

### 1. Catalog/template data rollout can make creation and browse flows appear empty

**Severity:** Critical if Phase 9B backfill/indexes are not applied before strict rules/app rollout; otherwise High data-readiness risk.  
**Flows affected:** Browse Challenges, Suggested Challenges, Wellness Templates, Create Challenge Wizard, exercise picker, wellness activity picker.  
**Files involved:**  
- `src/services/challengeTemplateService.ts`
- `src/services/wellnessTemplateService.ts`
- `src/services/exerciseService.ts`
- `src/services/wellnessActivityService.ts`
- `src/hooks/useChallengeTemplates.ts`
- `src/hooks/useWellnessTemplates.ts`
- `src/hooks/useExercises.ts`
- `src/hooks/useWellnessActivities.ts`
- `src/features/Challenges/CreateChallengeWizard.tsx`
- `src/features/Challenges/SuggestedChallengesScreen.tsx`
- `src/features/Challenges/WellnessTemplateGalleryScreen.tsx`
- `firestore.indexes.json`

**Evidence:** Phase 9B moved catalog reads behind `status == active`, `visibility == public`, `isPublished == true`, and `sortName` indexes. The Phase 9B dry run previously reported many catalog docs needing new fields. The current screens have friendlier empty states, but the underlying data dependency remains.

**Impact:** Template-based challenge creation and picker flows can show empty libraries even when seed/catalog data exists.

**Phase 10B fix:** Confirm production indexes are serving, run the catalog/template backfill apply once, then smoke-test each picker with an authenticated member account.

## High-Priority Issues

### 1. Group detail/member/feed screens still read all memberships for member count

**Severity:** High scalability risk.  
**Files/functions:**  
- `src/services/groupService.ts:293` `getGroupMemberCount()`
- `src/hooks/useGroups.ts:82` `useGroupMemberCount()`
- `src/features/Groups/GroupDetailScreen.tsx:25`
- `src/features/Groups/GroupFeedScreen.tsx`
- `src/features/Groups/GroupMembersScreen.tsx`

**Root cause:** `getGroupMemberCount()` queries all `groupMembers` where `groupId == groupId` and counts client-side, even though Phase 7B introduced server-owned `groups.memberCount`.

**Impact:** Opening popular groups gets more expensive as membership grows.

**Recommended fix:** Replace `useGroupMemberCount()` consumers with `group.memberCount`, keeping a safe `0` fallback. Remove or admin-scope `getGroupMemberCount()`.

### 2. Create Challenge can succeed while auto-join silently fails

**Severity:** High journey consistency risk.  
**Files/functions:**  
- `src/services/challengeService.ts:713` `createChallenge()`
- `src/services/challengeService.ts:715` auto-join catch
- `src/features/Challenges/CreateChallengeWizard.tsx`

**Root cause:** After challenge creation, `joinChallenge()` failure is caught and logged, but creation still returns success.

**Impact:** A pilot user can create a non-donation challenge, land in the challenge flow, but not actually have a `challengeMembers/{challengeId_uid}` record. Logging/progress can then fail or appear inconsistent.

**Recommended fix:** For member-created active challenges, treat creator auto-join as required. Either create both challenge and membership in one safe write path or show a blocking retry/error if auto-join fails.

### 3. Home first-load still performs multiple live reads despite `memberHome`

**Severity:** High performance risk, not a launch blocker.  
**Files/functions:**  
- `src/features/Home/useHomeScreen.ts:82` `fetchHomeScreenData()`
- `src/features/Home/useHomeScreen.ts:90-95` profile, identity, groups, memberships, visible challenges
- `src/features/Home/useHomeScreen.ts:293-297` aggressive refetch settings

**Root cause:** `HomeScreen` uses `memberHome` for selected values but still computes fallback home data from profile, identity, groups, challenge memberships, visible challenges, and missing challenge lookups.

**Impact:** First paint is more expensive than necessary; window focus/reconnect can repeat reads.

**Recommended fix:** Make `memberHome/{uid}` the primary home data source with a concise missing/stale state. Use live discovery only for explicit sections, not first-load summary cards.

### 4. User accessible challenge pagination is not true cursor pagination

**Severity:** High/Medium scalability risk.  
**Files/functions:**  
- `src/services/challengeService.ts:331` `getUserAccessibleChallengesPage()`
- `src/services/challengeService.ts:384-388` returns `nextCursor: null` with `hasMore`
- `src/hooks/useChallenges.ts` `useAccessibleChallengesPage()`

**Root cause:** The service reads bounded chunks per user group, sorts client-side, then returns no cursor.

**Impact:** Users in many groups can get incomplete challenge lists and no real “load more” path.

**Recommended fix:** Split member challenge discovery into group-scoped cursor pages and/or a server-maintained `memberChallengeFeed/{uid}` summary.

### 5. Member-facing screens still expose browser prompts for reporting

**Severity:** High UX polish risk.  
**Files/functions:**  
- `src/features/Groups/GroupDetailScreen.tsx:155`
- `src/features/Groups/GroupMembersScreen.tsx`

**Root cause:** Report group/member uses `window.prompt()`.

**Impact:** Native prompt is abrupt and can feel broken on mobile.

**Recommended fix:** Replace with a small in-app report modal using the existing `useReportGroup()` path.

## Medium-Priority Polish and Runtime Issues

### 1. Production console logging remains in member paths

**Severity:** Medium.  
**Files involved:**  
- `src/features/Workouts/LogWorkoutScreen.tsx:124`
- `src/features/Challenges/CreateChallengeWizard.tsx`
- `src/features/Groups/CreateGroupScreen.tsx`
- `src/services/exerciseService.ts`
- `src/services/wellnessTemplateService.ts`
- `src/services/wellnessActivityService.ts`
- `src/services/challengeService.ts:719`

**Recommendation:** Gate diagnostic logs behind `import.meta.env.DEV` or convert expected failures to user-facing toasts without console noise.

### 2. Challenge detail leaderboard is not using the dedicated challenge leaderboard screen/source

**Severity:** Medium.  
**Files involved:**  
- `src/features/Challenges/ChallengeDetailScreen.tsx`
- `src/hooks/useWorkouts.ts`
- `src/services/memberActivitySummaryService.ts`
- `src/features/Groups/GroupLeaderboardScreen.tsx`

**Finding:** `ChallengeDetailScreen` builds a small leaderboard from summary/feed activity data and can show anonymized UID labels. The group leaderboard screen uses `challengeLeaderboards` correctly.

**Recommendation:** Reuse `challengeLeaderboards` for challenge-detail leaderboard cards and display server-provided `displayName` safely.

### 3. Notifications are embedded in `users/{uid}`

**Severity:** Medium future scalability risk.  
**Files involved:**  
- `src/services/notificationService.ts`
- `src/features/Notifications/NotificationsScreen.tsx`

**Finding:** Notifications are capped at 100 embedded items and routed by `challengeId`/`groupId`. This is pilot-safe but not a long-term notification model.

**Recommendation:** Keep for pilot if volume is low; move to `userNotifications/{uid}/items` or equivalent before larger rollout.

### 4. Browse challenge query uses dual public fields and shared cursor

**Severity:** Medium.  
**Files/functions:**  
- `src/services/challengeService.ts` `getVisibleChallengesForUserPage()`
- `src/features/Challenges/BrowseChallengesScreen.tsx`

**Finding:** Public discovery queries both `visibility` and `groupVisibility` and may apply the same cursor to two separate query streams.

**Recommendation:** After discovery backfill is verified, standardize on one canonical field, preferably `visibility` plus `groupVisibility` only for compatibility/backfill migration.

### 5. Admin catalog screens affect pilot readiness but are not on the happy path

**Severity:** Medium.  
**Files involved:**  
- `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx`
- `src/features/Admin/Exercises/ExerciseListScreen.tsx`
- `src/features/Admin/Wellness/WellnessActivityListScreen.tsx`
- `src/services/adminChallengeService.ts`
- `src/services/adminExerciseService.ts`
- `src/services/adminWellnessActivityService.ts`

**Finding:** Phase 9C appears to have moved key admin catalog lists toward pagination/default metadata. They should be smoke-tested by the pilot operator before content edits.

## Flow-by-Flow Status

| Flow | Status | Notes |
| --- | --- | --- |
| Signup/login/onboarding | PASS | `RequireProfileSetup` is actively used in `src/App.tsx`; completed users go to home, incomplete users stay in onboarding. Auth errors are normalized. |
| Home screen | PASS with performance risk | Uses `memberHome` but still falls back to multiple live reads and aggressive refetches. |
| Browse groups | PASS | Public groups are paginated; legacy fallback is bounded. |
| Join public group | PASS | `groupService.joinGroup()` creates active/pending membership based on group settings. |
| Join private group by invite | PASS | `GroupsScreen` and `JoinGroupScreen` use `redeemGroupInvite()`. Backend invite tests pass. |
| Create group | PASS with console polish risk | New groups no longer create legacy invite codes; cover upload errors still log to console. |
| Browse challenges | PASS if indexes/backfill deployed | Has permission/index-aware error states. Data readiness is the main risk. |
| Challenge detail | PASS with leaderboard consistency risk | Detail loads and joins/logs route correctly; inline leaderboard should use `challengeLeaderboards`. |
| Join challenge | PASS | Uses hardened `challengeMembers` path. |
| Create Challenge Wizard - templates | PASS if catalog backfill exists | First-step choice exists; template path prefills challenge data. |
| Create Challenge Wizard - custom | PASS with auto-join risk | Creation can return success even if creator membership auto-join fails. |
| Exercise picker | PASS if catalog fields exist | Uses bounded first page and search; no full collection scan. |
| Wellness activity picker | PASS if catalog fields exist | Uses bounded query path, but array hook still loads a capped first page for wizard convenience. |
| Log single workout | PASS with logging polish | Single activity path still updates progress client-side and logs errors to console. |
| Log multi-activity workout | PASS by code inspection | Unified screen exists, shared notes field exists, batch writes are centralized. Production smoke test still recommended. |
| Log wellness activity | PASS | Notes handling is cleaned up and undefined notes are stripped. |
| Profile/settings | PASS | Uses user metrics, legal/help routes, real profile data. |
| Terms/Privacy/Help | PASS | Routes exist and contain Tiizi-specific pilot/manual-payment content. |
| Notifications routing | PASS | Cards route by `challengeId`/`groupId`; fallback remains on notifications. |
| Admin catalog screens | PASS with smoke-test recommendation | Build passes; operator should test create/edit template and catalog entries before pilot. |

## Recommended Phase 10B Implementation Plan

1. **Data rollout verification:** Confirm Phase 9B/9D indexes are deployed and run the catalog/template/discovery backfills in production. Smoke-test Browse Challenges, Suggested Challenges, Wellness Templates, exercise picker, and wellness picker.
2. **Replace member-count scans:** Change group screens to use `groups.memberCount`; remove member-facing `getGroupMemberCount()`.
3. **Make creator auto-join atomic or blocking:** Do not allow challenge creation to appear successful when creator membership creation fails.
4. **Simplify Home first-load reads:** Prefer `memberHome/{uid}` and `userMetrics/{uid}` for dashboard summary; reserve live discovery for explicit lists.
5. **Replace report prompts:** Add an in-app report modal for group/member reports.
6. **Align challenge detail leaderboard:** Read `challengeLeaderboards` directly for challenge-detail ranking cards.
7. **Gate production logs:** Remove or DEV-gate noisy member-path console logs.
8. **Manual pilot smoke QA:** Use one fresh member account and one existing pilot account to complete: signup, onboarding, join public group, redeem private invite, create challenge from template, create custom challenge, log single workout, log multi-activity workout, log wellness activity, view leaderboard, view notifications, and submit feedback/help.

## Deployment / Data Needs Before Pilot

| Item | Needed? | Reason |
| --- | --- | --- |
| Hosting deploy | Yes after Phase 10B fixes | Current build passes, but audit found code-level pilot risks. |
| Firestore rules deploy | Only if Phase 10B changes rules | Current audit did not modify rules. |
| Firestore indexes deploy | Yes if Phase 9 indexes not already live | Catalog/challenge discovery depends on composite indexes. |
| Data backfill | Yes | Catalog/template fields and discovery visibility/status fields must exist for member reads. |
| Functions deploy | Only if changing auto-join/home summaries | Not required by this audit itself. |

## Remaining Risk

No critical compile/build blocker remains. The most important pilot risk is operational sequencing: if indexes/backfills are not completed before the stricter catalog/discovery reads are used in production, member-facing creation and discovery flows can look empty even though the code is correct. The second-largest risk is quiet cost/performance drift from member-count scans and Home fallback reads.
