# Tiizi Application API (Phase A)

Provider-neutral Node.js + TypeScript service. One service, no microservices.
Runs as a normal Node process (`npm run dev` / `npm run start`) behind
`DATABASE_URL`; later container deployment just wraps the same process.

## Library choices

- **HTTP: Fastify 5.** Lightweight, actively maintained, first-class
  TypeScript, built-in JSON-schema validation, and `app.inject()` makes
  route tests run without opening a port. No enterprise ceremony; the
  domain code in `members.ts` / `memberships.ts` does not import Fastify
  and could move frameworks if ever justified.
- **Postgres: `pg` (node-postgres) + hand-rolled SQL migrations.**
  Deliberately no ORM: DDL lives in `migrations/*.sql` as reviewable SQL,
  queries are explicit typed functions, transactions are explicit.
  `src/db.ts` exposes a minimal `Db` interface (`query`, `transaction`)
  so tests can substitute fakes and the driver never leaks into domain code.
- **Auth: `firebase-admin` isolated in `src/auth.ts`.** Only the
  `TokenVerifier` adapter imports it. Domain/service code receives an
  internal `member_id` and never sees a Firebase UID.

## Local development

```sh
docker compose up -d postgres   # repo root; local dev only
cd api
cp .env.example .env            # fill DATABASE_URL
npm install
npm run migrate
npm run dev                     # http://localhost:4000
```

Shadow import from Firestore (read-only on the Firestore side, dry-run first):

```sh
npm run shadow:import -- --dry-run
npm run shadow:import -- --apply
```

Membership parity check (Firestore vs PostgreSQL, per user, read-only):

```sh
npm run parity:memberships
```

## Tests

```sh
npm test                        # vitest against in-process PGlite (real Postgres semantics)
```

## Phase A scope guardrails

- PostgreSQL is a **shadow/read model** for group memberships only.
- Firestore remains the operational authority. No dual writes.
- No Challenges, no Activity Events, no engine changes.

## Phase B knowledge authority (canonical Knowledge migration)

PostgreSQL/API is authoritative for canonical Knowledge (fitness
`catalogExercises` + wellness `wellnessActivities`). Firestore Knowledge data
is retained read-only; `firestore.rules` blocks ordinary client Knowledge
writes (deployed after the flag cutover).

- Migration `002_phase_b_knowledge.sql`: `knowledge_items` (Tiizi UUID
  identity, kind, lifecycle, current version, stable runtime columns,
  `details` JSONB for kind-specific content) + append-only
  `knowledge_item_versions` (UPDATE/DELETE rejected by trigger) + `members.role`
  (existing Tiizi role vocabulary, no new roles).
- Routes: `GET /v1/knowledge` (published only), `GET /v1/knowledge/:id`
  (any lifecycle — history stays resolvable), `GET
  /v1/knowledge/:id/versions/:version`, `GET /v1/compat/knowledge-ids`
  (transitional legacy lookup, read-only, capped), `GET /v1/admin/knowledge`,
  `POST /v1/admin/knowledge` (starts at version 1), `PATCH
  /v1/admin/knowledge/:id` (atomic +1 + immutable history row), `POST
  /v1/admin/knowledge/:id/publish|retire` (forward-only, no version bump).
  No destructive delete. Admin = super_admin/admin/moderator/content_manager
  (mirrors canModerateChallenges ∪ canManageExercises).
- Importer (read-only Firestore source, dry-run/apply, idempotent,
  deterministic UUIDv5 legacy mapping, missing lifecycle → published,
  missing version → 1, malformed records reported never fabricated,
  PostgreSQL wins version ties):

```sh
npm run knowledge:import -- --dry-run
npm run knowledge:import -- --apply
```

- Knowledge parity check (identity/lifecycle/version/name, read-only):

```sh
npm run parity:knowledge
```

- Challenge creation (`functions/src/knowledgeAuthority.ts`): PostgreSQL
  consulted first per canonical ID; PG hit decides authoritatively, PG miss
  or outage uses the transitional Firestore read-through, unset
  `DATABASE_URL` keeps legacy Firestore behavior (rollback).
- Frontend authority mode (`VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE`, else the
  legacy `VITE_TIIZI_KNOWLEDGE_API_ENABLED` flag): `firestore` = legacy
  paths; `transition` = API primary with controlled by-ID Firestore
  fallback; `postgres` = API/PG only, API errors surface, no fallback.

Out of scope (later domains): Groups, Challenges, Activity Events, Social,
Donations, Firebase Auth removal, challenge/workout templates
(`challengeTemplates`/`wellnessTemplates` stay in Firestore), verification/
correction/recognition/rewards authorities, and the seven accepted Phase A2
orphan groupMembership rows.

## Phase B cutover + rollback contract

Authority mode contract (`TIIZI_KNOWLEDGE_AUTHORITY_MODE` for functions,
`VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE` for the frontend):

- `firestore`: legacy pre-cutover behavior (Firestore canonical resolution
  and legacy frontend paths; PostgreSQL never consulted).
