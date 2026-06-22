# Phase 10C-P5 — Challenge System State Consistency Audit

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — audit only, no code changes, no data writes

---

## Scope

Full read-only code audit of the challenge system. Covers: Firestore queries, lifecycle filtering, Home vs Challenges discrepancy, wellness handling, browse failures, trending logic, participant counts, navigation, and data integrity.

No fixes applied here. Each finding is classified by severity and flagged for a separate fix phase.

---

## Area 1 — Active Challenge Consistency: Home vs Challenges Screen

### Finding: Different data sources explain the Home/Challenges discrepancy

**Home screen** (`useHomeScreen.fetchHomeScreenData`) fetches active challenges via:
```ts
challengeService.getActiveChallengesForUser(uid, 10)
```
Which:
1. Queries `challengeMembers` where `userId == uid AND status == 'active'`
2. Fetches the matched challenge documents
3. **Applies `isChallengeOngoing` filter**: challenge must have `status: 'active'`, `startDate <= now`, and `endDate > now`

**ChallengesScreen Ongoing section** fetches via `useAccessibleChallengesPage → getUserAccessibleChallengesPage`:
1. Queries `groupMembers` where `userId == uid` (active group memberships)
2. Extracts groupIds
3. Queries `challenges` where `groupId in chunk AND status == 'active'`
4. **No date filter**: does not call `isChallengeOngoing`

### Root cause of "8-Hour Sleep Streak" discrepancy

There are two mechanisms that can cause a challenge to appear on Home but not on the Challenges Ongoing section:

**Mechanism A — Group membership gap**: A user with an active `challengeMembers` record for a group they have since left. `getActiveChallengesForUser` reads from `challengeMembers` directly (so it finds the record), but `getUserAccessibleChallengesPage` reads from `groupMembers` (which no longer includes that group). Result: challenge appears on Home, absent from Challenges Ongoing.

**Mechanism B — Date filter inconsistency**: `getActiveChallengesForUser` calls `isChallengeOngoing`, which excludes challenges where `startDate > now` (upcoming) or `endDate < now` (expired). `getUserAccessibleChallengesPage` has no date filter and returns all `status: 'active'` challenges in the user's groups regardless of date range.

**Most probable cause for 8-Hour Sleep Streak**: Mechanism A. The challenge belongs to a group the user left (or was never a member of at the group level), but the `challengeMembers` record persists with `status: 'active'`.

### Secondary finding: Ongoing section shows expired challenges

Because `getUserAccessibleChallengesPage` has no date filter, challenges past their `endDate` (but still with `status: 'active'` in Firestore) appear in the Challenges Ongoing section. This is compounded by Area 3 below.

**Severity**: HIGH — visible data inconsistency between screens, misleading "Ongoing" label for expired challenges.

---

## Area 2 — Wellness vs Workout Challenge Handling

### Finding: No challengeType filter in any discovery query

All challenge fetch paths (`getChallengesPage`, `getUserAccessibleChallengesPage`, `getActiveChallengesForUser`, `getVisibleChallengesForUserPage`) have no filter on `challengeType` or `category`. This is correct — challenges of all types flow through the same discovery queries.

### Finding: `isWellness` derived from `category`, not `challengeType`

`ChallengesScreen` determines the action button label via:
```ts
isWellness: !!item.category && item.category !== 'fitness'
```
And `useHomeScreen.toTrendingChallenge`:
```ts
actionLabel: joined
  ? (hasStarted
    ? ((challenge.category && challenge.category !== 'fitness') ? 'Log Activity' : 'Log Workout')
    : 'View')
  : 'Join',
```

Both derive wellness from `category !== 'fitness'`, not from `challengeType === 'streak'`. A `streak` challenge with `category: 'fitness'` will show "Log Workout" rather than "Log Activity". This is consistent between screens.

### Finding: Scoring method correctly inferred from `challengeType`

`computeActivityScore` in `scoringConfig.ts` receives `challengeType` and infers the `scoringMethod` from it. Both `LogWorkoutScreen` and `LogWellnessActivityScreen` pass `challenge?.challengeType` to the scoring engine. This path is correct.

**Severity**: LOW — `isWellness` derivation from `category` is consistent across screens. Edge case: `streak` + `category: 'fitness'` shows "Log Workout" instead of "Log Activity" — minor label inconsistency, not a data bug.

---

## Area 3 — Challenge Lifecycle State Machine

### Finding: No automatic `active → completed` transition exists in client code

The full lifecycle path is:
```
draft → active     (admin/createChallenge callable)
active → completed (manual only: updateChallengeStatus, admin UI)
active → cancelled (manual only: admin UI)
```

