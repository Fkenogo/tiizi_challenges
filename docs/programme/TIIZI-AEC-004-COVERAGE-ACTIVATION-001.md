# TIIZI — AEC-004 Temporary Coverage Activation Record

**Status:** ACTIVE — bounded coverage recorded under the existing AEC-003 activation process.
**Prepared:** 2026-11-18
**Authority:** Founder / Technical Lead, task AEC-004 "Integrated Founder Experience Recovery".
**Existing authority:** [AEC-001](./TIIZI-V2-APPROVED-EXPERIENCE-CONTINUITY-001.md) §3.1 (Code Lifecycle Guardian checkpoints), [AEC-003 Programme Controller proposal](./TIIZI-AEC-003-TEMPORARY-PROGRAMME-CONTROLLER-PROPOSAL.md), [AEC-003 Guardian proposal](./TIIZI-AEC-003-TEMPORARY-GUARDIAN-PROPOSAL.md), and [FEF-TLC-001](./TIIZI-FEF-TLC-001-TEAM-ACTIVATION.md) function definitions.
**Scope:** Temporary operating coverage for the AEC-004 integration candidate only. This record creates no new role, no product authority, and no merge, deployment or production authorization.

## 1. Why this record exists

AEC-003 left both the Programme Controller and the Code Lifecycle Guardian as `NOT ACTIVE` with `UNASSIGNED` assignees. AEC-001 §3.1 requires that until an attributable Guardian assignment and activation are recorded, every checkpoint (G1–G4) must be marked **UNVERIFIED — OWNER NOT ASSIGNED**, and that a coding agent may supply evidence but cannot certify its own work as an independent Guardian receipt.

AEC-004 therefore directs the Technical Lead to establish separate, attributable functions. This record is that activation decision, made under the AEC-003 process rather than as a parallel governance track.

## 2. Recorded assignments

### PC-1 — Programme Controller (temporary, bounded)

| Field | Value |
| --- | --- |
| Assignee | **PC-1 delegated session** — MiniMax Code sub-agent session `mvs_f9ea2109d03c4da99a232afab18e45d8` (task `bg_759ba119-75a1-4355-90f0-d42a2f5b0d7c`, role `worker`) |
| Assigning authority | Founder / Technical Lead, AEC-004 task instruction |
| Effective from | 2026-11-18 |
| Scope | Confirm accepted UX sources and their exact SHAs; maintain the accepted-but-unmerged inventory; track integration and closure status; preserve Founder decisions and their dates. |
| Deliverable | `docs/programme/TIIZI-AEC-004-ACCEPTED-INVENTORY-001.md` |
| Limits | No product acceptance, no source supersession, no implementation authorization, no merge, no deployment, no production authority. Must not describe a fixture-only prototype as connected functionality. Must not mark anything `DEPLOYED`. |
| Independence | Not an implementation role. PC-1 does not author candidate code and does not certify its own integration. |
| Expiry | On delivery of the AEC-004 completion report, or on explicit revocation by the Founder / Technical Lead, whichever occurs first. Extension requires a new recorded decision. |
| Activation status | **ACTIVE** — assignment and receipt exist. |

### CG-1 — Code Lifecycle Guardian (temporary, bounded)

| Field | Value |
| --- | --- |
| Assignee | **CG-1 delegated session** — MiniMax Code sub-agent session `mvs_fdd3933c49f945d5bfae63ec7d41bac7` (task `bg_87137a5e-9f1d-475b-8496-be653230ddb2`, role `verifier`, read-only) |
| Assigning authority | Founder / Technical Lead, AEC-004 task instruction |
| Effective from | 2026-11-18 |
| Scope | G1 — verify integration baseline, accepted-source ancestry and preservation, PR ancestry, runtime identity, known gaps and a valid start point, before implementation. G2 — verify exact integrated-preview identity and accepted-journey presence, before the Founder walkthrough. G3 and G4 remain `UNVERIFIED — OWNER NOT ASSIGNED` and are not activated by this record. |
| Independence | **Confirmed.** The Guardian session is a distinct read-only session and is not the implementation agent for the AEC-004 candidate. The AEC-003 Guardian proposal requires the verifier not be the implementation agent for the work assessed. |
| Required receipts | At each checkpoint: fetched `origin/main` SHA and fetch time, candidate/PR SHA, accepted source SHAs and evidence references, relevant PR numbers and exact heads, runtime identity (or `UNKNOWN`), missing functionality, and a continuity verdict. |
| Limits | No product acceptance, no merge authority, no deployment authority. |
| Expiry | At G2 closeout for the first integrated AEC-004 candidate, or on explicit revocation, whichever occurs first. G3/G4 require a separate recorded decision. |
| Activation status | **ACTIVE** — assignment and receipt exist. |

## 3. Independent Code Reviewer

The independent Code Reviewer required by AEC-001 §7 and FEF-TLC-001 is a **separate applicable control** from CG-1 and is not satisfied by this record. Its assignment must be recorded separately at the point of review, against the exact candidate head.

## 4. Consequences of this activation

- G1 and G2 may be reported as Guardian checkpoints once their receipts exist. Until a receipt exists, the checkpoint remains `UNVERIFIED — OWNER NOT ASSIGNED`.
- The Coding Agent implementing the AEC-004 candidate may not self-certify G1 or G2, and may not self-certify the independent code review.
- If either delegated session fails to produce its receipt, affected implementation stops and the limitation is returned to the Founder rather than self-certified.

## 5. Boundaries carried forward

No production deployment, feature expansion, migration, merge of PR #150 or PR #171, or cleanup of preserved branches is authorized by this record or by AEC-004. Preserved accepted sources (`codex/tiizi-pfd-activity-visibility-003` @ `e2aee9239d42e6f92a66c22e4fcbbb97595c9521`, `codex/tiizi-pfd-group-cards-001` @ `2f065546dd7051b5c6401e52da897b8c82d6cc93`, PR #150 @ `3aa0147d558eeba8371cd4cccffcbbc2326dd02f`, PR #171 @ `7ebe03ba5ffaeed5c21b109137a94c7630b18e8c`) remain protected until their behaviour is verified on merged `main`.
