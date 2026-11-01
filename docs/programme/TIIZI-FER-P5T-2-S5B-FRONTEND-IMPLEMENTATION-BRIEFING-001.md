# TIIZI-FER-P5T-2-S5B — Publish, Revise, Retire Frontend Briefing (001)

**Status:** PREPARATION ONLY — for Technical Lead review. Slice 5B implementation is **NOT STARTED / NOT AUTHORISED**.
**Baseline:** `main` at `f4eb8a06af1649084bb8e614fe60f9d0af83644b` (PR #140 merge).
**Design of record:** [TIIZI-FER-P5T-2-S5 Publish, Revise, Retire Design](TIIZI-FER-P5T-2-S5-PUBLISH-REVISE-RETIRE-DESIGN-001.md), merged to `main` in PR #139 as merge commit `1df0ef5c86d499698270c51de0fec3896a9c54d4` (first parent of the PR #140 merge). The design controls if this briefing conflicts with it.
**Backend dependency:** [Slice 5A closure record](TIIZI-FER-P5T-2-S5A-CLOSURE-AND-MERGE-RECORD-001.md).

## 1. Purpose and boundary

Assemble the existing Operator Template Library, Draft Editor, server validation and preview into the author workflow for **publish, revise and retire**. This slice is frontend-only and consumes the Slice 5A endpoints. Do not add or alter API routes, database schema, migrations, authority rules, Template validation or Challenge establishment.

Slice 5B does not include Slice 6 adoption reporting or audit-history presentation; P5T-3 member flows; P5T-4 integrated preview; real author activation; deployment; persistent database migration; or roster seeding. Migration 030 remains undeployed and the real author roster remains inactive.

## 2. Product flow and authority

### Publish an open draft

- Require an author capability from the existing server capability read; hide author controls for Console readers and ordinary members. Keep the API authoritative if the capability changes after load.
- Publish is enabled only when the draft is saved, the latest validation passed, the validation result is still fresh for the exact draft token, and no conflict/revocation/loading state is active.
- Send `If-Match: "<revisionToken>"` from the validation/save state. Use the new optional publish precondition in Slice 5A. Do not substitute a locally calculated token or issue publish from a stale validation.
- Display `422 invalid_template` using the existing step-mapped issues. Leave the draft open and unpublished.
- On `409 template_draft_changed`, reuse the Slice 3b reconciliation panel, preserve local work, reconcile against `details.current`, save with its current token, and require a fresh validation before publish.
- On `409 template_version_immutable`, `409 template_retired`, `403`, or `404`, refetch and render the resulting authoritative state. For network error/503, treat the outcome as unknown: reread before offering another publish attempt.

### Revise a published Template

- Offer Revise only for an eligible published Template without an open draft and while the current user has `canAuthor`.
- Create the next draft through the existing revise endpoint. On `template_draft_open`, open the server-provided/current draft if available; on `template_not_published` or `template_retired`, refetch and remove the action.
- Do not change published content in place. Reuse the existing draft editor, conditional save, preview and validation workflow for the new draft.

### Retire or discard a Template

- For an active author, offer retirement for every non-retired Template in `draft` or `published` lifecycle. For a never-published draft, use the approved presentation **“Discard this unpublished Template”**; this action retires the Template because no delete operation exists. For a published Template, present Retire. Retirement is terminal, hides the Template from the member catalogue, and does not change existing Challenges.
- Require explicit confirmation for either action and preserve Cancel as a no-write action. If the Template has an open draft based on a published version, warn that it will remain but cannot be saved or published after retirement.
- The reason is optional. An empty or whitespace-only UI field is permitted; omit `reason` from the request body when its trimmed value is empty, because the merged API treats an absent reason as null and rejects an explicitly supplied empty string. When a non-empty reason is supplied, trim it and enforce the design's 500-character limit on the untrimmed input, matching the server contract.
- After success, refetch and show the retired read-only state. On a network error/503, reread first because the retire result may have committed. A second retire returns the already-retired state; it must not be presented as a generic failure.

### Needs-revision indicator

- In the selected Template detail only, use the existing authenticated member read when the already-loaded detail says it is published and has a latest published version. Show a display label when `adoptable === false`; frontend code displays the reason code and does not implement eligibility logic.
- A 404 produces no indicator and does not determine lifecycle. A read failure shows “indicator unavailable” and does not block other Library actions. Cache for the panel session; avoid refetch-on-focus because this read performs server validation work.
- When an open draft exists, link to it instead of offering Revise. Do not add per-row requests or list badges in this slice.

## 3. Existing implementation surfaces

Begin only after separate implementation authorization. At that time, inspect these merged surfaces on the then-current `main` and verify line locations before editing:

| Surface | Intended 5B responsibility |
| --- | --- |
| `src/v2/operator/templates/OperatorTemplateLibrary.tsx` | Author actions, detail-level needs-revision state, publish/revise/retire entry points and permission-specific states |
| `src/v2/operator/templates/TemplateDraftEditor.tsx` | Publish readiness, token-bound action and existing conflict/validation flows |
| `src/v2/operator/templates/TemplateValidationPanel.tsx` | Reuse mapped server issues; no client-side validation authority |
| `src/v2/operator/templates/TemplatePreviewPage.tsx` and `TemplatePreview.tsx` | Preserve existing read-only preview semantics and author/reader boundary |
| `src/v2/operator/templates/templateLibraryModel.ts` and `templateAuthoringModel.ts` | Pure presentation state only if needed; do not create a parallel domain authority |
| `scripts/testV2OperatorTemplatesGuards.ts` | Narrowly relax guard coverage for exactly publish/revise/retire and the one needs-revision read, as required by the design |

Use the existing Operator Template API client and existing response types. If an endpoint, response shape or authority behavior differs from the merged design, stop for a separate R2 assessment; do not silently broaden this slice.

## 4. Required verification after authorization

- DOM/unit coverage for fresh-token publish enablement; successful publish; stale-token conflict and reconciliation; mapped 422 issues; already-published/retired and revoked-author states; unknown publish/retire outcomes followed by a read; revise conflicts; published retirement and draft-only **“Discard this unpublished Template”**; optional empty reason omitted from the body; supplied reason trimming and 500-character boundary; confirmation and cancellation; needs-revision true/false/404/failure; reader/member controls absent; and preservation of Slice 3b/4 behavior.
- Guard updates that permit only the designed three writes and the one needs-revision read. Retain no-member-write and no-Challenge-establishment constraints.
- Run the affected DOM/unit suites, Template guards, member Wizard boundary/regression checks, typecheck/build and the six required CI checks on the exact implementation head. The PostgreSQL concurrency suite is a Slice 5A backend verification and is not replaced by frontend tests.
- Browser acceptance on a verified disposable database: author publish, revise and retire; concurrent save before publish and recovery; publish validation failure; needs-revision state; reader and ordinary-member read-only states; revoked-author behavior; and widths 1280, 900 and 390. Do not use a persistent database or active roster.
- Obtain an independent R1 review of the exact final head before any merge request is presented for approval.

## 5. Review gates and prohibitions

Technical Lead review must accept this boundary and the Slice 5A closure evidence before implementation authorization is considered. A separate implementation authorization is required; this briefing does not provide it. Keep the design's R2 security guarantees intact and escalate any backend or authorization change for a distinct R2 assessment. Do not start Slice 6, deploy, migrate a persistent database, seed or activate the author roster, or represent issue #137 evidence as transferred. Issue #137 remains open until the existing off-machine evidence-transfer obligation is completed and checksum-verified.
