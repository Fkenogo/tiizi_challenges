# TIIZI-FER-P5T-2 — `createTemplateDraft` Authorization-Revocation Race: R2 Assessment Plan (001)

**Status:** Separate R2 assessment opened / plan prepared. No code change authorized or made.
**Assessment target:** `api/src/challengeTemplates.ts` — `createTemplateDraft`; route `POST /api/operator/templates` in `api/src/challengeTemplateRoutes.ts`.
**Baseline:** `main` at `f4eb8a06af1649084bb8e614fe60f9d0af83644b`.

## 1. Question for the independent R2 reviewer

Does a Template draft creation that began while the caller was an active Template author have a race in which that author is revoked before the creation transaction commits, yet the Template, version 1 and `create_draft` audit event still commit? Determine whether the migration 030 triggers alone serialize this operation against roster revocation. Review the exact source and PostgreSQL lock/snapshot semantics; do not rely on this plan as proof.

## 2. Source facts to verify

- The route calls `requireAuthor` before `createTemplateDraft`; this is a pre-transaction capability check.
- `createTemplateDraft` currently opens a transaction and inserts the Template, initial draft version, then `create_draft` audit event. Unlike save/publish/revise/retire, the function currently does not call `assertAuthorInTransaction` before its writes.
- Migration 030 defines the database-side author checks/triggers. The reviewer must inspect the exact trigger functions and every trigger attached to these three inserts, identifying each statement snapshot and lock acquired.
- The existing `assertAuthorInTransaction(tx, actor)` takes a `FOR SHARE` lock on the active roster row. Slice 5A uses this lock before Template/version locks in its write paths. Assess whether the same ordering safely applies before draft creation inserts and whether any database trigger or foreign-key lock creates a deadlock cycle.

The preliminary hypothesis is a narrow final-statement-to-commit interval similar to the trigger-only race addressed in Slice 5A. This is a **hypothesis only** until the independent R2 review establishes the trigger order and the disposable-PostgreSQL interleaving.

## 3. Required assessment work

1. Read the exact merged implementations of the route, `createTemplateDraft`, `assertAuthorInTransaction`, and migration 030 triggers.
2. Map locks and statement snapshots for Template INSERT → version INSERT → audit INSERT, and for author revocation. Identify whether revocation can commit after the last trigger check and before creation COMMIT.
3. Execute or inspect a deterministic real-PostgreSQL reproduction on a fresh, guard-verified disposable target only. Cover (a) revocation committed before creation starts; (b) revocation held open while creation starts, then committed; (c) creation ordered first, then revocation; and (d) an uncontrolled concurrent race with state/audit assertions. Do not use sleep-based timing assertions. Never run against a shared, persistent or production database.
4. Check failure atomicity: a refused creation must leave no Template, version row, or `create_draft` audit record.
5. Return a written R2 disposition with severity, exploitability, exact source evidence, reproduction outcome, minimal remediation (if needed), regression coverage, and any residual risk. Do not edit the implementation during assessment.

## 4. Candidate remediation boundary (not authorized)

If R2 confirms the race, assess the smallest correction: call `assertAuthorInTransaction(tx, actor)` as the first statement inside `createTemplateDraft`'s transaction, before inserting the Template. That would serialize creation with revocation using the same roster-row `FOR SHARE` mechanism. Keep the existing database triggers as backstops. Confirm the existing Template → version → audit creation order and verify no additional migration or API contract is required. Any code change, even this candidate, requires separate Technical Lead approval after the R2 report.

## 5. Hold and scope controls

- `createTemplateDraft` and its route remain unchanged while this assessment is pending.
- Do not reuse the Slice 5A merge authorization as authorization to change draft creation.
- No endpoint, migration, roster data, production database or infrastructure changes are in scope.
- No author activation or deployment. Keep the disposable suite opt-in and marker-guarded.
- This assessment is distinct from Slice 5B frontend preparation. It is not a Slice 6 task.

## 6. R2 report checklist

The returned report must record reviewer independence, exact reviewed commit, source locations, lock table, deterministic test procedure and outcome, data-state assertions, disposition (`PASS`, `PASS WITH CONDITIONS`, or `FINDING / BLOCK`), and the authorization needed for any follow-on correction. No verdict is pre-assigned by this plan.
