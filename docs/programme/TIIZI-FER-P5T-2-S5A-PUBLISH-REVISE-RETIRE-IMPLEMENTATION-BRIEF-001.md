# TIIZI-FER-P5T-2-S5A — Publish, Revise, Retire: Implementation Briefing (001)

**Status:** PREPARATION ONLY — Slice 5A implementation is **not** authorised to start. This briefing was produced under the Technical Lead design-gate disposition for `TIIZI-FER-P5T-2-S5-DESIGN-GATE-001-RECOVERY` and reconciled against the merged `main` after the controlled design merge.
**Design of record:** `docs/programme/TIIZI-FER-P5T-2-S5-PUBLISH-REVISE-RETIRE-DESIGN-001.md`, **merged to `main` as part of PR #139**. This briefing does not restate the design; it pins the implementation to it. Where this briefing and the design disagree, the design wins and the disagreement is an R2 finding.
**Baseline:** `main` @ `1df0ef5c86d499698270c51de0fec3896a9c54d4` (the PR #139 merge commit). The backend, frontend, scripts and dependencies are **byte-identical** to the pre-merge baseline `c8f0d61aa2dc545d6fbe79e3665bf519e8cf26b3` — the merge changed exactly one file, the design document — so every symbol and line reference below is unchanged by the merge.
**Implementation branch:** `impl/fer-p5t-2-s5a-publish-revise-retire-001`, created from the verified remote `main`. This branch currently carries **only this document**. No production code has been changed.
**Scope of 5A:** backend only. Slice 5B (frontend) and Slice 6 are out of scope.

## 0. Design merge record

| Item | Value |
|---|---|
| PR | #139 — `docs(programme): P5T-2 Slice 5 design and R2 assessment` |
| Approved head | `0910caf025a7f8677dd52883423cbc254ea92ac0` |
| Merge | normal **two-parent merge commit** `1df0ef5c86d499698270c51de0fec3896a9c54d4` (parents `c8f0d61aa2dc545d6fbe79e3665bf519e8cf26b3` and `0910caf025a7f8677dd52883423cbc254ea92ac0`) |
| Merge mode | merge commit — no squash, no rebase, no force-push, no bypass; pinned to the approved head |
| Merged files | 1 — the design document, +133 / −0 |
| Reviews | independent R2 **APPROVE WITH CONDITIONS** (seven corrections, all applied); independent R1 **PASS** on the exact final head; 0 review threads |
| CI on the approved head | six required checks green; Cloudflare Workers Builds failure inherited and non-gating (FD-S3-005) |

**Founder merge authorisation** was given for PR #139; the merge was executed normally and pinned to the approved head. **No Founder implementation authorisation for Slice 5A has been given**, so nothing in §2–§7 may be implemented yet.

**Slice 6 scope** was confirmed by the Technical Lead as Operator adoption reporting, read-only audit history and P5T-2 Founder acceptance evidence. Note for the record: design §10 still reads that the scope is "submitted for confirmation", because `FD-S5-03` is not a decision on record in the repository — the document was left exactly as reviewed so that the approved head stayed the reviewed head. **§10 has not been amended on `main`**, and amending it requires a separate authorised change; until then this briefing is the record of the confirmation.

## 1. Technical Lead decisions that will authorise 5A

1. Accept the independent R2 verdict **APPROVE WITH CONDITIONS**, all seven design corrections applied.
2. Approve the in-transaction `assertAuthorInTransaction` protection for **publish, revise and retire**, preserving the documented lock ordering.
3. Require deterministic real-PostgreSQL concurrency tests demonstrating authorisation-revocation and publish/save safety.
4. Approve the optional publish `If-Match` contract and preservation of existing no-header behaviour.
5. Confirm the Slice 6 scope as Operator adoption reporting, read-only audit history and P5T-2 Founder acceptance evidence.
6. Retain issue #137 and the off-machine evidence-preservation obligation.

The material architectural choice (the locking author re-assertion and its ordering) was deliberately left to the Technical Lead by the design gate and is now confirmed here. Nothing in §2–§7 may be implemented before a written Slice 5A implementation authorisation is issued.

## 2. Files to change

| File | Change |
|---|---|
| `api/src/challengeTemplateRoutes.ts` | Add `optionalIfMatchToken`; parse it in the publish route; pass the token to `publishTemplateVersion`. |
| `api/src/challengeTemplates.ts` | `publishTemplateVersion` gains an optional token parameter and the two token checks + the early retired check; `reviseTemplate` and `retireTemplate` gain `assertAuthorInTransaction`. |
| `api/test/p5t2s5RealPostgres.test.ts` | **New.** The four real-PostgreSQL concurrency interleavings (§5.2). |
| `api/test/p5t1TemplateAuthority.test.ts` | Extend with the API-contract cases (§5.1); existing cases must stay green unchanged in behaviour. |
| `api/migrations/030_challenge_template_authority.sql` | **NO CHANGE.** No migration in 5A. |
| `api/test/apiNamespaceContract.test.ts` | **NO CHANGE.** The publish route is already registered through `apiPath`. |
| `scripts/testV2OperatorTemplatesGuards.ts` | **NO CHANGE in 5A.** The guard relaxations belong to 5B (the client is what changes). |

**No other file may be touched.** No schema, no frontend, no script, no configuration, no dependency change.

**Current state of the three write paths (verified on `main` @ `1df0ef5`)** — this is the gap 5A closes:

| Path | Transaction begins with | Has `assertAuthorInTransaction`? |
|---|---|---|
| `updateTemplateDraft` (save) | `assertAuthorInTransaction` → `lockTemplate` → `lockVersion` | **yes** |
| `publishTemplateVersion` | `lockTemplate` → `lockVersion` | **no** |
| `reviseTemplate` | `lockTemplate` | **no** |
| `retireTemplate` | `lockTemplate` | **no** |

## 3. Exact contract changes

### 3.1 `optionalIfMatchToken` (new, `api/src/challengeTemplateRoutes.ts`)

Shares the regex and validation of `ifMatchToken`; differs only in the absent case.

```ts
function optionalIfMatchToken(request: FastifyRequest): string | undefined {
  const raw = request.headers['if-match'];
  if (raw === undefined) return undefined;                       // absent = no precondition
  const value = (Array.isArray(raw) ? raw.join(',') : raw).trim();
  const match = /^"([0-9a-f]{64})"$/.exec(value);
  if (!match || !REVISION_TOKEN_PATTERN.test(match[1])) {
    throw new TemplateError(400, 'invalid_precondition', 'If-Match must be a single quoted revisionToken');
  }
  return match[1];
}
```

- **Absent header ⇒ `undefined`.** No precondition, no 428. Publish behaves exactly as today.
- **Present but not one strong quoted 64-hex token** (including `*` and weak validators) ⇒ `400 invalid_precondition`, **byte-identical body to the save endpoint's 400** (same code, same message). A wildcard can never defeat the guard.
- `ifMatchToken` itself is **not loosened**: the save endpoint keeps `428 precondition_required` when the header is absent and its 400 body is unchanged.

### 3.2 Publish route

Route order must mirror the save endpoint exactly:

```
requireAuthor(request, reply)      → 401 / 403
templateIdParam(request)            → 400 invalid_template_id
versionParam(request)               → 400 invalid_template_version
optionalIfMatchToken(request)       → 400 invalid_precondition
publishTemplateVersion(db, actor, templateId, version, token)
```

### 3.3 `publishTemplateVersion(db, actor, templateId, version, expectedToken?: string)`

Unchanged for the no-token case. With a token:

| Step | Where | Behaviour |
|---|---|---|
| 404 | pre-transaction read | version row absent |
| already published | pre-transaction | `409 template_version_immutable` — **before** the retired check and before validation |
| early retired check | pre-transaction, one unlocked read of `challenge_templates.lifecycle` | `409 template_retired` (application-level code, not the DB backstop's `template_immutable`) |
| **Check 1** | pre-transaction, unlocked | `revisionTokenFor(before) !== token` ⇒ `409 template_draft_changed` + `details.current` |
| validation | pre-transaction, unchanged | `422 invalid_template` |
| `assertAuthorInTransaction(tx, actor)` | **first statement in the transaction** | `403 template_author_required` |
| `lockTemplate` → `lockVersion` | in transaction | template then version locks |
| draft-state re-check | in transaction | `409 template_version_immutable` |
| **Check 2** | in transaction, after the locks | `revisionTokenFor(lockedRow) !== token` ⇒ `409 template_draft_changed` + `details.current` |
| `contentHash` equality | in transaction, unchanged | `409 template_changed` (defence in depth) |
| write | in transaction, unchanged | versions UPDATE, templates UPDATE, audit INSERT |

`details.current` must carry the **same shape as the save endpoint's**: `revisionToken`, `content`, `lastEditedByMemberId`, `lastEditedAt`.

Check 1 is an optimisation only — it short-circuits before validation is spent. **Check 2 is the authoritative comparison.** Check 1's payload comes from an unlocked read and is advisory; only Check 2's is guaranteed fresh.

The token denotes **content equivalence, not a sequence**: a content-identical A→B→A sequence restores the identical token and produces no mismatch.

### 3.4 Revise and retire

Add `assertAuthorInTransaction(tx, actor)` as the **first statement** of the existing transaction in both `reviseTemplate` and `retireTemplate`. No other behaviour changes: the revise conflict codes (`template_not_published`, `template_draft_open`), the retire body validation (only `reason`, 1–500 characters, trimmed), the audit events and the response bodies are all already implemented and stay as they are.

## 4. Lock ordering — the security-critical part

Every write transaction acquires locks in **exactly this order**, roster first:

| # | Resource | Lock | Obtained by |
|---|---|---|---|
| 1 | `platform_operator_template_authors` row | `FOR SHARE` | `assertAuthorInTransaction` |
| 2 | `challenge_templates` row | `FOR UPDATE` | `lockTemplate` |
| 3 | `challenge_template_versions` row | `FOR NO KEY UPDATE` | `lockVersion` |

Rules that the implementation and the R2 reviewer must both hold:

- The roster lock is acquired **first** in publish, revise, retire and save. `updateTemplateDraft` is the reference implementation — copy its order exactly.
- The roster lock is held **until COMMIT**. It must be taken *inside* `db.transaction`, never as a pre-transaction check.
- **Never reorder.** Acquiring the roster lock after the template lock inverts the order against the save path and can deadlock (`40P01`).
- Why it closes the hole: a roster revocation takes a `FOR NO KEY UPDATE` row lock on the roster row, which **conflicts with `FOR SHARE`**. So the revocation cannot commit between the assertion and the write's COMMIT. If the revocation already committed, the row no longer matches `revoked_at IS NULL` and the assertion raises `403 template_author_required`.
- Why the revocation path cannot deadlock: it locks **only** the roster row and never the template or version rows, so no cycle exists.
- The database trigger `assert_active_template_author` remains a **backstop, not the guarantee**. It is a non-locking read and observes only its own statement's snapshot.

## 5. Test cases

### 5.1 API contract tests (PGlite, run in CI)

Extend `api/test/p5t1TemplateAuthority.test.ts`. Required assertions:

- Save endpoint unchanged: `428` when the header is absent; `400 invalid_precondition` with the byte-identical body when malformed — including `*` and weak validators.
- Publish with **no header** behaves exactly as today (publishes; no behaviour change).
- Publish with a **matching** token publishes.
- Publish with a **stale** token ⇒ `409 template_draft_changed` with `details.current`; **no** publish, **no** `publish` audit event.
- Publish with a token for a **different version or Template** ⇒ `409`.
- Publish **replayed after** a successful publish ⇒ `409 template_version_immutable` (the state check precedes the token comparison).
- Publish with a **malformed** header ⇒ `400 invalid_precondition` after authentication and path validation and **before any Template or version read**; the 401/403 precedence is unchanged.
- Precedence: retired Template + valid draft + valid token ⇒ `409 template_retired` and **no audit event**; retired + invalid draft **with** a token ⇒ `409 template_retired`; retired + invalid draft **with no header** ⇒ `422` (today's behaviour, unchanged).
- A **revoked** author's publish, revise and retire ⇒ `403` (the non-race case is already pinned by the P5T-1 authorization matrix; the new obligation is the race, §5.2).

### 5.2 Real-PostgreSQL concurrency tests — `api/test/p5t2s5RealPostgres.test.ts` (new)

Follow `api/test/p5t2s3aRealPostgres.test.ts`, which already contains the "save racing author revocation" case and the disposable-database conventions. **PGlite is single-connection and cannot express these races.** Four interleavings, all deterministic, **no sleep-based timing assertion anywhere**:

1. **Revocation committed first** ⇒ the write is refused with `403 template_author_required`; the version stays `draft`; the Template's lifecycle is unchanged; **no** `publish` audit event exists.
2. **Revocation held open across the write** — on a second pooled connection hold the roster `UPDATE` **uncommitted** (the `Db.transaction` seam holds one pooled client for the callback), start the write, assert the write has **not** completed, commit the revocation, then assert the write resolves to `403 template_author_required` with no audit event, no publication, no revision and no retirement.
3. **Write first** ⇒ the write commits and the revocation is ordered **after** it, with no `40P01` deadlock anywhere.
4. **Write versus save** ⇒ the write carrying a stale token loses to the save with `409 template_draft_changed` and `details.current`; unreviewed content is never published.

Assertions (1) and (2) are the deterministic discriminators between the trigger-only code and the locking assertion. The invariant is one-sided: the write either commits before the revocation or is refused — never both, and never committed after a committed revocation.

## 6. Disposable-database requirements

- The real-PG suite uses `openGuardedDisposableDb` from `api/src/disposableDbGuard.ts`; it must fail closed on any mismatch.
- The target must be named three times, independently of the URL: `TIIZI_DISPOSABLE_DB_HOST`, `TIIZI_DISPOSABLE_DB_PORT`, `TIIZI_DISPOSABLE_DB_NAME`. The URL must agree with all three.
- The host must be an **IP literal**; the port must **not** be `5432`; the database name must be the disposable name; and the live database must carry the `tiizi-disposable-preview:*` marker before any mutation.
- Gating: `describe.skipIf(!url || !target)` with `TIIZI_REAL_PG_URL` and `TIIZI_REAL_PG_DB`, exactly as the s3a suite does. The suite is **skipped** unless explicitly pointed at a guard-verified disposable cluster.
- The suite is **never** run in CI and **never** against a shared, persistent or production database.
- Migrations are run against the disposable database only, and the fixture truncates `challenge_templates, platform_operator_template_authors, members CASCADE`.
- Carried over from issue #137: the marker is verified on one pooled connection only, so a re-resolvable `localhost` must not be accepted — an **IP-literal** host is required.

## 7. Independent R2 review of 5A

5A is **security-sensitive** (domain authority) and therefore **R2**, in a **distinct reviewer session** from the implementer. It must be reviewed against the **exact head**, not against this briefing.

The reviewer must verify against source — not against any document:

- the roster `FOR SHARE` assertion precedes the template `FOR UPDATE` and the version `FOR NO KEY UPDATE` lock in **all four** write paths (publish, revise, retire, save);
- the roster lock is taken inside the transaction and held to COMMIT;
- the lock order is identical across the four paths, so no path inverts it;
- the DB trigger is a backstop and is not relied on as the guarantee;
- the publish route order reproduces the save endpoint's order exactly, and `ifMatchToken` is unmodified;
- the absent-header path is behaviourally identical to today's publish;
- the 400 body is byte-identical to the save endpoint's;
- Check 2 runs after the locks and is the authoritative comparison;
- the four real-PG interleavings are deterministic and contain no sleep-based assertion;
- no migration, no new endpoint, no new authority model, no business rule beyond the design.

## 8. Acceptance criteria

1. All three write paths refuse a revoked author under the concurrency interleavings in §5.2, and no write commits after a committed revocation.
2. The lock order is roster → template → version in publish, revise, retire and save, verified by the R2 reviewer against source.
3. Publish with no `If-Match` header is behaviourally identical to today's publish.
4. Publish with a stale token is refused with `409 template_draft_changed` and `details.current`; no publish and no `publish` audit event occur.
5. The save endpoint's `428`/`400` behaviour is byte-identical to today.
6. The existing P5T-1 publish tests are unchanged and green.
7. The four real-PG interleavings are deterministic, env-gated, guard-verified and green against a disposable cluster.
8. Six required CI checks green on the exact head: `api (typecheck, test, build)`, `api contract (/api namespace)`, `api image (build, liveness)`, `web (typecheck, build)`, `functions (build, typecheck)`, `boundary (V1 exclusion + API namespace)`. Cloudflare Workers Builds remains non-gating and its configuration is not changed.
9. Independent R2 PASS on the exact final head, with every substantive finding resolved.
10. A separate independent R1 review of the exact final head.
11. Written Founder authorisation for the merge.
12. No deployment, no persistent migration, no roster seeding or activation, no infrastructure change, and no persistent-database contact of any kind.

## 9. Prohibitions for the 5A implementer

- Do not start implementation before a written Slice 5A implementation authorisation is issued.
- Do not begin Slice 5B or Slice 6.
- Do not add a migration, a new endpoint, or a new authority model.
- Do not change the frontend, the API client, the guard script, or any V1 code.
- Do not deploy, migrate a persistent database, seed or activate the author roster, or touch infrastructure.
- Do not weaken the existing `contentHash` defence in depth, the draft-state re-check, or the database triggers.
- Do not change `ifMatchToken`; add `optionalIfMatchToken` alongside it.
- Do not move the roster assertion out of the transaction or after the template lock.
- Do not cherry-pick the earlier local briefing commit; this document is the reconciled version.
- Do not claim the evidence package is transferred or remotely archived; issue #137 stays open and the off-machine transfer obligation is retained.
