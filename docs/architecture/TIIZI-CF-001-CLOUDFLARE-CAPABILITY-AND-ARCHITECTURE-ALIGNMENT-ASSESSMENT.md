# TIIZI-CF-001 — Cloudflare Capability & Architecture Alignment Assessment

- **Task ID:** TIIZI-CF-001
- **Mode:** Assessment only. No deployment, DNS, auth, data-migration or runtime change is authorised or performed.
- **Status:** Prepared for Founder review
- **Assessment date:** 2026-09-19
- **Base SHA (local checkout `main`):** `5a012396700fde9aee8aa2b72663a2c7e5564bd3`
- **Canonical head SHA assessed:** `e020d7f30e319b8bb050e1993be47f5dcda4b971` (`origin/main`, Master Programme v1.82)
- **Branch:** `docs/tiizi-cf-001-cloudflare-capability-alignment` (branched from `origin/main` @ `e020d7f`; not merged)
- **Assessment method and labels:** identical discipline to `STAGE-G-TIIZI-ENGINE-ALIGNMENT-001` — conclusions are labelled **SETTLED AUTHORITY**, **CURRENT IMPLEMENTATION EVIDENCE**, **ARCHITECTURAL INFERENCE**, or **NEW RECOMMENDATION (not authorisation)**. Implementation inspected at `origin/main @ e020d7f` via `git show` (the local checkout was behind and carried unrelated uncommitted V1 donation-surface changes; those were treated as non-authoritative working-tree noise, not evidence).

## 0. Executive verdict

**Cloudflare's recommended role for Tiizi today is: perimeter/edge only — and even that is limited, optional, and sequenced behind existing architecture authority.**

- Tiizi already has a settled, Founder-approved target infrastructure direction (hybrid strangler: provider-neutral Fastify API + PostgreSQL business truth; Firebase Auth as token issuer; Firebase Hosting retained short-term). Cloudflare must not displace this.
- No Cloudflare compute, storage, or persistence capability is justified now. Several are REJECT on portability grounds.
- A small set of perimeter capabilities (DNS/TLS, CDN/cache, WAF/DDoS, rate limiting) is **portable edge tooling** that could be adopted at deployment/production-DNS time — not before.
- One bounded, reversible pilot **is justified now**: Cloudflare Tunnel + Access exposing a locally-running V2 preview for remote/mobile Founder review. It touches no domain code, no database, no production DNS, and no auth provider.

## 1. Tiizi's current technical position

### 1.1 Authoritative documents inspected

