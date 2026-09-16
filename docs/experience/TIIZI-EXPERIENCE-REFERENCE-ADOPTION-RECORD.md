# Tiizi Experience Reference — Adoption Record

**Document type:** Product Experience Architecture adoption record

**Work package:** TIIZI-EA-01 — Experience Reference Adoption & Product-Truth Reconciliation

**Status:** COMPLETE / FOUNDER APPROVED FOR MERGE — Founder disposition ADOPT
(EA-01-CORR-001, 2026-09-16)

**Date:** 2026-09-16

**Authority:** Founder direction. This record is a bounded product-experience
adoption act. It does **not** establish constitutional doctrine, amend Product
Truth, or authorise implementation.

---

## 1. Founder disposition

**Founder disposition: ADOPT.**

The Founder has formally decided to **ADOPT** the Tiizi Experience Reference as
Tiizi's primary **Product Experience Architecture** reference.

**Adopted Experience Reference repository:** `Fkenogo/tiizi-prototye`

**Adopted reference commit:** `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6`
(branch `main`, verified as the current `origin/main` head at adoption time)

**Entry point of the adopted reference:**
`docs/TIIZI-EXPERIENCE-REFERENCE.md` (+ `src/**` implementation surfaces,
`src/data/assumptionsData.ts`, and the in-app Assumptions Register) at the
adopted commit.

## 2. Core formula

```text
PRODUCT TRUTH
+
ADOPTED EXPERIENCE REFERENCE
=
TIIZI PRODUCT ASSEMBLY
```

The governing implementation principle is:

> **Product Truth determines what Tiizi does.**
> **The adopted Experience Reference determines how that truth is assembled into
> a coherent human-facing product.**

Implementation must fit Tiizi Product Truth **into** the adopted Experience
Reference — not fit the adopted Experience Reference into V1, and not fit the
adopted Experience Reference into incidental programme wording.

The formula is expressed in full in
[`TIIZI-EXPERIENCE-INTEGRATION-MAP.md`](TIIZI-EXPERIENCE-INTEGRATION-MAP.md).

### 2.1 Implementation consequence — a new V2 shell

```text
NEW V2 SHELL
≠
V1 SHELL MODIFIED TO LOOK LIKE THE PROTOTYPE
```

The new V2 shell is **assembled from the adopted Experience Reference** and
**bound to existing Tiizi Product Truth**.

- The adopted Experience Reference is the basis of a **completely new V2
  experience shell**.
- V1 is **not** the V2 shell, **not** the V2 experience host, **not** a V2
  compatibility target, and **not** an authority for V2 navigation, hierarchy,
  journeys or composition.
- V1 experience components must not enter V2 merely because they already exist.
  Any proposed V1 experience reuse requires explicit classification and review
  before reuse (see the reuse classification in
  [`TIIZI-EXPERIENCE-INTEGRATION-MAP.md`](TIIZI-EXPERIENCE-INTEGRATION-MAP.md) §10).
- Old V1 routes/code may remain physically present temporarily only while
  replacement coverage is built. Their physical presence creates **no
  compatibility obligation**, and their physical retirement/deletion timing is
  an **implementation sequencing matter** — not an open Founder decision.

**May legitimately carry forward where appropriate** (and does not make the V2
shell a derivative of the V1 shell): approved Tiizi brand identity/assets;
logo/icon/favicon/app icons; brand colours; typography where appropriate;
neutral reusable technical primitives; shared infrastructure; governed
Product Truth / domain capabilities.

## 3. What is adopted

The adopted Experience Reference governs **human-facing assembly only**:

- the member application shell and navigation hierarchy;
- the operator console shell and section architecture;
- screen composition and information hierarchy;
- journey assembly across discovery, creation, participation and management;
- interaction patterns and presentation model;
- the member/operator vocabulary decisions recorded in the reference
  (for example Together / Race / Streak, "Today's activities", friendly
  time display);
- the reference's Assumptions Register as the register of experience
  hypotheses, open Founder decisions and out-of-scope items.

## 4. What is NOT adopted

The Experience Reference is an **experience assembly authority, not a domain or
product-truth authority**. It does **not**:

- establish domain authority, permissions, roles or RBAC;
- define lifecycle, finalization, scoring, ranking or result truth;
- define Challenge, Knowledge, Metric, Unit, Group or Membership semantics;
- define Member eligibility, Challenge participation rules or capacity rules;
- define Recognition qualification, issuance or withdrawal (MOT-01 preserved);
- define donation, Support Tiizi or Community Cause authority or custody;
- convert any prototype mock behaviour into Product Truth.

