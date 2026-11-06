# TIIZI V2 MEDIA-1 — Design Closure and Governance Reconciliation 001

**Reference:** TIIZI-V2-MEDIA-UPLOAD-INTEGRATION-ASSESSMENT-001
**Date:** 2026-11-06
**Status:** **GOVERNANCE RECONCILIATION — TECHNICAL LEAD REVIEW; NO BUILD**
**Repository:** `Fkenogo/tiizi_challenges`
**Verified remote baseline:** `origin/main` / `51ec762643cc0feff150a719e89c8b97f4233927`
**Worktree:** `/private/tmp/tiizi-v2-media-assessment-001`
**Programme:** FER-001-B P6 — Shared media; MEDIA-1 design closure

## 1. Decision summary

P6 remains the single shared capability for optional Profile photos, Group covers, and Challenge covers. Use Tiizi-owned asset references and a provider-neutral object-store port, with Cloudflare R2 as the provider already selected by FD-MC-07a. The Founder’s preference to use the existing paid Miledge Ventures account is an account-placement direction for planning; it does not itself authorize creating Tiizi buckets, tokens, environments, code, or production use.

Recommended technical default (not a new Founder decision): API-mediated upload into private, environment-isolated R2 buckets; server decode/re-encode; PostgreSQL asset metadata and scope references; server authorization on upload and every read; short-lived signed reads; atomic reference swap before old-object deletion; synthetic-only preview. Keep catalogue covers and initials as fallbacks. Keep Template authoring on its allowlisted `cover_id` contract. Exclude Today image placement.

This document refines the existing assessment and MEDIA-1 record. It creates no new programme authority. Defaults below are technical recommendations for Technical Lead/Architecture review, not new Founder decisions unless they change approved product scope, authorize resources/spend, or authorize a package.

## 2. Repository and authority reconciliation

### 2.1 Baseline and safety

| Check | Result |
|---|---|
| Latest fetched `origin/main` | `51ec762643cc0feff150a719e89c8b97f4233927` |
| Assessment branch / HEAD | `docs/tiizi-v2-media-assessment-001` / `51ec762643cc0feff150a719e89c8b97f4233927` |
| Ancestry | HEAD equals `origin/main`; merge base is the same SHA |
| Worktree state before reconciliation | The two supplied media documents were untracked; no tracked changes |
| Original checkout | Not modified by this work |

The assessment branch remains at the verified baseline; no rebase, reset, merge, checkout switch, or cleanup was performed. Both supplied documents are preserved and reconciled in place.

### 2.2 Governing records and current constraints

- `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §§8, 17 and FER-001-A FDR-03 establish optional Profile/Group/Challenge uploads as required for CPE, with no upload requirement for Members. Images are visible only where their identity/scope is authorized; Profile is not anonymously public by default; Group and Challenge covers inherit their current governed visibility.
- FD-MC-07a in the same disposition and `docs/programme/TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §3 select Cloudflare R2 as Tiizi’s initial object store behind a provider-neutral port. PostgreSQL references are canonical; provider URLs are not. Cloudflare Images/transformations are optional, not a dependency. R2 resources and credentials still require separate authorization.
- FD-MC-07/07a and the MEDIA-1 record settle scope ownership and mutation: Member owns their Profile image; Group owns its cover; Challenge owns its cover. The uploader is audit attribution for Group/Challenge, not the asset owner. Member changes own Profile image; Accountable Steward changes Group cover; eligible current Group-authorized Challenge creator may set cover during establishment; Accountable Steward may replace/remove throughout Challenge lifecycle.
- Profile image removal occurs at `deleted-anonymized`; Group/Challenge media follows its own scope lifecycle and is not removed merely because the uploader leaves or closes an account. Exact purge timing, backups, retries and LIFE-1 coordination remain open.
- FDR-03 and FER-001-B require P6 before CPE; the pilot limits users, not features. FER-001-B sequence is P5T → P6 → P7. P5T and P6 both own migrations and must not overlap. At this baseline P5T is **not complete**: Slice 5A is merged, Slice 5B is only a briefing and is not authorized, Slice 6 is not started, and migration 030 is undeployed. PR #143 is open. No P6 implementation can begin until P5T completes and a separate P6 slice is authorized.
- `docs/programme/TIIZI-FER-TPL-001-CHALLENGE-TEMPLATE-CAPABILITY-ALIGNMENT.md` keeps Templates on allowlisted `cover_id`. No upload UI or media library belongs in P5T. Any later Template reference to a P6 asset needs separate scope decisions; it is outside this package.
- MV-206 v0.1 (blob `1c1144e78d8446c19a6aecd415ef5fb8c227df85`) is Miledge guidance, not Tiizi authority. Its private-by-default, product-owned authorization/lifecycle, server-side validation, scoped credentials, replace-then-delete, orphan cleanup and cost attribution principles are consistent with the above and inform the proposals below.

