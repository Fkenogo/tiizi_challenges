# TIIZI-FER-001-A — Founder Decision Reconciliation 001

**Status:** PROPOSED AMENDMENT, **as corrected by TIIZI-FER-001 PR #108 Correction 001** (Founder direction, 28 October 2026: *Complete Experience, Controlled Pilot*) — for Technical Lead review. **Not effective until merged.** Documentation only. No implementation, migration, media or payment configuration, deployment or pilot launch is authorized by this document.
**Date:** 2026-10-28. **Source baseline:** `origin/main` `542052c12ca7910a297da89f28ae01120b220980`; Master Programme v2.80. PR #107 open/unmerged at `9e5477b008b2d5f0f759acf5770de9486f66e6e6` (see C).
**Principal reference:** [`TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md`](../reports/TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md) (Founder accepted; filed **unchanged**).
**Companions:** [B — Implementation Plan](TIIZI-FER-001-B-EXPERIENCE-RECOVERY-IMPLEMENTATION-PLAN-001.md); [C — Current Work Reconciliation](TIIZI-FER-001-C-CURRENT-WORK-RECONCILIATION.md).

## 1. Nature and limits

This is the proposed single bounded Founder disposition the baseline (§A, §D, §E Gate 0) asks for. It records the latest Founder decisions and changes **only** older positions that genuinely conflict. It creates no new governance framework, constitutional instrument or competing roadmap. The Master Programme remains the sole authority for sequence and status; the one programme row this amendment needs is in §8 and is not applied here.

Unchanged unless §3–§4 say otherwise: V1 frozen/reference-only; `/v2/*`, `/api/*`, PostgreSQL domain authority, Firebase Auth identity only; the Group/Challenge/Today/Streak/Race/Together engines; the Log Activity sheet; Product Truth for scoring and results; the Group Feed (GF-01…04); the Disposition's account-lifecycle, stewardship, BG-1 and legal/data-protection obligations (§§10–11, 16.9–16.11). Historical Founder decisions are **not deleted or rewritten**; they are superseded only as recorded here.

## 2. How conflicts were found

Each baseline decision was traced against the Member Completion Founder Disposition 001 (incl. §16 FD-PILOT-01), CF-01 v0.2, Media Capability Assessment 001, Contribution Recon 001, Master Programme v2.80 and the code at `542052c`. Only items where older text would **block or contradict** the Founder direction are listed. Wording, polish and implementation gaps are handled in B.

## 3. Binding scope direction — FDR-00: Complete Experience, Controlled Pilot

**Authority:** explicit Founder decision, 28 October 2026 (Correction 001). **This is a binding product-scope direction, not a proposal awaiting another decision.**

> Tiizi V2 must deliver the **complete Founder-approved product experience before pilot acceptance**. The pilot limits the **number of users**, not the experience, features or functionality available to them. The Limited-Pilot-versus-Wider-Public-Launch distinction must not be used to defer essential product capabilities.

### 3.1 Milestone definitions (replace the FD-PILOT-01 §16.2 milestone meanings for sequencing)

| Milestone | Meaning |
|---|---|
| **Complete Product Experience (CPE)** | Functional acceptance by the Founder of the **full agreed V2 product** (the 11 capabilities in §3.2), on the intended V2 experience, page by page, with recorded evidence. |
| **Controlled Pilot** | The Complete Product Experience exposed to a **limited, approved user population** (invitation-only, adults 18+, Founder-approved cap). Limits users — never features. Requires CPE acceptance **plus** the operational entry conditions in §3.4. |
| **Wider Launch** | Expansion of access, capacity and operations **after pilot evidence and a separate Founder authorization**. It must **not** be the milestone where missing core functionality is first introduced. |

### 3.2 Required for CPE acceptance (the Complete Product Experience gate)

