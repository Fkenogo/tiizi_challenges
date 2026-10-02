# Tiizi Platform Operator Console Baseline 001

Status: Historical Local Development preview baseline. Its capability
inventory is superseded by [Platform Operator Console Assembly 001](TIIZI-PLATFORM-OPERATOR-CONSOLE-ASSEMBLY-001.md), which reconciles the current
Operator surfaces against the approved prototype Experience Reference and
assembles the additional authoritative read models. This record does not
authorize merge, deployment, production access, payment execution, or the
production scheduler.

## Current operating model

- Tiizi has one Platform Operator Console. It is the operational product being
  assembled progressively, not a temporary Development Operator product.
- Fred Kenogo is the sole current Platform Operator.
- Local / Development Preview names the environment and non-production data;
  it is not a separate operator class.
- The local preview uses a dedicated Firebase Auth identity for Fred because
  the existing V2 authentication session can switch accounts and the current
  member identity must not acquire Operator authority by virtue of being the
  Founder. The identity is linked to a member row, and the existing explicit
  Platform Operator roster remains authoritative for Social Cause review.
- The roster grant is scoped to Social Cause review. It does not create
  unrestricted administration authority or infer authority from Founder,
  member, Group steward, or Challenge creator status.
- Fred cannot decide a Cause created by his linked member identity, even when
  that identity is rostered. Creator self-approval remains prohibited.
- Additional administrators/operators may be introduced later through a
  governed Access & Roles capability. This record does not define their
  permission model.
- Console capability is assembled progressively as authoritative platform
  read models and governed actions become available. An item in the
  navigation is not itself authority to expose or mutate data.

## Authority reconciliation

EA-01 places the broader S9 Operator surfaces after Access & Roles and gates
actions on an operator-authority decision. The earlier Founder-authorized
Social Cause approval assembly is a narrow, explicit application of that gate:
Migration 023 created a scoped, revocable Cause-review roster, and the review
API uses it fail-closed. This baseline identifies Fred as the person behind
the current local grant; it does not extend that grant to other console
actions or complete a general Access & Roles model. The read-only Overview
uses only the same existing authorized Cause queue.

The Platform Authority Model still defers canonical role vocabulary and a
general permission matrix. This task assigns neither. The current sole
operator direction and Cause-specific roster are compatible because the
product label does not itself grant authority. No unresolved authority
conflict was found for the Social Cause workflow. Cross-Challenge Support
configuration remains unavailable in the Operator console because the
existing reviewer grant does not authorize a platform-wide Challenge read.

## Capability matrix

| Section | Authoritative capability and current surface | Safe to expose now | Missing dependency / boundary |
|---|---|---|---|
| Overview | The roster-protected pending Social Cause endpoint is an authoritative queue read. Overview reports its count and up to three queue items. | Yes, read-only; API still authorizes every read. | No platform-wide analytics or aggregate read model; no metrics are inferred. |
| Users | Member records exist; current member APIs are scoped to the authenticated member. | No Operator directory or actions. | Operator-scoped directory/read model and governed support actions. |
| Groups | Groups and memberships exist; current Group APIs are scoped to member/steward contexts. | No platform-wide Operator view or actions. | Operator-scoped Group read model and separately governed moderation/management authority. |
| Activities & Knowledge | Canonical Knowledge and member catalogue reads exist. | No Operator catalogue/publishing surface. | Operator-scoped catalogue review and publishing authority. |
| Challenges | Challenge records and member-scoped read APIs exist, including lifecycle, Cause, and Support Tiizi configuration. | Cause-related Challenge context only appears inside the authorized Cause review detail. | Platform-wide Operator Challenge read model and any separately governed management capability. |
| Templates | No authoritative Operator template read/publishing surface is assembled. | No. | Governed template source and Operator read/publish authority. |
| Review & Attention | Social Cause pending queue, detail, reason-required approval/revision, and decision history use the explicit revocable Platform Operator roster. | Yes; this is the functional decision surface. | Other review queues require their own authoritative capability and authority. |
| Donations / Support | Challenge Support Tiizi and beneficiary-owned Cause destination configuration exist. Cause configuration is readable during authorized Cause review. | No cross-Challenge support configuration page; no contribution ledger or payment execution. | An Operator-scoped read capability for platform-wide Challenge support settings. S8 contribution/payment execution remains out of scope. |
| Content & Localisation | No authoritative Operator content/localisation read or edit surface is assembled. | No. | Governed content source and editing/review authority. |
| Access & Roles | `platform_operator_cause_reviewers` is the explicit, revocable Cause-review authority source. No self-service role assignment route exists. | Current identity and role are identified; this page does not expose grant changes. | Governed roster/role administration. No future permission model is prescribed here. |
| Platform Health | API liveness/readiness endpoints exist. They do not represent whole-platform health. | No broad health dashboard. | Operator-scoped service/infrastructure health read model and incident semantics. |
| Audit Log | Cause decisions persist reason, actor member ID, and timestamp; authorized review detail exposes their history. | Cause-specific history is shown on its Cause. | A console-wide audit read model. No other action history is implied. |
| Settings | No authoritative Operator settings read/change surface is assembled. | No. | Governed settings source and change authority. |

## Local preview data and authentication

The Development database contains 10 member records, 10 active Groups (nine
public and one private) with owner/member memberships, Together/Race/Streak
Challenges in active, establishment, and ended/finalized states, Support Tiizi
enabled and disabled cases, five accepted Activity records/events, eight
participations, and approved, pending, and revision-required Causes. A
pre-existing, clearly labelled
`DEV PREVIEW — Completed Wellness Challenge` was finalized through the existing
lifecycle CLI to represent its supported finalized state; no Challenge or
Cause records were deleted. The local Cause seed adds two clearly labelled
review exercises, one approved and one revision-required through the governed
review API, while retaining the original pending Founder Cause. The seed is
idempotent and does not reset pre-existing Development records.

The pending Founder review Cause is retained. No approval decision is made
just to populate the preview. Local Auth bootstrap provisions the dedicated
Fred identity only against loopback Firebase Auth and a loopback PostgreSQL
database; its password comes from `TIIZI_SOCIAL_CAUSE_OPERATOR_PASSWORD`, is
never printed by the bootstrap, and is not stored in tracked configuration.
The bootstrap refuses `NODE_ENV=production`. No production credential or
default is added.

## Scope boundaries

This baseline does not assemble the broader console CRUD/admin system, define
additional operator roles, execute contributions or payments, or add the S9
production scheduler. Social Cause approval does not activate a Challenge by
itself; the accepted scheduled lifecycle remains governed by its existing
rules. The beneficiary owns the destination reference and Tiizi does not hold
or escrow funds.
