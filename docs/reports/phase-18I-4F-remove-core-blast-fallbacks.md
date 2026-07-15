# Phase 18I-4F — Remove Legacy "core-blast" Scoring Fallbacks

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers

---

## Firebase Admin Credential Status

| Item | Status |
|------|--------|
| `GOOGLE_APPLICATION_CREDENTIALS` set | **No** |
| Credential file exists | N/A (env var not set) |
| Credential contents printed | No |
| `audit:seeded-challenge-members` can now run | No — requires `GOOGLE_APPLICATION_CREDENTIALS` to be set by the operator |

---

## 1. Full Fallback Audit

### Search terms applied

- `core-blast`, `coreBlast`, `core_blast`
- `fallback`, `default.*engine`, `unknown.*challenge`, `legacy.*scor`, `default.*scor`

### Engine selector (`src/services/challengeEngine/index.ts`) — ✅ Already correct

The `selectEngine()` function already had the correct fail-fast behaviour before this phase:

```ts
export function selectEngine(challenge: EngineSelector): ChallengeEngine {
  if (challenge.engineVersion !== 'v2') return new LegacyEngine();   // all v1
  switch (challenge.challengeType) {
    case 'streak':      return new StreakEngine();
    case 'competitive': return new CompetitiveEngine();
    case 'collective':  return new CollectiveEngine();
    default:
      throw new Error(
        `selectEngine: unknown v2 challengeType "${challenge.challengeType}". ` +
        'Set engineVersion to v1 or use a supported type (streak, competitive, collective).',
      );
  }
}
```

No changes required to the engine selector.

### `core-blast` UI fallback inventory (5 occurrences — all removed)

| File | Line | Pattern | Classification |
|------|------|---------|---------------|
| `ChallengeLeaderboardScreen.tsx` | 93 | `params.get('challengeId') \|\| 'core-blast'` | Missing `challengeId` param → fake challenge ID |
| `ChallengeCompletedScreen.tsx` | 51 | `params.get('challengeId') \|\| 'core-blast'` | Missing `challengeId` param → fake challenge ID |
| `LogWorkoutScreen.tsx` | 78 | `challengeId \|\| 'core-blast'` in backPath URL | Missing `challengeId` → broken back-navigation URL |
| `WorkoutLoggedScreen.tsx` | 29 | `challengeId \|\| 'core-blast'` in `toFeedPath` | Missing `challengeId` → incorrect post-log navigation |
| `WorkoutLoggedScreen.tsx` | 30 | `challengeId \|\| 'core-blast'` in `toCompletionPath` | Missing `challengeId` → incorrect completion navigation |

All 5 are **UI navigation fallbacks**, not scoring fallbacks. None affected the scoring engines or Firestore writes.

### Other fallback patterns — no action needed

- `scoringConfig.ts`: `'fixed'` scoring method is documented as a legacy fallback for `targetValue === 0` — retained intentionally, not a silent engine fallback
- `LegacyEngine`: all v1 challenges (no `engineVersion: 'v2'`) correctly route here — this is explicit, not a default catch-all
- Backfill scripts (`backfillLeaderboardScoring.ts` etc.): contain `// legacy` comments as code annotations — not executable fallback paths

---

## 2. Fixes Applied

### `ChallengeLeaderboardScreen.tsx`

- Added `Navigate` to react-router-dom import
- Changed `params.get('challengeId') || 'core-blast'` → `params.get('challengeId') ?? ''`
- Added early redirect after all hook calls: `if (!challengeId) return <Navigate to="/app/challenges" replace />`
- Queries are already guarded by `enabled: !!challengeId` — they do not fire with empty string

### `ChallengeCompletedScreen.tsx`

- Added `Navigate` to react-router-dom import
- Changed `params.get('challengeId') || 'core-blast'` → `params.get('challengeId') ?? ''`
- Added early redirect before path constants: `if (!challengeId) return <Navigate to="/app/challenges" replace />`

### `LogWorkoutScreen.tsx`

```ts
// Before:
const backPath = `/app/workouts/select-activity?challengeId=${challengeId || 'core-blast'}...`;

// After:
const backPath = challengeId
  ? `/app/workouts/select-activity?challengeId=${challengeId}...`
  : '/app/challenges';
```

### `WorkoutLoggedScreen.tsx`

```ts
// Before:
const toFeedPath = groupId ? `/app/group/${groupId}/feed` : `/app/challenges/collective?challengeId=${challengeId || 'core-blast'}`;
const toCompletionPath = `/app/challenges/completed?challengeId=${challengeId || 'core-blast'}...`;

// After:
const toFeedPath = groupId
  ? `/app/group/${groupId}/feed`
  : (challengeId ? `/app/challenges/collective?challengeId=${challengeId}` : '/app/challenges');
const toCompletionPath = challengeId
  ? `/app/challenges/completed?challengeId=${challengeId}...`
  : '/app/challenges';
```

---

## 3. Remaining Scoring Engines

| Engine | Version | Challenge type | Status |
|--------|---------|---------------|--------|
| `LegacyEngine` | v1 (all non-v2) | all types | Active |
| `StreakEngine` | v2 | `streak` | Active |
| `CompetitiveEngine` | v2 | `competitive` | Active |
| `CollectiveEngine` | v2 | `collective` | Active |

Unknown v2 type → `selectEngine` throws: `selectEngine: unknown v2 challengeType "X"`. **No silent fallback anywhere.**

---

## 4. What Was Not Changed

- Scoring formulas — untouched ✅
- `selectEngine` — already correct; untouched ✅
- Leaderboard sorting (`sortLeaderboardRows`) — untouched ✅
- Participant aggregation — untouched ✅
- Progress calculations — untouched ✅
- Firestore schema / rules — untouched ✅
- `LegacyEngine` — retained for all v1 challenges ✅

---

## 5. Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | `Navigate` import; `challengeId` fallback → `''`; early redirect guard |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | `Navigate` import; `challengeId` fallback → `''`; early redirect guard |
| `src/features/Workouts/LogWorkoutScreen.tsx` | `backPath` fallback → `/app/challenges` |
| `src/features/Workouts/WorkoutLoggedScreen.tsx` | `toFeedPath` + `toCompletionPath` fallbacks → `/app/challenges` |
| `scripts/testScoringGuards.ts` | Added guards 18I-4F-1 through 18I-4F-7 |

---

## 6. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-4F-1 | No `core-blast` string in any of the 4 affected UI files |
| 18I-4F-2 | `ChallengeLeaderboardScreen` uses `Navigate` to redirect when `challengeId` missing |
| 18I-4F-3 | `ChallengeCompletedScreen` uses `Navigate` to redirect when `challengeId` missing |
| 18I-4F-4 | `LogWorkoutScreen` backPath uses `/app/challenges` fallback, not `core-blast` |
| 18I-4F-5 | `WorkoutLoggedScreen` path fallbacks use `/app/challenges`, not `core-blast` |
| 18I-4F-6 | `selectEngine` still throws descriptive error for unknown v2 `challengeType` |
| 18I-4F-7 | `selectEngine` still routes `streak`, `competitive`, `collective` correctly |

---

## 7. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 3.60s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-4F-1…7)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
npm run audit:seeded-challenge-members    → ⚠️  Requires GOOGLE_APPLICATION_CREDENTIALS (not set)
```
