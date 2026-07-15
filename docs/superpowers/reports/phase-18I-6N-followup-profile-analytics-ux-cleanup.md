# Phase 18I-6N Follow-up — Profile Analytics UX Cleanup

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Profile/ProfileScreen.tsx` | Replace Wins/Streak quick cards with Active Challenges + Completion Rate; make Groups + Active clickable |
| `src/features/Profile/ProfileAnalyticsScreen.tsx` | Replace Daily Habits with Donations & Support section; add View CTA per section; add `useSupportDonations` |
| `scripts/testProfileAnalyticsGuards.ts` | Add 9 follow-up guards |
| `scripts/testScoringGuards.ts` | Replace stale Wins-chevron guard with Groups/Active clickability guards |

---

## 1. Profile Quick Stat Cards (ProfileScreen)

### Before → After

| Position | Before | After |
|----------|--------|-------|
| Card 1 | Groups (static `<article>`) | Groups (`<button>` → `/app/groups`) |
| Card 2 | Wins (`completedChallengesCount`, chevron → analytics) | Active Challenges (`activeChallengesCount`, → `/app/challenges`) |
| Card 3 | Streak (`currentStreak`, static) | Done % (`completionRatePct`, static) |

**Rationale:** Wins always showed 0 before Task 1 fixed the source; even with the fix, showing a completion *count* on a quick card is less useful than the current active load. Streak required its own Firestore call (removed in Task 2); completion rate can be derived inline from analytics values already in cache.

**Data source for Completion Rate:**
```ts
const totalJoined = analytics?.totalChallengesJoinedCount ?? 0;   // challengeMembers
const completionRatePct = totalJoined > 0
  ? Math.round(((analytics?.completedChallengesCount ?? 0) / totalJoined) * 100)
  : 0;
```

---

## 2. Duplicate Section Audit (ProfileAnalyticsScreen)

No duplicates were present in the post-Task-3 code. Each section title appears exactly once in the JSX. Guards added to prevent regressions.

---

## 3. Daily Habits → Donations & Support

Daily Habits was conditionally rendered only when `habitDaysTracked > 0`. In practice this means it never appeared for users not using the goals/habits feature. The section has been replaced with a Donations & Support section that is always present.

**Donation metrics shown (all from `useSupportDonations`):**

| Tile | Source | Notes |
|------|--------|-------|
| Contributions | `supportDonations.length` | Total records (intent + confirmed) |
| Confirmed | `confirmed.length` (status === 'confirmed') | Verified payments only |
| Total contributed | Sum of `amountKes` where confirmed | Displays "Not started yet" when 0 |

Section is clickable → `/app/donate?trigger=manual`.

**Why no fake or projected numbers:** `SupportDonation` records hold actual amounts pledged/confirmed. No aggregation service needed — the full list is loaded by `useSupportDonations` which already exists and is used on ProfileScreen's pledge widget.

---

## 4. Community Section

Left at "Groups joined" only (`analytics.groupsCount`).

**"Groups created" intentionally omitted:** `groupService.getGroupsByOwner(ownerId)` exists but there is no `useGroupsByOwner` React Query hook. Adding one would require a new composite Firestore index (`ownerId + *` on the `groups` collection) and a new hook file — both out of scope for this cleanup phase. Documenting for a future task.

**"Challenges created" intentionally omitted:** No service method or index exists for querying challenges by creator. The `challenges` collection stores `createdBy` but there is no `getChallengesByCreator` method. Same rationale: out of scope, safe to leave.

---

## 5. Clickable Cards

| Card | Route | Screen |
|------|-------|--------|
| Groups quick stat (ProfileScreen) | `/app/groups` | GroupsScreen |
| Active Challenges quick stat (ProfileScreen) | `/app/challenges` | ChallengesScreen |
| Challenges section (ProfileAnalyticsScreen) | `/app/challenges` | ChallengesScreen |
| Community section (ProfileAnalyticsScreen) | `/app/groups` | GroupsScreen |
| Donations & Support section (ProfileAnalyticsScreen) | `/app/donate?trigger=manual` | DonateScreen |

All routes confirmed present in `App.tsx` before adding navigation.

---

## 6. Metrics Intentionally Left Out

| Metric | Reason |
|--------|--------|
| Streak (ProfileScreen quick card) | Removed from quick stats; still visible in Reports & Analytics under Consistency |
| Wins count (ProfileScreen quick card) | Replaced by Completion Rate (% is more meaningful at-a-glance) |
| Groups created | No hook or Firestore index; see Community section above |
| Challenges created | No service method or index exists |
| Daily Habits | Replaced by Donations; habits data is unreliable without active goal usage |

---

## Guards Added / Updated

**`testProfileAnalyticsGuards.ts` additions:**
- ProfileScreen does not render `Wins` quick card
- ProfileScreen does not render `Streak` quick card
- ProfileScreen renders `activeChallengesCount` (Active quick card)
- ProfileScreen renders `completionRatePct` (Done % quick card)
- ProfileAnalyticsScreen has exactly one Challenges section
- ProfileAnalyticsScreen has exactly one Community section
- ProfileAnalyticsScreen does not render `Daily Habits`
- ProfileAnalyticsScreen renders Donations & Support section
- ProfileAnalyticsScreen uses `useSupportDonations`

**`testScoringGuards.ts` update:**
- Replaced stale "Wins chevron" guard (card removed) with guards verifying Groups navigates to `/app/groups` and Active navigates to `/app/challenges`

---

## Validation

```
npx tsc --noEmit                      ✅ clean
npm run build                         ✅ built in 3.36s
npm run test:profile-analytics-guards ✅ all guards passed
npm run test:scoring-guards           ✅ scoring guards passed
```
