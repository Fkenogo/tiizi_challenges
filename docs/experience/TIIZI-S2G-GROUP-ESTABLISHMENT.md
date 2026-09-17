# TIIZI-S2-G — Minimum V2 Group Establishment Prerequisite

**Work package:** S2-G — Group Establishment Prerequisite (minimum real V2 Group
establishment vertical)

**Status:** IMPLEMENTED CANDIDATE / AWAITING FOUNDER PRODUCT PREVIEW
(branch `impl/s2g-group-establishment-001`; **STOP BEFORE MERGE**)

**Date:** 2026-09-17

**Base:** `origin/main` @ `b97fbf618dce864206594db61d29680e86c5382c`

**Branch:** `impl/s2g-group-establishment-001`

**Correction:** TIIZI-S2-ORDER-CORR-001 (Founder-approved sequence correction)

**Governing formula:** PRODUCT TRUTH + ADOPTED EXPERIENCE REFERENCE = TIIZI PRODUCT ASSEMBLY.
This slice binds already-merged governed Group capability to the adopted experience; it invents
no new authority, no second Group store, and no Group invariant in React.

---

## 1. Purpose

Challenge creation correctly requires a host Group, and the Founder preview demonstrated that a
Challenge cannot be meaningfully accepted before a real Group can be established through the
product. This slice provides the **minimum real V2 Group establishment vertical** so that an
authenticated member can establish a Group through Tiizi itself, before S2b Founder acceptance.

It is deliberately bounded: it is the Group *establishment prerequisite*, not the Groups
Experience. The full Groups Experience (discovery, roster, stewards, Charter, Council, rules,
creation permissions, moderation) remains S4.

## 2. Authority chain (preserved — no new authority)

```
authenticated member (Firebase ID token)
  → POST /v1/groups                          [api/src/groupMutationRoutes.ts]
  → resolveActor (server-side: member UUID ← token; Firebase UID ← members.auth_subject)
  → createGovernedGroup                      [api/src/groupMutations.ts]   ← SINGLE authority
  → GroupMutationStore.createGroupWithOwner  [Firestore: atomic groups/{id} + groupMembers/{id}_{uid}]
  → PostgreSQL shadow (groups + group_memberships; role owner, status active)
  → GET /v1/memberships/me                   [api/src/memberships.ts]      ← the read contract
  → /v2/groups lists the persisted Group
```

`POST /v1/groups` remains the only establishment path. The V2 layer is transport and
presentation only: it does **not** write Firestore or PostgreSQL directly, does **not** decide
owner/steward authority, and does **not** re-implement any Group invariant. The `Challenge
Group-membership invariant` is untouched.

## 3. Experience boundary

Implemented under the new V2 composition root (`src/v2/**`), mounted at `/v2/*`.

- No V1 Group experience is imported or routed (`src/features/Groups/**`, V1 group services,
  V1 hooks, `BottomNav` — all frozen and unreferenced).
- No PF-05 experience code is imported or referenced.
- Allowed reuse: governed domain/API capability (`src/api/**`), neutral V2 shell primitives
  (`src/v2/components/V2Primitives.tsx`), shared read client (`src/api/membershipsApi.ts`).

Guards: `scripts/testS2GroupEstablishmentGuards.ts` (new) and the existing
`scripts/testV2ExperienceBoundary.mjs` (walks `src/v2/**`, so the new `src/v2/groups/**` files
are covered automatically).

## 4. Files

