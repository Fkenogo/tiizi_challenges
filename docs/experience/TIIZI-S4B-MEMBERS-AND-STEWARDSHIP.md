# TIIZI-S4B-IMPL-001 — Members + Stewardship

**Status:** IMPLEMENTED CANDIDATE / AWAITING FOUNDER REVIEW  
**Baseline:** `origin/main` `05d1e11d7074def2277d8d94b60aa978a4b8e7c7` (S4a closed / accepted / merged; S4b authorized by Founder Disposition A)  
**Scope:** governed active-member roster, singular Steward and truthful Member presentation, existing ordinary-member Leave path, Steward leave-blocked state, mobile-first Group Home integration.

## Authority and contract

`GET /v1/groups/:groupId/members` is registered beside S4a's canonical Group read and uses the same injected `GroupMutationStore` live authority seam. The server resolves the caller from the authenticated Tiizi member, reads the Tiizi Group UUID's PostgreSQL row only to obtain the transitional Firestore lookup key, reads the live Group for existence/liveness and `ownerId`, then reads the caller's live membership and enumerates live Group membership documents. Only `active`/`joined` live relationships enter the roster. PostgreSQL `group_memberships` is never queried to authorize roster access.

Each returned live Firebase subject is mapped server-side through `members(auth_provider='firebase', auth_subject=...)` to a Tiizi member UUID. The single Steward is classified only when that member UUID maps from the live Group `ownerId`. A missing/malformed Steward mapping or any unresolvable active relationship fails closed; the service does not infer a Steward from role text. Pending applicants and outsiders receive the same generic 404 for roster access, including private Groups. Invalid Group ids receive a generic 400. The route projects no Firebase UID, legacy Group id, storage identity, profile, role/admin value, email, phone or Challenge participation.

Response:

```json
{
  "groupId": "<Tiizi Group UUID>",
  "members": [
    { "memberId": "<Tiizi member UUID>", "relationship": "steward", "joinedAt": "<ISO timestamp or null>" },
    { "memberId": "<Tiizi member UUID>", "relationship": "member", "joinedAt": "<ISO timestamp or null>" }
  ]
}
```

No governed human-readable Member identity projection exists at this baseline. UUIDs are references for client comparison only and never render. The UI uses “You” for the viewer and “Tiizi member” for other people; it does not enrich from legacy Firebase profiles. `joinedAt` uses the live membership creation/approval timestamp when the current authority supplies it.

## Experience and leave

Group Home order remains hero → hosted Challenges → Members → About this Group. Members is a compact responsive card list rather than a desktop table. Exactly the roster entry mapped from live `ownerId` receives the **Accountable Steward** label; every other entry is **Member**, including legacy rows whose internal `role` happens to be `admin`.

Ordinary Members receive a quiet **Leave Group** action with deliberate browser confirmation. It calls the existing `POST /v1/groups/:groupId/leave`, then invalidates membership, Group, Challenge and roster queries. If the live authority records `left`, the subsequent roster read returns the same generic denial as any non-member; a page refresh reads that persisted state. The Accountable Steward sees a blocked explanation and no leave action. The API also rejects direct Steward leave with a truthful 403; it offers no transfer workaround.

## Validation record

- New API coverage proves steward/member mapping (including legacy `admin`), private outsider and pending denial, malformed IDs, PG-shadow-only denial, orphaned owner mapping fail-closed behavior, provider/storage identity exclusion, ordinary leave persistence/roster denial and Steward leave blocking.
- Existing S4a Group Home and richer-identity tests remain unchanged and pass.
- V2 runtime/experience, membership cache, authentication return, mobile navigation, S2-G/S2b and S3a–S3d guards pass.
- API typecheck/build, root Vite build and Functions build pass.
- The isolated local PostgreSQL preview service publishes only `127.0.0.1:15432`; the Auth/Firestore emulator endpoints, API, and Vite hosts are loopback-only, and Emulator UI is disabled.
- Local browser preview: `http://127.0.0.1:5173/v2/groups/e471b93a-c1c4-44f4-8f24-d1bfe19f97d1` (`Morning Miles Crew`, created through the governed V2 Group flow). Local emulator accounts: `s4b.steward@tiizi.local` / `S4bSteward-Preview-2026!` and `s4b.member@tiizi.local` / `S4bMember-Preview-2026!`. The member was observed joining through the governed path; the rendered roster showed exactly one Accountable Steward and one ordinary Member. The Steward page showed the leave-blocked explanation. The ordinary Member Leave confirmation opened, but browser control timed out before the confirmation could be accepted, so the complete browser leave journey remains for Founder preview. API coverage separately verifies persisted leave and post-leave roster denial.
- Initial real-browser overflow inspection at 320, 375, 390, 430, 1024 and 1440 CSS pixels found no horizontal overflow. A 1440 screenshot caught a card badge collision, corrected by keeping the compact roster in one column; the corrected desktop layout was visually rechecked. The final post-correction six-width sweep and clean console pass remain to be confirmed during Founder preview.
- The preview is bound to loopback. PostgreSQL is on the isolated compose stack and the Auth/Firestore emulators have Firebase Emulator UI disabled. Never expose the emulator hub, Firestore emulator, or PostgreSQL port publicly.

## Preserved exclusions

S4b does not implement transfer/successor acceptance, admission approval/rejection or pending-request management, invitations, member removal/suspension/restoration, discovery, role creation, delegated administration, Council mechanics or membership, Group settings editing, Charter lifecycle/editor/upload/versioning, search, messaging, presence, activity tiers/summaries, Challenge participation in roster, Feed, leaderboard, Kudos/social functions, Activity Library or legacy Profile enrichment. S4c, S4d and S6 remain not started.
