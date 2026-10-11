# TIIZI MC-1 — V2 Member Bootstrap: Implementation Record 001

**Status:** IMPLEMENTED CANDIDATE / TECHNICALLY VALIDATED — AWAITING TECHNICAL + FOUNDER REVIEW. Not Founder accepted. Not merged. Not deployed.
**Baseline:** Master Programme 2.60, main `250facf`. **Migration:** none required.

## Root cause
A valid Firebase user with no `members` row reaches `requireAuth` (`api/src/auth.ts`), which resolves `(firebase, uid)` via `findMemberByAuth` and throws `401 unknown_member`. No code path created the mapping for ordinary V2 users (only preview/seed scripts did).

## Contract
`POST /api/members/bootstrap` — `Authorization: Bearer <Firebase ID token>`; no body.
Response `200 { "memberId": "<uuid>", "created": true | false }`.
Errors: `401 missing_token | invalid_token`; `409 member_mapping_inconsistent` (fail closed).

- Exempt from the strict auth hook by exact `POST` + path match only; it verifies the token through the same `TokenVerifier`. All other routes remain strict (`unknown_member`).
- Actor = verified token UID only. Body/query are ignored (no UID, member id, role, admin/operator input).
- Creates exactly one `members` row (`auth_provider='firebase'`, `auth_subject=<uid>`, `role='member'`, UUID from the existing `gen_random_uuid()` default). No Group membership, Challenge participation, operator grant, Firestore write, interests, goals, consent or image.
- Existing mapping: returned untouched (`created:false`); nothing is updated.

## Idempotency / concurrency
One statement: `INSERT … ON CONFLICT ON CONSTRAINT members_auth_identity_unique DO NOTHING RETURNING member_id`; if nothing returned, `SELECT` the committed row. Concurrent first requests serialise on the unique index; exactly one reports `created:true`. If a conflict occurs but no row is readable, the request fails closed (409).

## Display name — SCHEMA GAP (not implemented)
`members` has no display-name (or any profile) column; none is authorised yet (Assessment 001: display name is "authorised, not persisted"; Profile schema belongs to MC-2). Per the MC-1 authorisation, no profile schema was invented. Consequences:
- The sign-up name is **not persisted** by MC-1 (the pre-existing loss of the sign-up name is unchanged).
- Email-prefix derivation is never used as canonical name; Google display name is not stored either.
- All members, new and returning, are covered by the governed returning-member display-name capture gate (MC-3).
- Minimum compatible next boundary: MC-2 defines the display-name column/table; bootstrap can then accept an optional validated first-create name (insert-only, never on the conflict path). Founder to confirm that sequencing, or authorise a minimal `display_name` migration (next number 026) inside MC-1.

## Client
`V2Authenticated` wraps children in `V2MemberBootstrapGate`: after any Firebase session (email sign-up, sign-in, Google, restored session) it calls bootstrap once per subject, blocks the shell until success, and on failure shows a bounded recoverable state (Try again / Sign out). No automatic retries; no other call provisions. Google uses the same seam (no separate path). Shared `AuthContext` and V1 are untouched.

## Tests
`api/test/memberBootstrap.test.ts` (first/repeat/concurrent/spoof/strict-auth/no-overwrite/operator-safety/invalid-token/fail-closed); `npm run test:mc1-member-bootstrap` (client session logic and wiring contracts). Note: API tests run on single-connection PGlite, which serialises "concurrent" requests; true multi-connection convergence rests on the PostgreSQL unique constraint plus `ON CONFLICT`, and should be confirmed against a real PostgreSQL pool in staging.
