# Phase 18G-2E — Service Safety Guards

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Fixes

### Fix 1 — `leaveChallenge` blocked after activity is logged

**Problem:** Any active challenge member could call `leaveChallenge` even after logging workouts or wellness activities. This would set their membership to `abandoned`, removing them from leaderboards while their logged data (groupCurrentTotal contributions, log documents) remained in Firestore — corrupting team totals and ranking.

**Fix — `src/services/challengeService.ts`:**

Added a guard immediately after the existing `status !== 'active'` early-return, before any writes:

```ts
if ((membership.activitiesCompleted ?? 0) > 0) {
  throw new Error(
    'You have already logged activity in this challenge and cannot leave. Contact your group admin if you need to be removed.',
  );
}
```

- Uses `activitiesCompleted` — the canonical field incremented by all scoring engines on every log event
- The `?? 0` handles missing-field legacy docs safely
- Members who joined but haven't logged yet can still leave normally
- Admins/creators are not affected — this is a service-level guard on the member path, not a rules change

---

### Fix 2 — Firestore wellnessLogs v1 rule: `points >= 1` → `points >= 0`

**Problem:** The v1 branch of the wellnessLogs `allow create` rule required `points >= 1`:

```js
? request.resource.data.points >= 0   // v2: already correct
: request.resource.data.points >= 1   // v1: blocks 0-point logs
```

A user logging a valid wellness activity (e.g. a hydration entry that fell below the minimum-effort threshold) could receive `pointsEarned: 0` from `computeActivityScore`. The v1 rule would then deny the Firestore write even though the log itself was legitimate.

**Fix — `firestore.rules`:**

```js
// Before:
: request.resource.data.points >= 1

// After:
: request.resource.data.points >= 0
```

Both branches now allow `points >= 0`. Zero-point logs are valid; negative points are still rejected.

---

## 2. Known Issue (deferred — post-18H logging audit)

`wellnessLogService.logMeditation` spreads `moodBefore` and `moodAfter` into `metadata`. If either is `undefined` (user didn't fill in mood fields), the metadata object contains `undefined` values that Firestore's `writeBatch.set` will strip silently. The log is written but the mood fields are lost with no error. This should be audited and fixed after Phase 18H as part of a broader metadata undefined-field cleanup.

---

## 3. What Was Not Changed

- `joinChallenge` — untouched
- `participantCount` — not written by client (trigger-only authority maintained)
- Logging UI (`LogWorkoutScreen`, `LogWellnessActivityScreen`) — untouched
- Challenge creation wizard (`CreateChallengeWizard`) — untouched
- Streak logic, activity picker, scoring engines — untouched
- Firestore rules for any collection other than `wellnessLogs` — untouched

---

## 4. Files Changed

| File | Change |
|---|---|
| `src/services/challengeService.ts` | Added `activitiesCompleted > 0` guard in `leaveChallenge` |
| `firestore.rules` | Changed v1 wellnessLogs points branch from `>= 1` to `>= 0` |
| `scripts/testScoringGuards.ts` | Added 7 regression guards (section 18G-2E) |

---

## 5. Regression Guards Added

| ID | What it guards |
|---|---|
| 18G-2E-1 | `leaveChallenge` reads `activitiesCompleted` before permitting leave |
| 18G-2E-2 | `leaveChallenge` throws when `activitiesCompleted > 0` |
| 18G-2E-3 | Leave block is conditional (not unconditional — pre-log members can still leave) |
| 18G-2E-4 | `participantCount` not written by `joinChallenge` or `leaveChallenge` |
| 18G-2E-5 | All wellnessLogs `points` conditions allow `>= 0`; `>= 1` is absent |
| 18G-2E-6 | `LogWorkoutScreen` and `LogWellnessActivityScreen` have not regressed Minus/Plus/select |
| 18G-2E-7 | `CreateChallengeWizard` file size confirms it was not modified |

---

## 6. Validation

```
npx tsc --noEmit                              → ✅ No errors
npm run build                                 → ✅ Built in 4.06s
npm run test:scoring-guards                   → ✅ All guards passed (incl. new 18G-2E-1…18G-2E-7)
npm run test:home-challenge-feeds             → ✅ All guards passed
firebase deploy --only firestore:rules --dry-run → ✅ Rules compiled successfully
```

Pre-existing warnings (not introduced here):
- `[W] Unused function: isValidChallengeMemberCreate` — pre-existing dead helper
- `[W] Invalid variable name: request` — pre-existing shadowing warning in a helper function