| Document | Role |
|---|---|
| `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (v1.82 @ `e020d7f`) | Single authoritative programme roadmap; Stage G in progress; S1/S2/S2a/S2b/S2g/S3a complete; S3b authorised, implemented on unmerged branch `impl/s3b-activity-application-001` (v1.84, stop-before-merge) |
| `docs/programme/STAGE-G-TIIZI-ENGINE-ALIGNMENT-ASSESSMENT.md` | Founder-accepted disposition B: engine baseline partial; bounded engine gaps must close before broad experience work |
| `docs/architecture/TIIZI-V2-FORWARD-TECHNOLOGY-ARCHITECTURE-DECISION.md` (TIIZI-V2-ARCH-001) | SETTLED AUTHORITY for target stack: Option B hybrid — Firebase Auth retained as issuer, PostgreSQL for core domain truth, provider-neutral Fastify API, Firebase Hosting/Storage retained short-term behind abstractions |
| `docs/programme/STAGE-G-HYBRID-ARCHITECTURE-DECISION-CANDIDATE.md` | Firestore remains authority for Group existence/lifecycle and live Membership; PostgreSQL authoritative for Knowledge, Challenge/configuration, Participation, Evidence, Derived Truth; provider-neutral seams mandatory |
| `api/DEPLOY.md` @ `origin/main` | Authorised **PLAN-ONLY** production runbook: Fastify API on **Google Cloud Run** + **Cloud SQL PostgreSQL 17** in `africa-south1`; Firebase Hosting/Auth/Functions untouched during strangler; migration/parity/cutover rules defined |
| `docs/governance/platform/01-TIIZI-PLATFORM-CONSTITUTION.md` and Stage F package | Engine-first product chain: `Member → Group → Challenge → Participation → Activity → Calculation → Result` |
| `docs/experience/**`, EA-01 record (per Master Programme v1.82) | V1 experience frozen/reference-only; V2 receives a new shell from the adopted Experience Reference; V1 cannot host V2 |

### 1.2 Engine / domain maturity

**CURRENT IMPLEMENTATION EVIDENCE.** A real, server-owned V2 engine exists on `origin/main`: token→member mapping (`api/src/auth.ts`), fail-closed Firestore Group/Membership authority adapter (`api/src/firestoreGroupAuthority.ts`), atomic challenge establishment, participation episodes, atomic activity application with idempotency and knowledge pins, deterministic Collective/Competitive/Streak derivation with replay (`api/src/derivedTruth.ts`), knowledge lifecycle with publication controls, and V2 read/join/withdraw/log routes (`api/src/app.ts`). Migrations 001–017 exist; migrations 007–017 are merged-but-**not deployed**. Streak temporal semantics and authoritative replay rebuild are bounded gaps (Stage G, EBC series; EBC-01→04 merged).

**Classification: PARTIALLY IMPLEMENTED engine baseline, on an authorised closure path. Not yet a complete operational engine, but far past prototype.**

### 1.3 Runtime architecture

- **SETTLED AUTHORITY (TIIZI-V2-ARCH-001 + api/DEPLOY.md):** one provider-neutral Node 22/TypeScript Fastify service (`api/`), Dockerfile, `/health` + `/ready`, explicit `pg` access, no ORM, firebase-admin isolated to a token-verifier adapter. Production target: **Cloud Run + Cloud SQL PostgreSQL 17**, plan-only, not yet executed.
- **CURRENT IMPLEMENTATION EVIDENCE (legacy/transitional):** Firebase Cloud Functions (`functions/`) — callables + scheduled `challengeLifecycleJobs` + triggers against Firestore. These are the V1/V1.5-era authority path and are transitional during the strangler. V1 SPA surfaces and services are frozen per EA-01.

### 1.4 Frontend architecture

React 18 + TypeScript + Vite + TanStack Query 5 + Tailwind SPA. V2 slices (S1/S2/S3a) are merged and Founder-preview-verified; PF-05 wizard exists on an unmerged branch but is **not approved for merge**. V1 screens/services remain in-tree as frozen reference/legacy.

### 1.5 Backend/API boundaries

REST + small RPC escape hatch on the Fastify API; thin frontend consumers (`src/api/v2ChallengeApi.ts`, `src/hooks/useV2Challenges.ts`). Domain code does not import Fastify (stated in `api/README.md`, verified structurally).

### 1.6 Data-authority architecture

- **PostgreSQL (Cloud SQL target):** V2 Knowledge, Challenge/configuration, Participation, Evidence, Derived Truth.
- **Firestore (transitional authority):** Group existence/lifecycle and live Membership, read fail-closed by the API; Phase B cutover contract defined in `api/DEPLOY.md` §12/§14.
- **Firebase Storage:** current image/object store (`src/lib/firebaseStorage.ts`, `src/services/imageUploadService.ts`); target per ARCH-001 is an **S3-compatible store with API-issued signed URLs**.

### 1.7 Authentication / identity

**SETTLED AUTHORITY.** Firebase Auth is the token issuer, deliberately retained; isolated behind UID→`member_id` mapping; domain code never sees Firebase UIDs. Identity architecture is **final for now** by explicit decision (ARCH-001 §5, §10). No migration is open.

### 1.8 Deployment / hosting position

- Frontend: Firebase Hosting (`firebase.json`, SPA rewrites); deploy scripts present.
- API: containerised, **not yet deployed anywhere production**; runbook is plan-only.
- No production DNS customisation is recorded in the repository.

### 1.9 Local / preview workflow

**CURRENT IMPLEMENTATION EVIDENCE.** Localhost-first: Vite dev server, Firestore/Auth emulators (`firebase.json` emulators block), `docker compose` local PostgreSQL, worktree-per-slice (`impl/s2a`, `impl/s3b` etc.), and Founder previews performed **locally** (S1, S2b, S2g records all say "Founder local preview verified…"). No hosted preview environments exist.

### 1.10 Public / org / internal surfaces

V1 app is public-facing on Firebase Hosting (frozen). V2 surfaces (member shell, groups, challenges) are Founder-preview-stage, not publicly launched. Admin/internal surfaces are V1 services + Functions callables (transitional).

### 1.11 Object storage / async requirements

- Object storage: image uploads via Firebase Storage today; S3-compatible target named in authority.
- Async/background: scheduled Functions (`challengeLifecycleJobs`) for challenge lifecycle; outbox/queued-mutations identified as the provider-neutral offline/notification direction (ARCH-001 §2).

### 1.12 Current provider dependencies

Firebase (Auth, Hosting, Firestore, Storage, Functions, Emulator Suite) and GCP (firebase-admin SDK; planned Cloud Run + Cloud SQL + Secret Manager). PostgreSQL driver is portable. No Cloudflare dependency exists anywhere in the tree (only incidental lockfile noise).

### 1.13 Unresolved infrastructure decisions (relevant to Cloudflare)

1. **Production domain/DNS ownership** — not recorded in repo; required before any edge capability matters.
2. **Object-storage target** — "S3-compatible store + signed URLs" is settled direction; the specific vendor is an open procurement choice. (R2 is one S3-compatible candidate; nothing more.)
3. **Execution of the Cloud Run/Cloud SQL plan** — plan exists, not executed; deployment-pilot readiness is governed by `api/DEPLOY.md`, not by this task.
4. **Hosted preview** — no requirement for hosted previews is recorded in settled authority; Founder previews have worked locally. Remote/mobile review is a *convenience gap*, not a governed requirement.

### 1.14 Conflict report (code vs authority)

- V1 SPA + client-service writes + Functions remain the bulk of `src/` and `functions/`, but are **frozen/superseded** by EA-01 and the strangler plan. No Cloudflare recommendation is built on them.
- Uncommitted local working-tree changes (donation screens, rules, programme doc edits) are **not** authoritative and were excluded.
- No code/authority conflict affects this assessment's subject matter.

**Conclusion: Tiizi is mature enough for provider-level *perimeter* decisions at deployment time, and mature enough for one narrowly-scoped preview pilot. It is not a candidate for a Cloudflare runtime/persistence decision, because that decision space is already authoritatively occupied.**

## 2. Cloudflare capability fit matrix

| Capability | Classification | Rationale (condensed) |
|---|---|---|
| DNS | **LIKELY LATER** | Prerequisite: a production domain decision. Not needed until a production deployment exists. Zero app changes; fully reversible; standard nameserver portability. |
| TLS / HTTPS | **LIKELY LATER** | Automatically valuable at the same moment as DNS; Cloud Run/Firebase already terminate TLS, so this is a perimeter upgrade, not a gap today. |
| CDN / caching | **LIKELY LATER** | SPA assets are already CDN-served by Firebase Hosting. Real value arrives only if production moves to the API + static-host pattern; adoption is config-only and swappable with any CDN. |
| DDoS protection | **LIKELY LATER** | Problem is anticipated (public launch), not present — no production traffic today. Config-level at the edge; independent of app code. |
| WAF | **LIKELY LATER** | Same as DDoS. Application authz is enforced in the API (fail-closed adapters); WAF is defence-in-depth at launch. |
| Rate limiting | **LIKELY LATER** | Public anonymous flows do not exist yet. Edge rate limiting would be defence-in-depth; must not replace API-level idempotency/authz (which already exist). |
| Bot protection | **LIKELY LATER** | Anticipated only; no evidence of bot-abuse pressure. |
| Turnstile | **LIKELY LATER** | Would protect future public signup/anonymous flows. **Requires frontend application changes**; defer until those flows are assembled (Stage H product work), then prefer a neutral abstraction (CAPTCHA-provider seam). |
| Cloudflare Access | **ADOPT (bounded pilot only)** | Solves a demonstrated, current friction: Founder review of local builds is single-machine; remote/mobile device testing is a real gap (S-slices were all verified on the Founder's local machine). Use only for internal/preview surfaces; must never touch application identity. Reversible by deleting the Access app + tunnel. |
| Cloudflare Tunnel | **ADOPT (bounded pilot only)** | Same pilot: expose an existing localhost Vite preview (and optionally the local API) without hosting changes. Zero app changes; removal = delete tunnel. |
| Cloudflare Containers | **REJECT** | Tiizi already has a legitimate, containerised runtime (Fastify API) with a settled target (Cloud Run). Choosing Containers would exist only because Cloudflare offers it — precisely what this task forbids. |
| Workers | **REJECT** | No Tiizi requirement for an edge JS execution model; domain decisions must remain in the governed API. A Workers rewrite is a speculative rewrite around a vendor API and would weaken the provider-neutral seam that ARCH-001 mandates. |
| Pages | **NOT NEEDED** | Firebase Hosting is settled authority short-term and "any static host later" (ARCH-001). Pages would be a duplicate host with no requirement behind it. |
| R2 | **ARCHITECTURE-DEPENDENT** | The *direction* (S3-compatible object storage + API-issued signed URLs) is settled; the vendor is deliberately open. R2 is a legitimate candidate at that procurement point, and business records (PostgreSQL + authority adapters) remain independently authoritative because R2 would hold blobs only. Do not adopt now. |
| Hyperdrive | **NOT NEEDED** | Tiizi's PostgreSQL will sit privately next to the API (Cloud Run ↔ Cloud SQL). Hyperdrive adds value only if the portable PostgreSQL ends up geographically distant from a Cloudflare-fronted edge — a scenario that does not exist and must not be manufactured. The DB must remain directly connectable without Hyperdrive, which is already true by design (`pg` + `DATABASE_URL`). |
| Queues | **REJECT (now)** | Async needs today (challenge lifecycle) are met by scheduled Functions and are moving into the portable API/job model. A Cloudflare-Queues event backbone would create non-portable persistence/coupling for no demonstrated requirement. Revisit only if a provider-neutral job/event abstraction is architected and justified first. |

Also assessed and rejected implicitly: **D1 / Durable Objects as business storage** — would move authoritative Tiizi business truth into Cloudflare-specific persistence, directly violating the PostgreSQL business-truth decision and the portability mandate. **REJECT** absent an explicit architecture decision, which none exists.

## 3. Edge / security assessment

- **Perimeter vs application security:** Tiizi's authorisation authority is the API (fail-closed Firestore authority adapter + PostgreSQL transactional rules) and Firebase Auth as issuer. Edge capabilities are defence-in-depth only. **No perimeter capability may be treated as application authentication.**
- **Cloudflare Access:** value exists **only** for private Founder/reviewer/internal preview surfaces. It must not become Tiizi's customer/user identity system; application identity is settled (Firebase Auth issuer + member mapping) and this task does not reopen it. Any Access use must be scoped to preview hostnames only, never to production application routes.
- **Independence:** DNS, TLS, CDN, WAF, DDoS and rate limiting can each be adopted or removed at the DNS/hosting layer **without any change to Tiizi domain or application logic**. This is the defining property of every capability recommended below: replaceability with any edge provider (Cloudflare ⇄ AWS CloudFront + Route53 ⇄ Google Cloud Armor, etc.).
- **Adoption timing:** perimeter capabilities require a production domain and a deployed surface. Neither exists. They are therefore deployment-time decisions, not now decisions.

## 4. Runtime and hosting assessment

- **Does Tiizi have a legitimate deployable backend/runtime?** **Yes** — `api/` is a real containerised Fastify service with health/readiness endpoints, migrations, tests (317/317 at the Stage G assessment commit) and an authorised production runbook.
- **Is the runtime boundary clear?** Yes — one service, domain code framework-free, Firebase isolated in adapters.
- **Is engine maturity sufficient for a deployment pilot?** Deployment of the API is governed by `api/DEPLOY.md` (Cloud Run + Cloud SQL, plan-only, migrations not deployed). That is a **separate, already-authorised work package**; this task must not duplicate, preempt, or redirect it.
- **Match against Cloudflare runtime options:**
  - **Containers:** technically feasible (Docker exists) but **rejected** — would overturn the settled Cloud Run/Cloud SQL direction for no Tiizi-side benefit and add vendor runtime coupling.
  - **Workers:** execution-model mismatch (edge-isolate JS vs Node server + `pg` + long transactions). Rejected.
  - **Pages:** not needed (Firebase Hosting retained short-term by authority).
  - **Tunnel in front of a portable runtime:** valid for the preview pilot only.
  - **Provider-neutral deployment with Cloudflare only at the edge:** the correct long-term posture, and only when production exists.

**Verdict: no Cloudflare runtime. The deployable-runtime question is answered by existing authority (Cloud Run), and no Cloudflare runtime substitute is justified.**

## 5. Data architecture and portability

- **Business truth:** PostgreSQL (Cloud SQL target) for V2 domain truth; Firestore transitional for Group/Membership authority; Firebase Auth for identity issuance. All directly connectable and portable — `pg`, standard SQL migrations, no proprietary runtime.
- **Hyperdrive:** not recommended — adds a Cloudflare network dependency between API and database that solves no current problem (same-region Cloud SQL planned). The underlying DB remains directly accessible and portable without Hyperdrive, which is already true by design.
- **R2:** suitable *in principle* for the named future use case (image/attachment blobs with API-issued signed URLs, S3-compatible target per ARCH-001). Business records remain independently authoritative (PostgreSQL) since R2 would hold content blobs only. **Classification stays ARCHITECTURE-DEPENDENT**: adopt at the object-storage procurement decision, via an S3-compatible adapter, not before.
- **D1 / Durable Objects:** would make Cloudflare-specific persistence authoritative for business truth. **Rejected** — violates portability mandate and the settled data authority.
- **No Cloudflare service forces changes to domain truth, and none is recommended in a position where it could.**

## 6. Authentication and public-access implications

- Current identity: Firebase Auth (issuer) → `member_id` mapping. Status: **final for now** (explicitly settled, not transitional).
- Access: useful for preview/internal surfaces only (§3/§8). Must not be used to defer or replace Tiizi's application-identity requirements — none of which this task touches.
- Turnstile: relevant to **future** public anonymous flows; requires frontend changes; defer with a neutral abstraction.
- WAF / rate limiting: material value at public launch; none before.
- Conflicts with Tiizi auth architecture: none, provided Access is confined to non-production preview hostnames and no Cloudflare capability is placed in the application authentication path.

## 7. Asynchronous and edge-processing opportunities

| Candidate | Existing Tiizi requirement? | Verdict |
|---|---|---|
| Workers (edge processing) | None. Domain truth and validation are server-owned in the API. | No |
| Queues | Challenge lifecycle scheduling exists (scheduled Functions); offline queued-mutations are a *provider-neutral outbox* concern. | No Cloudflare Queues; keep neutral |
| Scheduled work | Yes — challenge ending/finalisation. Already implemented (Functions scheduled jobs) and portable into the API's job model. | Satisfied without Cloudflare |
| Delayed / event-driven processing | Anticipated (notifications, outbox) but not yet architected. | Wait for a neutral job/event abstraction decision |

**Rule enforced:** nothing moves engine truth or domain decisions into Workers/Queues. Any future async infrastructure must sit behind a provider-neutral job/event abstraction — this task records that requirement without designing it.

## 8. Preview / development workflow

- **Current:** localhost + emulators + local docker PostgreSQL; Founder previews performed locally. This remains the simplest workflow and is preserved.
- **Genuine gap:** remote and mobile-device Founder review, and deployment-candidate validation, currently require the Founder to be at the build machine. S1/S2/S3 records confirm previews were always local.
- **Low-risk remedy:** Cloudflare Tunnel + Access can expose the existing local Vite preview (and optionally the local API on port 4000) to authorised reviewers on remote devices **with zero application changes** — the app continues to run unchanged on localhost. This is optional and purposeful (per-slice review events), not a mandatory governance gate, and is not a hosting platform.
- **Caution recorded:** preview infrastructure must not be treated as engine maturity; EBC engine gaps and the S3 programme continue to govern regardless.

## 9. Provider lock-in assessment

**ADOPT-pilot capabilities (Tunnel + Access):**

| Dimension | Assessment |
|---|---|
| Cloudflare-specific code | **None** — `cloudflared` runs as a local sidecar process; the app is untouched |
| Cloudflare-specific configuration | Tunnel config + Access policy (throwaway zone/hostname); isolated entirely in infrastructure, not in the repository's application or domain layers |
| Cloudflare-specific data storage | **None** |
| Deployment / runtime / network coupling | Tunnel points at `localhost` — if Cloudflare is removed, reviewers revert to local preview or any other exposure method |
| Removal / replacement procedure | Delete tunnel + Access app (or the entire throwaway zone). Nothing to revert in code, DB, or DNS |
| What remains portable if Cloudflare is removed | **Everything.** The engine, API, database, frontend, and preview workflow are byte-identical before and after |

**LIKELY LATER perimeter capabilities (DNS/TLS/CDN/WAF/DDoS/rate limit):** config-only, DNS-layer, swappable with any edge vendor; coupling is a nameserver delegation, reversible by re-delegation.

**REJECTED capabilities (Workers, Containers, Pages, Queues, D1, DO, Hyperdrive now):** each would place Cloudflare-specific runtime, storage, or network contracts inside or beneath the application core. Isolation in an adapter is *partly* possible for Queues/Hyperdrive but not meaningfully for Workers/D1/DO (whose value *is* the vendor platform). Removal without engine-adjacent rework cannot be demonstrated — which is precisely why they are rejected.

**Pattern applied throughout: portable application core + replaceable infrastructure adapter.**

## 10. Engine-first programme protection

This assessment adds no participant-experience, organisation-experience, or interface-assembly work; recommends no public flows; changes no domain rules, challenge-engine authority, recognition authority, or group/community authority; and invents no APIs. The single piloted capability (preview exposure) exists to support **Founder review of engine-first slices** (S3b and successors), which *reinforces* the engine-first sequence.

Prerequisite engine work that must not be bypassed by infrastructure enthusiasm (per Stage G / Master Programme v1.82): EBC-05 disposition, S3b merge decision, deployment of migrations 007–017, Phase B Knowledge cutover per `api/DEPLOY.md` §12/§14.

## 11. Unrelated architecture

Nothing reopened. The only non-Cloudflare observations that materially affect this assessment were already-governed items (deployment plan, object-storage direction), which are cited as authority rather than challenged. The uncommitted local donation-surface changes were noted under §1.14 and otherwise ignored.

## 12. Recommended sequencing

### A. Low-risk perimeter capabilities (adopt at production-DNS time, not now)
DNS → TLS → CDN/caching → DDoS protection → WAF → edge rate limiting. All config-layer, all swappable, zero app changes. Each is a **replaceable adapter** at the DNS/hosting boundary.

### B. Architecture-dependent capabilities (wait for a specific Tiizi decision)
- **R2** — waits for the S3-compatible object-storage procurement decision; adopt only behind an S3-compatible adapter with API-issued signed URLs.
- **Turnstile** — waits for public anonymous flows to be assembled (Stage H), behind a CAPTCHA-provider seam.
- **Bot protection** — with public launch.

### C. Runtime-dependent capabilities (only once a production runtime exists per `api/DEPLOY.md`)
Any reconsideration of edge-fronting the deployed API, Hyperdrive (only if geography ever justifies it), or edge rate limiting in front of production traffic.

### D. Not recommended
Workers, Cloudflare Containers, Pages, Queues, D1, Durable Objects. No demonstrated Tiizi requirement; disproportionate or non-isolatable coupling; would redirect the programme against settled authority.

Do not bundle unrelated capabilities into a single adoption decision; each classification above is an independent decision gate.

## 13. Live-pilot readiness

**GO — one bounded pilot justified.**

| Criterion | Status |
|---|---|
| Actual Tiizi problem | Yes — remote/mobile Founder review of local builds (demonstrated across S1/S2/S3 preview records) |
| Isolated from business truth | Yes — no DB, no API changes; the tunnel exposes localhost only |
| Reversible | Yes — delete tunnel/Access app |
| No database migration | Yes |
| No auth-provider migration | Yes — Access covers preview hostnames only; Firebase Auth untouched |
| No domain redesign | Yes |
| No production DNS | Yes — use a dedicated throwaway/review domain or `*.trycloudflare.com` where Access policy allows; **never** production DNS |
| No production deployment | Yes |
| Useful architectural evidence | Yes — tests whether hosted protected review materially improves slice-verification cadence, and whether Access can serve internal preview needs without touching application identity |

**Smallest reversible pilot — TIIZI-CF-001-P1:**
- **Hypothesis:** A Founder/reviewer can open a locally-running V2 preview from a remote mobile device through a protected Cloudflare Tunnel with no change to the Tiizi application.
- **Scope:** one named tunnel on a throwaway review hostname; Cloudflare Access (one-time PIN) limited to ≤5 reviewer addresses; exposes Vite preview (and optionally `localhost:4000` API pointing at local docker PostgreSQL).
- **Success criteria:** reviewer completes a governed V2 journey (identity → group → challenge → activity log) on a remote device; Access denies non-listed addresses; app repo shows zero diffs from `origin/main`.
- **Rollback:** `cloudflared` stop + delete tunnel/Access app. Removal effort < 10 minutes.
- **Explicitly out of scope:** production DNS, production deployment, Firestore/PostgreSQL changes, any Cloudflare compute/storage capability.

## 14. Stop-condition compliance

Reviewing every stop condition: no engine/domain redesign, no premature experience assembly, no runtime selection (the settled Cloud Run plan stands), no database migration, no auth-provider migration, no product/UX work, no production DNS or deployment, no Workers/Queues/edge-processing adoption, no D1/DO authority, no rewriting of portable logic. The single pilot sits entirely outside these boundaries.

## 15. Summary return block

- **Base SHA:** `5a012396700fde9aee8aa2b72663a2c7e5564bd3` (local `main`)
- **Branch / head:** `docs/tiizi-cf-001-cloudflare-capability-alignment` @ this commit's SHA (branched from canonical `origin/main` `e020d7f30e319b8bb050e1993be47f5dcda4b971`)
- **Changed files:** `docs/architecture/TIIZI-CF-001-CLOUDFLARE-CAPABILITY-AND-ARCHITECTURE-ALIGNMENT-ASSESSMENT.md` (this document)
- **Authoritative sources used:** Master Programme v1.82; STAGE-G-TIIZI-ENGINE-ALIGNMENT-ASSESSMENT; STAGE-G-HYBRID-ARCHITECTURE-DECISION-CANDIDATE; TIIZI-V2-ARCH-001; `api/DEPLOY.md`; `api/README.md`; platform constitution; EA-01 record (via Master Programme)
- **Implementation inspected:** `api/` (src, migrations, Dockerfile, DEPLOY.md), `functions/src`, `src/` services/hooks/lib, `firebase.json`, `firestore.rules`, `storage.rules`
- **Authoritative vs legacy/transitional findings:** V2 engine + API + S-slice frontend = authoritative active implementation; V1 SPA/services + Functions = frozen/transitional per EA-01 and the strangler plan; uncommitted local working-tree changes = non-authoritative
- **Capability matrix summary:** ADOPT(pilot): Access, Tunnel. LIKELY LATER: DNS, TLS, CDN, DDoS, WAF, rate limiting, bot protection, Turnstile. ARCHITECTURE-DEPENDENT: R2. NOT NEEDED: Pages, Hyperdrive. REJECT: Workers, Containers, Queues, D1, Durable Objects.
- **Recommended Cloudflare role for Tiizi:** optional replaceable perimeter + a bounded protected-preview pilot; nothing more.
- **Immediate low-risk opportunities:** Tunnel + Access preview pilot (§13).
- **Architecture-dependent:** R2 (object-storage decision), Turnstile/bot protection (public flows), perimeter stack (production DNS).
- **Not recommended:** Workers, Containers, Pages, Queues, D1, Durable Objects, Hyperdrive (now).
- **Blockers / unresolved decisions:** production domain ownership; object-storage vendor choice; execution of the authorised Cloud Run/Cloud SQL plan.
- **Does Tiizi have a legitimate deployable runtime?** Yes (`api/`), with an authorised plan-only deployment runbook; deployment is a separate governed work package.
- **Is a bounded live pilot justified now?** **Yes** — exactly one (preview exposure), as scoped in §13.
- **Merge status:** not merged, per execution boundary.








