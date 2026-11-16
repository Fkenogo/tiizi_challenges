# TIIZI — Approved Experience Continuity & Integration Procedure (AEC-001)

**Status:** ADOPTED / EFFECTIVE — Founder-approved merge in PR #172, merge commit `1786a465d3c0f10944b181188b90d18d16f04a2e` (2026-11-16). This document records the adopted procedure; any later amendment requires its own approval and merge.
**Prepared:** 2026-11-16
**Authority:** Founder direction to preserve accepted V2 product experience, applied under current Master Programme, AGENTS.md, FEF-TLC-001 and ECCL-005 / START-01 / PRG-01 / HOV-01.
**Scope:** V2 product experience continuity, development integration, local Founder Preview and merge assurance. No production deployment, V1 reuse, autonomous merge authority, or modification of existing constitutional/product-truth rules.
**Companion:** [Accepted Experience Register](./TIIZI-V2-ACCEPTED-EXPERIENCE-REGISTER-001.md).

## 1. Why this exists

Founder-accepted experience has existed in unmerged or divergent preview branches while later integrated previews were built from `main`. CI green, R1 PASS, accepted screenshots, and merged code were treated as interchangeable evidence. They are not. The resulting regression can be *missing integration*, even when no code was deleted.

This procedure adds a small, explicit evidence and integration contract to the existing lifecycle process; it is **not** a replacement lifecycle framework or independent product authority.

## 2. One canonical integration baseline, with separately protected accepted work

- `origin/main` is the canonical **merged engineering** baseline, not automatically the full accepted-product baseline.
- The **Accepted Experience Register** records Founder-approved behavior and its exact most recent accepted source SHA, including accepted work **not yet merged**. That evidence remains binding for reconciliation unless expressly superseded by a later Founder decision.
- A *latest product candidate* is a **specific integrated branch SHA** assembled from freshly fetched `origin/main` and the relevant latest accepted work. It becomes the new canonical merged baseline only by normal, approved PR merge.
- No agent may declare an older branch, PR, local worktree, screenshot, or unverified Vite overlay the latest product merely because it looks newer.
- Preserve approved isolated branches until their behavior is verified on merged `main`. Do not wholesale merge stale divergent worktrees; transplant bounded accepted behavior onto fresh `main` and compare it against the preserved source.

## 3. Mandatory START-01 before every task and resumed task

The Technical Lead ensures a START-01 receipt is collected **before coding**; repeat after a changed PR head, branch/worktree handoff, or new upstream merge. Agent must:

1. Safely fetch remote `main` without modifying the dirty primary checkout. Report exact fetched SHA, working branch/head, merge-base, dirty state and open/stacked PRs.
2. Read `AGENTS.md`, current Master Programme, relevant approved product decisions and register IDs; invoke `node scripts/prg01LocalReconciliation.mjs` as *informational* evidence only.
3. For every affected surface, identify latest accepted source SHA, file/routes, fixture-versus-connected state, and whether it is already merged or protected in an open PR / archived branch.
4. Trace actual runtime entrypoints and imports. Verify which SHA **and dirty overlay** the preview process serves, the API source, database identifier, fixture version, and whether the preview is immutable/reproducible.
5. State **START FROM** (fresh `main` plus listed accepted behavior) and **DO NOT START FROM** (stale or superseded source); classify each unknown/conflict.
6. Give a PASS / PASS WITH EXPLICIT LIMITATIONS / STOP result. Conflicted acceptance ancestry or unverified preview identity blocks affected integration/acceptance; it does not authorize replacement with old behavior.

The agent may not use an old SHA printed in a previous handover as current `main` without refetching.

### 3.1 Independent Code Lifecycle Guardian checkpoints

The Code Lifecycle Guardian is a **continuity-verification function**, not a coding-agent self-review and not the same function as the independent Code Reviewer. FEF-TLC-001 defines distinct functions but does not establish a permanent Guardian appointment. The four checks below are required by this adopted procedure; until an attributable Guardian assignment/activation is recorded, each checkpoint must be marked **UNVERIFIED — OWNER NOT ASSIGNED**. A coding agent may supply evidence but cannot certify its own work as an independent Guardian receipt. The Technical Lead/Founder must record a bounded temporary verifier and activation decision before relying on any such checkpoint as a completed gate.

