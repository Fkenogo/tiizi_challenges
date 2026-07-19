# Platform Identity and Version 2 Scope Decisions

Approved direction: Tiizi is a group-first challenge and motivation platform. Fitness and wellness are initial domains, not the permanent boundary.

<a id="plt-01"></a>

## PLT-01 — Authoritative product description

**Decision ID:** PLT-01
**Decision title:** Authoritative product description
**Owning domain:** Platform constitution
**Priority:** P1 (PD-016)

**Why the decision is needed:** Every later standard needs one stable statement of what Tiizi is and is not.

**Current repository evidence:** The discovery audit traces identity → group → challenge → activity → progress/feed/social. Fitness terminology remains embedded, but the product surface includes groups, social, administration, support and knowledge.

**Current documented intent:** The approved direction supplied for this pack defines Tiizi as a group-first challenge and motivation platform for meaningful goals pursued together through measurable activities, encouragement and shared progress.

**Conflict or gap:** No existing platform constitution makes this direction authoritative; knowledge documents govern only a subset.

**Options:**

- A — Approve the supplied product description as the constitutional one-line definition.
- B — Approve it with founder amendments that preserve group-first, measurable activity and shared motivation.
- Unsafe — Define Tiizi primarily as a fitness catalogue or workout tracker; this conflicts with approved direction and observed platform scope.

**Recommended default:** Option A.

**Reason for recommendation:** It exactly preserves the approved direction and matches the strongest observed runtime spine.

**Consequences of approval:** The Platform Constitution and terminology work can use one product identity.

**Consequences of deferral:** Domain documents may continue to make inconsistent assumptions about scope.

**Documents blocked by this decision:** Tiizi Platform Constitution; Product Domain and Terminology Standard; Target Platform Architecture.

**Implementation areas affected:** Navigation, onboarding copy, domain naming, challenge/knowledge boundaries.

**Founder decision:** Approved — Option A.

**Founder notes:**

Approved constitutional description:

> Tiizi is a group-first challenge and motivation platform that helps people pursue meaningful goals together through measurable activities, mutual encouragement and shared progress.

**Approval date:** 2026-07-18


---

<a id="plt-02"></a>

## PLT-02 — Meaning of group-first and launch boundary

**Decision ID:** PLT-02
**Decision title:** Meaning of group-first and launch boundary
**Owning domain:** Platform/product
**Priority:** P1 (PD-016)

**Why the decision is needed:** “Group-first” must govern product priority without implying that every screen or datum is group-public.

**Current repository evidence:** All active challenge types are group-scoped; group membership gates creation/logging. Profiles, libraries, settings and support are personal surfaces.

**Current documented intent:** The V2 knowledge model states that the initial release remains group-scoped; the supplied direction calls group challenges the primary product mode.

**Conflict or gap:** There is no approved definition separating primary group mode from supporting individual account functions.

**Options:**

- A — Group-first means challenges are launched into governed groups; personal features support participation but are not a separate challenge mode.
- B — Group-first means groups are preferred, while launch also includes first-class individual challenges.

**Recommended default:** Option A for V2 launch.

**Reason for recommendation:** It preserves current behavior and the approved direction without preventing a later individual mode.

**Consequences of approval:** Launch scope is clear; personal features remain legitimate supporting capabilities.

**Consequences of deferral:** Challenge architecture may accidentally add or imply an unsupported individual mode.

**Documents blocked by this decision:** Platform Constitution; Challenge Product Behaviour Specification; Launch Scope Statement.

**Implementation areas affected:** Challenge wizard, routes, templates, permissions, analytics.

**Founder decision:** Approved — Option A with founder emphasis.

**Founder notes:**

- Group challenges are the primary product model for Version 2.
- Personal profiles, preferences, analytics, settings and related features support group participation.
- Supporting personal features do not constitute an individual-challenge product mode.
- Architecture and documentation must prioritize group participation, group accountability and shared progress.

