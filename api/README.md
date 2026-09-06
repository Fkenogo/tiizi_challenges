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
