# Challenge Social Cause Operator Approval Assembly 001

Status: **Functionally accepted, subject to Founder preview inspection; Challenge Founder Experience Review 001 remains OPEN**
Starting candidate: `545c985989bf7e91bf805c98087d574a69da28b1`  
Branch: `impl/tiizi-challenge-founder-experience-review-001`

## Existing authority and lifecycle evidence

- Firebase ID-token authentication resolves the actor to the canonical
  PostgreSQL `members.member_id`; client-supplied member IDs are not accepted.
- The Social Cause decision route already required an injected
  `isPlatformOperator` callback and failed closed when it was missing. Runtime
  `api/src/index.ts` did not provide it. Operator shell navigation was present,
  but all sections were placeholders and V2 auth did not grant Operator
  authority.
- `challenge_social_causes.approval_status` already governs
  `pending_approval`, `approved`, `revision_required`, and `removed`.
  `challenge_social_cause_decisions` stores each decision, authority member,
  reason, and timestamp. Existing material beneficiary/destination changes
  reset approval. Cause removal is limited to a revision-required Cause on an
  establishing Challenge by its creator.
- Migration 022's database trigger prevents `establishment -> active` while a
  Cause is pending or revision-required. Approval does not itself change the
  Challenge state. The existing `activateChallenge` transition succeeds once
  the Cause is approved and remains subject to other Challenge rules.
- At this assembly's starting HEAD, the repository had no scheduled Challenge
  start processor. Lifecycle Correction 001 adds the general start processor
  and connects it to the existing lifecycle CLI; see the assessment record
  `TIIZI-CHALLENGE-POST-APPROVAL-SCHEDULED-ACTIVATION-LIFECYCLE-001.md`.

## Bounded Operator authority

Migration 023 adds `platform_operator_cause_reviewers`, a narrow capability
roster for Social Cause review rather than a general Operator role system.
The API checks the authenticated canonical member against active roster rows;
revoked rows immediately fail authorization. No self-service grant route,
client role claim, Founder identity constant, Group role inference, or
Challenge-creator privilege grants approval.

The local preview provisioning script creates/reuses a distinct
`social-cause-operator@tiizi.local` identity only against loopback Auth and
loopback PostgreSQL, and records its grant reference. It refuses production
mode/non-loopback targets and creates no Group, Challenge, Cause, or
participant state. Production starts with no reviewer rows and therefore
fails closed until an independently governed operations process provisions
an authorized reviewer.

## Review experience and decisions

The existing Operator **Review & Attention** route now provides the focused
Social Cause queue. Only authorized reviewers can list or open Causes through
the API. The detail shows Challenge/group/schedule, title, description,
purpose, beneficiary, destination ownership/reference, current approval state,
and decision audit; it exposes no participant data. The Operator supplies a
reason and chooses **Approve Cause** or **Request revision**. The latter maps
to canonical `revision_required`; there is no separate `rejected` state.

Challenge creators are explicitly rejected as decision actors even if a
misconfigured roster includes them. Participants and Group stewards receive
403 unless independently granted the narrow review capability. Decisions are
recorded by the existing transaction/audit model. Neither decision creates
payment records nor initiates or verifies payments.

## Lifecycle boundary

An approved Cause satisfies the existing Cause-specific activation guard. A
revision-required Cause still blocks activation; creator correction returns it
to `pending_approval`, while removal follows the existing constrained route.
Cause approval itself never updates Challenge status. The general scheduled
start processor observes the removed gate on its next lifecycle pass and uses
the same `activateChallenge` transition as ordinary Challenges. The processor
respects the Challenge-local start date, Support Tiizi is not an activation
gate, and the database Cause guard remains authoritative.

The shared lifecycle CLI now has a `process-lifecycle` command for scheduled
starts plus the existing active-window expiry/end/finalization pass. No
scheduler is deployed: production invocation remains the S9 operational
boundary recorded by FD-S3-002.

## Local Development verification

Migration 023 is applied to the local Development database. The loopback-only
Development Operator opened the existing `Founder Preview — Cause Pending 001`
record, reviewed it in the Operator UI, approved it with a recorded reason,
and observed the decision in the audit. The participant Challenge detail then
showed “Cause approved, Challenge not active”; its status remained
`establishment`. No database-side approval was performed. Another existing
Development Cause remains in the pending queue for review.

## Contribution terminology and S8 boundary

Collective progress values now say **Your activity contribution** in Challenge
detail, finalized Challenge results, and hosted Challenge cards. This changes
copy only; the canonical Activity contribution engine is unchanged.

The temporary participant copy “Payment options are not available in this
preview yet.” must be removed or reconciled when S8 participant execution is
assembled. Amount selection, payment initiation, handoff, confirmation,
verification, retries, histories, reconciliation, and financial reporting
remain out of this task.
