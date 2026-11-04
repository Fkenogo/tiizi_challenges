# TIIZI-ECCL-PRG-01 — Agent Entry & Reconciliation Pilot

**Status:** CANDIDATE — NOT EFFECTIVE UNTIL FOUNDER APPROVAL AND MERGE  
**Date:** 2026-11-04  
**Scope:** Read-only coding-agent entry discipline; no feature change, V1 deletion, migration, preview deployment, branch repair, or new gate in CI.  
**Parent references:** Miledge Ventures MV-ECCL-001 (PR #109), MILEDGE-ECCL-002 (PR #110), MILEDGE-ECCL-003 (PR #111).  
**Tiizi authority:** Root `AGENTS.md`, `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`, adopted V2 Experience Reference and existing FEF/TLC authority. This candidate does not supersede them.

## Why

Tiizi Founder Preview reviews have encountered an older Activity Guide, absent expected 4 Group / 12 Challenge fixture content, and uncertainty about which V2 build is assembled. This pilot distinguishes source version, product acceptance, fixture state and deployment rather than diagnosing all symptoms as legacy V1 code.

## New optional read-only collector

Run from the intended **Tiizi worktree**:

```bash
node scripts/prg01LocalReconciliation.mjs
```

It reports local branch/HEAD, cached origin/main, merge-base, ahead/behind counts, dirty/untracked files and local worktrees. It does **not** fetch, modify files, run the app, connect to the database, rebase, reset, seed or deploy.

- `SOURCE_ONLY_RECONCILED` is **not** full PRG PASS or Founder approval.
- Missing remote or Git evidence remains `UNKNOWN`; output is deliberately non-gating and exits successfully when in a Git worktree, even if reconciliation is needed.
- Before relying on cached `origin/main`, the Technical Lead must separately arrange a safe fetch and rerun, preserving all user changes.
- Do not commit machine-local paths, private URLs, secrets or fixture credentials in Git.

## Required human/agent completion

After the collector, the assigned agent checks:

1. Root `AGENTS.md`, latest Master Programme, current Founder dispositions, accepted V2 Experience Reference and current task approval.
2. Open PRs and their **actual** bases/heads; specifically reconcile #144's current head with #145's stacked base before suggesting merge or assembling preview. #143 is an independent slice. These numbers are examples observed on 2026-11-04, not permanently current authority.
3. The actual active imports/routes for `/v2/today`, Groups and Challenges discovery, and the Activity Guide filter implementation. Never use excluded V1 `/app/*` code as source.
4. Preview process, runtime build SHA, environment and fixture identity. Verify expected Groups/Challenges/Activities from a separately authorised disposable preview via read-only queries; no seed/reset/migration under this task.
5. Existing `npm run test:boundary` and relevant Activity Guide/experience tests, without disabling or weakening them.
6. Founder-reviewed screen/behaviour acceptance versus currently assembled candidate, recorded with screenshots and exact SHA.

Report per dimension **CONFIRMED / CONFLICTED / UNKNOWN**, overall **PASS / PASS WITH LIMITATIONS / STOP**, exact evidence and the next authorised step. When acceptance or preview identity is unknown, **STOP before UI changes, legacy removal or a Founder merge recommendation**. Other unrelated authorised work is not automatically blocked.

## HOV-01 handover

Record task, authority, source baseline, branch/PR head, active code path, test/CI status, actual preview build, accepted functionality evidence, unresolved blockers and next bounded action. Keep implementation/test/merge/deploy/Founder-acceptance statuses separate. Use existing Tiizi programme records, not a second Master Programme.

## Test protocol for Kenogo and the Technical Lead

- **T1 — Stale branch:** Run collector on an older existing worktree; expect SHA/behind evidence or UNKNOWN and no mutation.
- **T2 — Stacked PR:** Compare #144 latest head against #145 actual base; expect explicit discrepancy report and STOP before assuming assembled approval.
- **T3 — Dirty worktree:** Use an existing harmless uncommitted test change only if already present; collector reports it without touching it. Do not create a dirty state in the user's active worktree merely to test.
- **T4 — Preview provenance:** Report an unmatched/missing build SHA as UNKNOWN, not PASS.
- **T5 — V1 boundary:** Run existing boundary guards on a safe local checkout; archived code's physical presence alone is not evidence it runs.

**Pass criterion:** Technical Lead can identify the exact authoritative source and active preview for the selected UI journey, or issues a justified STOP with no changes. Capture the command's JSON output, GitHub PR metadata, screenshot/build identity and a short reconciliation report.

## Adoption/approval boundary

This pilot is a reversible, read-only addition. Do not merge until Founder review; after merge it becomes Tiizi's agent-entry procedure but does not authorise cleanup. CI gating, rollout to other projects and actual code retirement require separate approval. Do not change the six existing CI jobs during this pilot.
