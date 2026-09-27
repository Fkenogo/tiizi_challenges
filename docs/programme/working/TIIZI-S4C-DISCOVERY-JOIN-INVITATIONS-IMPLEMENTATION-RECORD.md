# TIIZI-S4C-DISCOVERY-JOIN-INVITATIONS-001 — Implementation and Closure Record

**Status:** **COMPLETE / FOUNDER ACCEPTED / MERGED** — accepted source `dac6abb8bf5e6ffd423936799f6b89918ccdbbc0`; source PR #52; normal merge commit `51b269825e0252717ab7f867c45ce8ec4900db96`.

**Closure authorization:** Founder disposition on `TIIZI-S4C-FOUNDER-ACCEPTANCE-MERGE-AND-CLOSURE-001` accepted the exact source SHA and authorized exact-source publication, PR/CI merge, and documentation-only closure.

## Source publication and merge

- Pre-merge `origin/main`: `cabacd9f2b91406f4f23afaae6406b9b104750f9`; no drift was found.
- Published branch: `impl/tiizi-s4c-discovery-join-invitations-001`, with remote head exactly `dac6abb8bf5e6ffd423936799f6b89918ccdbbc0`.
- PR #52 targeted `main`; base SHA was `cabacd9f2b91406f4f23afaae6406b9b104750f9`, head SHA remained `dac6abb8bf5e6ffd423936799f6b89918ccdbbc0`, and the source diff contained 19 files.
- Repository CI passed: API typecheck/test/build; API image build/liveness; Functions build/typecheck; web typecheck/build.
- The external `Workers Builds: tiizi-challenges` check failed. This is recorded as non-gating under the established repository disposition; the same failure accompanied merged S4b PRs #48 and #49 while all repository CI checks passed.
- Merge method: normal merge commit (no squash/rebase). Merge commit: `51b269825e0252717ab7f867c45ce8ec4900db96`. Post-S4c `origin/main` was `51b269825e0252717ab7f867c45ce8ec4900db96`; the accepted source is its ancestor.

## Accepted S4c capability

S4c provides authenticated Group discovery; active and non-private discovery boundaries; governed text search, including focus tags; deterministic pagination; explicit open join; approval-required pending admission and applicant pending visibility; approval/rejection by the singular Accountable Steward; invite-code resolution without auto-membership; private Group reach through a valid invite code; explicit join/request after resolution; and invite-code visibility on an authorized active-member projection. Group and Group Membership authority is PostgreSQL-backed through the Tiizi API.

## Founder preview and residual verification

- The functional Founder-preview journeys passed before acceptance. The local preview architecture used PostgreSQL 17.11, migrations through 020, the Tiizi API, Vite V2, and synthetic Firebase Auth Emulator identities. Product Group/Membership data used the V2 API and PostgreSQL. No production Firebase was queried, no V1 data was read or migrated, and no deployment was performed.
- The two Groups-page `Uncaught (in promise) Object` reports were traced to browser-extension template-list requests and extension stack frames. They did not originate in Tiizi application code, did not correspond to a failed Tiizi API request, and did not affect rendered state.
- Focused browser Network recording observed V2 requests to the Tiizi API, including `/v1/groups/discover`, Group detail/roster/pending reads, `/v1/memberships/me`, and `/v1/groups/resolve-invite`. No direct Firestore Group or Membership product-data traffic was observed. Firebase Auth requests in the focused audit used the local Auth Emulator.
- `test:group-invite-backend` covers retained legacy/V1 Firebase invitation machinery, not active S4c V2 invite-code behavior. It passed after its local `functions` dependencies were installed; it is not an S4c V2 dependency.
- The active S4c PostgreSQL API suite passed 8/8. Temporary test-only checks passed for unfiltered inactive/private discovery exclusion and focusTags search; the temporary test file was removed. No product defect was found and no product correction was made.

## Authority and migration truth

- V2 Group authority: PostgreSQL.
- V2 Group Membership authority: PostgreSQL.
- Group-scoped Challenge Group/Membership authority: PostgreSQL.
- Firebase Auth is retained for authentication, token verification, and identity mapping only.
- Firestore is not V2 Group or Membership authority; no fallback or dual-write is used.
- V1 remains frozen/reference-only. V1 data migration and Firestore-to-PostgreSQL reconciliation are not required; V2 uses fresh operational data.

## Preserved deferrals

S4c does not authorize invitation inbox/records; invite rotation, revocation, or expiry lifecycle; cancellation of a pending request; delegated admission administration; stewardship transfer; member removal, suspension, or restoration; Council mechanics; Group Feed; S4d settings editing; S6 Activity Library / Activity Guide; notification work; recommendations or ranking; location-based discovery; or V1 Firebase invitation authority.

## Programme position

S1–S3: **CLOSED / COMPLETE**. S4a: **COMPLETE / FOUNDER ACCEPTED / MERGED**. S4b: **COMPLETE / FOUNDER ACCEPTED / MERGED**. S4c: **COMPLETE / FOUNDER ACCEPTED / MERGED**. S4d: **NOT STARTED — next Group slice**. S6 Activity Library / Activity Guide: **OUTSTANDING / NOT STARTED**.

This closure records no deployment and authorizes no S4d or S6 work.
