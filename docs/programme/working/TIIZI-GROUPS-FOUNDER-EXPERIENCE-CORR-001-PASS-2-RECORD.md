# Groups Founder Experience Correction 001 — Pass 2 Record

Status: **candidate implementation; Founder review remains outstanding**.

Starting point: Pass 1 candidate `3b1bcc412d8b1aef33cbf9cb6174fe28a651e5e3` on
`impl/tiizi-groups-founder-experience-correction-001`.

This bounded continuation preserves the accepted Pass 1 single-column Group
discovery and Home direction, S4a–S4d authority, the S6 Activity Guide, and the
existing Challenge creation experience. It does not implement a Group Feed,
recommendations, matching, Challenge Creation redesign, production writes, or
deployment.

## Product model

- **Focus Area** = what a Group is interested in.
- **Group Goal** = what outcome the Group wants to achieve.
- **Activity** = what participants do.

The exact V2 Goal and Community Norm labels, stable IDs, limits, and metadata
contracts are recorded as a Founder-review candidate in
[`TIIZI-V2-GROUP-METADATA-PRODUCT-TRUTH-CORR-001.md`](../../experience/TIIZI-V2-GROUP-METADATA-PRODUCT-TRUTH-CORR-001.md).
The Goal and Norm lists remain proposals pending Founder acceptance; they do
not establish enforcement, scoring, Challenge eligibility, Activity authority,
ranking, recommendation, or matching.

The standard Focus Area labels reuse EKG-01 §5 Fitness/Wellness categories.
All applicable standard labels can be selected; one custom descriptive value
of at most 30 characters remains optional.

## Implementation and persistence

The candidate adds PostgreSQL migration 021 for separate Group Goal and
Community Norm IDs/custom text; existing rows receive empty/null defaults.
Authenticated Group options, governed Group creation validation/write,
member-visible Group detail, public Goal discovery projection/search, and the
five-step creation wizard are extended. No Activity or Challenge domain
authority changes.

The current PostgreSQL schema was verified with two existing Groups, two
existing Challenges, and 118 uniquely coded Published Activities. The migration
was applied to the local Development database. No existing Group or catalogue
rows were changed by the migration.

## Invite-code product boundary

S4c keeps private Groups out of discovery and requires invite-code resolution
to establish their identity. Current governed admission has open and approval
states, but no “requires invite code” setting for a discoverable Group. The
requested interaction “select a private Group, then enter its code” cannot be
implemented without either disclosing private Group identity or adding a new
admission/discovery contract. Pass 2 preserves the S4c code resolver and
visibility boundary. A Founder Product Truth disposition is still required
before replacing that flow.

## Founder preview limitation

No additional Development Groups, memberships, or Challenges were seeded.
The authenticated browser review and requested mobile/desktop evidence remain
incomplete because the local Auth emulator restarted with no Founder preview
account and the existing repository reset workflow requires
`TIIZI_V2_PREVIEW_PASSWORD`, which was not available in this environment. The
current Development data was preserved. Browser review and bounded preview
seeding must resume after the Founder account is restored through the existing
local-only account workflow.
