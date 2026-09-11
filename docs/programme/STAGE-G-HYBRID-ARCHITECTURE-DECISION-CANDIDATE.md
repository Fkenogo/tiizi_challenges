# Stage G Hybrid Architecture Decision Candidate

**Status:** Founder Approved 2026-09-11 (APPROVE as written; see §7).
**Date:** 2026-09-11
**Scope:** Answers the PR #25 entry requirement (TIIZI-V2-STAGE-G-ARCH-RECON-001).
Reconciliation of approved architecture description with V2 implementation
direction. No code, schema, infrastructure, or product change.
**Authority:** PR #25 direction record; TAM (MTAIP-001); TIIZI-V2-ARCH-001
(decision input, 2026-09-05); Stage F foundation (FAD-01); code on
canonical main `7f55b68` (verified this session).

## 1. Current authoritative-state map (code truth)

| Domain | Authoritative system | Transitional copy | Authorization source | Client/API path | Near-term direction |
|---|---|---|---|---|---|
| Member identity | Firebase Auth (issuer) + PG `members` UUID link | V1 `users/{uid}` docs (dual bootstrap, legacy) | `api/src/auth.ts` → `members.ts` | API edge verifies token, maps UID→UUID | Retain; remove V1 doc bootstrap at cutover |
| Group identity/lifecycle | Firestore group docs | PG shadow (read-model only) | Firestore reads | API via read-only adapter; UI direct (V1) | Retain Firestore authority; no migration authorized yet |
| Membership eligibility | Firestore (live) | PG shadow never consulted (`groupMembershipAuthority.ts`) | Live authority, fail-closed (503 on outage) | API entitlement gates; rules-scoped reads | Retain; PG cutover is later migration |
| Canonical Knowledge | PostgreSQL (`knowledge_items`, versions) | Firestore catalogues (legacy source; writes blocked) | Knowledge Authority / delegated admin | API `registerKnowledgeRoutes`; V2 UI via API | Extend PG authority (PKG-2A) |
| Knowledge lifecycle | PG forward-only draft→published→retired | Legacy records default published | `api/src/knowledge.ts` | Admin publish/retire routes | Add KCS content gate + locale model (PKG-2A) |
| Challenge identity/config | PostgreSQL (append-only versions; C3A unit homogeneity) | V1 Firestore challenges (live V1 path) | Establishment seam (`challengeEstablishment.ts`, CLI-only) | No HTTP create yet (PKG-1) | Expose seam via API; no V1 dual-write |
| Participation | PostgreSQL (episodes, one-active guard) | V1 `challengeMembers` | Live membership authority | API join/withdraw routes | Unchanged |
| Member Activity Evidence | PG C1 ledger (Evidence/association split, RESTRICT FKs) | V1 `workouts` (broad-read rules; legacy) | API validation | Evidence-only activity route + `client_key` idempotency | Unchanged; V1 store untouched |
| Challenge Application | PG C2B (UNIQUE event, pins, Evidence-only) | — | Knowledge pins, fail-closed | API | Unchanged |
| Derived Truth | PG computed (engines + fold; standard competition ranking at read time) | V1 summaries/snapshots | Server-owned, recomputable | API reads; V2 UI via API/hooks | Fix UI snapshot remnants in PKG-1 scope |
| Social/feed | V1 Firestore (`groupActivityFeed`, auto-write) | — | Legacy triggers | V1 UI only | Consent-gated V2 feed is later package; never port auto-write |
| Notifications | V1 Firestore user subcollections | — | Legacy service | V1 UI only | Later package |
| Storage/media | Firebase Storage (client image upload) | — | Existing service | Direct SDK | Retained short-term; no change |

## 2. Position confirmation (9 points)

1. **Confirmed:** PostgreSQL is authoritative for V2 Knowledge, configs,
   participation, evidence, applications, derived truth (migrations
   001–006; seams cited above).
2. **Confirmed:** Firebase Auth remains token issuer (sole `firebase-admin`
   seam; no second issuer).
3. **Confirmed:** UID→UUID mapping through provider-neutral boundary
   (`members.member_id` UUID PK; `auth_uid` unique, never a business FK).
4. **Confirmed:** Firestore remains authority for Group existence/lifecycle
   and live membership eligibility (read-only adapter, fail-closed).