| Checkpoint | Timing | Required continuity decision |
| --- | --- | --- |
| G1 — Task entry | Before implementation or resumed work | Confirm fresh main, accepted-source inventory, PR ancestry, runtime identity, known gaps and valid start point. |
| G2 — Integrated-preview preparation | Before Founder/acceptance walkthrough of an integrated candidate | Confirm candidate includes the intended accepted sources, identify exact served code/API/data/fixture identity and enumerate missing journeys. |
| G3 — Pre-merge reconciliation | After exact-head independent code review and before merge recommendation | Compare candidate and accepted-source ancestry/behavior against current main; enumerate omissions, supersessions, relevant PRs, CI/review and unresolved gaps. |
| G4 — Post-merge reconciliation | After merge, with a fresh fetch of main | Verify accepted-source ancestry and behavior in the merged tree, exact post-merge preview identity and closure evidence; reopen the queue for any failure. |

Each receipt must give the exact `origin/main` SHA fetched for that checkpoint (and fetch time), candidate/PR SHA, accepted source SHAs and evidence references, relevant PR numbers and exact heads, runtime identity (or `UNKNOWN`), missing functionality, and a continuity verdict. A SHA alone is not runtime identity: record frontend/server revision, dirty overlay, database/fixture identity and preview URL/process where applicable.

## 4. Founder acceptance is a preservation event, not just a screenshot

At each explicit Founder UX acceptance, the Technical Lead instructs the Programme Controller to update the register through a bounded PR or the same implementation PR. Each entry records:
- stable feature ID / journey, acceptance date and primary evidence (decision, screenshot reference, review record);
- exact accepted source SHA, branch and relevant paths, including the route and runtime linkage;
- accepted UX versus *fixture-only preview* versus *server-connected behavior*, with unknowns explicit;
- independent statuses: **ACCEPTED, IMPLEMENTED, TESTED, MERGED, PREVIEW VERIFIED, DEPLOYED** (each yes/no/unknown with evidence);
- present integration PR and last verified merged-main SHA;
- later Founder supersession if any; unresolved behavior and next action.

When the Founder gives acceptance or a walkthrough decision in a conversation, the Programme Controller must preserve a durable, dated decision record with the exact accepted/rejected journeys and stated defects before closing the associated UX review. The register must distinguish **direct Founder-supplied evidence** (including the conversation and date), **repository-filed acceptance evidence** (a durable decision/handover path and revision, if one exists), and **verified preview/runtime identity** (exact served frontend/API source, overlay, data/fixture identity and URL/process). One category never substitutes for another. If no filed record or runtime identity exists yet, record `NOT YET FILED` or `UNKNOWN`; do not invent a document, commit or SHA. Until the durable decision record is filed, the acceptance is preserved as direct evidence but the UX review remains open.

A closed UX review with unmerged work must be recorded as **ACCEPTED / INTEGRATION OPEN**. Its branch and accepted source are preserved, and integration stays in the delivery queue. An approved screen is not declared delivered or production-ready merely because the Founder accepted its visuals.

If source is local-only, first preserve it by an authorized commit and durable remote ref or verified archive; a local disk copy is not sufficient long-term protection.

## 5. Integration queue and merge discipline

Before starting a later UI package:
1. Programme Controller lists all **ACCEPTED / NOT MERGED** entries that affect the same surface.
2. Technical Lead chooses a small dependency-ordered integration sequence and confirms authority for each package. Protect the accepted source separately.
3. Coding Agent starts from fresh `main` in an isolated clean worktree; compares all affected accepted snapshots, preserving current merged features.
4. Agent opens a **Draft PR** listing register IDs, accepted-source SHAs, accepted behavior preserved, anything intentionally omitted, and any Founder-approved supersession. Existing PRs are not silently closed as obsolete.
5. Do not start dependent UX work from a different divergent preview branch. If other work can proceed independently, it must retain a distinct worktree and PR.
6. Integration PR cannot be designated ready just because its own tests pass. It must compare against *all* registered accepted behavior touching those routes.
7. After acceptance, verify latest `main`, PR exact head and mergeability, required CI, independent R1 on the exact head, no unresolved threads, and explicit Founder merge authorization. Normal merge only.
8. After merge, refresh `origin/main` and confirm accepted source ancestry/behavior in the merged tree. Run a disposable Founder Preview **from the post-merge SHA** and run an accepted-journey smoke matrix. Mark MERGED and PREVIEW VERIFIED independently; if smoke fails, reopen integration rather than claim closure.
9. Transfer accepted open entries to the next package; do not delete source references or prune worktrees until preservation is proved.

