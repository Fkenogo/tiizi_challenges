# TIIZI-FER-P5T-2-S5 — Publish, Revise, Retire: Design and R2 Assessment (001)

**Status:** DESIGN FOR FOUNDER AND R2 REVIEW. **Slice 5 implementation is not authorised.** Documentation only; no code, schema, migration, deployment, roster or production change.
**Baseline:** `main` at `c8f0d61aa2dc545d6fbe79e3665bf519e8cf26b3` (Slice 4 merged; programme v2.88).
**Authority consulted:** FER-TPL-001 (§2.1 slices, §2.5 lifecycle, FD-TPL-01/-03/-04), P5T-1 backend (`api/src/challengeTemplates.ts`, `challengeTemplateRoutes.ts`, migration 030), Slice 3b/4 editor and validation model, issue #137.

## 1. Decisions applied

1. **Publish concurrency:** design an optional server-side `If-Match` on the existing publish endpoint; the Operator UI always sends the current revision token and cannot publish until the author has reviewed the latest content (§4).
2. **"Needs revision":** derivable from existing authoritative data without an API change (§6); a read-only addition is specified only as the fallback.
3. **Slice 6:** separate; boundary proposed in §9.
4. **Evidence:** issue #137 stays open; a checksum-verified transfer package exists locally; no transfer has been performed or is claimed (§11).

## 2. Scope of Slice 5

In: Operator-side **publish**, **revise** and **retire** over the existing P5T-1 endpoints (`POST …/versions/:v/publish`, `POST …/revisions`, `POST …/retire`); handling of their 4xx/5xx outcomes; immutable-state presentation; the "needs revision" indicator; the single backend addition in §4.
Out: see §9 (Slice 6 and P5T-3/-4), and any change to validation, content-hash locking, Challenge establishment, provenance, participation, scoring, Streaks or recognition.

## 3. Workflows

**Roles.** "Author" below means an active member of the Template-author roster: any roster author may publish, revise or retire any Template, not only their own draft (FD-TPL-01; P5T-1 tests).

**Publish (roster author only).** Controls live in the Template Draft Editor, beside "Save and check".
- *Enabled only when* the editor holds a **fresh, passing** validation record for the **current server token** (`isValidationStale === false`, `ok === true`), with no unsaved changes, no open conflict and no immutable state. This reuses the Slice 4 freshness model unchanged.
- *Action:* `POST …/publish` with `If-Match: "<validation.token>"` (§4): the token of the **validation record** the button was enabled by, never the editor's current token and never one re-read at click time. A confirmation names the Template, version and that published versions are immutable.
- *Success (200):* the response is only `{templateId, version}`, so the UI refetches the Template detail (the published version has `revisionToken: null`); the editor then switches to a read-only "Published as version N" state, links to the preview and to Revise; invalidates the Library queries. The draft token no longer exists (a published version has `revisionToken: null`).
- *Any non-success:* never presented as published; see §5.

**Revise (roster author only).** Library detail panel, shown when the Template is `published`, not retired, and has no open draft.
- `POST …/revisions` creates version N+1 as a draft seeded from the latest published version; the UI then opens the editor on it. A second concurrent revise returns `409 template_draft_open`; the UI links to the existing draft instead of retrying.

**Retire (roster author only).** Library detail panel, offered for `draft` and `published` Templates that are not retired (the server allows draft → retired and there is no delete; for a never-published Template the dialog labels it "Discard this unpublished Template").
- A dialog requires explicit confirmation, states that retirement is **terminal**, hides the Template from the member catalogue and **never changes existing Challenges**, and takes an optional reason: the UI **omits the field** when empty (an empty string is a 400), trims it, and limits the untrimmed text to 500 characters (the server checks untrimmed length ≤ 500 and non-empty after trimming; any other body key is a 400). If the Template has an open draft, the dialog warns that the draft stays but can no longer be saved or published. `POST …/retire` → 200 shows the Retired state. The server and database triggers make retirement terminal (`409 template_retired` on any later change); the UI offers no undo.

