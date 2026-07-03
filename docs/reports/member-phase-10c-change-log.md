# Phase 10c Change Log

## Session: Phase 18I-6K — Log Activity Leaderboard Data Unification (2026-07-03)

**Branch:** fix/p0-pre-deploy-blockers

### Problem

`SelectChallengeActivityScreen` called `resolveChallengeProgress({ challenge, membership })` without a leaderboard. This caused:
- **Collective:** `groupTotal = max(challenge.groupCurrentTotal, 0, 0, userContributionTotal)`. When `challenge.groupCurrentTotal` was stale in the 5-minute cache at 0 and the current user had not yet personally logged, the screen showed `0 / 30,000 minutes` even though the real team total was 210 minutes.
- **Competitive:** `leaderLabel` / `secondaryLabel` were computed by the resolver but never rendered. No ranking context shown.
- **All types:** No leaderboard section, no podium, no "No activity logged yet" state.

`ChallengeDetailScreen` avoided this by fetching the leaderboard (staleTime 60s), computing `memberSumContribution` from all members' `cumulativeLoggedValue`, and passing it to the resolver → `groupTotal = max(0, 210, 0, 0) = 210`.

### Fix

- Added `challenge-leaderboard-snapshot` `useQuery` to `SelectChallengeActivityScreen` with identical queryKey to `ChallengeDetailScreen` — TanStack Query serves from shared cache when the user navigated through Challenge Detail first; otherwise fetches fresh data.
- Added `challenge-participant-names` `useQuery` with identical queryKey.
- `resolveChallengeProgress` now receives `leaderboard`, `memberSumContribution`, and `currentUserId` — same call signature as `ChallengeDetailScreen`.
- `_rp.secondaryLabel` rendered below progress bar (shows leader gap for competitive; user contribution for collective).
- Compact leaderboard section added (rank badges, names, scores, empty state: "No activity logged yet. Be the first!").

### Tests

- 9 new guards in `scripts/testChallengeActivityModel.ts` (Phase 18I-6K block, 53/53 total)
- 18I-4C scoring guards updated to reflect new canonical approach (old guards enforced deprecated `cumulativeValues` path removed in 18I-6J)
- 18I-6J `testGroupUxPolish.ts` guard tightened: `membership.cumulativeValues` pattern narrowed so it does not match Firestore data reads in the leaderboard queryFn
- `tsc --noEmit` clean, `npm run build` clean, all 4 suites pass

### Files Changed

| File | Change |
|------|--------|
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Add leaderboard + names queries, updated resolver call, render secondaryLabel, add compact leaderboard section |
| `scripts/testChallengeActivityModel.ts` | 9 new Phase 18I-6K guards |
| `scripts/testScoringGuards.ts` | 18I-4C block updated to match new canonical approach |
| `scripts/testGroupUxPolish.ts` | Issue A guard pattern narrowed to `membership?.cumulativeValues` |

---

## Session: Phase 18I-6J — Group UX and Log Activity Polish (2026-07-03)

**Branch:** fix/p0-pre-deploy-blockers

### Fixed

- **Issue A:** Competitive challenge "My Progress" card in SelectChallengeActivityScreen now uses `resolveChallengeProgress` output (`membership.cumulativeLoggedValue`) instead of `membership.cumulativeValues` (per-activity map that was often 0). Progress now matches Challenge Detail.
- **Issue B:** Removed Group Leaderboard tab from `GroupDetailTabs`. Tab bar is now 3 tabs: Feed / Challenges / Members. Leaderboard route preserved; screen replaced with redirect message pointing to challenge-level leaderboards.
- **Issue C:** Challenge-level leaderboards (`ChallengeLeaderboardScreen`) unchanged and fully functional.
- **Issue E:** Created shared `GroupHeroHeader` component. All group tabs now show the full-bleed cover photo hero on entry. `GroupDetailScreen` and `GroupMembersScreen` updated; `GroupFeedScreen` unchanged (already had hero).
- **Issue D:** Member rows in `GroupMembersScreen` are now clickable. Tapping a row opens a bottom-sheet modal with name, role, joined date, and streak.
- **Issue F:** `useJoinGroup` now throws on null result (enabling TanStack retry), adds `retry: 1` (300 ms delay), and invalidates `home-screen-data` on success. `handleJoin` in `GroupDetailScreen` simplified accordingly.

### Tests

- 13/13 new guards in `scripts/testGroupUxPolish.ts` (`npm run test:group-ux-polish`)
- All existing suites remain green: `test:group-lifecycle`, `test:pilot-ux-polish-guards`, `tsc --noEmit`, `npm run build`

---

## Session: Phase 18I-6I — Home Challenge Cards Relevance (2026-07-03)

**Type:** UX relevance improvement. No schema changes, no Cloud Functions, no migrations.

### Changes

**My Challenges** (`useHomeScreen.ts`):
- Sort changed from `startDate desc` to: Tier 1 `lastActivityAt desc` (recently logged challenges first), Tier 2 `endDate asc` (soonest deadline for unlogged challenges). Uses `lastActivityAt` already in membership summaries — zero new reads.
- Limit raised from 3 → 10 (carousel shows 3 at a time, swipe for more).

**Most Active** (was "Most Popular") (`useHomeScreen.ts` + `HomeScreen.tsx`):
- Section renamed from "Most Popular" → "Most Active".
- Now batch-reads `challengeActivitySummaries/{id}` (Cloud Function–maintained aggregate) for all ongoing candidates.
- Sorted by `totalLogs` desc → `participantCount` desc fallback.
- Missing `challengeActivitySummaries` treated as `totalLogs = 0`; challenge not excluded.
- Stat label: `"X logs"` / `"X members"` fallback.
- Limit raised from 3 → 5.

### Guards

11 new guards in `scripts/testHomeChallengeFeeds.ts`.

### Report

`docs/superpowers/reports/phase-18I-6I-home-challenge-relevance.md`

---

## Session: Phase 18I-6H — Fix Collective Challenge Creation (2026-07-02)

**Type:** Validation bug fix. No data model, service, or UI layout changes.

### Root cause

`challengeFormValidation.ts` had a stale check blocking Collective challenge creation:

```ts
if (!input.groupCumulativeTarget || Number(input.groupCumulativeTarget) <= 0) {
  return 'Set a group cumulative target greater than zero.';
}
```

The UI input for `groupCumulativeTarget` was removed in a prior phase (now derived from `activities[0].targetValue` at payload time). But the validation interface still accepted the field and all callers still passed the now-always-empty state variable `''` → error always fired for Collective.

### Fix

- Removed `groupCumulativeTarget: string` from `ChallengeFormValidationInput`
- Removed the stale blocking check
- Removed stale field from all four `validateChallengeForm` call sites (wizard, admin create, admin edit wellness, audit script)
- Fixed wizard "Ready to launch?" collective checklist item to check `activities.some(a => Number(a.targetValue) > 0)` instead of `groupCumulativeTarget` state

Payload derivation (`groupCumulativeTarget: Number(finalActivities[0]?.targetValue ?? 0)`) was already correct in all four creation paths — no payload changes needed.

### Guards

9 new guards added to `testChallengeActivityModel.ts`. **44/44 passing.** All other suites unchanged.

### Report

`docs/superpowers/reports/phase-18I-6H-collective-challenge-validation-fix.md`

---

## Session: Phase 18I-6G Final Gap — Template Engine Filter Labels (2026-07-02)

**Type:** UI fix only. No logic, service, or data model changes.

### Root cause

Engine filter chips on Admin Challenge Templates showed only emoji (`👥`, `🏆`, `🔥`) with no text labels. Visually ambiguous; easy to miss. Filter logic was already correct.

### Fix

`ChallengeTemplatesScreen.tsx`: labels changed to `All Types / 👥 Collective / 🏆 Competitive / 🔥 Streak`. Added `flex-wrap` to chip row.

Test guards strengthened: 2 new assertions check for visible text labels. **66/66 passing.**

### Report

`docs/superpowers/reports/phase-18I-6G-final-template-engine-filter-labels.md`

---

## Session: Phase 18I-6G Follow-up — Challenge Management Fixes (2026-07-02)

**Type:** Admin bug fix + new screen. No member-facing changes.

### Root causes fixed

- Sidebar label still said "Active Challenges" (hardcoded in AdminSidebar.tsx)
- `getAllChallenges()` returned raw Firestore `status` with no date logic; expired challenges appeared as "Active"
- Challenge Management row navigated to member challenge detail (`/app/challenges/:id`); no admin detail screen existed
- Analytics refresh button called `refetch()` with no loading/timestamp feedback

### Changes

- `AdminSidebar.tsx`: "Active Challenges" → "Challenge Management"
- `adminChallengeService.ts`: exported `deriveEffectiveStatus()` utility; `AdminChallengeRow` now includes `effectiveStatus`; `getAllChallenges()` and `getChallengeAnalytics()` both use effective status (expired-active → completed, future-active → upcoming)
- `ActiveChallengesScreen.tsx`: filter, badge, and ActionMenu all use `effectiveStatus`; row click → `/app/admin/challenges/:id`
- `AdminChallengeDetailScreen.tsx`: **new screen** — name/status/type/category/group/dates/activities/engine fields/lifecycle actions
- `App.tsx`: `/app/admin/challenges/:id` route added
- `useAdminChallenges.ts`: added `useAdminChallenge(id)` hook
- `ChallengeAnalyticsScreen.tsx`: `isRefetching` feedback + `dataUpdatedAt` timestamp on refresh button
- Template engine filter (collective/competitive/streak) was already working — no code change needed; guards confirm

### Validation

All commands ✅ — tsc clean, build clean, 64/64 admin-challenge-management guards (+24 new in Section 10).

### Report

`docs/superpowers/reports/phase-18I-6G-followup-challenge-management-fixes.md`

---

## Session: Phase 18I-6G — Admin Challenge Management + Analytics + Featured Templates (2026-07-02)

**Type:** Admin UI overhaul + service extensions. No changes to member-facing logging or scoring.

### Changes

**Challenge Management screen** (`ActiveChallengesScreen.tsx`):
- Renamed from "Active Challenges" to "Challenge Management"
- Full status filter (all/active/upcoming/completed/archived/inactive/draft/pending), type filter (collective/competitive/streak), category dropdown, and search
- Per-row status badge with colour coding
- Contextual action menu per row: deactivate/complete/archive for active; reactivate for inactive; delete with confirmation modal
- Row links to challenge detail; group name links to admin group detail

**Challenge Analytics screen** (`ChallengeAnalyticsScreen.tsx`):
- Replaced static placeholder with live data from enhanced `getChallengeAnalytics()`
- 9 metric cards, by-type completion rates, by-category bar breakdown, top-10 challenges by participants

**adminChallengeService.ts**:
- `getAllChallenges()` — fetch all challenges ordered by startDate desc, mapped to `AdminChallengeRow`
- `archiveChallenge()`, `deactivateChallenge()`, `reactivateChallenge()`, `markChallengeCompleted()`, `deleteChallenge()` (soft delete)
- `getChallengeAnalytics()` now returns 13 fields including `byCategory`, `topByParticipants`, `completionRateByType`, `recentlyCreated`

**Featured templates** (Task D):
- `challengeTemplateService` + `wellnessTemplateService`: `isFeatured`, `featuredAt`, `featuredBy` fields; `featureTemplate()`, `unfeatureTemplate()` methods; `getPublishedTemplates`/`getTemplates` sort featured first
- `ChallengeTemplatesScreen.tsx`: Feature/Unfeature menu items, ⭐ Featured badge on card
- `types/index.ts`: `isFeatured?`, `featuredAt?`, `featuredBy?` added to `WellnessTemplate`
- New hooks: `useFeatureTemplate`, `useUnfeatureTemplate`, `useFeatureWellnessTemplate`, `useUnfeatureWellnessTemplate`

**Test guards**: `scripts/testAdminChallengeManagement.ts` — 40 guards, 9 sections.

### Manual retest needed

- Create/deactivate/reactivate a challenge via Challenge Management screen
- Feature a fitness template; confirm ⭐ badge appears; confirm featured templates sort first in member gallery
- Feature a wellness template; same verification

### Validation

All commands ✅ — tsc clean, build clean, 40/40 admin-challenge-management guards, all prior suites passing.

### Report

`docs/superpowers/reports/phase-18I-6G-admin-challenge-mgmt-analytics-featured-templates.md`

---

## Session: Phase 18I-6D — Group Document Schema Consistency (2026-07-02)

**Type:** Data model fix + audit tooling. No UI changes.

### Root Cause

`groupService.createGroup()` omitted `status` and `moderationStatus` from the group document payload. The Cloud Function `challengeCreationBackend.ts` checks `group.status === 'active'` — when `status` is missing it evaluates as `''` which fails the check, blocking challenge creation for all app-created groups.

### Fix

- `src/utils/groupLifecycle.ts`: Added `buildGroupDefaults()` — canonical field set for every new group. Updated `isGroupActive()` to also check `moderationStatus !== 'deactivated'`.
- `src/services/groupService.ts`: `createGroup()` now uses `buildGroupDefaults()` — new groups always write `status: 'active'`, `moderationStatus: 'active'`, `visibility`, `isFeatured`, `isVerified`, `reviewStatus`.
- `src/types/index.ts`: Added `visibility`, `isFeatured`, `isVerified`, `reviewStatus`, `countersUpdatedAt` to `Group` interface.
- `scripts/seedAppData.ts`: All 6 seed groups include the full canonical schema.
- `scripts/auditGroupDocumentSchema.ts`: New dry-run/repair script for existing Firestore docs.
- `package.json`: Added `audit:group-document-schema` script.
- `scripts/testGroupLifecycle.ts`: Tests 22–29 added (64 total passing).

### Manual retest needed

Yes — create a new group, then create a challenge in it. Challenge creation should succeed without "group is not active" error.

Run audit against live Firestore: `npx tsx scripts/auditGroupDocumentSchema.ts`

### Validation

All commands ✅ — tsc clean, build clean, 64/64 group-lifecycle guards.

### Report

`docs/superpowers/reports/phase-18I-6D-group-schema-consistency.md`

