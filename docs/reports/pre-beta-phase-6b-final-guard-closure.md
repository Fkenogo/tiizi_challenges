# Pre-Beta Phase 6B — Close Remaining Guard Failures

Date: 2026-07-11
Branch: `fix/p0-pre-deploy-blockers`

## Summary

Fixed the activity-interest minimum (founder decision: min 3, max 10) and
rewrote `testHomePerformanceGuards.ts` to test actual unsafe behavior instead
of banning legitimate service-layer imports. Both previously-red guards from
Phase 6 are addressed; one unrelated pre-existing gap in
`testPilotUxPolishGuards.ts` remains and is out of scope (see below).

## Files changed

- `src/features/Profile/ProfileInterestsScreen.tsx` — validation threshold,
  error copy, helper copy, Next-button disable state.
- `scripts/testPilotUxPolishGuards.ts` — updated two stale assertions
  (variable name, message text) to match the founder-approved copy.
- `scripts/testHomePerformanceGuards.ts` — fully rewritten per Part 2.

## Part 1 — Activity-interest minimum

`ProfileInterestsScreen.tsx`:
- `handleNext` now checks `selected.length < 3` (was `< 1`) and shows
  `"Choose at least 3 activities."` (was `"Choose at least one activity."`).
- Card helper copy now reads `"Choose 3 to 10 activities to personalise
  your experience."` (was `"Pick up to 10 activities. Choose at least 1..."`).
- `MAX = 10` is unchanged — the selection cap (`prev.length >= MAX` in
  `toggle()`) was never touched, so the 10-item maximum still applies.
- Next button is now also visually disabled below 3 selections (previously
  only blocked via toast), for a consistent "blocked" state.
- Hydration (`useEffect` reading `profileSetup.exerciseInterests` into
  `selected` on mount) and Previous/Next navigation targets were not
  touched — existing saved selections still hydrate and navigation is
  unchanged.

`testPilotUxPolishGuards.ts` had two stale assertions predating this
decision: it checked for a `selectedInterests` variable name (the actual
code has always used `selected`) and the message text `"Select at least 3
interests"` (never implemented under that wording in any version of this
file). Updated both to match the code's real variable name and the
founder-approved copy `"Choose at least 3 activities."`. The existing
"no cap" assertion (`prev.length >= 10|prev.length >= 3` literal ban) needed
no change — the code has always gated the max via the `MAX` constant, not a
literal `10`, so it already satisfied that assertion before and after this
change.

## Part 2 — Home performance guard: assertion classification

| Original assertion | Classification | Disposition |
|---|---|---|
| `useHomeScreen.ts` must not import `firebase/firestore` | VALID CURRENT REQUIREMENT | Kept |
| `useHomeScreen.ts` must not reference `groupService` | STALE ARCHITECTURE EXPECTATION | Removed — accepted architecture explicitly allows bounded `groupService` calls (Home reads `groupService.getMyGroups` for the group count/header) |
| `useHomeScreen.ts` must not reference `userProfileService` | STALE ARCHITECTURE EXPECTATION | Removed — accepted architecture explicitly allows bounded `userProfileService` calls (Home reads profile/identity for the header) |
| `useHomeScreen.ts` must not reference `memberActivitySummaryService` | VALID CURRENT REQUIREMENT | Kept — this service exists and is used elsewhere (Groups feed), but reintroducing it as a live fallback in Home would be a real regression risk worth guarding against |
| `useHomeScreen.ts` must not call `getDocs(` | VALID CURRENT REQUIREMENT | Kept |
| `useHomeScreen.ts` must not call `collection(` | VALID CURRENT REQUIREMENT | Kept |
| `useHomeScreen.ts` must not call `documentId(` | VALID CURRENT REQUIREMENT | Kept |
| `useHomeScreen.ts` must reference `memberMetricsService` | STALE ARCHITECTURE EXPECTATION | Removed — `memberMetricsService` exists in the codebase (`src/services/memberMetricsService.ts`) but nothing in Home's actual data flow uses it; forcing this reference would require inventing a new code path, not fixing an unsafe one |
| `useHomeScreen.ts` must reference `getChallengesPage` | POST-BETA OPTIMIZATION | Removed — this method does not exist anywhere in the codebase. Building it would mean designing a new bounded-pagination path for Home's "trending" section — a broad Home redesign, explicitly out of scope |
| `useHomeScreen.ts` must reference `getActiveChallengesForUser` | POST-BETA OPTIMIZATION | Removed — same as above, method does not exist anywhere in the codebase; adding it is new-feature work, not a fix for the current implementation |

