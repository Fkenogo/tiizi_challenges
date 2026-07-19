# Knowledge, Catalogue and Snapshot Decisions

Existing knowledge documents express strong future intent; these decisions determine what the platform will govern, not how migration is implemented.

<a id="knw-01"></a>

## KNW-01 — Authoritative runtime catalogue and local fallback purpose

**Decision ID:** KNW-01
**Decision title:** Authoritative runtime catalogue and local fallback purpose
**Owning domain:** Knowledge/data
**Priority:** P0/P1 (PD-004, PD-010, PD-020; OQ-11)

**Why the decision is needed:** Challenge creation must read one governed source while offline/development assets have explicit status.

**Current repository evidence:** Fitness runtime reads `catalogExercises` with no local fallback; wellness uses Firestore plus a local 67-record fallback; seed/static sources overlap.

**Current documented intent:** V2 knowledge model makes one governed Knowledge and Policy Layer authoritative.

**Conflict or gap:** The authoritative collection/API and permitted fallback environments are not approved.

**Options:**

- A — One governed runtime catalogue service is authoritative; local data is versioned development/bootstrap fixture only and never silently overrides production.
- B — Firestore and local files are equal runtime authorities with merge/fallback behavior.

**Recommended default:** Option A.

**Reason for recommendation:** It prevents environment-dependent challenge definitions.

**Consequences of approval:** Source-of-truth and seed standards can be finalized.

**Consequences of deferral:** Catalogue totals and behavior remain ambiguous.

**Documents blocked by this decision:** Entity Ownership Register; Knowledge Runtime Contract; Seed Safety Standard.

**Implementation areas affected:** Catalogue services, seeds, admin CRUD, wizard.

**Founder decision:** Approved — Option A.

**Founder notes:**

- Use one governed runtime catalogue authority.
- Local files may serve only as versioned development fixtures, test fixtures, controlled seed/bootstrap inputs or explicitly approved packaged fallback assets.
- Local files must never silently override or act as equal production authorities.
- Production fallback behavior must be explicit, observable and governed.

**Approval date:** 2026-07-18


---

<a id="knw-02"></a>

## KNW-02 — Catalogue/template versioning and launched snapshots

**Decision ID:** KNW-02
**Decision title:** Catalogue/template versioning and launched snapshots
**Owning domain:** Knowledge/challenges
**Priority:** P1 (PD-010; OQ-11)

**Why the decision is needed:** Historical challenges must retain the rules and content participants accepted.

**Current repository evidence:** Current challenges copy fields without catalogue/template versions; templates are mutable.

**Current documented intent:** Knowledge governance and V2 challenge documents require immutable, versioned launched snapshots.

**Conflict or gap:** Snapshot minimum, checksum/version identity and template reference rules are not approved platform decisions.

**Options:**

- A — Launch stores knowledge ID+version, policy/template ID+version and immutable evaluated rules/content needed to run/history; later edits do not flow into launched challenges.
- B — Launched challenges dynamically read the latest catalogue/template.

**Recommended default:** Option A.

**Reason for recommendation:** It preserves fairness, reproducibility and deprecation safety.

**Consequences of approval:** Versioning and migration requirements become concrete.

**Consequences of deferral:** Historical meaning can change silently.

**Documents blocked by this decision:** Snapshot, Provenance and Versioning Standard; Challenge Runtime Specification.

**Implementation areas affected:** Knowledge records, templates, launch callable, challenge schema, recap.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="knw-03"></a>

## KNW-03 — Knowledge deletion, deprecation and historical references

**Decision ID:** KNW-03
**Decision title:** Knowledge deletion, deprecation and historical references
**Owning domain:** Knowledge lifecycle
**Priority:** P1 (PD-010)

**Why the decision is needed:** Hard deletion can orphan challenges and remove governance history.

**Current repository evidence:** Admin catalogue services support hard delete; runtime has no knowledge lifecycle/version model.

**Current documented intent:** Knowledge governance documents define review, publication, deprecation and archive, preserving versions for historical challenges.

**Conflict or gap:** Emergency removal, public visibility and retention of deprecated versions are not operationally approved.

**Options:**

- A — Published knowledge is never hard-deleted in ordinary operations; deprecate/archive it, block new launches, preserve historical version access. Reserve audited tombstoning for legal/safety emergencies.
- B — Allow privileged hard deletion without reference checks.

**Recommended default:** Option A.

**Reason for recommendation:** It aligns with existing governance intent and historical integrity.

**Consequences of approval:** Lifecycle and admin standards can align.

**Consequences of deferral:** Admin actions can break history.

**Documents blocked by this decision:** Knowledge Lifecycle Implementation Mapping; Admin Knowledge Operations; Retention Policy.

**Implementation areas affected:** Admin CRUD, catalogue queries, challenge history, migration.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="knw-04"></a>

## KNW-04 — Interests, goals, taxonomy and Knowledge Asset relationship

**Decision ID:** KNW-04
**Decision title:** Interests, goals, taxonomy and Knowledge Asset relationship
**Owning domain:** Knowledge/personalisation
**Priority:** P1/P2 (PD-004, PD-020; OQ-12)

**Why the decision is needed:** Preferences should not be confused with canonical activities or hard-coded UI options.

**Current repository evidence:** Onboarding/edit screens hard-code exercise, wellness and goal options while admin collections also exist. Knowledge Assets specify richer governed objects than runtime activity records.

**Current documented intent:** V2 documents define unified taxonomy, Knowledge Assets and governed relationships.

**Conflict or gap:** Ownership of preference vocabularies and the runtime projection from Knowledge Asset to selectable activity are undecided.

**Options:**

- A — Govern interest/goal vocabularies separately from activity definitions; Knowledge Assets are authoritative rich knowledge, with versioned runtime projections for selection/logging.
- B — Treat free-form interests, catalogue activities and goals as one list.
- C — Allow custom user text as private preference metadata, never as an automatic canonical item.

**Recommended default:** Options A and C together.

**Reason for recommendation:** They preserve controlled discovery while allowing personal expression.

**Consequences of approval:** Onboarding, taxonomy, recommendations and catalogue ownership become separable.

**Consequences of deferral:** IDs/names and recommendation inputs continue to drift.

**Documents blocked by this decision:** Interest and Goal Standard; Cross-Domain Taxonomy; Knowledge Runtime Projection Contract.

**Implementation areas affected:** Onboarding, profile, admin content, search/recommendations, knowledge service.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---
