# Phase 18I-6E Follow-Up — MVP Challenge Activity Model Complete

**Date:** 2026-07-02
**Branch:** fix/p0-pre-deploy-blockers

---

## Summary

Completed the MVP activity model simplification by closing three gaps left after the first pass:

1. **Collective duplicate targets eliminated** — removed the separate Group Cumulative Target input; the payload now derives `groupCumulativeTarget` from the single activity's `targetValue`
2. **Competitive and Collective single-activity enforced in payload** — both UI (button hidden) and payload builder (`.slice(0,1)` cap) now enforce one activity
3. **Multi-activity Streak logging as checklist** — `SelectChallengeActivityScreen` now shows an inline checklist with value inputs for all activities when `challengeType === 'streak' && activities.length > 1`; Save is blocked until every value is filled; one submit = one streak day

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeEngineSettingsSection.tsx` | Collective section: removed `groupCumulativeTarget` number input; replaced with info box explaining the target is derived automatically from the activity |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Removed step-2 validation for collective target; step label "Group Goal" → "Settings"; payload derives `groupCumulativeTarget = Number(finalActivities[0].targetValue)`; caps non-streak to `validActivities.slice(0,1)` |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Same payload derivation + non-streak cap (`finalActivities`) for both wellness and fitness template saves |
| `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx` | `buildPayload()` uses `finalActivities` (capped) and derives `groupCumulativeTarget` from first activity |
| `src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx` | Same changes for both `onSaveDraft` and `onSaveAndPublish` |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Multi-activity streak checklist: added `isMultiStreakMode`, `checklistValues` state, `allChecklistValuesValid`, `handleChecklistSubmit` (sequential log of all activities); existing single-activity Log button preserved via `!isMultiStreakMode` guard |
| `scripts/testChallengeActivityModel.ts` | Extended from 15 to 32 guards covering all new behaviors |

---

## Design Decisions

### Collective: no separate target input

Rationale: A collective challenge has exactly one activity. Having both "activity target = 50 pushups" and "group cumulative target = 10000" created contradictory mental models. The group cumulative target IS the activity target — we derive it automatically. The creator sets one number (the activity target), and the engine receives `groupCumulativeTarget = activityTargetValue`.

`autoCompleteOnGroupTarget` toggle is preserved — it's a behavior flag, not a second target number.

### Backward compatibility for existing challenges

Existing collective challenges that were created with a separate `groupCumulativeTarget` (e.g. 10000 reps) continue to work — the stored `groupCumulativeTarget` field on those challenges is still respected by the engine and display screens. This change only affects **new creation**.

### Competitive hardening

The payload builder now calls `.slice(0, 1)` on `validActivities` before building the payload for any non-streak challenge. This is a last-resort backend guard in addition to the UI-layer button hiding and type-switch normalization. Three layers total:
1. "Add Another Activity" button hidden
2. Activities normalized to first when type changes to non-streak
3. Payload builder caps to first activity regardless

### Multi-activity Streak checklist

`SelectChallengeActivityScreen` detects `isMultiStreakMode = challengeType === 'streak' && activities.length > 1`. In this mode:
- All activities are shown inline with `<input type="number">` fields
- "Log Day" button is disabled until `activities.every((_, idx) => checklistValues[idx] > 0)`
- `handleChecklistSubmit` logs each activity sequentially (wellness or fitness, detected per-activity using the same `isWellness` heuristic as `handleLog`)
- Navigation goes directly to the success screen after all logs complete

The streak engine already handles same-day idempotency (`prevLastLogDate === today → newStreak = prevStreak`), so the first activity in the loop sets `lastLogDate = today` and subsequent logs in the same checklist submission don't double-count the streak.

Single-activity streaks preserve the existing tap-to-log-screen flow via the `!isMultiStreakMode` guard.

Mixed fitness+wellness multi-activity streaks are supported because `handleChecklistSubmit` dispatches to `logWellness` vs `logWorkout` per activity based on `isWellness` detection.

---

## Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ built in 2.91s |
| `npm run test:challenge-activity-model` | ✅ 32/32 |
| `npm run test:group-lifecycle` | ✅ 64/64 |
| `npm run test:challenge-creation-6combos` | ✅ passed |
| `npm run test:challenge-creation-backend` | ✅ passed |
| `npm run test:home-challenge-feeds` | ✅ passed |
| `npm run test:scoring-guards` | ✅ passed |
| `npm run audit:challenge-creation-payloads` | ✅ passed |