---

## Session: Phase 18I-4B — Add wellnessLogs to Group Feed (2026-06-29)

**Type:** Service fix. No UI component changes.

### Fix

`src/services/groupInsightsService.ts` `getGroupFeed()`: Added parallel `wellnessLogs WHERE groupId == groupId` query alongside existing `workouts` query. Merges both, deduplicates by composite key (`workout:<id>` / `wellness:<id>`), sorts newest-first, limits to 10. Challenge-created fallback now only triggers when both collections are empty. Wellness items use `loggedAt` as timestamp and `logType` for metric label.

`scripts/testScoringGuards.ts`: Added guards 18I-4B-1 through 18I-4B-10.

### Manual retest needed

Yes — log a wellness activity → navigate to group feed → wellness log should appear as feed item.

### Validation

All commands ✅

### Report

`docs/reports/phase-18I-4B-wellness-logs-in-feed.md`

---

## Session: Phase 18I-4A — Fix Mini-Leaderboard Stale Cache (2026-06-29)

**Type:** Cache invalidation fix. No UI or scoring changes.

### Fix

`src/hooks/useWorkouts.ts`: Added `challenge-leaderboard-snapshot` invalidation to both `useLogWorkout` and `useLogWellnessActivity` `onSuccess` handlers. Previously this key was never invalidated, causing the `ChallengeDetailScreen` mini-leaderboard to show stale data for up to 60s after logging.

`scripts/testScoringGuards.ts`: Added guards 18I-4A-1/2/3.

### Manual retest needed

Yes — navigate challenge detail → log activity → return to detail → verify mini-leaderboard is fresh.

### Validation

All commands ✅

### Report

`docs/reports/phase-18I-4A-mini-leaderboard-invalidation.md`

---

## Session: Phase 18I-3 — Full Logging Flow Integrity Audit (2026-06-29)

**Type:** Audit only. No code changes.

### Confirmed Bugs

| ID | Sev | Description |
|----|-----|-------------|
| BUG-3-1 | CRITICAL | `challenge-leaderboard-snapshot` never invalidated after log → stale mini-leaderboard |
| BUG-3-2 | HIGH | `ChallengeLeaderboardScreen` resolves names via `useGroupMembers` (group scope) → unrelated users appear |
| BUG-3-3 | HIGH | `SelectChallengeActivityScreen` shows 0/7,000 — `cumulativeValues` key mismatch suspected |
| BUG-3-4 | HIGH | `getGroupFeed()` queries only `workouts` — wellness logs never appear in feed |
| BUG-3-5 | MEDIUM | `'core-blast'` hardcoded fallback in 4 screens — wrong challenge loads silently |
| BUG-3-6 | MEDIUM | Group leaderboard sums all `challengeMembers` for group — seeded scores contaminate |
| BUG-3-7 | LOW | `group-feed` not invalidated after log (secondary to BUG-3-4) |

### Fix Plan

- 18I-4A: Invalidate `challenge-leaderboard-snapshot` after log
- 18I-4B: Add `wellnessLogs` to `getGroupFeed()`
- 18I-4C: Investigate + fix `cumulativeValues` key mismatch
- 18I-4D: Scope leaderboard name lookup to challenge participant set
- 18I-4E: Targeted seed data cleanup for `challengeMembers`
- 18I-4F: Remove `'core-blast'` fallbacks
- 18I-4G: Invalidate `group-feed` after log

### Seed Data Finding

`cleanupSeedData.ts` detects seed docs by `seedTag` or `seed_*` ID pattern but does NOT cover `challengeMembers`. A separate targeted cleanup is needed for seeded `challengeMembers` docs.

### Report

`docs/reports/phase-18I-3-logging-flow-integrity-audit.md`

---

## Session: Phase 18I-2C — Logging + Leaderboard Regression Guards (2026-06-29)

**Type:** Test-only. No production behaviour changes.

### What was added

`scripts/testScoringGuards.ts` — three new guard sections:

- **18I-2C-L (Logging):** `removeUndefinedDeep` applied in both services; raw `logPayload` not written; behavioural test strips undefined at top/nested/deep level; all four wellness methods present; `scoringVersion: 'v2'` stamp.
- **18I-2C-S (Sorting):** `sortLeaderboardRows` still exported; neither leaderboard screen has inline `.sort()`; behavioural tests for all four sort paths (streak, competitive, collective, legacy).
- **18I-2C-D (Display):** Collective `scoreLabel` is empty; `ChallengeLeaderboardScreen` renders `%`, day(s), pts per engine; both leaderboard queries scoped to `challengeId`.

### Validation

All commands ✅

### Report

`docs/reports/phase-18I-2C-regression-guards.md`

---

## Session: Phase 18I-2B — Mini-Leaderboard Engine-Sensitive Display (2026-06-29)

**Type:** UI display fix. No backend, no rules, no scoring changes.

### Problem

`ChallengeDetailScreen` mini-leaderboard always showed `totalPoints` and "pts" label regardless of challenge type, even though sort order was already engine-correct.

### Fix

- `src/features/Challenges/ChallengeDetailScreen.tsx`: Engine-sensitive `score`/`scoreLabel` map — streak → `currentStreak` / "day streak"; competitive → `completionRate×100` / "%"; collective → `cumulativeLoggedValue` / (none); default → `totalPoints` / "pts". JSX renders `entry.scoreLabel` conditionally.
- `scripts/testScoringGuards.ts`: Added guards 18I-2B-1 through 18I-2B-10.

### Validation

All commands ✅

### Report

`docs/reports/phase-18I-2B-challenge-detail-mini-leaderboard.md`

---

## Session: Phase 18I-2A — wellnessLogService Undefined Payload Fix (2026-06-29)

**Type:** Service bug fix. No backend, no rules, no scoring changes.

### Problem

`wellnessLogService` called `batch.set(logRef, logPayload)` without sanitizing `undefined`. Optional fields (`notes`, `moodBefore`, `moodAfter`, `startTime`, `endTime`, `intakeMl`, `bedtime`, `wakeTime`, `quality`) could be `undefined` → Firestore write error.

### Fix

- `src/services/wellnessLogService.ts`: Added `removeUndefinedDeep` (same implementation as `workoutService`); applied as `batch.set(logRef, removeUndefinedDeep(logPayload))`.
- `scripts/testScoringGuards.ts`: Updated existing guard to match new call form; added guards 18I-2A-1 through 18I-2A-5.

### Validation

All commands ✅

### Report

`docs/reports/phase-18I-2A-wellness-undefined-payload-fix.md`

---

## Session: Phase 18I-1 — Full Logging + Leaderboard Audit (2026-06-29)

**Type:** Audit only — no code changes.

### Confirmed Bugs

- **BUG-I-1** (`ChallengeDetailScreen.tsx` line 116): mini-leaderboard `score` always mapped to `totalPoints` regardless of engine type; sort is correct but display is always "pts". Fix: Phase 18I-2B.
- **BUG-I-2** (`wellnessLogService.ts` line 218): `batch.set(logRef, logPayload)` called without `removeUndefinedDeep`. Optional fields (`notes`, `moodBefore`, `moodAfter`, `startTime`, `endTime`, `intakeMl`, `bedtime`, `wakeTime`, `quality`) can be `undefined` → Firestore write error. Fix: Phase 18I-2A.

### Design Concern

- **CONCERN-I-3** (`groupInsightsService.ts`): group leaderboard sums `totalPoints` across all challenges (pre-v2 model); not engine-sensitive. Recommendation: label as "All-time group points" and defer engine-sensitive redesign.

### Confirmed PASS

- `workoutService` — `removeUndefinedDeep` present, group membership validated, targetType derived correctly
- `ChallengeLeaderboardScreen` — engine-sensitive sort + rendering, correct query scope
- `leaderboardSort.ts` — engine-aware sort logic verified
- `challengeService.leaveChallenge` — blocked after logging (Phase 18G-2E guard)
- `firestore.rules` wellnessLogs — `points >= 0` on both branches (Phase 18G-2E fix)

### Report

`docs/reports/phase-18I-1-full-logging-leaderboard-audit.md`

### Validation

All commands ✅ · No code changed.

---

## Session: Phase 18H — Streak UX Clarity (2026-06-29)

**Type:** UI copy + component labels only. No backend, no rules, no scoring changes.

### Changes

- `CreateChallengeWizard.tsx`: step label "Frequency" → "Streak"; review copy updated; streak settings card adds "days in a row" and "/ day" per-activity targets
- `ChallengeEngineSettingsSection.tsx`: "consecutive days" helper text clarified; new "per day" callout box added
- `ChallengeActivitySection.tsx`: "Target Value" → "Daily Target" (+ sub-label) for streak challenges
- `ChallengeDetailScreen.tsx`: streak section shows "Best Streak", "Daily targets" sub-header, explicit `/ day` labels per activity
- `testScoringGuards.ts`: 10 new guards (18H-1 through 18H-10)

### Deferred
`logMeditation` metadata.moodBefore undefined — post-18H logging audit.

### Firestore rules deployment
Not required — no rules changed.

### Validation
All commands ✅ · `audit:challenge-creation-payloads` ✅

### Report
`docs/reports/phase-18H-streak-ux-clarity.md`

---

## Session: Phase 18G-2E — Service Safety Guards (2026-06-29)

**Type:** Service logic + Firestore rules + test guards.

### Fixes

1. **`leaveChallenge` activity guard** — service now throws if `activitiesCompleted > 0`. Members who have logged cannot leave; pre-log members can still leave normally.
2. **wellnessLogs Firestore rule** — v1 branch changed from `points >= 1` to `points >= 0`. Zero-point wellness logs (below minimum effort threshold) are no longer blocked by the rule.

### Known Issue Documented (deferred)
`logMeditation` metadata may silently lose `moodBefore`/`moodAfter` when undefined. Deferred to post-18H logging audit.

### Changes

- `challengeService.ts`: added `activitiesCompleted > 0` guard in `leaveChallenge`
- `firestore.rules`: wellnessLogs v1 `points >= 1` → `points >= 0`
- `testScoringGuards.ts`: 7 new guards (18G-2E-1 through 18G-2E-7)

### Firestore rules deployment
Required — wellnessLogs points rule changed.

### Validation
All commands ✅ · `firebase deploy --only firestore:rules --dry-run` ✅

### Report
`docs/reports/phase-18G-2E-service-safety-guards.md`

---

## Session: Phase 18G-2D — Target Type + Group Membership Consistency (2026-06-29)

**Type:** Service logic + test guards. No Firestore rules change. No schema change.

### Issues Fixed

1. **`targetType` hardcoded to `'daily'`** in both `workoutService` and `wellnessLogService` — now derived from `activityConfig?.targetType ?? 'daily'`. Cumulative challenges now pass the correct type to `deriveDailyTargetValue`.
2. **`workoutService` missing group membership check** — non-group-members could log into group challenges via the auto-join self-heal. Added parallel read of `groupMembers` doc + same `['active', 'joined']` status gate that `wellnessLogService` already had.

### Changes

- `workoutService.ts`: added parallel `groupMembers` read; added active-membership guard; derived `targetType` from `activityConfig`
- `wellnessLogService.ts`: derived `targetType` from `activityConfig` (guard already present, unchanged)
- `testScoringGuards.ts`: 7 new guards (18G-2D-1 through 18G-2D-7)

### Firestore rules deployment
Not required — no rules changed.

### Validation
All commands ✅

### Report
`docs/reports/phase-18G-2D-target-type-group-membership.md`

---

## Session: Phase 18G-2C — Wellness Logging Auto-Join Parity (2026-06-29)

**Type:** Service logic + test guards. No Firestore rules change.

### Bug Fixed: BUG-G3 (MEDIUM)

`wellnessLogService` threw immediately on missing `challengeMembers` doc. `workoutService` auto-joins and retries. Fixed by mirroring the self-heal pattern — group membership validation still runs first (security gate preserved).

### Changes

- `wellnessLogService.ts`: added `challengeService` import; replaced hard throw with `joinChallenge` + re-fetch pattern
- `testScoringGuards.ts`: 8 new guards (18G-2C-1 through 18G-2C-8)

### Firestore rules deployment
Not required — no rules changed.

### Validation
All commands ✅

### Report
`docs/reports/phase-18G-2C-wellness-log-auto-join.md`

---

## Session: Phase 18G-2B — Remove Duplicate participantCount Writes (2026-06-29)

**Type:** Service logic + Firestore rules + test guard updates. No schema change.

### Bug Fixed: BUG-G1 (HIGH)

`joinChallenge` wrote `participantCount: increment(1)` in its batch AND the `onChallengeMemberCreated` trigger also incremented it → every join = +2. Same for leave.

### Changes

- `challengeService.joinChallenge`: removed `batch.set(challengeRef, { participantCount: increment(1) })` — trigger is now the only writer
- `challengeService.leaveChallenge`: removed `batch.set(challengeRef, { participantCount: increment(-1) })` and the now-unused `challengeRef` variable
- `firestore.rules`: removed temporary `participantCount`-only challenge update branch added in Phase 18G-2A.1 (no longer needed since client no longer writes it)
- `testScoringGuards.ts`: guards 13D-1/13D-2 inverted (now assert client does NOT write); 18G-6/6b/6c updated

### `totalChallenges` confirmed not duplicated — untouched.

### Requires Deployment
Both `firestore.rules` and frontend bundle must be deployed. Deploy rules first.

### Validation
All commands ✅ (tsc, build, test:scoring-guards, test:home-challenge-feeds, firebase dry-run)

### Report
`docs/reports/phase-18G-2B-participant-count-authority.md`

---

## Session: Phase 18G-2A.1 — Fix Join Challenge Permission Denied (2026-06-29)

**Type:** `firestore.rules` + regression guards. No service logic changed.

### Bug Fixed

`joinChallenge` and `leaveChallenge` both batch-write `{ participantCount: increment(±1) }` to the challenge document. The challenge `allow update` rule had no path for non-creator group members — the entire 3-write batch was rejected. Result: `FirebaseError: Missing or insufficient permissions` on every join/leave by a non-creator.

**Root cause existed before Phase 18G-2A** — discovered during post-Phase-18G-2A manual testing.

