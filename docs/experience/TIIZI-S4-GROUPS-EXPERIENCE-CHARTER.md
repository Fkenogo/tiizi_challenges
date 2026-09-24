# TIIZI-S4 — Groups Experience Charter

**Task:** TIIZI-S4-GROUPS-EXPERIENCE-CHARTER-AND-AUTHORIZATION-001 (CHARTER — no implementation)

**Base:** `origin/main` @ `561df387b7711d8b8548129b44e2e72583a70800` (verified; no drift from the expected S3-closure baseline)

**Master Programme:** v2.02 → v2.03 (S3 COMPLETE / FOUNDER ACCEPTED / MERGED, unchanged; S4 ACTIVE; immediate next implementation action S4a)

**Status:** CHARTERED — implementation NOT STARTED / NOT AUTHORISED pending Founder acceptance of this charter. S4a becomes implementable immediately after Founder acceptance. S4 is NOT COMPLETE. S4a is NOT IMPLEMENTED.

**Charter rule (authority-first, as S3):** canonical Product Truth → governed authority → persistence/read models → experience binding. S4 exposes existing Group truth and adds only the read contracts and bounded mutations this charter names. The experience must not become a second authority and must not invent membership, stewardship, ranking, feed, media, location, moderation, or recognition client-side.

**Sequencing (Founder-directed, supersedes the readiness suggestion that put comprehensive creation last):** S4a → S4b → S4c → S4d. Each slice goes to a Founder-preview boundary, as S3 did (FD-S3-001 pattern).

---

## 1. Evidence base

Derived from, in order:

1. Master Programme v2.02 (`docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`) and the S2-G record `docs/experience/TIIZI-S2G-GROUP-ESTABLISHMENT.md` (S2-G deliberately deferred discovery, detail, roster, invitations, admission-mode selection, stewardship delegation, Charter, Council, rules, moderation, feeds, imagery — all S4).
2. Experience architecture: `docs/experience/TIIZI-EXPERIENCE-INTEGRATION-MAP.md` (§3 Groups row, §7 S4 position, invariant 9: open-by-default creation, exactly one Accountable Steward), `TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md` (M16–M23 Groups dispositions; F-E-01 feed settlement; FD-4/FD-5 moderation gates), `TIIZI-EXPERIENCE-REFERENCE-ADOPTION-RECORD.md` (formula; reference governs assembly only).
3. Product Truth: EOG-E1-01 §§2–11, §§26–28, §§30–32, §36, §§38–40; Group Domain Standard §§2, 4, 10–13; T2 FR-V2-001–024 (Stage F Founder-approved via STAGE-F-FAD-01; `-DRAFT` filenames notwithstanding), FR-V2-128–134 (F-E-01 reconciliation), FR-V2-212; CIC invariants #1/#2/#6 and objects 4.3/4.4/4.5/4.20/4.21/4.22/4.27.
4. Implementation on main: `api/src/groupMutations.ts`, `groupMutationRoutes.ts`, `firestoreGroupAuthority.ts`, `firestoreGroupMutationStore.ts`, `memberships.ts`, `groupIdentity.ts`, `challengeCreationAuthority.ts`, `challengeReads.ts`, `app.ts`; migration `001_phase_a_foundation.sql`; frontend `src/v2/groups/` (`V2GroupsScreen.tsx`, `V2CreateGroupScreen.tsx`, `useV2Groups.ts`, `groupDraft.ts`, `groupsView.ts`), `src/api/groupsApi.ts`, `src/v2/routes.tsx`, `src/v2/member/MemberShell.tsx`.
5. Adopted Experience Reference (`Fkenogo/tiizi-prototye` @ `cfa696fb`, via the in-repo copy `docs/ui-reference/tiizi_revamp_screens/`) as experience guidance only — never as domain authority. Group surfaces inspected: `groups_(aligned)` (screen + code), `create_group_(aligned)` (screen), `join_group_(aligned)` (screen + code), `group_detail:_challenges_(aligned)` (screen + code), `group_detail_-_challenges_highlighted` (screen + code), `group_detail_-_members_highlighted` (screen + code), `group_detail_-_feed_highlighted` (screen + code), `group_detail:_leaderboard_(aligned)` (screen + code).

## 2. Current implementation map (main @ `561df38`)

Capability classification: (1) governed write seam exists · (2) governed read seam exists · (3) V2 experience binding exists · (4) missing binding only · (5) missing domain/API capability.

### A. Governed Group establishment — reuse as-is

