# TIIZI S3d — Results / Finalized Experience

**Slice:** S3d — Results / Finalized Experience
**Task:** TIIZI-S3D-RESULTS-FINALIZED-EXPERIENCE-001
**Status:** **IMPLEMENTED CANDIDATE / AWAITING TECHNICAL REVIEW** (NOT COMPLETE, NOT FOUNDER ACCEPTED, NOT MERGED)
**Branch:** `impl/s3d-results-finalized-experience-001`
**Entry:** `origin/main` @ `f98a71bf0ba3db9e932571ffaee4bd88a5da5f6e` (Master Programme v1.98); no drift.
**Authority:** `docs/programme/TIIZI-S3D-PREIMPLEMENTATION-READINESS-001.md` (Founder disposition §14: FD-S3D-1, FD-S3D-2A, FD-S3D-3, FD-S3D-2 Race rule) + `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md` §9/§12.
**No deployment. No S3d merge. S3c remains CLOSED (COMPLETE / FOUNDER ACCEPTED / MERGED, not reopened).**

## 1. Purpose

S3d answers **"What happened when this Challenge ended?"** It presents governed
final / frozen Challenge truth and creates none. Authority order preserved:
ENGINE / FROZEN TRUTH → PERSISTED FINALIZATION → READ MODEL → CLIENT CONTRACT →
TYPE-SPECIFIC RESULTS EXPERIENCE.

## 2. Honest lifecycle states

| State | Condition | Presentation |
| ----- | --------- | ------------ |
| live | `active` and server `governingToday <= endDate` | existing S3c live surfaces, unchanged |
| ended-pending (window-expired unprocessed) | `active` while server `governingToday > endDate` | neutral "Challenge ended / Final results are being confirmed"; logging + Leave unavailable |
| ended-pending (ended, not finalized) | `ended`, `finalized:false` | neutral results-pending; no provisional result shown as final |
| finalized | `ended`, `finalized:true` | sealed, type-specific results |

Derived by the pure module `src/v2/challenges/challengeEndState.ts` using only
server-projected values (never the device clock).

## 3. Bounded read-model projection (no schema / no migration)

`GET /v1/challenges/:id` (and list) now exposes a frozen per-participation
`final` block on `myParticipation`, projected read-only from
`challenge_participation_finals`:

```json
{ "completed": true, "completedAt": "...", "daysCompleted": 3,
  "bestStreak": 3, "finalStreak": 0, "finalPosition": null, "finalizedAt": "..." }
```

It is `null` while unfinalized. For Race the block is the member's **governing
(earliest completed) episode** result (PR #41 member identity); identity/gating
stay on the display episode. Exposing frozen `finalStreak` is the bounded
projection FD-S3D-2A approved — the live `currentStreak` is never substituted.
`finalized`, `finalizedAt`, `finalResult` and `finalPosition` were already
served and are now typed on the V2 client. **No schema. No migration. No second
results authority. No frontend recomputation.**

## 4. Experience

- **Together** — final group total vs goal, percent (overshoot preserved, e.g.
  220/200 = 110%), goal reached / actual result when not (no failure wording),
  goal-crossing instant, own contribution + share, member-level contributors
  (no ranking), "Results saved on …".
- **Race** — own final result (total vs target; "Finished · Final position #N"
  from the served frozen value, ties share; "Progress at close" when unfinished),
  **Final standings** (finishers in server order, then participants who did not
  reach the target with actual progress), "N of M finished" derived from
  entries, "Results saved on …". No winner/podium/trophy.
- **Streak** — personal only: days completed of the full period, best streak,
  **Final streak** from frozen truth, required run, terminal completion stated
  plainly, per-day complete/missed history, "Results saved on …". No
  leaderboard, no comparison, no failure label.

Copy is restrained ("Results saved on …"), never an unqualified permanence
promise (ACT-03/ACT-04 correction governance remains deferred). Backend
terminology (finalized/frozen/terminal truth) never reaches the member.

## 5. Tests and guards

- `api/test/s3dResultsFinalizedExperience.test.ts` — T-1 (finalized Together
  read shape, overshoot, missed-goal actual result), T-2 (frozen `finalStreak`
  vs live `currentStreak`), T-3 (ended-not-finalized per type), T-4
  (window-expired-unprocessed detail + HTTP `challenge_not_active`), T-5
  (Race ties 1,1,3 + non-finisher null + governed position), T-8 (no partial
  exposure), plus the PR #41 member-identity result proof. T-6/T-7 are delivered
  by PR #41 and not duplicated.
- `scripts/testS3dResultsGuards.ts` (`npm run test:s3d-results`) — G-1 pure
  results derivation (frozen passthrough, overshoot, N-of-M), G-2 end-state
  routing, G-3 finalized-standings lifecycle through a real `QueryClient`, G-4
  S3c boundary preserved (S3d vocabulary absent from S3c-guarded files; live
  surface still unmounts when finalized), G-5 no failure/winner/podium/
  recognition vocabulary, no client-manufactured truth, no V1 imports.

## 6. Explicit scope boundaries (not touched)

Scheduler, automatic finalization, finalization HTTP mutation endpoint,
operator finalization UI, Run Again, recognition issuance / Platform
Recognition, badges/rewards, Kudos, Support Tiizi / donations / Cause, media,
S4/S8/S9, ACT-03/ACT-04 correction mechanism, schema redesign, migrations.
S3c is not reopened; its live experience is unchanged for active/in-window
Challenges.

## 7. Status statement

S3d is an **IMPLEMENTED CANDIDATE / AWAITING TECHNICAL REVIEW**. This record
does **not** mark S3d COMPLETE, FOUNDER ACCEPTED or MERGED, authorises no
deployment, and changes no code-merge state. Technical review and Founder
disposition remain outstanding.