**No auto-merge, force-push, production deployment or database publishing is authorized by this procedure.**

## 6. Reviewer regression proof and minimal automation

The independent reviewer reports (on exact head):
- changed routes/components compared to accepted-source evidence;
- whether buttons, destinations, states, content and access gates from the accepted journey still exist;
- any removed/changed accepted behavior and a *specific later Founder supersession* or a STOP;
- whether tests cover newcomer Today, public Group → outsider Challenge preview, separate joins, active-member Today, activity logging, recent-activity timeline, and private-by-default sharing where relevant.

Introduce a **non-gating** PR checklist/report first; only propose a blocking CI guard in a separately approved change after assessing false positives and the six existing CI jobs. Automated checks supplement, not replace, the Founder browser walkthrough.

## 7. Responsibilities, role activation and handoff

| Accountable role | Required artifact |
| --- | --- |
| Founder | Accepts/rejects behavior and authorizes supersessions and normal merges |
| Technical Lead | Reconciles start point; approves integration sequence; checks preview fidelity and merge readiness |
| Programme Controller | Maintains Master Programme status and register; tracks **ACCEPTED / NOT MERGED** queue |
| Architecture & Decision Controller | Validates latest decisions and supersession; prevents accidental privacy/authority changes |
| Code Lifecycle Guardian (continuity-verification function) | Independently verifies source, ancestry, active runtime, accepted behavior and variance at G1–G4; records a receipt or explicit unassigned status |
| Coding Agent | Implements narrow changes only after START-01; provides HOV-01 and test evidence |
| Independent Reviewer / Code Reviewer | Separately checks the exact candidate for code quality, authorization and accepted-journey regressions; cannot be the implementer reviewing their own work |

The Programme Controller maintains the source-of-truth operational ledger (or records the assignment gap until appointed):

- Founder acceptance records with dates, exact evidence and accepted sources;
- this Approved Experience Register and its versioned updates;
- the accepted-but-unmerged integration queue;
- implementation, test, preview, PR, merge and deployment state as separate evidence-backed fields;
- explicit Founder supersession records, retaining the superseded decision/source pointer; and
- post-merge closure evidence, including G4 receipt, exact merged baseline, affected journey results and remaining queue.

Before declaring any work package closed, the Programme Controller must reconcile each affected register entry against its evidence and current main and publish/update the queue disposition. If no Programme Controller is assigned, closure remains **OPEN — CONTROLLER RECONCILIATION UNVERIFIED**; the person compiling an update must not silently certify it as the Programme Controller.

### Verified activation status

FEF-TLC-001 is an adopted role-separation authority, not evidence that each operating seat is filled. Current attributable records identify ChatGPT as performing the Technical Lead function under Founder direction, while the required Technical Lead current-state/step-2 activation confirmation remains unrecorded. Programme Controller and Architecture & Decision Controller assignments are unverified. No permanent Code Lifecycle Guardian appointment is established in FEF-TLC-001 or the reviewed activation records. A standing independent reviewer is also unverified. The Coding Agent is a task function, not a permanent person assignment. In the present recovery, the Coding Agent performed source comparison and documentation edits; no independent Guardian review or PR review is claimed. Record any subsequent named/temporary assignment, scope, activation date and evidence before describing that role as active.

Where the Guardian or Programme Controller is unassigned, record the missing owner and activation evidence, name only the function currently performed and by whom (if attributable), and mark the relevant verification **UNVERIFIED**. For this AEC-001 correction, the coding-agent function is performed by the current agent; the Technical Lead function is attributed to ChatGPT by Founder direction; no Guardian or Programme Controller is verified as performing its function. This draft update is evidence collection, not Controller certification or Guardian sign-off. Escalate to Technical Lead/Founder for assignment or explicit bounded temporary coverage before treating the check as a mandatory completed gate. Do not silently transfer independence to the coding agent.

### Mandatory integration handoff