The accepted V2 runtime remains `/v2/*` and `/api/*`, with PostgreSQL as domain authority and Firebase Auth for identity only. V1 Firebase upload code is excluded. No newly discovered conflict with approved Profile, Group, Challenge, Template, or media rules was found. The only material correction to avoid is treating the former “R2 candidate” framing as current: R2 is already selected in Tiizi authority; account/resource use remains gated.

### 2.3 Decision reconciliation

| Decision | Governing record / status | Effective date / supersession | Current implementation |
|---|---|---|---|
| Optional Profile, Group and Challenge images required for CPE; no Member must upload | FER-001-A FDR-03; Founder decision | 2026-10-28, effective on PR #108 merge to `main`; supersedes the earlier pilot-only deferral | Upload capability missing; catalogue/initials fallback exists |
| Cloudflare R2 initial provider behind provider-neutral ObjectStore; PostgreSQL references; Images transformations optional | FD-MC-07a, Disposition §8.1; effective Founder decision | Recorded 2026-10-10; no supersession found | Provider selected; no Tiizi bucket, adapter, endpoint or credentials |
| Profile/Group/Challenge visibility and permitted mutators | FD-MC-07a, Disposition §8.3; effective | Recorded 2026-10-10 | Catalogue mutations exist; uploaded-media read/write paths missing |
| Scope ownership; Profile removal at `deleted-anonymized`; Group/Challenge media follows scope lifecycle and survives uploader deletion as required | Disposition §8.5; incorporated at Master Programme v2.56 | 2026-10-10; effective | No uploaded-media persistence/deletion path |
| Challenge cover creator authority requires current eligible Group relationship; Steward may replace/remove during lifecycle | Disposition §8.6; incorporated at Master Programme v2.57 | 2026-10-10; effective | Catalogue choice exists; uploaded asset authority absent |
| Template cover remains allowlisted `cover_id`; P5T has no upload; P5T precedes P6 | FD-TPL / TPL-001; FER-001-B Amendment 002 | Founder direction 2026-10-28; effective in merged programme | No Template upload; P5T incomplete |
| P6 required for CPE; sequence P5T → P6 → P7; separate package authorization | FER-001-B §§3, P6; Master Programme | Effective 2026-10-28 | P6 not started; P5T remains incomplete/not authorized |
| R2 account, credentials, non-production resources, and live use require separate authorization | FDR-03 / FER-001-A and FER-001-B P6 | Effective 2026-10-28 | No Tiizi resources or credentials |
| Upload mode, exact limits/variants, delivery mechanics, retention/takedown, budget/ops and proof specifics | Open MEDIA-1 technical decisions, Disposition §8.4; earlier values remain proposals | No approval date found | Not implemented |

The Founder’s direction preferring the existing paid Miledge account is planning context and supersedes the earlier uncertainty about preferred account placement. It does not itself authorize account access, resource creation, credentials, spend or implementation. FEF-TLC-001 is explicitly an unmerged team-working candidate; `AGENTS.md` and the Master Programme remain governing. FEF alignment does not replace Tiizi decision authority.

**Authority gap:** MEDIA-1 identifies technical questions but the reviewed effective programme records do not assign a named decision recorder/approver for those engineering defaults. This is a process/ownership gap, not a product-policy conflict and not a reason to return settled decisions to the Founder. The Technical Lead should assign the existing authorized technical/domain owners and record the resulting choices in the existing media decision record. The FEF-TLC role model cannot fill that gap because it is not effective.