### Fix

Added a `participantCount`-only update branch to the challenge `allow update` rule:
```
|| (
  (isGroupMember(resource.data.groupId) || isPublicGroup(resource.data.groupId))
  && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participantCount'])
)
```

`hasOnly(['participantCount'])` prevents any other field from being changed via this path. The Cloud Function trigger is authoritative — this client write is an optimistic display update, superseded by the trigger. Will be removed in Phase 18G-2B (BUG-G1 fix).

### Regression Guards Added
10 guards (section 18G) added to `scripts/testScoringGuards.ts`.

### Files Changed
- `firestore.rules`
- `scripts/testScoringGuards.ts`

### Requires Deployment
`firestore.rules` must be deployed to unblock join in production.

### Validation
```
npx tsc --noEmit               → ✅
npm run build                  → ✅
npm run test:scoring-guards    → ✅ (all guards + new 18G-1…18G-10)
npm run test:home-challenge-feeds → ✅
firebase deploy --dry-run      → ✅ Compiled
```

### Report
`docs/reports/phase-18G-2A-1-join-permission-fix.md`

---

## Session: Phase 18G-2A — Collective Firestore Rule Fix (2026-06-29)

**Type:** `firestore.rules` change only. No TypeScript or service logic changed.

### Bug Fixed: BUG-G6 (CRITICAL)

The `allow update` rule for `challenges/{challengeId}` contained `!(request.resource.data.moderationStatus == 'approved')`. For UPDATE operations, `request.resource.data` is the merged post-write document, so any update that doesn't touch `moderationStatus` still carries the existing `'approved'` value — making the creator branch always evaluate to false for active challenges. Result: `atomicCollectiveGroupUpdate` was denied for all non-admin members.

**Two-part fix:**

1. **Creator branch:** Replaced `!(request.resource.data.moderationStatus == 'approved')` with `request.resource.data.moderationStatus == resource.data.moderationStatus`. Creators can now update approved challenges provided they don't change `moderationStatus`. Only moderators can change `moderationStatus`.

2. **New collective-progress branch:** Added `isActiveCollectiveProgressUpdate(challengeId)` — allows active challenge members to write exactly `{groupCurrentTotal, status, completedAt}` on v2 collective challenges that are currently active. Any other field in the write set is rejected by `hasOnly()`.

3. **Split update/delete:** `allow update, delete: if ...` split into separate `allow update` and `allow delete` rules for clarity. Delete behavior is functionally unchanged.

**New helpers:** `isActiveChallengeMember(challengeId)` and `isActiveCollectiveProgressUpdate(challengeId)` added as top-level functions.

### Files Changed
- `firestore.rules`

### Validation
```
npx tsc --noEmit                              → ✅
npm run build                                 → ✅ 4.28s
npm run test:scoring-guards                   → ✅ 14 guards
npm run test:home-challenge-feeds             → ✅
firebase deploy --only firestore:rules --dry-run → ✅ Compiled (3 pre-existing warnings unchanged)
```

### Report
`docs/reports/phase-18G-2A-collective-firestore-rule-fix.md`

---

## Session: Phase 18G-1 — Join, Leave, Log Activity Audit (2026-06-28)

**Type:** Read-only audit. No code changed.

### Confirmed Bugs (7)

| ID | Severity | Summary |
|---|---|---|
| BUG-G6 | CRITICAL | Firestore challenge `update` rule blocks `groupCurrentTotal` writes for all non-admin users — collective challenge logging is completely broken in production |
| BUG-G1 | HIGH | `participantCount` double-write: client batch + `onChallengeMemberCreated` trigger both increment on every join (+2 instead of +1) |
| BUG-G3 | MEDIUM | `wellnessLogService` lacks auto-join self-heal; `workoutService` has it — wellness logging fails on race condition |
| BUG-G2 | MEDIUM | `ChallengeContext.targetType` hardcoded to `'daily'` in both logging services; per-activity targetType also not passed in activities array |
| ARCH-1 | DESIGN | Group membership check inconsistency: `wellnessLogService` validates group membership, `workoutService` does not |
| BUG-G4 | LOW | `leaveChallenge` service allows leaving after logging — UI-only guard |
| BUG-G5 | LOW | Firestore v1 wellnessLog rule requires `points >= 1`; 0-point logs on v1 path blocked (v2 path unaffected) |

### Files Inspected
`challengeService.ts`, `workoutService.ts`, `wellnessLogService.ts`, `collectiveGroupUpdate.ts`, `scoringConfig.ts`, `streakEngine.ts`, `competitiveEngine.ts`, `collectiveEngine.ts`, `challengeCompletion.ts`, `memberCounters.ts`, `functions/index.ts`, `firestore.rules`

### Report
`docs/reports/phase-18G-1-join-leave-log-audit.md`

### Validation (baseline — no regressions)
All 7 validation commands pass ✅

---

## Session: Phase 18F-1 — Engine-Aware Challenge Detail + Duration Regression Fix (2026-06-28)

**Type:** Frontend + test change. No Firestore writes.

### Duration Regression Fix
`CreateChallengeWizard` was sending `startDate` + `endDate` without `durationDays`. Backend fell back to date subtraction. Under some serialization edge cases this produced 6 instead of 7 days, causing the streak validation error "requiredConsecutiveDays (7) cannot exceed durationDays (6)".

**Fix:** Added `durationDays: challengeDurationDays ?? undefined` to the callable payload.

### ChallengeDetailScreen Rework
Replaced hardcoded "Daily Targets" and "How Points Work" sections with engine-aware sections:
- v2 Collective → "Team Goal" (groupCumulativeTarget, progress bar, contribution explanation)
- v2 Competitive → "Personal Target" (per-activity targets, completion-rate ranking)
- v2 Streak → "Streak Goal" (requiredConsecutiveDays, currentStreak, longestStreak)
- Legacy v1 → unchanged (existing sections preserved)

Added `targetLabel()` helper that respects `targetType` (cumulative/daily/weekly/monthly). Fixes "700,000 steps /day" mis-label for cumulative collective challenges.

### Regression Test Added
June 28 → July 4 inclusive-duration guard added to `testChallengeCreationBackend.ts`.

### Files Changed
- `src/features/Challenges/CreateChallengeWizard.tsx`
- `src/features/Challenges/ChallengeDetailScreen.tsx`
- `scripts/testChallengeCreationBackend.ts`

### Validation
All 6 validation commands pass: `tsc`, `build`, `test:challenge-creation-backend`, `test:challenge-creation-6combos`, `audit:challenge-creation-payloads`, `test:scoring-guards`, `test:home-challenge-feeds` ✅

---

## Session: Phase 18E-1 — Group Challenge Authorization Fix (2026-06-28)

**Type:** Backend logic change — Cloud Function only. No Firestore writes.

### Problem
Any group member attempting to create a group challenge received "Only the group owner can create challenges in this group" because the `allowMemberChallenges === false` gate had no admin bypass.

### Fix
Removed the `allowMemberChallenges` owner-only gate from `challengeCreationBackend.ts`. Added member-based authorization:
- Owner/admin/member of any group can create challenges
- Non-members are still blocked
- Private group + regular member → challenge enters `pending` moderation status
- Public group or owner/admin → challenge is immediately `active`

### Files Changed
- `functions/src/challengeCreationBackend.ts` — authorization + moderation status logic
- `scripts/testChallengeCreationBackend.ts` — replaced 1 old test with 3 new scenario tests

### Validation
- `npx tsc --noEmit` → ✅
- `npm run build` → ✅ 8.39s
- `test:challenge-creation-backend` → ✅
- `test:challenge-creation-6combos` → ✅
- `audit:challenge-creation-payloads` → ✅
- `test:scoring-guards` → ✅

---

## Session: Phase 18D-4 — Wellness Firestore Seed (2026-06-28)

**Type:** Firestore write — `wellnessActivities` collection replaced. Explicit approval granted.

### Seed Results
- Deleted: 18 retired documents
- Created: 25 new documents
- Updated: 42 existing documents
- **Final collection count: 67** (matches local catalog exactly)

### Script Fixes Applied Before Running
1. Added deletion pass for retired documents (original script only upserted, would have left 85 docs)
2. Removed hard-coded `GOOGLE_APPLICATION_CREDENTIALS` guard (ADC works without it)

### Post-Seed Verification
- `auditFirestoreWellnessActivities.ts` → 67/67 IDs match, 0 deletions pending, 0 inserts pending, 0 field diffs, risk: SAFE
- `auditWellnessActivityCatalog.ts` → ✅ PASS (21/21 guards)
- `npx tsc --noEmit` → ✅
- `npm run build` → ✅ 8.04s

### Collections Touched
`wellnessActivities` only. No other collection accessed or modified.

### Picker Impact
The wellness activity picker now shows:
- All 10 categories including Movement and Health Monitoring
- Target-free display names (no embedded quantities)
- 18 retired activities removed from picker
- `targetType` present on all 67 activities

### Report
`docs/reports/phase-18D-4-wellness-firestore-seed.md`

---

## Session: Phase 18D-3C — Read-Only Firestore Migration Audit (2026-06-28)

**Type:** Read-only Firestore audit. No writes. No deletions. No seeds.

### New Script
- `scripts/auditFirestoreWellnessActivities.ts` — reads live Firestore, compares against local catalog, produces full migration preview

### Key Findings
- **Firestore:** 60 documents, 8 categories, 8 activity types
- **Local catalog:** 67 documents, 10 categories, 12 activity types
- **Retained IDs:** 42 (same ID, field changes only)
- **Deletion candidates:** 18 (retired activities — `fasting-20hr-fast` through `fasting-72hr-fast`, `habits-deep-work`, etc.)
- **Insertion candidates:** 25 (all movement + health-monitoring activities + new activities in existing categories)
- **Field updates:** 42 documents (all missing `targetType`; 34 also have name changes)
- **Legacy embedded-quantity names:** 16 Firestore names will be replaced or deleted (e.g. "10-Min Mindfulness", "16-Hour Fast (16/8)")
- **Hardcoded ID references:** None found in source files
- **In-flight challenge impact:** None — `challenge.activities[]` is denormalized at creation time

### Risk Level
**LOW** — No hardcoded references to deletion candidates; in-flight challenges unaffected; all changes are additive or corrective

### Validation
- `npx tsc --noEmit` → ✅
- `npm run build` → ✅ 7.43s
- `npx tsx scripts/auditWellnessActivityCatalog.ts` → ✅ PASS (21/21)
- `npx tsx scripts/auditFirestoreWellnessActivities.ts` → ✅ Read-only, 0 writes

### Report
`docs/reports/phase-18D-3C-firestore-migration-preview.md`

### Next Step
Phase 18D-4 (Firestore seed) — requires explicit approval before execution

---

## Session: Phase 18D-3B — Wellness UI Category Support (2026-06-28)

**Type:** UI/type code fixes only. No Firestore writes. No seed scripts.

### Files Changed
- `src/features/Challenges/components/ChallengeActivitySection.tsx` — WELLNESS_CATEGORIES extended to 10; `wellnessCategoryLabel()` added for clean rendering
- `src/services/wellnessTemplateService.ts` — `toCategory()` accepts `movement` and `health-monitoring`
- `src/types/index.ts` — `WellnessTemplate.category` union extended
- `src/features/Challenges/CreateChallengeWizard.tsx` — `challengeCategory` state type extended (ripple from type fix)
- `src/services/catalogMetadata.ts` — Updated to 10 categories, 12 activity types (was dead code with 8/8)
- `scripts/auditWellnessActivityCatalog.ts` — Added Guards G18–G21 (Section H: UI & Service Consistency)

### Picker Category Order
`all` · `movement` · `hydration` · `sleep` · `mindfulness` · `nutrition` · `fasting` · `habits` · `stress` · `social` · `health-monitoring`

### Audit Result
21 / 21 guards pass

### Validation
- `npx tsc --noEmit` → ✅
- `npm run build` → ✅ 7.71s
- `npx tsx scripts/auditWellnessActivityCatalog.ts` → ✅ PASS (21/21)

### Report
`docs/reports/phase-18D-3B-wellness-ui-category-support.md`

### Remaining Blocker
Legacy Firestore `wellnessActivities` collection — replaced in Phase 18D-4 (requires explicit approval)

---

## Session: Phase 18D-2 — Wellness Catalog Static Integrity Audit (2026-06-28)

**Type:** New audit script only. No production code changes. No Firestore writes.

### Deliverable
- `scripts/auditWellnessActivityCatalog.ts` — 17 deterministic guards across 8 sections

### Guard Sections
- **A** Catalog integrity (total count, category count, required fields, ID uniqueness, shortName uniqueness, name uniqueness)
- **B** ID stability (all retained legacy IDs present; all retired IDs absent)
- **C** Naming rules (no embedded numeric quantities in display names; globally unique names)
- **D** Category counts (per-category expected totals)
- **E** Target types (every activity has `targetType`; only valid values; cumulative movement activities)
- **F** Metadata quality (no negative targets, blank fields, empty arrays)
- **G** Type safety (new union values present in catalog)

### Result
17 / 17 guards passed — 0 violations

### Notes
- Guard 9 scoped to numeric-prefix patterns only (avoids "Screen-Free Hour" false positive)
- Guard 11 counts match approved 18D-1 catalog (hydration=5, habits=8), not the draft 18D-2 spec (6/7)

### Validation
- `npx tsc --noEmit` → ✅
- `npm run build` → ✅
- `npx tsx scripts/auditWellnessActivityCatalog.ts` → ✅ PASS

### Report
`docs/reports/phase-18D-2-static-catalog-audit.md`

---

## Session: Phase 18D-1 — Wellness Catalog Code Update (2026-06-28)

**Type:** Code changes only. No Firestore writes. No seed scripts.

### Files Modified
- `src/types/wellnessActivity.ts` — added `movement`, `health-monitoring` categories; `steps`, `walking`, `yoga`, `monitoring` activity types; optional `targetType` field
- `src/services/adminWellnessActivityService.ts` — extended validation Sets
- `src/features/Admin/Wellness/wellnessActivityFormUtils.ts` — extended UI dropdown arrays
- `src/data/wellnessActivitiesCatalog.ts` — full rewrite: 67 activities, 10 categories

