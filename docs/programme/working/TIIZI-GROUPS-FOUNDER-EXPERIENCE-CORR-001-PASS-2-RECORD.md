# Groups Founder Experience Correction 001 — Pass 2/3 Record

Status: **Founder Product Truth dispositions approved; Groups experience
preview remains outstanding**.

Starting point: Pass 1 candidate `3b1bcc412d8b1aef33cbf9cb6174fe28a651e5e3` on
`impl/tiizi-groups-founder-experience-correction-001`.

This bounded continuation preserves the accepted Pass 1 single-column Group
discovery and Home direction, S4a–S4d authority, and the S6 Activity Guide. It
does not implement a Group Feed, recommendations, matching, Challenge Creation
redesign, production writes, or deployment.

## Approved Product Truth

- **Focus Area** = what a Group is interested in.
- **Group Goal** = what outcome the Group wants to achieve.
- **Activity** = what participants do.

The Goal and Community Norm IDs, labels, limits, and metadata contract are
approved V2 Product Truth in
[`TIIZI-V2-GROUP-METADATA-PRODUCT-TRUTH-CORR-001.md`](../../experience/TIIZI-V2-GROUP-METADATA-PRODUCT-TRUTH-CORR-001.md).
Focus Areas reuse the unchanged twelve Fitness/Wellness category labels in
EKG-01 §5. All applicable standard labels may be selected, plus at most one
custom descriptive Focus Area up to 30 characters. Multiple standard Goals
and Norms may be selected; at most one custom Goal (80 characters) and one
custom Norm (200 characters) may be recorded. Goals and Focus Areas can be
searched as descriptive metadata; none of these fields provide recommendation,
ranking, matching, enforcement, scoring, Challenge eligibility, or Activity
authority.

The approved five-step creation wizard is: Identity; Look & Focus (Focus Areas
and Group Goals); How the Group works; How we work (Community Norms); Review.

## Persistence and API

PostgreSQL migration 021 adds separate Goal and Community Norm IDs/custom-text
fields. Existing Groups receive empty/null defaults. Authenticated options,
Group creation validation/write, member-visible detail, public Goal projection
and search use the existing Group API and PostgreSQL authority. No Activity,
Challenge, lifecycle, or S6 authority changed.

## Invite-code boundary

S4c keeps private Groups out of discovery and resolves Group identity through
the existing invite-code capability. Founder accepted that boundary in Pass
3: no new discoverable-plus-code-required admission state is introduced. The
Discover screen has a secondary “Have an invite code?” entry that calls the
existing resolver, previews the canonical Group, then continues through
existing open-join or approval membership authority. A future
discoverable-plus-code-required policy requires a separate S4c Product Truth
decision.

## Development preview data

Before preview seeding, the local Development catalogue had 118 canonical
Published Activities; PostgreSQL had two Groups and two Challenges. No
existing Group or Activity rows were deleted or overwritten. Pass 3 created
six labelled public preview Groups and one labelled private visibility-test
Group through `POST /v1/groups`; it joined the Founder to the two existing
public/open Groups through the existing join endpoint. The Founder has eight
active memberships before the private test Group and nine after joining it;
created Groups have exactly one Accountable Steward each.

Five clearly labelled local Auth-emulator-only member identities were linked
using the existing `createMember` identity helper and joined the
“Groups Preview — Focus & Goals” Group via the governed join endpoint. This
Group has six valid active memberships: one Founder Accountable Steward and
five Members. Five upcoming Streak Challenges using the canonical
`FIT-MOB-005` Activity (version 1, repetitions/reps; seven consecutive days;
explicit Africa/Bujumbura timezone) were created through `POST /v1/challenges`
and the existing PF-03 definition validation/establishment authority. They
remain upcoming; no Challenge rules or Activity authority changed.

The preview orchestrator was rerun after validation rejected a Streak request
missing its mandatory timezone. The rerun created zero duplicate Groups,
members, memberships, or Challenges; it created the five valid Challenges.
No data was removed. Two pre-existing Challenges remain untouched.

## Browser verification

The local Founder Auth account (`founder1@tiizi.local`) was restored with the
repository's emulator-only reset command. The S2-G identity workflow linked it
to PostgreSQL. Authenticated browser review verified:

- My Groups: six initial single-column rows and “View more Groups (2 more)”
  before the private Group; after creating the private case and refreshing,
  the initial six had “View more Groups (3 more)”.
- Discover: compact Group rows; name, canonical Focus Area, canonical Goal,
  and custom Focus Area searches returned the matching preview Group.
- The private visibility-test Group returned no result for its name in normal
  Discover search. The secondary invite-code entry resolved it by its valid
  code without exposing it in search.
- Group Home: About this Group is collapsed by default and expands on demand;
  five hosted Challenge rows show four initially with “View more Challenges”;
  six Members show four initially with “View all members”.
- The five-step Group creation flow was completed in the browser. Review
  showed the selected standard/custom Focus Areas, Goals, and Community Norms;
  the created Group then appeared in its persisted Group Home and after a page
  reload.

Chrome responsive device emulation was set to exactly 375 CSS pixels for the
mobile-first walkthrough. The My Groups screen rendered one row per Group,
showed the initial six and “View more Groups (3 more)”, and retained the V2
bottom navigation without horizontal overflow. Desktop review used the full
local Chrome viewport and preserved the same single-column Group and
Challenge hierarchy. Screenshots were captured for My Groups at 375px,
Discover search results, the Group Home, and invite-code resolution. Overall
Groups experience Founder acceptance remains outstanding. Challenge Creation
Founder Experience Review remains a separate follow-on and was not started.

## Pass 3 validation and preview readiness

- Root `npm run build` (frontend typecheck + Vite build): passed.
- `npm run typecheck --prefix api` and `npm run build --prefix api`: passed.
- S4a Group Home, S4b Members, S4c invite/discovery, S4d settings,
  S2-G establishment, V2 frontend/experience/runtime/navigation, S6 Library,
  S6 Challenge discovery, S2a/S2b Challenge seam/integration, Group UX polish,
  and `git diff --check`: passed.
- Full API suite, serial (`--maxWorkers=1 --minWorkers=1
  --fileParallelism=false`): 53 test files passed (686 tests), one emulator
  integration file skipped, and `challengeActivityApplication.test.ts` hit
  its 60-second PGlite setup hook limit. Running that file alone immediately
  afterward passed all 40 tests (67.77 seconds total). The setup timeout did
  not reproduce in isolation; the complete suite was not rerun after that
  isolated pass.
- An additional legacy `test:group-lifecycle` guard reports one stale source
  assertion (`challenges allow create includes isActiveGroup gate`); 63 other
  assertions pass. The challenged files/contract were not changed in Pass 3.
- Local readiness was rechecked: Vite `/v2/groups`, API `/health` and `/ready`,
  PostgreSQL 17 Development on loopback port 15433, and Auth emulator on
  loopback port 9099 respond. The existing Auth account is present and the
  V2 browser session had already authenticated successfully.

No Challenge Creation UX changes were made. No production access, writes,
deployment, catalogue mutation, lifecycle transition, or eligibility change
occurred in Pass 3.