**Permissions.** Controls are rendered only when `capabilities.canAuthor` is true; Console readers keep read-only preview and Library; ordinary members are excluded; every action's authority is the server's `requireAuthor`. A 403 mid-action switches the editor/panel read-only and keeps the author's work visible (same handling as Slice 3b/4).

**Immutable-state behaviour.** A published version is never editable: the editor shows `nodraft` for it (already implemented), the Library marks it Published, and any write attempt that returns `409 template_version_immutable` or `template_retired` switches the surface to the corresponding read-only state and re-reads the Template. Publishing twice cannot republish: the second call returns 409 immutable.

## 4. Server-enforced publish concurrency (the R2 item)

**Problem.** Publish takes no precondition. It validates and publishes whatever draft is stored at that moment. If another author saved after the first author's last check, the first author can publish content they never reviewed (the Slice 4 "S3" limitation, accepted in #137 and now consequential).

**Proposed change (backend, additive, no migration).** `POST /api/operator/templates/:templateId/versions/:version/publish` accepts an **optional** `If-Match: "<revisionToken>"` header.
- *Parsing:* a **new `optionalIfMatchToken`** that shares the regex and validation of `ifMatchToken` but returns `undefined` when the header is absent. The existing `ifMatchToken` is **not loosened**: the save endpoint keeps returning 428 when absent and its 400 behaviour stays byte-identical. Present but not one strong quoted 64-hex token (including `*` and weak validators) is `400 invalid_precondition`, raised **before any database read**. **Absent** keeps today's behaviour exactly (optional, per the Founder decision; required-ness is a later, separate decision).
- *Check 1 (early, no lock):* compare to `revisionTokenFor(before)`; mismatch ⇒ `409 template_draft_changed` with the **same `details.current` payload as the save endpoint** (`revisionToken`, `content`, `lastEditedByMemberId`, `lastEditedAt`), before spending validation work. It is an optimisation only: a content-identical A→B→A sequence can at worst produce a harmless false mismatch.
- *Check 2 (authoritative, in the transaction):* after `lockTemplate`/`lockVersion` and the draft-state re-check, compare to `revisionTokenFor(lockedRow)`; same 409 payload. Saves take the same locks, so this serialises against them.
- ***Precedence (specified, to be tested):*** header parse (400) → 404 → published ⇒ 409 `template_version_immutable` → **lifecycle check: a retired Template ⇒ 409 `template_retired`** (a cheap early reject added before Check 1 and before validation; today an invalid draft of a retired Template returns 422 and only the in-transaction lock returns `template_retired`, and §5 maps those to different UI states) → Check 1 (409 `template_draft_changed`) → validation (422) → in-transaction retired/immutable re-checks → Check 2 → existing `contentHash` check (`template_changed`) → write.
- *Unchanged:* validation runs exactly as today before the transaction; the in-transaction `contentHash` equality check (`template_changed`) stays as defence in depth; audit and the publish UPDATEs are untouched. With a token supplied, the published snapshot is therefore provably (a) what the author's token denotes, (b) what was validated, and (c) what was locked and written.
- *What the UI binds:* "reviewed" means the content **denoted by the validation record's token**, i.e. the content the server validated for that token (the Slice 4 `check()` already discards a result whose re-read token differs from the token it started with). Content the author sees after later edits is not covered, and those edits make the record stale and disable Publish.
- *Why the existing token is sufficient:* `revisionTokenFor` is SHA-256 over Template id, version and canonical editable content (it denotes content equivalence, not a sequence); the editor already carries and chains it for conditional saves.

**UI contract.** The Operator UI always sends the token of the draft the author validated. A concurrent change yields the 409, the editor opens the existing reconciliation view on the returned `current`, and **Publish stays disabled until the author has reviewed the latest content and run Save and check again** (the validation record is tied to the new token). No client override exists.

**Optional follow-up, not proposed here:** returning the validated token in the validate response would remove the Slice 4 re-read workaround. It is a second backend change and is deliberately excluded to keep R2 narrow.

