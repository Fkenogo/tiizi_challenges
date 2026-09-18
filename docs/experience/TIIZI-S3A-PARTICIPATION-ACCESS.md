# TIIZI-S3a — V2 Challenge Participation / Access Vertical Assembly

**Work package:** S3a — Challenge participation / access (first S3 vertical product assembly slice, per FD-S3-001)

**Status:** COMPLETE / FOUNDER ACCEPTED / MERGED
(PR #35, normal merge commit `3b7dcee` of accepted head `a732f72` on branch
`impl/s3a-participation-access-001` to `origin/main` @ `3219494`.)

**Date:** 2026-09-18

**Base:** `origin/main` @ `32194942d0bc4d5588f558cf25b0d65b4034a0ac` (S3 CHARTER APPROVED / IMPLEMENTATION AUTHORISED)

**Branch:** `impl/s3a-participation-access-001`

**Charter:** `docs/experience/TIIZI-S3-CHALLENGE-EXPERIENCE-CHARTER.md` (§S3a)

**Adopted Experience Reference:** `Fkenogo/tiizi-prototye` @
`cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6` (experience guidance only)

**Governing formula:** PRODUCT TRUTH + ADOPTED EXPERIENCE REFERENCE = TIIZI PRODUCT ASSEMBLY.
This slice binds already-merged governed capability to the adopted experience; it invents no
new authority, no new participation engine, no new API, and no second participation store.

**Technical review:** independent technical review disposition B — APPROVABLE FOR FOUNDER
PREVIEW WITH NON-BLOCKING OBSERVATIONS. Founder preview has PASSED (see §9).

---

## 1. Purpose

A Founder-previewable V2 Challenge participation/access journey that binds, end to end:

sign in → V2 Groups (establish a host Group through the governed S2-G journey) →
V2 Challenges → Create Challenge through the governed S2b journey → open Challenge
detail → inspect NOT JOINED state → Join → confirm JOINED → refresh and still see it →
Leave (with bounded confirmation, including cancellation without mutation) → confirm
NOT PARTICIPATING → refresh and still see it → Join Again → confirm JOINED →
refresh and still see it.

The experience under `src/v2/` is a real journey over real API/domain capability, not a mock.

## 2. Experience boundary (charter §S3a)

Implemented under the existing V2 composition root (`src/v2/**`). **Nothing** from the frozen
V1 experience tree is imported or routed; no PF-05 UI is resurrected; no parallel Challenge
detail system is created (the existing `V2CreatedChallengeScreen` route gains the
participation section).

Allowed reuse: governed domain/API capability (`src/api/**`, `src/hooks/**`), neutral
technical primitives, brand assets, and the S1 shell primitives.

## 3. Files (17, S3a-scoped)

| Area | File |
| ---- | ---- |
| Programme | `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` (1.79 → 1.80 candidate record; → 1.81 acceptance record) |
| Scripts | `package.json` (three S3a guard entries only) |
| Guards | `scripts/testS3aParticipationCacheGuards.ts` (new) |
| Guards | `scripts/testS3aParticipationExperienceGuards.ts` (new) |
| Guards | `scripts/testS3aGroupsZeroStateGuards.ts` (new) |
| Guards | `scripts/testS2bChallengeCreationGuards.ts` (string-assertion widened to the contract constant; behaviour unchanged) |
| API fetchers | `src/api/v2ChallengeApi.ts` (`finalized` typed from the already-served read) |
| Hooks | `src/hooks/useV2Challenges.ts` (join/withdraw mutations over the governed seams; refetch-only post-action truth) |
| Payload | `src/services/v2ActivityPayload.ts` (participation read shaping) |
| List | `src/v2/challenges/V2ChallengeListScreen.tsx` (Taking part / Not joined from server truth) |
| Detail | `src/v2/challenges/V2CreatedChallengeScreen.tsx` (embeds the participation section) |
| Section | `src/v2/challenges/V2ParticipationSection.tsx` (new: governed Join / Withdraw / Join-again with bounded withdraw confirmation, loading/error/success/denied states, code-preserving human-readable denials) |
| Cache contract | `src/v2/challenges/challengeQueryKeys.ts` (new: canonical + legacy cache families invalidated together) |
| View model | `src/v2/challenges/participationView.ts` (new: pure participation view derivation) |
| Creation hook | `src/v2/challenges/useChallengeCreation.ts` (membership-aware hosting context) |
| Groups screen | `src/v2/groups/V2GroupsScreen.tsx` (zero-state bound to the pure view model) |
| Groups view | `src/v2/groups/groupsView.ts` (new: pure Groups zero-state view derivation) |

## 4. Authority and seams (all pre-existing; bound, not built)

- Participation episodes + eligibility (`challengeParticipations.ts`): one active episode per
  member/Challenge pair; `joinChallenge` / `withdrawParticipation` authority.
- Live Group-Membership authority (same read the S2 journeys consume).
- Write seams: `POST /v1/challenges/:id/join`, `POST /v1/challenges/:id/withdraw`.
  Rejoin is the same join seam — no special semantics.
- Read model: `myParticipation` in list/detail — no new API, no read-model change.
- Post-action truth is refetch-only. No optimistic canonical participation state is
  manufactured anywhere in `src/v2/`.

## 5. Groups zero-state correction (TIIZI-S3A-FOUNDER-PREVIEW-CORR-001)