- `createGovernedGroup` (`api/src/groupMutations.ts:273-301`): single authority; atomic Firestore Group + owner membership (`createGroupWithOwner`); creator becomes `owner`/active; PG shadow anchored after; store failure fails closed (503 `group_store_unavailable`, `:71-82`).
- `POST /v1/groups` (`api/src/groupMutationRoutes.ts:200-233`) already accepts the FULL governed field set this charter needs: `name`, `description`, `coverImageUrl`, `isPrivate`, `requireAdminApproval`, `allowMemberChallenges` (`ALLOWED_CREATE_FIELDS`, `:46-53`; schema `:173-185`). Actor resolves server-side (`resolveActor`, `:151-165`); smuggled identity fields rejected 400. No schema change is required for comprehensive creation — the S2-G client simply never submitted the governed fields.
- Governed document defaults (`buildGovernedGroupDocument`, `:197-221`): `inviteCode` (`:210`, stored format `{NAME}-{suffix}`), `memberCount: 1` (`:211`, live-authority counter), `status/moderationStatus: active` (`:214-215`), `visibility` derived from `isPrivate` (`:216`), `allowMemberChallenges` default true (`:186-189`). `POST /v1/groups` is the ONLY establishment path and stays so.
- Challenge-creation enforcement already exists server-side: `challengeCreationAuthority.ts` enforces the stored Charter flag `allowMemberChallenges` (`:7-8, :36-37`). S4 surfaces the flag; S4 does NOT re-implement enforcement (S2 enforcement, S4 surface — EA-01 M23).

### B. Membership mutations — reuse as-is

- `POST /v1/groups/:groupId/join` (`:236-262`): public → `joined`/active; private/approval → `pending` (`needsApproval`, `groupMutations.ts:312-314`); counter increments only on active admission (`:367-369`); inactive/missing groups fail closed.
- `POST /v1/groups/:groupId/leave` (`:265-290`): owner cannot leave before stewardship transfer (`:412-414`); active/joined → `left` with counter decrement (`:427`); non-active memberships are idempotent no-ops.
- No invitation-accept, approval, removal, or stewardship-transfer mutation exists → (5) for S4b/S4c/S4d (see §§6–8).

### C. Reads — one reuse, two bounded gaps

- (2)+(3) `GET /v1/memberships/me` (`api/src/memberships.ts:61-108`): the member's active/joined memberships (name/description/isPrivate + role/status/joinedAt). Consumed by `V2GroupsScreen`/`useV2Groups`. Unchanged by S4.
- (5) **Group Detail read — MISSING.** No `GET /v1/groups/:groupId`. The PG shadow (`001_phase_a_foundation.sql:18-43`) carries NO settings columns (no approval flag, no challenge-permission flag, no invite code, no steward reference), so a detail read MUST resolve governed settings and steward attribution from live Firestore authority server-side (PG identity mapping + `isGroupDocActive`, `firestoreGroupAuthority.ts:55-60`), never from the shadow.
- (5) **Group-scoped Challenge read — MISSING.** `GET /v1/challenges` (`challengeReads.ts:1111-1120`) has no `groupId` filter; `listVisibleChallenges` (`:644-723`) computes caller-entitled visibility across eligible groups. S4a authorises a governed `groupId` filter on this route (NOT a new route), reusing the same live-eligibility authority.
- (5) Roster, discovery, and invite-code resolution reads — MISSING (S4b/S4c).

### D. Frontend — bounded S2-G surface, no Group Home

- `/v2/groups` (`V2GroupsScreen.tsx`) lists own memberships with singular `groupRoleLabel` (`groupDraft.ts:70-73`); `/v2/groups/new` (`V2CreateGroupScreen.tsx`) submits name + optional description only (`toCreateGroupInput`, `groupDraft.ts:59-63`); pure view/validation modules (`groupsView.ts`, `groupDraft.ts`) manufacture nothing. There is NO `/v2/groups/:groupId` route (`routes.tsx:61-62`). `routes.tsx:34-35` already anticipates detail routes wrapped in `V2GroupScope` with the id from route params. Member shell primary nav is Today/Challenges/Groups (`MemberShell.tsx:17-21`).

## 3. Experience Reference reconciliation (Group surfaces)