Where the reference's own document self-describes as
`CANDIDATE / NOT YET ADOPTED`, that status line is **superseded by this
Adoption Record**. The adopted reference source is not modified by this record
(see §7).

## 5. Precedence established by this adoption

The adoption sits inside the authority model recorded in
[`TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md`](TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md)
Part A. In summary:

1. Constitutional / enduring Product Truth
2. Entity & operational Product Truth
3. Product / technical contracts (Stage F)
4. Engine / domain authority (PF-01→PF-04, engines, finalization, Group &
   Membership authority, Knowledge contracts)
5. **Adopted Product Experience Architecture (this record)**
6. Programme sequencing / status
7. Existing implementation
8. V1 reference material

Determinations:

- **V1 UI and V1 implementation must not override the adopted Experience
  Reference.** V1 is frozen reference-only (layer 8).
- **Existing implementation must not override the adopted Experience
  Reference.** Implementation is evidence, not truth (layer 7).
- **Programme sequencing/status wording must be amended where it would block
  the adopted Experience Reference**, unless the wording records substantive
  Product Truth (layer 1–3).
- **Explicit Product Truth overrides the Experience Reference.** The reference
  is adapted, or — where no material safety/integrity/privacy/scope reason
  applies — the documentation is amended (Part A §A.4 of the reconciliation).
- **Where Product Truth is silent, the adopted Experience Reference supplies
  the experience decision**, recorded as an experience decision, not as
  Product Truth.

## 6. Adoption effects

**Effect established by this record**

- The adopted Experience Reference becomes the reference for V2 experience
  assembly.
- V1 product experience is **FROZEN — REFERENCE ONLY** and must not determine
  V2 navigation, shell, journeys, information architecture or interaction
  composition. V1 **cannot host V2**.
- The V2 experience is a **completely new shell** assembled from the adopted
  Experience Reference and bound to existing Tiizi Product Truth.
- Existing documentation and existing V1 implementation do **not** determine
  V2 experience composition.
- Further V2 experience implementation must be preceded by the bounded
  transition TIIZI-EA-01.
- **EA-01 is COMPLETE / FOUNDER APPROVED FOR MERGE** (EA-01-CORR-001). The next
  authorised implementation work is **S1 — V2 Experience Foundation**, which
  creates the new shell from the adopted Experience Reference (see
  [`TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md`](TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md) §D.4).

**Effect not established by this record**

- No implementation is authorised by EA-01 itself beyond recording S1 as the
  next slice; S1 is not implemented here.
- No UI is implemented or merged.
- PF-05 is not merged and its experience assembly remains **NOT APPROVED**.
- PF-06 is not begun.
- PF-01 → PF-04 are not reopened.
- No engine semantics are changed.
- No deployment, migration or production-data change is authorised.
- No constitutional or Stage F Product Truth is amended.

## 7. Cross-repository constraint and evidence

Cross-repository access was available and used. The adopted commit
`cfa696fb…` was verified by `git rev-parse origin/main` in `Fkenogo/tiizi-prototye`
after `git fetch`. No prototype source was reconstructed from memory, and **no
prototype source is copied into the Tiizi product repository by this work
package**.

The adopted reference's own status text (`CANDIDATE / NOT YET ADOPTED`) is
retained unchanged in the prototype repository. Correcting that line in the
prototype is out of scope for EA-01 and is **not** performed (no silent change
to the Experience Reference). This Adoption Record is the governing adoption
act; wherever the prototype self-description conflicts, this record prevails.

## 8. Compatibility note — existing unmerged material

`docs/architecture/TIIZI-V1-PRODUCT-EXPERIENCE-FREEZE.md` exists **only** on the
unmerged branch `impl/pf-05-v2-challenge-creation-wizard-001` (head `59adcf2`).
It states the Experience Reference is `IN DEVELOPMENT / NOT YET ADOPTED`. That
statement is now superseded by this Adoption Record. The freeze document was
**not** merged by EA-01 and is not current authority on `main`.

The V1-freeze **principle** it carries is adopted here as part of EA-01: V1
product experience is frozen as reference-only. Amending the freeze document
itself belongs to the PF-05 disposition work (Part E of the reconciliation) and
must not be performed by merging PF-05 wholesale.

## 9. Non-effects

This record:

- implements no UI;
- copies no prototype source into Tiizi;
- merges no PF-05 work;
- begins no PF-06 work;
- deploys nothing;
- modifies no production data;
- reopens no PF-01 → PF-04 work;
- changes no engine semantics;
- makes V1 no compatibility requirement;
- creates no Product Truth from prototype mock behaviour.
