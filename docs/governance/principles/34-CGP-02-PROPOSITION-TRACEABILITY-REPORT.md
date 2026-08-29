# CGP-02 — D-04 Whole-Standard Proposition Traceability Report

## Document Control

| Field | Value |
|---|---|
| Programme | Tiizi Version 2 |
| Stage | Stage E0 — Governance Architecture |
| Phase | CGP-02 — Constitutional Amendment & Governance Review Standard |
| Work package | CGP-02D — Whole-Standard Founder Review and Approval Preparation |
| Deliverable | D-04 — Whole-Standard Proposition Traceability Report |
| Document type | Governance assurance / mechanical traceability verification |
| Status | **Traceability Complete — PASS** |
| Report date | 2026-08-29 |
| Predecessor | [D-03 — Whole-Standard Founder Approval Candidate](34-CGP-02-WHOLE-STANDARD-FOUNDER-APPROVAL-CANDIDATE.md) — Founder Accepted 2026-08-29 |
| Traced corpus | 302 propositions / 302 unique proposition IDs |
| V0 SHA-256 | `2a2c03dbc2445be83f34232e08fb45f6f2951588c9078acea83b91be738f2675` |
| Approval | Not approved |
| Adoption | Not established |
| Application | Not established |
| Constitutional effect | None |

## 1. Purpose

This report extends [D18 — Governance Status and Decision Trace](../../programme/CGP-02C-13-GOVERNANCE-STATUS-AND-DECISION-TRACE.md) from **package-level** traceability to **proposition-level** traceability for the 302-proposition corpus assembled in [D-03 — Whole-Standard Founder Approval Candidate](34-CGP-02-WHOLE-STANDARD-FOUNDER-APPROVAL-CANDIDATE.md).

The governing question is: can every proposition in the D-03 candidate be reconstructed back to its protected source and attributable decision history, without inventing authority, approval, adoption, application, or constitutional effect?

D-04 does not replace D18. It does not perform D-05 cross-reference/impact analysis or D-06 whole-standard validation. It is an assurance and evidence report, not a constitutional decision.

## 2. Scope and Boundaries

This report traces all 302 propositions in the D-03 candidate. It does not:

- reopen or re-derive package-level Founder decisions (C.1 FQ-01–05 through C.12 VLQ-01–09);
- reopen CRA-001 through CRA-045;
- resolve any D17 deferred constitutional question;
- assign any proposition-level "Founder Approved" status not established by the attributable source evidence;
- upgrade any package's historical status beyond what its own decision record establishes.

**Preserved immutable boundaries:**

- source content ≠ decision evidence;
- decision evidence ≠ whole-standard approval;
- source-package candidate status ≠ package Founder approval;
- package Founder approval ≠ whole-standard approval;
- whole-standard candidate acceptance ≠ whole-standard approval;
- approval ≠ adoption; adoption ≠ application unless attributable governance establishes that;
- repository recording ≠ constitutional status;
- D-02 review acceptance ≠ proposition amendment;
- D-04 traceability ≠ D-06 validation.

**Critical constraint preserved:** D18 records package-level Founder-Approved status only for CGP-02C.4 (Adoption and Constitutional Effect). This report does not upgrade the historical source status of the other 13 proposition-bearing packages merely because D-03 is now a Founder-accepted whole-standard approval candidate. Section 5 (register) below reproduces each package's actual recorded status verbatim from V0/D18 evidence, with no normalization to a single generic "approved" label.

## 3. Traceability Method

Verification was performed programmatically, not by visual inspection, using a deterministic script (`extract_props` proposition parser: regex `^\*\*ID\.\*\*\s+text$` applied per file) that:

1. extracted all propositions (ID + exact text) from D-03, from V0, and from each of the 14 actual protected source files on disk (the same files identified in V0 §2's "Protected source" links, not merely V0's self-description of them);
2. compared, for every proposition ID: D-03 text ↔ V0 text (exact string equality), and V0 text ↔ the corresponding protected source file's text (exact string equality);
3. verified proposition-to-package assignment by walking V0 §2 in document order, associating each proposition with the nearest preceding `### 2.N` package section header;
4. verified uniqueness of all 302 IDs across the corpus (no duplicate-ID defect);
5. verified that a decision-evidence file exists on disk at the path identified by each source section's "Attribution evidence" link;
6. cross-checked package-level status fields (lifecycle/approval/adoption/effect) recorded in V0 §2 against [D18](../../programme/CGP-02C-13-GOVERNANCE-STATUS-AND-DECISION-TRACE.md)'s independently-recorded status table for consistency.

No proposition text, ID, or status field in this report was retyped by hand; all values in Sections 5 and 6 were extracted programmatically from the authoritative files identified.

## 4. D-02 / D-03 Relationship (applies uniformly to all 302 rows)

Rather than repeating identical boundary language 302 times, the following applies uniformly to every row in Section 6:

- every proposition below is included in the [D-03](34-CGP-02-WHOLE-STANDARD-FOUNDER-APPROVAL-CANDIDATE.md) Founder Approval Candidate;
- every proposition was subject to the [D-02](../../programme/CGP-02D-FOUNDER-DECISION-RECORD.md) whole-standard Founder Constitutional Review (WRQ-01–WRQ-10, 10/10 Accepted);
- D-02 directed no proposition amendment, correction, clarification, or return for any proposition;
- D-03 was accepted by the Founder (2026-08-29) as the correct candidate representation;
- the CGP-02 whole standard remains **not** Founder Approved, **not** adopted, and without constitutional effect.

## 5. Protected Source / Decision-Evidence Register

The following register reproduces, per protected source, the exact protected-source file, package identifier, recorded lifecycle/approval/adoption/effect status (as recorded in V0 §2 and cross-checked against D18), proposition range/count, and the decision-evidence file verified present on disk. Full relative paths are within `docs/governance/principles/`; the source file basenames are shown for brevity.

