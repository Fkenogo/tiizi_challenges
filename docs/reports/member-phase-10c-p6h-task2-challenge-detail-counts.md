# Task 2 — CRIT-2: Challenge Detail Counts Fix

**Date:** 2026-06-23  
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Root Causes Fixed

| # | Root Cause | Symptom |
|---|-----------|---------|
| 1 | `useChallengeProgress` only queried `workouts` collection | `totalLogs` = 0 for all wellness challenges (hydration, sleep, etc.) |
| 2 | `myLogs` derived from `workouts` only | `myLogs` = 0 for wellness challenges even after user logged |
| 3 | Participant display: `progress?.uniqueParticipants ?? 0` | Participants showed 0 when Firestore query unavailable |
| 4 | Activity target label had no frequency context | "50 reps" ambiguous — daily? total? |

---

## 2. Files Changed

| File | Change |
|------|--------|
| `src/hooks/useWorkouts.ts` | `useChallengeProgress` rewritten — uses `challengeMembers.activitiesCompleted` sum for `totalLogs`; queries `wellnessLogs` + `workouts` user-scoped for `myLogs` |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Participant display: `|| resolvedChallenge.participantCount || 0` fallback; activity list renders frequency label |
| `scripts/testHomeChallengeFeeds.ts` | 6 new guards added covering all fixes |

---

## 3. Implementation Detail

### `useChallengeProgress` — new logic

```
totalLogs:
  1. Query challengeMembers where challengeId == cid (all authenticated users can read)
  2. Sum activitiesCompleted across all member docs
  3. If sum is 0, fall back to workouts collection count (covers challenges where
     members haven't synced their denormalized count yet)

myLogs:
  1. Query workouts where challengeId == cid AND userId == uid
  2. Query wellnessLogs where challengeId == cid AND userId == uid
     (user-scoped; Firestore rule: resource.data.userId == request.auth.uid)
  3. myLogs = workout count + wellness count

uniqueParticipants:
  Unchanged — getChallengeParticipantCount already correct
  (max(challenge.participantCount, active+completed memberCount))
```

### Participant display fallback

```tsx
// Before (0 when progress query unavailable):
{progress?.uniqueParticipants ?? 0}

// After (falls back to denormalized challenge field):
{progress?.uniqueParticipants || resolvedChallenge.participantCount || 0}
```

Uses `||` (not `??`) so a live `uniqueParticipants` value of `0` also triggers
the fallback to `challenge.participantCount`.

### Activity frequency label

```tsx
const freqLabel = activity.frequency
  ? { daily: '/day', weekly: '/week', '3x-week': '3×/week', custom: '' }[activity.frequency] ?? ''
  : '';
// Renders: "50 reps /day" instead of "50 reps"
```

---

## 4. Firestore Rule Alignment

| Collection | Read rule | Query used |
|------------|-----------|-----------|
| `challengeMembers` | `isAuthenticated()` | `where('challengeId', '==', cid)` — safe |
| `workouts` | `isAuthenticated()` | `where('challengeId', '==', cid).where('userId', '==', uid)` — safe |
| `wellnessLogs` | `resource.data.userId == request.auth.uid` | `where('challengeId', '==', cid).where('userId', '==', uid)` — user-scoped, safe |

No new Firestore indexes required (existing composite indexes cover these queries).

---

## 5. Validation Results

| Command | Result |
|---------|--------|
| `npx tsc -b --pretty false` | ✅ 0 errors |
| `npm run build` | ✅ Built in 10.36s |
| `npm run test:home-challenge-feeds` | ✅ All guards passed (9 guards total) |
| `firebase deploy --only firestore:rules --dry-run` | ✅ Rules compiled successfully |

---

## 6. Guard Summary (testHomeChallengeFeeds.ts)

| Guard | Verifies |
|-------|---------|
| HomeScreen references challenges | Regression guard |
| useHomeScreen fetches challenge data | Regression guard |
| useHomeScreen uses bounded queries | Regression guard |
| Participant fallback to `challenge.participantCount` | CRIT-2 fix |
| Participant uses `\|\|` not `??` | CRIT-2 fix (0 triggers fallback) |
| myLogs and totalLogs computed separately | CRIT-2 fix |
| wellnessLogs queried for myLogs | CRIT-2 fix |
| activitiesCompleted used for totalLogs | CRIT-2 fix |
| Expired challenge shows ended message, not Join | Task 1D regression guard |
| Activity list renders frequency label | CRIT-2 fix |

---

## 7. Remaining Risks

| Risk | Severity | Notes |
|------|----------|-------|
| `activitiesCompleted` denormalization lag | Low | If member doc hasn't been updated yet after a log, totalLogs may be briefly stale. Fallback to `workouts.length` covers the zero-state but not partial lags. Acceptable — this is a display count, not a scoring source. |
| Wellness challenges with no members yet | Low | totalLogs falls back to `workouts.length` → still 0 for wellness. Correct: truly no logs. |
| `activity.frequency` not set on older challenges | Low | freqLabel defaults to `''` → no label appended. Correct behavior. |

---

## 8. What Was NOT Changed (Scope Boundary)

- No Firestore rules changes
- No new Firestore indexes
- No scoring or ranking logic
- No challenge creation flows
- No Home or Browse screens
- No `getChallengeParticipantCount` logic (already correct)
