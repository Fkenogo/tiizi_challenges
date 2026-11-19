# TIIZI — AEC-004 Guardian G1 Receipt

**Checkpoint:** G1 (pre-implementation) · **Role:** CG-1 Code Lifecycle Guardian
**Guardian session:** `mvs_fdd3933c49f945d5bfae63ec7d41bac7` (task `bg_87137a5e-9f1d-475b-8496-be653230ddb2`, role `verifier`, read-only)
**Parent session:** `mvs_626cf26026204cd394445bda8806e166` (AEC-004 implementation agent)
**Assignment record:** [TIIZI-AEC-004-COVERAGE-ACTIVATION-001.md](./TIIZI-AEC-004-COVERAGE-ACTIVATION-001.md)
**Date:** 2026-11-18
**Independence:** The Guardian session is distinct from the implementation agent and performed no file modification, no `commit`/`checkout`/`merge`/`worktree add|remove`/`stash`, and no write against the primary checkout. Its receipt was produced independently and is reproduced here unedited in substance.

---

## G1 VERDICT

**G1 PASS WITH EXPLICIT LIMITATIONS**

The integration start point is valid and every briefing premise was re-derived from the repository. Three material findings (F-01, F-02, F-03) must be carried into implementation; none blocks G1, because G1 is a baseline/ancestry/gap checkpoint. **F-01 changes the scope of "restore #171" and must not be deferred to G2.**

---

## 1. Fetched main

| Item | Value |
|---|---|
| Fetch | `git fetch origin main` from `/Volumes/PRODUCTION/Projects/tiizi_revamp` |
| Fetch start / completion | `2026-11-18T07:28:21Z` → `2026-11-18T07:28:23Z` |
| Resulting `origin/main` | `21c88f681427172fdc2150f3122e6cce6b90a63e` |
| Matched expected `21c88f6`? | **YES — exact match, no divergence** |
| `origin/main` tip subject | `Merge pull request #173 from Fkenogo/docs/tiizi-aec-003-continuity-activation` |

- The **local** `main` branch in the primary checkout is at `5a012396700fde9aee8aa2b72663a2c7e5564bd3`; `git rev-list --left-right --count origin/main...main` returns `673  0`, i.e. local `main` is a strict **ancestor** of `origin/main` with **zero** local-only commits. No local work is at risk.
- The integration worktree `.worktrees/aec-004-integration` was on `integration/aec-004-founder-experience-recovery-001` at HEAD `21c88f6`, with no tracked modifications — empty of implementation, as briefed.

---

## 2. Accepted sources (independently confirmed)

Every SHA below was re-derived with `git cat-file -t` (all `commit`) and checked with `git merge-base --is-ancestor` / `git rev-list --left-right --count`.

