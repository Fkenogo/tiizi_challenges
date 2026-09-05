# Tiizi V2 Forward Technology Architecture Decision (TIIZI-V2-ARCH-001)

- **Status:** Decision input — not an implementation authorization. Does not override Stage F founder review or existing governance.
- **Date:** 2026-09-05. **Source of truth:** remote `origin/main` @ `4ae1057` (inspected directly).
- **Principle:** architecture drives infrastructure. Greenfield fit (§2) is assessed first with Firebase pretended away; migration cost (§11–12) is a separate dimension and cannot veto a materially better target.
- **Note on MTAIP-001:** the Stage F mapping draft states "retain Firebase unless demonstrated reason to change". This decision tests that policy against domain evidence rather than assuming it.

## 1. Executive decision

- **Greenfield winner: Option C** — provider-independent core backend (React frontend, application API, PostgreSQL core, neutral auth/storage abstractions).
- **Migration-aware recommendation: Option B** — Hybrid (React frontend, Firebase Auth retained, Firebase Hosting/Storage retained short-term, new provider-neutral Tiizi Application API, PostgreSQL for core domain truth, Firestore kept only transitionally).
- **Why B now, C greenfield:** Tiizi's load-bearing domain — members, groups, memberships, challenges, participation, versioned activity knowledge, immutable activity events, derived truth, finishing positions, streaks, finalization, corrections/audit, donations — needs transactions, foreign keys, joins/aggregates and append-only history. Firestore plus Security Rules plus scattered client writes does not provide them. Option C fits best unconstrained, but cutting over identity, hosting and storage at the same time as the data core adds risk with no domain payoff; those stay on Firebase behind abstractions until the PostgreSQL strangler is done. The only deliberate lock-in retained is Firebase Auth as a token issuer, isolated behind a UID→Member-ID mapping (§10).

## 2. Greenfield architecture assessment

Natural model per domain area (relational = R, document = D, event = E, realtime = RT, blob = B):

| Domain | Natural model | Reason |
|---|---|---|
| Members, profiles, groups, memberships | **R** | Many-to-many (`groupMembers`, `challengeMembers`), uniqueness (`{group, user}`), lifecycle states |
| Challenges, participation, templates | **R** | Cross-entity constraints (dates, durations, targets, units), joins to knowledge versions |
| Canonical activity knowledge + versions | **R** | Immutable versions, draft/published/retired lifecycle, no destructive delete (P1 removed it) |
| Activity events (workouts, wellness logs) | **E + R** | Append-only, keep scoring/knowledge version pins, corrections as superseding events |
| Derived truth, positions, streaks, finalization | **R (computed)** | Must be deterministic and replayable; engines are already pure functions (§3) |
| Corrections/history/audit | **R (ledger)** | In-transaction audit writes; delta recompute — unnatural in Firestore |
| Recognition, donations, pledges | **R (ledger)** | Money needs idempotency keys and atomic updates |
| Group feed, kudos, share | **R** | Aggregates over events; code today is fetch-and-aggregate — zero `onSnapshot` in feed services |
| Notifications | **R outbox + push** | No realtime subscription evidenced; polling/SSE suffices |
| Reporting/analytics/admin | **R (SQL views)** | Leaderboards, counters, admin metrics are rollups, not document fan-out |
| Images/attachments | **B** | Object storage with signed URLs |
| Offline (African-market connectivity) | **Queued mutations + cache** | SDK cache is unverified as a strategy; explicit outbox + idempotency is provider-neutral |

Nothing in this table requires a document store's semantics; nothing requires Firebase-specific realtime. **Greenfield winner: Option C.**

## 3. Current implementation architecture

Verified on `origin/main`:

- **Frontend:** React 18.3.1, React Router 6.30.1, TanStack Query 5.62, Firebase SDK 11.0.2, Vite 5.4.11, Tailwind 3.4.16, TypeScript 5.7.2. SPA on Firebase Hosting (`dist` + catch-all rewrite).
- **Data access:** ~45 client service modules; ~37 import `firebase/firestore` directly. Components are largely decoupled via hooks, but there is **no provider-neutral seam** — services speak Firestore semantics (collections, snapshots, batches).
- **Provider-neutral already:** `src/services/challengeEngine/` (collective, competitive, streak + shared types) contains **zero Firebase imports**; the engine contract states "the engine never reads Firestore directly" and callers apply results via batch. `scoringConfig` ignores client-supplied points. This is the strangler's beachhead.
- **Server side:** 8 callables (7 group-invite/join + `createChallengeWithCreatorMembership`, the latter validating then running a Firestore transaction), 2 hourly schedules (admin metrics rebuild, challenge expiry), ~10 triggers (member summaries, counters, user metrics, donation summary).
- **Rules:** 517-line `firestore.rules`, ~30 match blocks. Identity is Firebase UID as document key (`users/{uid}`, `admins/{uid}`, `groupMembers/{gid_uid}`, `challengeMembers/{cid_uid}`); role checks read `users`/`admins` docs; reads are membership-gated. Business rules are split across three authorities: client services, Rules, Functions.
- **Collections (~30):** users, groups, groupMembers, challenges, challengeMembers, workouts, wellnessLogs, catalogExercises, challengeTemplates, wellnessTemplates, wellnessActivities, groupActivityFeed (+reactions subcollection), challengeLeaderboards, challengeActivitySummaries, donationCampaigns, donationTransactions, supportDonations, supportDonationPreferences, challengeContributionPledges, groupInvites, groupJoinRequests, groupAuditLogs, admins, systemLogs, settings/platformSettings, notificationTemplates, onboardingContent, contentPages, books, supportTickets, groupReports, exerciseInterests, wellnessGoals, groupLifecycleEvents.
- **Tests:** ~56 `scripts/test*Guards.ts` structural guard scripts; no unit-test framework (P5 proposes Vitest).
- **Programme:** P0 (correctness) and P1 (positions, cause labelling, knowledge lifecycle/versioning) merged. P2 = knowledge-runtime gating (published-only catalogue, retirement-over-deletion, fitness snapshot at creation). P3 = feed/social cleanup. P4 = privacy-rules enforcement + notification migration. P5 = correction triggers + test frameworks.

```
[React 18 SPA: screens | hooks | ~45 services] --SDK reads/writes--> [Firestore: ~30 collections]
        |__callables--> [Cloud Functions: 8 call + schedules + triggers] --> same Firestore
                                     [Security Rules: 3rd authority on same data]
```

Structural problem: one domain, three authorities (client writes, Rules authz, Function transactions) with no single transactional owner per object.

## 4. Option comparison

Weights set a priori for domain importance (integrity/security/audit/domain-fit highest; migration cost lowest per §principle) — not tuned to favor an outcome. Scores 1–5, higher better.

| Criterion (weight) | A Firebase-native | B Hybrid | C Provider-independent |
|---|---|---|---|
| Product/domain fit (4) | 2 — doc model fights M2M/versioning | 4 — PG joins/versions | 5 — same, portable |
| Data integrity (5) | 2 — client batches, no FKs | 4 — API transactions | 5 — same, no lock-in |
| Portability (3) | 1 | 4 | 5 |
| Provider independence (3) | 1 | 4 | 5 |
| Security (5) | 2 — per-doc Rules + gaps (privacy stored-not-enforced) | 4 — API authz primary | 5 — API-only |
| Realtime (2) | 4 — subscriptions (unused in code) | 4 — SSE/selective Firestore | 3 — SSE/WS neutral |
| Offline (3) | 4 — SDK cache (unverified strategy) | 3 — queued API + cache | 3 — same neutral |
| Dev complexity (2) | 4 — familiar start, fan-out cost | 3 | 2 |
| Ops complexity (2) | 4 | 3 — one API + managed PG | 2 — plus identity/storage move |
| Migration cost (1) | 5 | 3 | 2 |
| Analytics/reporting (4) | 2 — scans, multi-get fan-out | 5 — SQL views | 5 |
| Correction/audit (5) | 1 — overwrites, stale derived state | 5 — append-only + recompute | 5 |
| Scalability (3) | 3 — scales, hotspot/counter risk | 4 — indexes/rollups | 4 |
| Maintainability (4) | 2 — three authorities | 4 — one authority/object | 5 — plus no lock-in |
| **Total** | **103** | **185** | **202** |