### 2.4 Relevant open PRs

As of this review, open PRs returned by GitHub were #150, #145, #143, #107, and #94. None is media implementation. #150/#145 touch Today and Challenge presentation; #107 touches Profile/Group/Today; #143 is P5T and is the sequencing dependency; #94 concerns CI documentation. Recheck current heads and diffs immediately before any authorized implementation. Do not treat unmerged PR content as accepted authority. Today image placement is expressly excluded here.

## 3. Approved rules versus recommended defaults

| Topic | Approved rule | Proposed technical default for review by Technical Lead and applicable domain owners |
|---|---|---|
| Capability | One P6 capability; optional upload; fallbacks retained; required for CPE | One reusable picker/API contract with purpose-specific crop presentation and authorization |
| Provider | R2 selected behind neutral ObjectStore port (FD-MC-07a) | Plan isolated Tiizi buckets in the existing Miledge account, subject to separate resource/spend approval; adapter remains replaceable |
| Creation timing | Group/Challenge scope ownership and authorized actors are settled | Upload to a short-lived pending asset before record creation; bind it atomically during authorized create; if create fails/abandoned, expire and clean pending bytes |
| Upload transfer | Open technical decision in MEDIA-1 | API-mediated multipart upload for first release; no browser object-store credentials. Revisit direct scoped upload only with measured API capacity evidence |
| Formats/limits | Open technical decision in MEDIA-1 | JPEG, PNG, WebP; reject SVG/active formats; 5 MiB compressed input and 25 MP decoded ceiling as initial proof caps; actual decode, orientation normalization, metadata stripping and re-encode required |
| Variants | Open technical decision in MEDIA-1 | Profile square 64/128/256 px; cover widths 480/960/1440 px in existing UI ratio; normalized outputs only, no original retention by default. Validate dimensions against current surfaces before implementation |
| Read delivery | Visibility inheritance settled; mechanism open | Re-authorize each read, then issue 60-second signed GET for exact immutable object/variant. `Cache-Control: private, max-age=60, must-revalidate`; no shared/public CDN cache for private or mixed audiences. Measure the maximum revocation window and use API streaming if this is unacceptable |
| Replacement/removal | Authorized actors and replace-then-delete principle settled in MEDIA-1 | Prepare new object, validate, transactionally swap domain reference, then mark old object for deletion; keep old usable on any failure. Removal clears reference before delete and returns existing fallback |
| Preview | Synthetic isolated preview; no production user images | Local UX uses generated fixtures/mock service only. Real R2 proof only in isolated non-production account/bucket/data after explicit gate |

The 60-second URL lifetime and 60-second private cache are proposed measurable bounds, not existing policy. Signed URL revocation is not immediate; an already issued URL may work until expiry. Cloudflare cache must be bypassed for private assets. If the chosen R2 signing/delivery configuration cannot enforce these semantics, serve through an authenticated API endpoint rather than weakening visibility.

## 4. Technical closure proposals

### 4.1 Creation before target record exists

The browser asks the API to create an upload intent with purpose, but the server derives the actor and permits only the intended creation flow; it does not trust a client-supplied owner or role. API accepts, validates and stores a pending object with random key and short-lived intent ID. On Group/Challenge establishment, the existing create transaction attaches the pending asset to the newly created scope only after all existing domain validation and authorization pass. The attachment must not create or establish the record independently.

Recommended intent expiry: 24 hours, with no public read and no domain attachment until commit. An abandoned wizard leaves only pending bytes; cleanup removes them after intent expiry plus a 24-hour safety grace and confirms no database reference. Retry uses the same intent/idempotency key and returns the same pending result rather than duplicating assets. If attachment transaction fails, record remains pending and retryable; existing wizard draft/creation behavior remains intact. The upload is optional; cancellation or upload failure falls through to the existing gradient/initials selection.

This is a proposed lifecycle, not an approved wizard rule. It preserves the current creation journeys and adds no new wizard step. Group and Challenge creation endpoints must implement the bind in their existing established transaction boundary; if that cannot be done atomically, reject and retain pending intent for retry rather than leave a dangling scope association.

