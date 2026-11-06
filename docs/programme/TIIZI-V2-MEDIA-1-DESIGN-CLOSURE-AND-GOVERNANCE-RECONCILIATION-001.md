# TIIZI V2 MEDIA-1 — Design Closure and Governance Reconciliation 001

**Reference:** TIIZI-V2-MEDIA-1-CLOSURE-RECON-001 (Revision 2 — independent R1 corrections, CORR-001)
**Date:** 2026-11-06
**Status:** **SUPPORTING ASSESSMENT — FD-1/FD-2/FD-3 RECORDED; TECHNICAL LEAD DECISIONS AND FOUNDER-RESERVED PRIVACY/RESOURCE/PACKAGE DECISIONS PENDING; MEDIA-1 NOT CLOSED; NO BUILD**
**Repository:** `Fkenogo/tiizi_challenges`
**Verified remote baseline:** `origin/main` / `5722dadccd5fab18ddef2e40c284a8b5762ff2b9` (PR #154 merge; independently queried 2026-11-06)
**Programme:** FER-001-B P6 — Shared media; MEDIA-1 design closure
**Companion:** `TIIZI-V2-MEDIA-UPLOAD-INTEGRATION-ASSESSMENT-001.md` (reference `TIIZI-V2-MEDIA-001-CORR-001`)

**Revision note.** Revision 1 (PR #154 head `97c5789250c76b550a825f7aaae028ee0f967244`) described the MEDIA-1 technical specifics as Technical Lead decisions with no assigned decision owner, and described FEF-TLC-001 as unmerged. Revision 2 corrected those statements. PR #154 was reviewed at `eea2b8fc33780237c0b8f342acef7dd78cd8a9d5` and merged by `5722dadccd5fab18ddef2e40c284a8b5762ff2b9`. Founder decisions dated 2026-11-06 are now recorded in Disposition §18. This document remains a supporting assessment, not a separate decision registry.

## 1. Summary

P6 remains the single shared capability for optional Profile photos, Group covers and Challenge covers. Three layers must be kept distinct:

| Layer | Status | Source |
|---|---|---|
| **Provider selection** — Cloudflare R2 behind a provider-neutral `ObjectStore` port; PostgreSQL holds Tiizi-owned asset references | **Selected / effective** | FD-MC-07a, Disposition §8.1 |
| **Resource, credential and spend authorization** — account, buckets, tokens, budget | **Not granted.** Account owner, environments and cost ownership are listed as Founder inputs | FDR-03; Disposition §14; Media Assessment §7 |
| **Implementation and production authorization** — code, migration, deployment, live Member images | **Not granted.** Each slice needs separate written authorization | FER-001-B P6; Disposition §8.4 |
| **Technical-default accountability** | **Delegated to the Technical Lead (FD-1, 2026-11-06).** Recommendations remain proposals until assessed and explicitly recorded | Disposition §18.1; Media Assessment §9 |
| **Miledge account direction** | **Preferred for evaluation only (FD-2, 2026-11-06).** Conditional; no account/resource/spend approval | Disposition §18.2; this document §2.6 |
| **FEF-TLC-001 adoption/effectiveness approval** | **Confirmed 2026-11-06.** Operational role-assignment/activation prerequisite completion remains unverified | Disposition §18.3; FEF activation record |

**Technical defaults now sit with the Technical Lead under FD-1; privacy and resource policy remain Founder-reserved.** The earlier open list in Disposition §14 and Media Assessment §7 is superseded only as to technical-default accountability. The Technical Lead must assess and record the actual defaults in the existing `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §9. No prior proposed value is automatically approved. The Founder retains product scope, privacy/retention/takedown policy, account arrangement, spend/resources, package authorization and production/release authority.

The technical defaults in §§3–5 remain **proposals** pending Technical Lead assessment and recording under FD-1. The Founder-approved Miledge Ventures account direction is only an evaluation preference under FD-2; it creates no access, resource, credential or spend authorization and remains conditional on Disposition §8.2 (§2.6).

This document creates no programme authority and is not a decision registry. Neither this document nor its companion alters the Master Programme, the Founder Disposition, the MEDIA-1 source record or FER-001-B.

## 2. Repository and authority reconciliation

### 2.1 Baseline

- `origin/main` is `51ec762643cc0feff150a719e89c8b97f4233927`. Revision 1 of this PR was one commit ahead of it and zero behind. The original dirty checkout and unrelated worktrees were not modified.
- This is documentation only. No implementation, migration, V1, configuration, provisioning or deployment change is included.

### 2.2 Governing records and current constraints

- **Optional uploads (FDR-03).** `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §§8 and 17 and `TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md` FDR-03 make optional Profile (onboarding or Profile), Group and Challenge images required for CPE. No Member must upload. Images are visible only where identity or scope is authorized. Profile is not anonymously public by default. Group and Challenge covers inherit their governed visibility. FDR-03 took effect with the PR #108 merge (`a618d618dd784fcdbb41aff93650a0c9d84a66a0`, 2026-10-28).
- **Provider (FD-MC-07a).** Disposition §8.1 and `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §3 select Cloudflare R2 as the initial object store behind a provider-neutral port. PostgreSQL references are canonical and provider URLs are not. Cloudflare Images and transformations are optional. FDR-03 states R2 account, credentials, non-production environment and any live use require separate authorization.
- **Ownership and mutation (§§8.3, 8.5, 8.6).** The Member owns their Profile image. The Group owns its cover. The Challenge owns its cover. The uploader is audit attribution for Group and Challenge assets. A Member changes their own Profile image. The Accountable Steward changes the Group cover. The Challenge creator may set the cover during establishment only while holding an eligible current Group relationship. The Accountable Steward may replace or remove it throughout the Challenge lifecycle.
- **Lifecycle.** The Profile image is removed at `deleted-anonymized`. Group and Challenge media follows its scope lifecycle and is not removed merely because the uploader leaves. Purge timing, backups, retries and LIFE-1 coordination remain open.
- **Sequencing.** FER-001-B orders P5T → P6 → P7. P5T and P6 both own migrations and must not overlap. At Master Programme v2.89, Slice 5A is merged (PR #140), the Slice 5B frontend briefing is prepared for Technical Lead review and Slice 5B implementation is recorded as not started and not authorized, Slice 6 is not started and migration 030 is undeployed. See §2.7 for PR #143.
- **Templates.** `TIIZI-FER-TPL-001-CHALLENGE-TEMPLATE-CAPABILITY-ALIGNMENT.md` keeps Templates on allowlisted `cover_id`. No upload UI or media library belongs in P5T.
- **MV-206 v0.1** (blob `1c1144e78d8446c19a6aecd415ef5fb8c227df85`) is Miledge guidance voluntarily adopted as external architecture guidance only (Disposition §8.2). It is not Tiizi authority.

The accepted V2 runtime remains `/v2/*` and `/api/*`, with PostgreSQL as domain authority and Firebase Auth for identity only. V1 Firebase upload code is excluded. No conflict with approved Profile, Group, Challenge, Template or media rules was found.

### 2.3 Decision reconciliation

| Decision | Governing record | Status | Implementation |
|---|---|---|---|
| Optional Profile, Group, Challenge images required for CPE; no Member must upload | FDR-03 | Effective 2026-10-28 | Upload capability missing; catalogue and initials fallback exists |
| Cloudflare R2 initial provider behind provider-neutral port; PostgreSQL references; Images optional | FD-MC-07a, Disposition §8.1 | Effective (recorded 2026-10-10) | Provider selected only; no Tiizi bucket, adapter, endpoint or credential |
| Visibility and permitted mutators | Disposition §8.3 | Effective | Catalogue mutations exist; uploaded-media paths missing |
| Scope ownership; Profile removal at `deleted-anonymized`; Group and Challenge media survive uploader deletion | Disposition §8.5 | Effective (v2.56) | None |
| Challenge-cover creator authority and Steward override | Disposition §8.6 | Effective (v2.57) | Catalogue choice only |
| Template cover stays `cover_id`; P5T has no upload; P5T precedes P6 | FD-TPL, TPL-001, FER-001-B Amendment 002 | Effective | P5T incomplete |
| P6 required for CPE; sequence P5T → P6 → P7 | FER-001-B, Master Programme | Effective 2026-10-28 | P6 not started |
| R2 account, credentials, non-production resources and live use need separate authorization | FDR-03, FER-001-B P6 | Effective | No Tiizi resource or credential |
| Technical defaults: upload/delivery mechanics, processing limits, technical storage, concurrency/reliability and verification | FD-1 (Disposition §18.1); existing MEDIA-1 record §9 | Technical Lead accountability approved; no final defaults attributed/recorded yet | No code or resource |
| Privacy policy: deletion SLA, retention/backups, takedown/reporting, acceptable access-revocation window | Disposition §14; FD-1 Founder reservation; Privacy Decision Brief | Open and Founder-reserved; brief contains recommendations only | Not implemented |
| R2 account direction and ownership | FD-2 (Disposition §18.2); Disposition §8.2 | Miledge account preferred for evaluation only; final arrangement and account owner pending Founder review | No account access/resource |
| Spend, budget owner, bounded expenditure and resource/proof authorization | FD-2; Disposition §14; FER-001-B P6 | Founder-reserved and not authorized | No resource or spend |

### 2.4 MEDIA-1 authority after FD-1

Disposition §8.4 requires a Tiizi media decision record. The existing `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` is that MEDIA-1 authority; this supporting reconciliation document and its upload-integration companion are not competing decision registries. On 2026-11-06, FD-1 delegated accountability for technical design defaults to the Technical Lead, with consultation of existing engineering, security, product and domain owners as appropriate. Technical assessment and recommendation are recorded in the existing authority §9.

The §3–§5 values below and previous proposed technical values remain proposals. They are not decisions until the Technical Lead explicitly assesses, selects and records the value with its evidence/status in the existing MEDIA-1 authority. FD-1 does not expand product requirements or authorize build, migration, resource creation or deployment.

The Founder retains product scope/experience changes; privacy, retention, takedown/reporting and acceptable revocation-window policies; the final Cloudflare account arrangement and resource access; expenditure and budget; implementation package authorization; and production resources, credentials, live Member images, release and deployment. See the separate Founder Privacy Decision Brief. Today placement and any Template media reference still require separate product/experience approval.

### 2.5 FEF-TLC-001 Founder approval and activation evidence

| Event/prerequisite | Status/evidence |
|---|---|
| PR #106 merge | **Confirmed:** activation candidate merged by `542052c12ca7910a297da89f28ae01120b220980` on 2026-10-27 |
| Founder adoption/effectiveness approval | **Confirmed:** 2026-11-06, Member Completion Founder Disposition §18.3 |
| Role-assignment/activation completion date | **Not established.** Founder approval date and prerequisite-verification date are distinct |
| Technical Lead role assignment and the activation-record step-2 confirmation | **Not confirmed in an attributable current role-assignment record** |
| Programme Controller / Architecture & Decision Controller assignments | **Not confirmed in an attributable current role-assignment record** |
| Coding Agent / independent Code Reviewer functions | Framework recognizes these roles/functions; this does not create permanent person/account assignments. Independent per-task review remains required |
| Chief of Staff | Not an engineering approval gatekeeper; no operational-assessment completion claimed |

**Current status:** Founder adoption/effectiveness approval is confirmed, while required role-assignment and activation-prerequisite completion remains **unverified**. No role name or completion date is inferred. The activation document, `AGENTS.md`, `CLAUDE.md`, Master Programme and FEF alignment profile are reconciled to this distinction. No implementation authorization follows from the approval.

### 2.6 Tiizi independence (Disposition §8.2) and the Miledge account

Disposition §8.2 records that Tiizi voluntarily adopts MV-206 as external guidance only, that Miledge "acquires no Tiizi product authority", and that "Tiizi describes itself as independent of the Miledge portfolio". The Founder-reported preference is to place Tiizi media in the existing paid Miledge Cloudflare account. That preference:

- is not recorded in the Disposition, the Master Programme or any other governing record, and this PR is its only repository source;
- does not authorize account access, resource creation, credentials or spend;
- does not supersede the open Founder item "R2 account owner and environments" (Media Assessment §7).

Placing Tiizi data, credentials and billing inside a Miledge-controlled account touches the independence statement. Open points the Founder should dispose of:

| Point | Question |
|---|---|
| Legal ownership | Who owns the stored objects and the account contract relationship for Tiizi data? |
| Access administration | Which Miledge administrators could reach Tiizi buckets or tokens, and how is that limited? |
| Billing and cost attribution | How is Tiizi spend separated from pooled account usage and allowances (§5)? |
| Blast radius | What is the impact on Tiizi of a Miledge-account suspension, compromise or dispute? |
| Residency and legal basis | Where are objects held, and is the processing arrangement acceptable for Member photographs? |
| Exit | How are Tiizi buckets moved or severed if independence is required? |

**FD-2 direction (2026-11-06):** the existing Miledge Ventures Cloudflare account is preferred for evaluation only. The preference remains conditional on: (1) Tiizi independence under §8.2; (2) Tiizi-specific isolation; (3) separate non-production and production resources; (4) least-privilege credentials/access; (5) defined operational/legal ownership; (6) clear billing attribution/spending controls; and (7) acceptable cross-product security/operational risk. The Technical Lead prepares a resource and cost recommendation for Founder review.

No final account arrangement is selected. If a condition cannot be evidenced or is unacceptable, recommend a separate Tiizi account for Founder consideration and provision nothing. FD-2 does not authorize account access, buckets, credentials, Cloudflare Images or other infrastructure, spend or a bounded proof. Final arrangement, resource creation and expenditure require separate Founder authorization.

### 2.7 Open pull requests (point-in-time)

Before the PR #154 merge on 2026-11-06, GitHub listed open PRs #154, #150, #145, #143, #107 and #94. PR #154 was reviewed at `eea2b8fc33780237c0b8f342acef7dd78cd8a9d5` and merged by `5722dadccd5fab18ddef2e40c284a8b5762ff2b9`; the remaining PR references below are point-in-time facts and must be re-verified before any authorized implementation.

- #150 and #145 touch Today and Challenge presentation. #107 touches Profile, Group and Today. #94 concerns CI documentation. None adds media.
- #143 is the open Slice 5B operator Template lifecycle UI **implementation** PR (not draft). Master Programme v2.89 records Slice 5B implementation as not started and not authorized, with only the briefing prepared. PR #143's description says it implements "the approved lifecycle briefing" and must not merge without Founder authorization. This package does not resolve that difference. The sequencing dependency is unchanged: P5T must complete before P6.

Unmerged PR content is not accepted authority. Today image placement is excluded.

## 3. Proposed technical defaults — pending Technical Lead assessment under FD-1

These are recommendations for Technical Lead assessment under Founder-delegated accountability (Disposition §18.1). None is a final Technical Lead decision until explicitly selected and recorded in `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §9. They do not determine Founder-reserved product, privacy, resource, expenditure, implementation or production policy.

| Topic | Approved rule | Proposed default |
|---|---|---|
| Capability | One P6 capability; optional upload; fallbacks retained; required for CPE | One reusable picker and API contract, with purpose-specific framing and server authorization |
| Provider | R2 selected behind a neutral port (FD-MC-07a) | Isolated Tiizi buckets per environment. Account placement is a Founder item (§2.6). Separate resource and spend approval is required. The adapter stays replaceable |
| Creation timing | Group and Challenge ownership and actors are settled | Upload to a short-lived pending asset before the record exists. Bind it inside the authorized create transaction (§4.1) |
| Upload transfer | Technical Lead decision under FD-1 | API-mediated upload is the starting recommendation; scoped direct upload is an alternative only if verified capacity evidence supports it |
| Formats and limits | Product surface settled; technical limits await Technical Lead decision and verification | JPEG, PNG, WebP as a candidate allowlist; reject SVG/active formats; client resize plus server decode/re-encode. Numeric caps remain unapproved |
| Variants | Technical Lead decision subject to mobile-surface verification | 64/128/256 px Profile and 480/960/1440 px covers are proof candidates only; verify current ratios and phone crops before recording |
| Private read delivery | ARCH-001 settled direction: API-authorized, API-issued signed URLs | Short-lived object-specific signed reads; exact TTL, response cache policy and residual-access window require technical measurement and Founder privacy disposition (§4.4) |
| Replacement and removal | Replace-then-delete principle settled | Optimistic-concurrency pointer swap with immediate read suppression (§4.2) |
| Cloudflare Images | Optional (FD-MC-07a); evaluation is part of the bounded proof (Disposition §8.1, §8.4) | Optional evaluation item. Not a dependency of the base capability (§5) |
| Preview | Synthetic isolated preview; no production user images | Local mock and fixtures. Real R2 proof only in an authorized isolated non-production environment |

## 4. Technical closure proposals

### 4.1 Upload intents before the target record exists

An upload intent is created by the API for a purpose. It is:

- **bound** to the verified actor, the purpose and, for a Challenge cover, the target Group. The server derives the actor and never trusts a client-supplied owner, role or scope;
- **single-use**: once bound it cannot attach to a second scope, and a retry with the same idempotency key returns the same pending result;
- **limited** by a per-actor and per-scope quota on pending intents and bytes;
- **expiring**: proposed 24-hour intent expiry, then cleanup after a 24-hour grace and a database reference check.

At bind, inside the existing Group or Challenge creation transaction, the server **revalidates**: the actor, the purpose match, the intent is unexpired and unused, and for Challenge covers the creator's eligible *current* Group relationship (Disposition §8.6). Creator identity alone is not sufficient. The bind occurs only after all existing domain validation and authorization pass, and it never creates or establishes the record independently. If the bind cannot be made atomic, the create is rejected and the pending intent is retained for retry, leaving no dangling association. Upload is optional. Cancellation or failure falls back to the existing gradient or initials selection, and no wizard step is added.

### 4.2 Attach, replace, removal and consistency

- Store a stable Tiizi asset ID, scope, purpose, status and metadata, and opaque object keys rather than URLs or credentials. The target row and asset association commit together.
- **Replace** by validating and storing the new object first. Then, in one transaction, swap the current-asset pointer using **optimistic concurrency control** (a row version check, or `SELECT … FOR UPDATE` on the owning row) so that concurrent replace and remove calls cannot both succeed against a stale pointer. Enqueue deletion of the old object only after commit. Any failure leaves the old image usable.
- **Immediate read suppression.** The read path serves only the *current* ready asset. Once the pointer changes, or the asset is marked suppressed, reads fail closed at the next request. A grace-retained old object is never readable. Already-issued signed URLs and already-downloaded bytes cannot be recalled, and that residual is bounded as in §4.4.
- **Rollback grace versus purge override.** A bounded internal grace on old bytes after a swap (proposed 24 hours, retained for operational recovery only and never served) does not apply to takedown, abuse action, or `deleted-anonymized`. Those trigger immediate read suppression and a purge override. Backup copies, legal holds and purge timelines require LIFE-1 and privacy alignment, and no restore SLA is promised.
- **Removal** clears the pointer and restores the catalogue or initials fallback first, then schedules object deletion. All commands are idempotent and recheck the actor and scope on each attempt.

### 4.3 Image validation and transformation

- **Client side:** modern phone photographs commonly exceed 12 MP (often 48–50 MP) and 5 MB. The picker should downscale and re-encode in the browser before upload, targeting the largest variant needed with headroom. Raw originals are not uploaded.
- **Server side:** accept JPEG, PNG and WebP. Reject SVG, animated or active formats, malformed or polyglot content, unsupported encodings and decompression bombs. Treat extension and browser MIME as advisory. Decode with an input pixel limit enforced *before* allocation. Apply EXIF orientation, strip EXIF/GPS and unneeded metadata, and re-encode. Accept HEIC only if the chosen library decodes and re-encodes it safely on supported deployment targets.
- **Proposed starting limits, to be proven (not accepted requirements):** 5 MiB compressed input after client resize, and a lower server decoded ceiling of 12–16 MP. The earlier 25 MP proposal implies roughly 100 MB of RGBA per decode, so the ceiling, a **maximum concurrent decodes** limit, a per-decode **timeout**, and **decoder isolation** (worker or process) must be set from measured memory and latency on the deployment target, which is not yet specified. Malware scanning is threat-based and does not replace decode and re-encode.
- **Decisions still needed** (listed so they are not assumed): crop handling (client or server, and the aspect ratios per surface); colour space (for example, convert to sRGB); output format (JPEG or WebP policy); whether any original or master is retained (retaining none removes later re-cropping and re-derivation; retaining one adds a data-protection and storage cost); backup and disaster recovery for stored bytes; cleanup operation cost; and the asset state vocabulary (§4.5). Frontend and QA must validate crops against the Profile square and cover ratios on narrow phones before values are frozen.

### 4.4 Authorization and private reads

Upload intent, byte upload, bind, read, replace and remove each resolve a verified actor server-side. Profile mutation is self-only. Group mutation requires the current Accountable Steward. Challenge cover attachment at creation requires the eligible current Group relationship. Later Challenge mutation follows §8.6. Read entitlement follows current Member identity authorization, Group visibility and membership, and Challenge visibility. Guessed IDs and substituted scope IDs fail closed. There is no anonymous Profile photo path.

**Initial proposal — authenticated API delivery.** The API (or an authenticated Worker) authorizes each request and streams the exact normalized variant, with an `ETag` and `Cache-Control: private, no-cache`, so each use revalidates. A policy change takes effect on the next request. Residual exposure is limited to bytes already on the device. Costs are API egress and compute per image, and list or discovery pages need batched authorization and concurrency control instead of one lookup per image.

**Settled ARCH-001 direction — API-authorized, API-issued signed URLs.** Issue a short-lived signed GET for one immutable object and method after application authorization. The revocation window is **URL lifetime plus any client cache lifetime**, because a response fetched at the end of the URL's life stays fresh for the cache duration. For example, a 60-second URL with `max-age=60` leaves up to about 120 seconds of residual access. The earlier "≤60 s" target is met only if responses are not cached (`no-store`, or a `max-age` set to a small fraction of the URL lifetime). Each signature is distinct, so a long `max-age` gives no cache benefit, and `must-revalidate` on an expired signed URL returns 403 and breaks the image. Use batched issuance for list pages. Presigned URLs are an S3-API-endpoint feature, so any assumption that they work through a custom domain or CDN must be verified against current Cloudflare documentation. Private assets must bypass shared caches. Signatures stay out of logs and analytics. Exact TTL/cache behavior and the maximum residual-access window remain subject to Technical Lead assessment, measurement and Founder privacy disposition. A server-proxied read would require an authorized architecture reconciliation.

### 4.5 Cleanup and operations

Use explicit states and reconcile the vocabulary when the schema is designed: this document uses `pending`, `ready`, `delete-pending`, `deleted`, `rejected`; Media Assessment §5 uses a `replaced` state. An authoritative database reference check precedes any delete. Proposed: a cleanup job every 6 hours; bounded backoff retries (1 m, 5 m, 30 m, 2 h, then hourly) and alerting after 24 hours; a daily reconciliation that reports untracked objects and never mass-deletes from a bucket listing alone. List operations are Class A operations, and the cost sensitivity (§5) must account for three variants per asset, retries and listing. Rate-limit and quota by actor and scope. FER-001-B flags BG-1 for scheduled orphan cleanup, so P6 must either depend on BG-1 or have an owned, reviewed manual cleanup procedure accepted for bounded preview. An operational owner must be named before real integration. Logs record actor, scope, asset ID, operation and outcome, never bytes, tokens or signed URLs.

### 4.6 Deletion and retention

The Profile image and reference are removed when the Member reaches `deleted-anonymized`, through the LIFE-1 account lifecycle, and a pending Profile upload is removed too. Group and Challenge assets remain while their governed entity or history requires them, even if the uploader is deleted or anonymized. Media introduces no new entity retention rule. Operator takedown and suppression, abuse reports, audit retention, legal holds and backup purge are unresolved operational and legal requirements. They are Founder-reserved inputs (Disposition §14 items 2–3) and must be assigned before CPE.

### 4.7 Preview isolation

Three boundaries remain distinct: (1) local UX preview uses generated synthetic fixtures and a mock service with storage calls disabled; (2) real integration proof uses only an explicitly approved, isolated non-production bucket and disposable synthetic data, with credentials limited to that bucket; (3) production is a separate release decision outside P6 preview. Non-production has no production credentials, database, bucket access, copied photographs or shared public hostname or cache. Add a startup guard that rejects production endpoint, account or bucket identifiers in preview, and verify isolation with negative access tests.

## 5. Cloudflare R2 resource and environment proposal

This is a plan only. Nothing is provisioned, reserved or tested, and every row is conditional on the Founder decisions in §§2.4 and 2.6.

| Environment | Proposed resource | Access and delivery |
|---|---|---|
| Local UX | None; mock adapter and generated fixtures | All external storage calls disabled |
| Isolated integration | Dedicated private non-production bucket (name illustrative) in the account the Founder designates | Token scoped to that bucket only; synthetic data; no production access |
| Production (future, separately authorized) | Separate private bucket, token and deployment secret set | Independent Founder production gate; no reuse of non-production resources |

**Account placement.** FD-2 prefers the existing Miledge account for evaluation only, subject to the conditions in §2.6. A Tiizi-owned or otherwise separate account remains an alternative for Founder consideration if independence, isolation, ownership, billing or risk conditions cannot be evidenced. No arrangement is selected and no account access or resource creation is authorized. Within any later-authorized arrangement, use separate buckets and tokens per environment.

**Configuration.** Keep public access blocked and do not enable `r2.dev`, a public bucket or a public custom domain for private or mixed assets. Choose location and jurisdiction only after residency review, because they cannot be changed after bucket creation. Start with Standard storage. **Cloudflare Images is an optional evaluation item** under the existing MEDIA-1 authority (Disposition §8.1, §8.4; Media Assessment §7). It is not a dependency of the base capability, and the evaluation would run only inside the authorized non-production proof. Skipping or deferring that evaluation is a change to the proof plan that needs Founder confirmation.

**API configuration (names only; no values):** `R2_ACCOUNT_ID`, `R2_BUCKET`, `R2_ENDPOINT`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `MEDIA_UPLOAD_MAX_BYTES`, `MEDIA_UPLOAD_MAX_PIXELS`, `MEDIA_READ_URL_TTL_SECONDS` (ARCH-001 signed-URL direction; exact value pending technical and privacy decisions), `MEDIA_PENDING_TTL_HOURS`, and `MEDIA_PUBLIC_DELIVERY_BASE_URL` only if a separately approved public-only path is later introduced. Local preview has mock configuration and fails closed if production values are present. Secrets live only in the approved server-side secret manager or deployment environment.

**Minimum privilege.** An environment-specific token scoped to one bucket with only the object read and write permissions the service needs; no account administration, bucket creation, billing, analytics or access to other buckets. Confirm the exact Cloudflare permission mapping when creating the token. Separate production and non-production tokens. Limit visibility to the named account owner and designated operators. Rotate on staff or role change, suspected exposure and a documented periodic schedule (a 90-day schedule is a proposal), with safe overlap and revocation checks.

**Monitoring and attribution.** Cloudflare R2 resource tagging support is unverified, so do not depend on resource tags. Attribute use through per-bucket operational metrics and a cost ledger recording monthly storage, Class A and Class B operations, bytes per asset and variant, upload, read, replacement and deletion counts, processing CPU and memory, and failure, retry and orphan counts. A named account operator and a named budget owner (a Founder-reserved input) review monthly. Verify Cloudflare billing alert semantics, because R2 usage may be pooled account-wide and existing allowances may already be consumed. Price snapshot from the companion assessment: Standard $0.015/GB-month, Class A $4.50/million, Class B $0.36/million, free internet egress, and monthly included usage of 10 GB-month, 1 million Class A and 10 million Class B. These figures and plan terms were not independently re-verified in this revision and require current verification at procurement.

**Eventual manual Cloudflare Console steps (not performed):**

1. The Founder-designated account owner confirms the account, authority, billing treatment, region or residency and Tiizi access boundary. If not acceptable, stop and provision nothing.
2. Create the private non-production bucket with the approved location, public access and `r2.dev` disabled, and no custom domain or public cache.
3. Create a bucket-scoped token with minimum object permissions, named for Tiizi non-production, with owner and rotation date recorded in the approved secret inventory.
4. Place values only in the approved non-production secret manager. Never transmit secrets in chat or commit them.
5. Verify the token can read, write and delete only test objects in its own bucket and is denied elsewhere, and that logs redact signatures.
6. Review usage and billing, set a baseline, alert and owner, and confirm how Tiizi spend is attributed.
7. Only after separate production authorization, repeat with distinct production resources. Do not copy non-production objects or keys.

## 6. Product integration boundaries

| Surface | Integration point | Authority and display | Fallback and boundary |
|---|---|---|---|
| Profile | Optional entry points per FDR-03, "onboarding or Profile": the existing V2 Profile image slot (`/api/me` contract) and, where the approved onboarding composition presents a Profile step, an optional image control within it | Member self-edit. Displayed only where Member identity is already authorized | Initials fallback; no public photo URL; no completion gate; no new required or skippable onboarding step. Exact onboarding placement is confirmed against onboarding Product Truth before UI scope is set |
| Group | Existing cover area in Group creation; replace or remove in Group Settings; Group cards, Home and authorized discovery | Current Accountable Steward mutates. Visibility follows Group policy | Keep `cover_id` gradient default; no private Group image disclosure in discovery |
| Challenge | Existing Name & Appearance background field; Challenge detail, list and discovery | Eligible creator at establishment. Steward may replace or remove for the lifecycle. Reads follow Challenge visibility | Keep `cover_id` gradient; **Today image placement is excluded**; no wizard step or semantic validation change |
| Template | No integration in this package | Existing operator `cover_id` allowlist remains | No upload field, media library or altered provenance in P5T |

One reusable picker covers selection, client-side preview and resize, progress, retry, replace and remove, with purpose-specific framing. UI gating is convenience only. The API owns every authorization decision. Today image placement may be added only through separate experience approval.

## 7. Bounded implementation packages and gates

No package below is authorized by this document. FER-001-B sequence and package ownership remain authoritative.

| Slice | Responsibility | Dependencies and migration ownership | Exit gate |
|---|---|---|---|
| MEDIA-1 decision closure | Founder disposition of the reserved items (§2.4). Technical Lead prepares the defaults and owner assignments. Final values are recorded in the MEDIA-1 decision record (§9) | No code or migration. Existing decision sources remain authoritative | MEDIA-1 recorded as approved by the Founder, or by the delegate within the scope the Founder sets |
| MEDIA-2a shared backend | ObjectStore port and R2 adapter, intents, metadata and references, server processing, authorization, read, replace and remove, cleanup hooks, observability | P5T complete; MEDIA-1 approved; P1a recognized; separate non-production account, token and budget approval. Owns one sequential migration that must not overlap P5T or P7. BG-1 or an approved bounded cleanup procedure | Independent backend, security and DB review; migration and rollback demonstrated in a disposable DB; isolated R2 proof passed |
| MEDIA-2b Profile | Profile slot and picker (including the optional onboarding entry, §6) and authorized identity reads; binds the existing Profile API and the LIFE-1 deletion path | 2a; P1a; canonical identity contract | Cross-member and privacy tests; initials fallback; lifecycle evidence; independent review |
| MEDIA-2c Group | Creation cover selection, Settings replace and remove, Group reads | 2a; P4 Group surfaces; recheck PR overlaps | Cross-Group and stale-Steward tests; catalogue fallback; independent review |
| MEDIA-2d Challenge | Name & Appearance, detail, list and discovery reads; creator eligibility at establishment; Steward lifecycle authority | 2a; P5 corrections and P5T completion; P7 migration sequencing | Departed-creator and cross-Group tests; Challenge visibility; fallback; no Today or Template scope; independent review |
| MEDIA-3 Founder Preview | End-to-end synthetic journeys, local mock plus isolated real-R2 proof, iOS Safari, Android Chrome and desktop evidence | 2b–2d; isolated environment approved | Founder accepts the media behaviour. Acceptance does not authorize production |
| Production readiness and release | Separate migration, deployment, privacy, legal and operations plan | CPE, LIFE-1 and legal gates, explicit release authorization | Separate Founder production authorization |

**Security and privacy tests:** authorized and unauthorized upload for each scope; forged IDs; intent reuse, cross-actor and cross-purpose intent use; stale role and departed creator at bind; invalid MIME, signature, malformed, SVG, oversized and excessive-pixel files; decode concurrency and timeout; metadata stripping; cross-member and cross-Group reads; Group privacy and membership revocation; Challenge visibility change; delivery revocation window measurement; concurrent replace and remove; immediate suppression on takedown and `deleted-anonymized`; duplicate retry; failed storage and DB; orphan and failed-delete reconciliation; Group and Challenge persistence after uploader deletion; production credential and bucket inaccessible from non-production.

**Rollback and cleanup:** retain the old asset until the new pointer commits; keep the feature optional behind a server capability flag with catalogue fallback; roll back the app path to fallback without corrupting entity state; review migration forward and backward recovery before execution; inventory pending objects and reference state before cleanup; give the deletion job a dry-run mode that never bulk-deletes unreferenced keys. A proof bucket can be emptied and its token revoked after acceptance through an auditable, bucket-scoped procedure.

## 8. Decisions and authorization boundaries

**Settled (not for re-approval):** optionality and the CPE requirement (FDR-03); R2 as provider behind a neutral port (FD-MC-07a); scope ownership, mutation authority and visibility inheritance (§§8.3, 8.5, 8.6); fallbacks; Template `cover_id`; P5T-before-P6; FD-1 technical-accountability delegation; FD-2 Miledge-account evaluation preference only; FD-3 FEF-TLC-001 adoption/effectiveness approval (Disposition §18).

Today image placement is excluded from the current P6 media package. Any addition requires separate approval under the established Today experience governance. The existing approved Today experience remains unchanged.

**Technical Lead action under FD-1:** assess the §3–§5 recommendations with existing engineering, security, product and domain owners, verify limits/runtime/cost controls where needed, and record final technical defaults in the existing MEDIA-1 decision authority. Prior values are not automatically approved.

**Founder disposition still required:**

1. Deletion SLA; object/master and backup retention/purge; takedown/reporting and moderation; and acceptable residual access/revocation window (see separate Privacy Decision Brief).
2. Final R2 account arrangement, operational/legal ownership, environment/resource boundaries, budget owner, attribution and bounded spend. FD-2 allows evaluation only.
3. Non-production resource creation and any implementation package authorization.
4. Production resources, credentials, live Member images, release and deployment.
5. Scope changes, if wanted: Today image placement or a Template media reference. The optional Cloudflare Images evaluation remains subject to the existing bounded-proof and resource-authorization boundaries.

## 9. MEDIA-1 decision record and programme references (prepared, not applied)

Disposition §8.4 requires a Tiizi media decision record. The existing `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` is that authority; its §9 now holds the 2026-11-06 technical assessment and will hold any explicit, attributable Technical Lead decisions. This document and the integration assessment remain supporting analysis. The separate Founder Privacy Decision Brief provides recommendations but is not a decision registry.

The Master Programme v2.90 change log and FER-001-B P6 point to this existing authority. Record final technical values there with decision owner/date, source rationale, evidence, limits, verification status and any remaining conditions. Founder privacy, account, spend, resource, package and production decisions remain in the existing Founder Disposition. MEDIA-1 remains open and is not marked approved or closed here.

MEDIA-1 is **not** marked approved or closed by this PR.

## 10. Risks and unresolved dependencies

- **P5T sequencing is the immediate blocker.** Slice 5B implementation is not authorized per Master v2.89, Slice 6 is incomplete and migration 030 is undeployed. P6 migration work waits for P5T completion and separate authorization.
- **Identity and Profile dependency.** P1a and the canonical identity projection must provide authorized image consumption. LIFE-1 defines deletion behaviour. The current Profile API slot is `not_configured`.
- **Cleanup dependency.** BG-1 is needed for scheduled orphan cleanup, otherwise a reviewed manual procedure is needed before preview.
- **Revocation and caching.** Private delivery creates a bounded exposure window. Prove the window and fail closed where it cannot be measured (§4.4).
- **Image processing capacity.** Decode memory, latency and concurrency need proof on the deployment target (§4.3).
- **Shared-account governance.** Independence under §8.2, billing attribution, allowances, support ownership and residency are unresolved (§2.6).
- **Privacy, legal and abuse handling.** Retention, deletion, backup, takedown and cross-border arrangements need named owners before real image proof or CPE.
- **Open PR overlap.** #107, #145 and #150 may alter Profile, Challenge, discovery or Today surfaces and #143 affects P5T. Reconcile against merged `main` before any build (§2.7).
- **Founder Preview identity.** No live preview SHA or runtime is treated as authority here. Preview testing must rebuild an explicitly isolated synthetic environment.

## 11. Document status

These are supporting records for Technical Lead review and Founder disposition. FD-1/2/3 are recorded in the existing Member Completion Founder Disposition §18; technical recommendations and any later Technical Lead decisions belong in the existing `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §9. The privacy brief remains a non-authoritative decision brief. These documents are not a parallel decision registry. MEDIA-1 is not closed. The original integration assessment remains at `docs/programme/TIIZI-V2-MEDIA-UPLOAD-INTEGRATION-ASSESSMENT-001.md`.

## Source register

- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` v2.90 — programme sequence and dated FD alignment change-log reference.
- `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §§8, 14, 17, 18 — existing Product Truth and FD-1/FD-2/FD-3 scope; privacy/resource/package/production holds.
- `docs/programme/TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md` — FDR-03 and the separate-authorization boundary.
- `docs/programme/TIIZI-FER-001-B-EXPERIENCE-RECOVERY-IMPLEMENTATION-PLAN-001.md` — sequence, P6 dependencies, tests and gates.
- `docs/programme/TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §§1–9 — existing MEDIA-1 decision authority, technical assessment and cost/account evaluation status.
- `docs/programme/TIIZI-MEDIA-1-FOUNDER-PRIVACY-DECISION-BRIEF-001.md` — non-approved Founder privacy options and trade-offs.
- `docs/programme/TIIZI-V2-MEDIA-UPLOAD-INTEGRATION-ASSESSMENT-001.md` — companion technical assessment.
- `docs/programme/TIIZI-FER-TPL-001-CHALLENGE-TEMPLATE-CAPABILITY-ALIGNMENT.md` — Template `cover_id` boundary.
- `docs/programme/TIIZI-TECHNICAL-CONTROL-BOARD.md` — capability status and dependencies.
- `docs/programme/TIIZI-FEF-TLC-001-TEAM-ACTIVATION.md`, `docs/governance/FEF-ALIGNMENT.md`, `AGENTS.md` §4, `CLAUDE.md`, `docs/reports/TIIZI-V2-FOUNDER-EXPERIENCE-RECOVERY-BASELINE-001.md` §F, and PR #106 — FEF-TLC-001 merge and activation evidence (§2.5).
- `AGENTS.md` and `docs/programme/TIIZI-ECCL-PRG-01-AGENT-ENTRY-PILOT.md` — repository boundaries and source-state reconciliation controls.
- `docs/governance/domains/01-PROFILE-DOMAIN-STANDARD.md`, `02-GROUP-DOMAIN-STANDARD.md`, `03-CHALLENGE-DOMAIN-STANDARD.md` — domain visibility and authority.
- MV-206 v0.1, blob `1c1144e78d8446c19a6aecd415ef5fb8c227df85` — external Miledge guidance, not Tiizi authority.
- Cloudflare R2 pricing documentation: https://developers.cloudflare.com/r2/pricing/ (rates and account terms require current verification).
