# Phase 17E-3 — Restore Frequency Field for All Streak Challenges

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** `ChallengeActivitySection` — one-line condition change, no other changes

---

## Problem

Phase 17E-2 used the condition `isWellnessMode && challengeType === 'streak'` to gate the "How often?" frequency selector. This correctly hid it for Wellness + Collective and Wellness + Competitive, but also incorrectly hid it for Fitness + Streak.

---

## Fix

**Old rule:**
```tsx
{isWellnessMode && challengeType === 'streak' && (
  <div className="mt-3">…</div>
)}
```

**New rule:**
```tsx
{challengeType === 'streak' && (
  <div className="mt-3">…</div>
)}
```

Frequency is a meaningful concept for any streak challenge regardless of mode — a member must log activity on consecutive days at a given cadence.

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Challenges/components/ChallengeActivitySection.tsx` | Condition `isWellnessMode && challengeType === 'streak'` → `challengeType === 'streak'` |

`challengeType` remains a required prop. All three call sites (`CreateChallengeWizard`, `CreateChallengeScreen`, `EditWellnessTemplateScreen`) already pass it — no call-site changes needed.

---

## Six-Combination Check

| Mode | Type | "How often?" |
|---|---|---|
| Fitness | Collective | ❌ hidden |
| Fitness | Competitive | ❌ hidden |
| Fitness | Streak | ✅ shown ← restored |
| Wellness | Collective | ❌ hidden |
| Wellness | Competitive | ❌ hidden |
| Wellness | Streak | ✅ shown |

---

## No Logic Changes

Frequency data was already written into `ActivityRow` for all activity picks. Validation, save payloads, Cloud Functions, Firestore rules, and services are untouched.

---

## Build Output

```
npx tsc --noEmit  →  CLEAN (zero errors)
npm run build     →  ✓ built in 10.74s (pre-existing vendor chunk warning only)
```

---

## Remaining Inconsistencies

None. All six mode/type combinations now behave correctly.