### 4.2 Attach, replace, removal and consistency

Store a stable Tiizi asset ID and scope/purpose/status/metadata. Store opaque object keys, not URLs or credentials. During create, the target row and asset association commit together. For later replacement, validate/store new object first, then commit current-asset pointer and audit state in one database transaction, and only then enqueue old object deletion. Removal clears the pointer and restores catalogue/initial fallback first, then schedules object deletion. Failed storage writes never attach; failed DB commit leaves a pending orphan for reconciliation; failed deletion is retried and alerted. All commands are idempotent and actor/scope rechecked at each attempt.

Do not promise an unsupported restore SLA. Keep old bytes only through a bounded rollback/grace window after swap (recommend 24 hours), then purge. Backup copies, legal holds and purge timelines require LIFE-1 and data-protection alignment before implementation.

### 4.3 Image validation and transformation

Proposal for first proof: JPEG/PNG/WebP input, 5 MiB maximum compressed size and 25 megapixels maximum decoded dimensions; reject SVG, animated/active formats, malformed/polyglot content, unsupported encodings and decompression bombs. Browser extension/MIME is advisory only. Server decodes before storage, enforces limits before large allocations, applies EXIF orientation, strips EXIF/GPS and other unnecessary metadata, re-encodes to JPEG or WebP according to an approved output policy, and creates fixed derivatives. Accept HEIC only if the selected server library can safely and consistently decode/re-encode on supported deployment targets; otherwise show a clear unsupported-format message. No original is retained by default.

The numbers and variant dimensions are starting proposals inherited from MEDIA-1, not accepted requirements. The frontend and QA must validate crops against Profile square and the cover ratio already shown in the app, including narrow phones, before the values are frozen. Malware scanning is threat-based and does not replace decoding and re-encoding.

### 4.4 Authorization and private reads

Upload intent, byte upload, finalize/bind, read, replace and remove all resolve a verified authenticated actor server-side. Profile mutation is self-only. Group mutation requires current Accountable Steward. Challenge creation attachment requires the existing eligible Group relationship at establishment; later Challenge mutation follows FD-MC-07a. Read entitlement follows current Member identity authorization, Group visibility/membership and Challenge visibility, respectively. Recheck on every URL issuance; guessed IDs and substituted scope IDs fail closed.

Recommended read token: exact object and method, expires 60 seconds; no list/write capability. Keep signature out of logs and analytics. Set private cache max-age to no more than URL TTL; no shared cache for private/mixed visibility; cache immutable normalized object key only within that private boundary. Test role removal, Group privacy changes and Challenge visibility changes. Maximum residual access after a policy change is the measured outstanding token/cache lifetime, targeted at ≤60 seconds. If CDN behavior cannot be shown to honor this bound, bypass it. There is no anonymous Profile photo path by default.

### 4.5 Cleanup and operations

Use explicit states such as pending, ready, delete-pending, deleted, rejected; an authoritative database reference check precedes delete. Recommend a cleanup job every 6 hours; delete expired pending objects after 24-hour intent expiry plus 24-hour grace. Retry transient failures with bounded exponential backoff (for example 1m, 5m, 30m, 2h, then hourly) and alert after 24 hours or repeated permanent failure. A daily reconciliation compares pending/delete-pending records with object metadata and reports untracked objects; it must never mass-delete based only on bucket listing. Rate-limit and quota by actor/scope and report unusual upload volume.

FER-001-B flags BG-1 for scheduled orphan cleanup. P6 must either depend on BG-1 before scheduling this worker or receive a separately reviewed, owned manual cleanup procedure accepted for bounded preview. Name an operational owner before real integration. Logs record actor, scope, asset ID, operation and outcome only—not bytes, tokens, or signed URLs.

### 4.6 Deletion and retention

