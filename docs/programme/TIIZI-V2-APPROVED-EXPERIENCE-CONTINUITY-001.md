# TIIZI — Approved Experience Continuity & Integration Procedure (AEC-001)

**Status:** PROPOSED — Founder review required; not effective until reviewed and merged.
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

## 4. Founder acceptance is a preservation event, not just a screenshot

At each explicit Founder UX acceptance, the Technical Lead instructs the Programme Controller to update the register through a bounded PR or the same implementation PR. Each entry records:
- stable feature ID / journey, acceptance date and primary evidence (decision, screenshot reference, review record);
- exact accepted source SHA, branch and relevant paths, including the route and runtime linkage;
- accepted UX versus *fixture-only preview* versus *server-connected behavior*, with unknowns explicit;
- independent statuses: **ACCEPTED, IMPLEMENTED, TESTED, MERGED, PREVIEW VERIFIED, DEPLOYED** (each yes/no/unknown with evidence);
- present integration PR and last verified merged-main SHA;
- later Founder supersession if any; unresolved behavior and next action.

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

## 7. Ownership and records

| Accountable role | Required artifact |
| --- | --- |
| Founder | Accepts/rejects behavior and authorizes supersessions and normal merges |
| Technical Lead | Reconciles start point; approves integration sequence; checks preview fidelity and merge readiness |
| Programme Controller | Maintains Master Programme status and register; tracks **ACCEPTED / NOT MERGED** queue |
| Architecture & Decision Controller | Validates latest decisions and supersession; prevents accidental privacy/authority changes |
| Code Lifecycle Guardian / START-01 | Captures source, ancestry, active runtime and acceptance variance |
| Coding Agent | Implements narrow changes only after START-01; provides HOV-01 and test evidence |
| Independent Reviewer | Checks accepted-journey regressions and exact-head compliance |

**Role-activation limitation:** The 2026-11-16 reconciliation reported permanent Programme Controller, Architecture & Decision Controller and independent reviewer assignments **not verified**. Until a real assignment and attributable review evidence exist, do not claim these independent role checks completed. Technical Lead must surface the gap and obtain appropriate independent verification before a merge recommendation.

## 8. Required report at every development turn

Use this compact receipt in each coding-agent report and Tech Lead review:

```text
TASK / AUTHORITY:
CURRENT origin/main SHA (fetched at):
WORK BRANCH / HEAD / MERGE-BASE / DIRTY STATE:
OPEN OR STACKED PRs (exact heads):
ACCEPTED EXPERIENCE IDs + accepted source SHAs:
START FROM / DO NOT START FROM:
ACTIVE ROUTES + API + DATA STATE (fixture/connected):
PREVIEW: frontend/API SHA, working-tree overlay, DB/fixture identity:
REGRESSION MATRIX: preserved / conflicted / not tested:
STATUS: accepted | implemented | tested | merged | preview-verified | deployed (each separately):
CI + independent R1 exact-head evidence:
PR + NEXT INTEGRATION + FOUNDER DECISION:
OVERALL PASS / LIMITATIONS / STOP:
```

Unknown means UNKNOWN, not deferred, complete or removed. If accepted behavior is missing, the next instruction is recovery/reconciliation, not redesign by default.

## 9. Tiizi recovery disposition at drafting date

Observed on 2026-11-16: `origin/main = ce477b0756129119c6ee93e99029984db35cecfc`; #171 Draft at `7ebe03ba5ffaeed5c21b109137a94c7630b18e8c`, #150 open at `3aa0147d558eeba8371cd4cccffcbbc2326dd02f`. These are **historical observations**, never permanent starting SHAs.

- **Hold #171** pending reconciliation with latest accepted Group/Today/PFD source and correction of public Group Home → Challenge outsider preview.
- Preserve accepted PFD source (`2f065546dd7051b5c6401e52da897b8c82d6cc93`, `38d7bf906e5ff5c91542be7c72bd34d98cd9e0b9`, `e2aee9239d42e6f92a66c22e4fcbbb97595c9521`). Do not merge stale source wholesale.
- Treat Recent Activity and post-log Share as **Founder-accepted UX / unmerged fixture prototype**, not completed connected features. Preserve them while the connected implementation is separately scoped.
- Retain merged Package A (PR #168) and merged #167 image/profile/card work; do not replay superseded #163.
- The current local preview artifact/source identity is UNKNOWN until measured.
- No PR #171 merge, production deployment, database changes or new B2 build is authorized by this draft.

## 10. Approval boundary

This document is a **proposed Tiizi implementation procedure**. It becomes effective after Founder review, normal review gates and an approved merge. It does not replace the Master Programme, the central ECCL-005 contract, the current AGENTS.md, or Founder acceptance decisions.