1. Four-slide **public** welcome, shown **before** registration, and complete onboarding.
2. **Optional, independently skippable** Interests (0–5) and Goals (0–3).
3. Profile editing/clearing of preferences and **preference-based recommendations** (relevance only).
4. Complete Group and Challenge **discovery and participation** (incl. Challenge→host-Group join→Challenge return).
5. The **118-Activity development catalogue** (84 Fitness / 34 Wellness) available through the intended V2 experience.
6. **Optional** Profile image, Group cover and Challenge cover uploads (gradients/initials remain fallback).
7. **Full Profile experience** and **authorized member identities** (display names in authorized Group/Challenge contexts).
8. **Challenge Feed**, internal explicit Share, Kudos and approved announcements — exact CF-01 v0.2 contract (§5, FDR-05).
9. **Complete Today, Streak and activity-logging** journeys.
10. **Functional Support Tiizi interim manual mobile-money journey** (complete in development with non-payable placeholders; see §3.5 for activation).
11. **Account, Privacy and Help** capabilities as agreed in the recovery baseline (no unimplemented capability promised).

**Scope discipline:** nothing outside the baseline and existing Founder decisions is added. Full-experience scope is **not** permission for a single large rewrite; delivery stays incremental, package by package, each independently reviewed (B).

### 3.3 FD-PILOT-01 reconciled (bounded superseding disposition)

The earlier **feature-deferral interpretation** of FD-PILOT-01 is corrected. FD-PILOT-01 is **no longer authority to deliver a reduced product experience** to pilot users. Its feature deferrals are **superseded for sequencing**: items it moved to "required before Wider Public Launch" become **required for CPE acceptance** (§3.2). The decisions themselves (FD-MC-04b–e, FD-MC-07a, §8, CF-01, etc.) remain as written, except FDR-01 (optional Interests/Goals).

**Retained, not weakened:** the invitation-only/18+/cap pilot population rules; reduced-gate consent items (display name where missing; 18+ self-declaration; versioned Terms and Privacy acknowledgement; separate processing consent where applicable — §16.5 items 1–4); minimum MC-4 identity rules (§16.6); LIFE-1 pilot minimum and interim stewardship model with its sufficiency test (§16.9); operational launch gates — cap, mailbox owner/cadence, background-processing owner/runbook, stop mechanism, hosting/privacy/legal arrangements (§16.10); legal and data-protection obligations (§16.11); migration/deployment restrictions and the migration 025 CHECK-gap condition for Group Feed production deployment (§16.7(1)–(2), §16.12), including the verified Group Feed publication-processing arrangement (BG-1 form, §16.10); no in-app payment processing (§16.3, row 13) and the Challenge-level Support a Cause/Support Tiizi rule (§16.8). All safety, privacy and domain invariants remain effective.

**Precise references requiring programme alignment** (this PR edits none of them; the Technical Lead aligns them in the Gate 0 programme step):

| # | Reference | Alignment needed |
|---|---|---|
| 1 | Disposition §16.1 items 1–2, 5 | "amends pilot sequencing only" and "moves to required before Wider Public Launch" are superseded for the listed items by FDR-00. |
| 2 | Disposition §16.2 rows "Limited Kenya Pilot", "Wider Public Launch" | Replace with the three §3.1 definitions; drop "existing capabilities only" and "gradients and initials only (no user-uploaded images)". |
| 3 | Disposition §16.3 bullets 2 and 5 | "existing … capabilities" and "gradients and initials rather than user-uploaded images" superseded. Bullet on "no live payment-processing facility" **retained** as "no in-app payment processing". |
| 4 | Disposition §16.4 rows 2 (profile image initials-only), 3 ("reduced"), 4, 5, 8, 9 and the closing sentence on deferred "enhanced community engagement and recognition" | Rows 4, 5, 8, 9: now **required for CPE** (their "Wider Public Launch: Required before Wider Public Launch" column is superseded). Row 2 initials-only limit lifted (initials stay the fallback). Row 3 consent items unchanged; the Interests/Goals omission is superseded by FDR-01. The closing sentence is superseded **only** for the §3.2 items; recognition issuance and other unlisted engagement features stay unapproved/deferred. Rows 1, 6, 7, 10–15 unchanged. |
| 5 | Disposition §16.5 "Not part of the pilot gate: Interests…" | Superseded by FDR-01 (optional, skippable, in CPE), not a gate item. |
| 6 | Disposition §16.7 closing sentence ("Challenge-specific Feed … remain out of the pilot") | Superseded: in CPE (FDR-05). |
| 7 | Disposition §16.12 sequence | Insert **CPE acceptance** before "pilot readiness verification → Founder pilot-launch authorization". |
| 8 | Disposition §16 heading "(addendum)", its status line ("EFFECTIVE UPON MERGE of PR #104") and §16.13 | Add pointer to this document. |
| 8a | Disposition §16.5 heading/lead-in ("Reduced MC-3 pilot gate", "For the Limited Kenya Pilot only"), and "Limited Kenya Pilot" wording in §16.8 and §16.9 | Retained as the **Controlled Pilot entry** gate/rules; rename the milestone only. |
| 9 | Master Programme v2.80 change-log row (and any status text restating "Deferred to Wider Public Launch") | Align wording; the row text is historical and is not rewritten. |
| 10 | PR #107 Disposition §17 and Master Programme 2.81 row | Contradict this direction (five slides, post-sign-in, "FD-PILOT-01 unchanged", Interests/Goals "not authorized"); to be dropped, see C. |
| 11 | Unchanged but noted: §16.8; CF-01 tiers ("Required before pilot"); Disposition §13 pre-pilot lines | Already consistent with CPE. |

