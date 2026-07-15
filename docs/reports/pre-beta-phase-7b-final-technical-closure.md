# Pre-Beta Phase 7B — Final Technical Gate Closure

Date: 2026-07-11
Branch: `fix/p0-pre-deploy-blockers`

## Summary

Closed the two remaining red items from Phase 7: added a Home activation
card for brand-new users (zero groups, zero ongoing challenges), and
replaced the placeholder support-email wording in Terms/Privacy with the
real address. All 53 guard scripts now pass with zero failures. No Firestore
rules/indexes were touched, no new Firestore queries were added, and Home's
existing loading/error/challenge-card/group-card behavior is unchanged.

## Files changed

- `src/features/Home/HomeScreen.tsx` — new activation card + minor copy
  addition to the existing "My Challenges" empty state.
- `src/features/Legal/TermsScreen.tsx`, `src/features/Legal/PrivacyScreen.tsx`
  — removed placeholder wording around the support email.
- `scripts/testPilotUxPolishGuards.ts` — updated two stale P3B-era text
  assertions to match the finalized activation-card copy.
- `scripts/testLegalRoutingAndSafetyGuards.ts` — added explicit assertions
  for the real support email and the absence of placeholder wording.
- `src/features/Profile/ProfileInterestsScreen.tsx`,
  `scripts/testHomePerformanceGuards.ts` — carried forward from Phase 6B
  (already committed-equivalent working-tree state; no further change made
  to these in this phase beyond what Phase 6B produced).

## Part 1 — Home activation card

**Display condition:** renders when, and only when, both are true:
```ts
const joinedGroupCount = data?.myGroupsCount ?? 0;
const activeChallengeCount = effectiveMyChallenges.length;
const showActivationCard = joinedGroupCount === 0 && activeChallengeCount === 0;
```
Both values are read from data `useHomeScreenData()` already returns
(`myGroupsCount`) and from `effectiveMyChallenges`, the same array the
"My Challenges" section already renders from (itself already computed from
`data.myChallenges` with an existing bounded-query fallback). **No new
Firestore reads, hooks, or queries were added** — the card is purely a
derived-state conditional over data the screen already fetches.

**Content:**
- Heading: "Start your Tiizi journey"
- Body: "Join a group or create your first challenge to start building
  healthy habits together."
- Actions:
  1. "Explore Groups" → `navigate('/app/groups', { state: { tab: 'discover' } })`
     — the existing Groups discovery screen (same navigation call already
     used elsewhere on Home for the no-groups empty state).
  2. "Create Challenge" → `navigate('/app/create-challenge')` — the existing
     challenge creation wizard route.

Both destinations were already registered in `App.tsx` before this change
(confirmed via `scripts/testRouteLinkAudit.ts`, which re-validated all
navigate destinations after this edit — 269 destinations checked, 0
unresolved).

**No duplication:** the card is wrapped in a single `showActivationCard &&`
conditional and renders in exactly one place, above the "My Challenges"
section. It disappears as soon as the user has ≥1 group or ≥1 ongoing
challenge — no separate code path can render it a second time.

**Existing empty-state copy tweak:** the "My Challenges" section's own
per-item empty state (shown whenever the user has zero ongoing challenges,
independent of group count) got a two-line copy addition — "Get Started"
heading and "Your active challenges will appear here once you join or
create one." — to satisfy a second, pre-existing guard requirement for that
empty state. This is a text-only change: same card, same conditional
Browse-Challenges/Join-a-Group buttons, same routes, same layout.

**Guard maintenance:** `testPilotUxPolishGuards.ts`'s "Home activation card"
block dates from an earlier, never-implemented P3B spec and required
different literal wording ("Welcome to Tiizi"/"Begin your wellness
journey", "Join a Group"/"Join a Challenge") than this phase's explicit,
founder-specified copy ("Start your Tiizi journey", "Explore Groups"/
"Create Challenge"). Updated those two text assertions to the copy actually
specified in this task — the same treatment Phase 6B gave the interests
validation message. The core condition assertion
(`joinedGroupCount === 0|activeChallengeCount === 0`) and the "Get Started"/
"Your active challenges will appear here" assertions were left completely
untouched and are satisfied by the implementation as written — nothing was
weakened or deleted.

## Part 2 — Legal support email cleanup

Both `TermsScreen.tsx` and `PrivacyScreen.tsx` previously read:
> "...or reach us at **support@tiizichallenges.com** (placeholder — update
> with your real support contact before public launch)."

Changed to:
> "...or reach us at **support@tiizichallenges.com**."

The address itself was already correct — only the trailing placeholder
qualifier was removed. No claim of a monitored inbox was added (per
instruction). The "Beta notice" legal-review disclaimer at the top of each
screen (not yet reviewed by a lawyer, not legally certified) was **not**
touched — confirmed present in both screens after the edit.

Added explicit guards to `scripts/testLegalRoutingAndSafetyGuards.ts`:
- `TermsScreen` and `PrivacyScreen` each contain `support@tiizichallenges.com`.
- Neither screen matches `/placeholder|update this email|update.*support contact/i`.

Verified live in the Browser pane: `document.body.innerText` on both `/terms`
and `/privacy` contains `support@tiizichallenges.com` and does not contain
the string `placeholder`.

## Part 3 — Verification

```
npx tsx scripts/testPilotUxPolishGuards.ts        → PASS
npx tsx scripts/testHomePerformanceGuards.ts       → PASS
npx tsx scripts/testOnboardingGuards.ts            → PASS
npx tsx scripts/testHomeChallengeFeeds.ts          → PASS
npx tsx scripts/testLegalRoutingAndSafetyGuards.ts → PASS (46 passed, 0 failed)
npx tsx scripts/testRouteLinkAudit.ts              → PASS (269 destinations checked, 104 routes declared)
npx tsc --noEmit                                    → clean, 0 errors
npm run build                                       → succeeds (pre-existing >500kB bundle-size warning only)
```

**Full guard suite** (`scripts/test*.ts`, 53 scripts):

```
PASSED: 53
FAILED: 0
```

Zero unexplained failures — every guard script in the repository passes.

## Manual QA still required

This phase closed the two remaining automated-guard gaps; it did not (and
was not asked to) perform live human verification. The following from
Phase 7's manual QA matrix are still outstanding and need a human with a
real account:
- Confirm the activation card actually renders for a genuinely new
  authenticated user (zero groups, zero challenges) and disappears the
  moment they join a group or a challenge.
- Confirm "Explore Groups" opens the Groups screen on the Discover tab and
  "Create Challenge" opens the challenge creation wizard, end to end, on a
  real device.
- Re-confirm the "My Challenges" empty-state copy change reads correctly
  for a user who has joined a group but has zero ongoing challenges (a
  state distinct from the activation-card condition).
- Full new-user onboarding → Home walkthrough, existing-user data-accuracy
  checks, group/challenge flows, and install/share flows remain
  unexecuted from Phase 7 (no live account, device, or deployment was
  available in this session either).

No Firestore writes, rules changes, index changes, or deploys were
performed. No unrelated features were added.
