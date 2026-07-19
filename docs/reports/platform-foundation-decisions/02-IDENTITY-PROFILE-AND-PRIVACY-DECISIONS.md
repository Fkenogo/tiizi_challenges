# Identity, Profile and Privacy Decisions

These decisions define expected visibility and lifecycle; they do not alter the currently inspected rules.

<a id="idp-01"></a>

## IDP-01 — Profile field classification and audience matrix

**Decision ID:** IDP-01
**Decision title:** Profile field classification and audience matrix
**Owning domain:** Identity/privacy/security
**Priority:** P0 (PD-001, PD-011; OQ-02)

**Why the decision is needed:** The founder must define who may see each profile field before rules and discovery behavior can be governed.

**Current repository evidence:** Profile screens store identity, birthday, body measurements, interests, goals and privacy flags in `users/{uid}`. Inspected rules allow authenticated reads of user documents.

**Current documented intent:** UI toggles imply that some data can be hidden; no authoritative field classification exists.

**Conflict or gap:** Anonymous, authenticated, group-member, group-admin and platform-admin visibility are undefined.

**Options:**

- A — Classify fields as public, authenticated-discoverable, shared-group, private, and privileged-operational; deny by default outside the assigned class.
- B — Make a minimal public profile plus shared-group profile; keep all health/body/contact fields private except explicit operational need.

**Recommended default:** Option B as the concrete policy shape, using A as the classification framework.

**Reason for recommendation:** It minimizes exposure while supporting group identity and discovery.

**Consequences of approval:** Security and privacy standards can define field-level read models.

**Consequences of deferral:** UI privacy promises may remain unenforced.

**Documents blocked by this decision:** Privacy and Profile Visibility Policy; Security and Permission Standard; Data Classification Standard.

**Implementation areas affected:** `users`, profile/search/group member UI, rules, analytics.

**Founder decision:** Approved — Option A classification framework with the Option B minimal-disclosure policy shape.

**Founder notes:**

Approved visibility classes are Public, Authenticated-discoverable, Shared-group, Private and Privileged-operational.

- Only minimal identity information may be discoverable.
- Health, body, contact, birth-date and private preference information must not be broadly readable.
- Group members see only information necessary for participation.
- Platform administrators access sensitive data only through defined operational authority.
- Access is deny-by-default outside the approved visibility class.

**Approval date:** 2026-07-18


---

<a id="idp-02"></a>

## IDP-02 — Privacy-toggle and consent semantics

**Decision ID:** IDP-02
**Decision title:** Privacy-toggle and consent semantics
**Owning domain:** Identity/privacy
**Priority:** P0 (PD-001)

**Why the decision is needed:** A toggle must have an enforceable meaning, and consent needs a traceable version.

**Current repository evidence:** Onboarding persists incremental profile fields and privacy flags, but no terms/privacy version acceptance record was traced.

**Current documented intent:** Current UI presents visibility choices; legal screens exist.

**Conflict or gap:** It is unclear whether toggles control display only or authorization, and whether onboarding acceptance is auditable.

**Options:**

- A — Toggles are authorization controls enforced at every read; store consent document/version/time/source.
- B — Remove or relabel any toggle that cannot enforce access, while still versioning consent.

**Recommended default:** A for governed fields; B as a temporary truth-in-UI rule when enforcement is not yet available.

**Reason for recommendation:** It avoids false privacy promises.

**Consequences of approval:** Onboarding, rules and policy acceptance gain one contract.

**Consequences of deferral:** Privacy expectations remain ambiguous and high-risk.

**Documents blocked by this decision:** Privacy Policy; Consent and Onboarding Standard; Security Test Matrix.

**Implementation areas affected:** Onboarding, profile edit, rules, user schema, legal screens.

**Founder decision:** Approved — recommended default.

**Founder notes:**

- Privacy toggles must control enforceable authorization and visibility.
- Any toggle that cannot be enforced must be removed or truthfully relabelled.
- Consent records must store consent version, terms/privacy version, acceptance time, source and user identity.
- Display-only controls must not imply technical privacy.

**Approval date:** 2026-07-18


---

<a id="idp-03"></a>

## IDP-03 — Account suspension, deactivation, deletion and retention

**Decision ID:** IDP-03
**Decision title:** Account suspension, deactivation, deletion and retention
**Owning domain:** Identity lifecycle/data retention
**Priority:** P1 (PD-008; OQ-14)

**Why the decision is needed:** Leaving the platform affects authored activity, group history, social content and support records.

**Current repository evidence:** Users are created active; admin suspension metadata exists. No complete user-driven deactivate/delete/anonymize flow was traced.

**Current documented intent:** No governing account lifecycle document was found.

**Conflict or gap:** Authentication deletion, profile removal, historical attribution, legal holds and retention periods are undecided.

**Options:**

- A — Separate reversible suspension/deactivation from irreversible deletion; deletion anonymizes historical contributions where group integrity requires retention.
- B — Hard-delete user and all related data, accepting historical challenge/feed damage.
- C — Retain identifiable records indefinitely; unsafe without explicit legal purpose and consent.

**Recommended default:** Option A, with retention periods decided by data class and jurisdiction.

**Reason for recommendation:** It preserves shared history while supporting privacy rights.

**Consequences of approval:** Account and retention standards can define state transitions.

**Consequences of deferral:** No safe implementation or support response is possible.

**Documents blocked by this decision:** Identity Lifecycle Standard; Data Retention and Deletion Policy; Moderation Operations Standard.

**Implementation areas affected:** Auth, users, memberships, logs, feed, comments, support data, media.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---

<a id="idp-04"></a>

## IDP-04 — Profile-media ownership and visibility

**Decision ID:** IDP-04
**Decision title:** Profile-media ownership and visibility
**Owning domain:** Identity/media/security
**Priority:** P1 (PD-012; OQ-19)

**Why the decision is needed:** Media needs explicit ownership, access and deletion rules.

**Current repository evidence:** Profile edit attempts `profile-photos` Storage upload, but inspected storage rules only govern group/challenge covers; UI can fall back to a data URL.

**Current documented intent:** The UI expects a persistent profile photo.

**Conflict or gap:** Storage path, public visibility, moderation, replacement and deletion are undefined.

**Options:**

- A — User-owned profile media with a governed Storage path, derivative/public-display policy and deletion lifecycle.
- B — External URL only, with validation and availability risk.
- C — Embedded data URLs in user documents; unsafe as a long-term default due to size and governance.

**Recommended default:** Option A.

**Reason for recommendation:** It matches user expectations and supports enforceable ownership/retention.

**Consequences of approval:** Media and privacy standards can be completed.

**Consequences of deferral:** Upload failures and oversized user records remain possible.

**Documents blocked by this decision:** Media and File Standard; Profile Privacy Standard; Account Deletion Procedure.

**Implementation areas affected:** Profile editor, Storage, user documents, moderation.

**Founder decision:** ☐ Approve recommended default  ☐ Select another option  ☐ Amend  ☐ Defer

**Founder notes:**

**Approval date:**


---