Greenfield (migration row excluded): A 98, B 182, C 200 → **C wins**. With migration cost included, C still leads but B is recommended: the extra identity/hosting/storage cutover buys nothing until the PG + API strangler is proven.

## 5. Recommended target stack

- **Frontend:** Retain React 18 + TypeScript + Vite + Router 6 + TanStack Query 5 + Tailwind. Reason: screens/hooks already serve groups/challenges/feed/leaderboards; a rewrite has no product payoff. Change: services call the Tiizi API; Firebase SDK remains only for Auth tokens and retained short-term uses.
- **Identity:** Retain Firebase Auth as token issuer. Reason: UID-keyed access and role checks already bind members; swapping providers adds risk with zero domain gain. Isolated via §10 mapping.
- **Application:** New provider-neutral API in **Node.js/TypeScript** (same language as the codebase; pure engines and Functions validation logic port with least rewrite). **REST, resource-oriented, with a small RPC escape** (`POST /actions/...`) for the multi-resource transactions already shaped as callables (challenge creation, invite/redeem/approve).
- **Core store:** Managed PostgreSQL (Cloud SQL / RDS / Supabase-class — procurement choice, not architecture). Reason: §9.
- **Realtime:** API polling/SSE by default; Firestore subscriptions only for uses named in §6. Reason: no `onSnapshot` realtime evidenced in feed services.
- **Storage:** Firebase Storage retained short-term behind API-issued access; target S3-compatible store + signed URLs. Reason: attachments are blobs, not rows.
- **Hosting:** Firebase Hosting retained short-term; any static host later. Fix missing deploy config (`.firebaserc` absent on `origin/main`) before next deploy work.
- **Observability:** Structured API logs, audit tables, materialized admin-metric views (successors to `memberCounters`/`memberUserMetrics`/`supportDonationSummary`), plus error tracking and uptime checks on API + PG.

## 6. Firebase retain/remove matrix

| Component | Class | Decision |
|---|---|---|
| Firebase Auth | GOOD STRATEGIC | Retain as issuer; §10 mapping preserves exit |
| Firestore invites/requests/audit (server-only) | ACCEPTABLE INFRASTRUCTURE | Keep until API owns them, then remove |
| Firestore as record for users/groups/challenges/members/events/templates/donations/feed | PROBLEMATIC DOMAIN COUPLING | Remove as authority via §12 strangler |
| Cloud Functions (callables, counters, summaries) | LEGACY CONVENIENCE | Port cores to API transactions/jobs, retire |
| Firebase Hosting | ACCEPTABLE INFRASTRUCTURE | Retain short-term |
| Firebase Storage | ACCEPTABLE INFRASTRUCTURE | Retain short-term; signed-URL cutover |
| Security Rules as authz authority | PROBLEMATIC DOMAIN COUPLING | Shrink to deny-by-default scaffolding; API owns authz |
| Client SDK direct writes | PROBLEMATIC DOMAIN COUPLING | Remove except retained uses; route via API |

**Firestore future role:** steady-state, **none as system of record**. Every candidate — reactions (`UNIQUE(item,member)`), aggregates (SQL), counters (views), template versions (FKs), events/ledgers (transactions) — fits PostgreSQL better, and current code is fetch/aggregate, not subscribed. Transition-only: server-only invite/join/audit collections and not-yet-strangled projections (replicas, never writers). Any future subscription need requires latency measurements first — no speculative retention.

