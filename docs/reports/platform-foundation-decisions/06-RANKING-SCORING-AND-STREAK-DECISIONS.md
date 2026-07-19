# Ranking, Scoring and Streak Decisions

These decisions separate competition ranking from user rewards and define truthful streak behavior.

<a id="rsk-01"></a>

## RSK-01 — Authoritative ranking source and metric

**Decision ID:** RSK-01
**Decision title:** Authoritative ranking source and metric
**Owning domain:** Competition/data
**Priority:** P1 (PD-006; OQ-06)

**Why the decision is needed:** Every surface must show the same order and winner.

**Current repository evidence:** Challenge member documents and leaderboard projections are both read; home, detail, feed and recap paths do not consistently share one source.

**Current documented intent:** The V2 knowledge model requires exactly one authoritative ranking strategy and projection.

**Conflict or gap:** Source, metric and fallback behavior are not approved.

**Options:**

- A — A trusted, finalized leaderboard projection is authoritative; it records the policy metric, direction and revision. Other surfaces reference it.
- B — Each screen derives rank from participant documents independently.

**Recommended default:** Option A.

**Reason for recommendation:** It eliminates contradictory winners and supports auditability.

**Consequences of approval:** Ranking, recap and analytics can share one source.

**Consequences of deferral:** Participants may see different rankings.

**Documents blocked by this decision:** Competition and Ranking Standard; Entity Ownership Register; Recap Specification.

**Implementation areas affected:** Leaderboard projections, UI, feed, recaps, functions.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="rsk-02"></a>

## RSK-02 — Normalized values and approved non-reward terminology

**Decision ID:** RSK-02
**Decision title:** Normalized values and approved non-reward terminology
**Owning domain:** Ranking/terminology
**Priority:** P1/P2 (PD-023; OQ-09)

**Why the decision is needed:** Internal comparison values must not be confused with reward points.

**Current repository evidence:** Point-like normalized scoring fields and `scoringConfig` influence projections/tie behavior, but no XP/wallet/reward product exists.

**Current documented intent:** Founder confirmation says Tiizi does not use points; V2 knowledge model says remove hidden normalized points and points-based tie-breaking/order.

**Conflict or gap:** A replacement term and whether normalization is allowed at all are undecided.

**Options:**

- A — Use policy-specific `rankingValue` or `comparisonValue`; never call it points, XP or rewards. Permit normalization only when the approved policy proves comparability.
- B — Rank only raw values in identical units and remove normalization from launch.
- Unsafe — Expose hidden score as reward points without an approved rewards product.

**Recommended default:** Option A as the vocabulary, with Option B the default fairness rule unless a policy explicitly approves conversion.

**Reason for recommendation:** It preserves technical comparison when valid without inventing a rewards economy.

**Consequences of approval:** Terminology and competition logic become honest.

**Consequences of deferral:** Point-like residue may shape architecture or user copy.

**Documents blocked by this decision:** Product Terminology Standard; Competition Standard; Motivation Framework.

**Implementation areas affected:** Scoring helpers, fields, leaderboards, feed copy, analytics.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="rsk-03"></a>

## RSK-03 — Tie-breaking, fairness and ranking finalization

**Decision ID:** RSK-03
**Decision title:** Tie-breaking, fairness and ranking finalization
**Owning domain:** Competition
**Priority:** P1 (PD-006)

**Why the decision is needed:** A competitive result needs predictable eligibility, ties and finality.

**Current repository evidence:** Ranking sources and tie ordering differ; manual logs are not meaningfully verified.

**Current documented intent:** V2 compatibility documents require explicit ranking direction, strategy and verification policy.

**Conflict or gap:** Tie outcome, equal-unit enforcement, provisional ranks and dispute window are not approved.

**Options:**

- A — Policy declares metric/direction/eligibility; equal results are ties unless a declared evidence-based tie-break applies; finalize after the correction window.
- B — Always break ties by earliest completion or internal score, regardless of policy.

**Recommended default:** Option A.

**Reason for recommendation:** It avoids arbitrary advantage and makes fairness reviewable.

**Consequences of approval:** Competitive policies and recaps can be deterministic.

**Consequences of deferral:** Winner disputes remain likely.

**Documents blocked by this decision:** Competition Fairness Policy; Finalization Standard; Verification Standard.

**Implementation areas affected:** Policies, leaderboard computation, recaps, UI copy.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="rsk-04"></a>

## RSK-04 — Streak qualification, timezone, grace and corrections

**Decision ID:** RSK-04
**Decision title:** Streak qualification, timezone, grace and corrections
**Owning domain:** Streaks/time
**Priority:** P1 (OQ-07, OQ-08)

**Why the decision is needed:** A streak is meaningless without a day boundary and qualifying obligation.

**Current repository evidence:** Current logic advances on any qualifying log date; UI can imply all activities. No authoritative timezone or grace rule is governed.

**Current documented intent:** V2 model distinguishes consecutive streak from scheduled consistency, requires one challenge timezone and leaves grace policy open.

**Conflict or gap:** Any-one/all-activities, threshold, grace days and correction effects are undecided.

**Options:**

- A — Each streak policy defines required activities/threshold/cadence; challenge timezone fixes day boundaries; no grace by default; audited corrections recompute affected days.
- B — Any logged activity preserves every streak, using user-local time.
- C — Allow policy-defined grace tokens as a future feature, separate from launch default.

**Recommended default:** Option A, with C deferred until intentionally designed.

**Reason for recommendation:** It is explicit, fair and consistent with true consecutive behavior.

**Consequences of approval:** Streak UI, jobs, logging and completion can align.

**Consequences of deferral:** Users may lose or gain streaks unpredictably.

**Documents blocked by this decision:** Streak Behaviour Standard; Time and Timezone Standard; Correction Lifecycle.

**Implementation areas affected:** Challenge policy, logs, streak service, reminders, recaps.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---
