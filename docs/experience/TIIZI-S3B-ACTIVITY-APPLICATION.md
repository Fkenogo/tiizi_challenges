# TIIZI-S3b — V2 Challenge Activity Logging / Application Vertical Assembly

**Work package:** S3b — Activity logging / application (second S3 vertical product assembly slice, per FD-S3-001)

**Status:** COMPLETE / FOUNDER ACCEPTED (TIIZI-S3B-FOUNDER-ACCEPT-MERGE-001,
2026-09-19 — see §14). Founder acceptance followed the technically corrected
and live-revalidated candidate: TIIZI-S3B-ACTIVITY-APPLICATION-CORR-001 +
TIIZI-S3B-FOUNDER-PREVIEW-CORR-002 + TIIZI-S3B-FOUNDER-PREVIEW-CORR-003 +
TIIZI-S3B-FOUNDER-REVALIDATION-RESUME-001 (ITR-002 disposition B). Merge of
PR #37 into main is authorised under TIIZI-S3B-FOUNDER-ACCEPT-MERGE-001
(normal merge-commit path). S3 remains IMPLEMENTATION IN PROGRESS; S3c/S3d
NOT STARTED.

**Date:** 2026-09-18

**Base:** `origin/main` @ `e020d7f30e319b8bb050e1993be47f5dcda4b971` (Master Programme v1.82; S3 IMPLEMENTATION IN PROGRESS; S3a COMPLETE / FOUNDER ACCEPTED / MERGED; S3b AUTHORISED / NOT STARTED)

**Branch:** `impl/s3b-activity-application-001`

**Charter:** `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md` (§S3b)

**Contribution boundary:** `docs/programme/TIIZI-CHALLENGE-CONTRIBUTION-RECON-001.md` (disposition A — S3b proceeds unchanged; financial contributions are not activities)

**Adopted Experience Reference:** `Fkenogo/tiizi-prototye` @
`cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6` (experience guidance only)

**Governing formula:** PRODUCT TRUTH + ADOPTED EXPERIENCE REFERENCE = TIIZI PRODUCT ASSEMBLY.
This slice binds already-merged governed capability to the adopted experience; it invents no
new authority, no new scoring engine, no new API, and no second activity store.

---

## 1. Purpose

A Founder-previewable V2 Challenge activity-logging journey that binds, end to end:

open a joined Challenge → understand what counts → choose an eligible configured
activity → enter amount + when → submit → see the server's accepted result
(or its governed rejection with an understandable reason) → refresh and keep
authoritative truth → safely replay the same entry without duplicating it →
submit a non-qualifying entry and see the rejection without accepted truth changing.

The experience under `src/v2/` is a real journey over real API/domain capability, not a mock.

## 2. Experience boundary (charter §S3b)

Implemented under the existing V2 composition root (`src/v2/**`). **Nothing** from the frozen
V1 experience tree is imported or routed; no PF-05 UI is resurrected; no parallel Challenge
detail system is created (the existing `V2CreatedChallengeScreen` route gains the
logging section after the S3a participation section).

Allowed reuse: governed domain/API capability (`src/api/**`, `src/hooks/**`), neutral
technical primitives, brand assets, and the S1 shell primitives.

## 3. Files (9, S3b-scoped)

