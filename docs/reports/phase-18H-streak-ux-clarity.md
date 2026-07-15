# Phase 18H — Streak UX Clarity

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Goal

Clarify streak challenge creation and display so users understand:
- Duration (overall challenge window) vs. required consecutive days (the streak target)
- Activity target value = daily amount required per day, not a total
- Current streak vs. best streak vs. required streak

Frequency UI was NOT reintroduced (removed in Phase 17F). Deferred: wellness metadata.moodBefore undefined fix (post-18H logging audit).

---

## 2. Changes

### `src/features/Challenges/CreateChallengeWizard.tsx`

**Step label:** `'Frequency'` → `'Streak'`

The wizard step 2 for streak challenges was still labeled "Frequency" — a remnant from before Phase 17F. Now correctly labeled "Streak".

**Review screen — How you complete it:**
```
Before: "Log every required consecutive day"
After:  "Log the required activity every day"
```

**Review screen — Who wins:**
```
Before: "Longest streak wins"
After:  "Longest streak / first to complete required streak"
```

**Review screen — Streak Settings card:**
- "Required consecutive days" → "Required streak" with `{N} days in a row` value
- "Streak resets" → "Streak resets to 0" (more explicit)
- Added per-activity daily target rows: `{name} | {value} {unit} / day`

---

### `src/features/Challenges/components/ChallengeEngineSettingsSection.tsx`

**"Required Consecutive Days" helper text updated:**
```
Before: "How many days in a row a member must log to win this challenge."
After:  "How many days in a row a member must log to complete this challenge.
         This is separate from the overall challenge duration."
```

**New callout block added:**
```
💡 Activity target = daily amount
The target value you set for each activity is the amount required per day
— not a total. For example, 40 lunges per day or 10,000 steps per day.
```

**Reset toggle helper text updated:**
```
Before: "If off, a missed day pauses the streak without resetting it."
After:  "If off, a missed day pauses the streak without resetting it to zero."
```

---

### `src/features/Challenges/components/ChallengeActivitySection.tsx`

For streak challenges, the target value input label changes:
```
Before: "Target Value"  (all challenge types)
After:  "Daily Target"  (streak only)
        + sub-label: "Amount required per day"
```

---

### `src/features/Challenges/ChallengeDetailScreen.tsx`

The v2 streak section was updated:

| Before | After |
|---|---|
| "Streak Goal" section header | "Streak Challenge" |
| `{N} days in a row` (single line, no label) | `{N}` large + `"days in a row required"` |
| "Longest" sub-label | "Best Streak" |
| "Log the required activity every day to keep the streak alive." | + "Missing a day may reset your streak." added |
| Activities list: `targetLabel(act)` (depends on stored targetType) | New "Daily targets" sub-header + explicit `{value} {unit} / day` per activity |

The "Daily targets" section always shows `/day` for streak activities regardless of whether `targetType` is stored on legacy activity docs, so old challenges display correctly.

---

## 3. What Was Not Changed

- Scoring engines (`StreakEngine`, `CompetitiveEngine`, `CollectiveEngine`) — untouched
- Challenge creation backend / Cloud Functions — untouched
- Firestore rules — untouched
- `participantCount` — untouched
- Join/leave logic — untouched
- Logging services (`workoutService`, `wellnessLogService`) — untouched
- Frequency UI — not reintroduced (remains removed from Phase 17F)
- `wellnessLogService.logMeditation` metadata.moodBefore — deferred to post-18H audit

---

## 4. Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Step label; review copy; streak settings card |
| `src/features/Challenges/components/ChallengeEngineSettingsSection.tsx` | Streak section copy + per-day callout |
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | "Daily Target" label for streak type |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Streak section clarity: Best Streak, Daily targets sub-header, /day labels |
| `scripts/testScoringGuards.ts` | Added 10 guards (section 18H); fixed 18G-2E-7 description |

---

## 5. Guard Fix: 18H-2 and 18H-10

Two guards originally checked for `'2x-week'` and `'3x-week'` string literals to confirm frequency picker options were absent. These strings appear in v1 carry-over type aliases (`ActivityFrequency`, `ActivityRow.frequency`) that are not rendered in the UI.

Updated guards check for rendered UI signals instead:
- `frequencyOptions` (array used in a picker)
- `onFrequencyChange` (handler prop)
- `2×/wk` (rendered label text)

---

## 6. Regression Guards Added (18H)

| ID | What it guards |
|---|---|
| 18H-1 | Wizard streak step is labeled `'Streak'`, not `'Frequency'` |
| 18H-2 | Frequency picker UI (rendered elements) not present in wizard |
| 18H-3 | Engine settings streak section mentions "in a row" |
| 18H-4 | Engine settings streak section mentions "per day" |
| 18H-5 | Activity section shows "Daily Target" label for streak type |
| 18H-6 | Review screen shows "days in a row" for required streak |
| 18H-7 | Review screen shows "/ day" for streak activity targets |
| 18H-8 | `ChallengeDetailScreen` streak section shows "Daily targets" sub-header |
| 18H-9 | `ChallengeDetailScreen` streak section labels longest streak as "Best Streak" |
| 18H-10 | Frequency picker UI not rendered in activity section or engine settings |

---

## 7. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 8.47s
npm run test:scoring-guards               → ✅ All guards passed (incl. new 18H-1…18H-10)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```