- `transition` (default when unset): temporary migration mode — PostgreSQL
  first, controlled Firestore fallback allowed for not-yet-imported records
  and migration compatibility.
- `postgres`: final Phase B authority mode. Canonical Knowledge authority =
  PostgreSQL/API only. Challenge creation: PG published hit → accept; PG
  draft/retired → reject; PG missing → reject the canonical ID; PG
  unavailable → fail closed (`unavailable`); Firestore NEVER consulted.
  Frontend: runtime lists and canonical by-ID reads use API/PG authority
  only — no silent Firestore fallback on API 404, 5xx, network failure, or
  retired/missing records. Legacy Firestore IDs remain resolvable through
  the API compatibility mapping (`GET /v1/compat/knowledge-ids`, backed by
  the PG `legacy_firestore_id` mapping) — never by treating Firestore as
  authority. Firestore document IDs are never canonical domain IDs.

Exact cutover sequence:

1. run `knowledge:import --dry-run`;
2. run `knowledge:import --apply`;
3. run `parity:knowledge`;
4. resolve material parity defects (malformed Firestore records surface as
   `missing_in_api` by design and stay out of PostgreSQL);
5. set Knowledge authority mode = `postgres` (functions env +
   frontend env);
6. enable frontend Knowledge API (covered by mode `postgres`; the legacy
   boolean flag is only a pre-cutover fallback);
7. deploy Firestore Knowledge write-deny rules
   (`firebase deploy --only firestore:rules`).

After step 5, Firestore canonical Knowledge is historical/read-only
migration data only. It must not participate in new challenge validation or
ordinary Knowledge runtime authority.

Rollback before step 5 may use `transition`/`firestore` mode (and unsetting
the frontend flag). Rollback after PostgreSQL has accepted authoritative API
writes must NOT simply switch back to stale Firestore without an explicit
data reconciliation step (re-import, parity, and review of diverged
lifecycle/version/content), because Firestore no longer receives writes and
has diverged from the authority.

## Phase B status (merged 2026-09-07)

- Merged to main: `95f9dcc` (PR #14, head `acb08e9`); CI green.
- Implementation complete; Founder real-data verification passed against
  local PostgreSQL 17: 154 fitness + 67 wellness imported, 51 roles synced,
  221/221 parity match, idempotent re-apply/re-parity.
- Production authority cutover NOT performed and NOT live: no shared
  production PostgreSQL/API runtime exists yet. `postgres` authority mode
  and the Firestore Knowledge write-deny rules deploy only after that
  runtime is established, per the cutover contract above.

## Transitional identity bridge (Phase A2)

During the strangler migration the frontend still holds Firestore group
document ids (route params, cached queries) while the API owns Tiizi UUID
identity. Provider ids must not leak into the domain model, so translation
lives in one explicit seam:

- Domain objects keep the Tiizi UUID as `id` (`/v1/memberships/me` carries
  no Firestore ids at all).
- `GET /v1/compat/group-ids?legacyId=…&id=…` resolves UUID ↔ legacy
  Firestore id in both directions. Authenticated, read-only (resolving never
  mints UUIDs), capped at 200 ids per request.
- The frontend adapter is `src/api/groupIdentityBridge.ts` (cached,
  batching); the only proof consumer is the read-only shadow-parity strip on
  the Groups "My Groups" tab (`ApiShadowParityStrip`, flag-gated).
- `groups.legacy_firestore_id` is transitional metadata. The `/v1/compat/`
  namespace is deprecated from birth: remove it once no caller holds
  Firestore group ids (target: Phase B+).

UUID stability is enforced by test (`shadowImport.test.ts` — repeated imports
return identical member and group UUIDs) and must hold before any cutover.

## Auth identity model and signup boundary

- `members.member_id` is the internal Tiizi UUID. Firebase is an external
  identity mapping: `(auth_provider, auth_subject)`, unique, never a domain
  key. Request code receives `member_id` only (see `src/auth.ts`).
- No auto-provisioning: an authenticated Firebase UID with no linked member
  gets `401 unknown_member`. Signup migration is intentionally out of scope.
- Intended future boundary (not yet implemented): authentication succeeds →
  the Tiizi API creates/links the Member row transactionally
  (`findMemberByAuth` then `createMember` inside one transaction at the auth
  hook), so the first authenticated request establishes identity exactly
  once. Documented here so Phase B can implement it without redesign.

## PostgreSQL portability (pgcrypto assessment)

`001_phase_a_foundation.sql` uses `CREATE EXTENSION IF NOT EXISTS "pgcrypto"`
for `gen_random_uuid()` defaults. Assessment: `pgcrypto` is a contrib
extension shipped with PostgreSQL itself and enabled on all mainstream managed
offerings (RDS, Cloud SQL, Azure Database for PostgreSQL, Neon, Supabase,
AlloyDB, Crunchy Bridge) — it does not constrain provider choice. UUID
defaults stay in the database (not application-generated) so every writer,
including SQL CLIs and future services, gets a valid primary key without
coordinating on a generation library. No change made; re-evaluate only if a
chosen vendor actually lacks the extension.
