# TIIZI — MEDIA CAPABILITY ASSESSMENT 001 (MEDIA-1 PREPARATION)

**Date:** 2026-10-10
**Base:** `365c958bf69f6d79ae262e81045abae9c777c19c`
**Status:** **PROVIDER DIRECTION DECIDED (Cloudflare R2, FD-MC-07a); ASSESSMENT / MEDIA-1 PREPARATION. NO IMPLEMENTATION AUTHORIZED.** MEDIA-1 is now a concrete Tiizi decision record, not a provider comparison. Remaining MEDIA-1 items are in §7.
**Governance update (2026-11-06):** Founder FD-1/FD-2/FD-3 are recorded in Member Completion Founder Disposition §18. FD-1 delegates technical-default accountability to the Technical Lead. This existing MEDIA-1 decision authority now contains a technical assessment in §9; all values there remain recommendations until a Technical Lead decision is explicitly recorded. Founder-reserved privacy, account arrangement, expenditure, resource, package and production decisions remain pending. MEDIA-1 is not closed; no implementation is authorized.
**Direction (Founder, 2026-10-10):** Media capability is required before pilot, covering member profile images, Group covers and Challenge covers. The current local-gradient covers are temporary and do not satisfy it.
**Related:** `TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §8 (media; ownership §8.5, Challenge-cover mutation §8.6); IDP-04; `docs/architecture/TIIZI-V2-FORWARD-TECHNOLOGY-ARCHITECTURE-DECISION.md`; `docs/architecture/TIIZI-CF-001-CLOUDFLARE-CAPABILITY-AND-ARCHITECTURE-ALIGNMENT-ASSESSMENT.md` (§2 "Cloudflare capability fit matrix", R2 row rated **ARCHITECTURE-DEPENDENT**; also §1.13 and §12.B).

## 1. External guidance — MV-206 v0.1

Read from `Fkenogo/miledge-ventures` (`docs/miledge-ventures-knowledge/02-architecture/MV-206-Media-Storage-and-Delivery-Guidance.md`, blob `1c1144e`, approved MV-FD-001, 2026-10-08). It is **external architecture guidance voluntarily adopted by Tiizi; it does not govern Tiizi** and itself says it is "not a provider mandate". Principles carried into this assessment: product owns authority (ownership, access, deletion), storage holds bytes only; stable application-owned asset ids and keys; no signed URLs stored in records; private by default when personal; treat uploads as untrusted; replace-then-delete; orphan cleanup; cost recorded per product. Its Klockit proof (§6) is Miledge's; Tiizi would run its own bounded, non-production proof.

## 2. Tiizi-side facts

- Settled direction (ARCH-001): **S3-compatible object store + API-issued signed URLs**, metadata in PostgreSQL. Vendor was left as an open procurement choice; `docs/architecture/TIIZI-CF-001-CLOUDFLARE-CAPABILITY-AND-ARCHITECTURE-ALIGNMENT-ASSESSMENT.md` rates R2 **ARCHITECTURE-DEPENDENT** in its §2 "Cloudflare capability fit matrix" and, in §12.B, says R2 "waits for the S3-compatible object-storage procurement decision; adopt only behind an S3-compatible adapter with API-issued signed URLs". MEDIA-1 is that decision point.
- Today: Group and Challenge covers are an allowlisted `cover_id` rendered as local gradients (migrations 018, 022; `groupCovers.ts`, `challengeCovers.ts`). Profile has nothing. `storage.rules` still holds Firebase paths for `group-covers/` and `challenge-covers/` keyed by Firebase uid; those are legacy and not V2 authority (AGENTS §2.3-2.4).
- Who may change what today: Group cover is set through Group Settings by the Accountable Steward; Challenge cover is chosen in the creation wizard.
- No object-storage vendor, bucket, adapter, upload endpoint or media table exists.

## 3. Options evaluated

| Option | Fit | Notes |
|---|---|---|
| **Cloudflare R2 (S3-compatible)** | **SELECTED (FD-MC-07a)** | Matches ARCH-001 direction and MV-206's preferred bounded-proof candidate. Egress pricing is favourable but requests, operations and any transformations are not free (MV-206 §3). Needs a vendor account, credentials and budget alert |
| **R2 + own server-side processing** (decode, re-encode, strip EXIF, size cap, variants at upload) | Strong, most portable | Keeps processing in Tiizi's API, so storage stays swappable; costs API CPU and complexity. Variants are fixed at upload |
| **Cloudflare Images / transformations** | Evaluate where useful | On-demand variants and delivery; adds coupling and per-use cost; do not store transformation URLs as identity. Reasonable optimisation after the base works |
| Firebase Storage | Possible, not preferred | Already present, but authorization is Firebase-uid based and rules-based, which sits beside rather than inside the PostgreSQL authority model; ARCH-001 treats it as short-term acceptable only |
| Other S3-compatible store | Acceptable | Same adapter contract; no known advantage recorded |
| Cloudinary / fully managed image service | Viable | Highest convenience and coupling; cost at growth to be modelled |
| Embedded data URLs / external URLs | Rejected | IDP-04 options C/B: unsafe or unreliable |

**Founder decision (2026-10-10, FD-MC-07a):** Cloudflare R2 is Tiizi's initial object-storage provider for profile images, Group covers and Challenge covers, behind *Tiizi application/domain → ObjectStore / media port → S3-compatible adapter → Cloudflare R2*. Provider URLs are never canonical identity; PostgreSQL holds Tiizi-owned asset references and metadata, R2 holds bytes. **Cloudflare Images / transformations are optional**, evaluated during the bounded non-production proof, and not required for the base capability. The comparison table above is retained as the evaluation record; this paragraph supersedes the earlier "R2 is a candidate" framing and the earlier recommendation text.

## 4. Capabilities to decide in MEDIA-1

**Signed upload architecture.** Two acceptable shapes: (1) API-mediated upload (client sends bytes to the Tiizi API, which validates and writes to storage); (2) direct-to-storage with a short-lived, scope- and size-limited grant, followed by a server "finalize" that verifies existence, size, decodability and ownership before attaching. For small avatars/covers, (1) is simpler and safer; (2) scales better. Either way: unguessable object keys, never customer filenames; MIME allowlist plus real decode; size and pixel caps; rate limits and quotas; abandoned-upload cleanup.

**Content types and limits (proposed starting values, to be confirmed by proof):** JPEG, PNG, WebP (HEIC accepted only if converted server-side); reject SVG and anything with active content; input up to ~5 MB and ~25 MP before re-encode; output re-encoded with EXIF/GPS stripped.

**Variants (proposed):** profile image square — about 64, 128, 256 px; cover — 16:9 or the app's cover ratio, about 480, 960, 1440 px wide; plus the stored original or a normalised master. Exact sizes follow the mobile layout (CF-4/S4 compositions).

**Delivery and visibility policy (proposed, by asset class):**
- *Profile image (decided baseline):* visible only where the member identity itself is authorized; **not anonymously public by default**. Delivery through application-authorized reads or short-expiry URLs (mechanics resolved in MEDIA-1). A CDN URL must never make a private object public.
- *Group cover (decided baseline):* **inherits Group visibility/discovery policy.**
- *Challenge cover (decided baseline):* **inherits Challenge visibility.**
- Test role change, revoked membership, expired links and cross-tenant access (MV-206 §4).

**Ownership is scope-based (decided, v2.56).** *Profile image:* scope = Member/Profile; member-owned personal media; removed when that member reaches deleted-anonymized. *Group cover:* scope = Group; belongs to the governed Group context; survives uploader/account deletion; replacement/deletion follows Group media authority. *Challenge cover:* scope = Challenge; belongs to the governed Challenge context; survives uploader/account deletion where the Challenge or its history still requires it; replacement/deletion follows Challenge media/lifecycle authority. **The uploader is attribution/audit metadata, not ownership authority, for Group- and Challenge-scoped assets.** If the uploader becomes deleted-anonymized: retain the asset while its Group/Challenge lifecycle requires it, retain only the minimum internal attribution needed for audit, render the actor as "Former member" (or omit) in ordinary presentation, and never erase historical Group/Challenge media solely because the uploader closed their account.

**Mutation (decided, v2.57).** Profile image: the member only. Group cover: Accountable Steward (the Group's media authority). Challenge cover: the creator during establishment **only while they still hold an eligible current Group relationship that authorizes Challenge creation/administration** (creator identity alone is not sufficient; `created_by_member_id` is historical attribution only); the Group Accountable Steward may replace or remove it throughout the Challenge lifecycle; a deleted or departed creator never strands the cover. This adds no broader Challenge-administration authority. The gradient catalogue remains the fallback/default.

**Replacement and deletion.** Replace-then-delete (never delete the old object before the new is committed); revoke old delivery where feasible; orphan cleanup job; deletion of the **Profile image** on that member's account closure, and of Group/Challenge covers only through their own Group/Challenge lifecycle (never merely because the uploader closed their account); backup/deletion timing stated; logs never contain image content, tokens or private URLs. Cleanup and expiry want the scheduler flagged in the Disposition.

**Abuse, security, moderation.** Treat uploads as hostile (decode and re-encode; consider malware scanning by threat). Operator takedown capability needed before pilot; reporting UX can follow. Copyright/consent wording belongs to Terms (legal text not drafted here). MV-206 §5 also asks to investigate per-group/challenge roles, crop/aspect presets and a default cover catalogue; the existing gradient catalogue can remain as the default.

**Cost.** Record per MV-206 §7: image counts, average bytes including variants, uploads per month, reads and transformation requests, public/private method, floor and usage estimates, region availability, budget alerts and a named operations owner. Prices change; evaluate at selection, do not assume permanent free operation.

**Portability.** An `ObjectStore` port with an S3-compatible adapter; asset ids and keys owned by Tiizi; no provider URL stored as identity; migration path by copying keys.

## 5. PostgreSQL media-reference model (illustrative — design input, not schema authority)

- `media_assets` (conceptual, not a schema decision): `asset_id` (UUID), `purpose` (`profile_image` | `group_cover` | `challenge_cover`), **`scope_type` and `scope_id`** (Member/Profile, Group or Challenge — the ownership key), **`uploaded_by_member_id` / actor attribution** (audit and attribution only; retained as minimum internal attribution if the uploader is later deleted-anonymized), `storage_key` (opaque), `content_type`, `byte_size`, `width`, `height`, `visibility_class`, `status` (`pending` | `ready` | `rejected` | `replaced` | `deleted`), `replaced_by_asset_id`, timestamps, deletion metadata. `owner_member_id` is **not** the ownership key for Group- or Challenge-scoped assets.
- `media_asset_variants` (or fixed variant columns): asset id, variant name, key, dimensions, bytes.
- References: member profile → current avatar asset id; Group → `cover_asset_id`; Challenge → `cover_asset_id`; existing `cover_id` kept as default/fallback catalogue.
- No credentials or signed URLs stored. Authorization decided in the application per read.
- Requires a new migration, numbered sequentially when MEDIA-2a begins (no number reserved); migration 025 is untouched.

## 6. Proposed work packages (not authorized)

| WP | Scope |
|---|---|
| **MEDIA-1** | Concrete decision record (provider R2 and visibility baseline already decided): upload shape, limits, variants, delivery mechanics, replacement/deletion, takedown, cost and budget owner; IDP-04 disposition; proof plan including optional Cloudflare Images evaluation |
| **MEDIA-2a** | Core: port + adapter, upload/finalize, validation/re-encode, `media_assets`, cleanup, deletion, tests |
| **MEDIA-2b** | Profile image (needs MC-2) |
| **MEDIA-2c** | Group cover (Steward) |
| **MEDIA-2d** | Challenge cover |
| **MEDIA-3** | Founder preview before pilot readiness |

Dependencies: MEDIA-1 has none and can start now; 2a needs MEDIA-1 and an environment/credentials decision; 2b needs MC-2; 2c/2d need 2a only; all need the "no production" boundary until separately authorized. MV-206 §6 style proof (valid upload, spoofed/oversized rejection, wrong-role rejection, mobile-size serve, private protection, atomic replace, deletion, orphan cleanup, outage behaviour, cost evidence) should precede any real user images. **No live user images or production use without separate authority.**

## 7. Decisions and authorization still required

**Already decided:** provider (R2, FD-MC-07a); visibility baseline; scope ownership; Challenge-cover mutation rule; gradient fallback. **Technical Lead decisions under FD-1:** API-mediated vs scoped direct upload; exact size/pixel limits and variants; delivery/cache mechanics; replacement concurrency and technical lifecycle; decoder safeguards; technical storage organization; and verification criteria. The initial recommendation and its confidence/verification status are in §9. The earlier values in §§4–6 remain proposals, not approved defaults.

**Founder-reserved and pending:** privacy/deletion SLA, takedown/reporting policy, original/master/backup retention requirements; final R2 account arrangement and environment boundaries; defined operational/legal ownership; spend attribution and bounded budget; infrastructure/resource creation; implementation package authorization; production resources, credentials, release and deployment. FD-2 approves evaluation of the Miledge Ventures account only. The separate [MEDIA-1 Founder Privacy Decision Brief](TIIZI-MEDIA-1-FOUNDER-PRIVACY-DECISION-BRIEF-001.md) presents recommendations without approving policy values.

Cloudflare Images remains optional under FD-MC-07a. The bounded evaluation plan is in §9.8; any real resource use is subject to separate Founder authorization. No Cloudflare resource is authorized by this assessment.

## 8. Boundaries

Provider direction recorded. FD-2 permits evaluation of the existing Miledge Ventures account only; it does not authorize account access or resource creation. No Tiizi R2 bucket, credential, Cloudflare Images resource, code, migration, upload endpoint, deployment or production access is authorized here. Miledge acquires no Tiizi authority.

## 9. MEDIA-1 Technical Lead assessment and recommendation (2026-11-06)

### 9.1 Decision authority and status

This is the existing MEDIA-1 decision authority required by Founder Disposition §8.4. FD-1 delegates technical-default accountability to the Technical Lead. The following assessment is **not itself a Technical Lead decision**: no specific technical default is recorded as final until the Technical Lead explicitly adopts and records it with evidence in this section. Previous values in this document and the PR #154 assessments are proposals and are not grandfathered as decisions. Product scope, privacy policy, expenditure, account/resource arrangements, implementation package authorization and production release remain Founder-reserved under Disposition §18.

### 9.2 Recommended technical shape

| Area | Recommendation for Technical Lead decision | Status / evidence needed |
|---|---|---|
| Upload | Start with API-mediated upload for profile/group/challenge images: authenticated client sends bytes to the Tiizi API; API authorizes purpose/scope, validates and normalizes, then writes opaque keys using server-side credentials. Evaluate narrowly scoped direct upload only if measured API throughput or timeout evidence requires it; retain mandatory finalize/verification. | Ready for Technical Lead decision after backend/security owner review; no load result exists |
| Delivery | Preserve the settled ARCH-001 direction: the authenticated Tiizi API authorizes the current actor/scope and issues object-specific, short-lived signed URLs for private R2 reads. The URL is a bearer capability until expiry; do not persist it as identity or expose it in logs/analytics. A server-proxied read would change the existing architecture direction and requires an explicit Architecture & Decision Controller reconciliation before it can be selected. | Signed URL approach is the governing direction; exact TTL, cache policy and maximum residual-access window need technical measurement and Founder privacy disposition |
| Formats and processing | Allowlist JPEG, PNG and WebP; reject SVG, animation and active formats. Decode actual bytes, enforce limits before allocation, normalize orientation, strip EXIF/GPS and re-encode. Keep client resize as a bandwidth aid, never as a server validation substitute. | Strong technical candidate for TL decision; verify library security, HEIC support and deployment compatibility |
| Size, pixels and variants | Use 5 MiB compressed input after client resize, a 12 MP decoded ceiling, Profile square outputs around 64/128/256 px, and cover outputs around 480/960/1440 px in the existing surface ratios only as **proof candidates**, not approved requirements. Set decoder concurrency, memory ceiling and timeout from measurements on the actual deployment target. | Not ready for final numeric recording: target/runtime, phone crop review, peak-memory/concurrency and latency evidence are absent |
| Storage organization | Keep private R2 behind a provider-neutral `ObjectStore` port; distinct Tiizi non-production and production buckets/credentials; opaque generated keys; PostgreSQL holds stable asset IDs, scope, purpose, state, metadata and canonical references. Do not create a shared public bucket or use provider URLs as records. | Technical shape is ready for TL decision; actual account, bucket, credentials and locations remain Founder-authorized separately |
| Upload intents and authorization | Bind a single-use, expiring intent to verified actor + purpose + authorized scope. Revalidate actor, scope and current role at bind; intent retries are idempotent; reject cross-actor, cross-purpose, stale-role and substituted-scope attempts. | Ready for TL decision; exact TTL/quota requires abuse and operational review |
| Replacement concurrency | Write/validate the replacement first, then swap the canonical reference transactionally with a version check or row lock. Delete the previous object only after commit. Failed replacement leaves the old image usable. | Ready for TL decision; concurrent replace/remove and partial-failure tests required |
| Revocation and caching | Do not place private or mixed-visibility media in shared caches. Verify that R2 signed reads can return an appropriate non-shared cache policy and that the selected endpoint honors it. If a response can remain cached, the effective exposure window is URL lifetime plus remaining cache freshness. Candidate is a short expiry and `private, no-store` (or a verified zero-freshness equivalent); if that cannot be demonstrated, reconsider the serving path through the existing architecture governance. Never persist or log signatures. | Read, membership-revocation, takedown, cache and signed-link expiry tests required; maximum acceptable residual window is Founder-reserved |
| Original vs re-cropping | Do not retain camera originals by default. Prefer one normalized, metadata-stripped master plus derived variants to permit bounded future re-cropping without original EXIF/GPS. Remove the master with its governed asset lifecycle unless Founder-approved retention requires otherwise. | Technical recommendation; actual retention/purge and backup policy are Founder-reserved |
| Backup and disaster recovery | Do not imply that R2 is a backup. Define restore source, recovery point/time objectives, deletion tombstones and restore/replay controls before any production use. If copies are proposed, include separate access boundary, deletion propagation, residency/ownership and cost. | Further verification and Founder privacy/operations decision required; no backup selected or created |
| Cleanup and reliability | Cleanup only after a bounded pending-object grace and an authoritative database reference check; idempotent retries, bounded concurrency, alerting and a daily report of untracked objects. Never mass-delete from a bucket listing alone. | Retry/grace schedule and operational owner need TL/security/ops review; schedule is not approved |
| Cloudflare Images | Keep optional. Compare app-side normalized variants in R2 against Cloudflare transformations for quality, latency, private delivery, cache/revocation, vendor/account boundaries and cost. Evaluate documented pricing and a synthetic-only proof design before considering resources. | Documentation-level evaluation possible now; any actual resource or proof requires separate Founder authorization |

### 9.3 Technical items ready for decision vs requiring evidence

The Technical Lead can decide the security/control shape—API-mediated upload as the starting path, API authorization before signed URL issuance, single-use intent semantics, opaque object keys, transactional reference swap, and fail-closed asset association—after consultation with the existing owners. Signed delivery continues to follow ARCH-001 unless an authorized architecture reconciliation changes it. These choices preserve the approved ownership, visibility, mutator and fallback decisions. They do not fix product scope or privacy policy.

Do not record exact byte/pixel limits, crop ratios, decoder concurrency/timeouts, URL TTL/cache lifetime, cleanup schedule, storage location, retention period or backup objectives until the named runtime, mobile surfaces, expected volume, operational ownership and privacy constraints are verified. No such measurements were executed for this documentation task.

### 9.4 Storage lifecycle recommendation

Use an application-owned state model such as `pending → ready → delete-pending → deleted`, with `rejected` for invalid data. The state is metadata, not object-store authority. Make the database reference the source of truth. A process retry must be idempotent, and object inventory must reconcile against database references before cleanup. The exact pending TTL, retry schedule, physical deletion SLA and backup purge period remain undecided.

### 9.5 Verification and acceptance evidence to require before MEDIA-2

The per-slice independent review and tests should cover: forged/mismatched actor and scope; stale Steward/creator relationship; intent replay and cross-purpose reuse; MIME spoofing, malformed files, SVG/animation, decompression/pixel bombs, EXIF/GPS stripping and image decode resource limits; private read denial across members/groups/challenges; membership/visibility revocation; signed URL or API cache revocation window; concurrent replace/replace and replace/remove; interrupted object/database writes; retry idempotency; orphan cleanup with referenced-object protection; service/object-store outage; key/credential scope; secret/signature redaction; restore and deletion-tombstone behavior; and cost attribution from observed writes, reads, variants, retries, transforms and retention. The suite itself must use disposable synthetic data; no real Member images or production resources.

No tests or implementation were run or changed as part of this assessment. CI applicability will be established by the documentation-only PR.

### 9.6 Cost and account evaluation (checked 2026-11-06)

Cloudflare’s R2 documentation lists Standard storage at $0.015/GB-month, Class A at $4.50/million, Class B at $0.36/million, and direct R2 Internet egress as free; the documented monthly Standard allowance is 10 GB-month, 1M Class A and 10M Class B. Cloudflare also states that billable usage is rounded up by billing unit, so small overages can cross a full unit. These are current public rates, not a Tiizi forecast or spending authorization. In a shared Miledge account the allowance and existing usage are account-wide; Tiizi must not assume the free allowance or cost ceiling is available to it.

Use this model after measured volume is available:

`monthly R2 cost ≈ max(GB-month − 10, 0) × $0.015 + max(Class A − 1,000,000, 0) × $4.50/1,000,000 + max(Class B − 10,000,000, 0) × $0.36/1,000,000 + any separately metered processing/services`.

Cost model inputs must include original/master and variant counts/sizes, retained and orphan bytes, uploads/replacements/deletes, reads per image/surface, list/reconciliation calls, retries, backups, processing CPU/memory, transformation dimensions, and whether delivery passes through a separately metered service. Attribute Tiizi usage by bucket/environment and application metrics; verify whether the chosen account exposes sufficient per-bucket billing data. Two environment buckets, scoped tokens, budget alerts, owner, and a monthly review are minimum evaluation conditions. No spend limit or budget owner is approved yet.

Cloudflare Images documentation (last updated 2026-10-19) describes up to 5,000 unique monthly transformations on its Free plan for images stored elsewhere; above that, new transformations fail unless the paid plan is used. Paid transformations are listed at $0.50 per 1,000 unique transformations; Images-hosted storage and delivery are separately priced. These rates do not include R2 and are subject to re-check at procurement. Edge transforms must be tested for private-source authorization, cache keys, cache invalidation and revocation before selection.

Sources checked 2026-11-06: [Cloudflare R2 pricing](https://developers.cloudflare.com/r2/pricing/) and [Cloudflare Images pricing](https://developers.cloudflare.com/images/pricing/).

### 9.7 Founder-reserved privacy and infrastructure boundary

The Founder Privacy Decision Brief contains non-approved recommendations on deletion SLA, takedown/suppression policy, object and backup retention, reporting/moderation, access revocation and privacy/audit safeguards. It is a decision brief, not a decision registry. The Founder must approve policy values separately. FD-2 is evaluation only; actual account, resources, credentials, spend, bounded environment, implementation, production resources and deployment each remain held for separate authorization.

### 9.8 Cloudflare Images evaluation plan (no resources)

Prepare a paper comparison using the cost model above: (A) Tiizi-owned decode/re-encode and fixed variants stored in R2; (B) R2 originals/normalized masters with Cloudflare transforms; and (C) Images-hosted originals/variants if compatible with the Tiizi authority and privacy boundaries. Compare quality, latency, transformations/reads, memory and service coupling; transformation uniqueness; account-level price/cap; private reads and cache invalidation; deletion propagation; data location/ownership; portability; and operational on-call responsibility. No Cloudflare Images account feature, resource, token, bucket or synthetic upload may be activated under this evaluation; a later proof requires separate Founder resource authorization.