### 3.4 Controlled Pilot entry conditions (beyond CPE; unchanged FD-PILOT-01 operational gates)

CPE accepted by the Founder; approved legal presentation and recorded acknowledgement (MC-2C/§16.5); §16.9–§16.10 arrangements verified; migrations/deployment separately authorized; **P8b activation of the verified manual mobile-money Support Tiizi journey (§3.5; required — P8a placeholders suffice only for CPE page acceptance)**; explicit Founder pilot-launch authorization. **CI-green or package-complete never equals pilot-ready.**

### 3.5 Separately agreed exceptions preserved

- **Paystack** is a future gateway candidate only; the **manual mobile-money journey** is the initial supported experience.
- **Dummy recipient information** is permitted only in development and **must not enable payment actions**.
- **Actual mobile-money activation** requires Founder verification of recipient, account holder, contact and operating arrangements. CPE accepts the *functional journey with development placeholders*; **P8b activation is required before Controlled Pilot entry** (Gate 0 clarification); it does not authorize payment configuration or activation.
- **General member comments/replies** remain outside the approved initial Challenge Feed.
- **External social sharing** remains subject to the separate visibility/scope decision (Q4); it is not the internal Share and is not in CPE.

## 4. Reconciliation register

Legend — **Supersedes**: the older position is replaced as stated. **Restores**: a deferral is lifted and the item is **required for CPE**. **Narrows**: older position stays but is limited.

### FDR-01 — Optional, independently skippable Interests and Goals *(Supersedes FD-MC-04a; amends FD-MC-04)*

| Older position | Latest Founder decision |
|---|---|
| FD-MC-04: required onboarding inputs. FD-MC-04a: **no skip**; Interests min 1 / max 5; Goals min 1 / max 3; returning-member completion gate (Disposition §4 items 2–3). | **Interests 0–5 and Goals 0–3.** Each step **independently skippable**; both **editable and clearable at any time in Profile**. Benefits are explained as better recommendations, **never as eligibility**. |

Stays in force: FD-MC-04b (12 Focus Area concepts → Member Interests; 9 Group Goal concepts → Member Goals; entities stay distinct); FD-MC-04c/04d/04e (relevance only; no access, eligibility, membership, participation or scoring effect); §5.3 stable IDs before any Member Interest persistence; §5.4; §5.5.
Consequences: (a) the returning-member gate no longer checks Interests/Goals (still display name where missing, 18+ self-declaration, Terms/Privacy acknowledgement); (b) no member is blocked, hidden from browsing or restricted because preferences are absent or unmatched; (c) no health, body, birth or contact fields added to account creation; (d) preference edits are audited with the member as actor (Disposition §4).
Code fact (verified): the "mandatory" rule exists only in documents; no member Interests/Goals storage exists; Focus Areas have **no stable IDs** (the 9 Goals do).

### FDR-02 — Interests/Goals onboarding and preference-based recommendations *(Restores; required for CPE; amends FD-PILOT-01 §16.4 rows 4–5)*

Required for CPE in the minimal form the baseline describes: preference-ranked ordering **inside the already-authorized discoverable set**, general browsing always available, no preference-based participation restriction. REC-1 is not broadened into a heavier recommender.

### FDR-03 — Optional Profile, Group and Challenge images *(Restores, as optional; required for CPE; amends FD-PILOT-01 §16.2–§16.4 row 8)*