1. Programme Controller supplies the accepted-work inventory: Founder evidence, exact sources, status by dimension, current PR/merge state, supersessions and open queue.
2. Guardian independently verifies source ancestry and preservation, or records the checkpoint unverified and escalates the assignment gap.
3. Technical Lead authorizes a bounded integration task and its starting baseline.
4. Coding Agent implements only that authorized scope and supplies change/test/runtime evidence.
5. Independent Reviewer checks the exact candidate SHA.
6. Founder accepts the experience and separately authorizes merge; acceptance is not merge authorization unless explicitly stated.
7. Guardian verifies the post-merge baseline and preview at G4.
8. Programme Controller records final status, closure evidence, and any outstanding/unmerged queue items. A work package is not closed until this reconciliation is explicit.

## 8. Required checkpoint receipts

Use the shared receipt below at G1–G4. The responsible independent Guardian completes the verdict fields. If unassigned, retain the receipt with `UNVERIFIED — OWNER NOT ASSIGNED`; evidence submitted by the Coding Agent is labeled self-reported and does not satisfy independent verification.

```text
TASK / AUTHORITY:
CHECKPOINT (G1/G2/G3/G4) + TIME:
VERIFIER / ASSIGNMENT EVIDENCE / INDEPENDENCE:
CURRENT origin/main SHA (fetched at):
CANDIDATE BRANCH / EXACT HEAD / MERGE-BASE / DIRTY STATE:
ACCEPTED SOURCES (IDs, evidence, exact SHAs, branches/paths):
RELEVANT OPEN/STACKED PRs (numbers, exact heads, state):
RUNTIME IDENTITY (URL/process, frontend/API SHA, dirty overlay, DB/fixture):
MISSING FUNCTIONALITY / ACCESS OR JOURNEY GAPS:
CONTINUITY VERDICT (preserved / conflict / unknown + evidence):
IMPLEMENTATION STATUS (accepted / implemented / tested / merged / preview-verified / deployed separately):
CI + exact-head independent Code Reviewer evidence:
QUEUE / NEXT OWNER / REQUIRED FOUNDER OR TECHNICAL LEAD DECISION:
GUARDIAN RESULT: VERIFIED PASS | VERIFIED WITH LIMITATIONS | STOP | UNVERIFIED — OWNER NOT ASSIGNED
```

For G1, record `START FROM / DO NOT START FROM` and entry disposition. For G2, attach the proposed Founder-preview journey matrix and block acceptance claims where runtime identity is unknown. For G3, include exact-head independent review, required CI and unresolved threads. For G4, include merge commit, fresh main SHA, post-merge runtime identity and per-register-ID closure result. Unknown means UNKNOWN, not deferred, complete or removed. If accepted behavior is missing, recover/reconcile rather than redesign by default.

## 9. Tiizi recovery disposition at drafting date

Observed on 2026-11-16: `origin/main = ce477b0756129119c6ee93e99029984db35cecfc`; #171 Draft at `7ebe03ba5ffaeed5c21b109137a94c7630b18e8c`, #150 open at `3aa0147d558eeba8371cd4cccffcbbc2326dd02f`. These are **historical observations**, never permanent starting SHAs.

- **Hold #171** pending reconciliation with latest accepted Group/Today/PFD source and correction of public Group Home → Challenge outsider preview.
- Preserve accepted PFD source (`2f065546dd7051b5c6401e52da897b8c82d6cc93`, `38d7bf906e5ff5c91542be7c72bd34d98cd9e0b9`, `e2aee9239d42e6f92a66c22e4fcbbb97595c9521`). Do not merge stale source wholesale.
- Treat Recent Activity and post-log Share as **Founder-accepted UX / unmerged fixture prototype**, not completed connected features. Preserve them while the connected implementation is separately scoped.
- Retain merged Package A (PR #168) and merged #167 image/profile/card work; do not replay superseded #163.
- The current local preview artifact/source identity is UNKNOWN until measured.
- This procedure authorizes no PR #171 merge, production deployment, database changes or new B2 build.

## 10. Approval boundary

This is the adopted Tiizi implementation procedure under Founder-approved PR #172, merged as `1786a465d3c0f10944b181188b90d18d16f04a2e`. It does not replace the Master Programme, the central ECCL-005 contract, the current AGENTS.md, or Founder acceptance decisions. Its G1–G4 checkpoints remain in force; role assignment and activation are tracked separately and are not implied by adoption of this procedure.
