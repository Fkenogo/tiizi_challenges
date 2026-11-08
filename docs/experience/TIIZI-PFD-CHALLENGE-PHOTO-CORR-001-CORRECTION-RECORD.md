# TIIZI-PFD-CHALLENGE-PHOTO-CORR-001 — Correction Record

**Status:** Implemented; awaiting Founder review  
**Stage:** 1 — Product Experience  
**Starting accepted head:** `3e4bcffa2662c7189e98400e1d093398ccbf6112`  
**Implementation commit:** `5a7e391a927650498376c6c852991d080a300b8f`  
**Branch:** `codex/tiizi-pfd-img-001`  
**Pull request:** [#163](https://github.com/Fkenogo/tiizi_challenges/pull/163)

## Correction

The local Challenge photo picker updated browser-only preview state and rendered the chosen image immediately. However, Step 3 completeness independently required the Challenge catalogue `coverId`. Selecting a local photo did not set that catalogue field, so the wizard remained blocked until a background card was selected. The frontend mapper also emitted `cover_id: null` when no catalogue cover existed, although the API schema allows `cover_id` to be omitted.

This correction removes Challenge background choices from the Create Challenge flow, makes the catalogue cover optional in the client completion and request mapping, and uses a neutral placeholder when no local photo is selected. The existing local picker remains responsible for selection, preview, replacement and removal. Its parent wizard state remains mounted across wizard steps.

## Verification

- `npm run test:v2-dom`: 22 files and 184 tests passed.
- `npm run build`: passed. Existing Browserslist freshness, profile API chunking and large-chunk warnings remain.
- Founder Preview browser checks at `http://127.0.0.1:5180/v2/challenges/new` used fictional local preview data. From scratch and from template both accepted photos, retained them when moving Step 3 → Step 4 → Step 3, allowed replacement and removal, and showed the neutral fallback after removal.
- The template title/prefill remained unchanged when a local photo was selected.
- 390px mobile and desktop layouts were reviewed. Screenshots were captured for Founder review.
- Challenge background controls were absent. No Group source files changed; Group background choices remain as before.
- No production storage, upload endpoint, database, migration or production configuration was used.

## Acceptance boundary

This record documents a correction to the previously accepted Stage 1 image-selection experience; it does not amend or erase the earlier acceptance records. The corrected Challenge photo experience is awaiting Founder review. Local photo previews remain session-local and are not persisted. No functional-integration or production acceptance is implied.

The earlier image/Challenge entry and Profile acceptances remain recorded in [TIIZI-PFD-IMG-001](./TIIZI-PFD-IMG-001-FOUNDER-ACCEPTANCE-001.md) and [TIIZI-PFD-PROFILE-001](./TIIZI-PFD-PROFILE-001-FOUNDER-ACCEPTANCE-001.md), unchanged.