| Older position | Latest Founder decision |
|---|---|
| FD-MC-07: media pre-pilot. FD-PILOT-01 row 8: deferred; §16.3: "gradients and initials rather than user-uploaded images". | **Optional** Profile image (onboarding or Profile), **optional** Group cover, **optional** Challenge cover; required for CPE. Gradients/initials remain default and fallback; no member must upload. |

Unchanged: FD-MC-07a (Cloudflare R2 behind a provider-neutral ObjectStore port; **provider direction, not proof of live upload**); §8.3 visibility/mutation baseline; §8.5 scope-based ownership; §8.6 Challenge-cover authority; MV-206 external guidance only; MEDIA-1 decision record still required. Verified: **no V2 media code, table, route, bucket or credentials exist**. R2 account/credentials/non-production environment and any live use need separate authorization. Delivered as one shared capability (B, P6), optional to every journey.

### FDR-04 — Support Tiizi manual mobile-money journey *(Narrows FD-PILOT-01 §16.3/§16.8 by distinction; Contribution Recon 001 unchanged)*

Resolved by **distinction, not exception**: FD-PILOT-01 §16.8 disables **Challenge-level** "Support a Cause"/"Support Tiizi" configuration and payment-destination collection — **unchanged**. The baseline adds a **separate permanent Profile-level journey**: not a Challenge setting, not a Cause, no payment-destination reference on any Challenge. Displaying a recipient number is not "payment-destination collection". FD-PILOT-01 §16.3 "no live payment-processing facility" is **not breached**: the Tiizi application processes nothing; the Founder/operator, not the app, receives any transfer; no in-app charging, pledge, subscription, receipt or confirmation.
Recorded: suggested **KES 500 / 1,000 / 2,000 / 5,000 / Custom**; non-binding frequency **just once / occasionally (whenever able) / monthly / annually** (not persisted initially; not a subscription); Tiizi stays free and results never depend on contributing; no totals, meters, receipts or claims of payment/funds received.
**Development rule:** explicit non-payable placeholders for recipient number, holder name and WhatsApp contact; no realistic invented numbers; no active copy, payment or WhatsApp actions. **Activation rule:** real recipient number, registered holder name (Founder/operator disclosed as collecting on behalf of Tiizi) and support WhatsApp contact Founder-verified, with funds-handling/reconciliation and applicable legal/privacy approval recorded. **Authority gap before P8b:** Contribution Recon 001 (§§8–9) leaves Support/donation authority (SUP-01/02) unallocated ("REQUIRES FOUNDER DECISION at S8 time") and classes the Profile Support CTA as S8 scope; T1 §V.6 / FR-V2-162 require a Tiizi-controlled destination while this journey names the Founder/operator; FR-V2-151/152 require voluntary, non-subscription, restrained treatment. The Founder records the SUP-01/02 allocation and confirms a Founder/operator-held recipient satisfies T1 §V.6. Paystack: future candidate only; amount UX reusable; frequency never implies a gateway subscription. Contribution/payment execution (S8) stays not implemented.

### FDR-05 — Challenge Feed, internal Share, Kudos, announcements *(Restores; required for CPE; amends FD-PILOT-01 §16.4 row 9 and last sentence of §16.7)*

**Exact Founder-approved CF-01 v0.2 contract retained**: separate Challenge Feed (not the Group Feed; no cross-reads); automatic moments A1–A6; explicit, previewed, self-only, withdrawable Share (S1–S3); one Kudos type; Steward/authorized announcements; **no comments or replies**; no free-text member posts; Feed never alters Challenge truth; logging never auto-shares an individual activity. **External sharing is separate** (Q4), is not the internal Share and is not in CPE.
**Outstanding bounded decisions (Q3) gate only the affected components, not unrelated work:** Streak milestone schedule → gates the S2 Streak-milestone Share family (CF-2); Kudos-able item set and announcement-author rule/length bound → gate CF-5 Kudos and announcements. A1–A6, S1, S3 and read/preview work proceed without them. CPE acceptance of the Feed requires these resolved and their components delivered.

### FDR-06 — Disposable preview fixtures are not Product Truth *(Clarification)*

