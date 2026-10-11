# TIIZI MC-1 — V2 Member Bootstrap: Implementation Record 001

**Status:** IMPLEMENTED CANDIDATE / TECHNICALLY VALIDATED — AWAITING TECHNICAL + FOUNDER REVIEW. Not Founder accepted. Not merged. Not deployed.
**Baseline:** Master Programme 2.60, main `250facf`. **Migration:** `026_member_canonical_display_name.sql` (code-authorised only; NOT deployed).

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

## Display name (Correction 001 — implemented)
Founder-authorised minimum storage: migration **026** adds nullable `members.display_name` (CHECK: trimmed, 1–120 chars). No default, no backfill, no history table, no email/UID/V1/cache derivation; MC-2 Profile is not started.

- **Request:** `POST /api/members/bootstrap` accepts an OPTIONAL body `{ "displayName": "…" }`. All other body fields and the query are ignored; actor is token-only. Supplied names are trimmed, NFC-normalised, Unicode preserved; empty/whitespace-only, non-string, >120 characters or control-character values are rejected with `400 invalid_display_name`. The 120 bound is a transport/storage safety bound, **not Product Truth** (no governed length rule exists yet).
- **First create:** the name is written by the same single insert. **Existing mapping:** read-only; `display_name` is never updated, merged or backfilled (a pre-existing member with NULL stays NULL for the later one-time completion gate).
- **Concurrent differing names:** the single winning insert fixes the canonical value; losing requests return the existing row and never overwrite it (tested: exactly one `created:true`, stored name equals that request's name).
- **Email sign-up source (V2-only, Correction 002):** `V2SignUpPage` calls `persistV2SignUpName` (`src/v2/auth/`) after Firebase account creation and before entering the shell; it writes the entered, trimmed name to the Firebase user via `updateProfile`. The shared `AuthContext` (also used by archived Product V1 `SignupScreen`) is restored to its pre-MC-1 state — **V1 is frozen and unchanged**. **Google/restored sessions:** the gate sends the Firebase user's actual `displayName` when usable, else nothing (NULL). The localStorage fallback profile and email prefix are never used.
- **Unusable Firebase names (Codex P1, Correction 002):** the gate and sign-up form apply the same bound as the API (`normalizeV2DisplayName`): an invalid/over-long/control-character name is omitted rather than sent, so it can never produce a permanent `400` that blocks entry; the sign-up name field is also limited to 120 characters.
- **Response:** unchanged `{ memberId, created }`.
- `updateProfile` failure after account creation is non-fatal: the name stays absent (NULL) and falls to the governed completion gate; it is never email-derived.

## Client
`V2Authenticated` wraps children in `V2MemberBootstrapGate`: after any Firebase session (email sign-up, sign-in, Google, restored session) it calls bootstrap once per subject, blocks the shell until success, and on failure shows a bounded recoverable state (Try again / Sign out). No automatic retries; no other call provisions. Google uses the same seam (no separate path). Shared `AuthContext` and V1 are untouched.

## Tests
`api/test/memberBootstrap.test.ts` (first/repeat/concurrent/spoof/strict-auth/no-overwrite/operator-safety/invalid-token/fail-closed, plus display-name persistence, insert-only, validation and differing-name race); `npm run test:mc1-member-bootstrap` (client session logic and wiring contracts). Note: API tests run on single-connection PGlite, which serialises "concurrent" requests; true multi-connection convergence rests on the PostgreSQL unique constraint plus `ON CONFLICT`, and should be confirmed against a real PostgreSQL pool in staging.

## Real-PostgreSQL concurrency verification (Correction 001)
The PGlite API tests serialise requests. Separately, against a disposable local PostgreSQL 16 (migrations incl. 026 applied, torn down afterwards; no production), 20 rounds × 16 simultaneous pooled connections calling `bootstrapMember` for the same subject with differing names each produced exactly one `members` row, exactly one `created:true`, and one shared `memberId`. This was an ad-hoc local proof, not a committed CI test.