There is no Cloud Function or client-side trigger that transitions a challenge from `active` to `completed` when `endDate` passes. Challenges do not self-expire in Firestore.

### Consequences

| Query path | Expired challenges returned? |
|-----------|------------------------------|
| `getActiveChallengesForUser` | No — `isChallengeOngoing` filters them |
| `getUserAccessibleChallengesPage` | **Yes** — no date filter |
| `getChallengesPage` (trending feed) | **Yes** — no date filter in query |
| `getChallengesByGroupPage` | **Yes** — no date filter |
| `getVisibleChallengesForUserPage` | **Yes** — no date filter |
| `isDiscoverableTrendingChallenge` | No — calls `isChallengeOngoing` |

So trending challenge filtering is correct (expired challenges filtered by `isDiscoverableTrendingChallenge`), but the Ongoing, Browse, and Group challenges sections can show expired challenges.

### Finding: P4I pre-fix members may be `status: 'completed'` on active challenges

Documented in P4J: at least 2 `challengeMembers` records were found with `status: 'completed'` on non-expired, non-ended challenges (created before the P4I `!endAt` guard). These members will not appear in active-member queries (`status == 'active'`) but their challenges remain `active`. No remediation was authorized.

**Severity**: HIGH — expired challenges displayed as ongoing in ChallengesScreen and BrowseChallengesScreen until manually resolved by admin.

---

## Area 4 — Upcoming Challenge Logic

### Finding: Start-date handling is consistent but filtering is inconsistent

`parseChallengeStartMs` treats date-only strings (`YYYY-MM-DD`) as `T00:00:00.000` local time.  
`parseChallengeEndMs` treats them as `T23:59:59.999` local time.  
Both are applied consistently in `challengeLifecycle.ts`.

`isChallengeOngoing` excludes challenges where `startMs > now`. So upcoming challenges:
- Are **excluded** from Home active challenge cards
- Are **included** in ChallengesScreen Ongoing section (no date filter)
- Are **excluded** from trending feed (`isDiscoverableTrendingChallenge`)

`ChallengesScreen.ongoingCards` handles the upcoming case correctly with a "Starts in X Days" label and a "View" button (rather than "Log Workout"). Similarly in `useHomeScreen.toTrendingChallenge`.