Profile image bytes and reference are removed when the Member reaches approved `deleted-anonymized` state; implement through the LIFE-1 account lifecycle and honor backup purge policy once defined. A pending Profile upload is also removed. Group/Challenge assets remain when their governed entity/history requires them even if uploader is deleted/anonymized. Group/Challenge deletion, archive/retirement, historical display and restoration behavior follow those entity lifecycles; media introduces no new entity retention rule. Operator takedown/suppression, abuse report response, audit retention, legal holds and backup purge are unresolved operational/legal requirements and must be assigned before CPE.

### 4.7 Preview isolation

Three boundaries remain distinct: (1) local UX preview uses generated synthetic image fixtures and mock/in-memory service, with network/storage calls disabled; (2) real integration proof uses only an explicitly approved, isolated non-production Tiizi bucket and disposable synthetic Member/Group/Challenge data, credentials limited to that bucket, and isolated API configuration; (3) production is a separate release decision and is outside P6 preview. Non-production must have no production credentials, database, bucket access, copied photographs, or shared public hostname/cache. Add a startup guard rejecting production endpoint/account/bucket identifiers in preview and verify isolation by negative access tests. No production resources, data or real Member images are used.

## 5. Cloudflare R2 resource and environment proposal

This is a plan only. No resource names are provisioned or reserved.

| Environment | Proposed resource | Access/delivery |
|---|---|---|
| Local UX | No R2 resource; mock/in-memory adapter and generated fixture bytes | All external storage calls disabled |
| Isolated integration | Dedicated private bucket such as `tiizi-media-nonprod` in the Miledge account | Dedicated non-production API token scoped to this bucket only; synthetic data; no production access |
| Production (future, separately authorized) | Separate private bucket such as `tiizi-media-prod`; no reuse of non-production bucket/token | Separate production token and deployment secret set; production rollout requires independent Founder gate |

**Isolation:** Prefer separate buckets and tokens for non-production and production within the assumed Miledge account. Separate account remains the stronger option if billing attribution, legal ownership, access administration, or blast-radius requirements cannot be met in the shared account. Bucket names above are illustrative. Set location/jurisdiction only after residency/legal review; keep Standard storage initially. Block public access; do not enable `r2.dev`, public bucket, or public custom domain for private/mixed assets. Do not attach Cloudflare Images transformations for the first proof; evaluate only if measured need warrants the added service and policy.

