# Support, Donation, Analytics, Administration and Operations Decisions

These choices distinguish product truth from operational estimates and financial settlement claims.

<a id="sup-01"></a>

## SUP-01 — Support/payment status vocabulary and reporting truth

**Decision ID:** SUP-01
**Decision title:** Support/payment status vocabulary and reporting truth
**Owning domain:** Support/donations
**Priority:** P1 (PD-013; OQ-10)

**Why the decision is needed:** Intent and self-report must not be presented as settled payment.

**Current repository evidence:** Support records use intent → sent_reported → verified, plus abandoned/rejected/refunded/cancelled and legacy confirmed/pending_confirmation. No gateway/webhook exists.

**Current documented intent:** Working-tree reports describe “honest status” distinctions; no approved policy exists.

**Conflict or gap:** Who may verify and what “verified” proves are undecided.

**Options:**

- A — Canonical states: intent_recorded, user_reported_sent, administratively_verified, externally_settled, abandoned, rejected, refunded, cancelled. Reports label each explicitly.
- B — Treat user confirmation or legacy `confirmed` as payment success.
- Unsafe — Report intent totals as received revenue.

**Recommended default:** Option A; do not use externally_settled until an independent provider confirms it.

**Reason for recommendation:** It prevents financial misstatement.

**Consequences of approval:** UI, reports and lifecycle standards can use truthful terms.

**Consequences of deferral:** Founder/admin reporting may conflate intention and funds.

**Documents blocked by this decision:** Support and Donation Policy; Analytics Dictionary; Admin Operations Standard.

**Implementation areas affected:** Donation services/screens, summaries, reports, legacy mapping.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="sup-02"></a>

## SUP-02 — Currencies, access, retention, rejection and refund semantics

**Decision ID:** SUP-02
**Decision title:** Currencies, access, retention, rejection and refund semantics
**Owning domain:** Support/data/security
**Priority:** P1 (PD-013; OQ-14)

**Why the decision is needed:** Financial-adjacent records require controlled access and unambiguous values.

**Current repository evidence:** Services handle KES defaults and mixed legacy fields; support/admin roles read records; refund/reject fields are client-admin actions.

**Current documented intent:** No currency, retention or evidence policy was found.

**Conflict or gap:** Minor units, exchange policy, evidence retention, access scopes and whether refund means externally completed are unresolved.

**Options:**

- A — Store amount in declared currency/minor unit; never convert without governed rate; restrict identifiable access to support/finance authority; `refund_requested` and `refund_settled` are distinct.
- B — Normalize all amounts into one display currency without preserving source amount.

**Recommended default:** Option A.

**Reason for recommendation:** It preserves accounting truth and least-privilege access.

**Consequences of approval:** Data/security/reporting specifications can proceed.

**Consequences of deferral:** Totals and refund claims remain ambiguous.

**Documents blocked by this decision:** Donation Data Standard; Admin Permission Standard; Retention Policy.

**Implementation areas affected:** Schemas, reports, settings, rules, admin actions.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="anl-01"></a>

## ANL-01 — Product KPIs, operational estimates and projection freshness

**Decision ID:** ANL-01
**Decision title:** Product KPIs, operational estimates and projection freshness
**Owning domain:** Analytics
**Priority:** P1/P2 (PD-015, PD-018; OQ-17)

**Why the decision is needed:** Founder decisions require metrics with known definitions and freshness.

**Current repository evidence:** Analytics combine direct queries, user metrics and scheduled/function projections. Freshness and deployment health are not verified.

**Current documented intent:** No measurement plan or canonical metric dictionary exists.

**Conflict or gap:** KPI definitions, source, update SLA, correction and “estimated” labeling are undecided.

**Options:**

- A — Approve a small KPI set with formula, source, owner, freshness SLA and revision policy; label all other dashboard values operational estimates.
- B — Treat every displayed aggregate as an authoritative KPI.

**Recommended default:** Option A.

**Reason for recommendation:** It enables trustworthy reporting without overclaiming current projections.

**Consequences of approval:** Analytics and operations documentation can align.

**Consequences of deferral:** Dashboards may drive decisions using stale/incomparable values.

**Documents blocked by this decision:** Product Analytics Measurement Plan; Metric Dictionary; Projection Operations Standard.

**Implementation areas affected:** Admin/profile analytics, functions, dashboards, reporting.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="adm-01"></a>

## ADM-01 — Admin roles, trusted commands and auditability

**Decision ID:** ADM-01
**Decision title:** Admin roles, trusted commands and auditability
**Owning domain:** Administration/security
**Priority:** P0/P1 (PD-003, PD-004, PD-009, PD-014)

**Why the decision is needed:** High-impact actions need consistent authorization, validation and provenance.

**Current repository evidence:** Admin roles exist in `admins` and `users.role`; many privileged mutations originate in browser services; system/group audit logs are partial.

**Current documented intent:** No admin constitution or backend command policy exists.

**Conflict or gap:** Role separation, two-person controls, backend-only actions and audit retention are undecided.

**Options:**

- A — Canonical platform roles with least privilege; sensitive state transitions execute through trusted backend commands and immutable audit records; UI gating is never authorization.
- B — Continue browser-admin writes for every action using rules alone.

**Recommended default:** Option A, with a decision matrix identifying which actions may remain direct.

**Reason for recommendation:** It addresses duplicated roles and privileged-client risk.

**Consequences of approval:** Security, admin and audit standards can be finalized.

**Consequences of deferral:** Authorization and accountability remain fragmented.

**Documents blocked by this decision:** Roles and Permissions Standard; Admin Operating Standard; Audit Logging Standard.

**Implementation areas affected:** AdminRoute/services, rules, callables, role stores, system logs.

**Founder decision:** Approved — Option A.

**Founder notes:**

- Use one canonical platform role model and least privilege.
- UI gating is not authorization.
- High-impact state transitions use trusted backend commands.
- Sensitive actions create immutable audit records.
- Direct browser writes may remain only where a documented permission and risk matrix explicitly approves them.

**Approval date:** 2026-07-18


---

<a id="ops-01"></a>

## OPS-01 — Production ownership, deployment, retries, reconciliation and incidents

**Decision ID:** OPS-01
**Decision title:** Production ownership, deployment, retries, reconciliation and incidents
**Owning domain:** Platform operations
**Priority:** P1 (PD-015; OQ-01, OQ-16)

**Why the decision is needed:** Async projections and scheduled expiry need an accountable operator and recovery guarantees.

**Current repository evidence:** Functions define schedules/triggers; local rules/config were dirty at audit time; deployed state, alerts and retry behavior were not inspected. Mockup routes remain in the route graph.

**Current documented intent:** No production runbook or environment governance standard exists.

**Conflict or gap:** Environment ownership, deployment approval, retry/rebuild, incident severity and prototype exposure are undecided.

**Options:**

- A — Name production owner; require environment/deployment inventory, approval and audit; define idempotent retry/reconciliation and incident runbooks; explicitly exclude or approve prototype routes per environment.
- B — Treat deployment and projection recovery as ad hoc engineering tasks.

**Recommended default:** Option A.

**Reason for recommendation:** Repository correctness cannot guarantee production correctness without operations governance.

**Consequences of approval:** Read-only production verification and runbooks can be commissioned.

**Consequences of deferral:** Stale state or unsafe release exposure may go undetected.

**Documents blocked by this decision:** Deployment and Environment Standard; Operations Runbook; Incident Response; Release Surface Standard.

**Implementation areas affected:** Firebase projects, CI/deploy scripts, functions, monitoring, routes.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---
