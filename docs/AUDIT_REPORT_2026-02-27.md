# Tiizi Data Consistency Audit Report
Date: 2026-02-27  
Scope: Group/challenge/home fetch consistency, participant counts, seed/fallback contamination risks.

## Audit Commands Run
- `npm run build` ✅
- `npm run audit:smoke` ✅ (7/7)
- `npm run audit:data-flow` ✅ (12/12)
- Static code scans for:
  - challenge/group fetch paths
  - participant count logic
  - seed/fallback/hardcoded paths
  - status normalization mismatches

## Executive Summary
Build and static checks pass, but there are still systemic causes for mixed data behavior:
1. Denormalized `participantCount` drift across challenge screens.
2. Multiple fallback paths (local seeded wellness catalog/templates) can mask backend read failures.
3. Inconsistent status semantics (`joined` vs `active`) and mixed filtering paths.
4. Seed and production data can coexist without strong separation controls.

These explain the repeated symptoms: blank home sections, empty browse sections, and mismatched participant numbers.

---

## Findings

### P0 - Participant count is not maintained transactionally everywhere
**Impact:** Ongoing challenge cards can show `0 participants` even when challenge members exist.

**Evidence**
- `src/services/challengeService.ts`:
  - `joinChallenge()` writes `challengeMembers` + `users.stats`, but does not consistently update challenge `participantCount`.
  - `createChallenge()` sets `participantCount: 1` only on auto-join path.
- Several screens still display `challenge.participantCount` directly.

**Current mitigation already added**
- Reconciliation logic now computes max of persisted count vs membership count in:
  - `getChallengeParticipantCount()`
  - `getChallengeParticipantCounts()`
  - `getUserAccessibleChallenges()`
  - `getVisibleChallengesForUser()`

**Remaining risk**
- Any screen querying challenge docs directly (without reconciled service path) can still show stale values.

---

### P0 - Seed/fallback behavior can hide real backend problems
**Impact:** UI may display non-production wellness activity/template data or appear inconsistent after cleanup.

**Evidence**
- `src/services/wellnessTemplateService.ts`: logs fallback messages and returns empty if read fails; only `templateSource === 'admin'` is accepted.
- `src/services/wellnessActivityService.ts`: falls back to `WELLNESS_ACTIVITIES_CATALOG` when Firestore read fails.

**Risk**
- If Firestore reads fail (rules/index/network), users may see fallback content while other app sections use live data.
- This creates “mixed state” perception.

---

### P1 - Status normalization is incomplete
**Impact:** Same entity can be considered active in one module and inactive in another.

**Evidence**
- Group membership logic uses both `joined` and `active` as valid in some services:
  - `src/services/groupService.ts`
  - `src/services/challengeService.ts` (`ACTIVE_GROUP_MEMBER_STATUSES = ['joined', 'active']`)
- Challenge access and membership checks often require strict `active`.

**Risk**
- User appears to belong to group/challenge in one screen but not another.

---

### P1 - Browse/public challenge visibility can be over-filtered by state/rules
**Impact:** “Browse Challenges” can appear empty while challenges exist.

**Evidence**
- `src/features/Challenges/BrowseChallengesScreen.tsx` now improved, but final visibility still depends on:
  - group privacy flags
  - challenge status filters
  - Firestore rule pass-through for non-members
- Firestore rules currently allow challenge read for public groups (`isPublicGroup(...)`), but data-shape inconsistencies in `groups.isPrivate` can exclude items.

---

### P2 - Hardcoded visual fallbacks still present in UI
**Impact:** Perceived as stale/hardcoded content even when logic is live.

**Evidence**
- Unsplash or static image fallbacks in:
  - `src/components/Challenges/OngoingChallengeCard.tsx`
  - `src/features/Groups/GroupsScreen.tsx`
  - `src/features/Groups/GroupDetailScreen.tsx`
  - `src/features/Home/HomeScreen.tsx` (name fallback “Athlete”)

**Risk**
- Makes it hard to distinguish “no backend data” from “fallback rendering”.

---

## Fixes Already Applied In This Cycle
1. Removed seed-tag exclusion from user group fetch:
   - `src/services/groupService.ts`
2. Added participant reconciliation from `challengeMembers`:
   - `src/services/challengeService.ts`
3. Broadened browse query visibility and reduced over-filtering:
   - `src/features/Challenges/BrowseChallengesScreen.tsx`
4. Added structured change log:
   - `CHANGE.md`

---

## What Is Working
- Project builds successfully.
- Static smoke/data-flow checks pass.
- Visibility-safe challenge fetch methods are wired in main challenge/home flows.
- Membership-based participant reconciliation exists in challenge service.

---

## What Is Still Challenging
1. Real-time consistency is still vulnerable because `participantCount` remains denormalized.
2. Wellness fallback strategy can still blend local catalog with production state.
3. Status semantics are not fully canonicalized across all services/screens.
4. Without a full seeded-data + user reset, historic mixed records continue to surface.

---

## File Hotspots To Review Next
- `src/services/challengeService.ts`
- `src/services/groupService.ts`
- `src/features/Home/useHomeScreen.ts`
- `src/features/Challenges/ChallengesScreen.tsx`
- `src/features/Challenges/BrowseChallengesScreen.tsx`
- `src/services/wellnessTemplateService.ts`
- `src/services/wellnessActivityService.ts`
- `firestore.rules`

---

## Recommended Next Actions
1. Make participant counting canonical:
   - Option A: always aggregate from `challengeMembers`.
   - Option B: maintain `participantCount` only from one backend-owned path.
2. Remove/feature-flag wellness local fallbacks in production.
3. Standardize one membership status vocabulary and migrate old docs.
4. Perform clean reset of seeded records and test users, then re-seed only required baseline datasets.

