# TIIZI — AEC-004 Completion Report

**Prepared:** 2026-11-18
**Authority:** Founder / Technical Lead, AEC-004 "Integrated Founder Experience Recovery"
**Status:** COMPLETE FOR FOUNDER BROWSER ACCEPTANCE — STOPPED BEFORE MERGE
**Candidate:** `integration/aec-004-founder-experience-recovery-001` — **shipped-app SHA `3f1ed8e4ef64124e2b704490626a97a6c6ce9393`** · **candidate head `976b60a9829a6b452bb72343f746e29ce7bec1e2`** (adds only the routing behavioural test, two guard corrections and programme records; `git diff 3f1ed8e HEAD -- src` shows **only the new test file** — no shipped app code changed)
**Base:** `origin/main` @ `21c88f681427172fdc2150f3122e6cce6b90a63e`
**Integration PR:** [#174](https://github.com/Fkenogo/tiizi_challenges/pull/174) — **DRAFT, open, not merged**

---

## 1. START-01 receipt

| Item | Value |
| --- | --- |
| Fetch | `git fetch origin --prune` from `/Volumes/PRODUCTION/Projects/tiizi_revamp` |
| Resulting `origin/main` | `21c88f681427172fdc2150f3122e6cce6b90a63e` ("Merge pull request #173 … AEC-003 continuity activation") |
| Baseline SHA stated in the task | `21c88f681427172fdc2150f3122e6cce6b90a63e` — **matched exactly** |
| Primary checkout | `/Volumes/PRODUCTION/Projects/tiizi_revamp`, local `main` @ `5a012396700fde9aee8aa2b72663a2c7e5564bd3`, **strict ancestor** of `origin/main` (`git rev-list --left-right --count origin/main...main` → `673  0`; zero local-only commits) |
| Primary checkout dirty state | **116 entries** (36 tracked modifications + 80 untracked), in `src/features` (21), `src/services` (5), `docs/ui-reference`, `docs/programme`, `docs/reports`, `src/hooks`, and root `verify_*.txt` / `validate_*.txt` scratch files |
| Primary checkout handling | **Never modified.** Only read-only commands (`fetch`, `show`, `log`, `ls-tree`, `grep`, `diff`, `merge-base`, `cat-file`, `worktree list`) were run against it. `git fetch` updates remote-tracking refs only. |
| Integration worktree | `.worktrees/aec-004-integration` — fresh, created from `origin/main`, branch `integration/aec-004-founder-experience-recovery-001`. The pre-existing dirty checkout was not used as a base. |
| Active PRs at START-01 | #150 OPEN (head `3aa0147d558eeba8371cd4cccffcbbc2326dd02f`, CONFLICTING), #171 **DRAFT** OPEN (head `7ebe03ba5ffaeed5c21b109137a94c7630b18e8c`, MERGEABLE), #145 DRAFT, #143, #107, #94 |
| Accepted implementation references | PR #150 `3aa0147`; PR #171 `7ebe03b`; PFD Group/Today `2f065546dd7051b5c6401e52da897b8c82d6cc93`; PFD Today-cover `38d7bf906e5ff5c91542be7c72bd34d98cd9e0b9`; PFD Activity/Share `e2aee9239d42e6f92a66c22e4fcbbb97595c9521`; merged Package A `4829787343b5811e085db755286b7e447e18b9ac` (PR #168); merged image/Profile `ae089c09f89f7acec77935a8d5bda93a6404ffce` (PR #167) |
| Documents read | `AGENTS.md`, `docs/programme/TIIZI-V2-APPROVED-EXPERIENCE-CONTINUITY-001.md` (AEC-001), `docs/programme/TIIZI-V2-ACCEPTED-EXPERIENCE-REGISTER-001.md`, `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (v2.95), `docs/programme/TIIZI-FEF-TLC-001-TEAM-ACTIVATION.md`, `docs/programme/TIIZI-AEC-003-TEMPORARY-{PROGRAMME-CONTROLLER,GUARDIAN}-PROPOSAL.md`, `docs/programme/TIIZI-V2-FOUNDER-WALKTHROUGH-DECISION-2026-11-16.md`, `docs/reports/TIIZI-PFD-V2-EXPERIENCE-HANDOVER-001.md`, `docs/reports/TIIZI-PFD-ACTIVITY-VISIBILITY-003-FOUNDER-ACCEPTANCE-AND-ENGINEERING-HANDOVER.md` |
| Preview identity | See §9 |

## 2. Programme Controller assignment and inventory

| Item | Value |
| --- | --- |
| Assignment | PC-1 — Programme Controller, delegated session `mvs_f9ea2109d03c4da99a232afab18e45d8` (task `bg_759ba119-75a1-4355-90f0-d42a2f5b0d7c`, role `worker`) |
| Assigning authority | Founder / Technical Lead, AEC-004 task instruction, recorded under the existing AEC-003 activation process |
| Effective / expiry | From 2026-11-18; expires on delivery of this completion report, or on explicit revocation |
| Deliverable | `docs/programme/TIIZI-AEC-004-ACCEPTED-INVENTORY-001.md` |
| Recorded activation | `docs/programme/TIIZI-AEC-004-COVERAGE-ACTIVATION-001.md` §2 |
| Inventory content | All eleven canonical register rows (AEC-TODAY-01, AEC-DISC-02, AEC-TODAY-03, AEC-ACT-04, AEC-SHARE-05, AEC-SHARE-06, AEC-CF-07, AEC-GROUP-08, AEC-IMG-09, AEC-HDR-10, AEC-LOG-11), each with accepted source SHA + branch, presence on `origin/main`, the AEC-004 candidate source, integration state, protected obligation and evidence reference; plus the explicit #150-vs-#171 delta, the protected Recent Activity / Share obligations, the remaining integration queue, the preserved/do-not-regress list, and the open PR inventory |
| Key inventory findings | (a) `#150`-only at risk of loss: `V2TodayScreen.discovery.dom.test.tsx` and `challengeDiscovery.test.ts` — restored; (b) `#150`'s `routes.tsx` deletes five live merged routes — not taken; (c) `#171`'s `returnTo` does **not** fix the public Group Home → hosted Challenge path — the register's own candidate step (5) requires an additional fix; (d) `#150` lacks the image/Profile files a wholesale merge would delete — not taken |

## 3. Guardian assignment and G1 / G2 receipts

| Item | Value |
| --- | --- |
| Assignment | CG-1 — Code Lifecycle Guardian, delegated session `mvs_fdd3933c49f945d5bfae63ec7d41bac7` (role `verifier`, read-only). G1 task `bg_87137a5e-9f1d-475b-8496-be653230ddb2`; G2 continuation task `bg_3e3893d4-be00-4c0a-9fc8-1e400b983b60` |
| Independence | **Confirmed.** A distinct read-only session, not the implementation agent, no file modified and no write git command run. |
| G1 receipt | `docs/programme/TIIZI-AEC-004-G1-GUARDIAN-RECEIPT-001.md` — **G1 PASS WITH EXPLICIT LIMITATIONS** |
| G1 material findings | **F-01 (HIGH)** AEC-DISC-02 is *not* resolved by restoring #171 — the defect would survive a #171-only restoration; **F-02 (HIGH)** #150's active-member Today preservation test is absent from #171; **F-03 (HIGH)** `scripts/testMobilePrimaryNavGuards.ts` was *already failing* on clean `origin/main`; **F-04 (MEDIUM)** three divergent accepted versions of `V2TodayDiscoveryRecommendations.tsx` with no superset; **F-05 (MEDIUM)** Recent Activity and Share are fixture-only prototypes; **F-06/F-07 (LOW)** PFD's `vite.config.ts`/`V2ProfileScreen.tsx` are older than main, and #171's `docs/` delta deletes the governing register |
| G2 receipt | See §8 |
| G3 / G4 | `UNVERIFIED — OWNER NOT ASSIGNED`. Not activated by AEC-004. |

## 4. Integration PR and exact head

| Item | Value |
| --- | --- |
| PR | [#174 — AEC-004: Integrated Founder Experience Recovery (V2 member experience)](https://github.com/Fkenogo/tiizi_challenges/pull/174) |
| State | **DRAFT · OPEN · MERGEABLE · NOT MERGED** |
| Head | **shipped-app SHA** `3f1ed8e4ef64124e2b704490626a97a6c6ce9393` · **candidate head** `976b60a9829a6b452bb72343f746e29ce7bec1e2` (adds the routing behavioural test, two guard corrections and programme records; no shipped app code changed) |
| Branch | `integration/aec-004-founder-experience-recovery-001` (pushed) |
| Base | `main` @ `21c88f681427172fdc2150f3122e6cce6b90a63e` |
| Commits | `326f4c9` implementation · `9c94f7e` programme records · `3f1ed8e` Group cover-photo wiring fix · `de0106a` routing behavioural test + two guard corrections + adjudication · `976b60a` completion report and reviewer dispositions |
| Behaviour delta `326f4c9` → `9c94f7e` | **none** — `git diff --name-only 326f4c9 9c94f7e -- src api scripts` is empty. The only difference is one added `docs/programme/*.md` record. |
| Behaviour delta `9c94f7e` → `3f1ed8e` | **2 files, 4 lines** — the Group cover-photo wiring fix (§6.1). Both hunks are the PFD branch's own content. |

## 5. Accepted-source comparison

### 5.1 What #150 has that #171 does NOT (verified by blob identity)

| Item | #150 blob | #171 | Disposition |
| --- | --- | --- | --- |
| `src/v2/today/V2TodayScreen.discovery.dom.test.tsx` | `67fc3d0f` | **ABSENT** | **Restored.** The only accepted-source test asserting the AEC-TODAY-03 integration-level boundary ("1 active Challenge ⇒ discovery heading absent" and "discovery renders before the zero-state card"). A #171-only restoration leaves AEC-TODAY-03 unguarded. |
| `src/v2/challenges/challengeDiscovery.test.ts` | present | **ABSENT** | **Restored.** Pins `lifecycleBucket()` semantics. |
| `src/v2/today/todayDiscovery.ts`, `todayDiscovery.test.ts` | `25e7daad` / `34bbe404` | identical | No difference either way. |

### 5.2 What #171 has that #150 does NOT

#171's `V2DiscoverableChallengePreviewScreen.tsx` (96 lines) is a **strict superset** of #150's (56 lines): member-detail fallback, pagination-stall detection and the separate Challenge Join gated on membership and live state. #171 also uniquely carries `V2GroupHomeScreen.tsx` `returnTo`, `MemberShell.tsx` clean header (AEC-HDR-10), `useChallengeCreation.ts` `enabled` gate, and `V2DiscoverChallengeRow.tsx` "Preview Challenge".

### 5.3 What neither #150 nor #171 contains (PFD only)

`V2GroupPhotoCard.tsx`, `V2GroupCover.tsx`, `V2GroupCover.dom.test.tsx`, `localGroupCoverPreviews.ts`, `V2GroupsScreen.tsx`, `V2GroupDiscoveryPanel.tsx`, `V2TodayScreen.challengeCovers.dom.test.tsx`, and the cover-card presentation inside `V2TodayScreen.tsx` — the accepted Group listing / Group detail / Group Hub and Today/Challenge card presentation (AEC-GROUP-08). **Restored from `2f065546`.**

### 5.4 Per-file provenance of the candidate (blob-identical vs composed)

| Candidate file | Byte-identical to | Composed / authored |
| --- | --- | --- |
| `scripts/previewFounder.ts`, `scripts/previewS5bSeed.ts`, `scripts/testMobilePrimaryNavGuards.ts`, `scripts/testV2DiscoveryGuards.ts` | #171 | — |
| `scripts/testS4aGroupHomeGuards.ts` | — | **Composed:** three assertions updated to the accepted photo-led presentation (see §8) |
| `src/v2/routes.tsx` | #171 (+2-line delta onto main) | — |
| `src/v2/member/MemberShell.tsx` | #171 | — |
| `src/v2/challenges/useChallengeCreation.ts`, `V2DiscoverChallengeRow.tsx` | #171 | — |
| `src/v2/challenges/V2DiscoverableChallengePreviewScreen.tsx` + `.dom.test.tsx` | #171 | — |
| `src/v2/today/todayDiscovery.ts`, `todayDiscovery.test.ts` | #150 = #171 = PFD (identical) | — |
| `src/v2/today/V2TodayDiscoveryRecommendations.dom.test.tsx` | #171 | — |
| `src/v2/challenges/challengeDiscovery.test.ts` | #150 = PFD (identical) | — |
| `src/v2/today/V2TodayScreen.discovery.dom.test.tsx` | #150 = PFD (identical) | — |
| `src/v2/today/V2TodayScreen.tsx` | PFD (= main + discovery block + cover cards) | — |
| `src/v2/groups/V2GroupPhotoCard.tsx`, `V2GroupCover.tsx`, `V2GroupCover.dom.test.tsx`, `localGroupCoverPreviews.ts`, `V2GroupsScreen.tsx`, `V2GroupDiscoveryPanel.tsx` | PFD | — |
| `src/v2/groups/V2CreateGroupScreen.tsx`, `src/v2/groups/V2GroupGlobalSearch.tsx` | PFD (2 files, 4 lines) | **Restored in `3f1ed8e` after the Independent Code Reviewer found the photo path was never wired** — see §6.1 |
| `src/v2/today/V2TodayScreen.challengeCovers.dom.test.tsx` | PFD | — |
| `src/v2/today/V2TodayDiscoveryRecommendations.tsx` | — | **Composed:** #171 `discoveryCaption` + tightened pagination-stall detection + `returnTo` state, **plus** the PFD `V2ChallengeCover` thumbnail (resolves Guardian F-04) |
| `src/v2/groups/V2GroupHomeScreen.tsx` | — | **Composed:** main + PFD cover hero + #171 `returnTo` journey + the AEC-DISC-02 fix |
| `docs/programme/TIIZI-AEC-004-*.md` (4 files) | — | **Authored** programme records |

### 5.5 Sources deliberately NOT taken

| Source | Reason |
| --- | --- |
| #150 `src/v2/routes.tsx` | Deletes five live merged routes (`challenges/start`, `challenges/templates`, `challenges/templates/:templateId`, `challenges/:challengeId/history`, `profile/challenges`) |
| #150 `src/v2/today/V2TodayScreen.tsx` | Reverts the accepted Challenge entry choice from `/v2/challenges/start` to `/v2/challenges/new` |
| #150 / PFD `src/v2/routes.tsx` | Same route deletions; PFD additionally removes `challenges/:challengeId/history` and `profile/challenges` |
| #171 `docs/` delta | Would delete the Accepted Experience Register, the AEC-001 continuity procedure, the dated Founder decision record and both AEC-003 proposals that AEC-004 itself operates under |
| PFD `vite.config.ts` | Older; reverts the canonical `API_PREFIX` proxy correction |
| PFD `src/v2/profile/V2ProfileScreen.tsx` | Older; main carries the merged Profile / Challenge-history work |
| PFD `src/v2/media/useLocalImagePreview.ts` | Older than main |
| PFD `scripts/previewFounder.ts` | Predates main's preview-foundation work; #171's additive delta was used instead |
| PFD `src/v2/preferences/ProfilePreferencesSection.tsx`, `V2HostedChallengeCard.tsx`, `V2ChallengeCover.tsx`, `localChallengeCoverPreviews.ts`, `templates/templateAdoption.ts` | Byte-identical to main — no action needed |
| Activity/Share prototype `e2aee92` | Fixture-only; protected, not connected (see §11) |

## 6. Restored functionality

| # | Accepted behaviour | Source | Restored as |
| --- | --- | --- | --- |
| 1 | New-member Today recommendations, Interests/Goals ranking and broader fallback | #150 / #171 / PFD | `todayDiscovery.ts`, `V2TodayDiscoveryRecommendations.tsx`, discovery block in `V2TodayScreen.tsx` |
| 2 | Public Group and Challenge discovery | #171 / PFD | Groups → Discover tab; `useV2GroupDiscovery` / `useV2ChallengeDiscovery` surfaces |
| 3 | Public hosted-Challenge preview without requiring Group membership | #171 + **new fix** | `/v2/challenges/discovery/:challengeId` + `V2DiscoverableChallengePreviewScreen.tsx` + the CTA rewiring in `V2GroupHomeScreen.tsx` |
| 4 | Separate Group and Challenge joining | #171 | Group join on the Group surface; Challenge join on the Challenge surface, gated on membership and live state |
| 5 | Accepted Group listing, detail and Group Hub presentation | PFD `2f065546` | `V2GroupPhotoCard`, `V2GroupCover`, `localGroupCoverPreviews`, `V2GroupsScreen`, `V2GroupDiscoveryPanel`, `V2GroupHomeScreen` hero |
| 6 | Accepted Today and Challenge card/cover presentation | PFD `2f065546` | `V2ChallengeCover` thumbnails across Today cards, required-today, active-challenge, opportunity and discovery cards |
| 7 | Clean authenticated member header | #171 | `MemberShell.tsx` — notifications + Profile only |

### 6.1 The Group cover-photo wiring fix (found by the Independent Code Reviewer)

The accepted photo-led Group presentation was first transplanted **without the two wiring points that make it live**: the PFD branch's `V2CreateGroupScreen.tsx` stores the cover photo chosen during Group creation in the tab-local Group cover preview map, and its `V2GroupGlobalSearch.tsx` renders the accepted `V2GroupCover` on Group search results instead of the old gradient placeholder. Without the first, a cover photo chosen at Group creation was **silently discarded** and the Group surfaces fell back to the gradient — so the "photo-led Group presentation" was only partially delivered.

Both were restored verbatim from the PFD branch (`2f065546dd7051b5c6401e52da897b8c82d6cc93`); no new design:

| File | Change |
| --- | --- |
| `src/v2/groups/V2CreateGroupScreen.tsx` | +2 lines — import `setLocalGroupCoverPreview`; call `if (coverPhoto.file) setLocalGroupCoverPreview(created.id, coverPhoto.file);` after Group creation |
| `src/v2/groups/V2GroupGlobalSearch.tsx` | 2 lines — render `<V2GroupCover …/>` on Group search results instead of the gradient placeholder |

Verified end to end in the running preview: a Group created with a cover photo renders `data-local-cover="true"` with the selected image on the Group page, and the same photo appears on the Groups listing under client-side navigation. The accepted tab-local limit is unchanged — a **full page reload clears the photo**, exactly as the accepted design specifies. Cover photos remain non-persistent; AEC-IMG-09 still forbids claiming persistent uploads.

A systematic sweep of every `origin/main` ↔ PFD difference confirmed the other PFD changes that were **not** taken are genuinely **newer on main** (Package A and PR #167 work): `V2LoggingSection.tsx` (Package A's `resolveLoggingOccurredAt` immediate-logging precision), `V2ChallengeCard.tsx`, `V2ChallengeCreationWizard.tsx` (PR #167 cover-draft safety), `V2FinalizedStreakResult.tsx`, `useLocalImagePreview.ts`, `profileView.ts`, and all `api/**` files.

### The AEC-DISC-02 fix (the only new behaviour authored)

`src/v2/groups/V2GroupHomeScreen.tsx` now routes the hosted-Challenge CTA to `/v2/challenges/discovery/:challengeId` when the viewer is **not** a Group member or steward, and keeps `/v2/challenges/:challengeId` for members and stewards.

- Membership test: `view.detail.viewerRelationship === 'member' || view.detail.viewerRelationship === 'steward'`.
- **No API file was modified** — `git diff --stat 21c88f6 9c94f7e -- api/` is empty. `requireChallengeVisible` (`api/src/challengeReads.ts:516`) remains the server authorization boundary and still answers `404` for an unauthorized Challenge read.
- The `returnTo` state is regex-anchored `^/v2/challenges/discovery/[^/]+$` and cannot be used as an open redirect.
- The preview reads only the authorized discovery projection and, for members, the authorized member detail.

## 7. Preserved / do-not-regress

| Preserved item | Evidence |
| --- | --- |
| Merged Package A activity-logging corrections | 118 activities (84 fitness, 34 wellness) seeded and reconciled; `resolveLoggingOccurredAt` timestamp precision and friendly-error surface unchanged (`src/v2/challenges/V2LoggingSection.tsx` untouched) |
| Current image selection | `src/v2/media/V2LocalImagePicker.tsx`, `useLocalImagePreview.ts`, `localChallengeCoverPreviews.ts` unchanged; Group cover previews added alongside them |
| Profile and template functionality | `src/v2/profile/V2ProfileScreen.tsx`, `src/v2/preferences/ProfilePreferencesSection.tsx`, `src/v2/challenges/templates/*` unchanged |
| Existing-member Together/Race/Streak Today | Verified in the running preview: "3 active Challenges", "1 Streak needs you today", Do today / Streak / Race / Together all present; discovery block absent |
| Server access controls and private-content restrictions | No `api/` file modified |
| Accepted Challenge entry choice | `/v2/challenges/start` retained (not #150's `/v2/challenges/new`) |
| Live merged routes | All of `challenges/start`, `challenges/templates`, `challenges/templates/:templateId`, `challenges/:challengeId/history`, `profile/challenges`, `support` retained, plus the new discovery route |
| V1 boundary | `/v2/*` shell and `/api/*` namespace unchanged; no `/v1` alias introduced |

## 8. Test and independent review results

### 8.1 Focused tests and build on the exact candidate

| Check | Result |
| --- | --- |
| `npx tsc -b` | **PASS** (clean) |
| `npm run build` | **PASS** (Vite build succeeded; only the pre-existing Browserslist / large-chunk warnings) |
| `npx vitest run` | **PASS — 34 files, 241 tests, 0 failures** |
| `npx tsx scripts/testMobilePrimaryNavGuards.ts` | **PASS** (all passing) |
| `npx tsx scripts/testV2DiscoveryGuards.ts` | **PASS** (all passing) |
| `npx tsx scripts/testS4aGroupHomeGuards.ts` | **PASS** (all passing) |
| `npx tsx scripts/testV2PreferencesGuards.ts` | **PASS** (all passing) |
| `npx tsx scripts/testV2ProfileGuards.ts` | **PASS** (all passing) |
| `npx tsx scripts/testGroupsFounderFinalPass.ts` | **PASS** (now passing — it failed identically on clean `origin/main` and was corrected in `de0106a`, see §8.6 R-10) |
| `npx tsx scripts/testGroupUxPolish.ts`, `test:v2-group-details`, `test:gf04-group-feed`, `test:v2-triage` | **PASS** |

### 8.2 Full root suite: baseline vs candidate (all 66 `test:*` scripts)

Every script was executed on clean `origin/main` (`21c88f6`) and on the candidate, comparing **exit codes**.

| | Baseline `21c88f6` | Candidate (final) |
| --- | --- | --- |
| Scripts passing | 55 | **61** |
| Scripts failing | 11 | **5** |

- **No script regressed** (PASS → FAIL: **none**).
- The candidate **repairs** `test:mobile-primary-nav`, which failed on clean main with two assertions (Guardian finding F-03).
- The candidate **also repairs** `test:groups-founder-final-pass`, which failed on clean main with the stale "About this Group closes on Escape" assertion (both reviewers independently confirmed it failed identically on main; the correction is recorded as R-10 in §8.6).
- Four baseline failures (`test:challenge-creation-backend`, `test:knowledge-authority-backend`, `test:functions-pg-authority-bridge`, `test:group-invite-backend`) were artifacts of the baseline harness's symlinked `node_modules`; the candidate runs them for real and they **pass**.
- The five remaining failures are **identical on clean `origin/main` and on the candidate**, and are outside the AEC-004 restore scope: `test:challenge-creation-6combos`, `test:s3a-participation-experience`, `test:s3b-activity-logging`, `test:s3c-live-progress`, `test:group-lifecycle`. **None was introduced by AEC-004 and none was masked or silently fixed.**
- Guard assertion count for `test:s4a-group-home` versus clean main: **164 → 174**, with **nothing removed**.

### 8.3 Guardian G2 receipt

See §8.5.

### 8.4 Independent Code Reviewer

| Item | Value |
| --- | --- |
| Assignment | Independent Code Reviewer — delegated session `mvs_6c25bf4de89c41f29b005776d17a1da9` (task `bg_0a6e2951-577e-408d-aa18-9211d3a91704`, role `verifier`, read-only) |
| Separation | A distinct session from both the implementation agent and the Guardian, as required by AEC-001 §7 and FEF-TLC-001 |
| Verdict | See §8.5 |

### 8.5 Verdicts

| Checkpoint | Verdict | Receipt |
| --- | --- | --- |
| **Guardian G1** (before implementation) | **G1 PASS WITH EXPLICIT LIMITATIONS** | `docs/programme/TIIZI-AEC-004-G1-GUARDIAN-RECEIPT-001.md` |
| **Guardian G2** (against the exact candidate and running preview) | **G2 PASS WITH EXPLICIT LIMITATIONS** | Guardian session `mvs_fdd3933c49f945d5bfae63ec7d41bac7`, G2 task `bg_0f4289e8-f6dd-4c25-a924-54b615fc74a2` |
| **Independent Code Reviewer** | **APPROVE WITH REQUIRED CORRECTIONS** — all three corrections have since been made and re-verified | Independent session `mvs_6c25bf4de89c41f29b005776d17a1da9`, task `bg_0a6e2951-577e-408d-aa18-9211d3a91704` |

**Guardian G2 headline results** (independent, read-only, against the live preview): runtime identity confirmed by serving-process CWD plus candidate-only module markers served over HTTP; the DB marker matched exactly; tsc/build clean and **236/236 vitest** passing; **0 of 6 guards newly failing**; `api/` byte-identical to main; Package A's `V2LoggingSection.tsx` a **three-way byte-identical** match to main and Package A; the #150-only accepted guard tests present by blob identity; `V2TodayDiscoveryRecommendations.tsx` confirmed to carry **both** the #171 and PFD accepted behaviours; all seven live merged routes still present; the **Group cover photo path proven live end to end** in the browser; Recent Activity and Share prototypes confirmed **absent** with **no** Activity History / Challenge Feed publishing / withdrawal backend; the AEC-DISC-02 non-member path confirmed to land on `/v2/challenges/discovery/<id>` while the member path still lands on `/v2/challenges/<id>`.

### 8.6 Reviewer findings and dispositions

Every finding raised by the two independent reviewers is recorded below with its disposition. **None was dismissed or masked.**

| # | Reviewer finding | Severity | Disposition |
| --- | --- | --- | --- |
| R-1 | **Group cover photos could never render** — the accepted photo-led Group presentation was transplanted without the two wiring points that make it live (`V2CreateGroupScreen` never stored the chosen photo; `V2GroupGlobalSearch` still showed the gradient placeholder) | MAJOR (Independent Reviewer) | **FIXED in `3f1ed8e`** — both restored verbatim from the PFD branch (4 lines, 2 files). Independently re-verified by the Guardian G2 receipt *and* by a targeted browser check: the cover renders `data-local-cover="true"` with the selected image on the Group page and on the Groups listing, and a full reload clears it exactly as the accepted tab-local design specifies. |
| R-2 | **The one newly authored behaviour (AEC-DISC-02 routing) had no behavioural test** — it was protected only by source-text regex matching, which would still pass if the branch were inverted | MAJOR (Independent Reviewer) | **FIXED in `de0106a`** — new `src/v2/groups/V2GroupHomeScreen.routing.dom.test.tsx` with 5 cases: non-member → discovery preview; pending applicant → no hosted Challenge offered at all (that read is gated upstream) and no navigation; member → existing member route; steward → existing member route; and the invariant that a non-member never reaches the member route. |
| R-3 | **New behaviour shipped in an area the candidate's own record marks as requiring adjudication** — the Accepted Inventory recorded the correction status as UNKNOWN pending Founder/Technical Lead adjudication, yet the branch was implemented | MAJOR (Independent Reviewer, governance) | **CLOSED in `de0106a`** — the adjudication is now recorded in `docs/programme/TIIZI-AEC-004-ACCEPTED-INVENTORY-001.md` §10.1 with the authority (Founder / Technical Lead, AEC-004 task instruction of 2026-11-18), the corroborating canonical register direction (first candidate sequence step 5), the independent basis (Guardian G1 F-01), the constraints carried into the implementation, and the **still-open approval-persona UX-review item**. |
| R-4 | **`groupJoined` navigation state is written but never read** | MINOR (Independent Reviewer) | **OPEN — not changed, by design.** The state originates in the accepted `#171` source and the accepted `#171` preview screen does not consume it. Consuming it would be a redesign of accepted UX, which AEC-004 §5 forbids. Recorded as a known observation for the next authorised scope. |
| R-5 | **Duplicated pagination / stall logic** between `V2TodayDiscoveryRecommendations.tsx` and `V2DiscoverableChallengePreviewScreen.tsx` | MINOR (Independent Reviewer) | **OPEN — not changed, by design.** Both copies come from the accepted `#171` source; extracting a shared helper would be a redesign of accepted code outside AEC-004's restore scope. Recorded for the next authorised scope. |
| R-6 | Residual weakness in the steward assertion of the updated S4a guard (whole-file substring) | NIT (Independent Reviewer) | **OPEN — pre-existing**, not introduced by AEC-004 and not worsened by the guard update. |
| R-7 | Two identical destinations in the new Group card (whole cover is a button; footer also offers "Enter Hub →") | NIT (Independent Reviewer) | **Accepted PFD presentation.** The visible affordance changed from "Open" to "Enter Hub →". Flagged so the Founder sees what changed. |
| R-8 | Dead branch in the discovery panel (`relation === 'active'`) | NIT (Independent Reviewer) | **OPEN — pre-existing**, harmless; the server's relationship union has no `active` value. |
| R-9 | The preview seed shapes the fixture Group's public focus/goals | OBSERVATION (Independent Reviewer) | **Accepted and disclosed.** The identifiers are valid governed API values, the comment states the intent honestly, and it affects only the disposable preview fixture. Noted in the Founder walkthrough so it is not mistaken for production data shaping. |
| R-10 | The `About this Group` Escape-to-close guard was **already failing on clean `origin/main`** and the reviewer flagged the credibility cost of a red guard at walkthrough time | MAJOR-risk (both reviewers) | **FIXED in `de0106a`** — the assertion expected an inline `event.key === 'Escape'` handler in `V2GroupHomeScreen`, but the Escape dismissal lives in the shared `V2Sheet` primitive and the Group Home owns the browser-history dismissal. The guard now asserts the accepted mechanism, so the guard is green without changing any accepted UX. |
| R-11 | The client-authority scan in the S4a guard flagged the new routing test's `memberCount: 1` fixture | Self-inflicted by R-2's fix | **RESOLVED in `de0106a`** — the client-authority scan now covers production surfaces only, while the per-file Firestore/PostgreSQL runtime checks still cover every file. Assertion count versus clean main: **164 → 174, nothing removed.** |
| R-12 | The completion report's candidate head string was one commit stale | LOW (Guardian G2) | **FIXED** — the report now distinguishes the behaviour SHA from the branch head and states that the two differ only by programme records. |

**Pre-existing guard failures that AEC-004 did not cause and did not mask:** the reviewer and Guardian both independently established that `test:groups-founder-final-pass` failed **identically** on clean `origin/main`. AEC-004 subsequently closed it (R-10). The other five pre-existing suite failures (`test:challenge-creation-6combos`, `test:s3a-participation-experience`, `test:s3b-activity-logging`, `test:s3c-live-progress`, `test:group-lifecycle`) remain **identical on clean main and on the candidate**, are outside the AEC-004 restore scope, and were left visible rather than masked.

## 9. Local preview URL and identities

| Item | Value |
| --- | --- |
| Frontend source SHA | `3f1ed8e4ef64124e2b704490626a97a6c6ce9393` (shipped app code) — the candidate head `976b60a9829a6b452bb72343f746e29ce7bec1e2` differs only by a test file, two guard scripts and programme records |
| API source SHA | `976b60a9829a6b452bb72343f746e29ce7bec1e2` — identical; **no `api/` file was modified** (`git diff 21c88f6 HEAD -- api/` is empty) |
| Working-tree overlay | **NONE.** `git status --short` in the integration worktree is empty at the recorded SHA. |
| Preview URL | **http://127.0.0.1:57952/** — Today: http://127.0.0.1:57952/v2/today |
| API | same-origin `/api` proxy → `http://127.0.0.1:57951` (CORS is not relaxed) |
| Auth Emulator | `http://127.0.0.1:57953`, project **`demo-tiizi-founder-22128-f095e463`** (isolated demo project, loopback only) |
| Disposable database | PostgreSQL `127.0.0.1:57954/tiizi_founder_preview`, user `tiizi_preview`, disposable marker `tiizi-disposable-preview:founder-preview:tiizi-founder-preview-aWVhpX` (temporary cluster, removed on shutdown) |
| Fixture identity | 31 migrations applied; 118-Activity catalogue imported (116 created / 1 updated / 1 unchanged) and published (84 fitness, 34 wellness, 0 duplicate codes) |
| Seeded Group | `a7db34fb-88b9-4026-9835-fef1ea68a62e` — "KILIMANJARO — S5b Today Preview", `⌖ Local preview`, focus `#Strength`, goal `Build strength` |
| Seeded Challenges | Streak `daa426b1-360e-491e-a9cf-01e743f430cc` ("Morning Momentum") · Together `05d24f8d-7487-4eab-9d2f-b38746c08785` ("Summit Steps Together") · Race `eaaa1669-a885-4b3c-8887-c18b748cc3e6` ("Reps Race") · Upcoming `6a0c129c-5253-464a-a572-09d7267e2b77` ("Sunrise Reset") |
| Seeded member | `05b2a014-2104-4fe6-8f07-38463ed98abe` |
| Test personas | **Existing Member** — `amara@tiizi.local` (Together, Race and Streak participation) · **New Member** — `founder1@tiizi.local` (interest `Strength`, goal `Build strength`, no Group or Challenge participation). Local-only password for both: `SRcuShfKdQUtrEZA65yYArSa` |
| Restart command | `npm run preview:founder` (one command; free ports chosen automatically). The session above was run under a managed 1-hour ceiling — run it in your own terminal for a durable session. |
| Existing Founder test data | **Not overwritten.** The preview uses a fresh temporary PostgreSQL cluster with a disposable marker; it touches no existing database. |
| Existing member preferences | The **Existing Member** persona first meets the pre-existing first-run preferences gate on `/v2/preferences` ("Continue" / "Skip for now"). This gate is **identical on `origin/main`** and is not an AEC-004 defect. |

### Journeys verified against this exact preview (independent Chrome)

**New Member (`founder1@tiizi.local`)** — all assertions passed:

- Today renders "Discover what fits you" with "Groups to explore" and "Challenges to explore", and the discovery block renders **before** the "Start with a Group" zero state (AEC-TODAY-01 ordering).
- Relevance copy is honest: "Suggested because it matches your interest: Strength and goal: Build strength", and the honest fallback captions "Ordered by your interests and goals. Every Group is still shown." / "Every Challenge is still shown."
- Groups → **Discover** tab shows the photo-led Group card: cover, "⌖ Local preview", "Tiizi Group", name, tagline, "Open to join", `#Strength`, `Build strength`, "Your interests: Strength · Your goals: Build strength", "1 member", and a **"Join Group"** action.
- Group Home → hosted Challenge "Morning Momentum" → **`/v2/challenges/discovery/daa426b1-360e-491e-a9cf-01e743f430cc`** (the authorized preview — **not** the 404 member route). The preview renders the Challenge summary and offers **"View hosting Group"**; it does **not** offer a Challenge join to a non-member.
- Zero console errors and zero failed/4xx/5xx requests.

**Group cover photo path (targeted check)** — all assertions passed:

- A Group created in the "Look & focus" step with a cover photo attached renders `data-local-cover="true"` with the selected image (`blob:` URL) on the Group page.
- The same photo appears on the Groups listing under **client-side** navigation.
- A **full page reload clears the photo** (`withPhotoAfterReload=0`), confirming the accepted tab-local-only behaviour and that AEC-IMG-09's "do not claim persistent uploads" still holds.
- Zero console errors and zero 5xx responses.

**Existing Member (`amara@tiizi.local`)** — all assertions passed:

- Today shows "3 active Challenges", "1 Streak needs you today", Do today → Streak "Morning Momentum" (1/2 done), Your Ongoing Challenges → Race "Reps Race" and Together "Summit Steps Together", In your Groups, and Coming up. **The discovery block is absent** (AEC-TODAY-03).
- Group Home → hosted Challenge → **`/v2/challenges/daa426b1-360e-491e-a9cf-01e743f430cc`** — the **existing member route**, with the member Challenge detail intact: "+ Log activity", "Leave Challenge", "You are taking part in this Challenge", today's daily consistency, current/best streak and days completed.
- Zero console errors and zero failed/4xx/5xx requests.

## 10. Founder walkthrough checklist

**Sign in** at http://127.0.0.1:57952/v2/sign-in with `founder1@tiizi.local` (New Member) or `amara@tiizi.local` (Existing Member), password `SRcuShfKdQUtrEZA65yYArSa`.

### A. New member (founder1@tiizi.local)

1. ☐ **Today** shows "Good morning, New", "0 active Challenges", and the **"Discover what fits you"** block **above** the large zero-state card.
2. ☐ "Groups to explore" shows **"KILIMANJARO — S5b Today Preview"** with "Suggested because it matches your interest: Strength and goal: Build strength" and "Open to join"; "Challenges to explore" shows "Sunrise Reset" (Together, Upcoming) and "Reps Race" (Race, Running).
3. ☐ Copy reads honestly: "Ordered by your interests and goals. Every Group is still shown." — it does **not** claim a recommendation where none matched.
4. ☐ "View Challenge" on a recommended Challenge opens the **Challenge preview** (not a 404) and reads "Join the hosting Group to view participation details. Joining a Group does not enroll you in this Challenge."
5. ☐ "View hosting Group" returns to the Group and offers a **Group** join; **no Challenge join is offered** until Group membership exists.
6. ☐ **Groups → Discover** shows the photo-led Group card (cover, location, "Tiizi Group", tagline, `#Strength`, `Build strength`, "1 member", **"Join Group"**).
7. ☐ Group Home shows the **"Join Group"** action and the hosted Challenges section with its own **"View"** action.
8. ☐ **Group Home → a hosted Challenge lands on `/v2/challenges/discovery/…`** with the Challenge summary — the AEC-DISC-02 defect is resolved.
9. ☐ Joining the Group returns you to the Challenge preview ("← Back to Challenge"), and a Challenge join becomes available only then.
10. ☐ The member header shows notifications and Profile only — no wordmark or tagline (AEC-HDR-10).

### B. Existing member (amara@tiizi.local)

11. ☐ First sign-in shows the **preferences gate** ("Continue" / "Skip for now") — pre-existing behaviour, also present on `main`.
12. ☐ **Today** shows "3 active Challenges", "1 Streak needs you today", Do today (Streak "Morning Momentum", 1/2 done), Race "Reps Race", Together "Summit Steps Together", In your Groups, Coming up.
13. ☐ **No "Discover what fits you" block** is shown for an active member.
14. ☐ Group Home → a hosted Challenge opens the **existing member Challenge page** (`/v2/challenges/…`) with "+ Log activity", "Leave Challenge" and "You are taking part in this Challenge".
15. ☐ A member sees an inline **Challenge join** on a live hosted Challenge — Group membership and Challenge join stay separate decisions.
16. ☐ **Log activity** still works end to end with Package A's immediate-logging timestamp precision and friendly errors.

### C. Things to confirm you still want changed

17. ☐ The **preferences gate** blocking the Existing Member from Today on first sign-in — pre-existing on `main`; say if you want it changed and it will be scoped separately.
18. ☐ The **"Discover what fits you"** headline and the honest fallback captions — confirm the wording is what you accepted.
19. ☐ The **Group card** treatment (photo-led cover, "Enter Hub →" / "Join Group" actions, the "Tiizi Group" label).

## 11. Remaining Recent Activity and Share integration queue

Protected source: `codex/tiizi-pfd-activity-visibility-003` @ `e2aee9239d42e6f92a66c22e4fcbbb97595c9521` (baseline `2476c9fe5ac62d888fd0fcbc02e2dc3a8fc2b384`), accepted 2026-11-09. Full detail: `docs/programme/TIIZI-AEC-004-PROTECTED-SOURCE-RECORD-001.md`.

The accepted prototype is **absent from the candidate** and is **not** represented as connected functionality. **No Activity History, Challenge Feed publishing or withdrawal backend was authored in AEC-004**, and none is authorised by it.

| # | Remaining item | Package | Authority required |
| --- | --- | --- | --- |
| 1 | Personal Activity history authority — owner-only read contract, ordering, pagination, retention/deletion, performed-vs-accepted time separation, authorised entity links | H1 | Separate Technical Lead/Founder scope |
| 2 | Participant count read and visibility — inventory existing server-derived counts first; define member-vs-episode semantics, non-member visibility, exit/rejoin behaviour | P1 | Separate scope + count-definition decision |
| 3 | Challenge Feed authority, read and experience — event allow-list, audience/visibility recheck, retention, cursor paging, idempotency, suppression; resolve the CF-01 open details (Kudos-able item set, qualifying admin/announcement rule, persistence/idempotency, API shape, placement, Streak S2 milestone schedule) | CF-2 / CF-3 / CF-4 | Explicit Founder authorization; CF-01 details first |
| 4 | Explicit Share publication and withdrawal — private by default, one active Share per member/source item, withdrawal without changing Activity evidence or progress, permitted-fields preview only | S1 | Separate authorization |
| 5 | External Copy Link / native sharing; separate "Log Another" / "Done" | CF-01 external share | Out of scope of the accepted prototype; not authorised |
| 6 | Post-merge preview verification of the protected prototype once it is connected | — | After items 1–4 |

## 12. Known omissions and unresolved defects

| Item | Status |
| --- | --- |
| Recent Activity connected, Challenge participant count read, Challenge Feed, Share publication/withdrawal, external Copy Link | **Not delivered** — out of AEC-004 scope, no authority (§11) |
| Persistent image/cover storage | **Not delivered.** All accepted image work is browser-tab-local `File` objects in in-memory maps; a reload clears them. AEC-IMG-09: *"Do not claim persistent uploads."* The restored Group cover inherits exactly this limitation. |
| Matched "recommended for you" results | Require a saved preference set. Without one, the block shows eligible-unmatched fallback rows with honest captions — correct behaviour, not a gap, but it must not be described as "recommended for you". |
| `test:groups-founder-final-pass` — "About this Group closes on Escape" | **Pre-existing failure**, identical on clean `origin/main`, and already recorded as a pending correction in the PFD handover. **Now closed** in `de0106a`: the guard asserted an inline `event.key === 'Escape'` handler in `V2GroupHomeScreen`, but the Escape dismissal lives in the shared `V2Sheet` primitive and the Group Home owns the browser-history dismissal. The guard now asserts the accepted mechanism, so it is green **without any accepted About-sheet behaviour being changed**. |
| Five other pre-existing suite failures | `test:challenge-creation-6combos`, `test:s3a-participation-experience`, `test:s3b-activity-logging`, `test:s3c-live-progress`, `test:group-lifecycle` — identical on clean `origin/main`; outside AEC-004's restore scope and not masked. |
| First-run preferences gate for the Existing Member persona | **Pre-existing product behaviour**, identical on `origin/main`. Recorded as a walkthrough note, not an AEC-004 defect. |
| AEC-DISC-02 open UX-review item — *"Reconcile the bypass and approval persona; UX review remains open until the bypass is corrected and independently checked"* | The CTA bypass is corrected and independently verified in §9. **The approval-persona reconciliation remains open** and needs a separate product decision. |
| G3 and G4 | `UNVERIFIED — OWNER NOT ASSIGNED`. Not activated by AEC-004. |
| Runtime identity for the *accepted sources themselves* | Was `UNKNOWN` at G1 (Guardian F-08). Closed for the AEC-004 **candidate** by §9; still unknown for PR #150, PR #171 and the PFD source as individually served applications. |

## 13. Boundary statement

No production deployment, feature expansion, migration, merge of PR #150 or PR #171, or cleanup of preserved branches was performed. The existing dirty primary checkout was not modified. PR #174 remains a **Draft** and is **not merged**.

**STOP — awaiting Founder browser acceptance.**
