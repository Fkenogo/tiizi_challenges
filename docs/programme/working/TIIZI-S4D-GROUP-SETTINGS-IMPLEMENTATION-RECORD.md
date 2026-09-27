# TIIZI-S4D-GROUP-SETTINGS-IMPLEMENTATION-001

**Status:** COMPLETE / FOUNDER ACCEPTED / MERGED<br>
**Candidate branch:** `impl/tiizi-s4d-group-settings-001`  
**Entry baseline:** `origin/main` `dda5bc007bef25e0e52ce8670822439ac55186d2`  
**Entry Master Programme:** v2.11  
**Schema/migrations:** None  
**Founder acceptance:** Approved exact source `accb03aee610ede88af62a70e2f5652a27d100c4` under TIIZI-S4D-FOUNDER-ACCEPTANCE-AND-CLOSURE-001<br>
**S6:** Not started; remains outstanding.

## Scope and dispositions

This bounded implementation follows the completed S4d readiness and Product Truth reconciliation and the Founder dispositions recorded in `TIIZI-S4-GROUPS-EXPERIENCE-CHARTER-001`. No new readiness assessment was performed.

- Nine settings are editable: `name`, `description`, `tagline`, `location`, `focusTags`, `coverId`, `isPrivate`, `requireAdminApproval`, and `allowMemberChallenges`.
- Richer identity editing is approved. `focusTags` text search follows later Founder-accepted S4c behavior; the contradictory earlier wording is superseded. `location` remains descriptive and is not searchable or used for matching, admission, authorization, or access.
- `coverId` remains limited to the existing eight-value governed cover catalogue. There is no upload, arbitrary URL, or new media system.
- `rules` remain create-time/member-visible data; editing is deferred. Charter visibility is deferred because no authoritative payload/catalogue exists. Council visibility is deferred because no authoritative Council data model exists.
- Discoverable / Private behavior remains unchanged. Pending applications are not auto-approved when admission settings change. Existing members, invitations, and Challenges are not rewritten by a settings mutation.
- No S4d audit infrastructure was introduced. Existing `updated_at` behavior is used. No relational-hardening migration was added merely for S4d.
- PostgreSQL remains the sole Group, Membership, and Group-scoped Challenge authority. Firebase Auth supplies authentication/identity only. No Firestore Group/Membership reads or writes, fallback, dual-write, V1 authority, migration, reconciliation, or production Firebase query was added.

## Implemented contract

`PATCH /v1/groups/:groupId` rejects an empty patch and every field outside the nine-field allowlist. Server-derived and protected fields—including IDs, legacy IDs, status, Steward identity, invite code, rules, member count, timestamps, actor/member identity, role/admin fields, and `coverImageUrl`—are not mutable.

Known-field validation runs after the transaction locks and loads the active Group and confirms the authenticated canonical Member is exactly `groups.steward_member_id`. Name is trimmed and required when supplied (1–200 characters); description is at most 2,000 characters; tagline is trimmed and at most 140; location is trimmed and at most 120; focus tags preserve the existing array representation and are limited to 8 entries of at most 30 characters; cover ID is catalogue-bound; the three policy fields must be booleans. Unknown and empty patches are rejected at the route boundary. Database failures return the established fail-closed Group store error.

The transaction updates only supplied authorized columns plus `updated_at`. It does not change Group UUID, legacy identifier, Steward, invite code, status, memberships, or Challenges. The response is read from the updated PostgreSQL Group row. Concurrent edits use bounded last-writer-wins behavior; there is no ETag/version system.

Challenge creation authority now checks the singular PostgreSQL Accountable Steward when `allow_member_challenges=false`; a legacy `admin` membership role does not grant that authority. Existing Challenges remain untouched.

## Experience and cache behavior

The V2 Group Home exposes **Manage Group** only when the server-derived relationship is `steward`. The mobile-first `/v2/groups/:groupId/settings` form has identity, privacy/joining, and member-Challenge sections with explicit Save changes and Cancel. Location copy says it is descriptive only; focus-tag copy explains that text search may be affected. Private, approval-required, and Steward-creates copy states the consequences without implying that existing members, pending requests, or Challenges are rewritten. A second Steward check gates the settings screen itself.

On success, the existing `invalidateV2GroupReads(...)` invalidates canonical Group detail, discovery, memberships, pending applications, and hosted Group Challenges. The UI does not optimistically author Group truth.

## Automated validation