## Rewritten guard content

Per the accepted architecture, the guard now checks:

1. **No direct Firestore access in `useHomeScreen.ts`** — no `firebase/firestore`
   import, no `getDocs(`, no `collection(`, no `documentId(`, no
   `memberActivitySummaryService` reference (all VALID, unchanged behavior
   from before, just no longer bundled with the stale bans).
2. **Home's three Firestore-backed reads go through named
   `challengeService` methods** — `getChallengesByIds`,
   `getCompetitiveLeaderboards`, `getChallengeActivitySummaries` must all be
   called from `useHomeScreen.ts` (this is what actually replaced the old
   inline reads in Phase 6, and is what the "service methods" requirement
   in the accepted architecture means in practice).
3. **Challenge-ID queries stay chunked to Firestore's `in` limit** — scans
   `challengeService.ts` for every `where(documentId(), 'in', <var>)` call
   and asserts the variable is a chunked slice (not `uniqueIds`, the
   unchunked full array), plus asserts a `+= 10` chunking loop exists
   feeding those chunk arrays.
4. **No unbounded query in the three Home-facing service methods** —
   extracts each of `getChallengesByIds`, `getCompetitiveLeaderboards`,
   `getChallengeActivitySummaries`'s method body from `challengeService.ts`
   and asserts none of them call `getDocs(collection(...))` without a
   `where()`/chunked-`in` filter (which would be an unbounded full-collection
   scan).

Sanity-checked the rewritten guard catches regressions: reintroducing a
`firebase/firestore` import string into `useHomeScreen.ts` content in a
throwaway in-memory test correctly flips the relevant assertion to fail.

## Home implementation changes

**None.** No unbounded read was found — Phase 6's service-layer refactor
already chunks every `documentId() in` query at 10 items and filters every
read with a `where()`/`in` clause. Only the guard script was rewritten; Home
data flow, calculations, and displayed values are unchanged from Phase 6.

## Verification

```
npx tsx scripts/testPilotUxPolishGuards.ts   → FAIL (see below, out of scope)
npx tsx scripts/testHomePerformanceGuards.ts → PASS
npx tsx scripts/testOnboardingGuards.ts      → PASS
npx tsx scripts/testHomeChallengeFeeds.ts    → PASS
npx tsc --noEmit                              → clean, no errors
npm run build                                 → succeeds (pre-existing >500kB
                                                 chunk-size warning only, unrelated)
```

**`testPilotUxPolishGuards.ts` failure is not Phase 6B scope.** After the
Part 1 fix, the script progresses past all interest-selection assertions
(they now pass) and fails on a later, unrelated assertion:

```
expected: /joinedGroupCount === 0|activeChallengeCount === 0/
```

This checks for a "Home activation card" for new users on `HomeScreen.tsx`
— a feature that was never built and is tracked as its own pending backlog
item ("Add Home activation card for new users"), unrelated to onboarding,
forgot-password, or Home service-layer work. Confirmed via `git stash` that
before the Part 1 fix this script failed on the interests assertion first;
after the fix it fails on this pre-existing, later assertion instead — i.e.
Part 1 is fully resolved and this is a separate, already-tracked gap.

## Full guard suite

Ran all 52 scripts under `scripts/test*.ts`:

**51 passed, 1 failed** (up from 50/52 before this phase).

Only failure: `testPilotUxPolishGuards.ts`, on the pre-existing/out-of-scope
Home activation card assertion documented above.

## Typecheck / build

- `npx tsc --noEmit` — clean.
- `npm run build` — succeeds.
