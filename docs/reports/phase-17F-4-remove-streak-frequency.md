# Phase 17F-4 — Simplify Streak MVP: Remove Frequency Field

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** Remove "How often?" frequency UI from all Streak challenge screens. No backend, validation, or schema changes.

---

## Decision

For MVP, Streak challenges mean **consecutive daily logging**. The per-activity "How often?" selector conflicted with the engine-level "Required Consecutive Days" field and added complexity without MVP value. The field is removed from all UI; `requiredConsecutiveDays` + `streakResetOnMiss` remain the sole streak controls.

---

## Code Change

**File:** `src/features/Challenges/components/ChallengeActivitySection.tsx`

**Removed (lines 228–244 before edit):**
```tsx
{challengeType === 'streak' && (
  <div className="mt-3">
    <p className="text-[14px] leading-[18px] font-semibold text-slate-800">How often?</p>
    <select
      className="st-input mt-2 appearance-none"
      value={activity.frequency ?? 'daily'}
      onChange={(e) => onUpdateActivity(index, { frequency: e.target.value as ActivityFrequency })}
    >
      <option value="daily">Every day</option>
      <option value="weekly">Once a week</option>
      <option value="2x-week">2 times a week</option>
      <option value="3x-week">3 times a week</option>
      <option value="5x-week">5 times a week</option>
      <option value="custom">Custom</option>
    </select>
  </div>
)}
```

The `challengeType` prop is retained in the component interface (it was required by call sites). It is now unused within the component body — this is intentional and not a TypeScript error.

---

## What Was Not Changed

| Layer | Status |
|---|---|
| `challengeFormValidation.ts` | Unchanged — never validated `frequency` |
| Wizard payload (`handleLaunch`) | Unchanged — sends `frequency: activity.frequency` (remains optional, defaults to `'daily'` for wellness picks, `undefined` for fitness picks — both harmless) |
| `ActivityRow.frequency` field | Unchanged — remains optional in interface |
| `requiredConsecutiveDays` | Unchanged — present and enforced in all streak flows |
| `streakResetOnMiss` | Unchanged |
| Cloud Functions / Firestore / services | Unchanged |
| `ChallengeEngineSettingsSection` | Unchanged |

---

## Six-Combination UI After Fix

| Mode | Challenge Type | "How often?" | Activity Library | Frequency in payload |
|---|---|---|---|---|
| Fitness | Collective | ❌ removed | Fitness | `undefined` |
| Fitness | Competitive | ❌ removed | Fitness | `undefined` |
| Fitness | Streak | ❌ removed | Fitness | `undefined` |
| Wellness | Collective | ❌ removed | Wellness | `'daily'` (set by picker) |
| Wellness | Competitive | ❌ removed | Wellness | `'daily'` (set by picker) |
| Wellness | Streak | ❌ removed | Wellness | `'daily'` (set by picker) |

Frequency is harmless in the Firestore write — the streak engine reads `requiredConsecutiveDays` and `streakResetOnMiss`, not `frequency`.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Removed `{challengeType === 'streak' && (...)}` frequency block |
| `scripts/auditChallengeCreationPayloads.ts` | Created — static audit script (8 guards) |
| `package.json` | Added `audit:challenge-creation-payloads` script |

---

## Test & Audit Results

### Static payload audit (`npm run audit:challenge-creation-payloads`)
```
✅ 1. No "How often?" label in any creation/edit screen
✅ 2. All four screens use ChallengeActivitySection
✅ 3. All screens include requiredConsecutiveDays in streak payload
✅ 4. Validation does not gate on frequency; streak only requires requiredConsecutiveDays
✅ 5. All 6 mode×type combinations pass validateChallengeForm (no frequency required)
✅ 6. Streak payload: requiredConsecutiveDays present; frequency optional and not required
✅ 7. EditChallengeTemplateScreen uses shared section, old datalist UI removed
✅ 8. EditWellnessTemplateScreen passes isWellnessMode={true}

auditChallengeCreationPayloads: all guards passed ✅
```

### Scoring guards (`npm run test:scoring-guards`)
```
scoring guards passed  (13 guards)
```

### Home challenge feeds (`npm run test:home-challenge-feeds`)
```
✅ testHomeChallengeFeeds: all guards passed
```

### Build
```
npx tsc --noEmit  →  CLEAN (zero errors)
npm run build     →  ✓ built in 11.85s (pre-existing vendor chunk warning only)
```

---

## Remaining Blockers Before Manual Creation Testing

None. All six creation paths are unblocked:
- UI is clean of the frequency field
- Validation passes for all 6 mode×type combinations
- `requiredConsecutiveDays` is validated and included in streak payloads
- All four screens use `ChallengeActivitySection`
- Scoring and home feed guards pass

**Ready for manual creation testing on all six combinations.**