The founder-preview correction locks the Groups zero-state empty+CTA contract behind the
pure `groupsView` view model (`memberships: []` renders an honest empty state with a
discoverable creation path; it manufactures no Group, no membership, no participation).
Covered behaviorally by `test:s3a-groups-zero-state`. No Group-experience scope is added:
Group establishment works but is not the comprehensive final Group experience — the full
Groups Experience remains S4.

## 6. What was deliberately NOT built

- S3b (activity logging/application), S3c (live progress/type-state), S3d (results/finalized).
- Custom Duration (bounded S2b creation follow-up; PF-03 already supports arbitrary windows).
- Group/Challenge cover media (see §7 — future experience requirement, not implemented).
- Challenge contributions/donations/Tiizi Support (see §8 — future reconciliation item, not implemented).
- PF-05 resurrection, PF-06 (remains S7/Templates), EBC-05 (unmerged/reference-only).
- V1 changes (FROZEN / reference-only).
- Migrations, deployment, production data mutation (none).

## 7. Future programme input A — Group + Challenge cover media (NOT implemented)

Founder observation at acceptance: both Groups and Challenges should support cover imagery
in the assembled experience.

Disposition (recorded, not implemented — no architecture invented here):

- Future experience requirement, NOT part of S3a.
- Broadens the already-recorded Challenge Image concern (Master Programme deferred
  observations; S3 charter; S2b §16): the future media/domain work must consider both
  Group cover media and Challenge cover media.
- Requires an authorised canonical media/reference contract before any UI implementation.
- No ad-hoc URL/string field. No UI-only persistence.
- Stage placement and authorisation belong to a later authorised slice; nothing here
  assigns this work to S3b/S3c/S3d or S4.

## 8. Future programme input B — Challenge contributions / donations / Tiizi Support (NOT implemented)

Founder observation at acceptance: the assembled Challenge experience currently lacks the
documented contribution dimension associated with Challenges, including cause-related
contributions/donations and Tiizi Support. The Founder states these concepts are already
represented in Tiizi documentation and the Experience Reference.

Disposition (recorded, not implemented — no semantics invented here):

- Future programme/domain reconciliation item, NOT part of S3a.
- The authoritative documentation and Experience Reference must be inspected before any
  implementation; their semantics are NOT derived from this record.
- A later authorised assessment must determine what canonical/domain/engine authority
  exists or is missing for cause-related Challenge contributions/donations and for Tiizi
  Support associated with Challenges.
- No donation/payment/support UI. No schema fields. No payment infrastructure.
- The S3 charter excludes reference elements with no engine truth (including
  contributions) from S3; nothing here silently assigns this item to S3b/S3c/S3d.
- Preserved distinction: the participant Challenge lifecycle assembled in S3 is separate
  from contribution/support capabilities, whose authority and stage placement require
  reconciliation.

## 9. Founder acceptance evidence (TIIZI-S3A-FOUNDER-ACCEPT-MERGE-001)

Founder manually completed the governed local-preview journey on the accepted candidate
(head `24d25d7`):

1. Created a Group through the V2 UI.
2. Created Challenges hosted by that Group through the governed Challenge creation flow.
3. Opened Challenge detail and confirmed initial NOT JOINED state.
4. Joined and confirmed JOINED.
5. Refreshed and confirmed JOINED persisted.
6. Exercised Leave Challenge confirmation, including cancellation without mutation.
7. Confirmed Leave and observed NOT PARTICIPATING state.
8. Refreshed and confirmed withdrawn state persisted.
9. Used Join Again and confirmed JOINED.
10. Refreshed and confirmed rejoined state persisted.

Founder disposition: **S3a participation/access journey ACCEPTED.**

Group-experience note: Group establishment works but is not yet the comprehensive final
Group experience. S3a is not expanded to address later Group-experience assembly; the full
Groups Experience remains S4.

## 10. Verification performed

- Guards: `test:s3a-participation-cache`, `test:s3a-participation-experience`,
  `test:s3a-groups-zero-state`, `test:s2b-challenge-creation` — all PASS.
- Root: `tsc -b` clean; `vite build` clean (`npm run build`).
- API: `typecheck` clean; full suite 632 passed / 8 skipped (42 files passed, 1 skipped).
- Functions: `npm run build` clean.
- `git diff --check` clean.
- Repository `ci` on the candidate: api, api-image, functions, web all PASS
  (run `35348895678`). External `Workers Builds: tiizi-challenges` reports failure and is
  NOT an S3 gate under FD-S3-005; repository CI remains the gate.
- Negative scope proofs: no S3b/c/d implementation; no Custom Duration; no media; no
  contribution/donation/Tiizi Support; no PF-05/PF-06/EBC-05/V1 change; no migration;
  no deployment; no production mutation.

## 11. Status

S3a is **COMPLETE / FOUNDER ACCEPTED / MERGED** (TIIZI-S3A-FOUNDER-ACCEPT-MERGE-001;
accepted head `a732f72` (v1.80 implementation + TIIZI-S3A-FOUNDER-PREVIEW-CORR-001
Groups zero-state correction, plus v1.81 acceptance record); merged to main via PR #35,
normal merge commit `3b7dcee`; candidate verified ancestor of `origin/main`).
**S3 remains IMPLEMENTATION IN PROGRESS. S3b has NOT begun** — the next programme slice after successful merge is S3b,
which requires its own authorised task. S2 remains COMPLETE / FOUNDER ACCEPTED / MERGED.
No deployment and no production mutation occurred.