Executed from the isolated worktree using local synthetic PGlite data:

- Root `npm run build`: passed (TypeScript + Vite production build). Existing Browserslist age and large-chunk warnings remain.
- API `npm run typecheck`: passed.
- API `npm test`: passed, 53 files / 715 tests; 1 file / 8 tests skipped because the Firestore emulator was not configured. This includes retained S2/S4a/S4b/S4c suites and the new S4d settings coverage.
- Functions `npm run lint` and `npm run build`: passed.
- V2 runtime boundary and experience boundary scripts: passed.
- V2 frontend, auth-return, membership-cache, Firebase emulator-mode, S2-G establishment, S4a Group Home, and S4b Members guards: passed. The S4b guard was updated to include the new governed PATCH route.
- The mobile-navigation guard now asserts the exact authorized member-route set, including `/v2/groups/:groupId/settings`; it continues to reject missing, substituted, duplicate, or unauthorized routes.
- Focused S4c/S4d API tests passed (10 tests); the full API suite passed (715 tests, 8 Firestore-emulator-dependent tests skipped).
- S4d coverage verifies all nine fields, unauthorized member/admin/outsider denial, empty/unknown/protected-field rejection, field constraints, Group/invite/Steward/status continuity, memberships unchanged by mutation, private outsider generic 404 and invite resolution, safe discoverable projection, focus-tag/text search and location exclusion, pending preservation while approval is disabled, direct joining for a new applicant, Challenge authority transitions, and PostgreSQL failure fail-closed behavior.
- No schema migration was created. The existing V2 boundary guard reports no direct browser Firestore Group/Membership traffic or fallback.

## Founder preview and diagnostic limitation

The local Founder preview used synthetic PostgreSQL fixtures and the Firebase Auth Emulator; no production service, production data, or V1 authority was used. It exercised the Steward settings entry, identity edits and persistence, policy copy, Save/Cancel, and responsive widths. Focused automated API tests cover privacy, invite resolution, admission preservation, Challenge authority, and legacy-admin denial.

The preview browser recorded two `Object` console entries at `/v2/sign-in`. Available diagnostics exposed no stack or associated failed Tiizi API request, and did not establish a Tiizi-origin error. The settings operation succeeded. Grammarly/extension injection was present in the browser, so the two entries remain unattributed and are recorded as a **DOCUMENTED NON-BLOCKING PREVIEW-ENVIRONMENT LIMITATION**. No product change was made for these entries.

## Founder acceptance and merge closure

The Founder approved exact candidate `accb03aee610ede88af62a70e2f5652a27d100c4`. It was published unchanged on `impl/tiizi-s4d-group-settings-001` in PR #54 against `main` and merged by normal merge commit `2bca4f11a7b5c3c07daf91e692124bd74da381b4`; the accepted source is an ancestor of resulting `origin/main` `2bca4f11a7b5c3c07daf91e692124bd74da381b4`. Repository CI passed: API typecheck/test/build, API image/liveness, Functions build/typecheck, and Web typecheck/build. The external Cloudflare Workers Builds check failed and remains non-gating under the established repository disposition.

The Founder accepted the two unattributed `/v2/sign-in` console entries as a **DOCUMENTED NON-BLOCKING PREVIEW-ENVIRONMENT LIMITATION**. No Tiizi-origin error was established. No browser investigation or product change was performed during closure.

S4d is **COMPLETE / FOUNDER ACCEPTED / MERGED**. S6 remains **OUTSTANDING / NOT STARTED**. No deployment occurred. No production Firebase was queried. Deferred rules editing, Charter visibility, and Council visibility remain deferred; no audit infrastructure or migration was introduced; Firestore/V1 authority and V1 migration or reconciliation were not introduced.

## Changed files

- `api/src/groupMutationRoutes.ts`
- `api/src/postgresGroupAuthority.ts`
- `api/test/s4dGroupSettings.test.ts`
- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`
- `docs/programme/working/TIIZI-S4D-GROUP-SETTINGS-IMPLEMENTATION-RECORD.md`
- `scripts/testS4bMembersGuards.mjs`
- `src/api/groupsApi.ts`
- `src/v2/groups/V2GroupHomeScreen.tsx`
- `src/v2/groups/V2GroupSettingsScreen.tsx`
- `src/v2/groups/useV2Groups.ts`
- `src/v2/routes.tsx`

No PR, merge, deployment, S4d completion/Founder acceptance, or S6 work is included.