**Approval date:** 2026-07-18


---

<a id="plt-03"></a>

## PLT-03 — Initial domains and future extensibility

**Decision ID:** PLT-03
**Decision title:** Initial domains and future extensibility
**Owning domain:** Platform/knowledge
**Priority:** P1 (PD-010, PD-025)

**Why the decision is needed:** The foundation must not overclaim future domains or hard-code fitness as the platform boundary.

**Current repository evidence:** Runtime implements fitness and wellness catalogues/logs; no other governed activity domain is active. Current event and metric models are fitness/wellness-shaped.

**Current documented intent:** The supplied direction makes fitness and wellness initial domains. V2 knowledge documents specify unified fitness/wellness knowledge and extensible policies.

**Conflict or gap:** The first-release domain list and minimum platform-neutral contracts are not constitutionally frozen.

**Options:**

- A — Launch V2 with fitness and wellness only; require platform-neutral identity, activity-event, metric and challenge-policy interfaces for later governed domains.
- B — Add named additional launch domains now, each requiring evidence, policy, metrics, safety and content governance before inclusion.

**Recommended default:** Option A unless the founder names and funds another launch domain.

**Reason for recommendation:** It supports extensibility without pretending unimplemented domains exist.

**Consequences of approval:** Scope and acceptance criteria become testable.

**Consequences of deferral:** The model may become either fitness-bound or over-generalized.

**Documents blocked by this decision:** Platform Constitution; Unified Knowledge Standard; V2 Launch Plan.

**Implementation areas affected:** Knowledge entities, activity events, metrics, wizard taxonomy.

**Founder decision:** Approved — Option A with clarification.

**Founder notes:**

- Version 2 launch domains are Fitness and Wellness.
- Wellness may include governed hydration, recovery, mindfulness, sleep, mobility, healthy routines and general wellbeing without making each a separate top-level launch domain.
- Platform contracts must remain domain-neutral enough to support future governed domains.
- No unimplemented future domain may be represented as an active launch capability.

**Approval date:** 2026-07-18


---

<a id="plt-04"></a>

## PLT-04 — Position of individual challenges

**Decision ID:** PLT-04
**Decision title:** Position of individual challenges
**Owning domain:** Challenge scope
**Priority:** P1 (OQ-18)

**Why the decision is needed:** Documents and UI must not imply a runtime type that does not exist.

**Current repository evidence:** Active types are collective, competitive and streak, all group-scoped. No first-class individual challenge runtime path was traced.

**Current documented intent:** The V2 knowledge model explicitly excludes a separate individual type from initial release.

**Conflict or gap:** Future conceptual support is not classified as excluded, deferred or approved.

**Options:**

- A — Excluded from V2 launch and deferred as a future capability; do not model it as an active type.
- B — Support conceptually in constitutional language only, with no launch promise or runtime requirements.
- C — Add as launch scope, which requires a separate product and lifecycle decision set.

**Recommended default:** Option A, while recording future-domain compatibility as a non-launch consideration.

**Reason for recommendation:** It is honest about current implementation and the existing V2 non-goal.

**Consequences of approval:** Type matrices and wizard scope remain unambiguous.

**Consequences of deferral:** “Individual” may continue to appear inconsistently in documentation.

**Documents blocked by this decision:** Challenge Type Standard; Launch Scope; Challenge Compatibility Matrix.

**Implementation areas affected:** Types, wizard, templates, permissions, analytics.

**Founder decision:** Approved — Option A with explicit founder emphasis.

**Founder notes:**

- Individual challenges are excluded from Version 2 launch.
- Individual challenges are not an active runtime type or promised product capability.
- They may be recorded only as a possible future governed capability.
- Future consideration requires a separate product, lifecycle, permissions, analytics and implementation decision process.
- Current Version 2 architecture must not be distorted to support an unapproved individual mode.

**Approval date:** 2026-07-18


---