### Catalog Changes
- **New categories:** `movement` (8 activities), `health-monitoring` (5 activities)
- **Added:** 25 new activities total
- **Retired:** 18 activities (removed from picker; Firestore documents untouched)
- **Renamed:** 14 display names to remove embedded quantities (shortName preserved → IDs stable)
- **Added `targetType`** to every catalog entry: `daily` | `cumulative` | `weekly` | `monthly`

### Validation
- `npx tsc --noEmit` → ✅ No errors
- `npm run build` → ✅ Built in 6.92s

### Report
`docs/reports/phase-18D-1-wellness-catalog-code-update.md`

---

## Session: Phase 18C — Wellness Activity Framework Spec (2026-06-28)

**Type:** Spec / audit only. No production code changes. No Firestore writes.

### Deliverables
- `docs/architecture/wellness-activity-framework.md` — canonical framework reference
- `docs/reports/phase-18C-wellness-activity-framework-spec.md` — detailed spec with audit, migration plan, risks

### Key Findings
- **60 current activities** across 8 categories. 14 activity names embed quantities (violates target-separation rule).
- **Steps is missing** — the highest-engagement mobile wellness metric. Walking distance and Yoga also missing.
- **No `targetType` field** in `WellnessActivity` interface — needed for collective scoring differentiation.
- **ID safety:** Renaming `name` only (not `shortName`) requires zero Firestore migration. IDs derived from `shortName` stay frozen.
- **18 activities proposed for retirement** (removed from picker, Firestore documents preserved).
- **25 new activities** across 2 new categories (`movement`, `health-monitoring`) + existing categories.

### Proposed Final Catalog
67 activities across 10 categories. Movement (8) + Hydration (6) + Sleep (6) + Mindfulness (9) + Nutrition (9) + Fasting (4) + Habits (7) + Stress (7) + Social (6) + Health Monitoring (5).

### Implementation Phases Defined
- **18D-1:** TypeScript types + catalog code update (no writes)
- **18D-2:** Static audit guards (`auditWellnessActivityCatalog.ts`)
- **18D-3:** Admin preview / manual check
- **18D-4:** Seed to Firestore (requires explicit approval)

---

## Session: Phase 18B-1 — Fix Stale Duration Scoring Guard (2026-06-28)

**Type:** Stale test guard fix only. No production code changes.

### Problem
`npm run test:scoring-guards` failed on guard 15E-1 after Phase 18B changed the backend fallback formula from `Math.round` to `Math.floor + 1`. The guard used an exact string match against the old formula.

### Fix
`scripts/testScoringGuards.ts` guard 15E-1 updated to match the new inclusive formula (`Math.floor + 1`). Guard intent preserved — still rejects any path that defaults to 14 when dates are present.

### Test Results
All 6 suites pass: `tsc` clean · build 9.69s · `test:scoring-guards` ✅ · `test:challenge-creation-backend` ✅ · `test:challenge-creation-6combos` ✅ · `audit:challenge-creation-payloads` ✅

---

## Session: Phase 18B — Challenge Duration Calculation Consistency (2026-06-28)

**Type:** Bug fix. No Firestore schema changes. No production writes.

### Problem Fixed
"requiredConsecutiveDays (7) cannot exceed durationDays (6)" when creating a 7-day streak (Aug 1–Aug 7). Backend fallback used `Math.round` (exclusive = 6); all frontend callers used `Math.floor + 1` (inclusive = 7).

### Rule Established
Challenge duration is inclusive of startDate and endDate. Aug 1 → Aug 7 = 7 days. Formula: `Math.floor(diff / msPerDay) + 1`.

### Changes

| File | Change |
|---|---|
| `src/features/Challenges/utils/challengeDuration.ts` | **Created** — `calculateInclusiveDurationDays()` shared utility |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Uses shared utility; inline formula removed |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Uses shared utility; local `toDurationDays` removed |
| `functions/src/challengeCreationBackend.ts` | Fallback: `Math.round` → `Math.floor + 1` |
| `src/services/challengeService.ts` | Legacy ARCH-2 path: `Math.round` → `Math.floor + 1` |
| `scripts/testChallengeCreationBackend.ts` | 4 new Phase 18B duration guards |

### Test Results
`tsc` clean · build 5.22s · all 5 test suites pass · 7-day streak with `requiredConsecutiveDays=7` now passes backend validation via fallback path.

## Session: Phase 17G — Automated Challenge Creation E2E Audit (2026-06-28)

**Type:** Audit + test suite. No production code changes.

### Environment
No Firebase emulator configured; no staging project. All tests run via FakeDb (same harness as existing `testChallengeCreationBackend`). No production reads/writes.

### Pre-existing Failures Fixed in Test Scripts
- `testChallengeCreationBackend.ts`: `totalActivities: 0` → `7` (1 activity × 7 days); 2 stale `doesNotMatch` guards corrected to reflect current architecture (ARCH-1, ARCH-2).

### Architectural Findings (pre-existing, outside scope)
- **ARCH-1**: `challengeService.joinChallenge` writes `participantCount: increment(1)` AND `onChallengeMemberCreated` trigger also increments it → double-write → `participantCount` = 2× real count.
- **ARCH-2**: `challengeService.createChallenge` is a legacy direct Firestore write path. `CreateChallengeWizard` calls `httpsCallable('createChallengeWithCreatorMembership')` directly and never invokes the hook's mutation function — the hook is only used for its `isPending` state.

### All 6 Combinations: PASS
Fitness × {Collective, Competitive, Streak} and Wellness × {Collective, Competitive, Streak} all produce correct Firestore payloads via `createChallengeWithCreatorMembershipCore`.

### New Script
`scripts/testChallengeCreation6Combinations.ts` — 6 FakeDb integration tests (10 assertions each) + 8 wellness category checks.

### Files Changed

| File | Change |
|---|---|
| `scripts/testChallengeCreationBackend.ts` | Fixed 3 stale assertions |
| `scripts/testChallengeCreation6Combinations.ts` | Created |
| `package.json` | Added `test:challenge-creation-6combos` |

### Validation

```
npx tsc --noEmit                     →  CLEAN
npm run build                        →  ✓ built in 6.17s
npm run test:scoring-guards          →  13 guards passed
npm run test:home-challenge-feeds    →  all guards passed
npm run audit:challenge-creation-payloads → 8/8 guards passed
npm run test:challenge-creation-backend   →  all guards passed
npm run test:challenge-creation-6combos   →  all 6 combos passed
```

Report: `docs/reports/phase-17G-challenge-creation-e2e-audit.md`

---

## Session: Phase 17F-4 — Simplify Streak MVP: Remove Frequency Field (2026-06-28)

**Type:** UI removal. No backend, validation, schema, or service changes.

### Decision
For MVP, Streak = consecutive daily logging. The per-activity "How often?" selector conflicted with "Required Consecutive Days" and was removed from all screens. `requiredConsecutiveDays` + `streakResetOnMiss` remain the sole streak controls.

### Change
Removed the `{challengeType === 'streak' && (...)}` frequency select block from `ChallengeActivitySection`. The `challengeType` prop is retained (call sites unchanged). `frequency` field stays optional in `ActivityRow` and in payloads — the value is harmless; the streak engine does not read it.

### New Script
`scripts/auditChallengeCreationPayloads.ts` — 8-guard static audit verifying UI labels, shared component usage, payload shape, and validation correctness for all 6 mode×type combinations.

### Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Removed frequency `{challengeType === 'streak' && (...)}` block |
| `scripts/auditChallengeCreationPayloads.ts` | Created (8-guard static audit) |
| `package.json` | Added `audit:challenge-creation-payloads` script |

### Validation

```
npx tsc --noEmit               →  CLEAN
npm run build                  →  ✓ built in 11.85s
npm run test:scoring-guards    →  13 guards passed
npm run test:home-challenge-feeds →  all guards passed
npm run audit:challenge-creation-payloads → 8/8 guards passed
```

Report: `docs/reports/phase-17F-4-remove-streak-frequency.md`

---

## Session: Phase 17F-3 — Refactor Fitness Template Edit to Shared Activity Section (2026-06-28)

**Type:** Refactor (BUG-2 from Phase 17F-1 audit). No schema, service, validation, or Firestore changes.

### Change
Replaced `EditChallengeTemplateScreen`'s inline activity UI (old `<datalist>` autocomplete + inline picker modal) with `ChallengeActivitySection`. All four creation/editing screens now use the shared component. Wellness props passed as inert stubs — screen remains fitness-only.

### Legacy UI Removed
- `<datalist>` autocomplete search input per activity row
- Inline target value / unit fields per row
- Inline exercise picker bottom-sheet modal
- Local 4-field `ActivityRow` type (replaced by imported canonical type)
- `pickerResults` memo (replaced by tier-filtered `pickerExercises`)
- `Plus`, `Search`, `X` lucide imports

### Added
- `pickerTier` state, `activityTierOptions` memo, `pickerExercises` memo
- Named handlers: `addActivity`, `removeActivity`, `openFitnessPicker`, `closeFitnessPicker`, `pickFitnessExercise`
- `isExercisesError` from `useExercises()`

### Files Changed

| File | Change |
|---|---|
| `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx` | Full activity section replaced with `ChallengeActivitySection` |

### Validation

```
npx tsc --noEmit  →  CLEAN
npm run build     →  ✓ built in 7.27s
```

Report: `docs/reports/phase-17F-3-fitness-template-edit-shared-activity.md`

---

## Session: Phase 17F-2 — Fix Wizard Wellness Add Activity Default Unit (2026-06-28)

**Type:** Bug fix (BUG-1 from Phase 17F-1 audit). No schema, service, validation, or Firestore changes.

### Fix
`addActivity` in `CreateChallengeWizard` was hardcoding `unit: 'Reps'` for every new row. Changed to `unit: isWellnessMode ? 'count' : 'Reps'`. Matches the existing behaviour in `CreateChallengeScreen`.

### Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | `addActivity` unit default: `'Reps'` → `isWellnessMode ? 'count' : 'Reps'` |

### Validation

```
npx tsc --noEmit  →  CLEAN
npm run build     →  ✓ built in 11.95s
```

Report: `docs/reports/phase-17F-2-wizard-wellness-default-unit.md`

---

## Session: Phase 17F-1 — Challenge Creation Flow Audit (2026-06-28)

**Type:** Audit only — no code changes.

### Scope
Full audit of all four challenge creation/editing routes: `CreateChallengeWizard`, `CreateChallengeScreen`, `EditChallengeTemplateScreen`, `EditWellnessTemplateScreen`, and `ChallengeActivitySection`.

### Confirmed Correct
- All six mode/type combinations show correct activity library and frequency field (Phase 17E-3 verified)
- All 3 `ChallengeActivitySection` call sites pass required `challengeType` prop
- Fitness and wellness pickers open, populate, and close correctly with no cross-contamination

### Confirmed Bugs (no fixes this phase)

| ID | Severity | Description | File |
|---|---|---|---|
| BUG-1 | Medium | Wizard `addActivity` hardcodes `unit: 'Reps'` in wellness mode | `CreateChallengeWizard.tsx` line 342 |
| BUG-2 | Medium | `EditChallengeTemplateScreen` uses old inline activity UI, not `ChallengeActivitySection` | `EditChallengeTemplateScreen.tsx` |
| BUG-3 | Low | Four independent local `ActivityRow` type definitions; exported canonical type not imported at call sites | Multiple |

### Files Changed
None.

### Validation
```
npx tsc --noEmit  →  CLEAN (zero errors)
npm run build     →  ✓ built in 18.09s (pre-existing vendor chunk warning only)
```

Report: `docs/reports/phase-17F-1-challenge-creation-flow-audit.md`

---

## Session: Phase 17E-3 — Restore Frequency Field for All Streak Challenges (2026-06-28)

**Type:** Bug fix (corrects Phase 17E-2 over-narrow condition). No schema, service, validation, or Firestore changes.

### Fix
Changed `ChallengeActivitySection` frequency render condition from `isWellnessMode && challengeType === 'streak'` to `challengeType === 'streak'`. Fitness + Streak now correctly shows "How often?" alongside Wellness + Streak.

### Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Condition narrowed to `challengeType === 'streak'` only |

### Validation

```
npx tsc --noEmit  →  CLEAN
npm run build     →  ✓ built in 10.74s
```

Report: `docs/reports/phase-17E-3-streak-frequency-field.md`

---

## Session: Phase 17E-2 — Wellness Activity Fields by Challenge Type (2026-06-28)

**Type:** UI bug fix. No schema, service, validation, or Firestore changes.

### Problem
"How often?" frequency selector rendered for Wellness + Collective and Wellness + Competitive, where it has no meaning.

### Fix
Added `challengeType` as a required prop to `ChallengeActivitySection`. Changed frequency render condition from `isWellnessMode` to `isWellnessMode && challengeType === 'streak'`.

### Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Added `challengeType` prop; gated frequency on `isWellnessMode && challengeType === 'streak'` |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Added `challengeType` prop to `ChallengeActivitySection` |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Added `challengeType` prop to `ChallengeActivitySection` |
| `src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx` | Added `challengeType` prop to `ChallengeActivitySection` |

### Validation

```
npx tsc --noEmit  →  CLEAN
npm run build     →  ✓ built
```

All six mode/type combinations verified. Report: `docs/reports/phase-17E-2-wellness-activity-fields.md`

---

## Session: Phase 13F — Admin & Template Workflow Audit (2026-06-26)

**Type:** Bug fixes (3 confirmed defects). No schema changes. No Firestore rules changes. No engine changes.

### Files Changed

| File | Change |
|---|---|
| `src/services/challengeTemplateService.ts` | Added v2 engine fields to types and `fromDoc` |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Added UI + state for collective/streak engine fields in fitness templates |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Applies engine fields from template on load |
| `scripts/testScoringGuards.ts` | Guards 13F-1 through 13F-14 |

### Defects Fixed