| Reference surface | Disposition | Binding |
|---|---|---|
| Groups landing: My Groups / Discover / Invites tabs; cards (name, description, member count, challenge count, View) | **ADOPT** composition; **ADAPT** counts | My Groups list = S4a kernel (existing screen evolves). Discover/Invites tabs = S4c only. Counts are presentation: member count from the declared live-authority counter (Group Domain integrity rule 8); challenge count = count of caller-visible hosted challenges via the governed filter, never stored truth. Cover imagery/post badges (`ACTIVE NOW`) = system presentation until media authority exists (§9). |
| Group Detail header (cover, identity card, member count, Invite CTA) + tabs (Feed / Challenges / Members / Leaderboard…) | **ADOPT** header + Challenges tab; **ADAPT** Members; **DEFER** Feed; **REJECT** Leaderboard | S4a Group Home: identity header + viewer relationship + steward + settings + hosted Challenges. No Feed tab in S4a (§10). No Leaderboard tab ever (§9). |
| Creation composition (Identity section → Community Setup → CTA) | **ADOPT** | S4a progressive creation maps exactly onto governed fields (see §5). |
| Creation toggles: Private Group / Allow Member Challenges / Require Admin Approval | **ADOPT** (all three are governed fields) | `isPrivate`, `allowMemberChallenges`, `requireAdminApproval`. Wording adapted to governed meanings (Discoverable vs Private; Direct Join vs Requires Approval). |
| Cover-image upload control | **REJECT** for S4 | No media pipeline exists (§9). No upload control, no URL-entry field (a `coverImageUrl` text field would launder ungoverned content into a trusted field). |
| Join via invite code (+ invite link) | **ADOPT** journey; **ADAPT** format | The reference assumes a 6-digit code; live authority stores `{NAME}-{suffix}` (`groupMutations.ts:210`). The S4c resolution contract MUST accept the stored format, not the prototype's. No code-resolution route exists — S4c adds the minimum one (§7). |
| Members tab: plural "Admins" + badges, presence, tiers, message buttons, member search | **ADAPT** (roles) / **DEFER** (rest) | Exactly one Accountable Steward is displayed; delegated capability only where Product Truth permits (EOG §28; membership `admin` role exists in the shadow check, `001:39`). Presence/tiers/messaging/search have no Product Truth → deferred, never fabricated. |
| Feed tab: free-text composer, like/comment counts, bookmark | **DEFER** (whole Feed, §10) | Composer + comments contradict FR-V2-212/FR-V2-133; counts imply a social engine that does not exist. |
| Leaderboard tab: cross-challenge "Top Performers / Global rankings / points" | **REJECT** | Group Domain Standard §2 (a Group "is not a Leaderboard"; "does not determine Progress, Completion or Ranking"), §4.4; FR-V2-091/211; EOG §33/§35 (Challenge-engine boundary). Challenge-level standings stay in the Challenge experience (S3). |
| Charter/rules presentation, location, tagline | **ADAPT** / **REJECT** | Charter visibility = S4d within EOG §5 + CIC 4.5 (no authoring engine). Location/tagline/rules have no governed fields → not invented. |

## 4. Authoritative definition of S4 — Groups Experience

S4 assembles the member-facing Groups product over the §2 authorities: comprehensive creation → Group Home → roster/stewardship → discovery/join/invitations → governed settings. Non-goals belonging elsewhere: Activity Guide/library (S6 — §11 preserves contextual access), Templates (S7/PF-06), recognition/support/notifications (S8), moderation/operator authority (FD-4/FD-5-gated; S9), commercial (S10).

## 5. S4a — Comprehensive Group Creation + Group Home (next; implementable on Founder acceptance)

### 5.1 Creation experience (reuses `POST /v1/groups`; no new mutation)

Progressive, mobile-first, maximum two sections on the existing `/v2/groups/new` route (evolves `V2CreateGroupScreen`; extends `CreateGroupDraft`/`CreateGroupInput`/`useCreateGroup` with the three governed booleans; client validation stays UX-completeness only):

- **Section 1 — Identity:** Group name (required, 1–200), description/purpose (optional, ≤2000). Unchanged semantics.
- **Section 2 — Community Setup** (governed fields only, plain-language labels + honest consequence hints): Discoverable vs Private (`isPrivate`); Direct Join vs Requires Approval (`requireAdminApproval`); Challenge creation — Members permitted vs Steward-restricted (`allowMemberChallenges`, default permitted per FR-V2-022). Hints MUST state the governed consequence (e.g. approval-required join yields a pending state; steward-restricted creation is enforced by Challenge authority, not by the form).
- **NOT in the form:** cover upload/URL, tagline, location, rules text, Charter drafting, Council, invitation pre-configuration, moderation. No step may imply an unbuilt capability.
- On success: navigate (replace) to `/v2/groups/:groupId` with a bounded confirmation naming the Group and the viewer's Accountable Stewardship. Invalidate membership + detail reads; persistence is proven by server re-read.

### 5.2 Group Home (`/v2/groups/:groupId`, new `V2GroupHomeScreen` in `V2GroupScope`)

Presents ONLY truth that exists, in reference composition (identity header → relationship/steward/settings strip → hosted Challenges):