5. **Confirmed:** PG shadow MUST NOT and does not authorize (contract +
   helper enforce non-consultation by design).
6. **Confirmed:** Functions remain bounded transitional bridges (V1 create
   callable still live path; no new V2 truth being built in Functions).
7. **Confirmed with direction:** V2 behavior moves behind the API
   (`v2ChallengeApi` forbids raw fetch); V1 direct access untouched until
   cutover. Progressive reduction, not a flag-day.
8. **Confirmed:** hybrid strangler (ARCH-001 Option B as built: Phases A–C
   substantially present), not big-bang migration.
9. **Confirmed:** provider-neutral seams intentional and retained
   (membership authority interface; API transport seam; engine purity).

No point is contradicted by code evidence.

## 3. MTAIP / Stage F fit: amendment required (bounded)

TAM records MTAIP-001 as "retain Firebase unless demonstrated reason to
change" with "infrastructure migration not authorized" and "no
contradiction". Implementation has since established PostgreSQL as the V2
domain authority — exactly the direction ARCH-001 recommended (Option B)
and flagged as needing founder acknowledgment (§14: governance collision
with MTAIP-001). The domain evidence in ARCH-001 §9 (transactions, FKs,
joins, append-only history) is the demonstrated reason. **Do not roll back:**
PR #25 requires describing the architecture actually intended to continue.
What is required is a bounded Founder acknowledgment, not a redesign.

## 4. Proposed decision (candidate text)

> Tiizi V2 adopts a hybrid provider-neutral architecture in which
> PostgreSQL is the authoritative system of record for V2 domain truth
> (Knowledge, Challenge/config versions, participation, Member Activity
> Evidence, Challenge Application, Derived Truth), Firebase Auth remains
> the current identity token issuer behind a UID→Member-UUID boundary, and
> Firestore remains the current trusted authority for Group
> existence/lifecycle and live Group Membership eligibility. Firebase
> infrastructure is retained where it fits and narrowed only through staged
> migration. Provider-neutral seams remain mandatory around identity,
> domain access, and infrastructure integrations.

Explicitly **not** authorized: broad Firebase migration; auth-provider
change; Group-authority migration; infrastructure rewrite.
Existing V2 PostgreSQL/domain work is validated as **intentional
implementation of the decided direction**, not accidental divergence.

## 5. Effect on packages

- **PKG-2A may proceed** on confirmation: extends the existing PG
  Knowledge authority (lifecycle default, KCS minimum validation,
  locale-keyed model). No new store, no migration.
- **PKG-1 may proceed** on confirmation: exposes the existing PG
  establishment seam through the API with live Firestore membership
  authority. No V1 dual-write, no new authority.
- Both retain live Firestore Group Membership authority until separately
  changed. Neither creates new V1 dual-write authority.

## 6. Unresolved Founder decisions

One, and only one: **approve or amend §4** (acknowledge the hybrid as the
intended architecture within the MTAIP-001 interpretation). No product,
schema, provider, or migration decision is requested. ACT-03/ACT-04/MOT-01/
Rewards remain deferred and untouched.

## 7. Founder Approval (2026-09-11)

**Disposition: APPROVE as written.** The §4 position is adopted as the
Stage G architecture position with immediate effect on merge to canonical
main.

- **MTAIP / Stage F relationship:** this is a bounded architecture
  amendment/clarification to the older Stage F infrastructure description
  (TAM "retain Firebase / no contradiction" wording). Stage F product
  decisions remain closed. No rollback of existing V2 PostgreSQL/domain
  implementation is required or authorized. The existing PostgreSQL-backed
  V2 work is affirmed as intentional implementation of the decided
  direction. Architecture remains governed by the principle that
  architecture drives infrastructure. MTAIP-001 itself is not rewritten.
- **Effect on Stage G:** the PR #25 architecture-reconciliation entry
  requirement is satisfied.
- **Effect on packages:** PKG-2A (Knowledge Publication Readiness) is
  authorized next; PKG-1 (V2 Challenge Establishment Integration) is
  authorized after PKG-2A per current execution order. Both proceed under
  the §4 position and its explicit non-authorizations.
- **Explicit non-authorizations preserved:** no broad Firebase migration;
  no auth-provider change; no Group-authority migration; no infrastructure
  rewrite; no hosting/provider change; no new deployment work; no
  database-provider change. Each requires separate future authority.