## 7. Core data ownership decision

Post-transition, PostgreSQL owns: members (incl. profiles), groups, group/challenge memberships, challenges, challenge activity configuration, templates/catalogues/taxonomy/settings (immutable versions), activity events (append-only + supersede pointers, keeping scoring/knowledge version pins), derived truth (positions, leaderboards, summaries, metrics as computed tables/views — never client-written), finalization/corrections/audit (server-only), feed items + reactions, share copies (server-generated), donations/pledges/tickets/reports (ledgers), notification outbox, RBAC roles (successor to `admins` docs). During transition each object has exactly one writer; copies elsewhere are read replicas.

## 8. Application API decision

Yes — establish the boundary; the frontend must depend on Tiizi capabilities, not provider semantics. **REST resource-oriented** (Tiizi is resource- and lifecycle-shaped; reads for feed/leaderboards/templates stay cacheable via Query; stable contracts for admin/reporting; auditable mutations) **plus small RPC escape** for multi-resource transactions already shaped as callables. Token verification: Firebase ID token verified at the API edge, mapped to internal identity (§10); anonymous only for genuinely public reads (catalogues, taxonomy). Authorization: server-side membership/role checks over joins (owner/admin/member/content-manager), porting today's Rules + Functions checks into tested policy code; self-write allowlists and the role self-write ban preserved as API validation.

## 9. PostgreSQL decision

**Yes.** Foreign keys for memberships, events→knowledge versions, donations→campaigns; composite `UNIQUE`s replacing `{gid_uid}`/`{cid_uid}` doc-ID tricks; `CHECK`s for dates/durations/targets/points (mirroring `challengeCreationBackend` validations); money idempotency keys. **JSONB only for variant tails** (event payloads, template bodies by activity/cause/version); identity, time, and version stay in columns. GIN on hot JSONB keys; btree on `(challenge, occurred_at)`, `(user, occurred_at)`, `(group, …)`; partial indexes for active challenges; materialized views for leaderboards/summaries/counters replacing multi-`getDocs` fan-out. Corrections: append-only events + engine recompute + in-transaction audit — native in PG, unnatural in Firestore. Reporting becomes views instead of scans.

## 10. Security/authentication model

