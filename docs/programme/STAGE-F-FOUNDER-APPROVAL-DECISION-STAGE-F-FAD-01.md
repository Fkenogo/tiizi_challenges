# STAGE-F-FAD-01 — Stage F Founder Approval Decision

## Document Control

| Field | Value |
| ----- | ----- |
| Programme | Tiizi Version 2 |
| Stage | Stage F — Product & Technical Translation |
| Document type | Attributable Founder Approval Decision Record |
| Decision identifier | STAGE-F-FAD-01 |
| Decision date | 2026-09-11 |
| Decision-maker | Founder (attributable) |
| Decision authority | Founder; EKG-01; EOG-E1-01; CGP-02/03/04 |
| Decision subject | Stage F V2 foundation package (T1, T2, CIC, KRC, TAM, KCS) |
| Disposition | **APPROVE WITH AMENDMENT** |
| Reviewed package | Branch `docs/stage-f-knowledge-content-closure-001`, amendment commit `4de80b4d7db35cbc7a1561f24dc7576db9b49922` |
| Status | **Founder Approved — see §2 (effective on merge of the reviewed package)** |

---

## 1. Decision Context

Stage F was assessed as structurally substantially complete
(TIIZI-V2-STAGE-F-FOUNDATION-ALIGNMENT-001), and the bounded
product-content gap was closed through the Knowledge Content
Specification annex with KRC/T2 publication-gate and localization
amendments (TIIZI-V2-STAGE-F-KNOWLEDGE-CONTENT-CLOSURE-001). The
Founder reviewed the package as a whole
(TIIZI-V2-STAGE-F-FOUNDER-REVIEW-PREP-001) and returned disposition:
approve with one specified amendment.

## 2. Founder Decision

The Founder determines:

**The Stage F V2 foundation package — T1 Product Definition, T2
Functional Requirements (through FR-V2-214), Canonical Information
Contract, Knowledge Runtime Contract, Technical Architecture Mapping,
and Knowledge Content Specification annex — is APPROVED as the Tiizi
V2 baseline to build from, subject to the single amendment in §3.**

**No other Stage F matter is reopened by this decision.**

## 3. Required Amendment (applied in the reviewed package)

Competitive shared-position ranking uses **competition-ranking
semantics (1, 2, 2, 4)**: the position after a tie is skipped, never
filled sequentially. Dense ranking and 1,1,3-style statements are
prohibited. Applied in T1 §§K.8, K.11, M.9; T2 FR-V2-101/198;
CIC Competitive 4.17; TAM competitive V2 target. All other
Competitive mechanics are unchanged: race-to-target, completion
order, no tie-breaker, no position for non-completers, progress
visible, never labelled failed, one finisher does not end the
Challenge, window close governs.

## 4. Approved Package

| # | Instrument | Path |
| - | ---------- | ---- |
| 1 | T1 Product Definition (DRAFT as amended) | `docs/programme/STAGE-F-TIIZI-V2-PRODUCT-DEFINITION-DRAFT.md` |
| 2 | T2 Functional Requirements (DRAFT through FR-V2-214) | `docs/programme/STAGE-F-TIIZI-V2-FUNCTIONAL-REQUIREMENTS-DRAFT.md` |
| 3 | Canonical Information Contract (DRAFT as amended) | `docs/programme/STAGE-F-TIIZI-V2-CANONICAL-INFORMATION-CONTRACT-DRAFT.md` |
| 4 | Knowledge Runtime Contract (DRAFT as amended) | `docs/programme/STAGE-F-TIIZI-V2-KNOWLEDGE-RUNTIME-CONTRACT-DRAFT.md` |
| 5 | Technical Architecture Mapping (DRAFT as amended) | `docs/programme/STAGE-F-TIIZI-V2-TECHNICAL-ARCHITECTURE-MAPPING-DRAFT.md` |
| 6 | Knowledge Content Specification (annex) | `docs/programme/STAGE-F-TIIZI-V2-KNOWLEDGE-CONTENT-SPECIFICATION.md` |

## 5. Preserved Deferrals (not resolved by this decision)

ACT-03 Verification Authority; ACT-04 Correction Authority; MOT-01
Recognition Authority; Rewards implementation/custody/entitlement;
118-Activity content production (gated per-Activity by lifecycle
state, first task: wellness exemplar); legal copy/disclaimers;
UI/presentation details; downstream schemas/APIs.

## 6. Effect and Next Boundary

Stage F is Founder Approved on the reviewed package. The decision
takes programme effect on merge of the reviewed branch. No separate
approval ceremony is required.

Stage G is the next stage: governance-to-code reconciliation of
current implementation against this approved foundation. No normal
feature implementation begins before that reconciliation. Carried
forward as Stage G alignment work: competitive 1,2,2,4 ranking,
single-log streak advance, collective 100% clamp, comments/replies
and streak leaderboard removal, knowledge lifecycle states, privacy
enforcement, and correction/audit behaviour subject to the ACT-04
boundary. Implementation is not changed by this record.