- Group name; description/purpose; viewer's relationship (Member / Accountable Steward / pending / non-member) from live authority; member count (declared authority: live counter); singular Accountable Steward (server-resolved, never client-declared); governed settings (admission mode + challenge-creation permission, member-worded); hosted Challenges via §5.3 (with honest empty state linking to creation where the viewer is permitted).
- S4a does NOT add: roster list (S4b), Discover/Invites tabs (S4c), settings editing (S4d), Feed (deferred §10), leaderboard (rejected §9).
- States: loading / error-with-retry / empty-challenges / not-found (unknown/inactive id) / forbidden (private to non-members); refresh re-reads (refetch-only convergence, no client persistence); mobile-first; no internal ids, Firebase UIDs, or state codes rendered.

### 5.3 S4a backend contracts (exact)

**Reused (no change):** `POST /v1/groups` (full field set already accepted); `POST /v1/groups/:groupId/join`; `POST /v1/groups/:groupId/leave`; `GET /v1/memberships/me`; `GET /v1/challenges/:challengeId` (detail links from Home).

**New — `GET /v1/groups/:groupId`:**

- Resolves via PG identity mapping → live Firestore read (`getGroup` through the injected store; `isGroupDocActive` gate). Unknown id or inactive group → 404. Store outage → 503 (fail closed, never shadow fallback).
- Returns: `id` (UUID), `name`, `description`, `isPrivate`, `requireAdminApproval`, `allowMemberChallenges`, `memberCount` (live counter), `steward` (Accountable Steward member reference resolved server-side from `ownerId` via the members Firebase mapping — same mapping as `resolveActor`; unresolvable → fail closed, never client-supplied), `viewerMembership` (`{status, role}` or null), `createdAt`.
- Visibility gating (EOG §§8/30, FR-V2-016/017/019/020, CIC 4.27): members see the full projection; non-members see ONLY the authenticated-discoverable subset (identity + discoverability + enough to decide on joining); private-group internals (settings detail, steward identity beyond necessity, counts) MUST NOT leak through the detail read. Discovery never creates membership (FR-V2-021).
- Response MUST NOT leak Firebase UIDs, legacy Firestore ids, or provider internals (S2-G precedent).

**New — governed `groupId` filter on `GET /v1/challenges`:**

- `GET /v1/challenges?groupId=<uuid>`: same `listVisibleChallenges` authority, scoped to one group. Unknown/inactive group → 404. Returns ONLY challenges the caller is entitled to see in that group (participation history + current live eligibility; non-member discoverable subset per EOG §9). Proves genuine scoping (a challenge hosted elsewhere MUST NOT appear). No new route, no second read model, no duplication of Challenge truth.

**No other S4a mutations.** Any S4a proposal needing stewardship transfer, member approval/removal, settings writes, invites, or feed writes is out of scope for S4a and belongs to its named slice or is explicitly rejected/deferred.

### 5.4 S4a acceptance contract

**Backend:** reused authorities (§5.3) + two new read contracts; authorization fail-closed (401 unauthenticated; 404 unknown/inactive; private gating; 400 on smuggled actor fields; 503 on store outage); no device/client fabricated authority (steward, counts, settings, scoping all server-resolved).

**Frontend:** routes `/v2/groups` (evolved list), `/v2/groups/new` (progressive creation), `/v2/groups/:groupId` (new Home); reference composition for creation + Home; mobile-first; loading/empty/error/refresh behaviour per §5.2; V2 primitives reused (`V2Primitives`, `V2Sheet` patterns); V1 imports prohibited (boundary guard extends to new files); deep-linkable Home (refresh-persisted) AND reachable by journey (never direct-URL-only).

**Tests/guards:** API integration tests proving creation settings persist to live authority (and PG-anchored identity), creator becomes owner/active Accountable Steward, Home reads canonical truth, group-scoped challenges genuinely scoped, unauthorized reads/mutations fail correctly, and S2/S3 behaviour unregressed (memberships/me contract, challenge creation authority, challenge reads unchanged in default mode). Frontend guards: creation→Home journey, refresh persistence, cache invalidation (extend the `challengeQueryKeys`/`memberships` invalidation pattern), V2 boundary (no direct Firestore/PG, no V1 composition, no second Group store).

### 5.5 Founder S4a preview journey (required)

Authenticated member → Groups → Create Group → identity/purpose → privacy/admission/challenge-permission setup → Create → arrives inside the persisted Group Home → correct identity, correct Accountable Steward relationship, persisted configuration, hosted Challenges (or honest empty state) → navigate away → return → browser refresh → state remains correct. Mobile form factor. Journey-reachable, not direct-URL-only.

## 6. S4b — Members + Stewardship (chartered; implements after S4a acceptance)

