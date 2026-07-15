# Phase 10C-P5H — Trending Visibility Alignment

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all validation passing, not deployed

---

## Root Cause

Home Trending fetched only challenges where `visibility == 'public'` (Query A). Challenges where `groupVisibility == 'public'` but `visibility !== 'public'` were visible in Browse (which correctly queries both fields) but invisible in Trending. This created an inconsistent discovery surface: a challenge publicly discoverable via Browse could never appear in Trending.

The underlying cause was a single `getChallengesPage({ visibility: 'public' })` call with no `groupVisibility` equivalent, and `ChallengeDiscoveryPageOptions` having no `groupVisibility` field to support such a query.

Additionally, the file had 27 Unicode curly quotes (`'`/`'`) instead of ASCII single quotes. The `text: 'Log today's challenge activity'` string contained a curly apostrophe used as an escape character that — after the quote-normalisation fix — became a raw ASCII apostrophe breaking the string literal. This was corrected to use double quotes.

---

## Files Changed

| File | Change |
|------|--------|
| `src/services/challengeService.ts` | Added `groupVisibility?: 'public' \| 'private'` to `ChallengeDiscoveryPageOptions`; added `groupVisibility` constraint in `getChallengesPage` |
| `src/features/Home/useHomeScreen.ts` | Run two trending queries (Query A: `visibility: 'public'`, Query B: `groupVisibility: 'public'`); deduplicate by id via `trendingSeenIds` Set; merge before `isDiscoverableTrendingChallenge` filter; normalised 27 curly/smart quotes to ASCII single quotes; fixed broken string literal |
| `scripts/testHomeChallengeFeeds.ts` | Added P5H guard section: 6 assertions covering groupVisibility coverage, deduplication, statuses constraint, lifecycle filtering, and change-log existence |
| `docs/reports/member-phase-10c-p5g-date-safety-log-gating.md` | Created (P5G report) |
| `docs/reports/member-phase-10c-change-log.md` | Created (master phase change tracker) |
| `docs/reports/member-phase-10c-p5h-trending-visibility-alignment.md` | This file |

---

## Fix Applied

### challengeService.ts — new `groupVisibility` option

```ts
export type ChallengeDiscoveryPageOptions = {
  pageSize?: number;
  cursor?: ChallengeCursor | null;
  statuses?: Challenge['status'][];
  visibility?: 'public' | 'private';
  groupVisibility?: 'public' | 'private';   // ← added
};

// in getChallengesPage:
if (options.groupVisibility) {
  constraints.push(where('groupVisibility', '==', options.groupVisibility));
}
```

### useHomeScreen.ts — two-query Trending with dedup

```ts
const [memberHome, userMetrics, trendingByVisibility, trendingByGroupVisibility, activeUserChallenges] = await Promise.all([
  ...
  challengeService.getChallengesPage({ pageSize: 15, statuses: ['active'], visibility: 'public' })
    .catch(() => ({ items: [], nextCursor: null, hasMore: false })),
  challengeService.getChallengesPage({ pageSize: 15, statuses: ['active'], groupVisibility: 'public' })
    .catch(() => ({ items: [], nextCursor: null, hasMore: false })),
  ...
]);

const trendingSeenIds = new Set<string>(trendingByVisibility.items.map((c) => c.id));
const trendingItems = [
  ...trendingByVisibility.items,
  ...trendingByGroupVisibility.items.filter((c) => !trendingSeenIds.has(c.id)),
];
```

Lifecycle filtering (`isDiscoverableTrendingChallenge`), participant-count sort, and `.slice(0, 5)` cap are applied to the merged list before mapping to trending cards — unchanged from before.

---

## Validation Output

```
npm run test:home-challenge-feeds        ✓ passed
npm run test:home-performance-guards     ✓ passed
npm run test:pilot-ux-polish-guards      ✓ passed  (quote fix also resolved pre-existing fragility)
npm run test:scoring-guards              ✓ passed
npm run test:challenge-creation-backend  ✓ passed
npm run test:group-invite-backend        ✓ passed
npx tsc -b --pretty false               ✓ no errors
npm run build                            ✓ built in 2.95s
```

---

## Deploy Requirement

No. Client-side code only. The `groupVisibility` query relies on the composite index `status ASC, groupVisibility ASC, startDate DESC` which is confirmed present in `firestore.indexes.json`. The Firestore `allow list` rule already covers `groupVisibility == 'public'` challenges (P5C fix).

---

## Remaining Risk

- A challenge with both `visibility == 'public'` and `groupVisibility == 'public'` appears in both query results but is correctly deduplicated by `trendingSeenIds`. No duplicates shown.
- The `groupVisibility` query returns up to 15 results and the `visibility` query returns up to 15. The merged pool before filtering can be up to 30. After `isDiscoverableTrendingChallenge` and `.slice(0, 5)`, the displayed count is capped at 5 — unchanged from before.
- The pilot UX polish guard for active-challenge filtering (`/statuses.*\[.*'active'.*\]/`) now reliably matches ASCII-quoted `statuses: ['active']` in the file. Previously it was relying on a different match path (now removed). The normalisation makes both the code and the guard more robust.
