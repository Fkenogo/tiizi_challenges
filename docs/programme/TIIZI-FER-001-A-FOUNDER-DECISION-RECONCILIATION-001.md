# TIIZI-FER-001-A — Founder Decision Reconciliation 001

**Status:** PROPOSED AMENDMENT — for Technical Lead and Founder review. **Not effective until the Founder approves and this document is merged.** Documentation only. No implementation, migration, media or payment configuration, deployment or pilot launch is authorized by this document.
**Date:** 2026-10-28. **Source baseline:** `origin/main` `542052c12ca7910a297da89f28ae01120b220980`; Master Programme v2.80 (re-verified this pass). PR #107 open/unmerged at `9e5477b008b2d5f0f759acf5770de9486f66e6e6` (see deliverable C).
**Principal reference:** [`TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md`](../reports/TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md) (Founder accepted; filed unchanged with this PR so references resolve).
**Companions:** [B — Implementation Plan](TIIZI-FER-001-B-EXPERIENCE-RECOVERY-IMPLEMENTATION-PLAN-001.md); [C — Current Work Reconciliation](TIIZI-FER-001-C-CURRENT-WORK-RECONCILIATION.md).

## 1. Nature and limits

This is the proposed single bounded Founder disposition the baseline (§A, §D, §E Gate 0) asks for. It records latest Founder decisions and changes **only** the older positions that genuinely conflict. It creates no new governance framework, constitutional instrument or competing roadmap. The Master Programme remains the sole authority for sequence and status; the one programme row this amendment needs is listed in §7 and is not applied here.

Everything not named in §3 is **unchanged**, including: V1 frozen/reference-only; `/v2/*` shell, `/api/*`, PostgreSQL domain authority, Firebase Auth identity only; the Group/Challenge/Today/Streak/Race/Together engines; the Log Activity sheet; Product Truth for scoring and results; the Group Feed (GF-01…04); the Disposition's account-lifecycle, stewardship, BG-1 and legal/data-protection obligations (§§10–11, 16.9–16.11).

## 2. How conflicts were found

Each baseline decision was traced against the Member Completion Founder Disposition 001 (incl. §16 FD-PILOT-01), CF-01 v0.2, the Media Capability Assessment 001, the Challenge Contribution Recon 001, Master Programme v2.80 and the code at `542052c`. Only items where the older text would **block or contradict** the baseline are listed as conflicts. Wording differences, UI polish and implementation gaps are **not** authority conflicts and are handled in deliverable B.

## 3. Reconciliation register

Legend — **Supersedes**: the older position is replaced as stated. **Narrows**: the older position stays but is limited. **Restores**: a deferral under FD-PILOT-01 is lifted, subject to §4.

### FDR-01 — Optional, independently skippable Interests and Goals *(Supersedes FD-MC-04a; amends FD-MC-04)*

| Older position | Latest Founder decision |
|---|---|
| FD-MC-04: Interests/Goals are **required** onboarding inputs. FD-MC-04a: **no skip**; Interests min 1 / max 5; Goals min 1 / max 3; returning-member completion gate (Disposition §4 items 2–3). | **Interests 0–5 and Goals 0–3.** Each step **independently skippable**. Both **editable and clearable at any time in Profile**. Benefits of choosing are explained as better recommendations, **never as eligibility**. |

Decisions that **stay in force** (not touched): FD-MC-04b (shared starting vocabularies: 12 Focus Area concepts → Member Interests; 9 Group Goal concepts → Member Goals, entities stay distinct); FD-MC-04c/04d/04e (recommendation is relevance only, creates no access, eligibility, membership, participation or scoring effect); §5.3 stable IDs required before any Member Interest persistence; §5.4 custom-text rule; §5.5 Challenge relevance.
Consequential rules: (a) the **returning-member completion gate no longer checks Interests/Goals** (it still checks display name where missing, the 18+ self-declaration (§16.5) and Terms/Privacy acknowledgement); (b) no member is ever blocked, hidden from browsing or restricted because preferences are absent or unmatched; (c) no health, body, birth or contact fields are added to account creation.
Code fact (verified): the "mandatory" rule exists **only in documents**; no V2 code enforces it and no member Interests/Goals storage exists. Focus Areas currently have **no stable IDs** (labels only); the 9 Goals do. Minting the 12 Interest IDs remains a prerequisite (§5.3).

### FDR-02 — Interests/Goals onboarding and REC-1 restored to scope *(Restores; amends FD-PILOT-01 §16.4 rows 4–5)*

FD-PILOT-01 deferred Interests/Goals onboarding and REC-1 to Wider Public Launch. The baseline (§D.1) states the Founder-approved experience includes them. They are **restored to scope for sequencing** (milestone gating per Q1) in the experience-recovery sequence, **in the minimal form** the baseline describes: preference-ranked ordering **inside the already-authorized discoverable set** with general browsing always available. REC-1 is **not** broadened into a heavier recommender. See open decision **Q1** for whether they are gating for the Limited Kenya Pilot or for Wider Public Launch.

### FDR-03 — Optional Profile, Group and Challenge images *(Restores, as optional; amends FD-PILOT-01 §16.2–§16.3 and §16.4 row 8; confirms FD-MC-07a)*

