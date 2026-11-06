# TIIZI — V2 Media Upload Integration Assessment 001

**Reference:** TIIZI-V2-MEDIA-001-CORR-001 (Revision 2 — independent R1 corrections)
**Date:** 2026-11-06
**Status:** **SUPPORTING TECHNICAL ASSESSMENT / FOUNDER REVIEW — MEDIA-1 NOT CLOSED; NO BUILD; NO IMPLEMENTATION AUTHORIZED**
**Companion:** `TIIZI-V2-MEDIA-1-DESIGN-CLOSURE-AND-GOVERNANCE-RECONCILIATION-001.md` (reference `TIIZI-V2-MEDIA-1-CLOSURE-RECON-001`), which carries the governance reconciliation and the current proposals.
**Repository:** `Fkenogo/tiizi_challenges`
**Assessment baseline:** `origin/main` / `51ec762643cc0feff150a719e89c8b97f4233927`
**Assessment branch:** `docs/tiizi-v2-media-assessment-001`
**Related programme package:** FER-001-B **P6 — Shared media**
**Authority:** Existing Tiizi Founder Disposition and FER-001 Gate 0; MV-206 consulted as external guidance only. Founder decisions FD-1/FD-2 were recorded in Disposition §18 on 6 November 2026: technical-default accountability is delegated to the Technical Lead, and the Miledge account is preferred for evaluation only. Neither decision authorizes implementation, account access, resources or spend (see the companion §§2.4, 2.6).

## 1. Executive finding

Tiizi has a usable V2 foundation for presenting curated Group and Challenge cover choices, and a Profile image slot in the `/api/me` contract. It has **no V2 upload, media storage, image-processing, retrieval, or uploaded-asset authorization capability**. The current V2 experience stores allowlisted catalogue identifiers and renders local gradients; the Profile API explicitly returns `not_configured`.

The recommended programme path is the existing **P6 — Shared media** package: close the remaining MEDIA-1 design decisions, then build one API-authorized media service and storage adapter, followed by Profile, Group, and Challenge integrations and an isolated Founder Preview. Reuse one upload component with purpose-specific presentation and server-side authorization. Keep Templates on their current catalogue-cover contract; P6 asset references may be considered later without adding uploads to Template authoring.

Cloudflare R2 is the **selected** provider: FD-MC-07a (Disposition §8.1) selects R2 behind a provider-neutral port. Provider selection is distinct from resource and implementation authorization, which have not been granted. FD-2 prefers the existing Miledge Ventures account for evaluation only, subject to the conditions in Disposition §18.2 and reconciliation with Tiizi independence under §8.2. It does not authorize account access, a Tiizi bucket or credentials, implementation, deployment or spend. Final account arrangement, ownership, environment isolation, billing attribution, budget and resources remain subject to separate Founder review/authorization (companion §2.6).

## 2. Repository reconciliation

### 2.1 Isolated baseline

| Check | Result |
|---|---|
| Remote | `https://github.com/Fkenogo/tiizi_challenges.git` |
| Fetch | `origin/main` fetched before the isolated checkout was created |
| Verified `origin/main` SHA | `51ec762643cc0feff150a719e89c8b97f4233927` |
| Checkout | A new isolated worktree (local path not recorded here) |
| Branch / HEAD at assessment start | `docs/tiizi-v2-media-assessment-001` at `51ec762643cc0feff150a719e89c8b97f4233927` |
| State at assessment start | Clean; 0 ahead / 0 behind |
| Dirty original checkout | Left untouched; no reset, stash, checkout, cleanup, or edits |

The assessment used a new, unique worktree and did not switch or reorganize any existing worktree. `scripts/prg01LocalReconciliation.mjs` was run read-only as required by `AGENTS.md`. Its non-gating output did not establish preview identity, runtime state, PR state, or Founder acceptance, so those were checked separately.

### 2.2 Current V2 authority and ancestry

