# TIIZI-S2b — V2 Group Context + Challenge Creation Vertical Assembly

**Work package:** S2b — V2 Group Context + Challenge Creation (first vertical product assembly slice)

**Status:** COMPLETE / FOUNDER ACCEPTED / MERGED
(PR #30, merge `5d4ac3b` of accepted head `7e044da` on alignment branch
`impl/s2b-s2g-alignment-001` to `origin/main`; post-acceptance corrections merged
(PR #31 date-read correction, merge `2638ceb`; PR #32 CI web baseline correction, merge
`dcc8690`); S2 closed under TIIZI-S2-CLOSE-001, Master Programme 1.77.
Historical state at authoring time is preserved below: accepted head `7e044da`
with **STOP BEFORE MERGE** as a separate governed step.)

**Date:** 2026-09-17

**Base:** `origin/main` @ `e6686c86333dea865b375986c5b41af61c5dba95` (S2-G COMPLETE / FOUNDER ACCEPTED)

**Branch:** `impl/s2b-s2g-alignment-001` (replayed from held `dd1332c`; see §18)

**Adopted Experience Reference:** `Fkenogo/tiizi-prototye` @
`cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6`

**Governing formula:** PRODUCT TRUTH + ADOPTED EXPERIENCE REFERENCE = TIIZI PRODUCT ASSEMBLY.
This slice binds already-merged governed capability to the adopted experience; it invents no
new authority, no new Challenge engine, and no second validator.

---

## 1. Purpose

A Founder-previewable V2 Challenge-creation journey that binds, end to end:

sign in → V2 Challenges → Create Challenge → select host Group → configure Challenge →
preview/validate through the governed server seam → decide creator participation → review →
create → arrive at the resulting V2 challenge context → refresh and still see it.

The experience under `src/v2/` is a real journey over real API/domain capability, not a mock
wizard.

## 2. Experience boundary

Implemented under the new V2 composition root (`src/v2/**`), mounted at `/v2/*` as a sibling of
`/app/*`. **Nothing** from the frozen V1 experience tree is imported or routed:

- no V1 `BottomNav`, V1 challenge screens, V1 `/app/*` experience routes, V1 Groups journey,
  V1 onboarding, or V1 return paths;
- no PF-05 UI (`V2CreateChallengeWizard`, `V2ChallengesScreen`, `V2ChallengeDetailScreen` under
  `src/features/Challenges/**` are not merged and not reused);
- the whole `src/features/Challenges/**` tree is now import-forbidden for `src/v2/**`.

Allowed reuse: governed domain/API capability (`src/api/**`), neutral technical primitives
(`ProtectedRoute`, `useAuth`, `@tanstack/react-query`, Tailwind tokens), brand assets, and the
S1 shell primitives.

Guard: `scripts/testV2ExperienceBoundary.mjs` (extended) proves zero frozen-V1 imports, no
`/app/` paths, no PF-05 identifiers, and no direct Firestore write in the new V2 challenge
experience. `scripts/testS2bChallengeCreationGuards.ts` adds the S2b-specific proofs.

## 3. Files

| Area | File |
| --- | --- |
| Challenges entry point (list/read/empty/create) | `src/v2/challenges/V2ChallengeListScreen.tsx` |
| Six-step creation wizard | `src/v2/challenges/V2ChallengeCreationWizard.tsx` |
| Created-Challenge context (post-create + refresh) | `src/v2/challenges/V2CreatedChallengeScreen.tsx` |
| Pure wizard↔Composer mapping | `src/v2/challenges/challengeCreationDraft.ts` |
| Query/mutation hooks | `src/v2/challenges/useChallengeCreation.ts` |
| Client API seam | `src/api/challengeCreationApi.ts` |
| Shared V2 primitives (buttons/cards/fields/steps) | `src/v2/components/V2Primitives.tsx` |
| Routes | `src/v2/routes.tsx` |
| Transport (non-throwing variant) | `src/api/apiClient.ts` (`apiFetchRaw`) |
| Server read contract additions | `api/src/challengeReads.ts` |
| Server options seam (derived unit grouping) | `api/src/challengeCreationSeamRoutes.ts` |
| API tests | `api/test/s2bChallengeCreation.test.ts` |
| S2b guards | `scripts/testS2bChallengeCreationGuards.ts` |
| Local preview harness | `scripts/previewS2bSeed.ts` |

## 4. Challenges entry point

`/v2/challenges` renders `V2ChallengeListScreen`, bound to the real read
`GET /v1/challenges` (persisted V2 truth). Loading, empty and populated states are real; the
empty state and header both offer **Create Challenge** (→ `/v2/challenges/new`). A created
Challenge appears in this list (the list query is invalidated on establishment). Full S3
discovery/ranking/filtering is deliberately NOT implemented.