**Severity**: MEDIUM — upcoming challenges showing in Ongoing section is arguably correct UX (user can see what's coming up), but is architecturally inconsistent with Home. Worth documenting as intended behavior or adding a section label like "Upcoming".

---

## Area 5 — Participant Count Integrity

### Finding: `participantCount` is a denormalized field on the challenge document

All participant count reads come from `challenge.participantCount`, a denormalized integer written by the Cloud Function `createChallengeWithCreatorMembership` (creator joins = count ≥ 1). Subsequent joins are incremented via `batch.set(userRef, { stats: { totalChallenges: increment(1) } })` in `challengeService.joinChallenge` — but **this increments `users.stats.totalChallenges`, not `challenges.participantCount`**.

### Finding: `participantCount` is never incremented by the client SDK `joinChallenge`

`challengeService.joinChallenge` writes to `challengeMembers` and `users` but does NOT call `increment` on `challenges/{id}.participantCount`. The only code that increments `participantCount` is the Cloud Function. If the Cloud Function does not handle post-creation joins (e.g., users who join after creation), `participantCount` will be stuck at 1 (creator only).

This is a data integrity risk: the displayed participant count may be permanently stale for any challenges that have additional joiners after creation.

**Severity**: HIGH — participant count shown in trending cards and challenge lists is likely understated for most challenges. Requires Cloud Function audit (out of scope for this client-side audit) and potentially a counter backfill.

---

## Area 6 — Challenge Navigation Audit

### All cards navigate correctly — no dead-click issues found

| Component | Card action | Route |
|-----------|------------|-------|
| `TrendingChallenges` | Any card tap | `onSelectChallenge` → `/app/challenge/:id?groupId=...` |
| `ChallengesScreen` Ongoing | Card body | `/app/challenge/:id` |
| `ChallengesScreen` Ongoing | Button (joined+started) | `/app/workouts/select-activity?challengeId=...` |
| `ChallengesScreen` Ongoing | Button (joined+upcoming) | `/app/challenge/:id` |
| `ChallengesScreen` Ongoing | Button (not joined) | `joinChallenge` → `/app/challenges/:type?challengeId=...` |
| `ChallengesScreen` Browse | Card body + View button | `/app/challenge/:id` |
| `BrowseChallengesScreen` | Card body + View button | `/app/challenge/:id` |

### Finding: `TrendingChallenges` component has no `groupId` for challenges where the user is not a group member

In `HomeScreen.onSelectChallenge`:
```ts
const query = new URLSearchParams({ groupId: selected.groupId ?? '' });
if (!selected.groupId) query.delete('groupId');
navigate(`/app/challenge/${challengeId}${queryString ? `?${queryString}` : ''}`);
```

If the challenge has a `groupId` (which all challenges do), the user navigates to the challenge detail with the group context. `ChallengeDetailScreen` needs to handle the case where the user is not a member of that group gracefully. This is a separate surface — not audited here.

**Severity**: LOW — navigation is functional. The non-member `groupId` pass-through is handled downstream.

---

## Area 7 — Browse Challenges Failure

### Finding: Error message in `BrowseChallengesScreen` ignores actual error type

```ts
function challengeQueryState(): { title: string; message: string } {
  return {
    title: 'Challenges are temporarily unavailable',
    message: 'Please try again shortly.',
  };
}
// ...
const errorState = isError ? challengeQueryState() : null;
```

The function signature accepts no arguments. The `error` variable from `useVisibleChallengesPage` is destructured but never passed to `challengeQueryState`. All errors — network timeouts, Firestore permission denials, missing indexes — show identical copy: "Challenges are temporarily unavailable."

### Indexes are present for Browse queries

The required composite indexes exist in `firestore.indexes.json`:
- `(status, visibility, startDate)` ✓
- `(status, groupVisibility, startDate)` ✓
- `(groupId, status, startDate)` ✓

So the Browse failure is not index-related. The error is likely from Firestore security rules or an intermittent network condition. The generic error copy is the deficiency.

### Finding: `useVisibleChallengesPage` loads all results before filtering

`getVisibleChallengesForUserPage` fetches both `visibility == 'public'` and `groupVisibility == 'public'` in parallel, then deduplicates. This is correct. The client-side `publicBrowseChallenges` filter then re-applies visibility checks (defense in depth). There is no redundancy issue, just potential over-fetching.

**Severity**: LOW — functionality works. Error copy is unhelpful but does not block usage.

---

## Area 8 — Trending Challenge Logic

### Trending pipeline (from `useHomeScreen.fetchHomeScreenData`)

1. **Source**: `getChallengesPage({ pageSize: 15, statuses: ['active'], visibility: 'public' })`
   - Fetches up to 15 public active challenges, ordered by `startDate desc`
   - Does NOT filter by date range — expired challenges (status still 'active') could enter here
2. **Filter**: `isDiscoverableTrendingChallenge` — applies `isChallengeOngoing` (date-bounded) + visibility public check
   - This correctly removes expired and upcoming challenges
3. **Sort**: `participantCount desc`, then `startDate desc` as tiebreaker
4. **Limit**: top 5
5. **Join flag**: `joinedChallengeIds` built from `activeUserChallenges` map — determines `actionLabel`

### Finding: Trending challenges require `visibility: 'public'` at the query level

`getChallengesPage` with `visibility: 'public'` uses only the `visibility` field. But `isDiscoverableTrendingChallenge` accepts `visibility === 'public' || groupVisibility === 'public'`. Challenges with `groupVisibility: 'public'` but `visibility: 'private'` would pass the `isDiscoverableTrendingChallenge` filter but never reach it — they'd be excluded from the initial Firestore query.

This is a silent gap: semi-public challenges (`groupVisibility: 'public'`, `visibility: 'private'`) are excluded from trending even if they'd qualify.

### Finding: Trending empty state is handled correctly

`HomeScreen` shows "No trending challenges available yet." when `effectiveTrendingChallenges.length === 0`. The data path has `.catch(() => ({ items: [], ... }))` so a fetch failure silently shows the empty state rather than an error.

**Severity**: LOW — trending filter logic is sound. The `groupVisibility` gap means some challenges are missed from trending, but doesn't cause incorrect data to be displayed.

---

## Area 9 — Data Integrity Audit (static analysis only)

Since no live Firestore access was performed in this phase, findings are inferred from code patterns + prior P4J inspection results.

### Known data quality risks

| Risk | Source | Severity |
|------|--------|----------|
| Expired challenges with `status: 'active'` | No automatic lifecycle transition | HIGH |
| Pre-P4I members with `status: 'completed'` on active challenges | P4J found 2 such members | MEDIUM |
| `participantCount` not incremented on client-side joins | Area 5 analysis | HIGH |
| Challenges in groups the user has left appearing on Home | Area 1 Mechanism A | MEDIUM |

### `challengeMembers` status distribution (inferred)

The app handles: `active`, `completed`, `abandoned`. Legacy docs may have `inactive` or missing `status` field. `getUserChallengeMembershipIndex` uses whatever status is stored without normalization.

### Missing fields

`ChallengesScreen.ongoingCards` and `BrowseChallengesScreen` calculate days remaining from `item.endDate` using `new Date(item.endDate)`. If `endDate` is missing (challenge has no end), `new Date(undefined)` produces `Invalid Date` and `getTime()` returns `NaN`. The `Math.max(0, Math.ceil(NaN / msPerDay))` expression produces `NaN` shown as "NaN Days Left". `isChallengeOngoing` treats missing `endDate` as never-expired (returns `null` from `parseChallengeEndMs`), so the challenge would still show in Home active challenges with an incorrect progress bar.

**Severity**: MEDIUM — challenges without an `endDate` produce "NaN Days Left" in ChallengesScreen and BrowseChallengesScreen.

---

## Summary of Findings

| # | Area | Finding | Severity |
|---|------|---------|----------|
| 1a | Active challenge consistency | Home uses `isChallengeOngoing`, Challenges Ongoing has no date filter | HIGH |
| 1b | Active challenge consistency | Group-membership gap causes Home/Challenges divergence for left-group challenges | HIGH |
| 3a | Lifecycle | No automatic `active → completed` transition; expired challenges persist as active | HIGH |
| 3b | Lifecycle | Pre-P4I completed members on active time-bounded challenges (2 found in P4J) | MEDIUM |
| 5 | Participant count | `joinChallenge` client SDK does not increment `participantCount` | HIGH |
| 8 | Trending | `groupVisibility: 'public'` challenges excluded from trending feed | LOW |
| 9a | Data integrity | Missing `endDate` produces "NaN Days Left" in ChallengesScreen and BrowseChallengesScreen | MEDIUM |
| 9b | Data integrity | `participantCount` stale for post-creation joiners | HIGH |
| 2 | Wellness handling | `isWellness` derived from `category` — consistent but doesn't cover `streak + fitness` case | LOW |
| 4 | Upcoming challenges | Upcoming challenges appear in ChallengesScreen Ongoing but not Home active cards | MEDIUM |
| 6 | Navigation | All cards navigate correctly. No dead-click issues. | — |
| 7 | Browse failure | `challengeQueryState` ignores actual error; all errors show same copy | LOW |

---

## Prioritized Fix Candidates (for separate phases)

### P5-Fix-A (HIGH — data display): Apply `isChallengeOngoing` to Challenges Ongoing section
Add date filtering in `getUserAccessibleChallengesPage` or in `ChallengesScreen.ongoingCards` to exclude expired challenges. Aligns Ongoing section with Home behavior.

### P5-Fix-B (HIGH — data display): Guard `endDate` in ChallengesScreen and BrowseChallengesScreen
Replace `new Date(item.endDate).getTime()` with the lifecycle helpers `parseChallengeEndMs`/`parseChallengeStartMs` to avoid "NaN Days Left" for missing-endDate challenges.

### P5-Fix-C (HIGH — data integrity): Audit Cloud Function for `participantCount` increment
Verify `createChallengeWithCreatorMembership` and any join path increments `participantCount` on the challenge document. Client-side `joinChallenge` currently does not do this.

### P5-Fix-D (MEDIUM): Improve Browse error copy
Pass `error` to `challengeQueryState` and distinguish permission errors from network errors.

### P5-Fix-E (LOW): Include `groupVisibility: 'public'` challenges in trending feed
Change `getChallengesPage` call in `fetchHomeScreenData` to also fetch `groupVisibility == 'public'` challenges, or use `getVisibleChallengesForUserPage` which already queries both fields.

---

## Validation

No code was changed in this phase. No validation run needed.

The following test suites remain green from P4K:
```
npm run test:scoring-guards          → scoring guards passed
npm run test:home-challenge-feeds    → home challenge feed guards passed
npm run test:home-performance-guards → home performance guards passed
npx tsc -b --pretty false            → (no errors)
```

---

## Files Read (audit only, not modified)

- `src/services/challengeService.ts`
- `src/services/challengeLifecycle.ts`
- `src/services/memberMetricsService.ts`
- `src/hooks/useChallenges.ts`
- `src/features/Home/useHomeScreen.ts`
- `src/features/Home/HomeScreen.tsx`
- `src/features/Challenges/ChallengesScreen.tsx`
- `src/features/Challenges/BrowseChallengesScreen.tsx`
- `src/components/Home/TrendingChallenges.tsx`
- `firestore.indexes.json`