| # | Source | Package ID | File | Lifecycle status | Approval status | Adoption status | Effect status | Prop. range | Count | Decision evidence |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | Tiizi Platform Constitution | PC-01 | `01-TIIZI-PLATFORM-CONSTITUTION.md` | Current highest binding platform instrument within scope | Approved normative source status recorded by CGP-02 discovery | No separate adoption record identified in the CGP-02 input corpus | Current constitutional source within its recorded scope | Not proposition-structured | 0 | `n/a` |
| 2 | Platform Authority Model | PAM-01 | `10-PLATFORM-AUTHORITY-MODEL.md` | Current Authority baseline subordinate to the Platform Constitution | Approved Authority baseline status recorded by CGP-02 discovery | No separate adoption record identified in the CGP-02 input corpus | Current normative Authority source within its recorded scope | Not proposition-structured | 0 | `n/a` |
| 3 | Constitutional Governance Principles | CGP-01 | `02-CGP-01-CONSTITUTIONAL-GOVERNANCE-PRINCIPLES.md` | Current Approved Constitutional Baseline | Approved constitutional governance | Adopted 2026-07-21 | Effective 2026-07-21 within its recorded scope | Not proposition-structured | 0 | `n/a` |
| 4 | Constitutional Framework and Amendment Principles | CGP-02C.1 | `05-CGP-02C-1-CONSTITUTIONAL-FRAMEWORK-AND-AMENDMENT-PRINCIPLES-DRAFT.md` | Founder Approval Candidate | Candidate-preparation decisions issued; instrument not approved | Not adopted | None | AMP-01–AMP-09; GVR-01–GVR-09; CHB-01–CHB-08 | 26 | `05-CGP-02C-1-FOUNDER-DECISION-RECORD.md` |
| 5 | Governance Lifecycle | CGP-02C.2A | `07-CGP-02C-2A-GOVERNANCE-LIFECYCLE-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Accepted in principle for candidate preparation; instrument not approved | Not adopted | None | GLC-01–GLC-13 | 13 | `07-CGP-02C-2A-FOUNDER-DECISION-RECORD.md` |
| 6 | Amendment Classification | CGP-02C.2B | `08-CGP-02C-2B-AMENDMENT-CLASSIFICATION-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Accepted in principle for candidate preparation; instrument not approved | Not adopted | None | AMC-01–AMC-12 | 12 | `08-CGP-02C-2B-FOUNDER-DECISION-RECORD.md` |
| 7 | Review Triggers and Proportionality | CGP-02C.2C | `09-CGP-02C-2C-REVIEW-TRIGGERS-AND-PROPORTIONALITY-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Accepted in principle for candidate preparation; instrument not approved | Not adopted | None | RTP-01–RTP-14 | 14 | `09-CGP-02C-2C-FOUNDER-DECISION-RECORD.md` |
| 8 | Approval Governance | CGP-02C.3 | `12-CGP-02C-3-APPROVAL-GOVERNANCE-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder questions approved for candidate; instrument approval not recorded | Not adopted | None | APV-01–APV-24 | 24 | `12-CGP-02C-3-FOUNDER-DECISION-RECORD.md` |
| 9 | Adoption and Constitutional Effect | CGP-02C.4 | `15-CGP-02C-4-ADOPTION-AND-CONSTITUTIONAL-EFFECT-FOUNDER-APPROVED.md` | Founder Approved Constitutional Instrument | Founder Approved 2026-07-23 | Not adopted | None | ACE-01–ACE-21 | 21 | `14-CGP-02C-4-FOUNDER-DECISION-RECORD.md` |
| 10 | Amendment Traceability Requirements | CGP-02C.5 | `16-CGP-02C-5-AMENDMENT-TRACEABILITY-REQUIREMENTS-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder Approved for candidate 2026-07-24 | Not adopted | None | ATR-01–ATR-24 | 24 | `16-CGP-02C-5-FOUNDER-DECISION-RECORD.md` |
| 11 | Dependent-Governance Impact Review | CGP-02C.6 | `18-CGP-02C-6-DEPENDENT-GOVERNANCE-IMPACT-REVIEW-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder Approved for candidate 2026-07-24 | Not adopted | None | DGI-01–DGI-24 | 24 | `18-CGP-02C-6-FOUNDER-DECISION-RECORD.md` |
| 12 | Conflict Review and Escalation | CGP-02C.7 | `20-CGP-02C-7-CONFLICT-REVIEW-AND-ESCALATION-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder Approved for candidate 2026-07-24 | Not adopted | None | CRE-01–CRE-24 | 24 | `20-CGP-02C-7-FOUNDER-DECISION-RECORD.md` |
| 13 | Supersession Rules | CGP-02C.8 | `22-CGP-02C-8-SUPERSESSION-RULES-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder Approved for candidate 2026-07-24 | Not adopted | None | SSR-01–SSR-24 | 24 | `22-CGP-02C-8-FOUNDER-DECISION-RECORD.md` |
| 14 | Retirement, Withdrawal and Rejection Rules | CGP-02C.9 | `24-CGP-02C-9-RETIREMENT-WITHDRAWAL-AND-REJECTION-RULES-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder Approved for candidate 2026-07-24 | Not adopted | None | RWR-01–RWR-24 | 24 | `24-CGP-02C-9-FOUNDER-DECISION-RECORD.md` |
| 15 | Historical Preservation | CGP-02C.10 | `26-CGP-02C-10-HISTORICAL-PRESERVATION-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder Approved for candidate 2026-07-24 | Not adopted | None | HPR-01–HPR-24 | 24 | `26-CGP-02C-10-FOUNDER-DECISION-RECORD.md` |
| 16 | Governance Index and Status Integrity | CGP-02C.11 | `28-CGP-02C-11-GOVERNANCE-INDEX-AND-STATUS-INTEGRITY-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder Approved for candidate 2026-07-25 | Not adopted | None | GSI-01–GSI-24 | 24 | `28-CGP-02C-11-FOUNDER-DECISION-RECORD.md` |
| 17 | Validation Rules | CGP-02C.12 | `30-CGP-02C-12-VALIDATION-RULES-FOUNDER-APPROVAL-CANDIDATE.md` | Founder Approval Candidate | Founder Approved for candidate 2026-07-25 | Not adopted | None | VLR-01–VLR-24 | 24 | `30-CGP-02C-12-FOUNDER-DECISION-RECORD.md` |
**Note on the three non-proposition-bearing protected sources** (PC-01 Platform Constitution, PAM-01 Platform Authority Model, CGP-01 Constitutional Governance Principles): these are protected normative dependencies preserved in source order (1–3 of 17) but are not proposition-structured and contribute 0 propositions to the 302-proposition bounded corpus, consistent with V0 §1's Assembly Boundary. No proposition traceability row applies to them.

## 6. Proposition Traceability Matrix (302 rows)

Each row traces one D-03 proposition. "Package" cross-references the register in Section 5 for the source file, decision-evidence file, and full lifecycle/approval/adoption/effect status — repeated here would duplicate identical text 302 times without adding evidence. "Text hash" is the SHA-256 of the exact proposition text (first 16 hex characters shown; verified identical across D-03, V0, and the protected source file). "Source match" reports the outcome of steps 1–2 in Section 3. "Decision evidence" reports the outcome of step 5. "D17 linkage" records package-level association with a deferred question per Section 7 below (proposition-level causation is not asserted where D17 identifies only the package). "Result" is PASS only where source match, decision evidence, and package assignment all succeed without inference.

| # | ID | Package | Text hash (SHA-256, first 16) | Source match | Decision evidence | D17 linkage | Result |
|---|---|---|---|---|---|---|---|
| 1 | AMP-01 | CGP-02C.1 | `25541f38a43ae1c6` | PASS | Present | — | PASS |
| 2 | AMP-02 | CGP-02C.1 | `26eca9be49f3fb8a` | PASS | Present | — | PASS |
| 3 | AMP-03 | CGP-02C.1 | `8149dc1b89c73ac3` | PASS | Present | — | PASS |
| 4 | AMP-04 | CGP-02C.1 | `d27b87667e1e68b6` | PASS | Present | — | PASS |
| 5 | AMP-05 | CGP-02C.1 | `39fd664f7a83ae89` | PASS | Present | — | PASS |
| 6 | AMP-06 | CGP-02C.1 | `29ff570aa790c03b` | PASS | Present | — | PASS |
| 7 | AMP-07 | CGP-02C.1 | `98fb9e6207c1d28a` | PASS | Present | — | PASS |
| 8 | AMP-08 | CGP-02C.1 | `6f04d0f1facc3f75` | PASS | Present | — | PASS |
| 9 | AMP-09 | CGP-02C.1 | `62c9c4319170ccfc` | PASS | Present | — | PASS |
| 10 | GVR-01 | CGP-02C.1 | `a43b7ce3b074c9ca` | PASS | Present | — | PASS |
| 11 | GVR-02 | CGP-02C.1 | `1311a7ca14574cbd` | PASS | Present | — | PASS |
| 12 | GVR-03 | CGP-02C.1 | `aa289120e33068ef` | PASS | Present | — | PASS |
| 13 | GVR-04 | CGP-02C.1 | `38a1f145a35d771a` | PASS | Present | — | PASS |
| 14 | GVR-05 | CGP-02C.1 | `5bb3a4ecf541a12d` | PASS | Present | — | PASS |
| 15 | GVR-06 | CGP-02C.1 | `2ca607cf0a3a9814` | PASS | Present | — | PASS |
| 16 | GVR-07 | CGP-02C.1 | `c119de58c9c30aaf` | PASS | Present | — | PASS |
| 17 | GVR-08 | CGP-02C.1 | `92bb0799bd97d3ca` | PASS | Present | — | PASS |
| 18 | GVR-09 | CGP-02C.1 | `064bda84903291e0` | PASS | Present | — | PASS |
| 19 | CHB-01 | CGP-02C.1 | `795a96160c9b72de` | PASS | Present | — | PASS |
| 20 | CHB-02 | CGP-02C.1 | `be6964b1776247bd` | PASS | Present | — | PASS |
| 21 | CHB-03 | CGP-02C.1 | `d3d9e5a2768fd7fe` | PASS | Present | — | PASS |
| 22 | CHB-04 | CGP-02C.1 | `5f1ed2121c9cad46` | PASS | Present | — | PASS |
| 23 | CHB-05 | CGP-02C.1 | `9f716a571b6b36ca` | PASS | Present | — | PASS |
| 24 | CHB-06 | CGP-02C.1 | `e3a62c491b72fb19` | PASS | Present | — | PASS |
| 25 | CHB-07 | CGP-02C.1 | `2c509276facb2c00` | PASS | Present | — | PASS |
| 26 | CHB-08 | CGP-02C.1 | `a280e4bd8a15ee7a` | PASS | Present | — | PASS |
| 27 | GLC-01 | CGP-02C.2A | `807cf5c16a3a3fd0` | PASS | Present | DQ-06, DQ-07 | PASS |
| 28 | GLC-02 | CGP-02C.2A | `6912e59022d36c2a` | PASS | Present | DQ-06, DQ-07 | PASS |
| 29 | GLC-03 | CGP-02C.2A | `1978d55c798966e6` | PASS | Present | DQ-06, DQ-07 | PASS |
| 30 | GLC-04 | CGP-02C.2A | `06f30f8e021e95b6` | PASS | Present | DQ-06, DQ-07 | PASS |
| 31 | GLC-05 | CGP-02C.2A | `0bbf55f2877964dc` | PASS | Present | DQ-06, DQ-07 | PASS |
| 32 | GLC-06 | CGP-02C.2A | `4d05e31e896bdb24` | PASS | Present | DQ-06, DQ-07 | PASS |
| 33 | GLC-07 | CGP-02C.2A | `de9f0b8fb0561d58` | PASS | Present | DQ-06, DQ-07 | PASS |
| 34 | GLC-08 | CGP-02C.2A | `fb55073971bd3518` | PASS | Present | DQ-06, DQ-07 | PASS |
| 35 | GLC-09 | CGP-02C.2A | `c1928b2dbef7f90d` | PASS | Present | DQ-06, DQ-07 | PASS |
| 36 | GLC-10 | CGP-02C.2A | `dd323a97b0b2acdc` | PASS | Present | DQ-06, DQ-07 | PASS |
| 37 | GLC-11 | CGP-02C.2A | `f6e22d8af6af2d6b` | PASS | Present | DQ-06, DQ-07 | PASS |
| 38 | GLC-12 | CGP-02C.2A | `9f20d565b0f501f4` | PASS | Present | DQ-06, DQ-07 | PASS |
| 39 | GLC-13 | CGP-02C.2A | `f7cf281f61a36c4b` | PASS | Present | DQ-06, DQ-07 | PASS |
| 40 | AMC-01 | CGP-02C.2B | `25d4b878ddd13028` | PASS | Present | DQ-04, DQ-05 | PASS |
| 41 | AMC-02 | CGP-02C.2B | `48eb715a3ec44bed` | PASS | Present | DQ-04, DQ-05 | PASS |
| 42 | AMC-03 | CGP-02C.2B | `6f467af3625dc14e` | PASS | Present | DQ-04, DQ-05 | PASS |
| 43 | AMC-04 | CGP-02C.2B | `a3f92f829ac41109` | PASS | Present | DQ-04, DQ-05 | PASS |
| 44 | AMC-05 | CGP-02C.2B | `1596ed4d708a77cb` | PASS | Present | DQ-04, DQ-05 | PASS |
| 45 | AMC-06 | CGP-02C.2B | `d98d8e02c96ea186` | PASS | Present | DQ-04, DQ-05 | PASS |
| 46 | AMC-07 | CGP-02C.2B | `ad4ba38ad498bff2` | PASS | Present | DQ-04, DQ-05 | PASS |
| 47 | AMC-08 | CGP-02C.2B | `94c7ce44d2c44ef2` | PASS | Present | DQ-04, DQ-05 | PASS |
| 48 | AMC-09 | CGP-02C.2B | `fef466e73f0c1900` | PASS | Present | DQ-04, DQ-05 | PASS |
| 49 | AMC-10 | CGP-02C.2B | `99e8227d8c1efcce` | PASS | Present | DQ-04, DQ-05 | PASS |
| 50 | AMC-11 | CGP-02C.2B | `2c71037d31aabdb5` | PASS | Present | DQ-04, DQ-05 | PASS |
| 51 | AMC-12 | CGP-02C.2B | `eec918054984c1e6` | PASS | Present | DQ-04, DQ-05 | PASS |
| 52 | RTP-01 | CGP-02C.2C | `456283c43e6125d9` | PASS | Present | DQ-01, DQ-02 | PASS |
| 53 | RTP-02 | CGP-02C.2C | `575564a12ceacd76` | PASS | Present | DQ-01, DQ-02 | PASS |
| 54 | RTP-03 | CGP-02C.2C | `2a279de0368e5ab9` | PASS | Present | DQ-01, DQ-02 | PASS |
| 55 | RTP-04 | CGP-02C.2C | `e2edeeba6d2d6dac` | PASS | Present | DQ-01, DQ-02 | PASS |
| 56 | RTP-05 | CGP-02C.2C | `6d48e7b51ffc184d` | PASS | Present | DQ-01, DQ-02 | PASS |
| 57 | RTP-06 | CGP-02C.2C | `63c108d4e426e6bf` | PASS | Present | DQ-01, DQ-02 | PASS |
| 58 | RTP-07 | CGP-02C.2C | `fee3e77813e9a8ac` | PASS | Present | DQ-01, DQ-02 | PASS |
| 59 | RTP-08 | CGP-02C.2C | `3c5dcb3218a9e2bd` | PASS | Present | DQ-01, DQ-02 | PASS |
| 60 | RTP-09 | CGP-02C.2C | `7747c7b8b01127ab` | PASS | Present | DQ-01, DQ-02 | PASS |
| 61 | RTP-10 | CGP-02C.2C | `bef1234352c8ffd2` | PASS | Present | DQ-01, DQ-02 | PASS |
| 62 | RTP-11 | CGP-02C.2C | `61bdbc4b4c3889da` | PASS | Present | DQ-01, DQ-02 | PASS |
| 63 | RTP-12 | CGP-02C.2C | `df46c59bb2b70f4f` | PASS | Present | DQ-01, DQ-02 | PASS |
| 64 | RTP-13 | CGP-02C.2C | `89aa16f2e5eb661b` | PASS | Present | DQ-01, DQ-02 | PASS |
| 65 | RTP-14 | CGP-02C.2C | `7a84a0be50dc3503` | PASS | Present | DQ-01, DQ-02 | PASS |
| 66 | APV-01 | CGP-02C.3 | `d53c50580bfe40fe` | PASS | Present | DQ-04, DQ-11 | PASS |
| 67 | APV-02 | CGP-02C.3 | `711a7bdc40a8f8f7` | PASS | Present | DQ-04, DQ-11 | PASS |
| 68 | APV-03 | CGP-02C.3 | `621f572d7ee584d8` | PASS | Present | DQ-04, DQ-11 | PASS |
| 69 | APV-04 | CGP-02C.3 | `a686c555e1b9ef69` | PASS | Present | DQ-04, DQ-11 | PASS |
| 70 | APV-05 | CGP-02C.3 | `fc16939f4262cdba` | PASS | Present | DQ-04, DQ-11 | PASS |
| 71 | APV-06 | CGP-02C.3 | `9b45158e23aebdd4` | PASS | Present | DQ-04, DQ-11 | PASS |
| 72 | APV-07 | CGP-02C.3 | `0a12243d356a3811` | PASS | Present | DQ-04, DQ-11 | PASS |
| 73 | APV-08 | CGP-02C.3 | `be13e5c3d634a001` | PASS | Present | DQ-04, DQ-11 | PASS |
| 74 | APV-09 | CGP-02C.3 | `19ea69ca29ac3a05` | PASS | Present | DQ-04, DQ-11 | PASS |
| 75 | APV-10 | CGP-02C.3 | `dc880e32d9974dc9` | PASS | Present | DQ-04, DQ-11 | PASS |
| 76 | APV-11 | CGP-02C.3 | `bb2eb6d649a32879` | PASS | Present | DQ-04, DQ-11 | PASS |
| 77 | APV-12 | CGP-02C.3 | `08f8071128ba494b` | PASS | Present | DQ-04, DQ-11 | PASS |
| 78 | APV-13 | CGP-02C.3 | `2a0b92a8ce017409` | PASS | Present | DQ-04, DQ-11 | PASS |
| 79 | APV-14 | CGP-02C.3 | `34a9bacbc03a98f9` | PASS | Present | DQ-04, DQ-11 | PASS |
| 80 | APV-15 | CGP-02C.3 | `cc1710563270b453` | PASS | Present | DQ-04, DQ-11 | PASS |
| 81 | APV-16 | CGP-02C.3 | `c6feab806df92ec2` | PASS | Present | DQ-04, DQ-11 | PASS |
| 82 | APV-17 | CGP-02C.3 | `c4307d98fc0ab7f8` | PASS | Present | DQ-04, DQ-11 | PASS |
| 83 | APV-18 | CGP-02C.3 | `d4686282bc58bbe3` | PASS | Present | DQ-04, DQ-11 | PASS |
| 84 | APV-19 | CGP-02C.3 | `095f3817a4dbc5aa` | PASS | Present | DQ-04, DQ-11 | PASS |
| 85 | APV-20 | CGP-02C.3 | `41551978f7bfe3ba` | PASS | Present | DQ-04, DQ-11 | PASS |
| 86 | APV-21 | CGP-02C.3 | `8b9f126802d3b33d` | PASS | Present | DQ-04, DQ-11 | PASS |
| 87 | APV-22 | CGP-02C.3 | `463e4334234667e1` | PASS | Present | DQ-04, DQ-11 | PASS |
| 88 | APV-23 | CGP-02C.3 | `8a2e6f5b38349b0d` | PASS | Present | DQ-04, DQ-11 | PASS |
| 89 | APV-24 | CGP-02C.3 | `20068fa0f9fc9bf8` | PASS | Present | DQ-04, DQ-11 | PASS |
| 90 | ACE-01 | CGP-02C.4 | `caa9788266439c99` | PASS | Present | DQ-06 | PASS |
| 91 | ACE-02 | CGP-02C.4 | `adba2da18ff5a5c2` | PASS | Present | DQ-06 | PASS |
| 92 | ACE-03 | CGP-02C.4 | `77c7a1dec009cd4e` | PASS | Present | DQ-06 | PASS |
| 93 | ACE-04 | CGP-02C.4 | `69506cac337bd07f` | PASS | Present | DQ-06 | PASS |
| 94 | ACE-05 | CGP-02C.4 | `09b74bc3b4a5466e` | PASS | Present | DQ-06 | PASS |
| 95 | ACE-06 | CGP-02C.4 | `89670450441a8aea` | PASS | Present | DQ-06 | PASS |
| 96 | ACE-07 | CGP-02C.4 | `690158120ab014d4` | PASS | Present | DQ-06 | PASS |
| 97 | ACE-08 | CGP-02C.4 | `1de7fcb8fa7bad88` | PASS | Present | DQ-06 | PASS |
| 98 | ACE-09 | CGP-02C.4 | `1ae10e10615ba74c` | PASS | Present | DQ-06 | PASS |
| 99 | ACE-10 | CGP-02C.4 | `c85714a1bc3c37f2` | PASS | Present | DQ-06 | PASS |
| 100 | ACE-11 | CGP-02C.4 | `346b0b8d7fcd863b` | PASS | Present | DQ-06 | PASS |
| 101 | ACE-12 | CGP-02C.4 | `0838cebe84022fd1` | PASS | Present | DQ-06 | PASS |
| 102 | ACE-13 | CGP-02C.4 | `e7b4e7abfd619f46` | PASS | Present | DQ-06 | PASS |
| 103 | ACE-14 | CGP-02C.4 | `a507e61abecdc2ce` | PASS | Present | DQ-06 | PASS |
| 104 | ACE-15 | CGP-02C.4 | `146b713699b20a57` | PASS | Present | DQ-06 | PASS |
| 105 | ACE-16 | CGP-02C.4 | `3cb68cfbd1d38aed` | PASS | Present | DQ-06 | PASS |
| 106 | ACE-17 | CGP-02C.4 | `24328a85541d1f27` | PASS | Present | DQ-06 | PASS |
| 107 | ACE-18 | CGP-02C.4 | `cdf589ced65cce26` | PASS | Present | DQ-06 | PASS |
| 108 | ACE-19 | CGP-02C.4 | `2f9a90a75ede44d2` | PASS | Present | DQ-06 | PASS |
| 109 | ACE-20 | CGP-02C.4 | `05a8f24350b8ea22` | PASS | Present | DQ-06 | PASS |
| 110 | ACE-21 | CGP-02C.4 | `8ed42f7c563995ba` | PASS | Present | DQ-06 | PASS |
| 111 | ATR-01 | CGP-02C.5 | `7218f7b4c5c02df4` | PASS | Present | — | PASS |
| 112 | ATR-02 | CGP-02C.5 | `82a5d15c78ec409f` | PASS | Present | — | PASS |
| 113 | ATR-03 | CGP-02C.5 | `c6e44aac72f9ac66` | PASS | Present | — | PASS |
| 114 | ATR-04 | CGP-02C.5 | `b703bc5afcdf6329` | PASS | Present | — | PASS |
| 115 | ATR-05 | CGP-02C.5 | `7df36abd08e24d9d` | PASS | Present | — | PASS |
| 116 | ATR-06 | CGP-02C.5 | `462d035533c19507` | PASS | Present | — | PASS |
| 117 | ATR-07 | CGP-02C.5 | `ece9ed16fed284f9` | PASS | Present | — | PASS |
| 118 | ATR-08 | CGP-02C.5 | `d9ec3f3124558abe` | PASS | Present | — | PASS |
| 119 | ATR-09 | CGP-02C.5 | `198183d808e30195` | PASS | Present | — | PASS |
| 120 | ATR-10 | CGP-02C.5 | `ea90062914828a73` | PASS | Present | — | PASS |
| 121 | ATR-11 | CGP-02C.5 | `88f40937dd1d205f` | PASS | Present | — | PASS |
| 122 | ATR-12 | CGP-02C.5 | `42f2811f8c9835e4` | PASS | Present | — | PASS |
| 123 | ATR-13 | CGP-02C.5 | `50dcdf4be2df9a1b` | PASS | Present | — | PASS |
| 124 | ATR-14 | CGP-02C.5 | `8c430f3afed97dd7` | PASS | Present | — | PASS |
| 125 | ATR-15 | CGP-02C.5 | `35aa77abe62a397c` | PASS | Present | — | PASS |
| 126 | ATR-16 | CGP-02C.5 | `c34a5e0a474248ca` | PASS | Present | — | PASS |
| 127 | ATR-17 | CGP-02C.5 | `5da31a351ef1841b` | PASS | Present | — | PASS |
| 128 | ATR-18 | CGP-02C.5 | `411fc03809e982b1` | PASS | Present | — | PASS |
| 129 | ATR-19 | CGP-02C.5 | `0dc1f63a52bbd3d8` | PASS | Present | — | PASS |
| 130 | ATR-20 | CGP-02C.5 | `c5910416bb6a11da` | PASS | Present | — | PASS |
| 131 | ATR-21 | CGP-02C.5 | `eb5a9046221d854f` | PASS | Present | — | PASS |
| 132 | ATR-22 | CGP-02C.5 | `690466fd42ce8442` | PASS | Present | — | PASS |
| 133 | ATR-23 | CGP-02C.5 | `3ac9cf822dffb63c` | PASS | Present | — | PASS |
| 134 | ATR-24 | CGP-02C.5 | `29972a37b50b9afb` | PASS | Present | — | PASS |
| 135 | DGI-01 | CGP-02C.6 | `c96409e8dd578477` | PASS | Present | — | PASS |
| 136 | DGI-02 | CGP-02C.6 | `985392922dbd1f31` | PASS | Present | — | PASS |
| 137 | DGI-03 | CGP-02C.6 | `e312892e92bf07bc` | PASS | Present | — | PASS |
| 138 | DGI-04 | CGP-02C.6 | `890fd13f8e692dec` | PASS | Present | — | PASS |
| 139 | DGI-05 | CGP-02C.6 | `f35d0ed4eb92a885` | PASS | Present | — | PASS |
| 140 | DGI-06 | CGP-02C.6 | `50cd23ffa94fc303` | PASS | Present | — | PASS |
| 141 | DGI-07 | CGP-02C.6 | `3a73af96f2ee4992` | PASS | Present | — | PASS |
| 142 | DGI-08 | CGP-02C.6 | `dbcbdbe05c15fba2` | PASS | Present | — | PASS |
| 143 | DGI-09 | CGP-02C.6 | `c86c414bce0979ce` | PASS | Present | — | PASS |
| 144 | DGI-10 | CGP-02C.6 | `76e5bc22a11faec5` | PASS | Present | — | PASS |
| 145 | DGI-11 | CGP-02C.6 | `89f04ae1cb62abfd` | PASS | Present | — | PASS |
| 146 | DGI-12 | CGP-02C.6 | `3fb9ef13871e7790` | PASS | Present | — | PASS |
| 147 | DGI-13 | CGP-02C.6 | `78284b2e47ecd67a` | PASS | Present | — | PASS |
| 148 | DGI-14 | CGP-02C.6 | `670ed9bf6b602ac8` | PASS | Present | — | PASS |
| 149 | DGI-15 | CGP-02C.6 | `592b6bc1c28bcc30` | PASS | Present | — | PASS |
| 150 | DGI-16 | CGP-02C.6 | `0a3e7f06f0b40e52` | PASS | Present | — | PASS |
| 151 | DGI-17 | CGP-02C.6 | `ac2a0a14e880cbc7` | PASS | Present | — | PASS |
| 152 | DGI-18 | CGP-02C.6 | `ecb236236b346ddf` | PASS | Present | — | PASS |
| 153 | DGI-19 | CGP-02C.6 | `1560115d0322f467` | PASS | Present | — | PASS |
| 154 | DGI-20 | CGP-02C.6 | `8364d491fe1cd9f2` | PASS | Present | — | PASS |
| 155 | DGI-21 | CGP-02C.6 | `cffc3edec73ca722` | PASS | Present | — | PASS |
| 156 | DGI-22 | CGP-02C.6 | `7db13937998e8ebc` | PASS | Present | — | PASS |
| 157 | DGI-23 | CGP-02C.6 | `c411ffc33274e67e` | PASS | Present | — | PASS |
| 158 | DGI-24 | CGP-02C.6 | `051d7ffdd6902db2` | PASS | Present | — | PASS |
| 159 | CRE-01 | CGP-02C.7 | `154a4b7c6b904b75` | PASS | Present | — | PASS |
| 160 | CRE-02 | CGP-02C.7 | `3b0e8d0d6949b51e` | PASS | Present | — | PASS |
| 161 | CRE-03 | CGP-02C.7 | `4760cba3d047c4a1` | PASS | Present | — | PASS |
| 162 | CRE-04 | CGP-02C.7 | `17457cea5ef13fc3` | PASS | Present | — | PASS |
| 163 | CRE-05 | CGP-02C.7 | `c497f2f3c212a74c` | PASS | Present | — | PASS |
| 164 | CRE-06 | CGP-02C.7 | `e565ddea31e9aeef` | PASS | Present | — | PASS |
| 165 | CRE-07 | CGP-02C.7 | `4884ea1f8fd871c5` | PASS | Present | — | PASS |
| 166 | CRE-08 | CGP-02C.7 | `220ee0b06cccc0c5` | PASS | Present | — | PASS |
| 167 | CRE-09 | CGP-02C.7 | `9a643524d5206379` | PASS | Present | — | PASS |
| 168 | CRE-10 | CGP-02C.7 | `84dfb49b47a735c7` | PASS | Present | — | PASS |
| 169 | CRE-11 | CGP-02C.7 | `947474017106bc50` | PASS | Present | — | PASS |
| 170 | CRE-12 | CGP-02C.7 | `b802053d65de7280` | PASS | Present | — | PASS |
| 171 | CRE-13 | CGP-02C.7 | `7c50ce09d2a58153` | PASS | Present | — | PASS |
| 172 | CRE-14 | CGP-02C.7 | `ebc2b395a0ed4bb9` | PASS | Present | — | PASS |
| 173 | CRE-15 | CGP-02C.7 | `832ee9f088c799d5` | PASS | Present | — | PASS |
| 174 | CRE-16 | CGP-02C.7 | `ae3a8222d1bd22af` | PASS | Present | — | PASS |
| 175 | CRE-17 | CGP-02C.7 | `48ac7201e278cbb3` | PASS | Present | — | PASS |
| 176 | CRE-18 | CGP-02C.7 | `21d728ac5d822bb8` | PASS | Present | — | PASS |
| 177 | CRE-19 | CGP-02C.7 | `dfd8b4dd2e7b4d2f` | PASS | Present | — | PASS |
| 178 | CRE-20 | CGP-02C.7 | `317e74e154a35616` | PASS | Present | — | PASS |
| 179 | CRE-21 | CGP-02C.7 | `ea5eed861bcbe9d3` | PASS | Present | — | PASS |
| 180 | CRE-22 | CGP-02C.7 | `80045d1020e1e701` | PASS | Present | — | PASS |
| 181 | CRE-23 | CGP-02C.7 | `0fe3f672b4545f3f` | PASS | Present | — | PASS |
| 182 | CRE-24 | CGP-02C.7 | `4ebbd59a71147412` | PASS | Present | — | PASS |
| 183 | SSR-01 | CGP-02C.8 | `36d1164578b91ad5` | PASS | Present | — | PASS |
| 184 | SSR-02 | CGP-02C.8 | `aafc5c24ac8a492e` | PASS | Present | — | PASS |
| 185 | SSR-03 | CGP-02C.8 | `fa643f52650bc8d6` | PASS | Present | — | PASS |
| 186 | SSR-04 | CGP-02C.8 | `1c01b732b2ff90f8` | PASS | Present | — | PASS |
| 187 | SSR-05 | CGP-02C.8 | `237d2cb13075a825` | PASS | Present | — | PASS |
| 188 | SSR-06 | CGP-02C.8 | `f1b832dcfb630940` | PASS | Present | — | PASS |
| 189 | SSR-07 | CGP-02C.8 | `41a4c27034d378fe` | PASS | Present | — | PASS |
| 190 | SSR-08 | CGP-02C.8 | `7c8b2780796ccd2a` | PASS | Present | — | PASS |
| 191 | SSR-09 | CGP-02C.8 | `eef0bad4cc34333d` | PASS | Present | — | PASS |
| 192 | SSR-10 | CGP-02C.8 | `10573fe9fbdd9528` | PASS | Present | — | PASS |
| 193 | SSR-11 | CGP-02C.8 | `695f5a08c438e318` | PASS | Present | — | PASS |
| 194 | SSR-12 | CGP-02C.8 | `ba49bee6c53ecaa4` | PASS | Present | — | PASS |
| 195 | SSR-13 | CGP-02C.8 | `343ca96476fdcbc8` | PASS | Present | — | PASS |
| 196 | SSR-14 | CGP-02C.8 | `27bf7dd8ea12dd15` | PASS | Present | — | PASS |
| 197 | SSR-15 | CGP-02C.8 | `24548cec18be13c0` | PASS | Present | — | PASS |
| 198 | SSR-16 | CGP-02C.8 | `8e123277e575bd0e` | PASS | Present | — | PASS |
| 199 | SSR-17 | CGP-02C.8 | `5c2f32949b099acc` | PASS | Present | — | PASS |
| 200 | SSR-18 | CGP-02C.8 | `f417216fa13f4050` | PASS | Present | — | PASS |
| 201 | SSR-19 | CGP-02C.8 | `27c74a759885ebf2` | PASS | Present | — | PASS |
| 202 | SSR-20 | CGP-02C.8 | `070c098b6229741a` | PASS | Present | — | PASS |
| 203 | SSR-21 | CGP-02C.8 | `1776f3e2095c5d2f` | PASS | Present | — | PASS |
| 204 | SSR-22 | CGP-02C.8 | `a678388e961c5b1b` | PASS | Present | — | PASS |
| 205 | SSR-23 | CGP-02C.8 | `8de640819d008d97` | PASS | Present | — | PASS |
| 206 | SSR-24 | CGP-02C.8 | `11af2dae7ba40b0c` | PASS | Present | — | PASS |
| 207 | RWR-01 | CGP-02C.9 | `693224b2ad71aec3` | PASS | Present | — | PASS |
| 208 | RWR-02 | CGP-02C.9 | `7dd2062495bb48d8` | PASS | Present | — | PASS |
| 209 | RWR-03 | CGP-02C.9 | `a6f0f6828bb5b871` | PASS | Present | — | PASS |
| 210 | RWR-04 | CGP-02C.9 | `a0085ae6ba5513c3` | PASS | Present | — | PASS |
| 211 | RWR-05 | CGP-02C.9 | `535a9211b02d143b` | PASS | Present | — | PASS |
| 212 | RWR-06 | CGP-02C.9 | `ae68e72ec1166944` | PASS | Present | — | PASS |
| 213 | RWR-07 | CGP-02C.9 | `ea14ae97b28c9615` | PASS | Present | — | PASS |
| 214 | RWR-08 | CGP-02C.9 | `cbf76c05dde7c300` | PASS | Present | — | PASS |
| 215 | RWR-09 | CGP-02C.9 | `4164459c9c3fe4f9` | PASS | Present | — | PASS |
| 216 | RWR-10 | CGP-02C.9 | `1f8e3893a6d45652` | PASS | Present | — | PASS |
| 217 | RWR-11 | CGP-02C.9 | `15f9d50b21c29d90` | PASS | Present | — | PASS |
| 218 | RWR-12 | CGP-02C.9 | `124e7c0e0ac3139b` | PASS | Present | — | PASS |
| 219 | RWR-13 | CGP-02C.9 | `a3bddcb3f8f24b16` | PASS | Present | — | PASS |
| 220 | RWR-14 | CGP-02C.9 | `311ddc9a25f27135` | PASS | Present | — | PASS |
| 221 | RWR-15 | CGP-02C.9 | `e826cd6e1be06dfa` | PASS | Present | — | PASS |
| 222 | RWR-16 | CGP-02C.9 | `92ce38acdc0c4483` | PASS | Present | — | PASS |
| 223 | RWR-17 | CGP-02C.9 | `4290802570634e79` | PASS | Present | — | PASS |
| 224 | RWR-18 | CGP-02C.9 | `ea0269947849c6be` | PASS | Present | — | PASS |
| 225 | RWR-19 | CGP-02C.9 | `5c1aac41f03f3ef3` | PASS | Present | — | PASS |
| 226 | RWR-20 | CGP-02C.9 | `865a5fe4f2264db7` | PASS | Present | — | PASS |
| 227 | RWR-21 | CGP-02C.9 | `c9f9a0e873353411` | PASS | Present | — | PASS |
| 228 | RWR-22 | CGP-02C.9 | `3271b3c61668452c` | PASS | Present | — | PASS |
| 229 | RWR-23 | CGP-02C.9 | `49b127c2552e0ac2` | PASS | Present | — | PASS |
| 230 | RWR-24 | CGP-02C.9 | `4adb25d70e1cbfd2` | PASS | Present | — | PASS |
| 231 | HPR-01 | CGP-02C.10 | `857dacbf377bf1b6` | PASS | Present | DQ-10 | PASS |
| 232 | HPR-02 | CGP-02C.10 | `4ff725186aa8dc89` | PASS | Present | DQ-10 | PASS |
| 233 | HPR-03 | CGP-02C.10 | `fa79f99ec60f750e` | PASS | Present | DQ-10 | PASS |
| 234 | HPR-04 | CGP-02C.10 | `5a31d948a19fe64d` | PASS | Present | DQ-10 | PASS |
| 235 | HPR-05 | CGP-02C.10 | `bd179369119eb08a` | PASS | Present | DQ-10 | PASS |
| 236 | HPR-06 | CGP-02C.10 | `092c13d39d606d79` | PASS | Present | DQ-10 | PASS |
| 237 | HPR-07 | CGP-02C.10 | `87ebd5d24a3e5af8` | PASS | Present | DQ-10 | PASS |
| 238 | HPR-08 | CGP-02C.10 | `a9a8769ab0b69eb8` | PASS | Present | DQ-10 | PASS |
| 239 | HPR-09 | CGP-02C.10 | `35326a17220e0672` | PASS | Present | DQ-10 | PASS |
| 240 | HPR-10 | CGP-02C.10 | `0b383ce0322c1c5e` | PASS | Present | DQ-10 | PASS |
| 241 | HPR-11 | CGP-02C.10 | `1ea824d6d6bb2e31` | PASS | Present | DQ-10 | PASS |
| 242 | HPR-12 | CGP-02C.10 | `e94b64a6945be369` | PASS | Present | DQ-10 | PASS |
| 243 | HPR-13 | CGP-02C.10 | `c5a0057b26b76a62` | PASS | Present | DQ-10 | PASS |
| 244 | HPR-14 | CGP-02C.10 | `afbe44e29adfb22e` | PASS | Present | DQ-10 | PASS |
| 245 | HPR-15 | CGP-02C.10 | `f7a6b3b19a8c8f68` | PASS | Present | DQ-10 | PASS |
| 246 | HPR-16 | CGP-02C.10 | `c116e875099a4505` | PASS | Present | DQ-10 | PASS |
| 247 | HPR-17 | CGP-02C.10 | `5d4ee261b30aa826` | PASS | Present | DQ-10 | PASS |
| 248 | HPR-18 | CGP-02C.10 | `7f400963f58f020d` | PASS | Present | DQ-10 | PASS |
| 249 | HPR-19 | CGP-02C.10 | `979b287c627b425c` | PASS | Present | DQ-10 | PASS |
| 250 | HPR-20 | CGP-02C.10 | `23280b996713a9cd` | PASS | Present | DQ-10 | PASS |
| 251 | HPR-21 | CGP-02C.10 | `87ed37f4e6e81c51` | PASS | Present | DQ-10 | PASS |
| 252 | HPR-22 | CGP-02C.10 | `c10d3512d838067b` | PASS | Present | DQ-10 | PASS |
| 253 | HPR-23 | CGP-02C.10 | `3db0f749205bfad3` | PASS | Present | DQ-10 | PASS |
| 254 | HPR-24 | CGP-02C.10 | `b9a67ce604db106d` | PASS | Present | DQ-10 | PASS |
| 255 | GSI-01 | CGP-02C.11 | `ec863df6a1fa81d4` | PASS | Present | DQ-09 | PASS |
| 256 | GSI-02 | CGP-02C.11 | `377de618dcd4bac2` | PASS | Present | DQ-09 | PASS |
| 257 | GSI-03 | CGP-02C.11 | `8092d38d8eecd7f6` | PASS | Present | DQ-09 | PASS |
| 258 | GSI-04 | CGP-02C.11 | `d53b661cfd9a6dff` | PASS | Present | DQ-09 | PASS |
| 259 | GSI-05 | CGP-02C.11 | `1b3d870da80dd13b` | PASS | Present | DQ-09 | PASS |
| 260 | GSI-06 | CGP-02C.11 | `3028759bad8cee08` | PASS | Present | DQ-09 | PASS |
| 261 | GSI-07 | CGP-02C.11 | `fd1f28c36e6569b7` | PASS | Present | DQ-09 | PASS |
| 262 | GSI-08 | CGP-02C.11 | `37d854d63028fed9` | PASS | Present | DQ-09 | PASS |
| 263 | GSI-09 | CGP-02C.11 | `7b50b01c3035ac54` | PASS | Present | DQ-09 | PASS |
| 264 | GSI-10 | CGP-02C.11 | `f83a52dc4bb1142c` | PASS | Present | DQ-09 | PASS |
| 265 | GSI-11 | CGP-02C.11 | `eefa5737836856d2` | PASS | Present | DQ-09 | PASS |
| 266 | GSI-12 | CGP-02C.11 | `d59e49da21665225` | PASS | Present | DQ-09 | PASS |
| 267 | GSI-13 | CGP-02C.11 | `8fa400d63dcb9836` | PASS | Present | DQ-09 | PASS |
| 268 | GSI-14 | CGP-02C.11 | `16bec5d676e33d5b` | PASS | Present | DQ-09 | PASS |
| 269 | GSI-15 | CGP-02C.11 | `2543882057ae071f` | PASS | Present | DQ-09 | PASS |
| 270 | GSI-16 | CGP-02C.11 | `7fa1fff6b7a829f3` | PASS | Present | DQ-09 | PASS |
| 271 | GSI-17 | CGP-02C.11 | `829f482a2c89703c` | PASS | Present | DQ-09 | PASS |
| 272 | GSI-18 | CGP-02C.11 | `c7f2c52c9f40b27c` | PASS | Present | DQ-09 | PASS |
| 273 | GSI-19 | CGP-02C.11 | `743cbcf50b792dca` | PASS | Present | DQ-09 | PASS |
| 274 | GSI-20 | CGP-02C.11 | `0e8faa93d2dc309c` | PASS | Present | DQ-09 | PASS |
| 275 | GSI-21 | CGP-02C.11 | `34dedd75a1889291` | PASS | Present | DQ-09 | PASS |
| 276 | GSI-22 | CGP-02C.11 | `29378c8835dd6796` | PASS | Present | DQ-09 | PASS |
| 277 | GSI-23 | CGP-02C.11 | `5d4d8e6a97113c10` | PASS | Present | DQ-09 | PASS |
| 278 | GSI-24 | CGP-02C.11 | `faca9c786f6c6b71` | PASS | Present | DQ-09 | PASS |
| 279 | VLR-01 | CGP-02C.12 | `4ed866e2f519da7e` | PASS | Present | — | PASS |
| 280 | VLR-02 | CGP-02C.12 | `84a374d517313de2` | PASS | Present | — | PASS |
| 281 | VLR-03 | CGP-02C.12 | `d3aa57886b2a395e` | PASS | Present | — | PASS |
| 282 | VLR-04 | CGP-02C.12 | `bafc26ab21cabf8d` | PASS | Present | — | PASS |
| 283 | VLR-05 | CGP-02C.12 | `17d14f01787e0184` | PASS | Present | — | PASS |
| 284 | VLR-06 | CGP-02C.12 | `4575f320c24f2cad` | PASS | Present | — | PASS |
| 285 | VLR-07 | CGP-02C.12 | `d394ea28b1ce3d4c` | PASS | Present | — | PASS |
| 286 | VLR-08 | CGP-02C.12 | `80af04c48518d3df` | PASS | Present | — | PASS |
| 287 | VLR-09 | CGP-02C.12 | `fa81baa8c2c3c618` | PASS | Present | — | PASS |
| 288 | VLR-10 | CGP-02C.12 | `32808385ee0df0ad` | PASS | Present | — | PASS |
| 289 | VLR-11 | CGP-02C.12 | `52c525a4175ef8a0` | PASS | Present | — | PASS |
| 290 | VLR-12 | CGP-02C.12 | `d7023e528196f571` | PASS | Present | — | PASS |
| 291 | VLR-13 | CGP-02C.12 | `b486b8242e61483e` | PASS | Present | — | PASS |
| 292 | VLR-14 | CGP-02C.12 | `257f2bad9c3d5940` | PASS | Present | — | PASS |
| 293 | VLR-15 | CGP-02C.12 | `4fde061fd42d8731` | PASS | Present | — | PASS |
| 294 | VLR-16 | CGP-02C.12 | `8bce879b56435423` | PASS | Present | — | PASS |
| 295 | VLR-17 | CGP-02C.12 | `ef54a135b2b445cf` | PASS | Present | — | PASS |
| 296 | VLR-18 | CGP-02C.12 | `b66bf1500f17b76d` | PASS | Present | — | PASS |
| 297 | VLR-19 | CGP-02C.12 | `918cb5e1e627a4be` | PASS | Present | — | PASS |
| 298 | VLR-20 | CGP-02C.12 | `aa09965921073983` | PASS | Present | — | PASS |
| 299 | VLR-21 | CGP-02C.12 | `086e97fb417ec521` | PASS | Present | — | PASS |
| 300 | VLR-22 | CGP-02C.12 | `9f7e370aa5797ef5` | PASS | Present | — | PASS |
| 301 | VLR-23 | CGP-02C.12 | `6a83b3a1e277b5e1` | PASS | Present | — | PASS |
| 302 | VLR-24 | CGP-02C.12 | `3f81f5d775eed3f3` | PASS | Present | — | PASS |
## 7. D17 Traceability Treatment

All nine D17 deferred constitutional matters remain visible and unresolved. Where D17 identifies a package-level association rather than a specific proposition, this report records that association at package level only, in the "D17 linkage" column above, and does not assert proposition-level causation the source evidence does not support.

| ID | Deferral authority (source) | Associated package(s) | Post-D-04 status |
| :--- | :--- | :--- | :--- |
| DQ-01 | C.2C RVQ-04 | CGP-02C.2C | Remains deferred |
| DQ-02 | C.2C | CGP-02C.2C | Remains deferred |
| DQ-04 | C.2B ACQ-04 / C.3 AQ-07 | CGP-02C.2B, CGP-02C.3 | Remains deferred |
| DQ-05 | C.2B ACQ-01 / ACQ-05 | CGP-02C.2B | Remains deferred |
| DQ-06 | C.2A / C.4 ACFQ-07 | CGP-02C.2A, CGP-02C.4 | Remains deferred — **expressly controlled before adoption/application/effect** |
| DQ-07 | C.2A LFQ-03 | CGP-02C.2A | Remains deferred — **expressly controlled before adoption/application/effect** |
| DQ-09 | C.11 GIQ-09 | CGP-02C.11 | Remains deferred |
| DQ-10 | C.10 HPQ-01 / HPQ-08 | CGP-02C.10 | Remains deferred |
| DQ-11 | C.3 AQ-05 | CGP-02C.3 | Remains deferred |

**Preserved D-02 control:** DQ-06 and DQ-07 may not be silently resolved by traceability verification, repository action, or inference. No adoption, application, or constitutional effect may be inferred or recorded until the Founder has expressly determined their required treatment. D-04 does not resolve, reclassify, close, promote or demote any D17 matter.

No D17 matter currently blocks D-04 completion or the later D-05/D-06 assurance steps.

## 8. Aggregate Reconciliation Results

| Check | Result |
| :--- | :--- |
| D-03 proposition count | 302 |
| Trace rows | 302 |
| Unique proposition IDs traced | 302 |
| D-03 ↔ V0 ID delta | 0 |
| D-03 ↔ V0 text delta | 0 |
| D-03 ↔ protected-source ID delta | 0 |
| D-03 ↔ protected-source text delta | 0 |
| Untraced propositions | 0 |
| Duplicate trace rows | 0 |
| Missing protected sources | 0 |
| Missing required decision evidence | 0 |
| Unsupported status upgrades | 0 |
| Unresolved traceability exceptions | 0 |
| Proposition-bearing packages represented | 14 of 14 |
| Protected sources accounted for | 17 of 17 |
| Package-level Founder Approved (package status) | CGP-02C.4 only |

## 9. Exceptions / Limitations

**Zero unresolved traceability exceptions were found.** All 302 propositions passed programmatic verification of source provenance, exact text integrity, package assignment, and decision-evidence presence.

**Scope limitation (not an exception):** this report verifies the *existence and correspondence* of decision-evidence files and their recorded status fields; it does not re-adjudicate the substantive correctness of those package-level Founder decisions, which were bounded and closed within their own C.1–C.12 work packages and are not reopened here.

## 10. D-04 Conclusion

Every proposition in the D-03 Whole-Standard Founder Approval Candidate can be reconstructed to its protected source file and attributable decision-evidence file without inventing authority, approval, adoption, application, or constitutional effect. All 302 propositions traced with zero unresolved exceptions.

**D-04 result: Traceability Complete — PASS.**

This is an assurance/evidence conclusion. It is not a Founder constitutional approval decision, and it does not itself advance CGP-02's approval, adoption, or constitutional-effect status.

## 11. Non-Effects

This report does **not**:

1. approve CGP-02;
2. amend any proposition;
3. adopt CGP-02;
4. establish application;
5. create constitutional effect;
6. resolve D17;
7. reopen CRA-001–045;
8. perform D-05 impact analysis;
9. perform D-06 validation;
10. prepare D-07;
11. execute the Founder Approval Decision Gate;
12. complete CGP-02D;
13. complete CGP-02;
14. complete Stage E0;
15. unblock CGP-03.

## 12. Next-Step Boundary

D-04 — Whole-Standard Proposition Traceability Report is **Complete — PASS**.

```text
D-01  Whole-Standard Founder Constitutional Review Package     [PREPARED]
D-02  Whole-Standard Founder Decision Record                   [COMPLETE]
D-03  CGP-02 Whole-Standard Founder Approval Candidate          [FOUNDER ACCEPTED 2026-08-29]
D-04  Whole-Standard Proposition Traceability Report            [COMPLETE — PASS; this document]
D-05  Whole-Standard Cross-Reference and Impact Analysis        [NOT STARTED]
D-06  Whole-Standard Validation Report                          [NOT STARTED]
D-07  CGP-02 Founder Approval Decision Package                  [NOT STARTED]
      [FOUNDER APPROVAL DECISION GATE — NOT TAKEN — separate attributable Founder decision]
D-08  CGP-02D Completion & Stage E0 Transition Report            [NOT STARTED]
```

D-05 — Whole-Standard Cross-Reference and Impact Analysis is the next authorized CGP-02D activity. It is not begun by this report.
