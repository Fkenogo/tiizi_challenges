# TIIZI MC-1 — V2 Member Bootstrap: Implementation Record 001

**Status:** IMPLEMENTED CANDIDATE / TECHNICALLY VALIDATED — AWAITING TECHNICAL + FOUNDER REVIEW. Not Founder accepted. Not merged. Not deployed.
**Baseline:** Master Programme 2.60, main `250facf`. **Migration:** `026_member_canonical_display_name.sql` (code-authorised only; NOT deployed).

## Root cause
A valid Firebase user with no `members` row reaches `requireAuth` (`api/src/auth.ts`), which resolves `(firebase, uid)` via `findMemberByAuth` and throws `401 unknown_member`. No code path created the mapping for ordinary V2 users (only preview/seed scripts did).

## Contract (authoritative)
`POST /api/members/bootstrap` — `Authorization: Bearer <Firebase ID token>`.

Optional request body (the ONLY permitted non-authority input):
```json
{ "displayName": "<validated canonical first-create candidate>" }
```
Response `200`:
```json
{ "memberId": "<uuid>", "created": true | false }
```
Errors: `401 missing_token`, `401 invalid_token`, `400 invalid_display_name`, `409 member_mapping_inconsistent` (fail closed).

- Actor identity is token-only: the verified Firebase UID. The query and every body field other than `displayName` are ignored (no UID, subject, member id, role, admin/operator input).
- `displayName` is optional; absent/`null` is permitted and creates the member with `display_name = NULL`. When supplied it is trimmed, NFC-normalised (Unicode preserved) and must be 1–120 Unicode code points with no control characters, else `400 invalid_display_name`. The 120 bound is a transport/storage safety bound, **not Product Truth**.
- `displayName` is **insert-only**: written only by the first-creation insert. An existing mapping is returned untouched (`created:false`) and is never renamed, merged or backfilled, whatever name is supplied.
- Exempt from the strict auth hook by exact `POST` + path match only; it verifies the token through the same `TokenVerifier`. All other routes remain strict (`401 unknown_member`).
- Creates exactly one `members` row (`auth_provider='firebase'`, `auth_subject=<uid>`, `role='member'`, UUID from `gen_random_uuid()`, optional `display_name`). No Group membership, Challenge participation, operator grant, Firestore write, interests, goals, consent or image.
- The response never exposes the Firebase UID, subject or the stored name.

## Idempotency / concurrency
One statement: `INSERT … ON CONFLICT ON CONSTRAINT members_auth_identity_unique DO NOTHING RETURNING member_id`; if nothing returned, `SELECT` the committed row. Concurrent first requests serialise on the unique index; exactly one reports `created:true`. If a conflict occurs but no row is readable, the request fails closed (409).

## Display name (Corrections 001–004 — implemented)
Founder-authorised minimum storage: migration **026** adds nullable `members.display_name` (CHECK: trimmed, 1–120 characters). No default, no backfill, no history table, no email/UID/V1/cache derivation; MC-2 Profile is not started. Pre-existing members keep NULL and remain eligible for the later one-time completion gate.

- **First create vs existing:** the name is written by the same single insert; an existing mapping is read-only (see Contract).
- **Concurrent differing names:** the single winning insert fixes the canonical value; losing requests return the existing row and never overwrite it (tested: exactly one `created:true`, stored name equals that request's name).
- **Name-source precedence for first creation (client):** (1) the V2 sign-up hand-off for THIS uid; (2) the Firebase user's actual valid `displayName` (Google, restored sessions); (3) none. The Firebase `displayName` is a fallback, **not the sole carrier**. The email prefix and the localStorage fallback profile are never canonical sources. An unusable (invalid/over-long/control-character) value is omitted rather than sent, so it can never cause a permanent `400`.
- **V2 email sign-up carrier (V2-only):** `V2SignUpPage` calls `persistV2SignUpName` (`src/v2/auth/`) after Firebase account creation and before entering the shell. It (1) records the normalised entered name in the sign-up hand-off and (2) makes a best-effort Firebase `updateProfile`. A failed `updateProfile` does **not** lose the name: the hand-off still carries it to the first bootstrap, including across a page reload in the same browser session. The shared `AuthContext` (also used by archived Product V1 `SignupScreen`) is unchanged from `main` — **V1 is frozen**.
- **Hand-off storage (Correction 004):** `src/v2/auth/signUpNameHandoff.ts` keeps only `{ uid, name }` (normalised) in `sessionStorage` under one key (with an in-memory mirror if storage is unavailable). It is **non-canonical transient transport, not Profile truth**: tab-session lifetime, never `localStorage`, never durable. It is returned only for the matching authenticated uid (a different uid never sees it), is cleared after that uid's successful bootstrap and on V2 sign-out (gate Sign out; sign-in page switch-account), is retained after a failed bootstrap so an explicit retry reuses it, and a corrupt or unusable stored value is dropped and never sent. If both storage and Firebase `displayName` are unavailable (for example a new browser session before bootstrap), the member is created with NULL and meets the governed completion gate.
- **UID-bound gate:** outcomes are recorded as `{ uid, status }` and children render only when the outcome's uid equals the current uid (`bootstrapGateStatus`), so a direct Firebase switch A→B (no null state) or a late completion for A can never expose the shell for B. Session readiness and in-flight calls are tracked per uid.
- **Unicode:** the sign-up name field has no HTML `maxLength` (UTF-16 units); the 120 bound is enforced in code points by `normalizeV2DisplayName`, with an inline message when exceeded.

## Client
`V2Authenticated` wraps children in `V2MemberBootstrapGate`: after any Firebase session (email sign-up, sign-in, Google, restored session) it calls bootstrap once per subject, blocks the shell until success, and on failure shows a bounded recoverable state (Try again / Sign out). No automatic retries; no other call provisions. Google uses the same seam (no separate path). Shared `AuthContext` and V1 are untouched.

## Tests
`api/test/memberBootstrap.test.ts` (first/repeat/concurrent/spoof/strict-auth/no-overwrite/operator-safety/invalid-token/fail-closed, plus display-name persistence, insert-only, validation and differing-name race); `npm run test:mc1-member-bootstrap` (client session logic, UID-bound gate status, reload-safe hand-off with injectable storage, updateProfile-failure + reload, and wiring contracts). Note: API tests run on single-connection PGlite, which serialises "concurrent" requests; true multi-connection convergence rests on the PostgreSQL unique constraint plus `ON CONFLICT`, and should be confirmed against a real PostgreSQL pool in staging.

## Real-PostgreSQL concurrency verification (Correction 001)
The PGlite API tests serialise requests. Separately, against a disposable local PostgreSQL 16 (migrations incl. 026 applied, torn down afterwards; no production), 20 rounds × 16 simultaneous pooled connections calling `bootstrapMember` for the same subject with differing names each produced exactly one `members` row, exactly one `created:true`, and one shared `memberId`. This was an ad-hoc local proof, not a committed CI test.
