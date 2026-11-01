# TIIZI-FER-P5T-2-S5A — Closure and Merge Record (001)

**Status:** Slice 5A COMPLETE / MERGED. Documentation records verified merge and validation evidence; no deployment or persistent-data change.
**Date:** 2026-11-01
**Canonical baseline:** `main` at `f4eb8a06af1649084bb8e614fe60f9d0af83644b`.
**Design of record:** [Slice 5 Publish, Revise, Retire Design](TIIZI-FER-P5T-2-S5-PUBLISH-REVISE-RETIRE-DESIGN-001.md).
**Implementation record:** [Slice 5A Implementation Briefing](TIIZI-FER-P5T-2-S5A-PUBLISH-REVISE-RETIRE-IMPLEMENTATION-BRIEF-001.md).

## 1. Merge evidence

| Item | Evidence |
| --- | --- |
| Pull request | [PR #140](https://github.com/Fkenogo/tiizi_challenges/pull/140), merged 2026-11-01 |
| Approved implementation head | `543db958fc4e0b209e6aa24ad064dc3b591bafcb` |
| Merge commit | `f4eb8a06af1649084bb8e614fe60f9d0af83644b` (normal two-parent merge; first parent `1df0ef5`, second parent `543db95`) |
| Required checks | api (typecheck, test, build), api image (build, liveness), web (typecheck, build), functions (build, typecheck), boundary (V1 exclusion + API namespace), and API contract (/api namespace): all SUCCESS |
| External check | Cloudflare Workers Builds failed; inherited and non-gating under the established programme treatment. No deployment followed. |

## 2. Independent review dispositions

- **R2 security review: PASS.** The authorization-revocation race was closed with an in-transaction author-roster `FOR SHARE` assertion placed before Template and version locks in publish, revise and retire. The save path retains the same roster → Template → version lock order. Publish `If-Match` keeps its optional-header compatibility and checks the reviewed content token after acquiring locks.
- **R1 implementation review: PASS.** No blocking R1 finding remained for the merged Slice 5A implementation.
- The merge briefing records the design-gate R2 disposition as **APPROVE WITH CONDITIONS**; those conditions became implementation acceptance requirements and are satisfied by the merged code and disposable-database evidence.

## 3. Disposable PostgreSQL concurrency verification

`api/test/p5t2s5RealPostgres.test.ts` is opt-in and guarded by the disposable-database identity checks. It was executed against a disposable PostgreSQL target, not CI or a persistent database. The deterministic scenarios verify:

1. Revocation committed before publish/revise/retire causes `403 template_author_required`; state and audit assertions show no unauthorized effect.
2. A revocation held open while each write starts blocks on the roster lock; after revocation commits, each write is refused and leaves no publication, revision, retirement or audit effect.
3. A write that wins before revocation commits cleanly, and the concurrent ordering check observes no `40P01` deadlock.
4. Publish with a stale revision token loses to a concurrent save with `409 template_draft_changed`; unreviewed content is never published.

The suite avoids sleep-based timing assertions. Migration 030 was used only on the disposable target for verification; it remains undeployed. No persistent PostgreSQL database was migrated or contacted for this verification.

## 4. Scope and preserved obligations

Slice 5A is complete. Slice 5B is the next frontend slice and has a separate preparation briefing for Technical Lead review. **That briefing does not authorize Slice 5B implementation.** Slice 6 has not started. No production deployment, infrastructure change, persistent migration, or author-roster seeding/activation occurred.

Issue [#137](https://github.com/Fkenogo/tiizi_challenges/issues/137) remains **OPEN**. Its outstanding off-machine preservation obligation is retained: designate the durable private destination, transfer the existing S3b/S4 evidence package, independently verify its checksums and record the destination reference. The transfer has not been completed or verified; this record makes no remote-archive claim.
