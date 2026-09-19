# TIIZI-S3b — V2 Challenge Activity Logging / Application Vertical Assembly

**Work package:** S3b — Activity logging / application (second S3 vertical product assembly slice, per FD-S3-001)

**Status:** IMPLEMENTED CANDIDATE / CORRECTED / TECHNICALLY REVALIDATED /
READY FOR FOUNDER PREVIEW (TIIZI-S3B-ACTIVITY-APPLICATION-CORR-001,
2026-09-19; TIIZI-S3B-ACTIVITY-APPLICATION-ITR-002 disposition B —
approvable for Founder preview with non-blocking observations;
STOP BEFORE MERGE — Founder preview NOT performed, no acceptance claimed,
S3b NOT marked complete.)

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
| Programme | `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (1.83 → 1.84 correction record) |
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

S3b is **IMPLEMENTED CANDIDATE / CORRECTED / TECHNICALLY REVALIDATED /
READY FOR FOUNDER PREVIEW** (STOP BEFORE MERGE).
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