Seeded Challenge title/unit inconsistencies and the "2 Activities" preview are **fixture defects**. Verified cause: migration 014 seeds two exemplar Activities; the 118 exist only after the manual S6 import **and** publication. Canonical Activity definitions, PF contracts and the 118 baseline are not modified. The catalogue is **development-only**; production catalogue publication is not authorized here.

## 5. Final decision register

| ID | Decision | Status |
|---|---|---|
| **Q1** | Pilot-versus-launch gating of Interests/Goals, REC-1, media, Challenge Feed/Share/Kudos/announcements | **RESOLVED** by FDR-00: all required for **CPE**; pilot limits users, not features. |
| **Q2** | Original Group creator | **RESOLVED as a requirement** (Correction 001): original creator is **distinct from the Steward** and must be preserved. Canonical provenance is planned in B (P4a): record creator at establishment, backfill **only** where an existing authoritative record proves it, otherwise leave unrecorded; the Founder-visible outcome is "not recorded" (or nothing shown) — **never infer from the current Steward, never invent history**. Technical detail (verify which records exist) is a P4a start-up step; no further Founder decision is needed unless that check finds no authoritative source for existing Groups. |
| **Q3** | CF-01 outstanding details: Streak milestone schedule; Kudos on system cards; announcement-author rule and length bound | **OPEN — bounded.** Must be resolved before the affected components (CF-2 S2 family; CF-5) are implemented; does not block unrelated work. |
| **Q4** | External social sharing (native/Copy Link): visibility, preview, scope | **OPEN — separate decision; outside CPE.** |
| **Q5** | Support Tiizi activation facts and SUP-01/02 / T1 §V.6 allocation; recipient, holder name, WhatsApp contact, reconciliation, legal/privacy | **OPEN.** Does not block the placeholder journey (P8a); blocks activation (P8b), which is therefore a Controlled Pilot **entry requirement**. |
| **Q6** | Welcome placement | **RESOLVED** (Founder decided): four slides, **public, before registration**; pure static content, no data calls. |
| **Q7** | "What we avoid" culture choices and bounded creator expectation length | **OPEN — bounded.** Wording needed before the Culture-step component (P4); does not block other work. |
| **Q8** *(existing input, not new)* | Approved legal Terms/Privacy text, version identifiers, 18+ acknowledgement design | **OPEN (existing MC-2C / baseline §G).** Gates P1d legal gate and Controlled Pilot entry. |

## 6. Items deliberately **not** treated as conflicts

- "Focus Areas" → "Group Interests" in member copy: wording only; `focus_tags`, `goal_ids`, governed IDs and custom handling stay; Group Goals vs Member Goals preserved.
- "Repetitions" → "reps" in member UI: label only; canonical unit `reps` unchanged.
- Activity Guide return path, roster refresh, Group Details content: defects/gaps, not authority matters.
- Display names in authorized contexts: already authorized (FD-MC-03; §16.6); implementation missing.
- Wizard step-3 copy distinguishing Support a Cause from Support Tiizi (baseline B.4): wording only; §16.8 unchanged; no Challenge-level payment destination added; neither implies payment execution.
- Legal Terms/Privacy and 18+/acknowledgement: unchanged; MC-2C remains conditional; nothing here approves legal text.

## 7. What this amendment does **not** do

Does not authorize code, migrations, media/payment configuration, deployment, production access, public onboarding or pilot launch; does not merge PR #107 or PR #94; does not delete legacy code; does not change any engine, canonical Activity definition, scoring or result rule; does not waive any legal, privacy, eligibility, access-control or data-protection obligation; does not add unapproved features.

## 8. Programme recording (proposed; not applied in this PR)

On Founder approval, one change-log row in the Master Programme: *"Founder Experience Recovery Baseline 001 reconciled (TIIZI-FER-001, incl. Correction 001 — Complete Experience, Controlled Pilot); FDR-00…FDR-06 recorded; FD-PILOT-01 feature deferrals superseded for sequencing (milestones: Complete Product Experience → Controlled Pilot → Wider Launch); implementation plan B proposed; no implementation, migration, deployment or launch authorized."* Version assigned at merge (PR #107 also proposes 2.81). Disposition §16 receives pointers per the §3.3 table rather than rewritten text.

**Disposition:** PROPOSED. STOP for Technical Lead review. No merge, code go or deployment go is implied.
