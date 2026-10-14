# TIIZI MC-2 — Profile Foundation: Authority Reconciliation + Implementation Readiness 001

**Package:** MC-2A — authority reconciliation / readiness (docs only)
**Date:** 2026-10-14
**Base:** `a358b308ee583c2dfc2715668b4a1be8eda714e0` (canonical `origin/main`; Master Programme 2.67)
**Branch:** `docs/mc2-profile-foundation-readiness`
**Status:** READINESS ONLY / NO IMPLEMENTATION AUTHORIZED. STOP FOR FOUNDER REVIEW.
**Boundaries:** No code. No migration. No deployment. No production access. Archived V1 untouched.

## 0. Verdict (read first)

**A. READY FOR FOUNDER AUTHORIZATION OF MC-2 IMPLEMENTATION**

MC-2 (base Profile only, as defined by the Founder Disposition) is authority-complete and
implementation-ready to be authorized as bounded work packages (MC-2B/C/D proposed in §14).
No genuine Founder/product decision blocks MC-2 itself. The open items in §15 belong to
MC-3, MEDIA-1/2, LIFE-1, or later design choice inside already-given authority — none of them
requires answering before MC-2B may begin. Authorizing this readiness record does not authorize
any MC-2 implementation; each implementation package still needs its own Founder authorization.

## 1. Authority trace

Effective authority (highest first):

1. **Founder Disposition — `docs/programme/TIIZI-MEMBER-COMPLETION-FOUNDER-DISPOSITION-001.md`**
   (2026-10-10, finalization pass, Master Programme v2.60). EFFECTIVE. Defines MC-2 as
   "Profile Foundation — base Profile only", MC-3 as "Onboarding + Consent" (owns canonical
   Interests/Goals persistence + returning-member completion gate), MC-4 as "Member Identity
   Projection". Key decisions consumed here: FD-MC-02 (pilot Profile), FD-MC-03 (display name),
   FD-MC-05 (versioned consent, MC-3), §7 (pilot Profile scope + bootstrap), §8 (R2 + scope-based
   media ownership + cover mutation), §10 (account lifecycle; LIFE-1/STEW-1 — not MC-2),
   §12 (migration numbering rule), §13 (pre-pilot programme: MC-1 → MC-2 → {MC-3 ∥ MC-4 ∥ …}),
   §14 (remaining Founder inputs).
