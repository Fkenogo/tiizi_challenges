# TIIZI-V2-UX-008 — Delivery report

**Task:** New-member Today and responsiveness.
**Baseline:** `0f23e3d008f93db7c639175639666a9f81797da1` (merged PR #191 — TIIZI-V2-UX-007, the Founder-approved media implementation).
**Head:** `feat/v2-ux-008` — see §1.
**Status:** complete, **stopped for Founder review**. Not merged, not deployed, no migration, no R2 credential change, no destructive cleanup.

---

## 1. Exact head SHA

| Fact | Value |
| --- | --- |
| Branch | `feat/v2-ux-008` |
| Head SHA | `12050b484f59b5592fb633c3e9d0a27c3cd8df79` |
| Merge-base with `origin/main` | `0f23e3d008f93db7c639175639666a9f81797da1` |
| Commits | 2 — `1d04657` (implementation) and `12050b4` (review findings + governance records) |

## 2. Root-cause diagnosis

### 2.1 Why the new-member Today read as "too text-heavy"

The merged baseline renders **two independent discovery sections** on Today
(`V2TodayDiscoveryRecommendations`), and **every card** carried a full sentence explaining the match
(`recommendationReason(...)` → "Suggested because it matches your interest: X and goal: Y.") plus a
long participation/joining explanation. For a member with no active Challenges the result is a wall
of prose with no picture and no hierarchy — exactly what the Founder described. The underlying
*ranking* was fine; the *presentation* repeated the reasoning on every card.

### 2.2 Why covers were missing (per surface, per classification)

| # | Defect | Class | Root cause | Evidence |
| --- | --- | --- | --- | --- |
| 1 | Today Challenge suggestions never carried a cover | **B** | Today called `useV2ChallengeDiscovery('relevance', false)`; `includeMedia=false` makes `assembleChallengeSummaries` skip the media projection entirely, so `coverImage` was never produced | `src/v2/today/V2TodayDiscoveryRecommendations.tsx` (baseline) → `api/src/challengeDiscovery.ts` `assembleChallengeSummaries`; runtime: the baseline run requested `/api/challenges/discover?limit=20&includeMedia=0` |
| 2 | Today Group suggestions never rendered the cover the projection already carried | **D** | The Group discovery projection already returned `coverImage` (and `coverId`), but the Today card rendered no cover at all — `V2GroupCover` was not used on that surface | `api/src/groupDiscovery.ts` `toGroup()` vs baseline Today card markup |
| 3 | The persisted catalogue Challenge cover was never rendered anywhere | **D** | `challenges.cover_id` (governed catalogue `challenge-1`…`challenge-8`) was projected but `V2ChallengeCover` ignored it and always fell back to a flat grey placeholder, even on the Challenge list and detail surfaces | `src/v2/challenges/V2ChallengeCover.tsx` (baseline) vs `src/v2/challenges/challengeCovers.ts` |
| 4 | Preview fixture Groups/Challenges have no catalogue cover | **A** | The S5b seed inserts `cover_id` as NULL, so those rows genuinely have no saved cover; the neutral placeholder is correct and no image may be invented | `scripts/previewS5bSeed.ts`; runtime `/api/groups/discover` → `coverId: null` |

**Class C (URL exists but loading fails / is delayed)** — investigated, not a defect:
signed read URLs live 60 s (PRIV-05, `api/src/r2ObjectStore.ts`), and the client refreshes media
projections at 30 s (`MEDIA_QUERY_STALE_MS`), so a cached projection is never older than its own URL.
The expiry path was exercised end to end and recovers (§6).

**Not changed on purpose:** a signed URL is minted per projection response (the signature embeds
`X-Amz-Date`), so the browser cache cannot be reused for the same asset across refetches. Making the
URL stable would require quantising the signing timestamp, which shortens the effective URL lifetime
and would change the governed signed-URL lifecycle. Recorded as a risk (§9), not fixed.

### 2.3 Why the screens felt slow

Measured in the isolated preview (§5): every governed API call answers in **3–38 ms** and the
database is **0–1 ms** per query with **0 ms** pool acquisition, so *in this environment* neither
Neon-style latency nor pool churn is the bottleneck — the browser-side cost is. Two structural
inefficiencies were confirmed and fixed within the approved scope:

- Today asked for the Challenge discovery projection **twice** across the Today → Browse Challenges
  path (Today used `includeMedia=false`, the Discovery screen used `true` → two cache entries, two
  requests). With `includeMedia=true` on Today both surfaces now share one React Query entry:
  measured **2 requests before → 1 request after**.
- A signed cover image was decoded on the main thread; decoding is now `async` (the request, the
  signed URL and its lifetime are untouched).

## 3. The new Today presentation

One compact **"Suggested for you"** section replaces the two discovery sections.

- **One coherent list.** Groups and Challenges are interleaved into a single list. The relevance
  order *inside* each entity type is exactly the server's order (`recommendedGroups` /
  `recommendedChallenges`); only the interleaving is a presentation decision. The list is bounded
  (3 of each) so Today never becomes a directory.
