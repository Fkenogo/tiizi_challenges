# Tiizi V2 Legal Drafts — Founder Review Pack

**STATUS: DRAFT / NOT APPROVED / NOT AUTHORIZED FOR PUBLICATION.**

This folder contains **drafts for discussion only**, not the legal material authorized under the MC-2C-2 legal dependency. Do **not** import these files into V2 legal pages, expose them to members, add acceptance tracking, or mark MC-2C complete.

- [Terms of Service — draft](./TIIZI-TERMS-OF-SERVICE-DRAFT-001.md)
- [Privacy Policy — draft](./TIIZI-PRIVACY-POLICY-DRAFT-001.md)

## Founder-approved framing used for these drafts

- Tiizi is operated under the **Miledge Ventures** brand, separate from Miledge's shared infrastructure projects.
- **18+** eligibility only.
- **Kenya** is the intended principal Tiizi office/operating base.
- Miledge Ventures registration is in progress in Rwanda, Uganda and Burundi, with Kenya planned; no corporate number, legal entity status or registered office is asserted.
- English, simple member-facing drafting; no MC-3 consent mechanism and no V1 legal screen reuse.

## Revision LEGAL-001 (Draft 0.2) — review matrix

Lightweight revision based on the Legal Draft Factual Alignment Review 001. Wording only; no product, sign-up, consent or code change.

| Area | Change | Reason (alignment finding) |
|---|---|---|
| Terms — scope | Limited to the current V2 experience; Terms trimmed from 9 sections to a short member-friendly set. | Avoid describing unbuilt features; keep proportionate. |
| Terms — 18+ | Kept as Founder rule. Drafting note: no age check exists; sign-up self-declaration is a **recommended future bounded requirement**. | No age gate in source; do not imply enforcement. |
| Terms — voluntary participation | Members choose Groups, Challenges and Activities; may generally leave or withdraw, except the Accountable Steward cannot leave their Group and ended Challenges cannot be joined or withdrawn from; exit is not account deletion or erasure of records. | Founder direction; `leaveGovernedGroup` (`owner_cannot_leave`) and `requireParticipationMutable` (ended/finalized/expired). |
| Terms — optional contributions | New section: optional; buys no participation, ranking, results, recognition or preference; **payments not available in V2**; no custody or payment model; cause is the creator's choice. | Payments absent in source; avoid inventing a financial model. |
| Terms — Group authority | Describes the **Accountable Steward** (the Group creator) as the only member who can change Group settings and approve or decline join requests; membership role labels (owner/admin/member) do not by themselves confer these powers. | `updateGovernedGroupSettings` and `reviewPendingMembership` require the steward (403 otherwise); no removal, role-change or moderation routes exist. |
| Terms — moderation/enforcement | Removed "organizer moderation", "account checks" and implied enforcement; states in-app reporting is not yet provided. | No reporting or suspension capability. |
| Terms — recognition/rewards | States recognition features and prizes are not available. | Kudos and Recognition not implemented. |
| Privacy — scope | Covers V2 only; legacy versions expressly out of scope. | V1 code still shipped but frozen; avoid conflation. |
| Privacy — data inventory | Specific: Firebase sign-in/email (not stored in member record), display name and permanent name-change history, Groups, participation episodes, activity measurements (may reveal health information), cause payment-destination reference. | Source review of migrations and routes. |
| Privacy — visibility | Own Profile/email; Group/Challenge visibility by role; other members currently see a generic label; limited operator administrative view. | Reads show "Tiizi member"; operator console shows IDs/roles/counts. |
| Privacy — providers | Firebase/Google named as sign-in provider; other providers and all geography left **TBC**. | Hosting runbook is plan-only; no inferred geography. |
| Privacy — deletion/retention | States plainly that deletion/erasure is **not yet available**, records are kept, name history is permanent; no periods or deadlines. | `ON DELETE RESTRICT`, append-only history; LIFE-1 not built. |
| Privacy — rights/contact | Rights listed subject to law; no request tool yet; depends on a confirmed contact. | No privacy-request mechanism. |
| Privacy — security | Removed encryption/audit/SLA-style language; no certification claims. | No operational evidence. |
| Both | Still DRAFT / NOT APPROVED / NOT FOR PUBLICATION; contracting entity, controller, contact, Kenya address, registration determination and effective date/version remain placeholders. | Publication prerequisites. |

## Unresolved before publication

1. Identify actual contracting legal entity and data controller, Kenya principal operating address, and the applicable statutory (e.g. ODPC) registration determination.
   - **Contact (LEGAL-002):** the Founder has supplied **support@tiizichallenges.com** for support, legal enquiries, community concerns and privacy requests. Actual mailbox delivery and operational handling remain to be confirmed.
2. Verify platform product statements and deployment-specific data practices.
3. Set approved lawful bases, processor disclosures, hosting/cross-border transfers and retention approach.
4. Decide on published effective dates and version identifiers.
5. Obtain applicable Kenyan legal review and explicit Founder approval.
   - *Recommended separately (not authorized here):* a bounded sign-up age self-declaration, and a decision on how legacy V1 screens/data relate to the V2 policy.
6. **Only after approval:** authorize a separate bounded MC-2C legal-presentation implementation PR for public `/v2/terms` and `/v2/privacy`, plus navigation and tests.

## Reference materials for counsel (not legal advice)

- Kenya ODPC data protection framework: https://www.odpc.go.ke/data-protection-laws-kenya/
- Kenya ODPC individual rights: https://www.odpc.go.ke/rights-of-a-data-subject/
- Kenya ODPC registration guidance: https://www.odpc.go.ke/faqs/
- Kenya Data Protection (General) Regulations, 2021: https://www.odpc.go.ke/wp-content/uploads/2024/03/THE-DATA-PROTECTION-GENERAL-REGULATIONS-2021-1.pdf

**Programme state: Master Programme v2.79, MC-2C conditional, MC-2D not started, migration 027 not production deployed.**
