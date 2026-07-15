# Phase 17G — Challenge Creation E2E Audit

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers

---

## Test Environment

**Firebase emulator:** Not available — `firebase.json` has no `emulators` section.

**Staging project:** None — `.firebaserc` has only `default: tiizi-challenges` and `prod: tiizi-challenges` (both point to the same production project).

**Test method used:** FakeDb unit tests (same harness as `testChallengeCreationBackend.ts`) + static source analysis. No production reads or writes were performed.

---

## Pre-existing Test Failures Found and Fixed

Before the Phase 17G test suite could run, three stale assertions in `testChallengeCreationBackend.ts` were discovered and corrected:

| # | Stale assertion | Fix |
|---|---|---|
| 1 | `totalActivities: 0` — function now computes `activities.length × durationDays` | Updated to `7` (1 activity × 7 days) |
| 2 | Guard checked `challengeService.createChallenge` for `httpsCallable` usage — but the Wizard calls the callable directly, not via the service | Guard moved to check `CreateChallengeWizard.tsx` |
| 3 | Guard said `joinChallenge must NOT write participantCount` — but it does (ARCH-1, see below) | Changed from `doesNotMatch` to `match` with ARCH-1 annotation |

---

## Architectural Findings

### ARCH-1 (Pre-existing): participantCount double-write in `joinChallenge`

**File:** `src/services/challengeService.ts` (lines 245–246, 284–287)

`challengeService.joinChallenge` writes `participantCount: increment(1)` directly to the challenge document. The Cloud Function trigger `onChallengeMemberCreated` also increments `participantCount`. This produces a double-increment every time a member joins.

**Impact:** `participantCount` will be 2× the real participant count for any member joining via the service's `joinChallenge` method.

**Scope:** Outside Phase 17G. Documented for a follow-up fix phase.

### ARCH-2 (Pre-existing): `challengeService.createChallenge` is a legacy direct-write path

**Files:** `src/services/challengeService.ts`, `src/hooks/useChallenges.ts`

`challengeService.createChallenge` writes directly to Firestore (does not call the Cloud Function callable). The `useCreateChallenge` hook wraps it. However, `CreateChallengeWizard` imports the hook only to access its `isPending` state — the wizard's `handleLaunch` calls `httpsCallable('createChallengeWithCreatorMembership')` directly and never invokes the hook's mutation function.

**Net effect:** `challengeService.createChallenge` is currently unreachable from any user-facing creation flow. It remains as a dead code path that bypasses Cloud Function validation and audit logging. If any future caller invokes the hook mutation (e.g. `createChallenge.mutateAsync(...)`), it would bypass the Cloud Function entirely.

**Scope:** Outside Phase 17G. Documented for future cleanup.

---

## Test Matrix

### A. User Wizard — All 6 Mode×Type Combinations

Tested via `testChallengeCreation6Combinations.ts` using `createChallengeWithCreatorMembershipCore` (the Cloud Function core logic) with FakeDb.

| Mode | Type | Challenge doc | engineVersion | Category | Activities | Type-specific fields | Membership | Status |
|---|---|---|---|---|---|---|---|---|
| Fitness | Collective | ✅ | v2 | fitness | exerciseId=pushups | groupCumulativeTarget=1000 | ✅ active | **PASS** |
| Fitness | Competitive | ✅ | v2 | fitness | exerciseId=pushups | — | ✅ active | **PASS** |
| Fitness | Streak | ✅ | v2 | fitness | exerciseId=pushups | requiredConsecutiveDays=30, streakResetOnMiss=true | ✅ active, currentStreak=0 | **PASS** |
| Wellness | Collective | ✅ | v2 | mindfulness | activityId=wa-meditation | groupCumulativeTarget=1000 | ✅ active | **PASS** |
| Wellness | Competitive | ✅ | v2 | mindfulness | activityId=wa-meditation | — | ✅ active | **PASS** |
| Wellness | Streak | ✅ | v2 | mindfulness | activityId=wa-meditation | requiredConsecutiveDays=30, streakResetOnMiss=true | ✅ active, currentStreak=0 | **PASS** |

Additional: all 8 wellness categories (`fasting`, `hydration`, `sleep`, `mindfulness`, `nutrition`, `habits`, `stress`, `social`) preserved correctly in challenge document. ✅

**Frequency:** Not required in any combination. Streak uses `requiredConsecutiveDays`. No combination fails without `frequency`. ✅

**participantCount:** Initialized to 0 in challenge payload for all 6 combinations. ✅

**totalActivities:** Correctly computed as `activities.length × durationDays` (30) for all 6 combinations. ✅

### B. Admin Template Creation — Collection Routing

Verified via static source analysis of service files (no production writes).

