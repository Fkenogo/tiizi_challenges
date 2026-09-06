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