| Area | File |
| --- | --- |
| Groups surface (list + empty/create entry) | `src/v2/groups/V2GroupsScreen.tsx` |
| Minimum Create Group journey | `src/v2/groups/V2CreateGroupScreen.tsx` |
| Pure draft/validation + member-facing labels | `src/v2/groups/groupDraft.ts` |
| Read/write hooks | `src/v2/groups/useV2Groups.ts` |
| V2 API client (establishment only) | `src/api/groupsApi.ts` |
| Shared V2 primitives (button/field/inputs/card) | `src/v2/components/V2Primitives.tsx` |
| Routes | `src/v2/routes.tsx` |
| Placeholder removal | `src/v2/member/memberPages.tsx` |
| API acceptance tests | `api/test/s2gGroupEstablishment.test.ts` |
| Boundary guards | `scripts/testS2GroupEstablishmentGuards.ts` |
| Programme record | `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (v1.72) |

## 5. Minimum Create Group journey

`/v2/groups/new` (`V2CreateGroupScreen`) collects only:

1. **Group name** — required.
2. **Description** — optional.

Everything else is a governed default applied by the backend authority, exactly as
`createGovernedGroup` already does:

| Governed default | Value | Product Truth |
| --- | --- | --- |
| Creator role | `owner` (Accountable Steward) | EOG-E1-01 §3 |
| Creator membership status | `active` | EOG-E1-01 §6 |
| Admission | Open (`isPrivate: false`, `requireAdminApproval: false`) | EOG-E1-01 §6 |
| Challenge creation | permitted (`allowMemberChallenges: true`) | EOG-E1-01 §10/§27 |
| Group lifecycle | `status: 'active'`, `moderationStatus: 'active'` | existing product semantics |

Deliberately **not** offered (all S4): cover image, tagline, location, rules, admission-mode
controls, invitation settings, Charter configuration, Council, challenge permissions, moderation,
advanced settings. `tagline`/`location`/`rules` from the adopted reference have no governed field
and were therefore not invented.

The client validates only basic UX completeness (`groupDraft.ts`); the server remains the single
semantic authority. Submission posts only `name` and (when non-empty) `description` to
`POST /v1/groups`.

## 6. Creator membership and Accountable Stewardship

The creator becomes the Group's owner/Accountable Steward **through the governed authority**, not
by client declaration. The client cannot submit `ownerId`, `userId`, `role` or `memberId`
(rejected with 400 by the route boundary). The member-facing role label is singular
"Accountable Steward" (`groupRoleLabel`), never a plural co-equal steward display.

## 7. Persistence, read, and refresh

- On success the establishment read is invalidated (`useCreateGroup`), and the journey returns to
  `/v2/groups`, which renders the persisted Group from `GET /v1/memberships/me` — the server
  read, not client state. A bounded confirmation banner names the created Group.
- Refreshing the browser re-reads `GET /v1/memberships/me`; the Group persists because it is
  persisted server-side (Firestore truth + PostgreSQL shadow).
- The surface never renders internal identifiers (Group UUID is used only as a React key; the
  transitional Firestore id and provider/state codes are never displayed).

## 8. S2b integration readiness

The read contract is deliberately the SAME contract S2b already consumes:
`GET /v1/memberships/me` (`src/api/membershipsApi.ts`). After S2-G merges, S2b consumes the Group
naturally with no second Group integration mechanism. S2b is not merged, rebased or changed here
(branch `impl/s2b-v2-challenge-creation-001` head `dd1332c` remains HELD). The eventual rebase is
expected to be bounded (a shared `V2Primitives.tsx` region and the `routes.tsx`/`memberPages.tsx`
placeholder swap), plus a copy update where S2b currently says Group creation "arrives in a later
experience".

## 9. Preview fixture disposition

- `scripts/previewS2bSeed.ts` is NOT on `main`; it lives on the held S2b branch. It is therefore
  **not modified here**. Its Group/membership manufacture (`upsertGroup`, `upsertMembership`,
  `seedFirestore`, `PREVIEW_GROUP_LEGACY_ID`) must be removed on the S2b rebase, preserving its
  legitimate knowledge fixtures.
- S2-G introduces **no Group seed and no Group fixture**. For S2-G Founder preview the Group must
  be created through `/v2/groups`; nothing manufactures membership state.
- Auth-emulator UID reset (`preview:v2-auth:reset` deletes and re-creates the identity, minting a
  new localId) is preview **tooling** behaviour, not Product Truth. With real Group creation the
  membership is created by the product against the live identity, eliminating the need for a
  seed-after-reset workaround.

## 10. Verification performed

| Check | Result |
| --- | --- |
| API new acceptance tests (`api/test/s2gGroupEstablishment.test.ts`) | 10 passed |
| API full suite (`npx vitest run` in `api/`) | 618 passed / 8 skipped (40 files passed, 1 skipped) |
| API typecheck (`npm run typecheck`) | clean |
| Root build (`npm run build` = `tsc -b` + `vite build`) | clean |
| V2 experience boundary guard | all passing |
| V2 frontend guards | all passing |
| V2 auth-return tests | all passing |
| S2a seam guards | all passing |
| S2-G guards (`npm run test:s2g-group-establishment`) | all passing |
| `git diff --check` | clean |

The new API tests prove: authenticated creation succeeds; the creator becomes owner/active through
the governed authority; Firestore Group + owner membership are written in one atomic store call;
the PostgreSQL shadow is synchronized; `GET /v1/memberships/me` returns the newly created Group;
the response leaks neither the Firebase UID nor the transitional Firestore id; client-supplied
actor identity is rejected; store failure fails closed with no shadow; and the PostgreSQL shadow
never authorizes Challenge creation (the live Group authority remains the only authority).

## 11. What was deliberately NOT built

Discovery, Group detail, roster, member management, invitations/approvals, join requests,
admission-mode selection, Accountable-Steward delegation, Charter, Council, rules, reports/flags
and moderation, Group feeds/history, advanced settings, deletion/transfer, and
imagery/customisation — all **S4**. No fake controls imply these work. S4 remains the full Groups
Experience and is not redefined by this slice.

## 12. Status

S2-G is **IMPLEMENTED CANDIDATE / AWAITING FOUNDER PRODUCT PREVIEW**. S2 remains **IN PROGRESS**
and is NOT complete. S2a remains closed as merged. S2b remains **IMPLEMENTED CANDIDATE / HELD
PENDING S2-G ACCEPTANCE** (NOT merged). PF-05 is NOT merged; PF-06 has NOT begun. V1 remains
FROZEN / reference-only. No deployment and no production mutation occurred.
