# TIIZI-S4C-DISCOVERY-JOIN-INVITATIONS-001

**Status:** IMPLEMENTED CANDIDATE / AWAITING TECHNICAL REVIEW  
**Entry baseline:** `origin/main` @ `cabacd9f2b91406f4f23afaae6406b9b104750f9`  
**Authority:** PostgreSQL through the Tiizi API; Firebase Auth supplies authentication and identity mapping only.

## Scope delivered

- Authenticated discovery reads active, non-private Groups from PostgreSQL. The response is a bounded presentation projection and does not establish membership or expose a roster, steward identity, rules, invite code, Firebase UID, or legacy identifier.
- Search narrows only over name, description, tagline, and focus tags. Results use descending `(created_at, group_id)` ordering and an opaque keyset cursor; the default page is 12 and the maximum is 30.
- Stored invite codes resolve Group identity only. Resolution is a separate authenticated POST and has no membership side effect. Joining continues through the existing governed join operation.
- A valid member-facing code uses `TIZI-XXXX-XXXX-XXXX`: 12 uniformly selected Crockford Base32 symbols (60 bits from the cryptographic random source). Input is case-insensitive and ignores spaces/hyphens before canonical validation; lookup is normalized in PostgreSQL. Codes are shown only in an active member's Group detail projection.
- Existing join semantics are retained: open public Groups join directly; approval-required or private Groups create a pending membership. Pending applications are excluded from active memberships, roster, authorization, and active member count.
- The caller's existing `GET /v1/memberships/me` response retains its active `memberships` field and adds `pendingMemberships` only when nonempty.
- Pending applications are a minimal member UUID reference and request timestamp. Only the Group's singular Accountable Steward can read the queue or approve/reject. Approval records `approved_at` and `approved_by_member_id`; rejection records `rejected_at` and `rejected_by_member_id`. Both transitions are transactional and repeated same-outcome decisions by the deciding Steward are idempotent.
- Group Home shows the queue only to the Accountable Steward; pending applicants see an honest pending state. Ordinary members and legacy admin-role memberships do not receive review controls or authority.
- Groups landing is assembled as My Groups, Discover, and Join with code. Discovery is one card per row below 1024px; invite preview requires an explicit subsequent Join/Request action. Member count is derived from eligible PostgreSQL membership rows.

## Persistence and security

No schema change was required: migrations 019/020 already provide the governed fields, normalized unique invite-code index, pending/rejection lifecycle columns, and membership uniqueness needed here. New V2 writes do not dual-write to Firestore and no Firestore fallback was added. API database errors fail closed. Actor identity is resolved from the authenticated token to the Tiizi member UUID; decision request bodies are empty and reject identity fields.

Private Groups are excluded from discovery. A valid code may resolve a private Group to the authenticated caller; invalid codes return the same generic not-found response and disclose no Group detail. Location is display-only. No existing API rate-limit primitive was found, so invite resolution has no new endpoint-specific rate limiter; this is a residual abuse risk for later operational hardening, not a reason to create a platform-wide subsystem in S4c.

## Out of scope

No discovery ranking/recommendation, notification, invitation inbox/history/expiry/revocation/rotation, taxonomy, S4d settings editing, stewardship transfer, member moderation, Council, Feed, Charter lifecycle, S6 Activity Library, V1 migration, Firebase data reconciliation, merge, or deployment is included. S4c is not complete or Founder accepted.

## Validation record

Focused PostgreSQL/PGlite production-seam tests cover public/private/inactive discovery, search and pagination, projection privacy, invalid cursor/bounds, database outages, private invite resolution with no implicit join, normal pending join, code visibility, invalid-code generic response, identity-smuggling rejection, Steward-only pending review, legacy-admin denial, approval/rejection attribution, idempotence, rejoin behavior, pending ineligibility, and active roster/count effects.

A partial local browser preview used two synthetic Auth-emulator identities and a clean disposable PostgreSQL 17.11 database. The Steward signed in, created “S4c Preview Walkers” with approval required, then saw the persisted Group Home, single Accountable Steward relationship, empty pending queue, and member-only invite code. The browser automation stalled while switching to the second isolated session. Applicant join, approval/rejection in the browser, applicant refresh states, responsive widths, browser console, and request/network capture therefore remain unverified in this preview; the lifecycle behavior is covered by API tests. The temporary database, Auth emulator, and fixtures were stopped or removed afterward. No remote Firebase project was queried.