## 5. Minimal Group context

The host step uses `GET /v1/memberships/me` (`fetchMyMemberships`) — only the Groups the
authenticated member actually belongs to are offered, with Group name and role ("Steward" for
owner/admin, "Member" otherwise). Internal IDs are never displayed. There is no global
active-Group workspace model, no V1 Groups prerequisite, and no standalone/personal Challenge
(`toEstablishmentBody` refuses without a host Group; the host step cannot complete without one).

With no memberships the wizard shows a natural blocking state explaining that a Challenge
belongs to a Group, with a link to establish one through the governed S2-G journey
(`/v2/groups/new`, POST /v1/groups). S4 remains the full Groups Experience.
Group creation-rule authority stays server-side: no pre-emptive Group-rule read is performed;
governed denials returned by establishment are translated into member-facing copy (see §13).

## 6. Visible six-step wizard

The adopted six-step human-facing structure maps onto the PF-04 Composer draft:

| # | Visible step | Governed mapping |
| --- | --- | --- |
| 1 | How it works | `challengeType` (Together = collective, Race = competitive, Streak = streak) |
| 2 | Who is hosting | host Group (wizard context) + `title`/`description` (PF-04 `BASICS`) |
| 3 | What are we doing | `activities[].activity` + `observedVersion` + `kind` |
| 4 | What counts | `metric`/`unit`/`targetValue`/`componentIds`/`loadBasis`/`durationMode`/`completionOccurrence`; collective goal; streak duration |
| 5 | When does it run | `startDate`/`endDate`/`timezone` |
| 6 | Review & Create | review + creator participation + server preview + establishment |

Human-facing terminology is **Together / Race / Streak** with the adopted reference copy; the
internal canonical values (`collective`/`competitive`/`streak`) never appear in member-facing
copy (`challengeTypeLabel`). Templates are deliberately omitted (no affordance that implies they
work).

The visible structure is presentation; the governed semantic stages are never collapsed — the
step→draft mapping carries every PF-04 field.

## 7. PF-04 Composer mapping

`toComposerDraft(state)` produces a `draftKind: 'pf04-v1'`, `mode: 'CHALLENGE'` draft carrying
type, title/description, activities (identity + observed version + kind + measurement),
window/timezone, and the type-specific rules. `toEstablishmentBody(state, options)` produces the
governed `POST /v1/challenges` body (snake_case) with the same meaning. The mapping module is
pure and React-free so it is directly testable.

## 8. Activity / Knowledge binding

The catalogue uses the S2a opt-in seam `GET /v1/knowledge?composerSelectable=true`, which
server-side keeps only **published, coded, KCS-ready, challenge-eligible** canonical Activities.
Identity is always the canonical Knowledge UUID (never a name); Activity Category/Subcategory
and description are shown for orientation. Search and a Fitness/Wellness filter are supported.
Legacy/codeless/ineligible Knowledge can never enter.

## 9. Metric / Unit / Component / Load-basis handling

Selecting an Activity calls `GET /v1/knowledge/:id/options` and stores the returned governed
version. The "What counts" step offers only governed choices and uses progressive disclosure:

- **Metric** — from the Activity's permitted metrics.
- **Unit** — from the governed units that express the chosen Metric. The seam now also returns a
  purely derived `unitsByMetric` grouping (the single governed Unit→Metric vocabulary restated,
  not a second compatibility opinion); the client never re-derives compatibility.
- **Target** — numeric; Completion allows 0+ (occurrence is the requirement).
- **Duration** — explicit **All at once** (CONTINUOUS) / **Added up across the day** (ACCUMULATED).
- **Completion** — an intelligible "what must be completed" statement (never a bare "Done").
- **Weight** — one explicit Load Reporting Basis from the Activity's supported set, rendered with
  natural labels (e.g. "Per implement").
- **Components** — when the Activity declares required Components (ALL_REQUIRED), every required
  part is pinned on the draft and surfaced as a plain-language note; no summation is implied.

No client-side invention of compatibility exists; PF-02/PF-03 remain the authorities.

## 10. Type-specific requirements

- **Together (collective)** — one shared goal; the group total may exceed the target; the shared
  goal unit is derived from the single configured Activity (no unit conversion is inferred).
- **Race (competitive)** — a participant target; finishing-order ranking is engine business and
  is not presented here.
- **Streak** — daily requirements with an explicit timezone; `requiredConsecutiveDays` is derived
  from the schedule length; every configured daily requirement must be complete. No grace/late
  restoration semantics were changed.

No alternative challenge engine exists in frontend code.

## 11. Schedule / timezone behaviour

