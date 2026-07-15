# Phase 18G-2C.1 — Unified Log Value Picker

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Problem

Both log screens displayed inconsistent value inputs:

- `LogWorkoutScreen`: Minus button + Plus button + visible number display + `<input type="number">` scroll spinner + `<select>` scroll picker
- `LogWellnessActivityScreen`: Minus button + Plus button + visible number display + `<select>` scroll picker (no text input at all)

Additionally, `LogWorkoutScreen` defaulted to a hardcoded `useState(25)` instead of using the selected activity's `targetValue`. This caused collective challenges to show 25 as the default even when the activity target was 700,000 steps.

---

## 2. Fix

### `src/features/Workouts/LogWorkoutScreen.tsx`

**Removed:**
- `Minus`, `Plus` lucide-react imports
- `const valueOptions = useMemo(...)` (entire array)
- JSX: `<p className="text-[48px]">{value}</p>` display text
- JSX: Minus `<button>` and Plus `<button>`
- JSX: `<select>` scroll picker

**Changed:**
- `useState(25)` → `useState(1)` placeholder, then initialized via `useEffect` + `useRef` flag once `currentActivity` loads
- Added `useRef` to react imports for the default-set flag
- Default initializer: `currentActivity.targetValue ?? 1` (never `groupCumulativeTarget`)

**Kept and promoted to sole control:**
```tsx
<input
  type="number"
  inputMode="numeric"
  min={0}
  step={1}
  value={value}
  onChange={(e) => {
    const next = Number(e.target.value);
    if (Number.isNaN(next)) return;
    setValue(Math.max(0, Math.floor(next)));
  }}
  className="w-full h-[80px] rounded-2xl border-2 border-[#f4cdb5] bg-white px-4 text-center text-[40px] leading-[48px] font-black text-[#1b120d] focus:outline-none focus:border-primary"
  aria-label="Workout value"
/>
```

### `src/features/Workouts/LogWellnessActivityScreen.tsx`

**Removed:**
- `Minus`, `Plus` lucide-react imports
- `const valueOptions = useMemo(...)` (entire block, lines 31-48)
- JSX: `<p className="text-[48px]">{value}</p>` display text
- JSX: Minus `<button>` and Plus `<button>`
- JSX: `<select>` scroll picker

**Added:**
```tsx
<input
  type="number"
  inputMode="numeric"
  min={0}
  step={1}
  value={value}
  onChange={(e) => {
    const next = Number(e.target.value);
    if (Number.isNaN(next)) return;
    setValue(Math.max(0, Math.floor(next)));
  }}
  className="w-full h-[80px] rounded-2xl border-2 border-[#f4cdb5] bg-white px-4 text-center text-[40px] leading-[48px] font-black text-[#1b120d] focus:outline-none focus:border-primary"
  aria-label="Wellness value"
/>
```

**Unchanged:** `useState(Math.max(1, targetValue || 1))` — already correctly sourced from the URL `targetValue` param set by `SelectChallengeActivityScreen` from `activity.targetValue` (not `groupCumulativeTarget`).

---

## 3. Default Value Initialization (Workout Screen)

The `useEffect` + `useRef` pattern prevents overwriting the user's edits after initial load:

```ts
const defaultSetRef = useRef(false);
useEffect(() => {
  if (!defaultSetRef.current && currentActivity) {
    const tv = currentActivity.targetValue;
    setValue(tv && tv > 0 ? tv : 1);
    defaultSetRef.current = true;
  }
}, [currentActivity]);
```

- Fires once when `currentActivity` becomes available
- Subsequent renders (React Query re-fetches) do not reset the user's input
- Falls back to `1` if `targetValue` is 0 or absent

---

## 4. What Was Not Changed

- Scoring engines — untouched
- Firestore rules — untouched
- `participantCount` — untouched
- `SelectChallengeActivityScreen` — already passes `activity.targetValue` correctly
- `workoutService` / `wellnessLogService` — untouched
- Engine context banners (collective team progress, competitive cumulative, streak) — untouched

---

## 5. Files Changed

| File | Change |
|---|---|
| `src/features/Workouts/LogWorkoutScreen.tsx` | Removed Minus/Plus/select/display; promoted number input; fixed default from targetValue |
| `src/features/Workouts/LogWellnessActivityScreen.tsx` | Removed Minus/Plus/select/valueOptions/display; added number input |
| `scripts/testScoringGuards.ts` | Added 7 regression guards (section 18G-2C.1) |

---

## 6. Regression Guards Added

| ID | What it guards |
|---|---|
| 18G-2C1-1 | No `Minus` or `Plus` in either screen |
| 18G-2C1-2 | No `<select` in either screen |
| 18G-2C1-3 | No `valueOptions` in either screen |
| 18G-2C1-4 | Both screens have `type="number"` input |
| 18G-2C1-5 | Neither screen initializes value from `groupCumulativeTarget` |
| 18G-2C1-6 | `LogWorkoutScreen` uses `currentActivity.targetValue` (not hardcoded 25) |
| 18G-2C1-7 | `LogWellnessActivityScreen` initializes from `targetValue` URL param |

---

## 7. Validation

```
npx tsc --noEmit              → ✅ No errors
npm run build                 → ✅ Built in 4.02s
npm run test:scoring-guards   → ✅ All guards passed (incl. new 18G-2C1-1…18G-2C1-7)
npm run test:home-challenge-feeds → ✅ All guards passed
```
