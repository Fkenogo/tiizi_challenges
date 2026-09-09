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

## Production runtime (Cloud Run + Cloud SQL)

Provider-neutral Fastify service packaged as a standard container. The image
carries no GCP-specific domain code: Cloud Run supplies `$PORT`, Cloud SQL is
reached over a standard `DATABASE_URL`, and auth uses Application Default
Credentials. See `DEPLOY.md` for the full provisioning runbook (not executed).

```sh
docker build -f api/Dockerfile -t tiizi-api ./api   # from the repository root
docker run -p 8080:8080 \
  -e PORT=8080 \
  -e DATABASE_URL='postgresql://user:pass@host:5432/tiizi?uselibpqcompat=true&sslmode=verify-ca&sslrootcert=/secrets/server-ca.pem' \
  -e FIREBASE_PROJECT_ID=your-project-id \
  -e TIIZI_ALLOWED_ORIGINS=https://tiizi.example \
  tiizi-api
```

- Liveness `GET /health`: process alive only, no database, no auth.
- Readiness `GET /ready`: `SELECT 1` against
  PostgreSQL; 200 when reachable, 503 `not_ready` without leaking connection
  details when not. No auth required. Never overloads `/health`.
- CORS is environment-controlled (`TIIZI_ALLOWED_ORIGINS`, comma-separated
  exact origins). Empty means same-origin only — never a wildcard. Invalid
  entries fail startup fast.
- Migrations run from the same image, never automatically on API startup:
  `node dist/src/migrateCli.js` (local: `npm run migrate`; compiled:
  `npm run migrate:prod`). Order: migration job → verify success →
  deploy/revise API. Idempotent; non-zero exit on failure; no down migrations.
- Auth adapter unchanged: `FIREBASE_PROJECT_ID` + ADC/workload identity, no
  service-account JSON in Cloud Run (`GOOGLE_APPLICATION_CREDENTIALS` stays
  valid for local/admin tooling only). Tiizi identity remains the internal
  Member UUID; Firebase is a replaceable issuer mapping.
- Pool: `TIIZI_DB_POOL_MAX` per instance (default 5, max 50). Total
  connections ≈ (Cloud Run max instances) × pool max — bound both against the
  Cloud SQL tier limit. No PgBouncer.

### Environment / secret contract

| Class | Variables |
|---|---|
| NON-SECRET | `PORT`, `FIREBASE_PROJECT_ID`, `TIIZI_ALLOWED_ORIGINS`, `TIIZI_DB_POOL_MAX` |
| SECRET (Secret Manager at runtime) | `DATABASE_URL` (verified TLS: `sslmode=verify-ca` + server CA; unless a secure connector removes embedded passwords), `TIIZI_DB_SERVER_CA_PEM` (server CA PEM) |
| FUTURE CUTOVER / NOT YET ENABLED | `TIIZI_KNOWLEDGE_AUTHORITY_MODE`, frontend `VITE_TIIZI_API_BASE_URL`, frontend `VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE` |

Service-account JSON is not a production deployment mechanism. Never commit
`.env` files. Deployment characteristics: region `africa-south1`, HTTPS
terminated by Cloud Run, container listens on `0.0.0.0:$PORT`, API identity
uses ADC/workload identity, PostgreSQL target is Cloud SQL PostgreSQL 17
(private connectivity preferred, no public exposure), min instances may start
at 0, max instances intentionally bounded by the pool math above.

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

- Phase C1 Member Activity Event ledger (clean V2 state — no V1
  `workouts`/`wellnessLogs` migration; Firestore remains the temporary V1
  writer while C1/C2 complete, and the V2 cutover starts from a clean event
  state). Append-only `member_activity_events` holds reported Evidence only:
  member UUID identity via `members`, canonical Knowledge id/version pins
  (server-resolved, never client-authored), variants, measurement
  (value/unit), authoritative local-day semantics, client idempotency keys,
  and correction-chain semantics. No `challenge_id`, no points/scoring on
  the event — Challenge association and scoring are C2 application
  (`challenge_activity_records` will reference the stable `event_id` PK with
  no schema change here). C1 has NO production path from raw Evidence to a
  Challenge: the vendored engines (`api/src/engine/`, logic-identical to
  `src/services/challengeEngine/`) are retained drift-guarded as the C2
  foundation, and replay/calculation arrives with the C2 application
  records. Historical migration parity is intentionally not a correctness
  gate. No member activity-history route: Tiizi is not a personal activity
  logger, and no such product surface is approved.

- Phase C2A Challenge + Participation foundation (migration 004): `challenges`
  (one Group for life, creator attribution, establishment/active/ended with
  terminal end), immutable `challenge_config_versions` + normalized
  `challenge_activity_configs` (exact config reproducibility for future
  application records; Knowledge pins server-resolved), and explicit
  `challenge_participations` (affirmative join with group-membership check,
  distinguishable withdrawal/removal, history preserved). No application
  records, scoring execution, Derived Truth, leaderboards, or V1 migration.
  No public routes: domain seams only (`challenges.ts`,
  `challengeConfigs.ts`, `challengeParticipations.ts`).

- Challenge creation (`functions/src/knowledgeAuthority.ts`): PostgreSQL
  consulted first per canonical ID; PG hit decides authoritatively, PG miss
  or outage uses the transitional Firestore read-through, unset
  `DATABASE_URL` keeps legacy Firestore behavior (rollback).
- Frontend authority mode (`VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE`, else the
  legacy `VITE_TIIZI_KNOWLEDGE_API_ENABLED` flag): `firestore` = legacy
  paths; `transition` = API primary with controlled by-ID Firestore
  fallback; `postgres` = API/PG only, API errors surface, no fallback.

Out of scope (later domains): Groups, Challenges, Activity Event live
cutover (C1 ledger is shadow/replay-validation only; Firestore remains live
authority for new workouts/wellnessLogs), Social,
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