Duration is chosen from 7/14/21/30 days; the window is inclusive and the end date is **derived**
(`endDate = startDate + duration − 1`). Timezone is chosen from friendly labels ("Nairobi time
(UTC+3)"); the raw IANA identifier stays in the data. Streak requires an explicit timezone.

**Activation behaviour (documented exactly):** if the start date is **today or earlier**, the
Founder's creation request sets `activate: true`, using the existing authoritative establishment
capability (establishment → active in the same transaction). If the start date is in the
**future**, the Challenge is persisted in its legitimate **establishment** (pre-active) state and
presented honestly ("Getting ready"). No scheduled-activation infrastructure was invented.

## 12. Creator participation

Mandatory and explicit: before creation the Review step asks **"Will you take part in this
Challenge?"** with **Join this Challenge** / **Not now**. The default is **not joining**; Group
Membership never implies Challenge Participation, and the creator is never auto-enrolled. The
choice maps to the existing `join_creator` establishment option.

## 13. Server preview / validation and establishment

`POST /v1/challenge-definitions/preview` is the semantic preview/validation seam. It runs
automatically on the Review step and again immediately before creation; a failure blocks the
Create button. Client step gating only decides basic UX completeness — it is never semantic
authority, and no PF-03 rule is duplicated client-side.

Structured issues are mapped to the visible step/field they concern (`mapPreviewIssues`) and
rendered in plain language with a "Go to step" action; internal codes/messages are preserved for
debugging but stripped from member-facing copy (`humanizePreviewMessage`).

Creation submits through `POST /v1/challenges` (the existing governed establishment authority,
`ChallengeCreationAuthority` included). No direct Firestore write and no direct PostgreSQL write
from the frontend exists. A stable idempotency key is generated per creation attempt so a retry
replays rather than duplicating. Governed denials (no membership, membership inactive, Group
inactive, charter-restricted creation, stale Knowledge, invalid definition, authority
unavailable) are translated into clear member-facing copy (`creationErrorMessage`). There is no
fallback to V1.

## 14. Created-Challenge destination and refresh

After success the journey routes to `/v2/challenges/:challengeId`
(`V2CreatedChallengeScreen`), which reads `GET /v1/challenges/:id` (persisted truth) and shows
title, host Group, type, status, schedule/timezone, a configured Activity/measurement summary,
and the creator participation state. Refreshing the page renders the same persisted Challenge —
there is no mock-only success screen. This is a bounded context, deliberately NOT the full S3
Challenge Detail.

To make the measurement summary honest after refresh, the V2 read contract now exposes
`metric`, `requiredComponents`, `loadReportingBasis`, `durationMode` and `completionOccurrence`
per configured Activity (additive; semantic fields already persisted by PF-03).

## 15. Local preview harness

`scripts/previewS2bSeed.ts` (`npm run preview:s2b:seed`) deterministically prepares, loopback-only
and idempotently, ONLY:

- the Auth-emulator preview member `founder1@tiizi.local` (created by
  `npm run preview:v2-auth:reset`; local convention password `TiiziPreview2026`, emulator only)
  mapped to a PostgreSQL `members` row (identity linkage, no product state);
- eligible canonical Knowledge for Together / Race / Streak examples
  (`FIT-CRD-001` distance, `FIT-STR-001` repetitions, `WEL-MND-003` completion).

It manufactures NO Group, NO Group membership and NO Challenge. The host Group MUST be
established by the Founder through the governed S2-G journey at `/v2/groups/new`
(POST /v1/groups); the previous S2b preview manufacture (`s2b-preview-group`,
`PREVIEW_GROUP_LEGACY_ID`, direct Firestore `groups`/`groupMembers` writes and the PostgreSQL
Group/membership shadow) was removed on the S2-G alignment and must not be reintroduced. The
S2b Step 2 picker reads the member's real Groups through `GET /v1/memberships/me`.

No Challenges are seeded — the Founder creates them through the V2 journey. Refuses
`NODE_ENV=production` and any non-loopback Auth target.

`firebase.json` pins the emulator UI to `127.0.0.1:4001` so the API keeps `:4000` in local
preview.

## 16. What was deliberately NOT built

Templates / PF-06, Support Tiizi contribution configuration, Donations, Community Cause custody,
Recognition, commercial/subscription behaviour, operator controls, moderation, full S3
discovery/detail/results. No fake controls imply these work.

Founder observations deferred at acceptance (recorded, not implemented — no architecture
invented here; for subsequent product/architecture treatment):
- Custom duration: keep the 7/14/21/30-day presets; a future Challenge experience should
  additionally support Custom, permitting valid non-preset durations (e.g. 10 days).
- Challenge image: optional image support belongs to a later slice and must establish the
  canonical media/reference contract and persistence boundary rather than UI-only state.

## 17. Verification performed

- API: `npm test` in `api/` (full suite) including the new `s2bChallengeCreation.test.ts`
  (options grouping, per-type establishment, components, weight load basis, read-contract fields,
  governed denial).
- Frontend: `tsc -b`, `vite build`.
- Guards: `test:v2-experience-boundary`, `test:s2a-challenge-creation-api-seam`,
  `test:s2b-challenge-creation`, `test:v2-frontend`, `test:v2-auth-returns`,
  `test:firebase-emulator-mode`, `test:preview-v2-auth-workflow`.
- Local end-to-end (loopback emulators + local PostgreSQL with migrations 001–017 + API `:4000`):
  sign-in → memberships → composer catalogue → options (`unitsByMetric`) → preview (`ok:true`,
  `pf03-v1`) → establish Together/Race/Streak → list shows all three → detail reads expose the
  new measurement fields; idempotent replay returns 200 without duplication.

## 18. Status

S2b is **COMPLETE / FOUNDER ACCEPTED / MERGED** (TIIZI-S2B-FOUNDER-ACCEPT-001; accepted head `7e044da`; merged to main via PR #30, merge `5d4ac3b`). [TIIZI-S2-CLOSE-001 reconciliation: S2 is COMPLETE / FOUNDER ACCEPTED / MERGED (Master Programme 1.77); post-acceptance corrections merged (PR #31 date-read correction; PR #32 CI web baseline correction, main CI green).] S2a remains closed as merged;
S2-G remains **COMPLETE / FOUNDER ACCEPTED / MERGED** and is NOT modified here. S1/EA-01 remain closed.
PF-05 is NOT merged and NOT cherry-picked; PF-06 has NOT begun. No deployment and no production
mutation occurred.

## 19. Founder acceptance evidence and date investigation (TIIZI-S2B-FOUNDER-ACCEPT-001)
Founder browser preview (candidate `7e044da`, ITR-002 disposition B) completed the full
assembly proof: sign in → genuine empty Groups → created "test group1" through the S2-G
journey (Founder as Accountable Steward, persisted across refresh) → Challenges → Create
Challenge → WHO IS HOSTING showed the new Group immediately with no reload/wait/refocus
(runtime evidence that CORR-001 closes the stale-membership-cache defect) → selected the
governed host → catalogue rendered (Push-Up selected) → six-step wizard → Review & Create →
created "Test challenge1" → persisted detail rendered → refresh retained it → Challenges
listing showed it. Persisted authority state verified read-only: PG group `5c20fa01…`
("test group1", active) + owner membership for the preview member; PG challenge `56adbcbc…`
("Test challenge1", collective, active) hosted in that Group.

Date observation (NOT a blocker; acceptance remains valid): the wizard showed
17 Sep 2026 → 30 Sep 2026 (14 days, Nairobi time) while the detail rendered
16 Sep → 29 Sep. Trace: wizard strings (`2026-09-17`/`2026-09-30`) → establishment body →
persisted Postgres DATE `2026-09-17`/`2026-09-30` + `timezone Africa/Nairobi` (correct —
canonical definition intact) → read path `normalizeChallengeRow` → `toDayString`
(`api/src/challengeConfigs.ts:132`), which stringifies via `toISOString()` (UTC) and yields
`2026-09-16`/`2026-09-29` on a UTC+2/3 server → served and rendered verbatim by the
TZ-neutral `formatDay`. Disposition: API/read-model transformation defect with
display-visible effect; persistence and the canonical definition are correct. Recommended
correction location: `toDayString` (calendar-component conversion), which also removes the
latent carry-forward at `challengeConfigs.ts:445-446` for date-less version bumps. No
correction made here; recorded for a bounded follow-up.

Correction applied (TIIZI-CHALLENGE-DATE-READ-CORR-001): `toDayString`
(`api/src/challengeConfigs.ts`) now recovers the stored calendar day via calendar
components — UTC components for a UTC-midnight instant (PGlite/tests, ISO date-only
inputs), server-local components otherwise (node-pg DATE reads) — instead of the UTC
`toISOString()` projection. The same helper now also serves the expiry check
(`api/src/challengeFinalization.ts`), removing the early-expiry side effect and the
version-bump carry-forward vector at `challengeConfigs.ts:445-446`. No arithmetic, no
timezone special-casing, no Nairobi exception. Authoritative persistence semantics
unchanged (Postgres DATE in, calendar day out). Proven by
`api/test/challengeCalendarDates.test.ts` (7 tests) run green under TZ=UTC,
TZ=Africa/Nairobi and TZ=America/New_York with identical expectations. S2b remains
COMPLETE / FOUNDER ACCEPTED.