2. **MC-1 closure + implementation records** —
   `TIIZI-MC-1-CLOSURE-RECORD-001.md` (MC-1 FOUNDER ACCEPTED / MERGED / CLOSED, PR #91 merge
   `c41c17e`, accepted head `b20287a`, migration 026 merged as code / NOT deployed, CI green,
   exact-head Codex waiver for PR #91 only) and
   `TIIZI-MC-1-MEMBER-BOOTSTRAP-IMPLEMENTATION-001.md` (authoritative `POST /api/members/bootstrap`
   contract; nullable insert-only `members.display_name`; 120-code-point transport/storage bound
   explicitly **not** Product Truth; no email-prefix derivation; no V1 import; pre-existing NULL
   retained). MC-1 carry-forward (closure §"Carry-forward to MC-2"): Today greeting and other V2
   member-name consumers must migrate from the legacy local profile cache to the governed V2
   Profile / canonical member identity once MC-2 provides that read model; archived V1 unchanged.
3. **Profile Domain Standard — `docs/governance/domains/01-PROFILE-DOMAIN-STANDARD.md`.**
   Profile as governed representation of Identity; principles (one Profile per identity,
   participation-support, privacy-precedes-convenience, preferences confer no authority,
   presentation subordinate, attributable truth); visibility classes
   (Public / Authenticated-discoverable / Shared-group / Private / Privileged-operational);
   explicit deferrals (field definitions, completion/editing workflows, media lifecycle,
   lifecycle/retention/deletion, technical implementation). MC-2 does not contradict it; it
   operates inside the Founder decisions that post-date it.
4. **Identity/Profile/Privacy decisions IDP-01 / IDP-02** (Founder-approved 2026-07-18,
   `docs/reports/platform-foundation-decisions/02-IDENTITY-PROFILE-AND-PRIVACY-DECISIONS.md`):
   IDP-01 minimal-disclosure classification framework; IDP-02 enforceable toggles + versioned
   consent record (version, time, source, user). IDP-03 (lifecycle) and IDP-04 (profile media)
   remain **pending** as standalone decisions; their pilot-relevant substance is now carried by
   the Founder Disposition (FD-MC-06a/LIFE-1/STEW-1; FD-MC-07a/R2 + MEDIA assessment) — see §6/§8.
5. **Media Capability Assessment — `docs/programme/TIIZI-MEDIA-CAPABILITY-ASSESSMENT-001.md`**
   (R2 selected FD-MC-07a; MEDIA-1 decision record; MEDIA-2a core → 2b profile → 2c/2d covers;
   MEDIA-2b needs MC-2; scope-based ownership; profile image visible only where identity is
   authorized, not anonymously public). MEDIA remains separate; MC-2 establishes only the
   Profile-side slot (§8).
6. **Master Programme 2.67** (`docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`): MC-1 closed;
   MC-2/MC-3/MC-4/MEDIA/REC-1/LIFE-1/STEW-1/CF-2+/BG-1 NOT STARTED; migration 026 merged as
   code / NOT deployed; migration 025 Group-Feed-specific / NOT deployed / CHECK gap recorded.
7. **Historical assessment — `docs/programme/TIIZI-MEMBER-COMPLETION-ASSESSMENT-001.md`**
   (2026-10-10, base `365c958`). Assessment-only, no implementation authorized. Its factual
   findings (provisioning gap, lost sign-up name, placeholder Profile, no identity projection,
   email-prefix fallback) are unchanged and are now largely resolved by MC-1 for bootstrap.
   Its **work-package numbering (§F) is superseded** for MC-2/MC-3 — see §2. Its package-content
   recommendations on media deferral, Feed-last, and no-collection-without-consumer were
   superseded by the Founder Disposition (already annotated in the assessment's own §"Founder
   disposition update — READ FIRST", preserved).

Evidence inspected (implementation facts only, not Product Truth): `api/migrations/001_*`
(members base), `026_member_canonical_display_name.sql`, `api/src/members.ts`,
`api/src/memberBootstrap.ts`, `api/src/auth.ts`, `api/src/apiPrefix.ts` (`/api` canonical),
`api/src/app.ts`, `api/src/memberships.ts` (`GET /api/memberships/me`),
`api/src/challengeReads.ts` / `challengeParticipationRoutes.ts` (Challenge visibility +
   join/withdraw; no own-participation summary endpoint), `src/context/AuthContext.tsx`
(`tiizi_profile` localStorage cache + email-prefix fallback), `src/v2/today/V2TodayScreen.tsx`
+ `todayView.ts` (greeting), `src/v2/auth/*` (V2-only sign-up, handoff, token binding),
`src/v2/member/memberPages.tsx` (`V2ProfilePage` → placeholder), `src/v2/member/MemberShell.tsx`
(hard-coded "Member", account sheet), `src/v2/auth/V2SignUpPage.tsx` (Terms/Privacy links).

Product Truth was not inferred from archived V1. V1 was not consulted for design.

## 2. Historical package-number reconciliation

| Source | MC-2 | MC-3 | Status |
|---|---|---|---|
| Assessment 001 §F (proposed, pre-Founder) | Profile **Product Truth contract** (docs-only, like GF-01) | V2 Profile **read/self-edit** (`/api/me`, `/v2/profile`, sign-out) | **SUPERSEDED for numbering.** Preserved as history; do not follow. |
| Assessment 001 §F (same) | — | — | MC-4 there = identity projection; MC-5 = orientation; MC-6 = Feed Truth; MC-7 = media. Also superseded as a numbering scheme. |
| **Founder Disposition 001 §13 (EFFECTIVE)** | **MC-2 = Profile Foundation — base Profile only** (profile store, display name + history, own email, profile-image slot, Group/Challenge summary, sign-out, Terms/Privacy presentation, other non-preference fields; **does not persist Interests/Goals**) | **MC-3 = Onboarding + Consent** (owns canonical Interests/Goals selection + persistence and the returning-member completion gate) | **Governs.** All future implementation agents follow this split. |
| Founder Disposition 001 §13 | MC-4 = Member Identity Projection (needs MC-2) | REC-1 = relevance (needs MC-3 data); MEDIA-2b needs MC-2; LIFE-1 needs MC-2 + STEW-1 | Governs. |

Resolution:

- The Founder Disposition is the **effective authority**. Where it conflicts with the assessment
  (including §F numbering and the older "MC-2 = contract / MC-3 = implementation" shape),
  the Disposition governs.
- Historical records are **annotated, not erased**. The assessment already carries a
  "Founder disposition update — READ FIRST" table; this readiness pass adds the minimal
  numbering-supersession annotation in §16 (one note pointing at §F, original text untouched).
- This document (MC-2A) is itself the Profile-readiness/contract input the Disposition's §13
  row calls "Profile Product Truth contract": it is the **readiness/contract pass inside the
  effective MC-2**, not the assessment's old standalone "MC-2 contract package". The proposed
  implementation split is MC-2A (this doc) → MC-2B (storage + API) → MC-2C (UI + consumer
  migration) → MC-2D (Founder preview/acceptance), §14.

## 3. Effective MC-2 definition

**MC-2 — PROFILE FOUNDATION — BASE PROFILE ONLY.**

In scope (all require MC-1, which is closed):

1. Governed own-member Profile read model (server-side, actor from verified token only).
2. Canonical member display name read + member-controlled edit with accountable server-side
   change history (§5).
3. Own/self-visible email presentation (read-only; Firebase-sourced; §6).
4. Profile-image **slot/reference boundary only** (nullable reference + initials fallback; §8).
5. Own Groups summary + own Challenges summary composed from existing governed reads (§9).
6. Editable approved base Profile fields (non-preference only; §7 — in practice: display name;
   any further field needs its own authority and is NOT assumed).
7. Sign out (V2 member surface; the account-sheet "arrives with the next slices" gap closes).
8. Terms presentation + Privacy presentation through V2-owned surfaces or approved external
   legal URLs — never archived V1 screens (§11).
9. Migration of appropriate V2 own-member name consumers off the legacy local profile cache
   onto the governed read model (§10).
10. Display-only honest empty states for everything deferred; no control that implies an
    unenforced effect (IDP-02 truth-in-UI rule).

Out of scope — MC-2 MUST NOT (unless a current authority source cited here says otherwise):

- Persist Member Interests or Member Goals (MC-3 owns canonical selection + persistence;
  Profile editing of them consumes MC-3; Disposition §5.3/§5.7/§13).
- Implement onboarding Interests/Goals selection, the returning-member completion gate
  (display-name capture, Interests 1–5, Goals 1–3, independent Terms/Privacy consent checks),
  or versioned consent retention (MC-3; Disposition §4/§6).
- Implement recommendation logic / REC-1 (needs MC-3 data + vocabulary prerequisites).
- Implement shared-context Member Identity Projection (MC-4; needs MC-2). MC-2 serves only
  the **own-member** read; other members' names remain "Tiizi member" until MC-4.
- Implement media upload/storage/R2, signed upload, processing, `media_assets`, delivery URLs,
  Cloudflare Images (MEDIA-1 decision → MEDIA-2a core → MEDIA-2b profile; §8).
- Implement account deletion/lifecycle (LIFE-1), stewardship transfer (STEW-1), background
  processing (BG-1), Challenge Feed (CF-2+), Kudos/Share/announcements/comments.
- Collect or store health/body/birth/contact data, DOB, sex/gender, weight, height, phone,
  address, health status, biography, occupation, location, or any generic social-profile field
  (§13 — expressly avoided without separate authority).
- Change archived V1 in any way (frozen; MC-1 V1-freeze preserved).

## 4. Profile Product Truth / contract (MC-2)

- **One Profile per governed identity** (Profile Standard §4.1). The Profile is keyed 1:1 to the
  canonical `members` row established by MC-1; it has no independent identity (consistent with
  the assessment's store design note).
- **Purpose:** support safe, attributable group participation (Standard §§1–2, 4.2). The Profile
  does not establish membership, participation, activity, progress, ranking, or verification
  (integrity rules §9.1–9.3).
- **Authority:** the member is authority for own permitted Profile content (CIC §4.2 via
  assessment); Identity Authority establishes authoritative identity/Profile state within
  approved privacy/lifecycle rules; no Group, Steward, Operator, presentation, or local copy
  acquires Profile truth authority (Standard §§6–7). Only explicitly approved administrative
  action under least privilege + durable accountability is permitted — none is approved for MC-2.
- **Preferences confer nothing** (Standard §§4.4, 9.4): MC-2 holds no preference data at all.
- **Presentation subordinate** (Standard §§4.8, 9.6): Today greeting, summaries, initials avatar
  are presentations of Profile truth, never competing authorities; local caches (legacy
  `tiizi_profile`, sessionStorage hand-off) are transport/convenience only and never authority.
- **Privacy precedes convenience; deny by default** (Standard §§4.3, 4.7, §10; IDP-01/02):
  field-level matrix in §12. The only cross-member visibility MC-2 enables is **none** — the
  own-member read model is Private to the member; shared-context visibility is MC-4.
- **Attributability** (Standard §§4.9, 9.9): display-name changes are audit-recorded with
  actor = the member + timestamp (§5). Consent-evidence semantics (IDP-02) are NOT implemented
  in MC-2 (MC-3).
- **Uncertainty represented truthfully** (rule 12): pre-existing NULL display name persists
  until the MC-3 gate; empty states are honest; nothing looks like a setting but does nothing.

## 5. Display-name contract

MC-1 established (authoritative, unchanged):

- `members.display_name`: nullable; first-create capable (optional insert-only body on
  `POST /api/members/bootstrap`); no backfill; no email-prefix derivation; no V1 import;
  no history table; CHECK (trimmed, 1–120 code points); merged as code / NOT deployed.

MC-2 governed later behavior (within FD-MC-03 + Disposition §7; no new Product Truth invented):

1. **Member controls own display name.** Self-edit only. No Steward/Operator/Group edit path.
2. **No uniqueness requirement.** Collisions are lawful; identity is the opaque member id, never
   the name.
3. **Not globally public.** MC-2 exposes the name only to its own member via the own-read model.
   Shared-context visibility (shared-group / authorized Challenge contexts) belongs to the
   governed MC-4 projection; MC-2 MUST NOT expose another member's name.
4. **Accountable server-side change history.** Every accepted change appends an immutable,
   server-written history row (old value, new value, actor = member, timestamp, source/context).
   History is audit/attribution metadata, not a user-facing name list.
5. **Previous names not shown in normal presentation.** Ordinary reads return the current name
   only; history is readable only through explicitly authorized audit/operational paths
   (none approved for MC-2 client).
6. **Validation (carried, not new Truth):** trimmed; NFC-normalised; 1–120 Unicode code points;
   no control characters. The 120 bound remains a **technical storage bound** (MC-1 record),
   not automatically Product Truth. No new length/content-policy rule is invented here; any
   future content policy is a separate Founder disposition.
7. **NULL remains possible** until the MC-3 completion gate. A member with NULL has a governed
   Profile with an empty name state; nothing derives a placeholder identity (no email prefix,
   no "Tiizi User", no V1 import); nothing empty flows into MC-4 (Disposition §4).
8. **Write semantics (serialized, CORR-001):** member-scoped update in one transaction with
   a row lock, so concurrent edits serialize and history stays truthful:
   1. `BEGIN`;
   2. `SELECT display_name FROM members WHERE member_id = $1 FOR UPDATE`;
   3. validate the candidate (trimmed, NFC, 1–120 code points, no controls) → `400
      invalid_display_name` on failure (same shape as MC-1);
   4. if the new name equals the locked current value, treat as a **no-op**: return the
      current read model and append **no** history row (documented here, not invented later);
   5. append the history row using the locked current value as `old_display_name`;
   6. update `members.display_name`;
   7. `COMMIT`.
   A plain READ COMMITTED read-then-write without the lock is NOT sufficient: it can record
   false before/after transitions under concurrent edits. Last-writer-wins describes only the
   row outcome, never the audit truth.
9. **Concurrency/idempotency:** no client-supplied idempotency key required for v1 (each PATCH
   is an explicit user intent; retries converge on the same value and repeat submissions are
   no-ops by rule 8.4). MC-2B implementation tests MUST prove: two concurrent edits serialize;
   recorded history transitions match the actual committed sequence; old/new values are
   truthful; no lost or false audit transition.

## 6. Email authority disposition

Determination (from Disposition §7 "email shown to self", CIC §4.1 privileged-operational,
IDP-01 minimal disclosure, assessment §A.3/A.5, and code facts):

1. **Firebase Auth is the identity/email source.** The canonical email is the raw Firebase
   user address (`user.email`, which may be null) and, server-side, the verified Firebase
   token/auth identity claims. No evidence authorizes a second canonical email.
2. **PostgreSQL MUST NOT duplicate email in MC-2.** No `members.email` column, no email table,
   no email sync job. Rationale: duplicate canonical email state creates reconciliation,
   staleness, and disclosure risk for zero MC-2 purpose.
3. **Recommended implementation path (explicit, CORR-001): `GET /api/me` carries domain
   Profile truth only and contains NO email.** The V2 Profile UI presents email directly from
   the raw Firebase `user.email` (read-only, may be null). Email stays outside PostgreSQL and
   outside PATCH. If server-side email becomes necessary later, it is added deliberately from
   verified token claims — never backfilled from a client cache.
4. **The shared `AuthContext.profile.email` MUST NEVER be used as authoritative email.**
   `profileFromFirebaseUser` fabricates the fallback `user@tiizi.app` when Firebase email is
   absent (`src/context/AuthContext.tsx`), so that value is not truth. No fabricated/fallback
   email is ever presented as the member's address, and no email-prefix derivation is permitted
   anywhere in the MC-2 path.
5. **Email mutation does NOT belong to MC-2.** Email change (if ever) stays in Firebase account
   management under the auth lifecycle. `PATCH /api/me` MUST NOT accept email (unknown-key
   `400`). No email history in MC-2.
6. **No other member receives another member's email.** Email is Private/self-only and
   privileged-operational; shared-context identity (MC-4) MUST NOT expose email (§12).
7. If a future package needs server-side email (e.g. LIFE-1 auth-severance design, operational
   notices), that package seeks its own authority. MC-2 creates no email persistence to "help".

## 7. Profile read / self-edit contract (proposed, implementation-ready)

Recommended shape: **`GET /api/me` + `PATCH /api/me`** under the canonical `API_PREFIX`
(`/api`; `api/src/apiPrefix.ts`). Rationale: no member read/write endpoint exists today
(only `GET /api/memberships/me` for groups and `POST /api/members/bootstrap`); `/api/me`
is the smallest conventional own-member resource; it avoids inventing a versioned namespace
(the repo deliberately retired the informal `/v1` prefix).

- **Authentication/authorization:** `requireAuth` (verified Firebase token → `members` row;
  unknown subject → strict `401 unknown_member`, unchanged). Actor derived **solely** from the
  token. The request MUST NOT accept any member id, subject, uid, role, or email input; any
  such field is ignored (MC-1 precedent) or rejected with `400`.
- **GET /api/me → 200** (own member only; domain truth only):
  ```json
  {
    "memberId": "<uuid>",
    "displayName": "<string | null>",
    "profileImage": { "status": "not_configured" },
    "groups": { "count": 0, "items": [] },
    "challenges": { "activeCount": 0, "historyCount": 0, "items": [] }
  }
  ```
  Notes: `displayName === null` means no canonical display name — there is deliberately NO
  `hasDisplayName` boolean, so no second truth can drift or be consumed incorrectly by MC-3.
  `profileImage` is the slot projection only (`not_configured` until MEDIA-2b; §8). `groups` /
  `challenges` are composed summaries (§9). NO email key (presented client-side from raw
  Firebase `user.email`; §6). NO legal URLs (application routing/presentation config, not
  member domain truth; §11). No Interests/Goals keys. No other member's data.
  Errors: `401` (missing/invalid/unknown); `500` unexpected only.
- **PATCH /api/me** — explicit allowlist: **`displayName` only**.
  ```json
  { "displayName": "<1..120 code points, trimmed, NFC, no controls>" }
  ```
  - Unknown/extra keys (including `email`): reject `400` (fail closed; prevents silent scope creep).
  - Empty-string after trim: `400 invalid_display_name` (clearing to NULL is NOT authorized;
    NULL arises only from pre-MC-2 history / first-create without a name).
  - Equal-to-current value: no-op success, no history row (§5.8).
  - Success → `200` with the GET shape (updated `displayName`) + history row committed atomically
    under the §5 row-lock protocol.
  - Auth errors mirror GET.
- **Audit:** server-side history append per accepted change (actor, before/after, timestamp,
  source `profile_self_edit`), serialized per §5. No client-supplied audit input.
- **Abuse/rate limiting (CORR-001 scope correction):** NOT part of the MC-2 Product/Profile
  contract. The repository has no shared limiter and no current authority requires a specific
  MC-2 rate-limit mechanism, so none is specified here — no values, no mechanism. Abuse control
  is implementation hardening / operational control that may be added under general API security
  policy; if ever enforced in a multi-instance runtime it must use a shared enforcement
  mechanism, and in-memory per-instance semantics must never be misrepresented as a global bound.
- **What is NOT in this contract:** signup/bootstrap (MC-1, unchanged), onboarding gate (MC-3),
  other-member reads (MC-4), media upload (MEDIA-2b), consent records (MC-3), preferences.

## 8. Profile-image slot boundary (MEDIA stays separate)

- MEDIA-1 (decision) → MEDIA-2a (core port/adapter + `media_assets`) → **MEDIA-2b (profile
  image, needs MC-2)** → MEDIA-3 (preview). MC-2 is the "needs" dependency, not the implementer.
- MC-2 establishes ONLY: Profile UI/image **slot semantics**, an **initials fallback**
  (derived from the current display name; purely presentational, never stored), a nullable /
  unavailable image **projection state** (`{ "status": "not_configured" }` until MEDIA-2b), and
  the **future attachment point** plus the **projection rule** (image visible only where the
  member identity itself is authorized; never anonymously public — Disposition §8.3 / Media
  Assessment §4).
- **MC-2B MUST NOT require `media_assets` or a media FK to implement base Profile** (CORR-001
  sequencing correction). MEDIA-2a owns the `media_assets` model and may not exist when MC-2B
  begins; making MC-2 depend on it would create a circular/false dependency. No media column
  or FK is created in MC-2B.
- The actual persistent media reference is added in **MEDIA-2b**, after both prerequisites
  exist: the MEDIA-2a core media model AND the MC-2 Profile. This preserves both chains —
  MEDIA-2a → MEDIA-2b and MC-2 → MEDIA-2b — without MC-2 depending on MEDIA.
- MC-2 MUST NOT select or implement: R2 buckets/credentials, upload endpoints (API-mediated or
  direct-grant), signed URLs, decode/re-encode/EXIF strip, size/pixel limits, variants,
  `media_assets` DDL, delivery/CDN, Cloudflare Images, moderation/takedown, cost/budget, or any
  Group/Challenge cover behavior (MEDIA-2c/2d need only MEDIA-2a, not MC-2).
- Until MEDIA-2b lands, the Profile presents the initials fallback with an honest empty state
  ("photo arrives with a later slice"); no control implies an upload that does not exist.
- Deletion-direction note (no action): when LIFE-1 later runs, the Profile image is
  member-scoped and removed with deleted-anonymized state; Group/Challenge covers are
  scope-owned and survive (§8.5 carried for boundary clarity).

## 9. Own Group / Challenge summary

Meaning (Profile presentation of Participation Authority truth, never a new source):

- **My Groups:** groups where the caller holds a current governed membership read through the
  existing authority (`GET /api/memberships/me` — same read the Challenge journey consumes;
  S2-G). Counts are current-membership counts; pending/rejected/left are NOT counted as "mine"
  (pending visibility is a separate experience concern, not Profile truth).
- **My Challenges (CORR-001 — actual participation only):** "mine" means Challenges for which
  the member holds an actual participation episode / governed participation relationship in
  `challenge_participations` — NEVER merely visible, eligible, or discoverable Challenges.
  `GET /api/challenges` is a visibility/entitlement read (it includes Challenges visible
  through Group membership the member never joined) and MUST NOT be reused blindly as the
  "mine" source.
  - **Active set:** participation rows with `status = 'active'` (the schema's one-active-row
    per (challenge, member) invariant makes each row a real episode). An active row in an
    unfinalized ended/window-expired Challenge remains live/current per the recorded
    LIFE-1/composite-liveness authority (Disposition §10.2) — projection exclusion is never a
    substitute for closure, and this rule is carried, not reimplemented, here.
  - **History set:** rows with `status IN ('withdrawn', 'removed')`, plus active rows whose
    governing Challenge is canonically **finalized** (historical by lifecycle context; the
    stored row is preserved unchanged).
  - **Lifecycle filtering** respects the governing Challenge state; finalized participation may
    be historical; no new participation truth is created by Profile.
  - **Implementation consequence:** if the current APIs cannot serve this member-scoped
    episode join safely, **MC-2B must add a bounded member-owned participation-summary query**
    (`challenge_participations` for the caller joined to `challenges`, caller-scoped, no
    cross-member rows) instead of reusing `GET /api/challenges`. This is a Profile-read
    requirement, not LIFE-1 implementation.
- **Shape:** `{ activeCount, historyCount, items: compact[] }` where each item is
  `{ id, name/title, role/status }` already available from the source reads — no new fields,
  no duplicated lifecycle state. Item cap is a presentation decision (MC-2C), not Truth.
- **Empty states:** genuine-empty ("You haven't joined a Group yet" with Create/Join/Discover
  actions, per S1/S2-G vocabulary) — never a placeholder that implies data.
- **Filtering:** lifecycle filtering follows the source authorities (e.g. finalized Challenge
  history remains history; the composite-liveness rule of Disposition §10.2 is a LIFE-1
  deletion concern, not a Profile-counting invention — MC-2 reports what the governed reads
  report).
- MC-2B verifies the composition queries against the same predicates the source routes enforce
  (membership + Challenge visibility re-proved per request).

## 10. Today + V2 name-consumer migration inventory

Sources: `src/context/AuthContext.tsx` (legacy `tiizi_profile` cache + email-prefix fallback
`profileFromFirebaseUser`), `src/v2/today/*`, `src/v2/member/*`, `src/v2/auth/*`,
`src/v2/operator/*`, MC-1 record (known display-only effect), MC-1 closure carry-forward.

| # | Consumer | Current source | Disposition |
|---|---|---|---|
| 1 | **Today greeting** (`V2TodayScreen` → `greetingFor(..., profile?.displayName)`, where `profile` is the legacy cache) | Legacy `tiizi_profile.displayName`; email-prefix fallback incl. dotted-handle prettifying | **A. Migrate in MC-2.** Read `displayName` from `GET /api/me` (NULL → bare "Good morning/afternoon/evening", no prefix derivation). Keep server-clock + timezone behavior untouched. This closes the MC-1 known display-only effect. |
| 2 | MemberShell header account trigger (hard-coded `name="Member"`) | Hard-coded | **A. Migrate in MC-2** (present own display name or neutral fallback; no prefix derivation). |
| 3 | Account sheet copy ("Account settings, language, and sign-out arrive with the next slices") + missing V2 sign-out surface | Absent | **A. Migrate in MC-2** (Profile surface gains governed sign-out; sheet copy updated truthfully). |
| 4 | `V2ProfilePage` placeholder ("Your profile is just getting started") | None | **A. Migrate in MC-2** (becomes the base Profile UI per §14 MC-2C). |
| 5 | V2 sign-up name hand-off (`sessionStorage` UID-keyed) + captured-user token binding | Transient transport (non-canonical by design) | **A. Retire-by-supersession in MC-2**: keep for bootstrap (MC-1 unchanged); own-name presentation stops depending on Firebase `displayName`/cache once `GET /api/me` exists. Do not extend its lifetime. |
| 6 | Firebase `displayName` as display source (post-bootstrap reads) | Auth metadata | **A. Demote in MC-2**: remains a bootstrap fallback input only (MC-1 contract); never a presentation source after MC-2C. |
| 7 | Operator console member reads (`GET /api/operator/console/members*`) + operator shell `user?.displayName \|\| 'Fred Kenogo'` fallback | Privileged-operational reads; hard-coded preview fallback | **C. Later / unrelated.** Operator authority is separate; the hard-coded preview name is development-preview copy, not member truth. Do not touch in MC-2. (LIFE-1 consumer audit of `status = active` reads is its own prerequisite, not MC-2.) |
| 8 | Challenge-attribution surfaces (Together contributors, Race leaderboard, results, rosters "Tiizi member") | No identity (identity gap) | **B. Migrate in MC-4.** MC-2 MUST NOT feed other-member names into these surfaces. |
| 9 | Challenge Feed name-bearing items (CF-3 needs names) | Nonexistent | **B/C. MC-4 + CF-3.** Not MC-2. |
| 10 | Archived V1 screens (`SignupScreen`, V1 Home/Profile/Workout name fallbacks `personalInfo.displayName \|\| identity.displayName \|\| user.displayName`) | Firestore `users/{uid}` + Firebase | **C. Later / unrelated — frozen.** Do not alter archived V1 to solve MC-2 (MC-1 closure boundary, repeated). |
| 11 | Email-prefix fallback logic (`email.split('@')[0]`, dotted-handle prettify in `todayView.ts`) | Client derivation | **A. Remove from own-member path in MC-2** (NULL renders without a name; no derivation as canonical truth, per Disposition §4). The helper's signature may stay for unrelated preview-identity cases if MC-2C finds one, but the Today own-greeting stops calling it with derived values. |

Rule: MC-2 removes the legacy-cache dependency from **own-member** presentation where the new
governed read provides the value. Shared-context and operator paths are explicitly not MC-2.

## 11. Terms / Privacy boundary (MC-2 vs MC-3)

- **V2-boundary rule (CORR-001, P1):** the current `/terms` and `/privacy` routes resolve to
  archived V1-owned legal screens (`src/features/Legal/*`), which navigate back into `/app/*`.
  **MC-2 MUST NOT depend on archived V1 legal screens, routes, or components.** Reusing them
  would route the V2 Profile back into the frozen V1 product and violate the V2 boundary
  (MC-1 V1-freeze preserved).
- **MC-2 includes:** Profile Terms/Privacy surfaces through **V2-owned legal presentation**
  (e.g. `/v2/terms`, `/v2/privacy`) **or approved external legal-document URLs**. If
  repository-approved legal text exists and can be consumed through a neutral/shared content
  source, MC-2B/C may propose that consumption — but V2 routing and presentation stay under
  V2 ownership. No legal wording is invented; no V1 implementation is copied into V2 as
  Product Truth; legal copy/version ownership remains outside MC-2.
- **MC-3 owns:** the returning-member completion gate + consent enforcement (independent
  current-Terms + current-Privacy checks, versioned consent record with version/timestamp/
  source/actor per IDP-02/FD-MC-05/Disposition §6), onboarding selection, and all consent
  retention policy. Current acceptance state appears in Profile **only if already governed
  and available** — it is not (no consent store exists in V2), so MC-2 ships the surfaces
  with honest state ("acceptance tracking arrives with Onboarding + Consent").
- **MC-2 MUST NOT invent:** legal wording, legal version identifiers, re-acceptance policy,
  retention periods, deletion SLA, or any onboarding/completion enforcement. The legal text
  owner and version ids remain genuine MC-3 inputs (Disposition §14.1, carried).

## 12. Profile visibility matrix

Authority: IDP-01 classes; Disposition FD-MC-02/03 + §7; CIC §4.1/§4.2 via assessment;
Profile Standard §10. "Editable in MC-2" = via `PATCH /api/me` allowlist; "audit" = server-side
history required.

| Field / capability | Canonical source | Authority / owner | Self-visible? | Shared-context visible? | Globally visible? | Editable in MC-2? | Audit/history? | Work package |
|---|---|---|---|---|---|---|---|---|
| Display name | `members.display_name` (+ MC-2B history table) | Member (Participant Authority for expression; Identity Authority for state) | Yes | **No in MC-2** (MC-4 projection only) | No | **Yes** (sole PATCH field) | **Yes** (server-side, actor=member) | MC-2 |
| Email (own) | Firebase Auth: raw `user.email` / verified token claims (may be null); never `AuthContext.profile.email` (fabricated fallback); PG stores nothing | Identity/auth lifecycle | Yes (read-only, client-direct) | No | No | **No** (stays in Firebase mgmt) | No (auth-side) | MC-2 presents; MC-3+ may consume |
| Profile-image reference | None in MC-2 (slot semantics + `not_configured` projection; persistent reference added in MEDIA-2b after MEDIA-2a + MC-2 exist) | Member (own image) | Yes (own slot; initials until MEDIA-2b) | Only where MC-4 identity authorized (future) | No | **No** (no upload in MC-2) | Media lifecycle audit lives in MEDIA-2 | MC-2 slot; MEDIA-2b image |
| Own Groups summary | `GET /api/memberships/me` (governed membership) | Participation Authority (Group domain) | Yes (composed) | n/a (own view) | No | No (managed via Group journeys) | No (source-domain audit) | MC-2 composes |
| Own Challenges summary | `challenge_participations` episodes for the caller (active vs history per §9); bounded member-owned summary query if current APIs cannot serve it | Participation Authority (Challenge domain) | Yes (composed) | n/a (own view) | No | No | No | MC-2 composes |
| Terms presentation | V2-owned surface (`/v2/terms`) or approved external legal URL; never archived V1 screens | Legal text owner; Profile presents | Yes (surface) | n/a | Route-visibility as decided | No | No (MC-3 consent record later) | MC-2 surfaces; MC-3 enforcement |
| Privacy presentation | V2-owned surface (`/v2/privacy`) or approved external legal URL; never archived V1 screens | Legal text owner; Profile presents | Yes (surface) | n/a | Route-visibility as decided | No | No | MC-2 surfaces; MC-3 enforcement |
| Sign out | Firebase sign-out via V2 surface | Member session | n/a (action) | n/a | n/a | n/a (action, not field) | Session-level (existing) | MC-2 |
| Future Interests | MC-3 canonical store (stable Focus Area IDs; Disposition §5.3) | Member (private preference) | Yes (MC-3 UI) | **Never** (REC-1 relevance only, never exposed per §5.6) | No | **No** | Yes (every change audited, actor=member; MC-3) | **MC-3** |
| Future Goals | MC-3 canonical store (governed Goal IDs) | Member (private preference) | Yes (MC-3 UI) | **Never** | No | **No** | Yes (MC-3) | **MC-3** |

Interests/Goals are private preference data (Standard §5; HID-04/05 via assessment) and belong
to MC-3. No other field is added by MC-2.

## 13. Data-model assessment (existing + minimum future; no DDL in this pass)

Existing:

- `members(member_id, auth_provider, auth_subject, role, created_at, updated_at)` (001/002) +
  migration **026** (`display_name` nullable + trim/1–120 CHECK), merged as code / NOT deployed.
  Semantics per MC-1 record: insert-only first-create; existing rows read-only; no derivation.
- No profile table, no history table, no media reference, no consent table, no Interests/Goals
  store. Correct per authority.

Minimum future MC-2 data model (for MC-2B design; NOT created here):

1. **Display-name change history** (new table, e.g. `member_display_name_history`):
   `history_id (UUID PK) | member_id (FK → members, indexed) | old_display_name (nullable) |
   new_display_name | changed_by_member_id (= member_id; explicit actor column for audit clarity) |
   source (e.g. `profile_self_edit`) | created_at`. Append-only (no update/delete by application
   role); the row update + history insert run in the §5 `SELECT ... FOR UPDATE` transaction so
   concurrent edits serialize with truthful before/after values. This satisfies FD-MC-03 +
   Standard §4.9 with the smallest possible schema.
2. **Approved base-Profile fields:** none beyond `members.display_name` require storage in MC-2.
   If MC-2B finds a genuinely approved non-preference field (e.g. a region/language with a
   stated product purpose per Disposition §7), it is a bounded additive column with its own
   authority citation — NOT assumed here.
3. **Media reference boundary (CORR-001):** NO media column or FK in MC-2B. The persistent
   profile-image reference is added in MEDIA-2b, after the MEDIA-2a core media model and the
   MC-2 Profile both exist (§8).
4. **Explicitly NOT created:** Interests/Goals tables (MC-3), consent tables (MC-3), identity
   projection tables/views (MC-4), media tables (MEDIA-2a), lifecycle tables (LIFE-1), and any
   of: DOB, sex/gender, weight, height, phone, address, health status, biography, occupation,
   location, or generic social-profile columns. Each is refused without separate authority
   (IDP-01 minimal disclosure; Disposition FD-MC-02 "unless separately authorized").
5. **Migration numbering:** per Disposition §12, numbers are assigned sequentially only when
   each authorized implementation package begins. **No number is reserved or created here.**
   Migration 026 deploys under its own governed deployment step (MC-1 closure boundary);
   MC-2B's migration(s) take the next free number(s) at that time.

## 14. Implementation package design (after this readiness pass)

Proposed smallest sequence (fits Disposition §13 serial constraints MC-1 → MC-2 → {MC-3 ∥ MC-4}):

- **MC-2A — authority reconciliation / readiness (this document).** Docs only. Exit: Founder
  acceptance of this record + Master Programme 2.68 recording MC-2A.
- **MC-2B — Profile storage + API / read-self-edit.** Bounded implementation: history table
  DDL (next free migration number; NO media column/FK); `GET/PATCH /api/me` per §7
  (actor token-only, displayName-only PATCH, unknown keys → 400, §5 row-lock + no-op protocol);
  own Groups summary via `GET /api/memberships/me`; own Challenges summary via actual
  participation episodes (§9 — bounded member-owned participation-summary query if current APIs
  cannot serve it safely); API tests (authz, validation, serialized history incl. concurrent
  edits, unknown-member strictness, extra-key rejection incl. `email`, NULL handling);
  no email key, no `hasDisplayName`, no legal URLs in the domain response; no UI, no consumer
  migration, no media, no consent. Exit: technical review + Founder authorization to proceed
  (merge per normal gates; migration code-authorized, NOT deployed until the governed
  deployment step).
- **MC-2C — V2 Profile UI + own-name consumer migration.** `/v2/profile` base UI (name, own
  email read-only, initials avatar + honest media empty state, Groups/Challenges summaries from
  §9 composition, sign-out, Terms/Privacy links, honest deferred states); Today greeting +
  MemberShell header + account-sheet migration per §10 table (A-items only); legacy-cache
  demotion for own-member path; no prefix derivation anywhere in the migrated path; V1
  untouched. Exit: preview-verified UI + migration inventory signed off.
- **MC-2D — Founder preview / acceptance.** Bounded preview of MC-2B+C against acceptance
  criteria (own read/edit/history, summaries, sign-out, Terms/Privacy surfaces, no Interests/
  Goals/media/lifecycle behavior, V1 freeze, no deployment). Exit: Founder-accepted merge +
  closure record (MC-1 pattern), Master Programme update.

Kept separate (not MC-2, must not be folded in): MEDIA-2b (profile image implementation),
MC-3 (Interests/Goals + gate + consent), MC-4 (shared-context projection; consumes MC-2),
REC-1, LIFE-1/STEW-1, CF-2+, BG-1. Parallel-after-MC-2 posture per Disposition §13 stands:
after MC-2D, MC-3 ∥ MC-4 ∥ MEDIA-2b/2c/2d ∥ LIFE-1 (non-steward paths) may proceed under
their own authorizations.

## 15. Risks / open decisions (genuine only; none blocks MC-2B)

1. **MC-3 legal inputs** (owner + Terms/Privacy version ids + re-acceptance policy; Disposition
   §14.1). Needed by MC-3, not MC-2. MC-2 ships links only.
2. **Stable Focus Area IDs + vocabulary normalization** (Disposition §5.3/§5.7). Prerequisite to
   MC-3/REC-1 persistence, not to MC-2 (MC-2 persists no preferences).
3. **MEDIA-1 specifics** (upload mode, limits, variants, delivery, takedown, cost/budget owner,
   proof plan; Disposition §14.3; Media Assessment §7). Needed by MEDIA-2a/b, not MC-2 (slot only).
4. **LIFE-1 closure-transition prerequisites** (pending-application terminal transition;
   ended-not-finalized participation closure; consumer audit; Disposition §14.11). LIFE-1 scope.
5. **CF/Streak/announcement/Kudos details** (Disposition §14.4/5/9). CF scope.
6. **BG-1 technology/hosting choice** (Disposition §14.7). BG-1 scope.
7. **MC-2B design choices (not Founder decisions):** history-table column naming;
   Groups/Challenges item caps; V2-owned legal surface vs approved external URL. Each is
   resolved inside given authority during MC-2B/C design and recorded there — no governance
   loop required. Decided in CORR-001 (not open): no `hasDisplayName`; no email in
   `GET /api/me` (raw Firebase `user.email` client-direct); no rate-limit contract; row-lock
   history protocol with documented no-op; no media FK in MC-2B.
8. **Deployment sequencing:** migration 026 + MC-2B migration(s) each need their own governed
   deployment steps (none authorized here). Not a readiness blocker.
9. **Review tooling:** Codex usage quota was previously exhausted (MC-1 waiver precedent). If
   quota remains unavailable for MC-2 review gates, report it as a process fact at that time
   (per task instruction) rather than treating this readiness as blocked.

## 16. Files touched by this readiness pass (docs only)

- Created: `docs/programme/TIIZI-MC-2-PROFILE-FOUNDATION-READINESS-001.md` (this record;
  includes CORR-001 contract hardening: V2-owned legal boundary, participation-based My
  Challenges, no `hasDisplayName`, raw-Firebase email, serialized history, no rate-limit
  contract, no MC-2B media dependency, revised GET/PATCH shapes).
- Updated: `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` — version 2.67 → 2.68; records MC-2A
  readiness/awaiting-Founder-review; MC-2 implementation still NOT STARTED / NOT AUTHORIZED.
- Annotated: `docs/programme/TIIZI-MEMBER-COMPLETION-ASSESSMENT-001.md` — minimal
  numbering-supersession note pointing at Assessment §F (original content untouched).

No source, migration, config, V1, deployment, or production change.

---

**STOP: MC-2A — PROFILE FOUNDATION AUTHORITY RECONCILED / IMPLEMENTATION READINESS ASSESSED /
AWAITING FOUNDER REVIEW.**
