# Phase 15B — Callable Validation Parity

**Date:** 2026-06-26
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** `functions/src/challengeCreationBackend.ts`, `scripts/testScoringGuards.ts`
**Code changes:** Yes — validation additions only; no Firestore schema changes; no transaction behaviour changes

---

## Goal

Bring `createChallengeWithCreatorMembership` to full business-validation parity with the client-side `challengeService.createChallenge()`, so that invalid payloads are rejected server-side with clear `HttpsError('invalid-argument', ...)` messages before any Firestore writes occur.

---

## Validation Rules Added

### General input

| Rule | Status before | Status after |
|---|---|---|
| `name` 3–120 chars | ✅ already present | ✅ unchanged |
| `description` 1–2000 chars | ✅ already present | ✅ unchanged |
| `durationDays` ≥ 1 | ✅ already present (min: 1) | ✅ unchanged |
| `endDate` after `startDate` | ✅ already present | ✅ unchanged |
| At least one activity | ❌ missing | ✅ **added** — throws after `normalizeActivities()` |
| Max 30 activities | ✅ silently sliced | ✅ unchanged (slice is intentional, not an error) |
| Duplicate activity IDs | ❌ missing | ✅ **added** — `seenIds` Set on `exerciseId` / `activityId` |
| Activity `targetValue` > 0 | ✅ already present (`requirePositiveNumber`) | ✅ unchanged |

### Engine / type fields

| Rule | Status before | Status after |
|---|---|---|
| Invalid `challengeType` | Silent default to `'collective'` | ✅ **throws** for non-empty unknown values; `undefined`/`null`/`''` still defaults |
| Invalid `engineVersion` | Silent downgrade to `undefined` | ✅ **throws** for non-empty non-`'v2'` values via `requireEngineVersion()` |
| Invalid `targetType` on activities | Silent drop to `undefined` | ✅ **throws** for non-empty non-`'daily'`/non-`'cumulative'` values |

### Collective engine

| Rule | Status before | Status after |
|---|---|---|
| Mixed-unit activities | ✅ checked inside transaction | ✅ **moved before transaction** (fail-fast) |
| `groupCumulativeTarget` > 0 when provided | `min: 0` allowed 0 | ✅ **added** explicit `> 0` check |
| `autoCompleteOnGroupTarget` must be boolean | ✅ `=== true` guard | ✅ unchanged |

### Streak engine

| Rule | Status before | Status after |
|---|---|---|
| `requiredConsecutiveDays` ≥ 1 | ✅ `min: 1` | ✅ unchanged |
| `requiredConsecutiveDays` ≤ `durationDays` | ❌ missing | ✅ **added** |
| `streakResetOnMiss` must be boolean | ✅ `=== true` guard | ✅ unchanged |

### Competitive engine

| Rule | Status before | Status after |
|---|---|---|
| Activity `targetValue` > 0 | ✅ `requirePositiveNumber` | ✅ unchanged |

### Donation

| Rule | Status before | Status after |
|---|---|---|
| `enabled: true` requires payment contact method | ❌ missing | ✅ **added** — throws if no `contributionPhoneNumber` and no `contributionCardUrl` |

---

## Files Changed

### `functions/src/challengeCreationBackend.ts`

**Helpers modified:**
- `normalizeChallengeType` — now throws `HttpsError('invalid-argument', ...)` for non-empty unknown `challengeType` values; `undefined`/`null`/`''` still defaults to `'collective'`
- `normalizeTargetType` — now throws `HttpsError('invalid-argument', ...)` for non-empty invalid values; `undefined`/`null`/`''` still returns `undefined`
- `requireEngineVersion` (new helper) — returns `'v2'` for `'v2'`; throws for non-empty non-`'v2'`; returns `undefined` for absent values

**Core function changes:**
- `engineVersion` assignment uses `requireEngineVersion(input.engineVersion)` instead of an inline conditional
- `normalizeActivities(input.activities)` moved **before** `db.runTransaction` (was inside)
- Added pre-transaction validation block:
  - Empty activity check
  - Duplicate activity ID detection
  - Collective `groupCumulativeTarget > 0` check
  - Collective mixed-unit check (moved from inside transaction)
  - Streak `requiredConsecutiveDays <= durationDays` check
  - Donation consistency check (`enabled === true` requires phone or card URL)

### `scripts/testScoringGuards.ts`

Added 12 regression guards (15B-1 through 15B-12):

| Guard | What it verifies |
|---|---|
| 15B-1 | `normalizeChallengeType` throws for unknown challengeType |
| 15B-2 | `requireEngineVersion` helper exists and throws for invalid engineVersion |
| 15B-3 | `requireEngineVersion()` is called in the core function |
| 15B-4 | `normalizeTargetType` throws for invalid non-empty targetType |
| 15B-5 | Empty activity list is rejected |
| 15B-6 | Duplicate activity IDs are rejected |
| 15B-7 | `groupCumulativeTarget` of 0 or less is rejected for collective |
| 15B-8 | Mixed-unit collective validation is present |
| 15B-9 | `requiredConsecutiveDays > durationDays` is rejected for streak |
| 15B-10 | Donation-enabled without payment contact method is rejected |
| 15B-11 | `normalizeActivities` runs before `runTransaction` (fail-fast) |
| 15B-12 | Duplicate activity check runs before `runTransaction` |

---

## Build Output

```
npm --prefix functions run build
> tsc -p tsconfig.json
(exit 0 — no errors)
```

---

## Guard Run Output

```
npx tsx scripts/testScoringGuards.ts
[all prior guards pass]
scoring guards passed
(exit 0)
```

---

## Backwards Compatibility

All changes are backwards compatible:
- Fields that were previously absent/`undefined` continue to produce the same result
- `challengeType` defaults to `'collective'` when omitted
- `engineVersion` is `undefined` when omitted
- `targetType` is `undefined` when omitted
- The only behaviour change for existing callers is that **explicitly invalid values now throw instead of silently correcting** — which is the desired behaviour for a server-side validation boundary

---

## What Remains for Full Migration (Phase 15C)

The callable is now validation-complete. Remaining gaps before the wizard can fully migrate to the callable (Phase 14H — Option C Phase B):
- `user.stats.totalChallenges` not incremented by the callable
- Streak creator membership not initialised with `currentStreak: 0` / `longestStreak: 0` on re-join
- Frontend wizard still calls `challengeService.createChallenge()` (client path)