| Older position | Latest Founder decision |
|---|---|
| FD-MC-07: media pre-pilot. FD-PILOT-01 row 8: media **deferred**; §16.3: pilot uses "gradients and initials rather than user-uploaded images". | **Optional** Profile image (onboarding step or Profile), **optional** Group cover, **optional** Challenge cover. Curated gradients / initials remain the **default and fallback**; no member is required to upload. |

In force and unchanged: FD-MC-07a (Cloudflare R2 behind a provider-neutral ObjectStore port; **provider direction, not proof of live upload**); §8.3 visibility and mutation baseline; §8.5 scope-based ownership; §8.6 Challenge-cover mutation authority; MV-206 as external guidance only; MEDIA-1 decision record still required (upload mode, limits, variants, takedown, budget owner). Verified: **no V2 media code, table, route, bucket or credentials exist**; `cover_id` allowlists (`cover-1..8`, `challenge-1..8`) and initials remain the working fallback. Delivery of media stays **not authorized for live use**; R2 account/credentials/non-production environment require separate authorization. Sequencing is reconciled once: media is delivered as a shared capability (deliverable B, P6), not three one-off uploaders, and is **optional** to every journey so no other package waits on it.

### FDR-04 — Support Tiizi manual mobile-money journey *(Narrows FD-PILOT-01 §16.3/§16.8 by distinction; Contribution Recon 001 unchanged)*

The conflict is smaller than it first appears and is resolved by **distinction, not exception**:

- FD-PILOT-01 §16.8 disables **"Support a Cause" / "Support Tiizi" configuration on pilot Challenges** and payment-destination collection. That rule is **unchanged**.
- The baseline adds a **separate, permanent Profile-level Support Tiizi journey**. It is not a Challenge setting, not a Cause, and creates no payment-destination reference on any Challenge. It is distinct from Challenge-level "Support a Cause" and from future gateway payments.
- Displaying a recipient number is not "payment-destination collection" under §16.8 (nothing is collected or stored on any Challenge).
- FD-PILOT-01 §16.3 "no live payment-processing facility" is **not breached**: the Tiizi application processes nothing (the Founder/operator, not the app, receives any transfer). A member pays outside the app by their own mobile money; Tiizi never charges, pledges, subscribes, receives, confirms or reconciles in-app.

Decisions recorded: suggested **KES 500 / 1,000 / 2,000 / 5,000 / Custom**; non-binding frequency intention **just once / occasionally (whenever able) / monthly / annually** (not persisted initially; **not** a recurring subscription); Tiizi remains free and participation/results never depend on contributing; no totals, progress meters, receipts or claims of payment/funds received.
**Development rule:** explicit **non-payable placeholders** for recipient number, account-holder name and WhatsApp contact; **no realistic invented numbers; no active copy, payment or WhatsApp actions**. **Activation rule:** the real recipient number, registered holder name (Founder/operator, disclosed as collecting on behalf of Tiizi) and support WhatsApp contact must be Founder-verified, and funds-handling/reconciliation and applicable legal/privacy approval recorded, before any actionable payment method exists. **Authority gap to close before P8b:** Contribution Recon 001 (§§8–9) leaves Support/donation authority (SUP-01/02) unallocated, "REQUIRES FOUNDER DECISION at S8 time", and classes the Profile Support CTA as S8 scope; T1 §V.6 / FR-V2-162 require a Tiizi-controlled destination, whereas this journey names the Founder/operator as recipient; FR-V2-151/152 require voluntary, non-subscription, restrained treatment. The Founder must record the SUP-01/02 allocation and confirm a Founder/operator-held recipient satisfies T1 §V.6. P8a is a placeholder-only Profile CTA and does not activate payment. Paystack remains a **future candidate only** (not selected, connected or promised); amount-selection UX is reusable; frequency selection never implies a gateway subscription. Contribution/payment **execution (S8) stays not implemented**.

### FDR-05 — Challenge Feed restored; explicit Share and external share separated *(Restores; amends FD-PILOT-01 §16.4 row 9)*

FD-PILOT-01 deferred Challenge Feed, Kudos, Share and announcements to Wider Public Launch. The baseline restates them. **Restored to scope for sequencing** (milestone gating per Q1; FD-PILOT-01 §16.4 row 9 and the last sentence of §16.7), with **CF-01 v0.2 as the unchanged contract**: separate Challenge Feed (not the Group Feed; no cross-reads); automatic moments A1–A6; explicit, previewed, self-only, withdrawable Share (S1–S3); one Kudos type; Steward/authorized announcements; **no comments or replies**; no free-text member posts; Feed content never alters Challenge truth. Logging never auto-shares an individual activity.
**External/system sharing** (native device share, Copy Link) is **a separate proposed experience**. CF-01 §6.4/§12 place external share in "Later". It is **not authorized** here and is **not** the internal Share. It needs its own Founder disposition on exact visibility/preview rules before coding (**Q4**).
CF-01 open details still gate CF-2 and CF-5 (**Q3**): Streak milestone schedule; whether system cards are Kudos-able; when a Challenge creator counts as an authorized distinct announcement author; announcement length bound.