**API configuration (names only; no values or secrets):** `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `MEDIA_PUBLIC_DELIVERY_BASE_URL` only if a separately approved public-only asset path is later introduced, `MEDIA_UPLOAD_MAX_BYTES`, `MEDIA_UPLOAD_MAX_PIXELS`, `MEDIA_READ_URL_TTL_SECONDS`, and `MEDIA_PENDING_TTL_HOURS`. Local preview has mock configuration and must fail closed if any production values are present. Store secrets only in the approved server-side secret manager/deployment environment; never in browser bundles, database rows, source control, URLs or logs.

**Minimum privilege:** For API-mediated upload and cleanup, an environment-specific R2 token scoped to one bucket with only object read/write capability needed by the service; no account administration, bucket creation, billing, analytics, or access to other buckets. Confirm exact Cloudflare permission mapping when creating the token. If API issues presigned reads, sign only read requests for one opaque object key and short expiry; clients receive no general R2 credentials. Separate production and non-production tokens. Limit credential visibility to named account owner and designated backend/deployment operators; rotate on staff/role change, suspected exposure, and a documented periodic schedule (recommend 90 days initially). Rotation procedure must overlap old/new credentials safely and verify revocation.

**Monitoring and attribution:** Tag/label resources `product=tiizi`, `environment=nonprod|prod`, `owner=tiizi-platform`; record monthly storage GB, Class A/B operations, bytes per asset/variant, upload/read/replacement/deletion counts, API processing CPU/memory, failure/retry/orphan counts. Named Miledge account operator and Tiizi budget owner review monthly. Configure account budget alerts at Founder-approved thresholds; Cloudflare billing alert support/semantics must be verified because R2 usage may be pooled/account-wide. Attribute Tiizi use using per-bucket operational metrics and maintain a cost ledger. Existing paid-account allowances may already be consumed; do not assume Tiizi has free headroom. Recheck rates at procurement time. Prior assessment’s 2026-11-06 price snapshot: Standard $0.015/GB-month, Class A $4.50/million, Class B $0.36/million, internet egress free, with published monthly included allowances of 10 GB-month, 1m Class A and 10m Class B; these figures and plan terms require current verification. API compute, engineering, monitoring and legal costs are additional.

**Eventual manual Cloudflare Console actions (not performed):**

1. Account owner confirms Miledge-account use, authority, billing treatment, region/residency and Tiizi access boundary; if not acceptable, stop and provision nothing pending separate account decision.
2. In R2, create the private non-production bucket; choose approved location; leave public access and `r2.dev` disabled; do not configure custom domain or public cache.
3. Create an R2 API token restricted to that bucket and minimum object permissions; name it for Tiizi non-production; record owner and rotation date in approved secret inventory.
4. Put the token values into the approved non-production secret manager only; configure API account/endpoint/bucket identifiers there; do not transmit secrets in chat or commit them.
5. Validate non-production can read/write/delete only test objects in its bucket and is denied against all other buckets and production; verify logs redact signatures.
6. Review usage/billing view, establish a baseline and alert/owner; verify whether account-level included usage is already consumed and how Tiizi spend is attributed.
7. Only after independent production authorization, repeat with a distinct production bucket/token/deployment secret set and production access review. Do not copy non-production objects or keys.

## 6. Product integration boundaries

| Surface | Integration point | Authority/display | Fallback and boundary |
|---|---|---|---|
| Profile | Existing V2 Profile image slot and `/api/me` image contract | Member self-edit; display only in Member identity projections where identity is already authorized | Initials fallback; no public directory/photo URL; no completion gate |
| Group | Existing cover area in Group creation; replace/remove in Group Settings; display on Group cards, Group Home and authorized Group discovery/context | Current Accountable Steward mutates; visibility follows Group policy | Keep `cover_id` gradient/default; no private Group image disclosure in discovery |
| Challenge | Existing Name & Appearance/background field in creation wizard; display on Challenge detail and discovery/list surfaces | Current eligible creator at establishment; Group Accountable Steward may replace/remove for lifecycle; reads follow Challenge visibility | Keep `cover_id` gradient/default; Today placement excluded; no wizard step or semantic validation change |
| Template | No integration in this package | Existing operator `cover_id` allowlist remains | No upload field, media library, or altered provenance in P5T |

One reusable picker is appropriate for selection, client-side preview, progress, retry, replace and remove presentation. Purpose-specific aspect framing/fallback labels may differ. UI gating is convenience only; the API owns every authorization decision. Do not modify approved Group/Challenge creation journeys beyond these image integration points.

## 7. Bounded implementation packages and gates

No work package below is authorized by this document. FER-001-B sequence and package ownership remain authoritative.

| Slice | Responsibility / deliverable | Dependencies and migration ownership | Exit gate |
|---|---|---|---|
| MEDIA-1 decision closure | Technical Lead/Architecture record bounded technical defaults and owner assignments in existing governance; identify only policy/resource gates requiring Founder action | No code/migration; current decision sources remain authoritative | Technical Lead review; Founder action only for product-policy changes or resource/spend/package authorization |
| MEDIA-2a shared backend | Backend: ObjectStore port/R2 adapter, intent/pending lifecycle, media metadata and references, server processing, auth/read/replace/remove, cleanup hooks, observability; fake-store/API/DB tests | P5T complete; MEDIA-1 approved; P1a dependency recognized; separate non-production account/token/budget approval. Owns its single sequential migration. Must not overlap P5T or P7 migrations. BG-1 or approved bounded cleanup procedure | Independent backend/security and DB review; migration/recovery and rollback demonstrated in disposable DB; isolated R2 proof passed |
| MEDIA-2b Profile | Frontend Profile slot/picker and authorized identity reads; backend binds existing Profile API and LIFE-1 deletion path | 2a; P1a Profile surface and canonical identity contract; no new migration unless explicitly assigned | Cross-member/privacy tests; initials fallback; lifecycle evidence; independent review |
| MEDIA-2c Group | Frontend existing creation cover selection, Group Settings replace/remove, Group Home/cards/authorized discovery reads; backend current Steward checks and Group visibility | 2a; P4 Group surfaces/API; recheck PR overlaps; no Today or Template scope | Cross-Group and stale-Steward tests; catalogue fallback; independent review |
| MEDIA-2d Challenge | Frontend existing Name & Appearance, detail/list/discovery reads; backend current creator eligibility at establishment and Steward lifecycle authority | 2a; P5 corrections and P5T completion; P7 migration sequencing respected; recheck PR overlaps | Departed-creator and cross-Group tests; Challenge visibility; fallback; no Today/Template scope; independent review |
| MEDIA-3 Founder Preview | End-to-end synthetic journeys, local mock preview plus isolated real-R2 proof, iOS Safari/Android Chrome/desktop evidence | 2b–2d; isolated environment approved; no production access | Founder accepts media behavior and evidence for each surface; acceptance does not authorize production |
| Production readiness/release | Separate migration/deployment/privacy/legal/operations plan, monitoring, restore/rollback, named on-call and data handling | CPE, LIFE-1/legal gates and explicit release authorization; not part of preview | Separate Founder production authorization and post-deploy verification |

**Security/privacy tests:** authorized and unauthorized upload for each scope; forged IDs; stale role/departed creator; invalid MIME/signature/malformed/SVG/oversized/excessive pixels; metadata stripping; cross-member and cross-Group read; Group privacy/member revocation; Challenge visibility change; signed URL TTL/cache bound; replacement/remove atomicity; duplicate retry; failed storage/DB; orphan/failed-delete reconciliation; Profile deleted-anonymized behavior; Group/Challenge persistence after uploader deletion; production credential/bucket inaccessible from non-production.

**Rollback and cleanup:** retain old asset until new pointer commit; make feature optional behind server capability/config with catalogue fallback; rollback app path to fallback without corrupting entity state; migration down/forward recovery must be reviewed before execution; inventory pending objects and reference state before cleanup; deletion job has dry-run/report mode and never bulk-deletes unreferenced keys without authoritative reconciliation. R2 proof bucket can be emptied and token revoked after Founder acceptance using an auditable, bucket-scoped cleanup procedure. No production rollback or deletion is implied by preview acceptance.

## 8. Decisions and authorization boundaries

The existing decisions on optionality/CPE requirement, R2 provider, scope ownership and mutators, visibility inheritance/private Profile baseline, Profile deletion boundary, Group/Challenge retention, fallbacks, Template `cover_id`, and P5T-before-P6 are settled. Do not ask the Founder to re-confirm them.

Genuine Founder/authorized resource or policy approval is required before:

1. **Non-production resource authorization:** approve later creation of an isolated R2 bucket/token and bounded spend; identify account operator and cost owner. Founder preference for the Miledge account is clear, but resource use is still gated.
2. **Production authorization:** production resources, credentials, live Member images, deployment and production spend require separate existing package/release authorization. Nothing here grants it.
3. **Product/privacy policy changes:** only if proposed retention, backup purge, takedown/reporting, audit or consent arrangements change approved policy or cannot be resolved by existing LIFE-1/privacy/legal owners. Route those through the existing Founder disposition process before release.

Upload mode, formats/limits, variants/crop, delivery mechanics, pending/orphan/retry and replacement mechanics are open MEDIA-1 technical decisions, not automatically Founder decisions. The Technical Lead should obtain recommendations from applicable domain and operational owners and route decisions through existing governance, escalating only a product-policy, resource/spend or authority change. Values such as 5 MiB/25 MP and 60 seconds remain proposals until that process records them. FEF-TLC-001 role titles are not invoked as binding authority because that candidate is unmerged.

No new Founder decision is needed to re-approve settled optionality, scope ownership, authorized mutation, visibility inheritance, R2 provider, fallbacks, or Template `cover_id`. Today image placement is excluded; add it only through separate experience approval.

## 9. Risks and unresolved dependencies

- **P5T sequencing is the immediate blocker:** Slice 5B is not authorized and Slice 6 is incomplete; migration 030 remains undeployed. P6 migration work must wait until P5T completion and separate authorization.
- **Identity/Profile dependency:** P1a and canonical identity projection must provide authorized image consumption; LIFE-1 defines deletion behavior. The current Profile API slot is `not_configured`.
- **Cleanup dependency:** BG-1 is needed for scheduled orphan cleanup; otherwise an explicit reviewed manual proof procedure is needed before preview.
- **Revocation/caching:** signed URLs necessarily create a bounded exposure window. Prove expiry and ensure private responses bypass shared caching; fail closed if not measurable.
- **Image processing capacity:** decoded pixel limits and API-mediated processing need memory/latency/load proof on deployment target. If unsuitable, reconsider scoped direct upload only with finalization and the same authorization requirements.
- **Shared-account governance:** account-wide allowances may already be consumed; resource billing attribution, support ownership and residency must be confirmed. No current price is guaranteed.
- **Privacy/legal and abuse handling:** Member photo processing, retention, deletion/backup, takedown and cross-border arrangements need named owners before real image proof or CPE.
- **Open PR overlap:** #107/#145/#150 may alter Profile, Challenge, discovery or Today surfaces; #143 affects P5T. Reconcile against merged `main` immediately before any future build.
- **Founder Preview identity:** no live local preview SHA/runtime is treated as authority in this design package. Preview testing must rebuild/use an explicitly isolated synthetic environment.

## 10. Document and repository status

These are reconciled supporting records for Technical Lead review. Neither changes the Master Programme, Founder Disposition, MEDIA-1 source record, or FER-001-B. Any approved decision must be entered through those existing governance records by the established owner; these documents are not a parallel decision registry. The original assessment remains preserved at `docs/programme/TIIZI-V2-MEDIA-UPLOAD-INTEGRATION-ASSESSMENT-001.md`.

**Reconciled source state before commit:** branch `docs/tiizi-v2-media-assessment-001`, HEAD `51ec762643cc0feff150a719e89c8b97f4233927`; `origin/main` is the same SHA; no ahead/behind commits. Only the two media documents are in scope. The original dirty checkout and all unrelated worktrees remain untouched. No implementation, migration, provisioning, or deployment occurred.

## Source register

- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (v2.89 at verified baseline), P5T/P6 sequence and P5T status.
- `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §§8, 17; FDR-03, FD-MC-07/07a, FD-TPL and scope/visibility rules.
- `docs/programme/TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md` — FDR decisions and separate authorization boundary.
- `docs/programme/TIIZI-FER-001-B-EXPERIENCE-RECOVERY-IMPLEMENTATION-PLAN-001.md` — sequence, P6 dependencies, tests and gates.
- `docs/programme/TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §§1–8 — provider, architecture and remaining MEDIA-1 decisions.
- `docs/programme/TIIZI-V2-MEDIA-UPLOAD-INTEGRATION-ASSESSMENT-001.md` §§1–14 — isolated technical assessment preserved by this package.
- `docs/programme/TIIZI-FER-TPL-001-CHALLENGE-TEMPLATE-CAPABILITY-ALIGNMENT.md` — Template `cover_id` boundary.
- `docs/programme/TIIZI-TECHNICAL-CONTROL-BOARD.md` — capability status and P5T/P6 dependencies.
- `docs/programme/TIIZI-FEF-TLC-001-TEAM-ACTIVATION.md` and `docs/governance/FEF-ALIGNMENT.md` — TLC is a not-effective candidate; FEF alignment does not displace Tiizi authority.
- `AGENTS.md` and `docs/programme/TIIZI-ECCL-PRG-01-AGENT-ENTRY-PILOT.md` — repository boundaries and source-state reconciliation controls.
- `docs/governance/domains/01-PROFILE-DOMAIN-STANDARD.md`, `02-GROUP-DOMAIN-STANDARD.md`, `03-CHALLENGE-DOMAIN-STANDARD.md` — domain visibility and authority.
- MV-206 v0.1, blob `1c1144e78d8446c19a6aecd415ef5fb8c227df85` — external Miledge guidance, not Tiizi authority.
- Cloudflare R2 pricing documentation: https://developers.cloudflare.com/r2/pricing/ (rates and account terms require current verification).
