# Task 1D — Challenge Lifecycle Cleanup & Browse/List Alignment

**Date:** 2026-06-23  
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Changed

| File | Change |
|------|--------|
| `src/utils/challengeLifecycle.ts` | **New** — shared helpers: `isChallengeOngoing`, `isChallengeUpcoming`, `isChallengeCompletedOrExpired` |
| `src/features/Groups/GroupDetailScreen.tsx` | Carousel filter uses `isChallengeOngoing`; "Active Challenges" → "Ongoing Challenges"; empty state copy updated |
| `src/features/Challenges/BrowseChallengesScreen.tsx` | Default status filter changed to `'ongoing'`; added `'completed'` option; uses lifecycle helpers; "Ended" label + muted style on completed cards |
| `src/features/Home/useHomeScreen.ts` | Removed local `isChallengeActiveNow`; hero uses `isChallengeOngoing`; trending replaced by `mostPopularOngoing` (ongoing only, sorted by participantCount desc, max 3); type fields renamed `activeChallenge` → `ongoingChallenge`, `trendingChallenges` → `mostPopularOngoing` |
| `src/features/Home/HomeScreen.tsx` | Section labels: "Active Challenge" → "My Ongoing Challenge", "Trending Challenges" → "Most Popular Ongoing"; fallback logic uses `isChallengeOngoing`; fallback trending uses `isChallengeOngoing` + max 3 |
| `src/features/Challenges/ChallengesScreen.tsx` | `visibleChallenges` and `browseChallenges` filters use `isChallengeOngoing` instead of `status === 'active'` |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Added `challengeIsOver` flag using `isChallengeCompletedOrExpired`; when expired/completed and not a member, replaces Join button with "This challenge has ended." message |

---

## 2. Lifecycle Helper Logic

File: [`src/utils/challengeLifecycle.ts`](../../src/utils/challengeLifecycle.ts)

```ts
// Ongoing: within startDate–endDate window AND not terminal status
function isChallengeOngoing(c, now = Date.now()): boolean {
  const inWindow = now >= Date.parse(startDate) && now <= Date.parse(endDate);
  const notTerminal = status !== 'completed' && status !== 'expired' && status !== 'draft';
  return inWindow && notTerminal;
}

// Upcoming: startDate is in the future, not draft
function isChallengeUpcoming(c, now = Date.now()): boolean {
  return now < Date.parse(startDate) && status !== 'draft';
}

// Completed/Expired: past endDate OR status is completed/expired
function isChallengeCompletedOrExpired(c, now = Date.now()): boolean {
  return now > Date.parse(endDate) || status === 'completed' || status === 'expired';
}
```

**Why `status === 'active'` alone was insufficient:** Firestore contains stale documents where `status === 'active'` but `endDate` is in the past. The combined date-window + status check is the only reliable source of truth for member-facing display.

---

## 3. Browser Evidence

### A. Browse Challenges — Ongoing default
- Filter chips: Ongoing (selected/orange) | Upcoming | Completed
- 7 challenge cards visible, all show "X Days Left" labels
- No expired challenges visible

### B. Browse Challenges — Completed filter
- Clicking "Completed" chip shows "7-day squats marathon" with **"Ended"** label (muted grey)
- CTA shows **"View"** — no "Join Challenge" button visible

### C. Home — Renamed sections
- Hero section: **"MY ONGOING CHALLENGE"** label (was "Active Challenge")
- Shows 7-Day Hydration Challenge (within date window) with Log Activity CTA
- Scroll section: **"MOST POPULAR ONGOING"** label (was "Trending Challenges")
- 2 challenge cards shown, both with days-left labels, no expired items

### D. Early Birds Kenya group — Carousel
- Section header: **"Ongoing Challenges"** (was "Active Challenges")
- 3 carousel cards: Pushup mania2 (12d left), 30-Day Pushup Duel (12d left), 8-Hour Sleep Streak (3d left)
- All cards are within their date window — no expired items in carousel
- "View All" button present

### E. Console errors
- Zero runtime errors after page reload
- Stale HMR errors in console (72 entries) are from intermediate edit states during the session; they stopped accumulating after the final build. `npx tsc -b` and `npm run build` both pass clean.

---

## 4. Validation Results

| Command | Result |
|---------|--------|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ Built in 2.76s |
| `npm run test:home-challenge-feeds` | ✅ All guards passed |
| `firebase deploy --only firestore:rules --dry-run --project tiizi-challenges` | ✅ Rules compiled successfully |

---

## 5. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| Challenges with missing/invalid `endDate` | Low | `Date.parse` returns `NaN` → `isChallengeOngoing` returns `false` (safe — hides the challenge rather than showing it wrong). Empty-state copy would display instead. |
| `getChallengesForMyGroups` only returns `status === 'active'` from Firestore | Low | The per-group query filters `where('status', '==', 'active')` at source. Expired docs with stale status are still caught by `isChallengeOngoing` date check at display layer. |
| ChallengeDetailScreen expired state only gates non-members | Intentional | Members who joined before expiry can still view results and see their log history. Only the Join CTA is removed for expired challenges. |
| "Reuse" / "Run again" CTA for completed challenges | Out of scope | Not implemented — documented as future work per task spec. |
| Home fallback (`fallbackActiveChallenge`) still reads from `accessibleChallenges` | Low | `accessibleChallenges` hook already filters by status; `isChallengeOngoing` is applied on top for date-window safety. |

---

## 6. Rollback Instructions

All changes are isolated to display-layer filtering. No Firestore schema, rules, or indexes were modified.

```bash
# Revert to last known-good commit (before Task 1D)
git diff --name-only HEAD  # confirm scope
git checkout HEAD -- src/utils/challengeLifecycle.ts
git checkout HEAD -- src/features/Groups/GroupDetailScreen.tsx
git checkout HEAD -- src/features/Challenges/BrowseChallengesScreen.tsx
git checkout HEAD -- src/features/Home/useHomeScreen.ts
git checkout HEAD -- src/features/Home/HomeScreen.tsx
git checkout HEAD -- src/features/Challenges/ChallengesScreen.tsx
git checkout HEAD -- src/features/Challenges/ChallengeDetailScreen.tsx
```

Or if committed:
```bash
git revert <task-1d-commit-sha> --no-edit
```

The `HomeScreenData` type rename (`activeChallenge` → `ongoingChallenge`, `trendingChallenges` → `mostPopularOngoing`) is a breaking change to the type contract — both `useHomeScreen.ts` and `HomeScreen.tsx` must be reverted together.

---

## 7. What Was NOT Changed (Scope Boundary)

- No logging / scoring logic touched
- No Firestore rules changes
- No new Firestore indexes
- No challenge creation or wizard flows
- No admin screens
- `getChallengesForMyGroups` (added in Task 1C) unchanged