API authorization is authoritative; Rules shrink to deny-by-default. `members` table: `member_id` UUID primary key, `auth_uid` unique and not-null; **all foreign keys use `member_id`** — Firebase UID is never the business identifier. Middleware verifies the token, looks up/attaches `(member_id, roles, memberships)`; client UID-keyed reads keep working while the server translates. Exit path: re-point `auth_uid`/issuer with zero FK churn. RBAC tables succeed `admins/{uid}` docs; roles stay self-unwritable. This closes the known stored-not-enforced profile-privacy gap (P4#14) in tested code instead of Rules.

## 11. Migration implications

Moves: per-object authority (§7), validation/transaction cores (Functions → API), pure engines as-is (re-host, no rewrite), feed aggregates → SQL, counters → views/jobs. Stays: React shape (repointed to API), Auth/Hosting/blobs. Costs: dual-write window with shadow-compare, backfill with version pins, guard-script preservation, `.firebaserc` + Functions `tsc` hygiene. Non-goals: no identity/hosting swap, no realtime rebuild. Historical data preserved via version-pinned backfill; cutover is the only irreversible step per object.

## 12. Incremental transition sequence (strangler)

One authority per object; reversible (shadow → flip → Rules-deny) until cutover:

- **Phase A — API shell:** token verification + UID→member mapping + shadow `members/groups/memberships/audit` tables; `apiClient` seam in hooks behind a flag. Touches nothing live.
- **Phase B — knowledge/templates:** immutable PG versions; API serves catalogues; admin writes move.
- **Phase C — events + derived truth:** append-only events, re-hosted engines, creation/finalization transactions in API; leaderboards/counters → views/jobs; corrections = supersede + recompute.
- **Phase D — social/money/notify:** feed/reactions/share-copy, donations/pledges/tickets/reports, notification outbox + push.
- **Phase E — lockdown:** deny-by-default Rules, remove SDK writes, retire migrated Functions; optional storage/hosting cutover. No big-bang rewrite; app stays usable throughout.

## 13. Impact on remaining P3/P4/P5 work

(Items per Stage F mapping §9; P0/P1 merged and safe as-is.)

| Work | Classification | Reason |
|---|---|---|
| P2 knowledge-runtime gating (published-only catalogue, retirement-over-deletion, creation snapshot) | IMPLEMENT ONLY BEHIND PROVIDER-NEUTRAL INTERFACE | Touches objects mid-strangler (Phase B/C); ship UI now, put writes/reads behind `apiClient` seam |
| P3 #12 hide composer placeholder | SAFE TO CONTINUE NOW | UI-only |
| P3 #13 orphan comment cleanup | SAFE TO CONTINUE NOW (script) | Inert data; route any new server path via API seam |
| P4 #14 profile privacy in Rules | SHOULD WAIT — build as API authz instead | New Rules authz deepens problematic coupling; §10 supersedes it |
| P4 #15 notification subcollection migration | SHOULD WAIT (or behind seam) | Target store undecided until Phase D; migrating doc→doc now is throwaway work |
| P5 #16 correction triggers | IMPLEMENT ONLY BEHIND PROVIDER-NEUTRAL INTERFACE | Highest rewrite risk; build as API jobs callable against either store, else wait for Phase C |
| P5 #17 engine unit tests (Vitest) | SAFE TO CONTINUE NOW | Pure engines port as-is; tests survive migration |
| P5 #18 Rules tests | SHOULD WAIT | Rules shrink under target; don't invest in testing scaffolding being removed |
| P5 #19 CF collection types | SAFE TO CONTINUE NOW | Additive types only; low risk |

Rule of thumb: anything writing a mid-strangler object or extending Rules/Functions ownership goes behind the neutral seam or waits.

## 14. Risks

Dual-write divergence (mitigate: shadow + compare + flip + deny); version mis-pinning in backfill (immutable versions + recompute diff); authz regression (port Rules/Functions checks into policy tests); realtime gap (confirm SLOs first — no `onSnapshot` evidenced); scope unknowns in unmerged P2 branch (re-validate at Phase A); ops load (managed PG + replicas + jobs, no self-hosted DB); governance collision with MTAIP-001 (this decision is the demonstrated reason; needs founder acknowledgment).

## 15. Immediate next engineering task

Implement the Phase A shell: authenticated `GET /v1/memberships/me` (verify Firebase token, map UID→member ID in PostgreSQL, read-only shadow of groups/groupMembers/challenges/challengeMembers) plus an `apiClient` seam in one Query hook (e.g. `useGroups`) behind a flag; Rules untouched. This proves mapping, parity, and the repoint path before any authority moves.

## Operations (qualitative)

Pilot: +1 API service + managed PG; minimal cost delta. 10k active: indexed reads + materialized leaderboards replace per-item `getDocs` fan-out — sublinear vs document scans; outbox-batched push; linear cost. 100k+: read replicas, rollups, CDN; time-partitioned events, cold archive. African-market connectivity: queued offline mutations with idempotency keys, existing 5-minute Query cache pattern retained, compact REST payloads with server-side summaries, regional API/PG placement + CDN + pagination — no thin-link fan-out.

## Material unresolved questions

1. Managed-PG vendor/region (procurement + latency measurement, not architecture).
2. Deferred authorities ACT-03/ACT-04/MOT-01/Rewards still pending founder decision — correction/recognition flows reserve structure only.
3. Whether any future screen genuinely needs sub-second realtime (measure before retaining any Firestore subscription).
