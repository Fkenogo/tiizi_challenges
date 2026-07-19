# Activity, Progress and Correction Decisions

The core choice is whether activity is a governed platform event or separate fitness/wellness write paths.

<a id="act-01"></a>

## ACT-01 — Canonical cross-domain activity event

**Decision ID:** ACT-01
**Decision title:** Canonical cross-domain activity event
**Owning domain:** Activity/data
**Priority:** P0 (PD-002, PD-004, PD-025)

**Why the decision is needed:** A platform-neutral event is required for future domains and consistent validation.

**Current repository evidence:** Fitness writes `workouts`; wellness writes `wellnessLogs`; both update challenge state through related but distinct services.

**Current documented intent:** V2 knowledge model specifies validated activity events and separates knowledge/policy from runtime.

**Conflict or gap:** No approved platform event identity, provenance and domain extension contract exists.

**Options:**

- A — One canonical activity-event contract with domain-specific payload extensions and a referenced knowledge definition/policy.
- B — Keep separate fitness and wellness event entities and coordinate them through adapters.

**Recommended default:** Option A for V2 governance; migration may retain legacy physical collections behind compatibility mapping.

**Reason for recommendation:** It supports group-first measurable activities beyond exercise without erasing domain detail.

**Consequences of approval:** Data ownership, logging and analytics standards can align.

**Consequences of deferral:** Each new domain may create another incompatible engine.

**Documents blocked by this decision:** Platform Data Standard; Activity Event Standard; Metric/Unit Standard.

**Implementation areas affected:** Logging services, event schema, functions, analytics, feed.

**Founder decision:** Approved — Option A.

**Founder notes:**

- Use one canonical platform activity-event contract.
- Fitness and Wellness may use domain-specific payload extensions.
- Legacy `workouts` and `wellnessLogs` may remain temporarily through explicit compatibility or migration mappings.
- The canonical contract must support identity, participant, group/challenge context, knowledge definition/version, metric, unit, event time, submission time, provenance, verification state, correction relationship and idempotency.
- This approval establishes governing requirements, not an implementation schema.

**Approval date:** 2026-07-18


---

<a id="act-02"></a>

## ACT-02 — Ownership of raw events and derived totals

**Decision ID:** ACT-02
**Decision title:** Ownership of raw events and derived totals
**Owning domain:** Data integrity/security
**Priority:** P0 (PD-002, PD-003, PD-004)

**Why the decision is needed:** Only one authority should validate facts and calculate progress.

**Current repository evidence:** Clients create logs and can influence member/challenge fields; transactions and triggers both derive totals; UI reads several projections.

**Current documented intent:** V2 knowledge model says clients must not write participant aggregates, completion, totals, leaderboard, recap, verified or ranking values.

**Conflict or gap:** The authoritative writer/read projection is not approved platform policy.

**Options:**

- A — Participant owns submission intent; trusted backend owns accepted event, derived totals, completion, ranking and projections.
- B — Client owns raw events and aggregates subject to rules validation.
- Unsafe — Multiple equal aggregate authorities without reconciliation.

**Recommended default:** Option A.

**Reason for recommendation:** It directly addresses P0 integrity and is consistent with documented V2 intent.

**Consequences of approval:** Security, data and backend trust standards can be finalized.

**Consequences of deferral:** Forged or divergent progress remains possible.

**Documents blocked by this decision:** Entity Ownership Register; Security Standard; Progress Calculation Standard.

**Implementation areas affected:** Rules, callables, event ingestion, projections, UI reads.

**Founder decision:** Approved — Option A.

**Founder notes:**

> The participant owns the submission intent. A trusted backend owns acceptance, authoritative activity events, progress, completion, rankings and projections.

The client must not author authoritative challenge totals, participant aggregates, completion status, leaderboard rank, recap results, verification status or derived analytics.

**Approval date:** 2026-07-18


---

<a id="act-03"></a>

## ACT-03 — Idempotency, duplicate handling, correction and deletion

**Decision ID:** ACT-03
**Decision title:** Idempotency, duplicate handling, correction and deletion
**Owning domain:** Activity integrity
**Priority:** P1 (PD-005, PD-007; OQ-08)

**Why the decision is needed:** Retries and mistakes must not permanently distort shared results.

**Current repository evidence:** Create-trigger projections lack complete update/delete reconciliation; duplicate-log behavior is not governed.

**Current documented intent:** V2 model calls for idempotency and server validation.

**Conflict or gap:** Keys, correction mechanism, deletion authority and cascade semantics are undecided.

**Options:**

- A — Require idempotency key; accepted events are immutable; corrections append reversal/replacement records; projections rebuild or reconcile deterministically.
- B — Permit in-place event edits/deletes and recalculate every dependent projection.
- C — Disallow all correction; operationally unsafe for genuine mistakes.

**Recommended default:** Option A.

**Reason for recommendation:** It preserves audit history and enables deterministic recovery.

**Consequences of approval:** Feed/ranking/streak/recap correction rules can be specified.

**Consequences of deferral:** Duplicate and stale projection risk remains.

**Documents blocked by this decision:** Activity Correction Lifecycle; Audit Standard; Async Integrity Test Plan.

**Implementation areas affected:** Logs, ingestion, triggers, projections, admin correction tooling.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="act-04"></a>

## ACT-04 — Verification states, audit trail and downstream effects

**Decision ID:** ACT-04
**Decision title:** Verification states, audit trail and downstream effects
**Owning domain:** Activity verification
**Priority:** P1 (PD-007)

**Why the decision is needed:** Verification cannot be a dead boolean or silently change results.

**Current repository evidence:** `verified` defaults false; no end-to-end actor makes it true or changes progress/ranking. Manual/device/admin modes are not active.

**Current documented intent:** V2 model anticipates verification but does not require it for initial launch.

**Conflict or gap:** State vocabulary, actor, evidence and effect are undecided.

**Options:**

- A — Launch with explicit `not_required`, `self_reported`, `pending_review`, `verified`, `rejected`, `revoked`; policies decide whether pending events count provisionally.
- B — Omit verification from launch runtime until a real verification workflow exists, preserving future capability in knowledge policy only.

**Recommended default:** Option B for general launch, with A approved as the future lifecycle vocabulary if competitive policies need review.

**Reason for recommendation:** It avoids pretending current manual logs are verified.

**Consequences of approval:** UI and reports can use truthful language.

**Consequences of deferral:** Dead metadata may keep implying trust it does not provide.

**Documents blocked by this decision:** Verification Standard; Competition Fairness Policy; Activity Audit Standard.

**Implementation areas affected:** Event schema, logging UI, ranking, admin review, device integrations.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---