- **Cover image when a persisted, authorized cover exists.** The Group card renders the projected
  cover (`V2GroupCover`, catalogue background or persisted photo); the Challenge card renders the
  projected photo or the persisted catalogue background. **No photograph is ever substituted** for a
  missing cover: the neutral placeholder stays.
- **Name, entity type, concise context, one clear next action.** Each card shows a `Group` /
  `Challenge` badge, the name, one line of context (tagline/member count, or host Group + date
  range), and exactly one primary action ("View Challenge" / "View Group"). The hosting Group stays
  reachable from the context line ("Hosted by *KILIMANJARO …*").
- **The matching basis is stated once.** The section caption explains the basis in one sentence
  ("Group and Challenge suggestions are ranked by your interests and goals…"). Cards carry
  label-level chips only ("Strength", "Build strength"). The old per-card sentence is gone. When the
  server has not applied a ranking, the caption says so honestly ("Showing all suggestions in the
  default order"), and it is not rendered at all while loading or when the list is empty — so no
  "nothing matched" claim can ever be made on unknown data.
- **Full Discovery stays reachable.** "Browse Groups" and "Browse Challenges" sit in the section
  header.
- **Joining rules untouched.** Today never offers a join. The Challenge projection asserts
  `joinability: 'not_asserted'`, so a card opens the governed surface; the card states the actual
  admission state ("Request to join; the Group must approve." / "Open to join." / "Your request is
  awaiting approval." / "approval is required before taking part.").
- **Empty state.** "Nothing to suggest right now" with a pointer to full browsing, shown only once
  both discoveries are known to be exhausted.

## 4. Image availability matrix

`A` = no saved cover exists · `B` = saved cover exists but is not in the API projection ·
`C` = URL exists but loading fails or is delayed · `D` = the image component receives stale or
incorrect state.

| Surface | Canonical record | In the API projection | Signed URL | Rendering | Class | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Today → my Challenges (required / joined / opportunity / upcoming) | `challenges.cover_asset_id` + `challenges.cover_id` | `coverImage` (UX-007) + `coverId` (**added**) | yes when media is configured | `V2ChallengeCover` | B (catalogue) | **fixed** |
| Today → suggested Groups | `groups.cover_asset_id` + `groups.cover_id` | `coverImage` + `coverId` (already) | yes | `V2GroupCover` | D | **fixed** (never rendered before) |
| Today → suggested Challenges | `challenges.cover_asset_id` | `coverImage` was **absent** (`includeMedia=false`) | was none | `V2ChallengeCover` | B | **fixed** |
| Challenge Discovery | `challenges.cover_asset_id` + `cover_id` | `coverImage` + `coverId` | yes | `V2ChallengeCard` → `V2ChallengeCover` | D (catalogue) | **fixed** (catalogue never rendered) |
| Group Discovery | `groups.cover_asset_id` + `cover_id` | `coverImage` + `coverId` | yes | `V2GroupDiscoveryPanel` → `V2GroupCover` | — | no defect |
| Challenge Detail | `challenges.cover_asset_id` + `cover_id` | `coverImage` + `coverId` | yes | `V2ChallengeHero` → `V2ChallengeCover` | D (catalogue) | **fixed** |
| Group Home | `groups.cover_asset_id` + `cover_id` | `coverImage` + `coverId` | yes | `V2GroupHomeScreen` → `V2GroupCover` | — | no defect |
| Fixture rows whose `cover_id` is NULL | none | — | — | neutral placeholder | A | correct by design |

## 5. Before / after browser timings

**Environment (identical for both runs).** Isolated Founder-style preview: loopback-only temporary
PostgreSQL cluster, Firebase Auth emulator, the real API, Vite web, and a local S3-compatible HTTPS
object-store double wired through the real `R2_*` configuration path (no cloud credential, no
production bucket, no R2 credential change). Browser: **real Chromium** via `playwright-core`
1.63 (headless, 1280×900). Measurement: `performance.now()` marks captured by a `MutationObserver`
for the first heading, the suggestion section and the first *loaded* cover image, plus
`PerformanceResourceTiming` for every API and image request (the resource buffer was enlarged to
4000 entries because the Vite dev module graph alone fills the default 250 and silently drops the
API/image entries).

| Measurement | Baseline `0f23e3d` | After `feat/v2-ux-008` | Delta |
| --- | --- | --- | --- |
| Sign-in → first visible Today content (cold) | 1009 ms | 732 ms | **−277 ms (−27 %)** |
| First visible **cover image** on Today | **never** (no cover was projected or rendered) | 1461 ms | missing → present |
| Today: `DOMContentLoaded` | 356 ms | 356 ms | ±0 |
| Today, warm reload → first heading | 199 ms | 191 ms | −8 ms (noise) |
| Today, warm reload → first cover image | never | 209 ms | missing → present |
| Group Discovery → first heading | 200 ms | 228 ms | +28 ms (run-to-run noise) |
| Challenge Discovery → first heading | 187 ms | 198 ms | +11 ms (run-to-run noise) |
| Group Detail → first heading | 201 ms | 264 ms | +63 ms (run-to-run noise; member-scoped read) |
| Challenge Detail → first heading | 191 ms | 217 ms | +26 ms (run-to-run noise) |
| Navigation back to a previously visited screen | 287 ms | 152 ms | **−135 ms (−47 %)** |
| Today → "Browse Challenges" discovery requests | 2 (Today used `includeMedia=0`, the screen `=1`) | **1** (shared React Query entry) | −1 request |
| Browser console errors / network failures | 0 / 0 | 0 / 0 | — |

**Cost separation** (the same environment, measured separately):

| Layer | Method | Result |
| --- | --- | --- |
| Firebase authentication | sign-in click → authenticated navigation | 70–82 ms (Auth emulator, local) |
| Neon query | `perfProbe.mjs` against the preview database, 5 samples per statement | 0–1 ms per query (local PostgreSQL; **not** Neon — see §9) |
| Pool acquisition | same probe, cold (empty pool) vs warm | cold 0–5 ms, warm 0 ms |
| API processing | resource-timing duration of the governed request (includes the DB work above) | 3–38 ms per endpoint; the largest are `/api/challenges/discover` 38 ms, `/api/memberships/me` 22 ms, `/api/me` 20–23 ms, `/api/today` 20 ms |
| React Query | request count per screen | Today 9 requests cold, all answered; Today → Discovery now shares one entry |
| R2 URL generation | inside the request duration above (URL minting is server-side, no separate round trip) | — |
| Image download + decode | resource timing of the image request | cold 42 ms (Group cover) / 14 ms (Challenge cover); warm 1–2 ms (browser cache) |
| Browser rendering | DOMContentLoaded vs first heading vs first cover image | DCL 356 ms → heading 732 ms → cover image 1461 ms; the gap is the Vite dev module graph (dev-mode artefact, see §9) |

## 6. Tests and E2E evidence

**Automated suites (this branch):**

| Suite | Result |
| --- | --- |
| Frontend `vitest` (root) | **358 tests / 57 files pass** |
| API `vitest` (`api/`) | **1128 tests / 82 files pass** (8 files skipped by the suite itself) |
| `npm run build` (`tsc -b && vite build`) | **pass** |
| Guard suites (`test:*`, 60 scripts) | **all pass except 9 that fail identically on the untouched baseline** (proven: the same 9 fail in a clean worktree at `0f23e3d`) |

The 9 pre-existing failures are unrelated to this task (challenge-creation activity catalogue,
group-lifecycle fixture data, mobile primary nav, member bootstrap): `test:challenge-creation-6combos`,
`test:s2b-challenge-creation`, `test:s3a-participation-experience`, `test:s3b-activity-logging`,
`test:s3c-live-progress`, `test:s4a-group-home`, `test:mc1-member-bootstrap`,
`test:mobile-primary-nav`, `test:group-lifecycle`. They are reported, not fixed (out of scope).

**New/updated coverage:** `src/v2/today/V2TodaySuggestedForYou.dom.test.tsx` (22 cases, including the
complete accepted regression set ported from the deleted discovery test file: closed-page paging,
repeated-cursor stall, later-page failure, service-error state, cross-page deduplication, matched
ranking across pages, eligible-unmatched fallback, pending Group restrictions), `todayDiscovery.test.ts`,
`V2TodayScreen.discovery.dom.test.tsx`, `V2ChallengeCover.dom.test.tsx` (catalogue cover, neutral
placeholder, badge suppression, `decoding="async"`), and the strengthened `scripts/testV2DiscoveryGuards.ts`
guard block G (10 assertions, none tautological).

**E2E (real Chromium, isolated preview, existing authorized preview resources only — no duplicate
verification Group or Challenge was created):**

| Phase | Result |
| --- | --- |
| New member (no active Challenges) → Today | "Suggested for you" renders one list; Group + Challenge cards with type badge, context, one action, match chips; **0 console errors, 0 network failures** |
| Existing member (active Challenges) → Today | the suggestion section is **absent** (the existing Today experience is untouched) |
| Persisted cover through the governed upload flow | intent → content → bind succeeded for a Group cover and a Challenge cover (`api/media/intents`, `…/content`, `…/cover-image`); the browser then loaded the **signed URL** from the object store (840×540) |
| Missing cover | cards without a persisted cover render the neutral placeholder; **no substitute photograph** |
| Navigation to Group / Challenge detail | reached from the suggestion cards (hosting Group from the context line) |
| Privacy and joining restrictions | the fixture Group flipped to private + approval-required: it **disappeared from discovery** (`visibleAfterPrivate: false`) and a join attempt returned `status: "pending"` — the governed approval rule, not an instant join |
| Signed URL expiry recovery | after the 60 s lifetime expired, a client-side navigation away and back re-rendered the cover from a **fresh** signature (`X-Amz-Date` 15:17:06 → 15:18:15), image loaded, 0 network failures |
| First and subsequent load performance | cold and warm numbers in §5 |

Evidence: `local-e2e/evidence/` (after) and `local-e2e/evidence-baseline/` (before) — screenshots
`01-new-member-today-suggested.png`, `02-new-member-today-with-cover.png`,
`03-existing-member-today.png`, `04-group-discovery.png`, `04-challenge-discovery.png`,
`04-group-detail.png`, `04-challenge-detail.png`, `05-expiry-recovery.png` and the raw
`e2e-results.json` (marks, resource timings, console errors, network failures).

## 7. Independent review status

An independent reviewer (`verifier` agent, read-only, no project-file changes) reviewed
`0f23e3d..HEAD` against the Founder requirements and the governed constraints. **Verdict: REQUEST
CHANGES.** All findings were addressed in this branch:

| Finding | Severity | Resolution |
| --- | --- | --- |
| The caption could claim a match ranking that was never applied (during loading, on error, on an empty list) | major | `suggestionCaption` now treats an unknown ranking state as "no relevance claim"; the caption is rendered only when suggestions exist. Covered by new DOM cases ("makes no matching claim while the suggestions are still loading", "reports a service error without claiming anything about matches") |
| Accepted regression coverage was lost with the deleted discovery test file | major | The full accepted set was ported into `V2TodaySuggestedForYou.dom.test.tsx` (closed-page paging, repeated cursor, later-page failure, service error, deduplication, matched ranking, unmatched fallback, pending restrictions) |
| New guard assertions were tautological | minor | Guard block G rewritten to assert real markers (element ids, rendered labels, slice bounds, caption wording, ranking-state handling) |
| "No cover photo" badge contradicted the catalogue background | minor | The badge is now suppressed whenever a catalogue cover is persisted (card + cover), with tests |
| `decoding="async"` on a shared component without a cited defect | minor | Kept deliberately and justified: it is the class-C remedy for main-thread decode blocking the first paint of the card that carries the image; the request, the signed URL and its lifetime are unchanged. Asserted by test |
| "Ordered by your interests and goals" overstated a cross-type order | minor | Reworded to "Group and Challenge suggestions are ranked by your interests and goals…" |
| Chip meaning was only in `title` | minor | Each chip now carries an `sr-only` prefix |
| The caption's `&&` condition differed from the established discovery caption | observation | Aligned with the established rule (unknown ⇒ no claim) |
| A comment mis-described the catalogue | observation | Corrected |
| The receipt's client-seam list was incomplete | observation | Updated, and a Challenge-side DOM test added |
| Two actions on a Challenge card | observation | The hosting Group moved into the context line; the card now has exactly one primary action |

**Status: all findings addressed; the branch is ready for Founder review.** No reviewer-owned file
was modified.

## 8. CI status

The repository CI (`.github/workflows/ci.yml`) runs the API contract suite, the V2 suites, the
guard scripts and the build. Local equivalents for every one of those jobs were run on this branch
and pass (§6), except the 9 pre-existing guard failures that also fail on the untouched baseline.
**CI on the PR itself: pending / to be confirmed on the PR page** — this report states the local
result, and the PR must be read for the authoritative run.

## 9. Outstanding risks

1. **Neon and R2 were not reachable from this machine.** No `DATABASE_URL`, no `R2_*` and no Neon
   credential exist in `.env`/`.env.local`, and the preview refuses inherited production identifiers
   by design. Therefore (a) every timing in §5 is a **local-preview** timing and must not be read as
   a Neon/R2 timing, and (b) persisted-cover behaviour was proven against the governed upload path
   with a local object-store double, not against the Founder's bucket. A Neon/R2 measurement pass is
   still owed before any latency conclusion is drawn.
2. **Overlap with two open PRs.** #150 (open, "Add preference-aware discovery to V2 Today") and #171
   (draft) touch the same Today discovery surface and are not in `main`. This branch builds on the
   **merged** baseline; the reviewer must reconcile the three before any merge.
3. **Signed-URL browser-cache miss.** Every projection response mints a new signed URL, so the
   browser cache cannot be reused for the same asset across refetches. Fixing it would require
   changing the signed-URL lifecycle (PRIV-05), which this task is not allowed to do. Left as a
   finding.
4. **The catalogue background on Challenge surfaces is a presentation change** to the UX-007 accepted
   media implementation (which always showed a flat grey placeholder). It renders the *persisted,
   governed* catalogue cover, not a substitute photograph — but if the Founder prefers the grey
   placeholder, this is a single, isolated revert (`src/v2/challenges/V2ChallengeCover.tsx` +
   `V2ChallengeCard.tsx` badge condition).
5. **Dev-mode browser timings are inflated** by the Vite module graph (≈250 module requests before
   the app mounts). Production builds will differ; the relative structural results (cover present vs
   absent, one discovery request instead of two, 47 % faster back navigation) hold regardless.
6. **The disposable preview fixture was mutated** by the run: the seeded Group carries a persisted
   cover and the new member holds a pending Group application. The preview database is temporary and
   disposable; the Founder Preview artifact (`.worktrees/founder-preview-ux007`) was **not** touched,
   restarted or rebuilt.
7. **Nine guard suites fail on the baseline** and are unrelated to this task; they remain red for the
   repository as a whole.
8. **Unified Personal Recent Activity timeline is not implemented** (deliberately). The requirement
   is recorded in
   `docs/programme/working/TIIZI-V2-UX-008-RECENT-ACTIVITY-FOLLOW-UP-REQUIREMENT-001.md`, together
   with the recommendation to integrate Recent Results into that timeline — which **preserves the
   current results and recognition authority** until that follow-up is approved.

## 10. Boundary statement

- **Not merged.** **Not deployed.** No production environment was touched.
- No database migration (no schema change; the only server change is an additive `coverId` field
  in the Today projection).
- No destructive cleanup; the only removals are the superseded discovery component and its test
  file, replaced by the new section and its (larger) test file.
- No R2 credential change; the local object-store double is a test double wired through the
  existing `R2_*` configuration path.
- No unrelated feature work: the diff is limited to the Today suggestion surface, the cover
  rendering path, the additive Today projection field, the image decode attribute, the affected
  tests and the three governance records.
- The V1 surface is untouched (the V1 boundary is preserved).