- **Roster read (new, bounded):** `GET /v1/groups/:groupId/members` — member-visible only (EOG §30; CIC 4.4/4.27: membership visible to Group Members by default, never to outsiders beyond governed discovery). Returns active memberships: member reference, role (`steward`|`member` mapped from owner/admin/member), `joinedAt`. Pending list visible ONLY to the steward/delegated capability. No presence, tiers, messaging, or search (no Product Truth).
- **Stewardship display:** exactly one Accountable Steward (EOG §§3–4; CIC 4.3 `stewardId`, atomic transition). Reference plural "Admins" MUST NOT become co-equal stewards. Delegated capability (EOG §28: explicit/scoped/attributable/revocable) is displayed only where the membership authority reports it; S4b authorises NO grant/revoke mutation.
- **Leave:** reuses `POST …/leave` (owner blocked pending transfer — existing behaviour).
- **Bounded missing implementation (named, not invented):** stewardship transfer/removal/approval mutations have Product Truth permission (EOG §§4/7) but NO mutation authority on main. S4b surfaces the honest blocked state ("transfer available via a later governed action") rather than inventing behaviour. Transfer/approve/remove mutations are NOT authorised by this charter; they require a bounded follow-on authorisation, not a silent S4b addition.

## 7. S4c — Discovery + Join + Invitations (chartered; implements after S4b)

- **My Groups:** the S4a list is the kernel (own memberships; pending state surfaced once readable).
- **Discover (new, bounded):** `GET /v1/groups/discover` — authenticated-discoverable groups ONLY (EOG §8; FR-V2-016/018/019/020; CIC 4.27): minimal fields (identity + discoverability + pre-join information), never member internals, never private groups, never auto-membership (FR-V2-021).
- **Join:** reuses `POST …/join` (direct vs pending per existing admission authority). **Invite-code join (new, minimum):** one resolution contract over the STORED code format (`groupMutations.ts:210`; reference 6-digit assumption is not the format): resolve code → group identity → existing join path. No second membership system; no invite-link magic that bypasses admission rules (EOG §6: invitation does not itself establish membership).
- **States:** joined / pending / invited-or-code-resolved, all server-derived.

## 8. S4d — Group Settings + Remaining Governed Configuration (chartered; implements last)

Authorises ONLY settings backed by Product Truth:

- **Bounded settings mutation (new):** steward-only, attributable writes to `isPrivate`, `requireAdminApproval`, `allowMemberChallenges` through the existing store seam (fail-closed; EOG §28 delegation scope respected). **Identity editing (new, bounded):** steward edits to `name`/`description` (CIC 4.3: mutable by steward). Both with historical intelligibility (EOG §38: material changes attributable, never rewritten as always-state).
- **Charter visibility (bounded):** surface the Group Charter 1:1 to the Group (CIC 4.5) with standard/prefilled Platform-subordinate provisions selectable per FR-V2-009/010 and honest-logging expectations (FR-V2-014); custom text only as permitted (FR-V2-011/012). NO Charter drafting/versioning machinery (content/amendment/versioning deferred per EA-01 M20).
- **Council visibility (bounded):** optional/advisory presentation only (EOG §5; EA-01 M21). No mechanics.
- S4d MUST NOT become an unrestricted administration platform: no moderation workflows (FD-5), no role invention (FR-V2-013/EOG §26), no member removal (bounded-missing per §6), no media/location.

## 9. Explicit boundaries (binding on all S4 slices)

1. **NO GROUP LEADERBOARD.** Ranking/Progress/Completion are Challenge-derived truths (Group Domain Standard §§2/4.4; EOG §§33/35; FR-V2-091/211). No cross-Challenge ranking model, points table, or "Top Performers" surface is authorised, even though the reference contains one.
2. **NO AD-HOC MEDIA ARCHITECTURE.** `coverImageUrl` acceptance is storage of a string, not a media pipeline. No upload controls, no URL-entry UI, no Firebase Storage or Cloudflare media work for S4, no user-selected gradient/theme truth. System presentation until a canonically authorised media slice exists (carries forward the S3a/S3b media deferral).
3. **NO LOCATION INVENTION.** No geographic behaviour (CIC `locationScope` is descriptive optionality, not an authorised S4 capability).
4. **NO MODERATION ENGINE.** Reports/flags/actions remain FD-4/FD-5-gated (EA-01 M22/O4/O8). S4 builds no report/flag/moderate surfaces or mutations.
5. **NO COUNCIL ENGINE.** No voting, committees, or procedures (EOG §5; EA-01 M21).
6. **NO CHARTER AUTHORING ENGINE.** Standard/prefilled subordinate provisions may be surfaced (S4d); no drafting/versioning/enforcement machinery (EA-01 M20).
7. **NO ROLE PROLIFERATION.** Exactly one Accountable Steward (EOG §3; CIC 4.3). Delegation only as EOG §28 permits. `groupRoleLabel` singular language is preserved and extended, never pluralised.

## 10. Group Feed disposition — explicitly DEFERRED (does not block S4a)