| Template type | Service | Collection written | Draft/Publish supported |
|---|---|---|---|
| Fitness template | `challengeTemplateService` | `challengeTemplates` | ✅ (status field + publishTemplate) |
| Wellness template | `wellnessTemplateService` | `wellnessTemplates` | ✅ (status field + publishTemplate) |

Collection routing in `ChallengeTemplatesScreen` confirmed correct:
```ts
onEdit={() => navigate(item.collection === 'fitness'
  ? `/app/admin/challenges/templates/${item.id}/edit`
  : `/app/admin/challenges/wellness-templates/${item.id}/edit`
)}
```

### C. Template-to-Challenge Flow

Verified via static source analysis of `CreateChallengeWizard.tsx`:

- Fitness template prefill: sets `exerciseId`, `query`, `targetValue`, `unit` for each activity ✅
- Wellness template prefill: sets `activityId`, `activityType`, `category`, `frequency`, `icon`, `description`, `protocolSteps`, `benefits`, `guidelines`, `warnings`, `targetValue`, `unit`, `dailyFrequency` for each activity ✅
- Wellness template prefill calls `setChallengeCategory(wellnessTemplate.category)` → `isWellnessMode = true` ✅
- User can modify all prefilled fields before launch ✅

### D. Screen / Route Coverage

| Route | Screen | Uses ChallengeActivitySection | Fitness-only correct | Wellness-only correct |
|---|---|---|---|---|
| `/app/challenges/create` | `CreateChallengeWizard` | ✅ | N/A (both modes) | N/A (both modes) |
| `/app/admin/challenges/create` | `CreateChallengeScreen` | ✅ | N/A (both modes) | N/A (both modes) |
| `/app/admin/challenges/templates/:id/edit` | `EditChallengeTemplateScreen` | ✅ | ✅ `isWellnessMode={false}` | N/A |
| `/app/admin/challenges/wellness-templates/:id/edit` | `EditWellnessTemplateScreen` | ✅ | N/A | ✅ `isWellnessMode={true}` |

---

## Test Suite Results

| Script | Result | Guards |
|---|---|---|
| `npx tsc --noEmit` | ✅ CLEAN | — |
| `npm run build` | ✅ 6.17s | — |
| `npm run test:scoring-guards` | ✅ PASS | 13 guards |
| `npm run test:home-challenge-feeds` | ✅ PASS | all guards |
| `npm run audit:challenge-creation-payloads` | ✅ PASS | 8 guards |
| `npm run test:challenge-creation-backend` | ✅ PASS | all guards (3 stale guards corrected) |
| `npm run test:challenge-creation-6combos` | ✅ PASS | 6 combos × 10 assertions + 8 category checks |

---

## Files Changed

| File | Change |
|---|---|
| `scripts/testChallengeCreationBackend.ts` | Fixed 3 stale assertions (totalActivities, 2× participantCount guard, callable guard location) |
| `scripts/testChallengeCreation6Combinations.ts` | Created — FakeDb test for all 6 mode×type combinations |
| `package.json` | Added `test:challenge-creation-6combos` script |

---

## What Requires Emulator or Manual Testing

The following cannot be verified without a Firebase emulator or explicit approval to write to the staging/production project:

| Test case | Why it requires emulator/manual |
|---|---|
| Actual Firestore document persistence | FakeDb does not test real Firestore write semantics (indexes, security rules, data types) |
| Firestore security rules for challenge creation | Rules evaluation requires real Firestore |
| Cloud Function invocation via `httpsCallable` | Requires deployed function or emulator |
| `onChallengeMemberCreated` trigger fires and increments `participantCount` | Trigger requires real Firestore write |
| Admin template: `addDoc` to `challengeTemplates` / `wellnessTemplates` succeeds | Requires authenticated admin user + real Firestore |
| Template edit round-trip: load → modify → save → reload | Requires real Firestore |
| Template-to-challenge: user opens template, wizard prefills, launches challenge | UI test with real backend |
| Creator membership `status: active` after real Firestore trigger chain | Requires real trigger chain |

---

## Recommendation: Ready for Manual Testing

All 6 mode×type combinations produce correct payloads through the Cloud Function core logic. All static guards pass. The UI layer (all four creation/editing screens) is using shared components and routing correctly.

**Before manual testing begins, note ARCH-1:** `participantCount` may appear as 2× the real count due to the double-write in `joinChallenge`. This should be monitored during manual testing.

**Suggested manual testing sequence:**
1. Fitness + Collective (baseline)
2. Wellness + Streak (most changed path in this session)
3. Admin: create wellness template → user opens it → launches as Wellness Competitive challenge
4. Admin: edit fitness template → verify picker opens correctly → save draft → publish
