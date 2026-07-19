# Challenge Product and Lifecycle Decisions

These choices govern launched group challenges without defining implementation architecture.

<a id="chl-01"></a>

## CHL-01 — Primary challenge types, ownership and authority

**Decision ID:** CHL-01
**Decision title:** Primary challenge types, ownership and authority
**Owning domain:** Challenges/groups
**Priority:** P1 (PD-008; OQ-18)

**Why the decision is needed:** Challenge types and accountable actors determine creation, editing and moderation.

**Current repository evidence:** Collective, competitive and streak are active; challenges are group-scoped. Creator and group-role checks coexist.

**Current documented intent:** V2 knowledge documents retain those three policy types and group scope.

**Conflict or gap:** Creator ownership versus group-administrator stewardship is not fully defined.

**Options:**

- A — Three launch types; group owns the challenge, creator is initiating steward, group owner/admin has lifecycle authority, platform admin has audited moderation authority.
- B — Creator personally owns the challenge even after group-role changes.

**Recommended default:** Option A.

**Reason for recommendation:** It matches group-first direction and avoids orphaning challenges.

**Consequences of approval:** Authority and permissions can be standardized.

**Consequences of deferral:** Creator/group-admin conflicts remain.

**Documents blocked by this decision:** Challenge Behaviour Specification; Group Authorization Standard.

**Implementation areas affected:** Wizard, challenge docs, edit/admin routes, rules.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="chl-02"></a>

## CHL-02 — Canonical challenge state machine

**Decision ID:** CHL-02
**Decision title:** Canonical challenge state machine
**Owning domain:** Challenge lifecycle
**Priority:** P1 (PD-008)

**Why the decision is needed:** Pause, cancel, archive and recovery need explicit states and allowed transitions.

**Current repository evidence:** Types expose draft/active/completed/expired; no complete pause/cancel/archive flow exists.

**Current documented intent:** Knowledge documents require finalization and immutable launched rules but do not govern all operational states.

**Conflict or gap:** Meaning and transitions for paused, cancelled and archived are not approved.

**Options:**

- A — Govern draft → active → completed/expired/cancelled → archived, with paused as reversible active interruption and explicit transition authority.
- B — Keep only current four states and treat other concepts as metadata.

**Recommended default:** Option A, subject to exact pause and cancellation effects.

**Reason for recommendation:** It names real operational needs without conflating them.

**Consequences of approval:** Lifecycle, UI, jobs and analytics can share one vocabulary.

**Consequences of deferral:** Status handling remains screen/service-specific.

**Documents blocked by this decision:** Challenge Lifecycle Standard; Analytics Dictionary; Operations Runbook.

**Implementation areas affected:** Types, services, scheduled expiry, screens, projections.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="chl-03"></a>

## CHL-03 — Editing after launch and historical immutability

**Decision ID:** CHL-03
**Decision title:** Editing after launch and historical immutability
**Owning domain:** Challenges/versioning
**Priority:** P1 (PD-010)

**Why the decision is needed:** Participants need stable rules and historical records.

**Current repository evidence:** Current challenges snapshot activity fields but lack version provenance; admin/creator updates can mutate documents.

**Current documented intent:** V2 knowledge model says core policy, metric, unit, ranking and completion rules become immutable at launch.

**Conflict or gap:** Which descriptive/operational fields remain editable is not frozen.

**Options:**

- A — After launch, core rules/snapshots are immutable; allow audited changes to presentation, moderation and operational state only.
- B — Allow rule edits with participant notice and recalculation.
- Unsafe — Silent rule edits after participation begins.

**Recommended default:** Option A.

**Reason for recommendation:** It protects fairness and historical auditability.

**Consequences of approval:** Snapshot and edit standards can be completed.

**Consequences of deferral:** Challenges can diverge from participant expectations.

**Documents blocked by this decision:** Snapshot/Versioning Standard; Challenge Editing Policy; Migration Plan.

**Implementation areas affected:** Challenge schema, templates, edit UI, audit logs.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="chl-04"></a>

## CHL-04 — Withdrawal, late activity, early completion and reopening

**Decision ID:** CHL-04
**Decision title:** Withdrawal, late activity, early completion and reopening
**Owning domain:** Challenge lifecycle/activity
**Priority:** P1 (PD-005, PD-007; OQ-08)

**Why the decision is needed:** Edge cases change totals, winners, streaks and recaps.

**Current repository evidence:** Members can become abandoned; scheduled expiry exists; final-log projection races and correction gaps were identified.

**Current documented intent:** V2 documents call for server validation, finalization and explicit late-submission policy.

**Conflict or gap:** Contribution retention, grace windows, premature completion and correction/reopen authority are undecided.

**Options:**

- A — Define per-policy late window; retain attributed historical contributions after withdrawal; finalization locks results; audited correction creates a new revision without rewriting history.
- B — Remove all withdrawn-member contributions and permit silent reopening.
- C — Reject all late/corrected events after completion, even for proven errors.

**Recommended default:** Option A, with founder-approved time windows per challenge policy.

**Reason for recommendation:** It preserves shared history while allowing controlled correction.

**Consequences of approval:** Completion, recap and dispute behavior becomes explicit.

**Consequences of deferral:** Winner and progress integrity remains ambiguous.

**Documents blocked by this decision:** Challenge Finalization Standard; Activity Correction Standard; Ranking Standard.

**Implementation areas affected:** Members, logs, jobs, summaries, leaderboards, recaps, feed.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---