Product Truth recognises the concept with settled boundaries: Group Feed is the single community stream (FR-V2-128 settled; CIC 4.20), content is eligible automatic state events + explicit Share only (FR-V2-129 settled; FR-V2-212; CIC 4.21), routine Activity logging MUST NOT auto-publish (FR-V2-129/212), feed is presentation never truth (FR-V2-130; CIC invariant #6), no comments in initial V2 (FR-V2-133), Kudos never affect truth (FR-V2-132/134; EOG §36; CIC 4.22).

Implementation authority is INSUFFICIENT: no feed publication seam exists (no enumerated eligible-event set, no automatic-event writer, no Share-to-Group seam, no Kudos seam, no steward-removal seam), and the reference Feed implies exactly the forbidden behaviours (free-text composer as auto-content, comment/like counts, engagement metrics). Authorising Feed now would either fabricate a social engine or ship a dead tab. Therefore: **S4a Group Home ships with NO Feed tab** (Challenges-first Home); Feed is deferred to a bounded later slice that must first charter the eligible-event enumeration + Share seam + removal authority. The deferral is recorded here so no slice treats the reference Feed tab as an obligation.

## 11. Activity Guide / Library — context only (S6, not S4)

No Activity browsing, categories, search, detail, instructions, cautions, equipment, or measurement/unit surfaces are authorised in S4. The S3-established contextual access (canonical Activity identity/code display, governed catalogue names at creation/logging points) is preserved unchanged and MUST NOT be extended into a library under S4 cover. PF-01/PF-02 domain truth is not reopened.

## 12. Programme status after charter acceptance

- S1/S2/S3 remain COMPLETE / FOUNDER ACCEPTED / MERGED (S3 closed v2.02; not reopened; CGP work not reopened; Stage F not reopened).
- S4 becomes ACTIVE with the authorised sequence S4a → S4b → S4c → S4d. Immediate next implementation action: **S4a** (this charter is its complete authorisation; no further assessment programme).
- S5 (Today), S6 (Activity Guide/Knowledge), S7 (Templates, PF-06-gated), S8 (Profile/Recognition/MOT-01-gated + Support), S9 (Operator, FD-4/FD-5-gated), S10 (Commercial placeholder) remain downstream in the EA-01 sequence, unchanged.

## 13. Validation performed (charter task)

- Repository used as canonical source: every authority/contract claim cites the file and line range verified on `origin/main` @ `561df38`.
- Rejected/deferred reference concepts explicitly identified (§3 table, §§9–10).
- `git diff --check` clean; only the two authorised documentation files changed (§14 of the task record is satisfied in the return report).
- S4a NOT marked implemented; S4 NOT marked complete.

---

## 14. S4a Founder-preview correction (CORR-001) — Group formation & experience assembly

**Task:** TIIZI-S4A-FOUNDER-PREVIEW-CORR-001 (correction candidate — NOT Founder accepted, NOT complete, NOT merged).

**Base:** PR #46 branch `impl/s4a-group-creation-home-001` @ `303bc9a` (S4a IMPLEMENTED CANDIDATE / TECHNICALLY REVALIDATED, disposition B).

**Founder direction (authoritative):** the S4a assembly is technically sound but under-assembled — creation is too compressed, identity too shallow, cards too sparse, Home too configuration-dominant, hosted Challenges don't feel hosted. Correct the assembly WITHOUT opening S4b/c/d, WITHOUT Group Feed, WITHOUT Charter/Council engines, WITHOUT weakening any existing authority.

### 14.1 Charter / rules / Council reconciliation (task §9: A–F)

**A. Already canonical Group truth:** name, description, discoverability/admission/challenge-permission settings, singular Accountable Steward, voluntary membership lifecycle, member counts (declared authority), hosted Challenges with S3-derived progress/participation, Challenge-creation enforcement (EOG §§2–11/26–28; CIC 4.3/4.4; T2 FR-V2-007/008/015/022–024).

**B. Governance concept / visibility only:** every Group operates under Platform governance (EOG §5 hierarchy — statable without data); Charter lifecycle/versioning, Council composition/procedure, moderation/report authority (EA-01 M20/M21/M22; FD-4/FD-5).

**C. Persistence/API seam exists today:** governed establishment + join/leave mutations; detail + memberships/me + group-scoped Challenge reads (all S4a); Challenge creation authority incl. the stored `allowMemberChallenges` flag.

**D. Absent:** richer identity persistence (tagline/location/focus/norms/cover), provision catalogues, Council data, feed publication authority, moderation workflows.

**E. In CORR-001:** five optional presentation-level fields (below) + curated cover contract; norms display; governance note; Council omitted for lack of data.

**F. Remains S4b/S4d or later:** roster + stewardship transfer/removal/approvals (S4b); settings editing, Charter selection/authoring, provision catalogues (S4d); discovery/invites (S4c); moderation, Council mechanics, Feed (gated/deferred).

### 14.2 Field-by-field classification

| Concept | Verdict | Basis |
|---|---|---|
| name / description | SUPPORTED NOW | groups.name/description; existing validation |
| tagline (≤140, optional) | BOUNDED EXTENSION | No governed field; presentation-only; new optional column + validation |
| location (≤120, optional, descriptive) | BOUNDED EXTENSION | CIC 4.3 names locationScope as descriptive optionality; never access/filter/discovery |
| focusTags (≤8×≤30, optional) | BOUNDED EXTENSION | Presentation chips only; never matching/authority (structured PF-taxonomy picker deferred to S6) |
| rules / core norm (≤5×≤200, create-only display) | BOUNDED EXTENSION | CIC 4.5 customText permits free-form rules; display-only, no versioning/editing/enforcement (Charter engine stays deferred) |
| coverId (catalogue key) | BOUNDED EXTENSION + authorised media contract (§14.3) | Founder reassessment of the S4 media deferral |
| isPrivate / requireAdminApproval / allowMemberChallenges | SUPPORTED NOW | Existing governed fields |
| member/active counts, hosted snapshots, Join/Log CTAs | SUPPORTED NOW | Live counter, group scope, S3 reads/mutations |
| group-level activity picker | DEFERRED | No group-affinity seam; Challenges carry activities |
| Charter clauses/versioning/authoring, provision catalogue | DEFERRED | EA-01 M20 REF; no catalogue exists |
| Council data/mechanics | DEFERRED | No data source; EA-01 M21 |
| moderation/healthState, plural stewards, mock URLs/tags/search, Run Again, Kudos/comments/feed | REJECTED | FD-4/FD-5, EOG §3, mock fabrication, FD-S3-003, feed deferral |

No field was silently invented: every persisted field is validated fail-closed server-side and mirrored read-only.

### 14.3 Canonical media/reference contract (Founder-authorised reassessment)

Upload pipelines (Storage/signed URLs) and arbitrary URL entry are NOT authorised. The production-safe contract is a **curated cover catalogue**: eight stable ids (`cover-1…cover-8`) rendered from local gradients; the server allowlists ids (`GROUP_COVER_CATALOGUE`, mirrored by a `groups_cover_check` constraint); `cover_id` is nullable (legacy rows render a deterministic fallback — presentation, never persisted). Persisted in the live document + PG shadow (`018_group_richer_identity.sql`); exposed on detail + memberships/me. The same catalogue is reusable for Challenge covers later; Challenge-side assembly is explicitly deferred (challenge hero keeps its documented CSS treatment). Media is therefore a defined contract, not a future idea — with uploads still out of scope.

### 14.4 Experience Reference reconciliation (task §13)

| Reference element | Production | Truth support | Disposition |
|---|---|---|---|
| CreateGroupModal fields (name/tagline/location/rule) | 5-step wizard (Identity / Look & focus / How it works / Culture / Review) | Name/desc/settings supported; tagline/location/rule bounded extensions | ADOPT structure, ADAPT (no client-fabricated defaults, no hardcoded image) |
| Modal hardcoded image/tags/defaults | Curated picker, free chips, empty-by-default | None (mock fabrication) | REJECT |
| GroupListView card (cover/location/steward/tagline/tags/counts/entry) | Cover banner, location pill, owner-only Steward badge, tagline, focus chips, live counts, Enter | Counts/relationship supported; plural stewards/health/search rejected | ADOPT composition, ADAPT |
| GroupDetailView hero (cover/identity/steward bar/CTA/good-to-know) | Cover hero, steward line, Launch CTA in hero, membership≠participation strip | All supported | ADOPT |
| Detail tabs (Challenges/Members/About) | Hosted + About (no Members tab — S4b; no Feed tab — deferred) | Roster deferred, Feed deferred | ADAPT |
| About (purpose/rules/Charter/Council) | Purpose + norms + governance note + stewardship + setup; no clauses/versioning, no Council section | Visibility supported; engines deferred | ADAPT |
| ChallengeCard (cover/type/state/progress/counts/Join/Log) | Enriched rows: type/state (neutral Upcoming for establishment), host context, S3 snapshots, counts (live only; streaks none), Join-inline/Log-navigate | S3 reads/mutations; Run Again excluded per FD-S3-003 | ADOPT, ADAPT (no challenge cover yet; no inline logging) |
| Steward display (plural badges/avatars) | Singular text attribution (no member directory/profile reads in S4a) | EOG §3 singular | ADAPT |
| healthState/moderation, Kudos, feed, comments | Not implemented | FD-4/FD-5, deferrals | REJECT |

### 14.5 Assembly before → after

- **Creation:** single long form (identity + setup) → 5-step wizard with per-step gating, review summary, single submission, canonical-ID navigation.
- **Cards:** name/description/role rows → cover banner, location pill, owner-only Steward badge, tagline, focus chips, live member + active counts, Enter.
- **Home:** Community-Setup-dominated record → cover hero (identity/count/relationship/steward/Launch CTA/good-to-know) → enriched hosted Challenges → secondary About (purpose/focus/norms/stewardship/setup).
- **Challenge continuity:** hero "Hosted by X" → navigable link back to Group Home (composition only; S3 truth untouched).
- **Review observations closed:** legacy admin rows read Member (strict badge); establishment Challenges read neutral Upcoming (presentation only).

### 14.6 Validation (correction task)

- New/extended API tests (`s4aCorr001`, memberships shape evolution): 17/17 with the S4a file; full API suite green.
- New CORR-001 guards + evolved S2-G/mobile-nav expectations (marked, none weakened in intent).
- Real-browser pass 320/375/390/430/1024/1440 + populated/empty/restricted Homes + full wizard loop (ESTABLISH 201, genuinely scoped) + public-tunnel journey with zero localhost traffic.
- MP v2.04 records the CORR-001 candidate (not accepted/complete/merged at that point in the review).

## 15. Founder review + mobile Groups correction (CORR-003)

**Task:** TIIZI-S4A-FOUNDER-ACCEPTANCE-CORR-003 and TIIZI-S4A-FINAL-ACCEPTANCE-AND-MERGE-001. **Disposition:** Founder review PASSED and S4a — Group Establishment + Group Home is ACCEPTED / COMPLETE / MERGED. PR #46 merged normally on 2026-09-24 as `11258107d9e42ecbe044d09841c1aa980081f9df` from accepted head `701f3aa0ff7407c7bf43a8aee09810409f454bce`.

Founder assessment retained: Group creation now feels like establishing a community; Group Home coherently presents identity, hosted Challenges and About; Hosted Challenge → Group continuity works. S4a may proceed to final acceptance while the already-authorized S4b Members + Stewardship, S4c Discovery + Join + Invitations, and S4d Settings + Governed Configuration are assembled later. Search/filter/discovery stays in S4c. Charter lifecycle/upload/versioning, Council mechanics, roster, invitations, Feed, structured interest/activity taxonomy and other deferred capabilities remain outside this correction.

**Mobile Groups presentation:** one full-width card per row from phone widths through 1023px; the existing multi-column composition starts at the `lg` breakpoint (1024px). Card information, cover/identity composition, and navigation are unchanged. No carousel, search, filter, pagination, or additional read was added.

**Activity Library remains outstanding — S6:** The V2 Activity Guide route is still a placeholder. Challenge creation currently queries `GET /v1/knowledge?composerSelectable=true` and the governed per-Activity options seam. Choices are canonical published Knowledge records with Activity Codes that pass publication-readiness and Challenge-eligibility checks; they are not hardcoded UI options or test fixtures. The currently available set reflects the populated catalogue, not a completed Activity Library experience. The canonical Activity model, content/publication requirements, taxonomy, metric/unit/component contracts and the 118-candidate baseline / CLU-01 15-Activity validation batch already exist in Stage EK and Stage F / PF-01–PF-04 Product Truth. Full browsing, Activity Guide detail/guidance/safety/measurement surfaces and catalogue assembly remain S6, as already sequenced by the Master Programme and Experience Integration Map. No new stage or Product Truth decision is required before S6 planning/implementation; S6 must consume only published governed Knowledge and preserve the existing eligibility/publication boundaries. No Activity Library implementation occurred here.

**Runtime boundary retained:** CORR-002 remains in force: V2 does not run legacy RouteWarmup prefetches or legacy user-document bootstrap; V2 product reads remain Tiizi API-bound.

**Acceptance scope:** progressive Group establishment; richer Group identity and cover contract; Group cards, including the single-column phone layout; Group Home; hosted Challenge presentation; Group→Challenge and Challenge→Group continuity; first-Challenge path; and the CORR-002 V2 runtime-boundary correction. **Validation:** focused responsive Groups guard, exact viewport/browser verification, and regression results are recorded with TIIZI-S4A-FOUNDER-ACCEPTANCE-CORR-003. S1–S3 remain COMPLETE / FOUNDER ACCEPTED / MERGED. S4b — Members + Stewardship is next authorised and NOT STARTED; S4c and S4d remain queued after S4b. All listed deferrals remain deferred. The Activity Library / Activity Guide remains outstanding under S6; the small governed Challenge-composer catalogue is not the completed Library. No S4b/c/d or S6 implementation occurred in this acceptance/merge task; no deployment occurred.
