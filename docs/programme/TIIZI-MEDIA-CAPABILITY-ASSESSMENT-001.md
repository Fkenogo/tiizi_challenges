# TIIZI — MEDIA CAPABILITY ASSESSMENT 001 (MEDIA-1 PREPARATION)

**Date:** 2026-10-10
**Base:** `365c958bf69f6d79ae262e81045abae9c777c19c`
**Status:** **PROVIDER DIRECTION DECIDED (Cloudflare R2, FD-MC-07a); ASSESSMENT / MEDIA-1 PREPARATION. NO IMPLEMENTATION AUTHORIZED.** MEDIA-1 is now a concrete Tiizi decision record, not a provider comparison. Remaining MEDIA-1 items are in §7.
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

## 7. Founder decisions required for MEDIA-1

Already decided: provider (R2), visibility baseline, Challenge-cover mutation rule, gradient fallback. **Still to resolve in MEDIA-1:** R2 account owner and environments; API-mediated vs scoped direct upload; exact size and pixel limits; variants; delivery/access mechanics; replacement and deletion timings (ties to LIFE-1); moderation/takedown; cost and budget ownership with alert owner; and the bounded non-production proof plan including the optional Cloudflare Images evaluation.

## 8. Boundaries

Provider direction recorded, but no R2 account created, no bucket, no code, no migration, no upload endpoint, no deployment, no production access. Miledge acquires no Tiizi authority.