| Area | File |
| ---- | ---- |
| Programme | `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (1.87 → 1.88 Founder-acceptance record) |
| Record | `docs/experience/TIIZI-S3B-ACTIVITY-APPLICATION.md` (this file, new) |
| Scripts | `package.json` (`test:s3b-activity-logging` guard entry only) |
| Guards | `scripts/testS3bActivityLoggingGuards.ts` (updated for CORR-001) |
| CORR-001 guards | `scripts/testS3bActivityApplicationCorr001.ts` (new: behavioral proofs for the three blockers) |
| Error mapping | `src/services/v2ActivityPayload.ts` (S3b activity denial codes appended to `mapV2ApiError`; governed vs retryable; CORR-001: bounded `buildS3bActivityPayload` omits client `occurred_day`, shared default preserved; participation-period + new-entry copy corrections) |
| Hooks | `src/v2/challenges/useChallengeCreation.ts` (`useLogActivityV2` over the governed seam; refetch-only post-acceptance truth) |
| Intent model | `src/v2/challenges/loggingIntent.ts` (new, CORR-001: pure submission-intent/key derivation) |
| View model | `src/v2/challenges/loggingView.ts` (new: pure logging view derivation; CORR-001: `empty` zero-activity state, UUID-free labels, `loggingSectionStateFor` accepted-vs-new-entry separation) |
| Section | `src/v2/challenges/V2LoggingSection.tsx` (new: governed logging form + authoritative outcome rendering) |
| Detail | `src/v2/challenges/V2CreatedChallengeScreen.tsx` (embeds the logging section) |

No API, migration, schema, workflow, or deployment change. No server/domain change —
the engine authority verified exact against the charter (see §4).

## 4. Authority and seams (all pre-existing; bound, not built)

Verified against the entry main before any code change — no material drift from
charter §2B:

- `applyChallengeActivity` (`api/src/challengeActivityApplication.ts:389`): idempotency
  replay (`:430-442`) on `client_key`; server-side scoring (`:699`); live
  Group-Membership gate (fail-closed); `status==='active'` gate; exact-variant/unit
  match; Knowledge identity match; owning-episode `occurred_at`; server-derived
  governing day with `occurred_day` mismatch → 422; governing version = current
  config at acceptance (`:529-534`); durable rejected intents outside the rolled-back
  tx (`:450-456`); eight rejection reasons incl. `STREAK_DAY_CLOSED` (no grace,
  no late logging); period-end gate.
- Write seam: `POST /v1/challenges/:challengeId/activity`
  (`api/src/challengeActivityRoutes.ts:178-179`; reg `api/src/app.ts:99`). Required
  participant facts: `activity_kind, canonical_key, value, unit, occurred_at,
  client_key`; optional `activity_variant, occurred_day, occurred_tz`. Response echoes
  the accepted record plus derived truth (`:152-168`).
- Read seam: `GET /v1/challenges/:id` detail exposes `config.activities`
  (canonicalKey, activityVariant, activityKind, metric, targetValue, unit), `status`,
  `finalized`, `myParticipation` — every eligible input derives from this read.
- V2 binding: `logChallengeActivityV2` (`src/api/v2ChallengeApi.ts:182-190`) existed
  with no consumer → **now consumed** (the (5) missing binding is closed for logging).

## 5. What was deliberately NOT built

- S3c (live progress/type-state dashboards, contributor shares, leaderboard/positions,
  streak day-state experience), S3d (results/finalized, Run Again).
- Custom Duration; Group/Challenge cover media (still deferred behind canonical media authority).
- Challenge contributions/donations/Tiizi Support (RECON-001 disposition A: S8-gated,
  never coupled — payload allowlist-closed and proven).
- PF-05 resurrection, PF-06 (remains S7/Templates), EBC-05 (unmerged/reference-only).
- V1 changes (FROZEN / reference-only).
- Migrations, deployment, production data mutation (none).

## 6. Cache / read coherence (S3a contract reused)

Post-acceptance success runs `invalidateV2ChallengeReads` (canonical + legacy families
together; per-user isolation) — the same contract S3a established. No `setQueryData`
manufacture of canonical progress anywhere in the S3b touch-points. The next read
re-proves truth from `GET /v1/challenges/:id`. Proven at runtime by the S3b guards
(plus the unchanged S3a cache guards).

## 7. Founder preview (PREPARED — NOT performed)

The preview journey this candidate enables (local preview, no production data, no deploy):

A. joined participant opens Challenge → B. chooses/logs valid activity →
C. submission accepted → D. refresh preserves authoritative outcome →
E. submit an intentionally invalid/non-qualifying activity → F. rejection shown with
the authoritative reason → G. rejection alters no accepted truth →
H. idempotent replay (same `client_key`) returns the stored result, no duplicate →
I. streak temporal rejection via authorised controlled local setup (FD-S3-004).

## 8. Verification performed

- Guards: `test:s3b-activity-logging` PASS (view derivation, payload contract,
  13 governed denials + 4 retryable paths, idempotency, cache coherence with
  per-user isolation, S3c/S3d/financial non-leakage, no client scoring engine);
  `test:s3a-participation-cache`, `test:s3a-participation-experience`,
  `test:s3a-groups-zero-state`, `test:s2b-challenge-creation` — all PASS (no regression).
- Root: `tsc -b` clean; `vite build` clean (`npm run build`).
- API: `typecheck` clean; full suite 632 passed / 8 skipped (42 files passed, 1 skipped) —
  identical to the S3a baseline (no API change).
- Functions: `npm run build` clean.
- `git diff --check` clean.

## 9. Status

S3b is **IMPLEMENTED CANDIDATE / CORRECTED / FOUNDER REVALIDATION
REQUIRED** (STOP BEFORE MERGE).
**S3 remains IMPLEMENTATION IN PROGRESS. S3a remains COMPLETE / FOUNDER ACCEPTED /
MERGED. S3c/S3d NOT STARTED.** No deployment and no production mutation occurred.

## 10. CORR-001 correction record (2026-09-19)

Corrects the three blocking ITR-001 defects with no API/schema/migration/
domain change (base `e020d7f`, candidate `75a3024`, PR #37 OPEN — not merged):

1. **occurred_day/timezone** — the S3b path uses the bounded
   `buildS3bActivityPayload` and never sends a client-derived `occurred_day`;
   the server derives the governing day from `occurred_at` + Challenge
   timezone and the UI displays the authoritative `occurredDay` from the
   server result. The shared builder default is unchanged for frozen
   surfaces; server mismatch validation is untouched.
2. **Idempotency intent lifecycle** — explicit pure model
   (`src/v2/challenges/loggingIntent.ts`): same facts → same key; any
   change to activity/amount/time → new key before submission; governed
   rejections and post-acceptance changes mint new keys; server binding
   (`isSameSubmissionPayload`) untouched. "Log another" re-establishes a
   cleared new-entry intent (amount/time/key/attempt reset).
3. **Accepted-then-ended rendering** — `loggingSectionStateFor` separates
   outcome display from new-entry gating: an accepted result stays visible
   across an active→ended refetch while ended/closed reads forbid new
   submissions. No progress preserved or manufactured; no S3d surface.
4. **Bounded UX** — UUID-free selector labels (resolved Knowledge name
   primary), honest zero-activity empty state, participation-period copy for
   `no_participation_episode`, new-entry direction for
   `idempotency_key_conflict` (codes preserved).

Evidence: `test:s3b-activity-application-corr-001` (behavioral) PASS and
updated `test:s3b-activity-logging` PASS; regression suites green.

## 11. CORR-002 correction record + revalidation blockers (2026-09-19)

### 11.1 Root cause (DEFECT-001, accepted)

V2 governed Challenge establishment (`validateChallengeDefinition` /
PF-01-CORR-001), the Challenge read model and the S3b client all use
immutable Knowledge identity (UUID / governed Activity Code) as
`canonical_key`. The V2 activity-application route
(`POST /v1/challenges/:id/activity`) injected the quarantined exact-NAME
resolver (`createDbKnowledgeResolver` → `resolveKnowledgePinByName`), which
cannot resolve a UUID/Code key. Every valid log on a governed-UI-created
Challenge therefore failed pin resolution and returned `422 unknown_activity`
/ `ACTIVITY_NOT_CONFIGURED` (Founder Challenge `e13229fb…`; Community Walk
UUID `b946a8f8…`).

### 11.2 Correction

`api/src/knowledgePins.ts` gains `createDbKnowledgeIdentityFirstResolver`:
identity keys (UUID / Activity Code) resolve by identity through the existing
`resolveKnowledgePinByIdentity`; a key that is not a valid identity falls back
to the existing exact-name resolver. The fallback is narrowly bounded (exact
published name only, no fuzzy/partial matching, fail-closed) and is required
by repository evidence — the existing real-route suites
`api/test/challengeActivityApplication.test.ts` and
`api/test/ebc02SubmissionAcceptanceTrace.test.ts` assert the V2
activity-application contract still applies historical name-pinned configs.
`api/src/challengeActivityRoutes.ts` wires the new resolver. Establishment is
unchanged and still rejects display names as identity, so the fallback can
never create a name-pinned configuration. No API/schema/migration/domain
change.

### 11.3 Regression coverage

New tracked `api/test/s3bActivityLoggingIntegration.test.ts` (real route:
governed establishment → persisted Challenge → participation → POST activity →
`applyChallengeActivity`): (1) Activity-Code-pinned accepted; (2) UUID-pinned
accepted; (3) unknown immutable identity fail-closed `unknown_activity`;
(4) valid non-configured identity rejected `wrong_activity`; (5) legacy
name-pinned config accepted via the bounded fallback.

### 11.4 Revalidation blockers (recorded, NOT silently fixed)

1. **Activity-event DATE projection.** `api/src/activityEvents.ts`
   `normalizeRow` projects a Postgres `DATE` with
   `row.occurred_day.toISOString().slice(0, 10)`. The `pg` driver hands a
   `DATE` as a JS `Date` at **local midnight**; on positive-offset hosts the
   UTC projection shifts a day back (host `Africa/Bujumbura`, UTC+2: stored
   `2026-09-19` → `2026-09-18`), so the accepted-path period gate rejects a
   valid in-window log as `422 outside_challenge_window`. This is the same
   class already corrected for Challenge dates in v1.76 (`toDayString`,
   `api/src/challengeConfigs.ts`) but is **not** proven by DEFECT-001 and is
   outside this bounded correction's scope. PGlite (test) returns `DATE` at
   UTC midnight, so the new integration tests do not exercise this path — it
   was reproduced only against the live `pg` runtime. Recommended separate
   correction: reuse `toDayString` in `normalizeRow` with a TZ-matrix test.
2. **External port-9099 conflict.** Mid-revalidation the Klockit project's
   tooling (`firebase emulators:start --only auth --project
   demo-klockit-local`, cwd `/Volumes/PRODUCTION/Projects/klockit`, PID
   41922) claimed port 9099 and terminated the S3b Auth/Firestore emulator.
   No other project's process was touched. The S3b emulator exported a clean
   recovery set to `/private/tmp/tiizi-s3b-emulator-recovery.dRMjBf`
   preserving the Founder Auth UID `Tgj1jC3FXyxOfqtdlhvelt69phoI`, so the
   existing Founder identity/linkage can be restored when 9099 is free
   (`--import` that directory).

**S3b is NOT marked COMPLETE or FOUNDER ACCEPTED; no merge; no deploy;
S3c/S3d NOT started.**

## 12. CORR-003 correction record — PostgreSQL DATE projection (2026-09-19)

### 12.1 Root cause (confirmed)

A PostgreSQL `DATE` is a calendar day, never an instant. `node-postgres`
returns a `DATE` as a JS `Date` at **server-local midnight**; projecting it
with `toISOString().slice(0, 10)` (UTC) shifts the stored day back on
positive-offset hosts (`Africa/Bujumbura`, UTC+2: stored `2026-09-19` →
`2026-09-18`). The accepted-path period gate in `applyChallengeActivity`
compared that mis-projected day to the pinned window, rejecting a valid
in-window log as `422 outside_challenge_window` (Founder Challenge
`e13229fb…`, window 2026-09-19..2026-10-02).

### 12.2 Correction (representation-only)

Reuse the canonical DATE-safe `toDayString` (v1.76, `api/src/challengeConfigs.ts`)
in every affected occurrence-day DATE projection on the activity/Challenge
path:
- `api/src/activityEvents.ts` `normalizeRow` (the proven blocker);
- `api/src/challengeActivityApplication.ts` `normalizeRecord` (accepted
  response `occurredDay`);
- `api/src/derivedTruth.ts` `toDayOrNull` + replay normalization;
- `api/src/submissionIntents.ts` `normalizeSubmissionIntentRow` (idempotency
  payload binding — the bad projection could make a legitimate retry look
  like a changed payload).

No schema/migration. Challenge-window validation, governing-day authority,
`occurred_at` semantics, `occurred_tz` provenance, `STREAK_DAY_CLOSED`/no-grace
and participation-episode validation are unchanged. `dayInTimezone` (a
timestamptz helper) and `previousDay` (pure UTC string arithmetic) are not
DATE projections and were left unchanged.

### 12.3 Regression coverage

`api/test/activityEventDateProjection.test.ts` (new):
(a) driver-Date / UTC-midnight / string normalization across
`2026-09-19`, `2026-09-30`, `2026-10-01`, `2026-12-31`, `2027-01-01`,
plus the event, submission-intent and participation-derived normalizers;
(b) real application-path boundary: window 2026-09-19..2026-10-02 with a
governing day of 2026-09-19 is accepted (not `outside_challenge_window`).
Proven to FAIL against pre-CORR-003 code under `TZ=Africa/Nairobi`
(`expected '2026-09-18' to be '2026-09-19'`) and PASS under `TZ=UTC`,
`TZ=Africa/Bujumbura`, `TZ=Africa/Nairobi`, `TZ=America/New_York`.

### 12.4 Live revalidation status

**Blocked (external).** The Klockit project's emulator
(`firebase emulators:start --only auth --project demo-klockit-local`, cwd
`/Volumes/PRODUCTION/Projects/klockit`, PID 41922) still exclusively owns
port 9099, which Tiizi Auth requires by committed product configuration
(`src/lib/firebaseEmulators.ts`, `scripts/previewV2Auth.ts` refuse any other
port). No other project's process was touched. The S3b emulator recovery set
`/private/tmp/tiizi-s3b-emulator-recovery.dRMjBf` preserves the Founder Auth
UID `Tgj1jC3FXyxOfqtdlhvelt69phoI`, so the existing identity/linkage can be
restored (`--import` that directory + migrations/DBs unchanged) once 9099 is
free. No accepted activity record was created; the Founder Challenge, Group
and rejected intents are unchanged.

## 13. FOUNDER-REVALIDATION-RESUME-001 — live journey PASSED (2026-09-19)

The external port-9099 conflict cleared; the S3b Auth/Firestore emulators were
restored from `/private/tmp/tiizi-s3b-emulator-recovery.dRMjBf` under the
authorised config (project `demo-tiizi-s3b`). The Founder account
`founder1@tiizi.local` came back at the **same UID
`Tgj1jC3FXyxOfqtdlhvelt69phoI`**, still linked to PostgreSQL member
`7acce992-8450-4f6b-9431-9939fca56cad` (port 5435). No replacement identity was
created; the existing Group (`ae24cde5…` "test group1"), Challenge
(`e13229fb…`, collective/Together, active 2026-09-19..2026-10-02, Africa/Nairobi,
Community Walk `b946a8f8…`) and participation (`25ac9602…`, active) were
retained, and the four historical rejected intents were preserved.

**Live journey through the real UI (headless Chromium, no direct writes):**
1. signed in as the restored Founder;
2. opened the SAME Challenge; the logging surface rendered "Community Walk"
   without any raw UUID;
3. submitted **30 km** → `200 accepted` (`occurredDay 2026-09-19`,
   `pointsAwarded 6`, `duplicate false`; **no `unknown_activity`, no
   `outside_challenge_window`**) with the confirmation card
   "Recorded. 30 kilometres counted for this Challenge. Points awarded: 6 ·
   Day: 2026-09-19";
4. **Log another** cleared the amount, reset the occurrence time and minted a
   fresh intent key;
5. submitted **40 km** → `200 accepted` (`pointsAwarded 8`, same governing
   day);
6. refresh remained coherent.

**Persisted after the journey:** `challenge_activity_records = 3`,
`member_activity_events = 3`, `activity_submission_intents = 7` (3 accepted + 4
rejected preserved), distinct client keys = 3, **no duplicate records**;
derived `participation logs=3 / points=14 / cumulative=90`, `challenge
collective_total=90` (goal not reached). A preceding capture run additionally
accepted a 20 km entry (`pointsAwarded 0`, below the 5% minimum-effort ratio)
whose UI confirmation was lost to an over-eager reload; it is retained as
committed evidence (3 total accepted records, not 2).

**CORR-002 (identity) and CORR-003 (DATE) both work in the assembled product;
no implementation correction was required by this task.** S3b is
**FOUNDER REVALIDATION PASSED / AWAITING FOUNDER ACCEPTANCE** — not COMPLETE,
not Founder Accepted, no merge, no deploy, S3c/S3d not started.

## 14. FOUNDER ACCEPTED (TIIZI-S3B-FOUNDER-ACCEPT-MERGE-001, 2026-09-19)

The Founder completed the final S3b preview on candidate `9ad0ef2` and
**ACCEPTS S3b**. Founder-observed evidence:

- the existing Founder-created Challenge loaded successfully;
- activity logging succeeded through the normal UI;
- the UI displayed **"Recorded. 20 kilometres counted for this Challenge.
  Points awarded: 0 · Day: 2026-09-19"**;
- **"Log another"** was exercised and reset the form for a new activity;
- a normal refresh loaded the Challenge with no error;
- no Founder-observed error.

The **0-point result is expected governed server behaviour** for that entry
(20 km of a 500 km target = 4 %, below the 5 % minimum-effort ratio) and is
**not a defect**.

Retained technical/live evidence: the immutable Knowledge identity
application-route correction (CORR-002) passed; the PostgreSQL DATE projection
correction (CORR-003) passed; multiple accepted submissions were persisted
without duplication. **CORR-002 and CORR-003 remain CLOSED.**

**S3b: COMPLETE / FOUNDER ACCEPTED.** Merge of PR #37 into canonical main is
authorised under this entry via the normal merge-commit path (accepted head
`9ad0ef2`; no squash, no rebase, no force-push; merge commit recorded by the
follow-up merged-state entry). S3 remains IMPLEMENTATION IN PROGRESS; S3a
COMPLETE / FOUNDER ACCEPTED / MERGED; S3c/S3d NOT STARTED. No deployment.