### FDR-06 — Disposable preview fixtures are not Product Truth *(Clarification; no conflict with any decision)*

Baseline §D.5: inconsistent seeded Challenge titles/units and the "2 Activities" preview are **fixture defects**, corrected in the disposable environment. Verified cause: migration 014 seeds exactly two exemplar Activities; the 118 (84 Fitness / 34 Wellness) exist only after the manual S6 import **and** publication. Canonical Activity definitions, PF contracts and the 118 baseline are **not modified**. No preview artifact implies production deployment.

## 4. Open Founder decisions (needed before the affected package is authorized)

The right-hand column is a **proposed recommendation, not a default**: nothing is approved by silence (baseline §A). An unanswered question leaves the affected package unauthorized.

| ID | Decision | Why it is genuinely the Founder's | Proposed recommendation (not effective unless the Founder confirms) |
|---|---|---|---|
| **Q1** | Are Interests/Goals onboarding, REC-1, media, Challenge Feed/Kudos/Share/announcements gating for the **Limited Kenya Pilot**, or for **Wider Public Launch**? (Baseline D.1/D.2/D.4 asks to reconcile with "the Founder-approved pilot experience".) | FD-PILOT-01 §16.1 reserves milestone definition to the Founder. | No default: affected packages (P1b, P2, P6, P7) stay unauthorized until answered; FD-PILOT-01 launch gates unchanged; no launch claim. |
| **Q2** | **Original creator** on Group Details. No creator column exists; `groups.steward_member_id` is the only owner reference and no steward-transfer mutation exists yet (STEW-1 pending). Show steward only, label it as such, until a creator field is approved? Or approve one minimal nullable field (needs migration, R2)? | Baseline forbids fabricating values and redundant fields. | Show Establishment date, member count, Steward; **omit creator** until Q2 answered. |
| **Q3** | CF-01 detail: Streak milestone schedule; Kudos on system cards; announcement authority and length. | CF-01 §11 reserves them to Founder. | Feed ships without S2 Streak share, system cards not Kudos-able, announcements by Accountable Steward only. |
| **Q4** | External share (native/Copy Link): whether, when, and exact preview/visibility rules. | CF-01 lists it "Later". | Not built. |
| **Q5** | Support Tiizi activation facts **and the SUP-01/02 / T1 §V.6 authority allocation (FDR-04)**: verified Kenyan recipient number, registered holder name, WhatsApp support contact, reconciliation/accounting handling, legal/privacy sign-off. | Real-world operational facts only the Founder holds. | Placeholder screen only; no actionable method. |
| **Q6** | Welcome placement: slides **before registration** (baseline B.1) require a new **public** route; the current V2 shell serves only sign-in/sign-up publicly. Confirm that a public welcome route is intended. | Changes the unauthenticated surface. | No default: P1a stays unauthorized until answered; recommended design is pure static content with no data calls. |
| **Q7** | Culture step: the exact approved "what we avoid" choices and the bounded creator-defined expectation length. | Member-facing norms wording is product copy with moderation implications; no sanctions are automatic. | Culture step ships with the six existing positive norms only. |

## 5. Items deliberately **not** treated as conflicts

- Renaming "Focus Areas" → "Group Interests" in member copy: **wording only**; `focus_tags`, `goal_ids`, governed IDs and custom handling stay (baseline B.3). The Group Goals / Member Goals distinction is preserved.
- "Repetitions" → "reps" in member UI: label only; canonical unit `reps` unchanged.
- The Activity Guide return-path bug, roster refresh gap and Group Details content: implementation defects/gaps, not authority matters.
- Showing member display names in Group/Challenge contexts: **already authorized** (FD-MC-03; FD-PILOT-01 §16.6 minimum MC-4); implementation is missing, not the authority.
- Challenge wizard step 3 copy distinguishing **Support a Cause** from **Support Tiizi** (baseline B.4): wording only; FD-PILOT-01 §16.8 unchanged; no Challenge-level Support Tiizi payment destination is added; neither implies live payment execution.
- Legal Terms/Privacy publication and 18+/acknowledgement: **unchanged**; MC-2C remains conditional; nothing here approves legal text.

## 6. What this amendment does **not** do

Does not authorize code, migrations, media/payment configuration, deployment, production access, public onboarding or pilot launch; does not merge PR #107 or PR #94; does not delete legacy code; does not change any engine, canonical Activity definition, scoring or result rule; does not waive any legal or data-protection obligation.

## 7. Programme recording (proposed; not applied in this PR)

On Founder approval, one change-log row in the Master Programme: *"Founder Experience Recovery Baseline 001 reconciled (TIIZI-FER-001); FDR-01…FDR-06 recorded; implementation plan B proposed; no implementation, migration, deployment or launch authorized."* The version number is assigned at merge: PR #107 also proposes **2.81**, so whichever lands second takes the next number. Disposition §§4/16.4 receive a one-line pointer to this document rather than rewritten text.

**Disposition:** PROPOSED. STOP for Technical Lead and Founder review. No merge, code go or deployment go is implied.
