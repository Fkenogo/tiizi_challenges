# TIIZI — MEDIA CAPABILITY ASSESSMENT 001 (MEDIA-1 PREPARATION)

**Date:** 2026-10-10
**Base:** `365c958bf69f6d79ae262e81045abae9c777c19c`
**Status:** **ASSESSMENT / DECISION PREPARATION ONLY. NO PROVIDER SELECTED. NO IMPLEMENTATION AUTHORIZED.** The provider and architecture decision is made by the Founder in MEDIA-1 and recorded separately.
**Direction (Founder, 2026-10-10):** Media capability is required before pilot, covering member profile images, Group covers and Challenge covers. The current local-gradient covers are temporary and do not satisfy it.
**Related:** `TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md` §7; IDP-04; `TIIZI-V2-FORWARD-TECHNOLOGY-ARCHITECTURE-DECISION.md`; `TIIZI-CF-001-…` (§R2 "architecture-dependent").

## 1. External guidance — MV-206 v0.1

Read from `Fkenogo/miledge-ventures` (`docs/miledge-ventures-knowledge/02-architecture/MV-206-Media-Storage-and-Delivery-Guidance.md`, blob `1c1144e`, approved MV-FD-001, 2026-10-08). It is **external architecture guidance voluntarily adopted by Tiizi; it does not govern Tiizi** and itself says it is "not a provider mandate". Principles carried into this assessment: product owns authority (ownership, access, deletion), storage holds bytes only; stable application-owned asset ids and keys; no signed URLs stored in records; private by default when personal; treat uploads as untrusted; replace-then-delete; orphan cleanup; cost recorded per product. Its Klockit proof (§6) is Miledge's; Tiizi would run its own bounded, non-production proof.

## 2. Tiizi-side facts

- Settled direction (ARCH-001): **S3-compatible object store + API-issued signed URLs**, metadata in PostgreSQL. Vendor was left as an open procurement choice; CF-001 rated R2 "architecture-dependent: adopt only behind an S3-compatible adapter with API-issued signed URLs". MEDIA-1 is that decision point.
- Today: Group and Challenge covers are an allowlisted `cover_id` rendered as local gradients (migrations 018, 022; `groupCovers.ts`, `challengeCovers.ts`). Profile has nothing. `storage.rules` still holds Firebase paths for `group-covers/` and `challenge-covers/` keyed by Firebase uid; those are legacy and not V2 authority (AGENTS §2.3-2.4).
- Who may change what today: Group cover is set through Group Settings by the Accountable Steward; Challenge cover is chosen in the creation wizard.
- No object-storage vendor, bucket, adapter, upload endpoint or media table exists.

## 3. Options evaluated

| Option | Fit | Notes |
|---|---|---|
| **Cloudflare R2 (S3-compatible)** | Strong candidate | Matches ARCH-001 direction and MV-206's preferred bounded-proof candidate. Egress pricing is favourable but requests, operations and any transformations are not free (MV-206 §3). Needs a vendor account, credentials and budget alert |
| **R2 + own server-side processing** (decode, re-encode, strip EXIF, size cap, variants at upload) | Strong, most portable | Keeps processing in Tiizi's API, so storage stays swappable; costs API CPU and complexity. Variants are fixed at upload |
| **Cloudflare Images / transformations** | Evaluate where useful | On-demand variants and delivery; adds coupling and per-use cost; do not store transformation URLs as identity. Reasonable optimisation after the base works |
| Firebase Storage | Possible, not preferred | Already present, but authorization is Firebase-uid based and rules-based, which sits beside rather than inside the PostgreSQL authority model; ARCH-001 treats it as short-term acceptable only |
| Other S3-compatible store | Acceptable | Same adapter contract; no known advantage recorded |
| Cloudinary / fully managed image service | Viable | Highest convenience and coupling; cost at growth to be modelled |
| Embedded data URLs / external URLs | Rejected | IDP-04 options C/B: unsafe or unreliable |

**Recommendation (not a decision):** build behind a provider-neutral port, prove R2 first in a non-production environment with API-side processing, and treat Cloudflare Images as an optional later delivery optimisation. This keeps CF-001's portability condition true.

## 4. Capabilities to decide in MEDIA-1

**Signed upload architecture.** Two acceptable shapes: (1) API-mediated upload (client sends bytes to the Tiizi API, which validates and writes to storage); (2) direct-to-storage with a short-lived, scope- and size-limited grant, followed by a server "finalize" that verifies existence, size, decodability and ownership before attaching. For small avatars/covers, (1) is simpler and safer; (2) scales better. Either way: unguessable object keys, never customer filenames; MIME allowlist plus real decode; size and pixel caps; rate limits and quotas; abandoned-upload cleanup.