| Defect | Description |
|---|---|
| DEFECT-13F-1 | `SuggestedChallengeTemplate` type and `fromDoc` missing engine fields |
| DEFECT-13F-2 | Admin create screen had no UI for collective/streak engine config |
| DEFECT-13F-3 | Wizard did not apply engine fields when loading a fitness template |

### Validation

```
npx tsc -b --pretty false         → 0 errors ✅
npm run build                     → ✓ built in 2.97s ✅
npm run test:scoring-guards       → scoring guards passed (13C-1 through 13F-14) ✅
npm run test:home-challenge-feeds → all guards passed ✅
npx tsx scripts/testPhase13E.ts   → 170/170 checks passed ✅
```

---

## Session: Phase 13E — Production Verification (2026-06-26)

**Type:** Verification only. No code changes. New verification suite added.

### Deliverable

`scripts/testPhase13E.ts` — 170-check deterministic verification suite covering all 4 engines, concurrency simulation (2/5/25/100 users), join/leave lifecycle, long-running streak simulation (30/90/180/365 days), edge cases, leaderboard sort, deriveDailyTargetValue regression, and static regression audit.

### Validation

```
npx tsc -b --pretty false         → 0 errors ✅
npm run build                     → ✓ built in 2.94s ✅
npm run test:scoring-guards       → scoring guards passed ✅
npm run test:home-challenge-feeds → all guards passed ✅
npx tsx scripts/testPhase13E.ts   → 170/170 checks passed ✅
```

**Release recommendation:** ✅ RELEASE CANDIDATE

---

## Session: Phase 13D — Data Integrity Hardening (2026-06-26)

**Type:** Bug fixes (BUG-005, BUG-006, BUG-007, BUG-008 from Phase 13A QA). No schema changes. No Firestore rules changes. No engine changes. No scoring changes.

### Files Changed

| File | Change |
|---|---|
| `src/services/challengeService.ts` | BUG-005: `joinChallenge` increments `participantCount`; `leaveChallenge` decrements both `participantCount` and `totalChallenges` via batch; removed redundant manual setDoc from `createChallenge`. BUG-006: `leaveChallenge` decrements `stats.totalChallenges`. BUG-007: `createChallenge` rejects mixed-unit collective challenges. Added `targetType` to activities type. |
| `src/services/challengeCompletion.ts` | BUG-008: `deriveDailyTargetValue` accepts optional `targetType?: 'daily' \| 'cumulative'`; explicit metadata takes precedence over heuristic; heuristic fallback unchanged |
| `src/services/workoutService.ts` | BUG-008: pass `activityConfig?.targetType` to `deriveDailyTargetValue`; add `targetType` to inline activities type |
| `src/services/wellnessLogService.ts` | BUG-008: same as workoutService |
| `scripts/testScoringGuards.ts` | Add guards 13D-1 through 13D-11 |

### Validation

```
npx tsc -b --pretty false          → 0 errors ✅
npm run build                      → ✓ built in 3.17s ✅
npm run test:scoring-guards        → scoring guards passed ✅
npm run test:home-challenge-feeds  → all guards passed ✅
```

---

## Session: Phase 13C — Atomic Collective Completion (2026-06-26)

**Type:** Bug fix (BUG-001 from Phase 13A QA). No schema changes. No scoring changes. No leaderboard changes. No Firestore rules changes.

### Files Changed

| File | Change |
|---|---|
| `src/utils/collectiveGroupTransition.ts` | NEW: Pure `computeGroupTransition()` — no Firebase deps, fully testable |
| `src/services/collectiveGroupUpdate.ts` | NEW: `atomicCollectiveGroupUpdate()` using `runTransaction`; re-exports pure function |
| `src/services/workoutService.ts` | BUG-001: Remove `FieldValue.increment` on challenge doc from batch; call `atomicCollectiveGroupUpdate` after batch commit; suppress collective completion in batch |
| `src/services/wellnessLogService.ts` | BUG-001: Same changes as workoutService |
| `scripts/testScoringGuards.ts` | Add guards 13C-1 through 13C-6; update Phase 11C and 12D-14/15 guards for new indirection |

### Root Cause Fixed

**BUG-001 (Critical — Race Condition):** Two users logging simultaneously both read `groupCurrentTotal` before any write is committed. Both compute `estimatedNewTotal < target`, so neither fires the cascade. After both batches commit, the actual Firestore total exceeds `target` but the challenge remains stuck in `active`.

**Fix:** Move the group-total write out of the batch and into a `runTransaction`. The transaction:
1. Reads the live `groupCurrentTotal` (not a stale pre-read snapshot)
2. Computes `newTotal = currentTotal + delta`
3. Clamps: `groupCurrentTotal = min(newTotal, groupCumulativeTarget)`
4. If `status !== 'completed'` AND `newTotal >= target`: atomically writes `status: 'completed', completedAt`
5. If `status === 'completed'`: exits without any writes (idempotent)

Concurrent transactions retry on conflict. The first to commit completion wins. Subsequent retries read `status='completed'` and exit cleanly — no double cascade.

The `isCompleted` result from the engine is suppressed for collective challenges in the batch; completion is now driven entirely by the transaction result.

### Architecture

```
workoutService / wellnessLogService
  └─ batch.commit()                    ← workout log + membership stats (no challenge doc)
  └─ atomicCollectiveGroupUpdate()     ← Firestore transaction: group total + completion gate
       └─ computeGroupTransition()     ← pure fn in src/utils/collectiveGroupTransition.ts
       └─ updateDoc(triggeringMember)  ← mark triggering member completed (if transition)
       └─ cascadeCollectiveCompletion  ← fan out to remaining active members (if transition)
```

### Validation

```
npx tsc -b --pretty false          → 0 errors ✅
npm run build                      → ✓ built in 2.87s ✅
npm run test:scoring-guards        → scoring guards passed ✅
npm run test:home-challenge-feeds  → all guards passed ✅
```

---

## Session: Phase 13B-2 — Streak Integrity & Date Consistency (2026-06-26)

**Type:** Bug fixes (BUG-003, BUG-004 from Phase 13A QA). No schema changes. No scoring changes. No leaderboard changes.

### Files Changed

| File | Change |
|---|---|
| `src/utils/dateUtils.ts` | BUG-004: New shared `toLocalIsoDate(date)` utility using local device date components |
| `src/services/workoutService.ts` | BUG-004: Remove local `toIsoDate()`; import and use `toLocalIsoDate` |
| `src/services/wellnessLogService.ts` | BUG-004: Remove local `todayIsoDate()`; import and use `toLocalIsoDate` |
| `src/services/challengeService.ts` | BUG-003: Add `deleteField` import; reset `currentStreak`, `longestStreak`, `lastLogDate` on streak challenge join/rejoin |
| `scripts/testScoringGuards.ts` | Add guards 13B-2A through 13B-2E |

### Root Causes Fixed

**BUG-003:** `joinChallenge` used `batch.set(..., { merge: true })` without including streak fields in the payload. With `merge: true`, Firestore preserves any existing `currentStreak`, `longestStreak`, and `lastLogDate` on the document. A rejoining member who abandoned weeks ago could therefore inherit a stale streak, and with `streakResetOnMiss = false`, the engine would advance it despite the gap. Fix: detect `engineVersion === 'v2' && challengeType === 'streak'` and spread `{ currentStreak: 0, longestStreak: 0, lastLogDate: deleteField() }` into the payload. `deleteField()` (not `undefined`) is required to actually remove the field from Firestore.

**BUG-004:** `workoutService.toIsoDate()` used `date.toISOString().split('T')[0]` — a UTC date. `wellnessLogService.todayIsoDate()` used `new Date().getFullYear()/.getMonth()/.getDate()` — a local date. For users in UTC- timezones logging after midnight UTC (but before midnight local time), the same physical moment produced different ISO date strings across the two services, corrupting `lastLogDate` and causing streak miscounts. Fix: single `toLocalIsoDate(date)` utility in `src/utils/dateUtils.ts`, imported by both services.

### Validation

```
npx tsc -b --pretty false          → 0 errors ✅
npm run build                      → ✓ built in 3.96s ✅
npm run test:scoring-guards        → scoring guards passed ✅
npm run test:home-challenge-feeds  → all guards passed ✅
```

### Regression Guards Added

- **13B-2A** — `joinChallenge` resets `currentStreak: 0`, `longestStreak: 0`, `lastLogDate: deleteField()` for streak challenges
- **13B-2B** — Reset is conditional: gated on `isStreakChallenge` which requires both `engineVersion === 'v2'` and `challengeType === 'streak'`; Legacy/Competitive/Collective joins are not modified
- **13B-2C** — Both `workoutService` and `wellnessLogService` import `toLocalIsoDate` from `dateUtils`
- **13B-2D** — Local `toIsoDate()` and `todayIsoDate()` helpers are gone; UTC `.toISOString().split('T')[0]` pattern is gone from workout service
- **13B-2E** — Deterministic fixture: same `Date` object produces the same YYYY-MM-DD string from `toLocalIsoDate`; output matches direct local-component construction (the formula both services formerly used)

### Confirmation: No Other Engine Behaviour Changed

- `StreakEngine`, `CompetitiveEngine`, `CollectiveEngine`, `LegacyEngine` — no changes
- `computeActivityScore`, `computeRequiredLogs`, `deriveDailyTargetValue` — no changes
- Firestore rules, indexes — no changes
- Leaderboard sort logic — no changes
- Completion, notification, cascade logic — no changes
- The only change to `workoutService` and `wellnessLogService` is replacing the date helper function call; the resulting `date` string value is identical for all users in UTC and equivalent for UTC- users (now correctly local rather than wrongly UTC)

---

## Session: Phase 13B-1 — Leaderboard Correctness Fixes (2026-06-26)

**Type:** Bug fixes (BUG-013, BUG-002 from Phase 13A QA). No schema changes. No scoring changes.

### Files Changed

| File | Change |
|---|---|
| `src/services/challengeEngine/collectiveEngine.ts` | BUG-013: Add `cumulativeLoggedValue` accumulation to `membershipUpdate` |
| `src/utils/leaderboardSort.ts` | BUG-002: New shared sort utility with engine-specific ordering rules |
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | BUG-002: Replace inline sort with `sortLeaderboardRows` |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | BUG-002: Fetch all sort fields; replace inline totalPoints sort with `sortLeaderboardRows` |
| `scripts/testScoringGuards.ts` | Add guards 13B-1A, 13B-1B, 13B-1C; update conflicting Phase 11F 29.6 guard |

### Root Causes Fixed

**BUG-013:** `CollectiveEngine.computeCollectiveUpdate` returned `membershipUpdate` without `cumulativeLoggedValue`. The leaderboard screen already sorted by this field (correctly) but it was always 0 for all members because the engine never wrote it. One-line fix: `cumulativeLoggedValue: (membership.cumulativeLoggedValue ?? 0) + logEvent.value`.

**BUG-002:** `ChallengeDetailScreen` fetched only `{ userId, totalPoints }` from `challengeMembers` and sorted by `totalPoints` unconditionally. Streak challenges should sort by `currentStreak`; competitive by `completionRate`; collective by `cumulativeLoggedValue`. Fixed by: (1) creating `src/utils/leaderboardSort.ts` with the canonical sort rules, (2) applying it in both `ChallengeLeaderboardScreen` and `ChallengeDetailScreen`.

### Validation

```
npx tsc -b --pretty false          → 0 errors ✅
npm run build                      → ✓ built in 2.99s ✅
npm run test:scoring-guards        → scoring guards passed ✅
npm run test:home-challenge-feeds  → all guards passed ✅
```

### Regression Guards Added

- **13B-1A** — `CollectiveEngine` writes `cumulativeLoggedValue` additively from `membership.cumulativeLoggedValue + logEvent.value`
- **13B-1B** — Both `ChallengeLeaderboardScreen` and `ChallengeDetailScreen` import `sortLeaderboardRows`; neither has an inline `totalPoints`-only sort
- **13B-1C** — Deterministic fixture test: verifies correct ordering for all four engine types plus streak tiebreaker (longestStreak) and competitive tiebreaker (totalPoints)

Note: Phase 11F guard 29.6 updated — it previously asserted collective did NOT write `cumulativeLoggedValue` (documented as "group pool only"). That assumption is superseded by BUG-013.

---

## Session: Phase 13A — End-to-End QA Validation Matrix (2026-06-26)

**Type:** QA only — no code changes. Complete static-analysis validation of all 4 challenge engines.

### QA Output

- Report: `docs/reports/member-phase-13A-qa-validation-matrix.md`
- Engines covered: Legacy, Streak, Competitive, Collective
- Validation checkpoints: 64 total (41 PASS · 17 PARTIAL · 6 FAIL)
- Confirmed bugs: **13** (1 Critical · 4 High · 4 Medium · 4 Minor)

### Confirmed Bugs

