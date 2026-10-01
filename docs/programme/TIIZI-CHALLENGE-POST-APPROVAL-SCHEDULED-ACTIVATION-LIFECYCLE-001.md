# Challenge Post-Approval & Scheduled Activation Lifecycle Assessment/Correction 001

Status: **Candidate for Founder review; Challenge Founder Experience Review 001 remains OPEN**
Starting candidate: `32b61f4815997dd4aa9f84f5ea37fed44064b398`
Branch: `impl/tiizi-challenge-founder-experience-review-001`

## Finding: the gap was general, not Cause-specific

The canonical Challenge state is persisted as `establishment`, `active`, or
`ended`. `activateChallenge` is the shared domain transition. At the starting
candidate it wrote `active` without checking the Challenge-local start date.
Creation ordinarily persisted `establishment`; the HTTP route also forced
Cause-enabled Challenges to establishment. Migration 022's Cause trigger
blocked a direct `establishment -> active` update until Cause approval, but
neither that trigger nor the domain transition advanced Challenges when their
start date arrived.

No participant read path performs lifecycle reconciliation, and there was no
request-time worker or scheduled-start process. Ordinary future Challenges
could therefore remain in establishment indefinitely. The same missing
scheduled invocation meant a past-end active Challenge could remain persisted
as active until `processExpiredChallenges` was explicitly invoked. Activity
acceptance still checks Challenge-local date windows, so persisted status could
lag the window and show an active Challenge whose ordinary logging was already
out of window.

## Canonical date and lifecycle rules

- A Challenge's `start_date` and `end_date` are calendar dates interpreted in
  its governed IANA `timezone`; legacy null timezone reads as UTC.
- The start boundary is the beginning of the Challenge-local `start_date`.
  `establishment -> active` is not permitted before that boundary.
- The end window includes the Challenge-local `end_date`; expiry is when the
  Challenge-local day is greater than `end_date`.
- Creation for today or a past start date remains in establishment unless the
  existing creation request explicitly asks for activation. That request now
  passes the same schedule check. Future-start creation remains establishing.
- A future Challenge becomes due through the general scheduled-start pass.
  The pass uses `activateChallenge`, the same domain transition used by
  creation and other established paths.
- Pending or revision-required Cause blocks activation through the existing
  database guard. Approved or removed Cause satisfies that Cause-specific
  condition. Approval only changes Cause state; it does not change Challenge
  state. The next general lifecycle pass may activate it if its start date has
  arrived.
- Support Tiizi is not an activation gate. A Challenge without a Cause and a
  Support Tiizi-only Challenge follow the same schedule rule.
- Cause removal retains the existing constrained semantics: it is available
  only to its creator while revision is required and the Challenge is still
  establishing; a removed Cause no longer blocks ordinary activation.

## Shared lifecycle processing

`processScheduledChallengeStarts(db, now)` processes all establishing
Challenges, compares `start_date` against the Challenge-local day, and invokes
`activateChallenge` only when due. It reports a Cause-gated Challenge without
preventing other due Challenges from progressing. `activateChallenge` itself
also rejects an early transition, so creation and the scheduled pass use the
same boundary check. Migration 022 remains the database-level Cause gate; no
Cause-specific activation shortcut was added.

The lifecycle CLI now provides `process-lifecycle`, which processes due starts
then runs the existing `processExpiredChallenges` end/finalization pass.
`process-expired` remains a compatibility alias to the combined lifecycle
command; `process-scheduled` is available for local start-only verification.
No HTTP read, participant action, frontend timer, or new infrastructure
provider was introduced.

## End boundary and finalization

The end mechanism already existed as `processExpiredChallenges` and the
`process-expired` CLI seam. It selects active Challenges whose local day is
past `end_date`, then calls `finalizeChallenge`, which atomically moves an
expired active Challenge to `ended` and freezes terminal results. The
Challenge Activity application can also end a Collective when its shared Goal
is crossed. Finalization remains separate derived truth (`ended` plus
`finalized_at`) and can be invoked directly for an already-ended Challenge.

There is still no scheduler deployment. Under the approved FD-S3-002 boundary,
the production schedule that repeatedly invokes the lifecycle CLI remains an
S9 operational assembly. Until that invocation is configured, both due starts
and expired active windows can remain unprocessed in a running Development or
production database; participants do not trigger reconciliation by opening a
page. Development verification can invoke the CLI explicitly.

For the local Founder preview, migrations 022 (cover/support configuration)
and 023 (Platform Operator Cause-review authority) are applied. The shared
`process-scheduled` command was run against the Development database: seven
due ordinary establishment Challenges became active, a due pending-Cause
Challenge remained in establishment with the Cause gate reported, and an
approved Cause Challenge scheduled for the next Bujumbura calendar day
remained in establishment. An active Support Tiizi-only Challenge remains on
the ordinary lifecycle path. No Cause record was approved or altered outside
the Operator API.

## Development Operator credential hygiene

The committed local bootstrap fixes only the non-production email identity
`social-cause-operator@tiizi.local`. It sources the password exclusively from
`TIIZI_SOCIAL_CAUSE_OPERATOR_PASSWORD`, never prints it, refuses
`NODE_ENV=production`, and checks that both Auth and PostgreSQL targets are
loopback. No password literal, production credential, or reusable password
default is committed. Production authorization remains fail-closed when the
explicit Cause-review roster has no active grant.

## Verification scenarios

The scheduled lifecycle tests cover an ordinary future Challenge staying in
establishment before the local start boundary and activating at the boundary;
pending and revision-required Causes remaining blocked after start; approved
Cause staying scheduled before start and activating on a due pass; and a
Support Tiizi-only Challenge using the ordinary path. The Operator approval
suite exercises approval through the authorized API before and after schedule
eligibility. Existing EBC-04 tests cover active in-window, expired active,
ended, finalized, and non-reopenable behavior.

The Founder preview retains pending and approved Cause examples, an active
Support Tiizi example, and active ordinary examples. There is no separate
ordinary future-start example in the current Development dataset; future-start
behavior is covered by deterministic lifecycle tests, while the approved
Cause example demonstrates the shared future schedule gate.

No contribution/payment behavior is included. S8 remains sequenced after this
general lifecycle correction. Production scheduler deployment remains S9.