| Source | SHA | Branch | Confirmed |
|---|---|---|---|
| PR #150 head | `3aa0147d558eeba8371cd4cccffcbbc2326dd02f` | `feat/v2-onb-today-discovery-correction-001` | YES |
| PR #171 head | `7ebe03ba5ffaeed5c21b109137a94c7630b18e8c` | `codex/v2-ux-recovery-b1-001` | YES |
| PFD Group/Today | `2f065546dd7051b5c6401e52da897b8c82d6cc93` | `codex/tiizi-pfd-group-cards-001` | YES |
| PFD Today-cover | `38d7bf906e5ff5c91542be7c72bd34d98cd9e0b9` | `codex/tiizi-pfd-today-cards-001` | YES |
| Activity prototype | `e2aee9239d42e6f92a66c22e4fcbbb97595c9521` | `codex/tiizi-pfd-activity-visibility-003` | YES |
| Package A (PR #168) | `4829787343b5811e085db755286b7e447e18b9ac` | merged | YES — ancestor of `origin/main` |
| Image/Profile (PR #167) | `ae089c09f89f7acec77935a8d5bda93a6404ffce` | merged | YES — ancestor of `origin/main` |

### Ancestry findings

| Relationship | Result |
|---|---|
| `3aa0147` ⊂ `2f065546`? | **YES** — the PFD branch contains PR #150's head |
| `38d7bf9` ⊂ `2f065546`? | **YES** |
| `4829787` ⊂ `2f065546`? | **NO** — PFD does **not** contain merged Package A |
| `ae089c0` ⊂ `2f065546`? | **NO** — PFD predates PR #167 |
| `2f065546` ⊂ `origin/main`? | **NO** — not merged |
| `3aa0147` ⊂ `7ebe03b`? | **NO — CRITICAL** — #171 does **not** contain PR #150's head; #171 independently reimplements overlapping files |
| `e2aee92` ⊂ `2f065546`? | **NO** — the Activity prototype is a **descendant** of `2f065546` |

Divergence relative to `origin/main` (behind / ahead):

| Ref | behind | ahead | merge-base with main |
|---|---|---|---|
| `3aa0147` (#150) | 73 | 6 | `c5776e1d21729c9c09f1c8eb0d67cbc93043bf7e` |
| `7ebe03b` (#171) | **10** | **2** | `ce477b0756129119c6ee93e99029984db35cecfc` |
| `2f065546` (PFD) | 46 | 21 | `3de78e4e31862bdd7e687e0711fd3967d49946e3` |

`#171` is only 2 commits ahead of its merge-base — the cleanest restoration source of the three.

---

## 3. PR inventory

| PR | Title | State | Draft | Head SHA | Branch | Mergeable |
|---|---|---|---|---|---|---|
| #150 | Add preference-aware discovery to V2 Today | **OPEN** | no | `3aa0147d558eeba8371cd4cccffcbbc2326dd02f` | `feat/v2-onb-today-discovery-correction-001` | **CONFLICTING** (DIRTY) |
| #171 | Restore V2 Today discovery and public previews | **OPEN** | **yes** | `7ebe03ba5ffaeed5c21b109137a94c7630b18e8c` | `codex/v2-ux-recovery-b1-001` | **MERGEABLE** (CLEAN) |

Other open PRs at G1: #145 (draft), #143, #107, #94.

### 3.1 What #150 has that #171 LACKS (verified by blob identity)

| Item | #150 blob | #171 | Note |
|---|---|---|---|
| `src/v2/today/todayDiscovery.ts` | `25e7daad` | `25e7daad` | **IDENTICAL** |
| `src/v2/today/todayDiscovery.test.ts` | `34bbe404` | `34bbe404` | **IDENTICAL** |
| **`src/v2/today/V2TodayScreen.discovery.dom.test.tsx`** | `67fc3d0f` | **ABSENT** | **#150-ONLY** — 94 lines |
| **`src/v2/challenges/challengeDiscovery.test.ts`** | present | **ABSENT** | **#150-ONLY** — 23 lines, pins `lifecycleBucket()` |
| `src/v2/today/V2TodayDiscoveryRecommendations.dom.test.tsx` | `4cb9378` | `c40947f5` | #171's is **+1 assertion deep** (18 `it()` vs 17) |

**This is the critical answer to "do not assume #171 contains every accepted #150 behaviour": it does not.** The `#150`-only `V2TodayScreen.discovery.dom.test.tsx` is the *only* test in any accepted source that asserts the **AEC-TODAY-03 active-member preservation boundary** at the Today-integration level:

- *"renders authorized fallback cards for a new zero-active member with no preference matches"* — asserts the "Discover what fits you" block is positioned **before** the "Start with a Group" zero state; and
- *"keeps the existing active-Challenge Today experience and hides discovery"* — asserts that with 1 active Challenge the discovery heading is **absent**.

Neither #171's dom test (which tests the component in isolation) nor PFD `2f065546` covers this integration-level boundary, because PFD carries #150's *copy* of the file and would only supply it if transplanted deliberately. Restoring only #171 leaves AEC-TODAY-03 unguarded.

### 3.2 What #171 has that #150 LACKS

| Item | Detail |
|---|---|
| `V2DiscoverableChallengePreviewScreen.tsx` | #171 = 96 lines with member-detail fallback + separate Challenge Join + pagination-stall detection; #150 = 56 lines, discovery-only. **#171 is a strict superset.** |
| `V2DiscoverableChallengePreviewScreen.dom.test.tsx` | #171 = 80 lines / 5 `it()`; #150 = 49 lines / 3 `it()`. **#171 is a strict superset.** |
| `V2GroupHomeScreen.tsx` `returnTo` | #150 does not touch this file at all |
| `MemberShell.tsx` clean header (AEC-HDR-10) | #150 does not touch this file at all |
| `useChallengeCreation.ts` `enabled` gate | #150 does not touch this file at all |
| `V2DiscoverChallengeRow.tsx` "Preview Challenge" | #150 does not touch this file at all |
| `V2TodayDiscoveryRecommendations.tsx` | #171 adds `discoveryCaption` lines, tightens `groupPaginationStalled`, adds `returnTo` state on "View Group". **#171 is a superset of #150.** |

### 3.3 Regression contained in #150 that must NOT be transplanted wholesale

`git diff 21c88f6 3aa0147 -- src/v2/today/V2TodayScreen.tsx`:

```
- <V2Button onClick={() => onNavigate('/v2/challenges/start')}>Create a Challenge</V2Button>
+ <V2Button onClick={() => onNavigate('/v2/challenges/new')}>Create a Challenge</V2Button>
```

Main (and PFD `2f065546`, and #171) all use `/v2/challenges/start`. **#150's V2TodayScreen reverts the accepted Challenge entry choice.** #150 must be applied as a surgical insert only.

---

## 4. File-level presence matrix

| File | main | #150 | #171 | PFD `2f065546` | Note |
|---|---|---|---|---|---|
| `src/v2/today/todayDiscovery.ts` | ABSENT | `25e7daad` | `25e7daad` | `25e7daad` | identical in all three |
| `src/v2/today/todayDiscovery.test.ts` | ABSENT | `34bbe404` | `34bbe404` | `34bbe404` | identical |
| `src/v2/today/V2TodayDiscoveryRecommendations.tsx` | ABSENT | `0aa137f` | `c8c0b3f` | `3b80994` | **3 distinct versions** |
| `src/v2/today/V2TodayDiscoveryRecommendations.dom.test.tsx` | ABSENT | `4cb9378` | `c40947f5` | `4cb9378` | PFD = #150's copy |
| `src/v2/today/V2TodayScreen.discovery.dom.test.tsx` | ABSENT | `67fc3d0f` | **ABSENT** | `67fc3d0f` | **#150-only; PFD carries it** |
| `src/v2/today/V2TodayScreen.challengeCovers.dom.test.tsx` | ABSENT | ABSENT | ABSENT | `d3cef4c` | **PFD-only** |
| `src/v2/today/V2TodayScreen.tsx` | `2f63c53` | `6a7cce5` | `f3117c4` | `724054b` | 4 distinct versions |
| `src/v2/challenges/V2DiscoverableChallengePreviewScreen.tsx` | ABSENT | 56-line | **96-line (superset)** | 56-line | |
| `src/v2/challenges/V2DiscoverableChallengePreviewScreen.dom.test.tsx` | ABSENT | 49-line | **80-line** | 49-line | |
| `src/v2/challenges/challengeDiscovery.test.ts` | ABSENT | present | **ABSENT** | present | |
| `src/v2/challenges/useChallengeCreation.ts` | `03e01f4` | — | `dc982d7` | — | `enabled` gate |
| `src/v2/challenges/V2DiscoverChallengeRow.tsx` | `b16ce19` | — | `fe525f9` | — | |
| `src/v2/challenges/V2ChallengeCover.tsx` | `b67c6ac` | — | — | `b67c6ac` | **identical — already merged** |
| `src/v2/challenges/localChallengeCoverPreviews.ts` | `20e622f` | — | — | `20e622f` | **identical** |
| `src/v2/challenges/templates/templateAdoption.ts` | present | — | — | present | **identical** |
| `src/v2/groups/V2GroupHomeScreen.tsx` | `bb98040` | — | `680fbf4` (returnTo) | `87e1931` (cover) | **both touch main** |
| `src/v2/groups/V2GroupsScreen.tsx` | `2a8fa4a` | — | — | `c7f53fa` | PFD-only change |
| `src/v2/groups/V2GroupPhotoCard.tsx` | ABSENT | ABSENT | ABSENT | `81ed27d` | **PFD-only (new)** |
| `src/v2/groups/V2GroupCover.tsx` | ABSENT | ABSENT | ABSENT | `2fe21ed` | **PFD-only (new)** |
| `src/v2/groups/V2GroupCover.dom.test.tsx` | ABSENT | ABSENT | ABSENT | `6687185` | **PFD-only (new)** |
| `src/v2/groups/localGroupCoverPreviews.ts` | ABSENT | ABSENT | ABSENT | `ef68da67` | **PFD-only (new)** |
| `src/v2/groups/V2HostedChallengeCard.tsx` | `f40428c` | — | — | `f40428c` | **identical — already merged** |
| `src/v2/media/V2LocalImagePicker.tsx` | present | — | — | present | **identical** |
| `src/v2/media/useLocalImagePreview.ts` | present | — | — | present | identical |
| `src/v2/preferences/ProfilePreferencesSection.tsx` | present | — | — | present | **identical — no regression** |
| `src/v2/profile/V2ProfileScreen.tsx` | present | — | — | present (**main +22/−5**) | PFD version is **older** |
| `src/v2/member/MemberShell.tsx` | `f1e229e` | — | `4053736` | — | |
| `src/v2/today/ActivityVisibilityPreview.tsx` | ABSENT | ABSENT | ABSENT | **ABSENT** | **only on `e2aee92`** (protected prototype) |
| `src/v2/routes.tsx` | `dcd25bc` | `b279ab0` (stale) | `ef53eea` | `518ce15` (stale) | see §6 |
| `vite.config.ts` | `6787ba1` | differs | — | `0eff7fd` | PFD is **older**, reverts `/api` proxy |

---

## 5. Runtime routes

### Active routes confirmed on `origin/main` (`src/v2/routes.tsx`)

`/v2/sign-in`, `/v2/sign-up`, `/v2/welcome`, `/v2` → `today`, `/v2/today`, `/v2/challenges`, `/v2/challenges/new`, `/v2/challenges/start`, `/v2/challenges/templates`, `/v2/challenges/templates/:templateId`, `/v2/challenges/:challengeId/history`, `/v2/challenges/:challengeId`, `/v2/groups`, `/v2/groups/new`, `/v2/groups/:groupId`, `/v2/groups/:groupId/feed`, `/v2/groups/:groupId/settings`, `/v2/guide`, `/v2/guide/:activityId`, `/v2/profile`, `/v2/profile/challenges`, `/v2/preferences`, `/v2/support`, `/v2/notifications`, `/v2/operator/*`, `/v2/*` → `today`.

**V1 boundary — confirmed:** `/v2/*` is the active V2 shell (`src/App.tsx:327`); `/api/*` is the active API namespace (`src/api/apiClient.ts:22`, `api/src/apiPrefix.ts`); no `/v1` alias, redirect or fallback exists; the V2 shell is never nested inside the archived V1 `/app/*` shell.

### Route the integration must add

`/v2/challenges/discovery/:challengeId` → `V2DiscoverableChallengePreviewScreen` — source **#171**, **absent on main**. #171's `routes.tsx` delta vs main is exactly 2 lines (1 import + 1 `<Route>`). **No other route is required.**

### Routes that a wholesale transplant would INCORRECTLY remove

| Route on main | #150 `routes.tsx` | PFD `2f065546 routes.tsx` |
|---|---|---|
| `challenges/start` | **REMOVED** | kept |
| `challenges/templates` | **REMOVED** | kept |
| `challenges/templates/:templateId` | **REMOVED** | kept |
| `challenges/:challengeId/history` | **REMOVED** | **REMOVED** |
| `profile/challenges` | **REMOVED** | **REMOVED** |

---

## 6. Known defects and gaps

### F-01 — HIGH — AEC-DISC-02 (public Group → hosted Challenge preview) is **NOT** resolved by restoring #171

**Trigger:** a member who has **not** joined a discoverable (non-private) Group opens that Group's Home and clicks the CTA on a hosted Challenge card.

**Evidence (main, `21c88f6`):**
- `src/v2/groups/V2GroupHomeScreen.tsx:161` — `onOpenChallenge={(challengeId) => navigate(`/v2/challenges/${challengeId}`)}`.
- `src/v2/routes.tsx:114` — `challenges/:challengeId` → `V2CreatedChallengeScreen` (the **member** detail screen).
- `api/src/challengeReads.ts:516` — `requireChallengeVisible()` returns **404 `unknown_challenge`** unless the caller has a participation episode or live group eligibility; called from `getChallengeDetail` at `api/src/challengeReads.ts:912`/`:919`.
- `api/src/challengeReads.ts:861` — `listVisibleChallengesInGroup()` *does* serve outsiders the EOG §9 discovery projection, i.e. the **card is visible** but its **target is not authorized**.

**Evidence (#171, `7ebe03b`):** `git diff 21c88f6 7ebe03b -- src/v2/groups/V2GroupHomeScreen.tsx` — #171's diff **does not touch `onOpenChallenge`**; the line is byte-identical to main's. `git grep -n "challenges/discovery" 7ebe03b -- src` finds references only from `V2DiscoverChallengeRow.tsx:77`, `V2TodayDiscoveryRecommendations.tsx:128` and `V2DiscoverableChallengePreviewScreen.tsx:84` — **no reference from `V2GroupHomeScreen.tsx`**.

**Conclusion:** restoring #171 adds a public preview route but does **not** rewire the Group Home hosted-Challenge CTA onto it. The defect would **survive** a #171-only restoration. This is corroborated by the repo's own register, `docs/programme/TIIZI-V2-ACCEPTED-EXPERIENCE-REGISTER-001.md`, "First candidate sequence" step (5): *"fix Group Home hosted-Challenge navigation so outsiders reach the authorized discovery summary preview, preserving access controls and separate Group/Challenge joins"* — an explicit instruction that the fix is **additional to** #171.

**Severity note:** the register flags an open UX-review item on AEC-DISC-02 — *"Reconcile the bypass and approval persona; UX review remains open until the bypass is corrected and independently checked."* The fix must not create a bypass of `requireChallengeVisible`; the preview must read only the authorized discovery projection and/or the authorized member detail.

### F-02 — HIGH — #150's active-member Today preservation test is absent from #171

`src/v2/today/V2TodayScreen.discovery.dom.test.tsx` exists in #150 (blob `67fc3d0f`) and in PFD (same blob) but is **ABSENT** from #171 and from main. It is the only accepted-source test asserting the integration-level boundary "1 active Challenge ⇒ discovery heading absent" and "discovery renders before the zero-state card". Impact: a #171-only restoration delivers AEC-TODAY-01 but leaves AEC-TODAY-03 (existing-member Together/Race/Streak Today) **unguarded**.

### F-03 — HIGH — `scripts/testMobilePrimaryNavGuards.ts` on `origin/main` is **already failing** against main's own routes

The guard extracts the member route set from `src/v2/routes.tsx` and asserts exact equality with a hard-coded `expectedMember` array (`scripts/testMobilePrimaryNavGuards.ts:125–140`):

```
ACTUAL  : [20 routes]
EXPECTED: [14 routes — missing challenges/start, challenges/templates,
          challenges/templates/:templateId, challenges/:challengeId/history,
          profile/challenges, support]
MATCH   : false
```

A second assertion is also stale: `check('creation activity step links to the Activity Guide', /to="\/v2\/guide"/.test(wizard))` — on main the link has moved to `src/v2/challenges/wizardSteps/ActivitiesStep.tsx:99`. **#171's version of the guard script corrects both.** The integration must land #171's guard-script route list and the new route **atomically**.

*Note: this Guardian session could not execute the guard because `node_modules` was absent. The baseline was proven by replaying the guard's own extraction logic against main's `routes.tsx`. The implementation agent subsequently installed dependencies and confirmed the same two failures by direct execution.*

### F-04 — MEDIUM — `V2TodayDiscoveryRecommendations.tsx` has three divergent accepted versions; none is a superset of both

| Version | Blob | Adds |
|---|---|---|
| #150 | `0aa137f` | base recommendation surface |
| PFD `2f065546` | `3b80994` | **renders `V2ChallengeCover` on each recommended Challenge card** (photo-led); `p-3` padding |
| #171 | `c8c0b3f` | `discoveryCaption` lines, tightened `groupPaginationStalled`, `returnTo` on "View Group" — **but drops the `V2ChallengeCover` thumbnail** |

The PFD branch is a **descendant of #150**, so its cover work is layered on #150's discovery, whereas #171 is an independent line. **A merge decision is required**: the accepted photo-led cover presentation (AEC-GROUP-08) and the accepted `discoveryCaption` + `returnTo` behaviour (#171) are on diverging branches.

### F-05 — MEDIUM — Recent Activity (AEC-ACT-04) and Share (AEC-SHARE-05) are fixture-only prototypes, absent from main

- `src/v2/today/ActivityVisibilityPreview.tsx` (147 lines) exists **only** on `e2aee92`; it is **absent** from `origin/main`, #150, #171 and PFD `2f065546`.
- AEC-ACT-04 register row: *"IMPLEMENTED **fixture-only**; TESTED build only, **DOM assertions failed before execution**; MERGED no; PREVIEW VERIFIED: UNKNOWN"* — *"Preserve exact UX; connected personal read model/history navigation remain separate integration."*
- AEC-SHARE-05 register row: *"IMPLEMENTED **local UI only** … Recover UI; **server publishing/withdrawal not evidenced**. Preserve Group Feed automatic-only boundary."*
- `docs/programme/TIIZI-V2-FOUNDER-WALKTHROUGH-DECISION-2026-11-16.md:27`: *"Keep accepted activity timeline and sharing UI **protected** in the accepted-work queue."*

**Conclusion:** Recent Activity and Share are **protected prototype sources**. They must be preserved verbatim, must **not** be redesigned, and must **not** be described as connected functionality. They are **out of scope** for AEC-004.

### F-06 — LOW — PFD's `vite.config.ts` and `V2ProfileScreen.tsx` are **older** than main

PFD `vite.config.ts` replaces main's `import { API_PREFIX } from './api/src/apiPrefix';` + `[API_PREFIX]:` proxy key with a literal `'/api':`, which would **regress** the canonical API-namespace correction. Main's `6787ba1` must be kept. Main's `V2ProfileScreen.tsx` is +22/−5 vs PFD and carries the merged Profile/Challenge-history work.

### F-07 — LOW — #171's diff vs main **deletes five programme documents**

`git diff 21c88f6 7ebe03b -- docs/` removes `TIIZI-V2-ACCEPTED-EXPERIENCE-REGISTER-001.md` (−49), `TIIZI-V2-APPROVED-EXPERIENCE-CONTINUITY-001.md` (−166), `TIIZI-V2-FOUNDER-WALKTHROUGH-DECISION-2026-11-16.md` (−29), and both AEC-003 proposal files (−26, −24). These exist on main because PR #172/#173 merged after #171's base. A wholesale merge of #171 would **delete the governing register, the continuity procedure and the dated Founder decision record** that AEC-004 itself operates under. The integration must restore **source files only**, never #171's `docs/` delta.

### F-08 — INFO — Runtime identity was **UNKNOWN** at G1

No served runtime/preview identity was captured for any accepted source. The register records `PREVIEW VERIFIED: UNKNOWN` for every row. Carried forward as a limitation to be closed at G2.

### F-09 — INFO — `getChallengeV2` is not a literal export name

`git grep "export async function getChallengeV2" 21c88f6 -- src/api` returns nothing; the client call is referenced from `src/v2/challenges/useChallengeCreation.ts`. Cosmetic — noted so the G2 reviewer does not treat the empty grep as a missing file.

---

## 7. Integration risks

### Actual conflict overlap (files touched by main, #171 and `2f065546`)

**#171 ∩ PFD (15 files):** the five `docs/programme/` governance documents, `scripts/previewFounder.ts`, `src/v2/challenges/V2DiscoverableChallengePreviewScreen.dom.test.tsx`, `src/v2/challenges/V2DiscoverableChallengePreviewScreen.tsx`, `src/v2/groups/V2GroupHomeScreen.tsx`, `src/v2/routes.tsx`, `src/v2/today/V2TodayDiscoveryRecommendations.dom.test.tsx`, `src/v2/today/V2TodayDiscoveryRecommendations.tsx`, `src/v2/today/V2TodayScreen.tsx`, `src/v2/today/todayDiscovery.test.ts`, `src/v2/today/todayDiscovery.ts`.

**#150 ∩ #171 (18 files):** the same set plus `scripts/previewS5bSeed.ts` and `src/v2/challenges/V2DiscoverChallengeRow.tsx`.

**#150 ∩ PFD (63 files):** additionally `api/**` (10 files), `src/v2/profile/**`, `src/v2/media/useLocalImagePreview.ts`, `src/v2/challenges/V2LoggingSection.tsx`, `src/v2/challenges/V2ChallengeCard.tsx`, `src/v2/challenges/V2ChallengeCreationWizard.tsx`, `vite.config.ts`, `package.json` — i.e. #150's base is so far behind main that its "diff vs main" is dominated by unrelated regressions.

### Correction to the briefing's expected overlap list

- `src/v2/profile/V2ProfileScreen.tsx` — touched by **PFD and #150**, **not by #171**.
- `src/v2/preferences/ProfilePreferencesSection.tsx` — main and PFD blobs are **identical**; no conflict exists. This is a false overlap.
- `vite.config.ts` — touched by **PFD and #150**, **not by #171**.
- The genuine triple-overlap is the **15 files** listed above.

### Assessment: is selective restoration feasible without wholesale merging?

**YES — feasible, with four mandatory constraints.**

| # | Constraint | Rationale |
|---|---|---|
| 1 | **Never take `routes.tsx` from #150 or PFD.** Use #171's 2-line delta applied to main's file. | #150/PFD routes files delete 3–5 live merged routes. |
| 2 | **Never take `docs/` from any branch.** | #171's `docs/` delta is a base-staleness artefact that deletes the governing register. |
| 3 | **Never take `vite.config.ts` or `V2ProfileScreen.tsx` from PFD.** | PFD is older on both. |
| 4 | **Never take `V2TodayScreen.tsx` from #150.** Apply only the discovery insert. | #150 reverts the accepted Challenge entry choice. |

**Low-conflict, high-confidence restorations:** `routes.tsx` (#171 delta, 2 lines); `todayDiscovery.ts` and `todayDiscovery.test.ts` (byte-identical in all three); `useChallengeCreation.ts`; `V2DiscoverChallengeRow.tsx`; `MemberShell.tsx`; `V2GroupHomeScreen.tsx` (#171 `returnTo` hunk vs PFD cover hunk touch **disjoint regions**, but F-01's CTA rewiring must land in the same file); `V2TodayScreen.discovery.dom.test.tsx` and `challengeDiscovery.test.ts` (byte-identical in #150 and PFD; pure additions).

**Higher-conflict restorations requiring a merge decision, not a merge:** `V2TodayDiscoveryRecommendations.tsx` (3 divergent blobs — F-04); `V2TodayScreen.tsx` (4 divergent blobs); `V2DiscoverableChallengePreviewScreen.tsx` (#171's 96-line version is a strict superset, so #171 is the correct base); `V2GroupsScreen.tsx` + the three new PFD group files (pure additions / self-contained row replacement); `scripts/previewFounder.ts` and `scripts/previewS5bSeed.ts` (PFD's `previewFounder.ts` predates main's preview-foundation work, so **#171's** delta is the correct base).

**Conclusion:** selective restoration is feasible and low-risk **only** as a hand-authored file-level transplant. Any `git merge` of #150 or PFD is contraindicated. This is consistent with the register's instruction: *"No divergent branch is to be wholesale merged."*

---

## 8. Missing functionality the integrated candidate would still not deliver

1. **AEC-DISC-02 remains open** unless an *additional* change is written (F-01).
2. **AEC-ACT-04 — Recent Activity ("Your activity today").** Absent; only source is the fixture-only prototype at `e2aee92`. No connected personal activity read model, no history navigation. Out of AEC-004 scope.
3. **AEC-SHARE-05 — Share to Challenge / Keep private.** Absent as connected functionality; server publishing/withdrawal not evidenced. Group Feed automatic-only boundary must be preserved.
4. **AEC-CF-07 — Challenge participant count and Challenge Feed illustrative cards.** Connected participant count and a Challenge Feed read remain a separate integration.
5. **AEC-SHARE-06 — external Copy Link / native sharing, separate "Log Another" / "Done".** No connected evidence.
6. **Persistent image/cover storage.** All accepted image work is **browser-tab-local only** (in-memory `File` maps, cleared on reload). AEC-IMG-09: *"Do not claim persistent uploads."*
7. **"Discover what fits you" matched recommendations require a saved preference set.** Without preferences the block shows eligible-unmatched fallback rows with honest captions. Correct behaviour, but it must not be represented as "recommended for you".
8. **Runtime/preview identity** is UNKNOWN until G2 captures the exact served SHA, data and URL (F-08).

---

## 9. Explicit limitations of this receipt

1. **No test execution in the Guardian session.** `node_modules` was absent; the F-03 guard mismatch was proven by replaying the guard's own extraction logic, not by running the script.
2. **No served runtime/preview identity.** No emulator, API or Founder Preview was started.
3. **No PostgreSQL/API-level verification.** `api/test/**` was not executed.
4. **Third-party PR metadata beyond `gh pr view` was not consulted** — no PR reviews, comments or CI runs were read.
5. **The pre-existing dirty state of the primary checkout was neither inspected in full nor modified.**
6. **The integration worktree was not built or tested** by the Guardian.

*Post-receipt note from the implementation agent: dependencies were subsequently installed in the integration worktree and the F-03 baseline was confirmed by direct execution — the two failures (`creation activity step links to the Activity Guide`, and the exact-route-set assertion) reproduce on clean `origin/main`. Both are corrected by the candidate.*

---

**This receipt certifies checkpoint G1 only.** It does not certify G2, does not approve any merge, deployment or implementation, and does not accept any product UX. Per `TIIZI-AEC-004-COVERAGE-ACTIVATION-001.md` §2, G3 and G4 remain `UNVERIFIED — OWNER NOT ASSIGNED`.

**VERDICT: G1 PASS WITH EXPLICIT LIMITATIONS**