| ID | Severity | Description |
|---|---|---|
| BUG-001 | Critical | Collective engine: concurrent logs can push group total over target without cascade firing |
| BUG-002 | High | Detail-screen mini-leaderboard sorts by `totalPoints` for all engines (wrong for Streak/Competitive) |
| BUG-003 | High | Rejoin on StreakEngine preserves stale `lastLogDate`/`currentStreak` — gap not reset |
| BUG-004 | High | Timezone mismatch: `workoutService` uses UTC date, `wellnessLogService` uses local date |
| BUG-005 | Medium | `participantCount` on challenge doc never incremented/decremented on join/leave |
| BUG-006 | Medium | `stats.totalChallenges` inflates on rejoin (leave doesn't decrement) |
| BUG-007 | Medium | Multi-activity collective challenges mix incompatible units in `groupCurrentTotal` |
| BUG-008 | Medium | `deriveDailyTargetValue` misidentifies per-session targets ≥ `durationDays` as cumulative |
| BUG-009 | Minor | Notifications are in-app Firestore only — no push delivery |
| BUG-010 | Minor | Streak `activitiesCompleted` reaches `totalActivities` in a single day (multiple logs) |
| BUG-011 | Minor | `selectEngine` throws for unknown v2 `challengeType` — no user-friendly fallback |
| BUG-012 | Minor | `streakService` and `StreakEngine` are independent systems — dual source of truth for streak |
| BUG-013 | High | Collective leaderboard sorts by `cumulativeLoggedValue` but `CollectiveEngine` never sets it |

### Recommended Fix Order

P0: BUG-013 (collective leaderboard), BUG-003 (streak rejoin), BUG-002 (detail leaderboard)  
P1: BUG-004 (timezone), BUG-001 (race condition — needs Cloud Function)  
P2: BUG-005, BUG-007, BUG-008  
P3: BUG-006, BUG-010, BUG-011, BUG-012  
P4: BUG-009 (feature gap)

---

## Session: Phase 12E — Release Candidate Audit (2026-06-25)

**Type:** Audit only — no code changes. Comprehensive production-readiness audit after Phases 12A–12D.

### Audit Output

- Report: `docs/reports/member-phase-12E-release-candidate-audit.md`
- Overall score: **82/100** (up from 67/100 in Phase 12 baseline)
- Recommendation: **READY WITH MINOR ISSUES**

### Open Findings (non-blocking)

| ID | Severity | Description |
|---|---|---|
| P1 | Medium | Admin service: 3 unbounded challenge collection scans |
| P2 | Medium | Group feed: unbounded workouts scan (JS slice to 10) |
| S1 | Medium | Admin routes rely on app-layer role checks only; Firestore rules allow any authed user to list challenges |
| TD2 | Minor | Wellness log doesn't invalidate `streak/*` query keys |

### Validation

```
npx tsc -b --pretty false   → 0 errors ✅
npm run build               → ✓ built in 2.82s ✅
npm run test:scoring-guards → all guards passed ✅
npm run test:home-challenge-feeds → all guards passed ✅
```

---

## Session: Phase 12D — Scalable Collective Challenge Completion (2026-06-25)

**Type:** Performance / correctness fix — no behavior change, no schema change, no UI change.

### Files Modified

| File | Change |
|---|---|
| `src/services/collectiveCompletionUtils.ts` | **New** — `MAX_WRITES_PER_BATCH = 450` constant and pure `chunkArray<T>` helper; no Firebase dependency |
| `src/services/collectiveCompletion.ts` | **New** — `cascadeCollectiveCompletion(challengeId, excludeRef)`: reads active members, chunks into ≤450-write batches, commits sequentially; re-exports utils |
| `src/services/workoutService.ts` | Replaced inline cascade for-loop with `await cascadeCollectiveCompletion(...)` call after primary batch commit |
| `src/services/wellnessLogService.ts` | Same |
| `scripts/testScoringGuards.ts` | 15 new Phase 12D guards covering batch math, no duplicates, idempotency, source-code checks |

### Issue Fixed

| ID | Before | After |
|---|---|---|
| H1 | All active member updates added to the primary Firestore batch — exceeded 500-write limit for challenges with 500+ members, causing silent batch failure | Primary batch commits challenge doc + own membership; remaining active members chunked into sequential batches of ≤450 writes each |

### Chunking strategy

```
MAX_WRITES_PER_BATCH = 450   (50-write safety margin below Firestore's 500-write limit)

Members:      Batches:
10            1 × 10
100           1 × 100
449           1 × 449
450           1 × 450
499           2 × [450, 49]
500           2 × [450, 50]
750           2 × [450, 300]
1200          3 × [450, 450, 300]
```

### Write order

1. Primary batch commits: workout/wellness log + own membership (`completed`) + user stats + challenge doc (`completed`)
2. `cascadeCollectiveCompletion` queries `where('status', '==', 'active')` — already-completed members excluded
3. Remaining members chunked and committed sequentially

### Failure behavior

If any cascade batch fails: logs `[cascadeCollectiveCompletion] batch commit failed` with `{ challengeId, batchIndex, batchSize, totalBatches }` and re-throws. Subsequent re-runs re-query `'active'` members and resume from remaining uncompleted members (idempotent).

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.86s
npm run test:scoring-guards        → scoring guards passed (15 new Phase 12D guards)
npm run test:home-challenge-feeds  → all guards passed
```

---

## Session: Phase 12C — Harden Firestore Security Rules (2026-06-25)

**Type:** Security fix — only `firestore.rules` modified.

### Files Modified

| File | Change |
|---|---|
| `firestore.rules` | `challengeMembers` block: replaced vacuous get rule with proper ownership/group/admin checks |

### Issues Fixed

**H2 — `allow get` rule fixed:**

| | Before | After |
|---|---|---|
| Rule | `allow get: if isAuthenticated() && (resource == null \|\| resource.data == null \|\| resource.data.userId == request.auth.uid \|\| isAuthenticated())` | `allow get: if isAuthenticated() && (resource == null \|\| resource.data == null \|\| resource.data.userId == request.auth.uid \|\| isGroupMember(resource.data.groupId) \|\| isPublicGroup(resource.data.groupId) \|\| canModerateChallenges())` |
| Effect | Final `\|\| isAuthenticated()` made ownership check vacuous — any authenticated user could read any membership | Only own doc, same-group member, public-group visitor, or moderator can read |

**H3 — `allow list` rule limitation documented:**

Firestore security rules cannot inspect WHERE-clause parameters on flat collection list queries (`resource` is null for list operations). The `allow list: if isAuthenticated()` rule is unchanged — scoping is enforced at the application layer where all queries include `challengeId`, `userId`, or `groupId` constraints.

### challengeMembers query audit

| Query | Where clause | Satisfies new get rule | Satisfies list rule |
|---|---|---|---|
| `workoutService` — log self | `getDoc(${challengeId}_${userId})` | `resource.data.userId == uid` ✅ | n/a |
| `wellnessLogService` — log self | `getDoc(${challengeId}_${userId})` | `resource.data.userId == uid` ✅ | n/a |
| `activityLogSessionService` — log self | `getDoc(${challengeId}_${userId})` | `resource.data.userId == uid` ✅ | n/a |
| `challengeService.getChallengeMembership` | `getDoc(${challengeId}_${userId})` | `resource.data.userId == uid` ✅ | n/a |
| `challengeService.joinChallenge` | `getDoc(${challengeId}_${userId})` | `resource == null` (new member) or `uid` match ✅ | n/a |
| `challengeService.leaveChallenge` | `getDoc(${challengeId}_${userId})` | `resource.data.userId == uid` ✅ | n/a |
| `ChallengeLeaderboardScreen` | `where('challengeId', '==', id)` | n/a | `isAuthenticated()` ✅ |
| `ChallengeDetailScreen` inline | `where('challengeId', '==', id)` | n/a | `isAuthenticated()` ✅ |
| `ChallengeCompletedScreen` | `where('challengeId', '==', id)` | n/a | `isAuthenticated()` ✅ |
| `useWorkouts` progress | `where('challengeId', '==', id)` | n/a | `isAuthenticated()` ✅ |
| `challengeService.getChallengeParticipantCount(s)` | `where('challengeId', 'in', chunk)` | n/a | `isAuthenticated()` ✅ |
| `challengeService.getUserChallengeMembershipIndex` | `where('userId', '==', uid)` | n/a | `isAuthenticated()` ✅ |
| `challengeService.getCompletedChallengesForUser` | `where('userId', '==', uid) + status` | n/a | `isAuthenticated()` ✅ |
| `groupInsightsService.getGroupLeaderboard` | `where('groupId', '==', groupId)` | n/a | `isAuthenticated()` ✅ |
| Collective cascade (workout + wellness) | `where('challengeId', '==', id) + status` | n/a | `isAuthenticated()` ✅ |

No client query adjustments needed.

### Validation

```
npx tsc -b --pretty false              → 0 errors
npm run build                          → ✓ built in 2.87s
npm run test:scoring-guards            → scoring guards passed
npm run test:home-challenge-feeds      → all guards passed
firebase deploy --only firestore:rules → ✓ compiled successfully (dry-run)
```

---

## Session: Phase 12B — Remove Unbounded Group Collection Scan (2026-06-25)

**Type:** Performance / scalability fix — no behavior change, no schema change, no UI change.

### Files Modified

| File | Change |
|---|---|
| `src/services/challengeService.ts` | `getVisibleChallengesForUser`: replaced `getDocs(collection(db, 'groups'))` with `getDocs(query(collection(db, 'groups'), where('isPrivate', '==', false)))` — scoped to public groups only |
| `scripts/testHomeChallengeFeeds.ts` | Added 3 Phase 12B guards: no bare groups scan, scoped isPrivate query present, userId-scoped membership lookup present |

### Issue Fixed

| ID | Before | After |
|---|---|---|
| C2 | `getDocs(collection(db, 'groups'))` — reads every group on the platform on every challenge discovery call | `getDocs(query(collection(db, 'groups'), where('isPrivate', '==', false)))` — reads only groups marked public |

### Query comparison

| Path | Before | After |
|---|---|---|
| Public group discovery | 1 × full groups collection scan (O(N groups)) | 1 × indexed `isPrivate == false` query (O(public groups)) |
| User membership lookup | 1 × scoped `userId ==` query ✓ | unchanged |
| Challenge queries | chunked by group ID ✓ | unchanged |

### Estimated Firestore read reduction

On a platform with 1 000 groups where 100 are public: **90% fewer group reads** per `getVisibleChallengesForUser` call. Reduction grows linearly with total group count.

### Behavior preserved

- Public groups (isPrivate: false) → challenges still discoverable
- User's own groups → challenges still included via membership lookup
- All status filtering, sorting, deduplication, participantCount enrichment unchanged

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.82s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed (3 new guards)
```

---

## Session: Phase 12A — Fix Critical Streak Engine Issues (2026-06-25)

**Type:** Bug fix — no UI redesign, no schema changes, no scoring changes.

### Files Modified

| File | Change |
|---|---|
| `src/services/workoutService.ts` | Added `requiredConsecutiveDays` and `streakResetOnMiss` to `challengeData` type cast and `ChallengeContext` |
| `src/services/wellnessLogService.ts` | Same as above |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Replaced hardcoded `currentStreak >= 100` with `currentStreak >= (challenge?.requiredConsecutiveDays ?? challenge?.durationDays ?? 0)` |
| `scripts/testScoringGuards.ts` | Added 5 regression guards: C1 context propagation (12A-1 through 12A-3), legacy routing unaffected (12A-4), competitive unaffected (12A-5) |

### Issues Fixed

| ID | Was | Now |
|---|---|---|
| C1 | `requiredConsecutiveDays` / `streakResetOnMiss` never read from Firestore; engine fell back to `durationDays` | Both fields read from challenge doc and forwarded into `ChallengeContext` in both logging services |
| H4 | `streakComplete = currentStreak >= 100` (hardcoded) | `streakComplete = currentStreak >= (challenge?.requiredConsecutiveDays ?? challenge?.durationDays ?? 0)` |

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 3.12s
npm run test:scoring-guards        → scoring guards passed (5 new guards added)
npm run test:home-challenge-feeds  → all guards passed
```

---

## Session: Phase 12 — Production Readiness Audit (2026-06-25)

**Type:** Audit only — no code changes made.

### Scope

7-part audit covering: engine correctness, user journeys, UI states, Firestore security rules, performance, regressions, and overall readiness score.

### Result

**Overall score: 67/100 — NOT READY for release.**

### Critical findings (must fix before release)

| ID | File(s) | Finding |
|---|---|---|
| C1 | `workoutService.ts`, `wellnessLogService.ts` | Streak engine context missing `requiredConsecutiveDays` and `streakResetOnMiss` — engine falls back to `durationDays`, breaking completion detection for all Streak v2 challenges |
| C2 | `challengeService.ts` | `getVisibleChallengesForUser` calls `getDocs(collection(db, 'groups'))` — unbounded O(N) full-collection scan on every page load |

### High findings

| ID | File(s) | Finding |
|---|---|---|
| H1 | `workoutService.ts`, `wellnessLogService.ts` | Collective cascade batch write can exceed Firestore 500-doc limit for large groups |
| H2 | `firestore.rules:184` | `challengeMembers` get rule: trailing `\|\| isAuthenticated()` makes userId ownership check vacuous |
| H3 | `firestore.rules` | `challengeMembers` list rule: no scope restriction, any authenticated user can list all memberships |
| H4 | `WorkoutLoggedScreen.tsx:56` | `streakComplete = currentStreak >= 100` — hardcoded; should use `challenge.requiredConsecutiveDays` |

### Full report

`docs/reports/member-phase-12-production-readiness.md`

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

---

## Session: UX-6 — Challenge Creation Wizard Polish (2026-06-25)

**Type:** UX/presentation only — no engine logic, scoring, Firestore rules, or schema changed.

### Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Guided 4-step wizard: step progress bar, per-step validation, live preview banners, launch readiness checklist |

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.78s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

### Key behaviour

- 4-step flow: Type → Configure (engine-specific label) → Activities → Review
- Step 2 label adapts: "Group Goal" (Collective) / "Frequency" (Streak) / "Configure" (Competitive)
- Per-step validation gates advancement with inline error banners
- Live preview banner (steps 2-3): name + engine badge + duration
- Launch readiness checklist (step 4): green ✓ per satisfied requirement
- Back button decrements steps; exits to challenges list from step 1
- All existing logic preserved: handleLaunch, template pre-fills, picker modals, scoring guards

---

## Session: UX-5 — Engine-aware Challenge Templates (2026-06-25)

**Type:** UX/presentation only — no engine logic, scoring, Firestore rules, or schema changed.

### Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/SuggestedChallengesScreen.tsx` | Engine grouping, explanation callouts, engine badges, improved modal |
| `src/features/Challenges/WellnessTemplateGalleryScreen.tsx` | Engine filter row, grouped view, engine badges |
| `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx` | Engine filter row, grouped display, engine badges |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Improved review section with full engine model table |

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.85s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

### Key behaviour

- Fitness templates (SuggestedChallengesScreen): grouped by Collective / Competitive / Streak with engine explanation callouts; engine badges on every card; modal includes "How X works" section
- Wellness templates: engine filter row + grouped view using `template.type`; engine badges on cards
- Admin template gallery: engine filter row + grouped view; engine badges on cards
- Wizard review: Header with type badge → Engine Model card (4 rows) → Type-specific settings card (Collective target / Streak days / Competitive targets table)
- Visual language: 👥 blue / 🏆 amber / 🔥 orange across all template surfaces

---

## Session: UX-4 — Engine-aware Completion Experience (2026-06-25)

**Type:** UX/presentation only — no engine logic, scoring, Firestore rules, or schema changed.

### Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Four-branch engine-aware rewrite (Collective / Competitive / Streak / Legacy) |

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.87s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

### Key behaviour

- Collective: team progress card, contribution % of group total, final rank, "You did it together."
- Competitive: position + completion % + per-activity bars + "Done" badge at 100%
- Streak: final/best streak grid, consistency %, days active/missed, 🔥 milestone badge
- All v2 branches: View Leaderboard CTA, Back to Group CTA (when groupId present)
- Legacy v1: unchanged original experience
- `useFinalRank` hook fetches challengeMembers once at completion; same sort logic as leaderboard

---

## Session: UX-3 — Engine-aware Challenge Leaderboards (2026-06-25)

**Type:** UX/presentation only — no engine logic, scoring, or Firestore rules changed.

### Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Extended hook + engine-specific sort, display, podium, pinned user |

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.78s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

### Key behaviour

- Collective: ranks by `cumulativeLoggedValue`; team progress banner; contribution % of group total
- Competitive: ranks by `completionRate` (tiebreaker: `totalPoints`); "Done" badge at 100%
- Streak: ranks by `currentStreak` (tiebreakers: `longestStreak`, then `totalPoints`); 🔥 badge at ≥ 7 days
- All types: top-3 podium, engine-specific "my stats" card, pinned "Your Position" if outside top 10
- Navigation from ChallengeDetailScreen → leaderboard: unchanged

---

## Session: UX-2 — Engine-aware Activity Logging Experience (2026-06-25)

**Type:** UX/presentation only — no engine logic, scoring, or Firestore rules changed.

### Files Modified

| File | Change |
|---|---|
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Engine context panel (group progress / per-activity bars / streak grid), "already logged today" banner, activity card engine sub-labels |
| `src/features/Workouts/LogWorkoutScreen.tsx` | Engine context banner (team total / cumulative / streak), engine-aware save button label |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Same as LogWorkoutScreen |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | Three distinct success experiences (Collective / Competitive / Streak), legacy v1 section preserved |

### Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.83s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

### Key behaviour

- Collective: group progress shown everywhere, no personal daily target, "Every contribution moves the team closer."
- Competitive: per-activity cumulative bars, just-logged activity highlighted on success
- Streak: current/best/to-go grid, progress bar, 7-day milestone celebrations
- "Already logged today" banner is informational — does NOT block logging
- v1 challenges: unchanged legacy experience (gated on `engineVersion === 'v2'`)

---

## Session: Phase 11H — Engine-aware Challenge Creation Wizard (2026-06-25)

**Type:** UI + service extension — engine-aware v2 fields wired into creation wizard. Zero behavioral change for v1 challenges or existing data.

### Files Modified

| File | Change |
|---|---|
| `src/types/index.ts` | Added v2 optional fields to `Challenge` interface (`engineVersion`, `groupCumulativeTarget`, `autoCompleteOnGroupTarget`, `groupCurrentTotal`, `requiredConsecutiveDays`, `streakResetOnMiss`) |
| `src/services/challengeService.ts` | Extended `CreateChallengeInput` with v2 fields; `createChallenge` payload writes them conditionally |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Type descriptions, type-specific settings sections (Collective: group target + auto-complete; Streak: required days + reset rule; Competitive: explanation only), v2 payload always includes `engineVersion: 'v2'`, validation for required type-specific fields, dynamic review summary card |

### Validation

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 2.78s
npm run test:scoring-guards    → scoring guards passed
```

### Key facts

- All new challenges get `engineVersion: 'v2'` written to Firestore
- Collective: requires `groupCumulativeTarget > 0`; writes `groupCumulativeTarget`, `autoCompleteOnGroupTarget`
- Streak: requires `requiredConsecutiveDays > 0`; writes `requiredConsecutiveDays`, `streakResetOnMiss`
- Competitive: no additional fields — per-activity `targetValue` already serves as cumulative target
- Admin template screen (`CreateChallengeScreen.tsx`) not modified — templates don't become live challenges directly
- Legacy challenges unaffected — no `engineVersion` → LegacyEngine

---

## Session: Phase 11G — Engine Verification & Regression Audit (2026-06-25)

**Type:** Audit only — no logic changes, no UI changes.

### Files Modified

| File | Change |
|---|---|
| `src/services/challengeEngine/legacyEngine.ts` | Fixed stale header comment ("NOT yet wired" → "Wired in Phase 11C") |
| `scripts/testScoringGuards.ts` | Added Section 30: 8 regression & edge-case fixture groups (11 total assertions) |

### Validation

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 2.85s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

### Key findings

- All 4 engines verified correct — no bugs found
- UI screens (WorkoutLoggedScreen, ChallengeCompletedScreen, HomeScreen, ChallengeDetailScreen, Leaderboards) — zero regression from phases 11D–11F
- LegacyEngine byte-for-byte identical to Phase 10 inline implementation
- Concurrency: 2 known limitations (missed completion in concurrent logs, batch overflow at scale) — both explicitly acceptable per spec
- Recommendation: **Safe to proceed to Phase 11H**

---

## Session: Phase 11F — CollectiveEngine v2 Activation (2026-06-25)

**Type:** Feature activation — enables CollectiveEngine for v2 collective challenges. Zero behavioral change for all v1 challenges.

### Files Modified

| File | Change |
|---|---|
| `src/services/challengeEngine/collectiveEngine.ts` | `computeUpdate` delegates to `computeCollectiveUpdate`; header updated |
| `src/services/challengeEngine/index.ts` | JSDoc updated to Phase 11F active |
| `src/services/workoutService.ts` | Added collective fields to type cast + context; `challengeSnapshot` passed to engine; collective batch writes (group delta + cascade completion) |
| `src/services/wellnessLogService.ts` | Same as workoutService; added `getDocs, query, where` imports |
| `scripts/testScoringGuards.ts` | Updated guards 25F, 26.8, 27.10, 28.8; added Section 29 (9 fixtures) |

### Validation

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 3.46s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

### Completion model

- One shared group target (`groupCumulativeTarget`) across all members
- `groupCurrentTotal` updated via `FieldValue.increment(delta)` — never read-calculate-write
- Challenge completes when `estimatedNewTotal >= groupCumulativeTarget`
- On completion: `challenges/{id}` gets `status='completed'`; all active memberships cascade to `status='completed'`
- Individual members never "complete" independently — the group completes together
- Points are independent of completion (logged per activity, not tied to group target)

### Behavior matrix

| Engine | Status |
|---|---|
| LegacyEngine | Active (all v1) |
| StreakEngine | Active (v2 + streak — Phase 11D) |
| CompetitiveEngine | Active (v2 + competitive — Phase 11E) |
| **CollectiveEngine** | **Active (v2 + collective — Phase 11F)** |

Challenge engine framework is now complete. All four engines wired.

---

## Session: Phase 11E — CompetitiveEngine v2 Activation (2026-06-25)

**Type:** Feature activation — enables CompetitiveEngine for v2 competitive challenges. Zero behavioral change for all v1 challenges.

### Files Modified

| File | Change |
|---|---|
| `src/services/challengeEngine/competitiveEngine.ts` | `computeUpdate` delegates to rewritten `computeCompetitiveUpdate` (multi-activity per-activity cumulative tracking) |
| `src/services/challengeEngine/types.ts` | Added `cumulativeValues?: Record<string, number>` to `MembershipSnapshot` and `EngineResult.membershipUpdate` |
| `src/services/challengeEngine/index.ts` | Updated JSDoc comment to reflect Phase 11E active status |
| `src/services/workoutService.ts` | Added `cumulativeLoggedValue` and `cumulativeValues` to `MembershipSnapshot` |
| `src/services/wellnessLogService.ts` | Same pattern |
| `src/types/index.ts` | Added `cumulativeLoggedValue?` and `cumulativeValues?` to `ChallengeMember` |
| `scripts/testScoringGuards.ts` | Updated guards 25F, 26.8, 27.9; added Section 28 (8 fixtures) |

### Validation

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 2.74s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

### Completion model

- Each activity tracks cumulative value in `cumulativeValues[activityId]`
- `completionRate` = average per-activity rate, each capped at 100%
- `isCompleted` = every required activity (with `targetValue > 0`) reaches 100%
- `activitiesCompleted` still increments per log for analytics but does NOT drive completion
- Completion is individual: one member's completion does not affect others

### Behavior matrix

| Engine | Status |
|---|---|
| LegacyEngine | Active (all v1) |
| StreakEngine | Active (v2 + streak) |
| CompetitiveEngine | **Active (v2 + competitive)** |
| CollectiveEngine | Disabled — still throws |

### Next step

Phase 11F: Wire CollectiveEngine (v2) for collective challenges with group pool mechanics.

---

## Session: Phase 11D — StreakEngine v2 Activation (2026-06-25)

**Type:** Feature activation — enables StreakEngine for v2 streak challenges. Zero behavioral change for all existing v1 challenges.

### Files Modified

| File | Change |
|---|---|
| `src/services/challengeEngine/streakEngine.ts` | `computeUpdate` now delegates to `computeStreakUpdate` (no longer throws) |
| `src/services/challengeEngine/index.ts` | `default` case changed from `return new LegacyEngine()` to `throw` (fail loudly for unknown v2 types) |
| `src/services/workoutService.ts` | `membershipUpdate` now spreads all engine fields; added streak fields to `MembershipSnapshot` |
| `src/services/wellnessLogService.ts` | Same pattern as workoutService |
| `src/types/index.ts` | Added optional `currentStreak?`, `longestStreak?`, `lastLogDate?`, `engineVersion?` to `ChallengeMember` |
| `scripts/testScoringGuards.ts` | Updated guards 25F and 26.8; added Section 27 (10 streak engine fixtures) |

### Validation

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 2.88s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

### Behavioral change

**v1 challenges (all existing production data):** No change. `selectEngine({ engineVersion: undefined })` still returns LegacyEngine. Verified by guard 27.8.

**v2 streak challenges (none exist in production yet):** `selectEngine({ engineVersion: 'v2', challengeType: 'streak' })` now returns StreakEngine. Completion fires when `currentStreak >= requiredConsecutiveDays`. Fields written to Firestore: `currentStreak`, `longestStreak`, `lastLogDate`, `engineVersion: 'v2'`.

**Firestore write safety:** `totalPoints` still uses `increment()` for atomic writes. `status`/`completedAt` still use `Timestamp.now()`. Spread + delete approach ensures no raw `Date` or absolute number leaks into the batch.

### v2 engine status

- StreakEngine: **active** (Phase 11D)
- CompetitiveEngine: still throws "not wired yet" (Phase 11E)
- CollectiveEngine: still throws "not wired yet" (Phase 11E)

### Next step

Phase 11E: Creation wizard v2 gating — allow admins to create v2 streak challenges with `engineVersion: 'v2'` and `requiredConsecutiveDays`.

---

## Session: Phase 11C — LegacyEngine Integration (2026-06-25)

**Type:** Refactor only — zero user-visible behaviour changes.

### Files Modified

| File | Change |
|---|---|
| `src/services/workoutService.ts` | Replaced inline `nextCompleted`/`nextRate`/`if (nextRate >= 100)` block with `selectEngine().computeUpdate()` |
| `src/services/wellnessLogService.ts` | Replaced inline `completed`/`completionRate`/`if (completionRate >= 100)` block with `selectEngine().computeUpdate()` |
| `scripts/testScoringGuards.ts` | Added Section 26 (9 guards); updated Sections 14, 21C, 25G to reflect Phase 11C |

### Validation

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 3.37s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

### Behavioral change

None. `selectEngine(challengeData)` returns `LegacyEngine` for all existing v1 challenges (`engineVersion !== 'v2'`). LegacyEngine produces byte-for-byte identical `activitiesCompleted`, `completionRate`, and `isCompleted` values as the previous inline block (verified by 4 deterministic fixtures in guard 26.9). All Firestore writes use the same `increment()`/`Timestamp.now()` FieldValues in the same batch order.

### v2 engine status

Inactive. StreakEngine, CompetitiveEngine, CollectiveEngine still throw `"Engine not wired yet"`. No production challenge has `engineVersion: 'v2'`. Guards 26.5–26.8 verify this at test time.

### Next step

Phase 11D: Wire StreakEngine (v2) for streak challenges with `engineVersion: 'v2'` and `requiredConsecutiveDays` set. First type-specific completion model.

---

## Session: Phase 11B — Challenge Engine Framework (2026-06-25)

**Type:** New files only — no existing application files modified.

### Files Created

| File | Purpose |
|---|---|
| `src/services/challengeEngine/types.ts` | `ChallengeEngine` interface + `ChallengeContext`, `MembershipSnapshot`, `LogEvent`, `EngineResult`, `EngineVersion` types |
| `src/services/challengeEngine/legacyEngine.ts` | LegacyEngine — v1 frequency-counter logic as a pure class |
| `src/services/challengeEngine/streakEngine.ts` | StreakEngine stub (throws "not wired yet") + static pure helper |
| `src/services/challengeEngine/competitiveEngine.ts` | CompetitiveEngine stub + static pure helper |
| `src/services/challengeEngine/collectiveEngine.ts` | CollectiveEngine stub + static pure helper |
| `src/services/challengeEngine/index.ts` | `selectEngine(challenge)` — routes by engineVersion + challengeType |

### Files Modified

| File | Change |
|---|---|
| `scripts/testScoringGuards.ts` | Added Section 25 — 9 engine framework guards |

### Validation

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 4.67s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

### Behavioral change

None. `workoutService` and `wellnessLogService` are unmodified. v2 engine `computeUpdate` methods throw until Phase 11C wires them. All existing v1 behavior is preserved.

### Next step

Phase 11C: wire `selectEngine()` into `workoutService.createWorkout` and `wellnessLogService.writeLog`. Replace the inline completion block with `engine.computeUpdate(...)`. LegacyEngine produces identical output for all v1 challenges.

---

## Session: Phase 11A — Challenge Engine Specification (2026-06-25)

**Type:** Documentation only — no code changes, no Firestore changes, no application logic modified.

### Deliverables

- `docs/architecture/challenge-engine-spec.md` — Engine specifications for Streak, Competitive, and Collective engines; shared interface; sequence diagrams; API boundaries; test strategy; risks
- `docs/architecture/challenge-data-model.md` — Additive Firestore field extensions; backward compatibility matrix; index requirements; migration strategy

### Recommended Implementation Order

1. Streak Engine v2 (lowest risk — additive fields only, no group coordination)
2. Competitive Engine v2 (medium risk — `cumulativeLoggedValue` accumulation, new leaderboard index)
3. Collective Engine v2 (highest risk — atomic group-pool update, cascade completion write)
4. UI updates for all types
5. Creation wizard v2 gating
6. Template audit

### Key Architectural Decisions

- All existing challenges (`engineVersion: undefined`) use LegacyEngine — zero behavior change
- `engineVersion: 'v2'` is set only on new challenges created with the new wizard
- Engine is pure (no Firestore I/O) — service layer applies the returned `EngineResult` batch
- Collective uses `FieldValue.increment` (not read-then-write) to prevent race conditions on `groupCurrentTotal`
- Streak completion driven by `currentStreak >= requiredConsecutiveDays`, not log count
- Competitive completion driven by `cumulativeLoggedValue >= targetValue`, not log count

---

## Session: Phase 11 — Challenge Type Model Architecture Audit (2026-06-25)

**Type:** Audit only — no code changes, no database writes, no Firestore changes.

### Deliverable

`docs/reports/member-phase-11-challenge-type-architecture-audit.md`

### Summary

Full architecture audit of how challenge types (Collective, Competitive, Streak) are implemented. All 17 source files read and analyzed. No code modified.

**Core finding:** `challengeType` is a display label. All three types share identical completion mechanics:
- `computeRequiredLogs = durationDays × activityCount` (universal — same for all types)
- `activitiesCompleted` is a log event counter, not a value accumulator
- `computeActivityScore` does not branch on `challengeType`
- Completion fires at `activitiesCompleted >= totalActivities` for all types

**Type-specific verdict:**
- Streak: mostly works (heuristic target scaling via `deriveDailyTargetValue`); gap = no daily uniqueness enforcement
- Competitive: fundamentally wrong — no cumulative value accumulation tracked; completion = N log events, not N reps total
- Collective: fundamentally wrong — no group pool total; no shared target; members complete independently

**Pre-existing UI regressions identified (not introduced this session):**
- `WorkoutLoggedScreen`: completion bar = `totalValue / totalDays` — wrong model (Tier A)
- `ChallengeCompletedScreen`: `completionPct = uniqueDays / totalDays` — streak-specific hardcoded (Tier A)

**Leaderboards are correct.** Both challenge and group leaderboards correctly use `challengeMembers.totalPoints`.

**Verdict:** Moderate Refactor (not a full redesign). 3-collection schema is sound. ~4–6 targeted implementation tasks required to make all three types behave correctly.

---

## Session: CRIT-3 Step 3B — ChallengeDetailScreen visual redesign (2026-06-25)

### Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Full visual redesign: orange hero card, chips, day progress bar, stats row, daily targets card, How Points Work, leaderboard snapshot with View All, CTA area |

### What Changed

Render layer only — all Step 3A logic preserved unchanged. New layout:
1. **Hero card** — `rounded-[24px] bg-primary`, type+mode chips, title, description, "Day N of D" progress bar, start/end dates, status label.
2. **Stats row** — 3 white cards: My Logs, Total Logs, Participants.
3. **Daily Targets** — Zap icon + divider rows: activity name, `targetValue unit freq`.
4. **How Points Work** — updated copy; multi-activity addendum when `activities.length > 1`.
5. **Leaderboard snapshot** — top 5 by `challengeMembers.totalPoints`, rank badges, "View All →" → `/app/challenges/leaderboard?challengeId=X`.
6. **CTA area** — exact Step 3A decision table, Leave button, secondary nav.

### Validation

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 3.51s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

---

## Session: CRIT-3 Step 3A — ChallengeDetailScreen correctness + CTA audit/fix (2026-06-24)

### Files Modified

| File | Change |
|---|---|
| `src/hooks/useWorkouts.ts` | `useChallengeProgress`: `myLogs` now reads `activitiesCompleted` from `challengeMembers` snap instead of counting raw `workouts`+`wellnessLogs` docs — eliminates My Logs > Total Logs divergence |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | CTA restructure; type/mode/current-day display; daily target label; points copy update; persistent warning removed |
| `scripts/testHomeChallengeFeeds.ts` | Updated guard: `wellnessLogs` collection query → `activitiesCompleted` + `myDoc` check (reflects new myLogs source) |

### Root Causes Fixed

1. **My Logs > Total Logs** — `myLogs` was raw doc count (uncapped); `totalLogs` was `sum(activitiesCompleted)` (capped). Now both use the capped `activitiesCompleted` accounting, so `myLogs <= totalLogs` always holds.
2. **Active member on ended challenge showed "Completed" (disabled)** — `challengeIsOver` was only checked in the `!membership` branch. Moved to second branch so it covers all non-completed memberships.
3. **Persistent warning text** — "You've already logged activity..." was always shown. Removed; Leave button now hidden once `myLogs > 0`, no warning text.
4. **Missing UI: type, mode, current day, daily target, points copy** — Added all.

---

## Session: CRIT-3 Step 2 — Category A membership repair (2026-06-24)

### Data Records Updated (Firestore — challengeMembers collection)

| Document ID | totalActivities (before→after) | completionRate (before→after) | status (before→after) | completedAt |
|---|---|---|---|---|
| `1S7cXHuHkwAONHhtSgLD_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | 30→30 (unchanged) | 3%→3% (unchanged) | active→active | Timestamp→null |
| `K4eBvaSLKe4yi1taOWCc_0gO19swmbYMrbUoQaHTfzpIr6H42` | 0→60 | 100%→3% | completed→active | Timestamp→null |
| `K4eBvaSLKe4yi1taOWCc_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | 2→60 | 100%→3% | completed→active | Timestamp→null |
| `Uqx8beHESmfbyelkkmZ0_OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | 0→42 | 100%→5% | completed→active | Timestamp→null |
| `Uqx8beHESmfbyelkkmZ0_aBYTQvEAIVgkSy621mUg77FyX652` | 0→42 | 100%→5% | completed→active | Timestamp→null |
| `Uqx8beHESmfbyelkkmZ0_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | 2→42 | 100%→5% | completed→active | Timestamp→null |
| `bIMrgnrblJ0ajQaVtcnF_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | 0→14 | 100%→7% | completed→active | Timestamp→null |

### Files Modified

| File | Change |
|---|---|
| `scripts/repairCategoryAMemberships.ts` | New script: dry-run + live repair of 7 Category A records |
| `docs/reports/member-phase-10c-change-log.md` | This entry |

### Result

All 7 records repaired in a single batch write. Post-write verification confirmed 0 remaining Category A candidates. All 4 validation commands passed.

---

## Session: CRIT-3 Step 1 — totalActivities <= 0 guard (2026-06-24)

### Files Modified

| File | Change |
|------|--------|
| `src/services/workoutService.ts` | Added `totalActivities <= 0` guard after `computeRequiredLogs`; throws before any increment/completion write |
| `src/services/wellnessLogService.ts` | Same guard added in `writeLog()` at same position |
| `scripts/testScoringGuards.ts` | Added Section 21C with 6 structural assertions verifying guard presence, ordering, and throw behavior in both services |

### Problem Solved

Old `challengeMembers` records created before CRIT-3 can have `totalActivities: 0` (creator auto-join bug). `computeRequiredLogs` for a fully-configured challenge always returns ≥ 1, so this guard fires only for misconfigured challenge docs. Without it: `nextCompleted = min(0+1, 1) = 1`, `nextRate = 100%` → membership marked `completed` on first log, blocking all future logging on an ongoing challenge.

### Fix

```ts
if (totalActivities <= 0) {
  throw new Error('Challenge is not fully configured. Please contact your group admin.');
}
```

Inserted immediately after `computeRequiredLogs(...)` in both services, before any increment/batch write.

### Test Results

All four required commands passed:
- `npx tsc -b --pretty false` — 0 errors
- `npm run build` — ✓ built in 8.66s
- `npm run test:scoring-guards` — scoring guards passed
- `npm run test:home-challenge-feeds` — all guards passed

---

## Session: P6H Task 1 Re-Fix (2026-06-22)

### Files Modified

| File | Change |
|------|--------|
| `src/services/challengeService.ts` | `getChallengesByGroup` restored to direct Firestore query — no visibility filter |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | "Linked to selected group" → real group name; added `console.warn` for Join Challenge errors; "super admin" → "platform review" |
| `src/features/Challenges/CreateChallengeWizard.tsx` | `console.error` → `console.warn` × 2; "super admin" → "platform review" × 2; seed copy removed |
| `src/features/Groups/GroupDetailScreen.tsx` | `window.prompt` removed |
| `src/features/Groups/GroupMembersScreen.tsx` | admin → organizer copy; ADMIN badge → LEAD; window.prompt removed |
| `src/features/Groups/GroupsScreen.tsx` | `console.error` → `console.warn` |
| `src/features/Groups/CreateGroupScreen.tsx` | `console.error` → `console.warn` |
| `src/features/Profile/ProfileCompletionScreen.tsx` | Added `birthdayError` inline validation state |
| `firestore.rules` | `challengeMembers` create: added `|| isPublicGroup(groupId)` |

### Root Cause (CRIT-1)

Prior session's fix delegated to `getChallengesByGroupPage` which added `where('visibility', '==', 'public')` and `where('groupVisibility', '==', 'public')`. No challenges have these fields. Both queries returned 0 docs. `primaryQueriesSucceeded = true` on empty results skipped the fallback. Firestore rules do NOT require visibility fields.

## Session: P6H Task 1B — Challenge Discovery & Navigation (2026-06-22)

### Files Modified

| File | Change |
|------|--------|
| `src/features/Groups/GroupDetailScreen.tsx` | Active/upcoming split by `startDate` vs today; horizontal scroll of up to 3 active challenges; "View All" → `/app/challenges/browse?groupId=`; correct empty copy for upcoming |
| `src/features/Challenges/ChallengesScreen.tsx` | Ongoing "View All" fixed: `/app/challenges/suggested` → `/app/challenges/browse`; "Join" on non-joined card now navigates to detail instead of auto-enrolling |
| `src/features/Challenges/BrowseChallengesScreen.tsx` | Query key changed from `all-challenges-catalog` to `browse-public-challenges` (fixes cache collision); removed secondary `useGroups()` filter; added Ongoing/Upcoming/All filter chips |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Leave Challenge: restricted to `status === 'active' && myLogs === 0`; shows explanation text when logs > 0 |

### Validation (Task 1B)

| Check | Result |
|-------|--------|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ Built in 3.10s |
| `npm run test:home-challenge-feeds` | ✅ All guards passed |
| `firebase deploy --only firestore:rules --dry-run` | ✅ Rules compiled successfully |

---

## Session: P6H Task 1C — Challenge Discovery, Browse, View All, Home Regression (2026-06-23)

### Files Modified

| File | Change |
|------|--------|
| `src/features/Groups/GroupDetailScreen.tsx` | Replaced two-section active challenges layout (featured card + scroll row) with single horizontal carousel showing up to 3 cards; "View All" routes to `/app/challenges/browse?groupId=` |
| `src/features/Challenges/BrowseChallengesScreen.tsx` | Full rewrite: reads `groupId` from URL; group-specific title + back button; `getChallengesByGroup` when groupId present, `getChallengesForMyGroups` when not; search + status/category/type filter chips; context-aware empty states |
| `src/features/Home/useHomeScreen.ts` | Added `where('userId', '==', uid)` to `wellnessLogs` and `workouts` queries + `.catch(() => null)` fallback — fixes "Unable to load home data" regression caused by Firestore permission-denied on unfiltered log reads |
| `src/services/challengeService.ts` | Added `getChallengesForMyGroups(userId)` — queries each user group via individual `where('groupId', '==', id)` in parallel, merges, deduplicates, returns active challenges; avoids the Firestore 10-rule-call limit hit by `where('groupId', 'in', chunk10)` |

### Root Causes Fixed

**Home regression:** `fetchHomeScreenData` queried `wellnessLogs` without `where('userId', '==', uid)`. Firestore rule `resource.data.userId == request.auth.uid` rejects queries that could return other users' logs → un-caught thrown error → React Query retries × 3 → `isError = true` → Home error message.

**Browse Challenges blank (general view):** `getVisibleChallengesForUser` sends `where('groupId', 'in', chunk10)`. Firestore evaluates `isGroupMember(id) || isPublicGroup(id)` for each of 10 IDs = 4 `get()`/`exists()` calls × 10 = 40 calls, exceeding the 10-per-request limit → `permission-denied` → empty results. Fixed with per-group parallel queries (4 calls max each).

**Browse "View All" from group:** BrowseChallengesScreen now reads `groupId` from URL param, calls `getChallengesByGroup(groupId)` (single-value, rule-safe), shows group name in title.

### Validation (Task 1C)

| Check | Result |
|-------|--------|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ Built in 3.10s |
| `npm run test:home-challenge-feeds` | ✅ All guards passed |
| `firebase deploy --only firestore:rules --dry-run` | ✅ Rules compiled successfully |

---

### Pending (Task 2-5)

- CRIT-2: ChallengeDetailScreen participant/log counts
- CRIT-4: durationDays backfill script
- CRIT-3: premature completion repair
- CRIT-5: wellness logging verification

### Remaining pilot-ux-polish-guard gaps (pre-existing, feature work needed)

- LoginScreen: forgot password + sendPasswordResetEmail
- firebaseAuthErrors.ts: auth/missing-email
- ProfileInterestsScreen: min 3 interests guard
- HomeScreen: activation card for new users
- ProfileScreen: navigate to /app/challenges
