# Phase 18I-6E — MVP Challenge Activity Model

**Date:** 2026-07-02
**Branch:** fix/p0-pre-deploy-blockers

---

## Summary

Simplified the MVP challenge activity model to enforce the correct per-type constraint:

- **Collective + Competitive**: single activity only
- **Streak**: multiple activities allowed (checklist-style logging, one streak increment per day via existing engine guard)

---

## Problem

The "Add Another Activity" button was visible for all challenge types. A creator could add multiple activities to a Collective or Competitive challenge, which is semantically wrong:
- Collective challenges have a single group cumulative target — multiple activities create contradictory targets
- Competitive challenges have one per-member target — multiple activities are undefined behavior
- Only Streak challenges have a meaningful multi-activity checklist model

Additionally, switching challenge type from Streak (which may have multiple activities) to Collective/Competitive did not normalize the activities array, leaving stale extra activities in the payload.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | "Add Another Activity" button hidden unless `challengeType === 'streak'` |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Added `handleTypeChange`: normalizes `activities` to `[activities[0]]` when switching to non-streak; Review step now shows `"[value] [unit] of [activity]"` for collective group target |
| `src/features/Admin/Challenges/CreateChallengeScreen.tsx` | Same `handleTypeChange` normalization |
| `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx` | Same normalization; type-change buttons use `handleTypeChange` |
| `src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx` | Same normalization via `onTypeChange={handleTypeChange}` |
| `scripts/testChallengeActivityModel.ts` | **New** — 15 static guards covering all 5 enforcement points + streak engine idempotency |
| `package.json` | Added `test:challenge-activity-model` script |

---

## Key Design Decisions

### Button visibility (ChallengeActivitySection)
The enforcement happens at the component level — the "Add Another Activity" button is conditionally rendered only for `challengeType === 'streak'`. This is the correct layer: the prop already carries the type, so no prop additions needed.

### Normalization on type switch (handleTypeChange)
When a creator switches from Streak → Collective/Competitive with >1 activity, the activities array is silently normalized to `[prev[0]]`. The first activity is kept (the creator's primary intent), extras are dropped. This prevents stale multi-activity payloads reaching the backend.

### Backward compatibility
Existing Collective/Competitive challenges that were created with multiple activities (before this fix) are not affected — the change only applies to the creation/edit UX. The logging screens already handle single-activity challenges correctly.

### Streak same-day idempotency
The `streakEngine.ts` already handles multi-activity streak logging correctly: `prevLastLogDate === today` → `newStreak = prevStreak` (no double increment). Logging Activity 1 today sets `lastLogDate = today`; logging Activity 2 today leaves the streak unchanged. No service-layer changes needed.

---

## Collective Review Step Enhancement

The Review screen (wizard step 4) for collective challenges now shows:

```
Group target | 500 Reps of Pushups
```

Previously it showed only `500`. The activity unit and name are derived from `activities[0]`.

---

## Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ built in 3.15s |
| `npm run test:challenge-activity-model` | ✅ 15/15 |
| `npm run test:group-lifecycle` | ✅ 64/64 |
| `npm run test:challenge-creation-6combos` | ✅ all passed |
| `npm run test:challenge-creation-backend` | ✅ passed |
| `npm run test:home-challenge-feeds` | ✅ passed |
| `npm run test:scoring-guards` | ✅ passed |
| `npm run audit:challenge-creation-payloads` | ✅ all passed |