**R2 implications (why R2 applies).** It changes the contract of a write endpoint on an authority surface (publication) even though it is additive and backward compatible. Questions for R2: (1) is reusing `template_draft_changed` and its payload on publish acceptable (recommended: yes, one client path for both writes); (2) is optional-now / required-later the right sequencing (recommended: yes, flip only after the UI ships; in-repo callers of publish are the route and the P5T-1 tests, all of which send no header — there is no Template CLI — and external callers cannot be excluded from the repository alone); (3) confirm no weakening of the validate-then-lock guarantees (the proposal only adds a stricter reject before and inside them); (4) confirm that a token for a version that has just been published cannot be replayed (state check comes first ⇒ 409 immutable).

**Tests required (API, PGlite and real PostgreSQL).** save endpoint 428/400 unchanged; malformed/`*`/weak header on publish ⇒ 400 before any read; precedence cases (retired Template with a valid draft and a valid token ⇒ 409 `template_retired`, no audit event; retired with an invalid draft; published + stale token ⇒ immutable); a revoked author's publish ⇒ 403 (the roster is re-asserted only by the database trigger at the UPDATE, so this must be pinned); matching token publishes; stale token ⇒ 409 with `current`, no publish, no `publish` audit event; absent header unchanged; malformed/`*`/weak ⇒ 400; token for a different version or Template ⇒ 409; replay after success ⇒ 409 immutable; a **real-PostgreSQL race** (author A publishes with token T while author B saves) never publishes unreviewed content (the s3a real-PG pattern, using the disposable guard); existing P5T-1 publish tests unchanged and green.

## 5. Frontend handling of 409, 422 and other outcomes

| Response | Meaning | UI behaviour |
| --- | --- | --- |
| 200 | Published | Read-only "Published as version N"; invalidate queries. |
| 422 `invalid_template` + `details.issues` | Server validation failed at publish | Show with the **existing step-mapped issue display** (a validation record tied to the token that was sent); stay on the draft; nothing published. |
| 409 `template_draft_changed` (+`details.current`) | Draft changed since the author's token | Open reconciliation on `current` (Slice 3b panel); Publish disabled until Save and check is rerun on the reconciled draft. |
| 409 `template_changed` | Content moved between validation and the lock (only reachable without a token, or as defence in depth) | Re-read the draft, treat as a concurrent change as above. |
| 409 `template_version_immutable` | Already published (possibly by another author; compare `publishedByMemberId` before saying who) | Re-read; show the Published state; no error implying failure. |
| 409 `template_immutable` / `template_conflict` | Database-trigger backstop (a race, e.g. a concurrent revise hitting the open-draft unique index) | Re-read, then decide from the fresh state; never assume the outcome. |
| 409 `template_retired` | Template retired | Read-only Retired state. |
| 400 `invalid_precondition` | Client bug | Generic failure; reload; logged. |
| 401 / 403 / 404 | Session ended / authority withdrawn / missing | Distinct states as in Slices 3b/4 (403 keeps work visible and switches editing off). |
| network error / 503 | **Outcome unknown** | Never retried blindly: re-read the Template. Published ⇒ show it; still a draft ⇒ offer to retry. |

Revise: `409 template_not_published`, `409 template_draft_open` (link to the open draft), `409 template_retired`; 403/404/network as above. Retire: `409 template_retired` is shown as "already retired"; a 400 is prevented client-side (omitted empty reason, 500-character limit) and shown if the server still refuses. A 422 at publish needs no client-side expiry rule for earlier validations: the server re-validates every publish against current Knowledge state.

## 6. Operator "needs revision" indicator