**Content types and limits (proposed starting values, to be confirmed by proof):** JPEG, PNG, WebP (HEIC accepted only if converted server-side); reject SVG and anything with active content; input up to ~5 MB and ~25 MP before re-encode; output re-encoded with EXIF/GPS stripped.

**Variants (proposed):** profile image square — about 64, 128, 256 px; cover — 16:9 or the app's cover ratio, about 480, 960, 1440 px wide; plus the stored original or a normalised master. Exact sizes follow the mobile layout (CF-4/S4 compositions).

**Delivery and visibility policy (proposed, by asset class):**
- *Profile image:* personal data; **private by default**. Visible only in shared-group / authorized Challenge contexts (FD-MC-03). Delivery through application-authorized reads or short-expiry URLs. A CDN URL must never make a private object public.
- *Group cover:* private Group → members only. Discoverable Group → authenticated-discoverable, the same as the Group's discovery projection. No anonymous public access unless the Founder decides otherwise.
- *Challenge cover:* inherits the Challenge's visibility.
- Test role change, revoked membership, expired links and cross-tenant access (MV-206 §4).

**Ownership.** Profile image: the member only. Group cover: Accountable Steward. Challenge cover: creator at establishment; post-establishment change is a *Founder decision*.

**Replacement and deletion.** Replace-then-delete (never delete the old object before the new is committed); revoke old delivery where feasible; orphan cleanup job; deletion on account closure and on Group/Challenge removal; backup/deletion timing stated; logs never contain image content, tokens or private URLs. Cleanup and expiry want the scheduler flagged in the Disposition.

**Abuse, security, moderation.** Treat uploads as hostile (decode and re-encode; consider malware scanning by threat). Operator takedown capability needed before pilot; reporting UX can follow. Copyright/consent wording belongs to Terms (legal text not drafted here). MV-206 §5 also asks to investigate per-group/challenge roles, crop/aspect presets and a default cover catalogue; the existing gradient catalogue can remain as the default.

**Cost.** Record per MV-206 §7: image counts, average bytes including variants, uploads per month, reads and transformation requests, public/private method, floor and usage estimates, region availability, budget alerts and a named operations owner. Prices change; evaluate at selection, do not assume permanent free operation.

**Portability.** An `ObjectStore` port with an S3-compatible adapter; asset ids and keys owned by Tiizi; no provider URL stored as identity; migration path by copying keys.

## 5. PostgreSQL media-reference model (illustrative — design input, not schema authority)

- `media_assets`: `asset_id` (UUID), `purpose` (`profile_image` | `group_cover` | `challenge_cover`), `owner_member_id`, `scope_type`/`scope_id`, `storage_key` (opaque), `content_type`, `byte_size`, `width`, `height`, `visibility_class`, `status` (`pending` | `ready` | `rejected` | `replaced` | `deleted`), `replaced_by_asset_id`, timestamps, deletion metadata.
- `media_asset_variants` (or fixed variant columns): asset id, variant name, key, dimensions, bytes.
- References: member profile → current avatar asset id; Group → `cover_asset_id`; Challenge → `cover_asset_id`; existing `cover_id` kept as default/fallback catalogue.
- No credentials or signed URLs stored. Authorization decided in the application per read.
- Requires a new migration (026+); migration 025 is untouched.

## 6. Proposed work packages (not authorized)

| WP | Scope |
|---|---|
| **MEDIA-1** | Decision record: provider, upload shape, visibility per class, limits, variants, retention/deletion, cost model, ownership, takedown scope; IDP-04 disposition; proof plan |
| **MEDIA-2a** | Core: port + adapter, upload/finalize, validation/re-encode, `media_assets`, cleanup, deletion, tests |
| **MEDIA-2b** | Profile image (needs MC-2) |
| **MEDIA-2c** | Group cover (Steward) |
| **MEDIA-2d** | Challenge cover |
| **MEDIA-3** | Founder preview before pilot readiness |

Dependencies: MEDIA-1 has none and can start now; 2a needs MEDIA-1 and an environment/credentials decision; 2b needs MC-2; 2c/2d need 2a only; all need the "no production" boundary until separately authorized. MV-206 §6 style proof (valid upload, spoofed/oversized rejection, wrong-role rejection, mobile-size serve, private protection, atomic replace, deletion, orphan cleanup, outage behaviour, cost evidence) should precede any real user images. **No live user images or production use without separate authority.**

## 7. Founder decisions required for MEDIA-1

Provider selection and account owner; budget and alert owner; API-mediated vs direct upload; visibility class per asset type (especially whether any asset may be anonymously public); limits and formats; who may change Challenge covers after establishment; takedown/reporting scope before pilot; retention and deletion timings (ties to IDP-03/LIFE-1); whether Cloudflare Images is in scope for the first release.

## 8. Boundaries

No provider selected, no account created, no bucket, no code, no migration, no upload endpoint, no deployment, no production access. Miledge acquires no Tiizi authority.