The baseline is the remote `main` merge commit `51ec762` (PR #153). `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` is the programme-status authority (v2.89 at this baseline). Its accepted-source records place the S1, S2, S3, S4, S5, S6, and Profile Foundation work on the accepted V2 path. `AGENTS.md` §1–2 defines the active boundaries: browser experience under `/v2/*`, active API under `/api/*`, PostgreSQL as V2 domain authority, Firebase Auth for identity only, and no V1 product reuse. The current runtime is assembled from `src/v2/**` and `api/src/**`.

The 28 October FER-001 Gate 0 record is in the Master Programme as v2.81 and records its merge via PR #108 (`a618d618dd784fcdbb41aff93650a0c9d84a66a0`). The complete Founder-approved experience is the CPE acceptance gate; the Controlled Pilot limits users, not features. P6 is therefore a required pre-CPE capability, with uploads optional within each journey. Historical §16 pilot deferrals are superseded for sequencing by §17; they must not be used to defer the media capability.

### 2.3 Open PR and overlap review

At review on 2026-11-06, GitHub listed open PRs #154 (this PR), #150, #145, #143, #107, and #94. These are point-in-time GitHub facts, not repository records, and must be re-verified at merge and before any implementation. No PR other than this one is media work and none adds an upload path. Recheck their current heads and rebased diffs before P6 implementation because some touch adjacent surfaces:

| PR | Relevant overlap | Media finding |
|---|---|---|
| #107 — Experience Recovery | `src/v2/profile/V2ProfileScreen.tsx`, member shell, Groups screen, routes, Today | Experience recovery changes; no media upload or media contract |
| #145 — Founder Preview corrections | Challenge list/detail/discovery components | Challenge presentation overlap; no media upload or media contract |
| #150 — Today discovery correction | Today and discoverable-Challenge surfaces | Today/discovery presentation overlap; no media upload or media contract |
| #143 — Template lifecycle UI | Operator Template authoring components. This is the open Slice 5B implementation PR, while Master Programme v2.89 records Slice 5B implementation as not started and not authorized | P5T overlap; Template covers remain catalogue IDs; no media upload |
| #94 — CI efficiency documentation | CI and programme documentation | No media overlap |

PR #107's branch also contains a proposed programme row that the Master Programme explicitly says is not part of `main`; do not treat that branch as accepted authority. P5T remains incomplete at this baseline, and its approved sequencing places P5T before P6. P5T and P6 both own migrations and must not run concurrently.

## 3. Requirement and authority mapping

### 3.1 Approved Tiizi decisions

The effective decisions are recorded in `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §§3, 8, and 17 and reconciled by FER-001-A / FER-001-B:

- **Scope and sequencing:** profile images, Group covers, and Challenge covers are one shared P6 capability required for CPE; upload is optional in each journey and initials/gradients remain the fallback. P6 is sequenced after P5T and before P7 (`TIIZI-FER-001-B` §P6 and the programme sequence).
- **FDR-03:** explicitly restores optional Profile, Group, and Challenge uploads as required CPE functionality. No Member is required to upload an image. The decision also states that R2 account/credentials, a non-production environment, and any live use require separate authorization.
- **Provider direction in the existing Tiizi record:** FD-MC-07a records R2 as Tiizi's initial object-store provider behind a provider-neutral `ObjectStore` / media port. Cloudflare Images is optional, not required. FD-2 prefers the Miledge account for evaluation only, subject to its listed conditions; no account access, Tiizi resource or integration use is approved by that preference.
- **Visibility:** Profile images are visible only where the member identity is authorized and are not anonymously public by default. Group covers inherit Group visibility/discovery. Challenge covers inherit Challenge visibility. The gradient catalogue is the fallback.
- **Ownership:** ownership is by scope: Member/Profile, Group, or Challenge. The uploader is attribution for Group- and Challenge-scoped assets, not their owner. Group and Challenge media survive uploader account deletion while their own lifecycle requires them; a Profile image is removed when the member reaches deleted-anonymized.
- **Mutation:** the member alone changes their Profile image; the Accountable Steward changes the Group cover. During Challenge establishment, the creator may set the cover only while holding an eligible current Group relationship authorizing the action. The Group Accountable Steward may replace/remove the cover throughout the Challenge lifecycle. Creator identity alone is not lasting authority.
- **Templates:** FD-TPL and the P5T alignment record retain allowlisted `cover_id` only. P5T does not depend on P6 and must not acquire upload behavior. A later optional Template media reference may reuse P6 asset records without altering Template meaning or established Challenge provenance.
- **No implementation authority:** these decisions and the P6 plan do not authorize code, schema/migration, bucket or credentials, production access, or deployment. Each implementation slice needs separate written authorization.

### 3.2 External MV-206 guidance

MV-206 v0.1 (blob `1c1144e78d8446c19a6aecd415ef5fb8c227df85`, approved 8 October 2026) is Miledge Ventures guidance voluntarily consulted by Tiizi. It is **not Tiizi product authority and not a provider mandate**. It recommends application-owned identity, scope, access, and deletion; stable asset IDs and object keys; private-by-default personal media; isolated product credentials and billing; server validation of untrusted uploads; short-lived access grants or controlled backend upload; replacement only after the new object is committed; orphan cleanup; no durable signed URLs; and per-product cost/operations evidence. Its proof and operating advice inform this assessment only where consistent with Tiizi decisions.

### 3.3 Decisions still open

The existing MEDIA-1 record leaves technical choices unresolved: API-mediated versus direct scoped upload; exact byte/pixel limits and formats; variants/cropping; authorized delivery and cache behavior; replacement/concurrency safeguards; and technical verification. Under FD-1 (Disposition §18.1), the Technical Lead is accountable for assessing and recording those defaults in `TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §9 after appropriate consultation. §5 recommendations are not requirements until explicitly assessed and recorded. Founder-reserved policy and authorization choices remain open: deletion SLA, retention/backup, moderation/takedown/reporting, acceptable revocation window, final account arrangement, spend/budget, resources and package authorization. FD-2 is evaluation preference only; it grants no access, resource, credential or spend. Legal/privacy processing arrangements remain a pre-pilot gate in the Member Disposition.

## 4. Existing capability inventory

Classification applies to the **active V2 product path**; the archived V1 implementation is not used as V2 authority.

| Capability | Classification | Evidence and finding |
|---|---|---|
| Profile image field | **Partially implemented** | `api/src/memberProfileRoutes.ts:56,76` returns `{ status: 'not_configured' }`; `src/api/profileApi.ts:26,67` types and carries that slot; the V2 Profile identity query propagates it. No image URL or asset ID is available to render. |
| Profile entry/display | **Partially implemented** | `src/v2/profile/V2ProfileScreen.tsx` is the active Profile route; initials fallback helpers exist in `src/v2/profile/profileView.ts`. No V2 image picker, preview, replacement, or removal control exists. Member Shell and Today consume the shared member-identity projection, but the active projection has no usable image. |
| Group cover reference | **Implemented and active (catalogue only)** | Migration `api/migrations/018_group_richer_identity.sql:8-30` stores an allowlisted `cover_id`; `src/v2/groups/groupCovers.ts` renders eight local gradients and deterministic fallback. `src/v2/groups/V2CreateGroupScreen.tsx:217-244` selects a catalogue cover; `V2GroupSettingsScreen.tsx:72` explicitly says there is no upload. API create/update/read paths carry `coverId`. |
| Group display | **Implemented and active (catalogue only)** | `V2GroupsScreen`, `V2GroupDiscoveryPanel`, `V2GroupHomeScreen`, and hosted-Group context render the cover catalogue/fallback. API discovery includes `coverId` only for its governed discoverable subset (`api/src/groupReads.ts:174-177,269-302`). No uploaded object or media authorization is present. |
| Challenge cover reference | **Implemented and active (catalogue only)** | Migration `api/migrations/022_challenge_cover_and_support_configuration.sql:3-9` stores an allowlisted `cover_id`; `src/v2/challenges/challengeCovers.ts` resolves local gradients. `src/v2/challenges/wizardSteps/NameAppearanceFields.tsx:25` selects the Challenge background. Creation routes validate the catalogue and read models return `coverId`. |
| Challenge display | **Implemented and active (catalogue only)** | V2 Challenge list, discovery rows, detail hero, and created-Challenge screen use the catalogue or fallback. The current Today projection/screen does not carry a Challenge media field; a Today image placement needs alignment with the accepted Today experience rather than assumed behavior. |
| Template cover/background | **Implemented and active (catalogue only)** | `api/src/challengeTemplates.ts` accepts only allowlisted `coverId`; `docs/programme/TIIZI-FER-TPL-001-CHALLENGE-TEMPLATE-CAPABILITY-ALIGNMENT.md` §§2.2, 2.4 says no upload in Templates and P6 owns any future media reference. No Template upload should be added in P5T. |
| Knowledge images | **Implemented for catalogue content; unrelated to member uploads** | `knowledge_items.image_url` is content metadata (`api/migrations/002_phase_b_knowledge.sql`, `api/src/knowledge.ts`) used by `ActivityThumbnail`. It is not a Profile/Group/Challenge asset model or a trusted upload pipeline. |
| Legacy upload service and Firebase Storage rules | **Implemented in archived V1; superseded/excluded for V2** | `src/services/imageUploadService.ts`, legacy feature callers, `storage.rules`, and `firebase.json` describe Firebase Storage behavior for older screens. They use URL-based storage and Firebase path rules; they do not provide the PostgreSQL scope/visibility authority required by V2. `AGENTS.md` §§1–2 prohibits using V1 Group/Challenge authority or product code as V2 implementation authority. |
| V2 media endpoint / adapter / R2 configuration | **Missing** | No `/api/media` upload, finalize, remove, or delivery route; no `ObjectStore` adapter, R2 client configuration, Tiizi bucket, or Tiizi credential. R2 is the selected provider (FD-MC-07a), but no Tiizi R2 resource exists. |
| V2 image processing | **Missing** | No server image decoding/re-encoding, metadata stripping, pixel cap, variant generator, malware scan, or image CDN policy is implemented. Client MIME checks or browser preview are not server validation. |
| Uploaded-media database references | **Missing** | No `media_assets` table or persisted asset reference for Profile/Group/Challenge. Current `cover_id` values identify catalogue choices, not objects. No signed upload or delivery URLs are stored because none exist. |
| Authorization and lifecycle | **Partially implemented for catalogue changes only** | Existing Group settings restrict the screen to the Accountable Steward; Group and Challenge authority is checked in server paths. These checks do not authorize uploaded objects, reads, deletion, cache revocation, or orphan cleanup. Profile image mutation is absent. |
| Media tests | **Missing** | No V2 media upload, processing, object-store, retrieval, replacement, privacy, or cleanup tests. Existing cover tests/guards verify catalogue behavior only; Profile API tests assert `not_configured`. |

## 5. Recommended shared architecture (proposal)

### 5.1 Components and flow

Use the V2 API as the authorization and asset-association authority, PostgreSQL for durable media metadata/references, and a narrow S3-compatible `ObjectStore` port with an adapter for the selected provider, R2 (FD-MC-07a):

1. An authenticated browser requests an upload for a purpose and an authorized scope. The client never supplies an owner Member ID, Group ID, Challenge ID, or role that the server trusts without resolving it from the authenticated actor and current domain authority.
2. For the initial small-image capability, **prefer API-mediated upload**: the API checks scope authority before accepting bytes, enforces request throttles, decodes/normalizes the raster, then writes opaque generated keys to a private bucket. This keeps object write credentials out of the browser and makes one simple path for Profile, Group, and Challenge. If real preview/load evidence shows API-mediated transfer is unsuitable, evaluate direct scoped upload plus mandatory server-side finalization as a later alternative.
3. Persist a stable Tiizi asset ID and scope/purpose/status/metadata in the same governed flow as attaching the reference to the Profile, Group, or Challenge. A provider URL is never canonical data. Keep catalogue `cover_id` for fallback.
4. For reads, authorize the viewer against current Profile identity, Group visibility/membership, or Challenge visibility before issuing an object-specific signed read URL, consistent with ARCH-001. The URL is a bearer capability until expiry; its residual-access window includes URL lifetime plus client cache lifetime (companion §4.4). The exact TTL and cache headers require Technical Lead assessment and Founder privacy disposition. Do not persist signed URLs. Profile media stays private. Avoid a public bucket or `r2.dev` for private or mixed-visibility media. Public caching may be evaluated only for objects whose visibility is already public and whose URLs/variants are immutable; it is not an entitlement check. A server-proxied read would need an authorized architecture reconciliation.
5. Replace by validating and storing the new asset, committing the reference swap, then revoking/deleting the old object. A failed replacement leaves the old image intact. Cleanup removes unassociated uploads only after a bounded grace period and an authoritative reference check.

This is intentionally a small application capability, not a shared Miledge media service. The image UI can be one reusable `MediaUploadField`/picker with purpose, aspect presentation, fallback, progress, retry, replace, and remove options; all permission decisions remain server-side. Do not create a generalized media library, public URL editor, or Template upload surface.

### 5.2 Validation defaults to prove, not approved limits

For a first proof, consider JPEG, PNG, and WebP; reject SVG and active-content formats. Consider HEIC only if the server can reliably decode and re-encode it. Treat extension and browser MIME as hints only. Decode the actual image, cap compressed bytes and decoded pixels before allocation, re-encode to supported raster output, normalize orientation, and strip EXIF/GPS. Store only normalized masters/variants needed for the product unless a retention decision requires originals.

The earlier media record's approximate **5 MB / 25 megapixel** input envelope and profile/cover variant examples are proposals, not settled Tiizi requirements or automatically approved values. They are technical defaults for Technical Lead assessment under FD-1, subject to evidence (companion §4.3). Many phone originals exceed both (often 48–50 MP and over 5 MB), and a 25 MP decode needs roughly 100 MB of memory, so the proposal is client-side downscale before upload, a lower server pixel ceiling, a decode concurrency limit, a timeout and decoder isolation. Derive final dimensions and crop controls from current mobile surfaces and prove memory/latency cost. Crop handling, colour space and output format remain technical assessment items; original retention and backup/DR are Founder-reserved policy. Malware scanning should be threat-based; it is not a substitute for decode/re-encode. No crop/aspect ratio or camera-capture requirement is inferred here.

### 5.3 Scope model and database boundary

Conceptually model each asset with: stable `asset_id`; purpose (`profile_image`, `group_cover`, `challenge_cover`); `scope_type` + `scope_id` as ownership key; uploader actor for audit only; opaque storage key(s); validated media type, byte size, width/height; visibility class; state; timestamps; replacement/deletion and retention metadata. A separate variant relation or fixed variant slots can hold versioned object keys and dimensions. Profile/Group/Challenge rows refer to the current asset ID while preserving catalogue cover IDs as fallback.

This describes assessment inputs, not an approved schema. Assign a sequential migration only when authorized P6 work starts; do not reserve a migration number in this report. Keep provider URLs, credentials, presigned URLs, and image bytes out of PostgreSQL. Ensure deletion and anonymization boundaries match the scope rules above.

### 5.4 Delivery, cache, retention, and portability

Start with private storage and re-authorized reads, particularly for Profile and private Group/Challenge contexts. Authenticated API delivery is the initial proposal. Short-lived signed reads are a measured alternative, a compromise between API egress and authorization freshness; their maximum revocation window is URL lifetime plus any client cache lifetime (for example a 60-second URL cached for 60 seconds allows about 120 seconds), and their expiry, cache headers and behavior after membership/visibility changes require proof. Do not serve private images through a publicly addressable CDN cache. For approved public assets, use immutable/versioned variants and a separately configured public delivery path only if measurement justifies it.

No Tiizi retention SLA, backup deletion timing, takedown workflow, or Group/Challenge deletion lifecycle was found in the media decision. Profile deletion is tied to the approved `deleted-anonymized` state; Group/Challenge media follows its scope lifecycle. Before implementation, decide actual purge timing, backups, failed-deletion retries, user request handling, and operator suppression/takedown authority. Store adapter interfaces and opaque keys so bytes can be copied to another S3-compatible store without changing product references.

## 6. Product integration gaps

### 6.1 Profile photo

- **Upload entry:** FDR-03 specifies an optional Profile image in "onboarding or Profile". Entry points are the V2 Profile page/settings, at the existing identity/photo placeholder, and, where the approved onboarding composition presents a Profile step, an optional image control within it. Neither gates Profile completion or onboarding, and no new required or skippable step is added. Confirm onboarding placement against onboarding Product Truth before UI scope is set.
- **Display:** Profile itself and only those Member identity projections where the Member identity is already authorized (including authorized Group/Challenge contexts where the current V2 composition presents identity). No anonymous public profile-photo URL by default. Today/Member Shell may consume the current member's own image only if the approved screen composition uses it.
- **Authority/lifecycle:** member-only mutation; current API actor derived from verified auth, never a request-supplied member ID. Remove the Profile image when the Member reaches deleted-anonymized; deletion SLAs/backup timing remain open.
- **Gap:** `/api/me` has an explicit unconfigured slot but no asset ID; Profile page has initials fallback and no upload/removal control; no signed-in read capability or persisted Profile reference exists.

### 6.2 Group cover

- **Creation:** add an optional upload choice inside the existing Group cover selection area in `V2CreateGroupScreen`; preserve its current creation steps and allow catalogue/default fallback.
- **Management:** add replace/remove beside the existing cover controls in `V2GroupSettingsScreen`. API must authorize the Accountable Steward on every mutation; UI gating alone is insufficient.
- **Display:** current catalogue presentation sites are Group cards, Group Home, authenticated discovery, and Group context in Challenge hosting. Return an authorized cover reference through the same bounded read scopes as other Group information. Private Group covers must not leak to discovery or anonymous readers; discoverable Groups follow current discovery visibility.
- **Fallback:** catalogue gradient wins when no asset exists, upload fails, a reference is absent, or an asset is removed. Keep `cover_id` intact as the established fallback contract.
- **Gap:** no upload, object reference, authorization-aware delivery, or replacement/removal operation exists. Current upload slot is still catalogue-only.

### 6.3 Challenge cover

- **Creation:** place the optional upload in the existing Name & Appearance / Challenge background area in the established wizard. It must not add a new step or change Challenge semantic validation/establishment.
- **Management:** creator mutations must be re-authorized against a current eligible Group relationship. The Group Accountable Steward retains replace/remove authority through the Challenge lifecycle. Do not grant broader Challenge administration.
- **Display:** current Challenge list, discovery row, detail hero, and created-Challenge surfaces can consume the governed media reference; Challenge visibility rules control retrieval. Today currently has no cover field in its read projection. **Today image placement is excluded from this package**; it may be added only through separate experience approval.
- **Fallback/lifecycle:** retain `cover_id` and gradient fallback. Replacing/deleting a cover does not alter Challenge truth or Template provenance. Preserve Challenge-scoped media after uploader deletion while the Challenge/history requires it.
- **Gap:** current wizard/list/detail display local gradients and catalogue IDs only; there is no media reference in the Today projection or uploaded-asset support.

### 6.4 Template backgrounds

P5T uses allowlisted `cover_id` only and precedes P6. Do not add file upload to Template authoring or change P5T journeys. Once P6 defines asset references, a later Template reference could point to an approved Challenge-cover asset record, but that requires explicit scope, author/Operator permission, visibility, reuse, retirement, and snapshot behavior decisions. Existing Template-derived Challenge provenance rules remain unchanged. The asset uploader is not a Template image library.

## 7. Security, privacy, and lifecycle requirements

These are acceptance requirements derived from approved visibility/ownership/authority plus the proposed implementation boundary:

- Bind every upload, finalize, read, replace, and remove to a verified actor and current purpose/scope authority. Reject forged scope IDs, stale Group roles, departed Challenge creators, cross-member reads, and cross-Group access at the API.
- Re-check visibility at read time. Profile is private by default; Group and Challenge assets inherit current governed visibility. Signed URL expiry bounds residual exposure but is not a replacement for entitlement checks. Test role removal, Group privacy changes, and Challenge visibility changes.
- Validate actual image bytes and decoded dimensions server-side; reject malformed, polyglot, spoofed MIME, oversized, excessive-pixel, active-content, and unsupported formats without writing an attached asset. Rate-limit upload attempts and constrain total bytes/asset count per relevant scope.
- Use random, non-user-derived object keys; isolate Tiizi bucket/prefix and least-privilege credentials by environment; keep secrets out of browser bundles, logs, URLs, source control, and durable product rows. Do not reuse Miledge credentials across product contexts without an explicit isolation/billing decision.
- Keep old object active until replacement has committed. Make retries idempotent; avoid duplicate rows/objects on network retry. Reconcile partially written objects, failed DB commits, abandoned upload sessions, and delete failures with durable status and cleanup evidence.
- Log actor, scope, action, outcome, and asset ID only; never log image bytes, signed URLs, or access tokens. Establish audit, operational alerts, quota/abuse response, takedown and legal/reporting ownership before CPE acceptance.
- Define retention/backup purge timing, orphan grace window, and deletion retry/restore behavior before implementation. Do not delete Group/Challenge assets solely because their uploader account is deleted.

## 8. Founder Preview and acceptance plan

Keep the three testing levels distinct:

1. **Local UX preview with synthetic images:** browser-local generated fixtures only, with fake/in-memory media service responses. Demonstrate picker, preview, progress, validation message, retry, replace, remove, initials/gradient fallback, narrow mobile layout, and no network/object-store calls. Never load real Member photographs.
2. **Real integration against isolated non-production storage:** only after separate authorization for environment, account/credentials, and budget. Use synthetic fixture images and disposable Member/Group/Challenge data. Verify API authorization, R2 object behavior, server processing, metadata attachment, retrieval, replacement, deletion, cleanup, and cost evidence. Keep production buckets, tokens, data, and user images inaccessible to the test environment.
3. **Production deployment:** outside this assessment and P6 preview. Requires separate Founder release/production authorization, privacy/legal and operations readiness, approved environment credentials, migration/recovery plan, and pilot acceptance. No production resources or access are proposed here.

**Mobile browser matrix for MEDIA-3:** iOS Safari and Android Chrome at narrow phone widths, plus desktop review. Verify photo-library selection, browser permission denial/cancel, HEIC fallback or rejection copy, orientation normalization, slow/offline/retry recovery, small-screen crop/preview, keyboard/screen-reader labels, focus restoration, and no layout overflow. Synthetic images only.

## 9. Proposed acceptance cases (not executed)

| Case | Expected result |
|---|---|
| Authorized Profile upload | Member may attach their own validated image; other Member IDs are ignored/rejected |
| Unauthorized Profile mutation/read | Cross-member mutation and private image read fail closed |
| Authorized Group upload | Steward may attach an image to the Group in their current authority scope |
| Unauthorized Group upload | Non-member, ordinary member where not authorized, departed Steward, and other-Group actor are rejected |
| Authorized Challenge upload | Eligible creator during establishment may attach; current Group Steward may replace/remove later |
| Departed creator | Creator loses mutation ability when current eligible Group relationship is lost |
| Invalid image | Spoofed MIME, malformed, SVG/active content, unsupported encoding, and excessive pixel count rejected server-side |
| Oversized image | Byte cap rejected before persistent attachment; no orphan remains after cleanup grace |
| Retrieval | Authorized viewer gets correct normalized variant; unauthorized viewer cannot infer a private asset through direct key/URL access |
| Visibility change | Private Group, membership revocation, or changed Challenge entitlement prevents newly issued reads; expiry/cache bound is measured |
| Replacement | New valid image becomes current before old image is deleted/revoked; failed new upload leaves old image usable |
| Removal/fallback | Authorized removal clears the reference, preserves catalogue/initials fallback, and revokes or expires delivery |
| Cross-member and cross-Group | Guessed asset ID, scope ID substitution, and copied URL cannot bypass authorization beyond the explicitly measured short URL lifetime |
| Orphan handling | Failed DB attach, abandoned upload, process crash, and failed delete are reconciled, retried, and observable |
| Failure/retry | R2/API timeout, client disconnect, duplicate retry, and transient DB failure leave one coherent asset state and clear recovery guidance |
| Scope lifecycle | Profile deletion removes its own asset at the governed lifecycle point; Group/Challenge asset survives uploader deletion while its scope requires it |
| Local and non-production isolation | Synthetic fixture only; local UX preview cannot access production storage; non-production credentials cannot read/write production objects |

The backend suite should include fake-store port tests, API authorization/validation tests, real-R2 disposable integration tests only in the authorized isolated environment, and migration/reference lifecycle tests. These are plans; no test or implementation was run for this assessment.

## 10. Bounded work packages and sequence

Use FER-001-B's existing P6 package rather than create a competing programme sequence:

| Package | Scope / exit evidence | Dependency / boundary |
|---|---|---|
| **MEDIA-1 — decision closure** | Technical Lead assesses and records technical defaults under FD-1 in the existing MEDIA-1 authority (§9; companion §§3–5). Founder disposition remains required for deletion/retention/takedown/reporting and revocation policy, account arrangement, budget/spend, resource and implementation authorization. Record privacy/legal dependencies. | No code. Depends on FDR-03; FD-2 account evaluation preference is not resource authorization. MEDIA-1 is not approved or closed by this assessment. |
| **MEDIA-2a — shared backend foundation** | ObjectStore port + R2 adapter; media metadata/reference model; authorized upload/read/replace/remove; decode/re-encode; scoped visibility; status/error/idempotency behavior; orphan/deletion cleanup hooks; exhaustive server and port tests. | MEDIA-1 and separate environment/credential/budget approval. Migration-owning; do not overlap P5T/P7 or another migration package. BG-1 is required for scheduled orphan cleanup, or an explicitly owned/manual proof procedure must be accepted for the bounded preview. |
| **MEDIA-2b — Profile** | Bind existing Profile slot/UI to asset ID; own-member mutation/read; authorized identity consumers; initials fallback; lifecycle deletion. | 2a; Profile Foundation (MC-2) surfaces and canonical identity contract. Do not make photo upload a setup gate. |
| **MEDIA-2c — Group** | Bind existing creation cover area, Settings replace/remove, Group card/Home/discovery reads; enforce steward and Group-visibility rules; retain gradients. | 2a; P4 Group surfaces and authorized Group read/mutation contract. |
| **MEDIA-2d — Challenge** | Bind Name & Appearance, Challenge detail/list/discovery; Today display is excluded; creator/steward authority; retain `cover_id`. | 2a; P5 wizard corrections and P5T completion; do not change Template authoring. |
| **MEDIA-3 — Founder Preview** | End-to-end Profile/Group/Challenge journeys with synthetic images on isolated data; mobile browser evidence, fallback, privacy, replacement/removal, and failure/retry. | 2b–2d; isolated non-production storage only; Founder acceptance. |

**Programme sequencing:** FER-001-B places P5T before P6; P5T is not complete at this baseline (Master Programme v2.89 says Slice 5B is only prepared / implementation not authorized, while PR #143, an open Slice 5B implementation PR, exists; re-verify at merge). Do not start migration-owning P6 implementation concurrently with P5T. P6 remains required for CPE and is itself not authorized. MEDIA-3 is not production acceptance.

**Recorded P6 dependencies:** FDR-03, P1a (Profile surface), and MEDIA-1; BG-1 is needed only for scheduled cleanup. P5T is the required preceding migration-owning package. P6 is rated High / R2 in FER-001-B; its slices should be independently reviewed.

## 11. Cost, operations, and resource implications

### 11.1 Current provider price snapshot

Cloudflare's official R2 pricing page, checked 6 November 2026, lists Standard storage at **$0.015 per GB-month**, Class A at **$4.50 per million operations**, Class B at **$0.36 per million operations**, and Internet egress as free. The listed monthly included usage is **10 GB-month storage, 1 million Class A, and 10 million Class B**. The included allowance may already be consumed by usage under the paid Miledge account; do not budget Tiizi as free. Infrequent Access adds retrieval cost and a 30-day minimum duration, so Standard is the simpler initial candidate for frequently read covers/profile images. Confirm price, account terms, region/residency, allowance consumption, and billing attribution at procurement time.

Cloudflare Images offers a separate optional transformations path. Its official page lists up to 5,000 unique transformations/month on its Free plan; limits and current plan terms must be checked at use time. Do not make core media delivery depend on a free transformation allowance. These provider prices exclude Tiizi API compute, image decoding/re-encoding, monitoring, engineering, and any non-R2 service costs.

Illustrative R2-only sensitivity (not a demand forecast; assumes stored normalized assets average 0.75 MB and allowance is unused):

| Load | R2 storage / operations | Approximate direct R2 charge |
|---|---|---:|
| 1,000 assets (0.75 GB), 1,000 writes, 1 million reads/month | Inside listed Standard included usage | $0 R2 line item within included usage |
| 100,000 assets (75 GB), 100,000 writes, 50 million reads/month | 65 billable GB-month and 40 million billable Class B after listed allowances | About **$15.38/month** (storage ~$0.98 + reads $14.40; writes within allowance) |

Real variants/backup copies increase bytes; signed/private delivery changes request volume; transformations, cache hits, retries, abandoned uploads, and account-wide usage change the bill. The dominant uncertain items are API CPU/memory for decode/encode, delivery/request count, and whether the paid account's allowances are already used. Budget alerts and named cost ownership are prerequisites to an isolated proof.

### 11.2 Operational resources

Expected roles: one backend engineer for API/security/storage/migration and cleanup; one frontend engineer for the shared picker and three purpose bindings; an independent security/code reviewer; a database/migration reviewer; a Cloudflare account operator for isolated credentials and billing; QA/mobile browser time; privacy/legal input for image processing, retention, and cross-border transfer; and Founder disposition of the reserved MEDIA-1 choices and review of MEDIA-3 evidence. Effort is high-risk and cross-cutting (FER-001-B labels P6 High / R2); no calendar estimate is reliable until MEDIA-1 and environment decisions are made.

## 12. Decisions and approvals before implementation

The following are already decided and must not be re-opened absent an explicit amendment: optional Profile/Group/Challenge images required for CPE (FDR-03); R2 behind a neutral ObjectStore port (FD-MC-07a); scope ownership, visibility and mutation (Disposition §§8.3, 8.5–8.6); fallback catalogues/initials; Template `cover_id`; and P5T-before-P6 sequencing.

**Governance status as of 2026-11-06.** Under FD-1 (Disposition §18.1), the Technical Lead is accountable for assessment and recording of technical defaults; proposals in this assessment are not final decisions. Founder-reserved matters remain deletion SLA, retention/backups, takedown/reporting, acceptable revocation window, final R2 account arrangement, spending/budget and resource/package/production authorization. FD-2 (Disposition §18.2) prefers the Miledge account for evaluation only, conditional on independence, isolation, environment separation, least privilege, operational/legal ownership, billing/spending controls and acceptable cross-product risk. It grants no access, resource, credential or spend. The Founder Privacy Decision Brief and companion §§2.4–2.6 describe these boundaries.

Founder/authorized resource owner approval is required before non-production R2 access/resource creation and bounded spend. Production resources, credentials, live Member images, production spend and deployment require their own existing package/release authorization. LIFE-1, legal/privacy and operational owners must resolve purge, backup, takedown, reporting and audit obligations before release; product-policy decisions go through the existing Founder disposition process. Today image placement remains excluded pending separate experience approval.

## 13. Source register

Primary Tiizi sources at the stated baseline:

- `AGENTS.md` §§1–3 — V1 exclusion, `/v2` and `/api` boundaries, PostgreSQL authority.
- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` — v2.89 programme state; §FER-001 Gate 0 v2.81 and PR #108 merge; current P5T/P6 sequence.
- `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §§3, 8, 17 — FD-MC-07a, visibility, scope ownership, mutation, CPE sequencing.
- `docs/programme/TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md` §§1–9 — existing MEDIA-1 decision authority and technical assessment under FD-1. Member Completion Founder Disposition §§8.2, 8.4, 18 — independence, decision-record requirement and FD-1/FD-2/FD-3 scope.
- `docs/programme/TIIZI-FER-001-A-FOUNDER-DECISION-RECONCILIATION-001.md` — FDR decisions; explicitly distinguishes provider direction from live upload and states R2 resources/credentials require separate authorization.
- `docs/programme/TIIZI-FER-001-B-EXPERIENCE-RECOVERY-IMPLEMENTATION-PLAN-001.md` — P6 deliverables, order, dependencies, tests, mobile scenarios, and Founder gate.
- `docs/programme/TIIZI-TECHNICAL-CONTROL-BOARD.md` — current integration gaps and programme package status.
- `docs/programme/TIIZI-FER-TPL-001-CHALLENGE-TEMPLATE-CAPABILITY-ALIGNMENT.md` §§2, 4–6 — P5T cover contract and P5T-before-P6 sequence.
- `docs/experience/TIIZI-S2G-GROUP-ESTABLISHMENT.md`, `TIIZI-S2B-V2-CHALLENGE-CREATION.md`, `TIIZI-S4-GROUPS-EXPERIENCE-CHARTER.md`, `TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md`, `TIIZI-S5C-FOUNDER-PREVIEW-ACCEPTANCE-001.md` — adopted V2 journeys and preview boundaries.
- `docs/governance/domains/01-PROFILE-DOMAIN-STANDARD.md`, `02-GROUP-DOMAIN-STANDARD.md`, `03-CHALLENGE-DOMAIN-STANDARD.md`, and approved EOG-E1-01 / Stage F Product Truth — privacy, scoped administration, and visibility boundaries.
- MV-206 v0.1, Miledge Ventures, blob `1c1144e78d8446c19a6aecd415ef5fb8c227df85` — external voluntary architecture guidance; not Tiizi authority.
- Cloudflare primary pricing/access docs, checked 2026-11-06: [R2 pricing](https://developers.cloudflare.com/r2/pricing/), [R2 public buckets and custom-domain caching](https://developers.cloudflare.com/r2/buckets/public-buckets/), [Images pricing](https://developers.cloudflare.com/images/pricing/).

## 14. Disposition

**Assessment complete for Technical Lead review.** Recommendation: retain P6 as the single shared-media work package; use the already selected R2 behind a provider-neutral port; have the Technical Lead assess and record technical defaults under FD-1 in the existing MEDIA-1 authority; obtain Founder decisions on the remaining privacy, account, spend and implementation matters; obtain separate resource authorization before any isolated R2 proof; preserve current catalogue/initials fallbacks; and maintain the approved programme sequence. No code, migration, bucket, credential, image test, production access, deployment or merge was performed for this assessment.

This assessment is supporting analysis, not a competing decision registry. Approved decisions remain in the Master Programme, Founder Disposition and FER-001 records. See §15 for reconciliation status.

## 15. Governance reconciliation (2026-11-06)

This addendum reconciles the assessment against `origin/main` `5722dadccd5fab18ddef2e40c284a8b5762ff2b9`, the Founder Disposition, FER-001-A/B, the Master Programme, Technical Control Board, TPL-001, `AGENTS.md`, and FEF-TLC-001. Decision status is summarized in the companion §2.3. Technical recommendations remain proposals pending Technical Lead assessment and recording under FD-1; Founder-reserved privacy, account, spend, resource and package decisions remain pending. FD-2's Miledge preference is recorded for evaluation only, grants no account access/resource/spend, and remains conditional on Disposition §8.2 (companion §2.6).

FEF-TLC-001 status (companion §2.5): its merge is confirmed (PR #106, merge `542052c12ca7910a297da89f28ae01120b220980`, 2026-10-27), and the Founder confirmed adoption/effectiveness approval on 2026-11-06 (Disposition §18.3). Verification that required role assignments and other activation prerequisites are complete remains pending; no completion date is inferred. This assessment does not claim those prerequisites are complete. Repository controls and approved product and programme records govern.

No conflict with approved Profile, Group, Challenge, media or Template policy was found. Open PRs at review are listed in §2.3 (point-in-time); none other than this PR is media work. P5T is incomplete and Slice 5B implementation is recorded as not authorized. No local preview identity was established, so no preview acceptance is claimed. This addendum changes no product rule, programme status, authorization, or implementation state.