**Assessment: derivable safely from existing authoritative data; no API change is required for Slice 5.**
- `validateTemplateContent` is the single authority for both publish and the member read. The existing `GET /api/challenge-templates/:templateId` (any authenticated member, including every author and Console reader) runs it over the **latest published version** and returns `adoptable` and `unavailableReason` (the first issue's code, e.g. `STALE_ACTIVITY`, `ACTIVITY_NOT_ELIGIBLE`), or 404 when the Template is retired or has no published version.
- **Design:** in the Library detail panel, for a published, non-retired Template, call that read and show "Needs revision" when `adoptable === false`, with a display label mapped from the code (labels only; no eligibility logic in the frontend), plus a Revise action for authors. 404 shows no indicator. The Library list shows no per-row indicator (one validation per row per page is costly).
- **Limits, stated openly:** the reason is a single code, not the full issue list (the full list appears when the author revises and runs Save and check); it covers the latest published version only; it adds a cross-surface read to the Operator client. **Rules:** (a) call it only for a Template whose already-loaded detail says `lifecycle = published` and `latestPublishedVersion` is set; a 404 means "no indicator" and is never used to infer lifecycle (it is returned for retired, draft-only and unknown Templates alike); (b) cache with a React Query stale time and no refetch on focus, because each call runs the full `validateTemplateContent` (preview plus per-Activity eligibility reads) once per panel open; (c) if the Template has an open draft, link to that draft instead of offering Revise (revise would return `template_draft_open`); (d) a failure of this read shows "indicator unavailable", never "adoptable", and does not block the panel; (e) a contract test pins `adoptable` and `unavailableReason` on the member read so a later P5T-3 change cannot silently break the Operator; (f) the existing guard assertion that forbids `challenges/|challenge-templates` in the client and Library is relaxed to exactly one allowance, the single GET `/challenge-templates/:templateId` (not the list or the versions route).
- **Fallback (only if the Founder wants list-level badges or the full reason list):** the smallest read-only addition is `needsRevision: { adoptable: boolean; issues: TemplateIssue[] } | null` on `GET /operator/templates/:id` (and a boolean on the list), computed server-side by the same `validateTemplateContent` over the latest published version, readable by authors and Console readers. No new business logic, no schema. R2 would apply because it adds a read contract on the Operator surface; **not proposed for Slice 5**.

## 7. Test and disposable-database requirements

- **DOM/unit:** publish enablement (fresh + passing + saved only); 409 `template_draft_changed`, `template_changed`, `template_version_immutable`, `template_retired`; 422 issue display and step mapping; outcome-unknown re-read; revise (`template_draft_open`, `template_not_published`); retire dialog (omitted empty reason, 500 limit, confirmation, terminal, draft-only Template, warning when an open draft exists); `template_immutable` and `template_conflict` backstop handling; the token-binding rule (the sent token equals `validation.token`); publish of a retired-with-draft Template; permissions (reader and member see no controls); needs-revision (adoptable false/true/404/failure); regression for Slice 3b/4 and the member Wizard.
- **Guards:** `scripts/testV2OperatorTemplatesGuards.ts` is updated deliberately to permit exactly publish, revise and retire plus the one needs-revision read, still forbidding any other write or endpoint.
- **API:** the §4 tests; existing P5T-1 tests green.
- **Browser (real API, verified disposable PostgreSQL):** Together, Race and Streak each authored → checked → published, revised, retired; concurrent edit before publish (409 → reconcile → recheck → publish); 422 at publish; Console reader and ordinary-member denial; retired and immutable read-only states; layout at 1280/900/390. Database target **must** be opened through `openGuardedDisposableDb` with an **IP-literal host**, a port other than 5432 and a verified marker (this honours issue #137 notes on `localhost` re-resolution).
- **CI:** six required checks green on the exact head; Cloudflare Workers Builds remains non-gating.

## 8. Dependencies

P5T-1 endpoints (merged); Slice 4 validation and freshness model and Slice 3b conflict reconciliation (merged); the disposable-database guard (merged); migration 030 stays **undeployed** and the author roster **unseeded**, so all Slice 5 verification is on disposable data. Order: (1) R2 review of §4 → (2) backend publish precondition + tests (R2) → (3) frontend (R1). The two parts may land as two PRs; the frontend depends on the backend.

## 9. Boundaries: what Slice 5 excludes

Not Slice 5: Operator adoption reporting and audit-history views (proposed Slice 6, §10); every member-facing capability (P5T-3: entry choice, member library, preview, hydration, host selection); integrated preview (P5T-4); any change to Challenge establishment, the provenance contract, participation, scoring, Streaks or recognition; real author activation, deployment or persistent migration.

## 10. Proposed Slice 6 boundary (for Founder approval; not authorised)

**Reconciliation with FER-TPL-001.** TPL-001 §2.1 lists four slices (P5T-1…P5T-4); "Slice 1–6" is the implementation breakdown of **P5T-2** only. P5T-2's TPL-001 content is: Wizard step extraction (Slice 1), searchable Library (2), create/edit (3a/3b), preview (4), publish/revise/retire (5), **and adoption counts by Template/version (FD-TPL-02, FD-TPL-04)**. Per-Template/version counts already ship in the Slice 2 Library detail panel. The remainder of P5T-2 is therefore the Operator-side adoption reporting and visibility, plus P5T-2 acceptance. The provisional wording "adoption presentation and related visibility" must not be read as the **member** adoption journey: that is **P5T-3** and is excluded.

**Proposed Slice 6 = Operator adoption reporting, audit visibility and P5T-2 closure acceptance, frontend-first and read-only:**
- an Operator-only adoption report view over the existing `GET /operator/templates/adoption` (all Templates/versions, lifecycle filter, pagination), counting only **established Challenges** (never previews, opens or selections; no member-level tracking, no analytics store) — FD-TPL-04;
- **Founder-optional:** display of the existing `GET /operator/templates/:id/audit` with the author, publisher, reviser and retirer identities as separate fields. FER-TPL-001 requires those identities to be recorded (P5T-1, FD-TPL-01); it does not list an audit-history view in P5T-2, so this item is optional scope for the Founder to include or drop;
- the P5T-2 Founder acceptance evidence for the Operator journey on disposable data for Together, Race and Streak, and adoption counts that equal exactly the Challenges established from Templates (established through the existing API with a provenance reference: no code change to the establishment path and no Slice 6 UI to establish). The Slice 6 delta is therefore a cross-Template report and the optional audit view only; per-version counts, with authored-by, published-by and retired-by, already ship in the Slice 2 Library panel, and the adoption endpoint is already global when `templateId` is omitted.
**Explicitly out:** all P5T-3 member flows and P5T-4; any change to establishment, provenance, participation, scoring, Streaks or recognition; any new analytics or tracking store; any new backend endpoint (none is expected; if the report needs one, it returns to the Founder as a separate R2 item). Review level: R1.

## 11. Evidence preservation (issue #137 stays open)

A transferable package for Slices 3b and 4 (45 files, SHA-256 manifest, `VERIFY.sh`, tarball with its own checksum) has been prepared **locally** and verified from a fresh extraction. **It has not been transferred to any off-machine store and must not be described as remotely archived** until the destination copy is independently verified against the manifest. The destination is the Founder's existing private Miledge evidence store; the implementation agent has no access to it.

## 12. Implementation acceptance gates (when later authorised)

1. R2 approval of §4 (and of §6 only if the fallback is chosen). 2. Backend tests green, including the real-PostgreSQL race on a guard-verified disposable database. 3. DOM tests, guard and regression suites green. 4. Browser matrix §7 passes on a freshly verified disposable database. 5. Six required CI checks green on the exact head. 6. Independent review of the exact final head with every substantive finding resolved. 7. Founder authorisation for each merge. 8. No deployment, persistent migration, roster seeding or infrastructure change.

## 13. Unresolved risks

- **R-1** If R2 declines §4, publish remains server-validated but not bound to what the author reviewed; the UI could then only narrow, not close, the window.
- **R-2** Needs-revision shows one reason code; richer detail needs the §6 fallback.
- **R-3** Making `If-Match` required later could break an unknown legacy caller; confirm none before flipping.
- **R-4** Evidence for Slices 3b/4/5 stays local-only until the Miledge transfer is done and verified.
- **R-5** Slice 6 scope is a proposal until the Founder approves §10.
