# CRIT-3 Step 3A — ChallengeDetailScreen Correctness + CTA Fix
**Branch:** `fix/p0-pre-deploy-blockers`
**Date:** 2026-06-24
**Status:** Complete — all static checks pass; browser verification requires user sign-in

---

## 1. Root Cause Findings

### Finding 1 — "Ongoing challenges show 'Challenge Completed'" (was data, now fixed)
The 7 Category A memberships had `status: 'completed'` due to the auto-join bug. The CTA correctly showed the "Challenge Completed" banner when `membership.status === 'completed'`. The data was wrong, not the code. **Resolved by CRIT-3 Step 2** — 6 of 7 records moved from `completed → active`.

### Finding 2 — Active member on ended challenge showed wrong CTA
**Root cause:** The `challengeIsOver` guard was placed inside the `(!membership || membership.status !== 'active')` branch. An active member with `hasEnded=true` bypassed that check and fell to `hasEnded ? <disabled "Completed" button>`. Spec requires "This challenge has ended." for all non-`completed` members when the challenge is over.

**Fix:** Moved `challengeIsOver` to the second branch (before the join check), covering all membership states except `status === 'completed'`.

### Finding 3 — My Logs > Total Logs
**Root cause:**
- `myLogs` = `workouts.size + wellnessLogs.size` for current user (raw doc count, **uncapped**)
- `totalLogs` = `sum(challengeMembers.activitiesCompleted)` (**capped** at `totalActivities` per member via `workoutService`)

After a user logs more sessions than `totalActivities`, their raw count exceeds the capped `activitiesCompleted`, making `myLogs > totalLogs`.

**Fix:** Derive `myLogs` from the current user's `activitiesCompleted` in the already-fetched `challengeMembers` snapshot. Same capping applies → always consistent with `totalLogs`. Eliminates 2 extra Firestore reads per page load.

### Finding 4 — Persistent warning text
`membership.status === 'active' && myLogs > 0` always rendered "You've already logged activity — you can't leave a challenge once you've participated." Spec: only show this explanation if the user attempts to leave after logging. **Fixed:** Remove the `else` branch entirely. Leave button is hidden when `myLogs > 0`; no warning text shown.

### Finding 5 — Missing UI: type, mode, current day, daily target, points copy
Simply not rendered. Added all per spec.

### Finding 6 — Leaderboard snapshot data source
**Already correct** from Phase 3A. `useQuery` reads `challengeMembers.totalPoints` directly. Confirmed — no change needed.

---

## 2. Files Modified

| File | Change type |
|---|---|
| `src/hooks/useWorkouts.ts` | Fix myLogs source |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | CTA + UI |
| `scripts/testHomeChallengeFeeds.ts` | Guard update |

---

## 3. Code Diff Summary

### `src/hooks/useWorkouts.ts` — `useChallengeProgress`

```diff
-      // For myLogs, query both collections user-scoped (wellnessLogs rule: own records only).
-      let myLogs = 0;
-      if (userId) {
-        const [myWorkoutsSnap, myWellnessSnap] = await Promise.all([
-          getDocs(query(collection(db, 'workouts'), where('challengeId', '==', challengeId), where('userId', '==', userId))),
-          getDocs(query(collection(db, 'wellnessLogs'), where('challengeId', '==', challengeId), where('userId', '==', userId))),
-        ]);
-        myLogs = myWorkoutsSnap.size + myWellnessSnap.size;
-      }
+      // Derive myLogs from the same challengeMembers snapshot so it is bounded by
+      // activitiesCompleted (capped at totalActivities) — never greater than totalLogs.
+      let myLogs = 0;
+      if (userId) {
+        const myDoc = membersSnap.docs.find(
+          (d) => (d.data() as { userId?: string }).userId === userId,
+        );
+        myLogs = myDoc
+          ? Math.max(0, Number((myDoc.data() as { activitiesCompleted?: number }).activitiesCompleted ?? 0))
+          : 0;
+      }
```

**Effect:** Eliminates 2 Firestore queries per detail page load. `myLogs` is now always ≤ `totalLogs` by construction (both use the same capped `activitiesCompleted` accounting).

---

### `src/features/Challenges/ChallengeDetailScreen.tsx`

**a) `summary` useMemo — added `currentDay`:**
```diff
+    const currentDay = now >= startMs && now <= endMs
+      ? Math.min(durationDays, Math.floor((now - startMs) / oneDay) + 1)
+      : null;
     return {
       durationDays,
+      currentDay,
       statusLabel,
```

**b) New derived labels (after `requiresApproval`):**
```diff
+  const challengeTypeMap: Record<string, string> = { collective: 'Collective', competitive: 'Competitive', streak: 'Streak' };
+  const challengeTypeLabel = resolvedChallenge
+    ? (challengeTypeMap[resolvedChallenge.challengeType ?? ''] ?? 'Challenge')
+    : '';
+  const modeLabel = resolvedChallenge
+    ? (resolvedChallenge.category === 'fitness' ? 'Fitness' : 'Wellness')
+    : '';
```

**c) Info display — added current day and type/mode:**
```diff
   <p className="text-xs text-slate-500">Duration: {summary?.durationDays} day{...}</p>
+  {summary?.currentDay !== null && summary?.currentDay !== undefined && (
+    <p className="text-xs text-slate-500">Day {summary.currentDay} of {summary.durationDays}</p>
+  )}
+  <p className="text-xs text-slate-500">Type: {challengeTypeLabel} • {modeLabel}</p>
```

**d) Activities — "daily target" label:**
```diff
-  • {activity.exerciseName}: target {activity.targetValue} {activity.unit}
+  • {activity.exerciseName}: daily target {activity.targetValue} {activity.unit}
```

**e) Points copy:**
```diff
-  Meeting the target earns full points; partial effort earns partial points.
+  Hitting the target earns 100 points. Partial effort earns partial points.
```

**f) CTA restructure — `challengeIsOver` moved before join check, `hasEnded` branch removed:**
```diff
   membership?.status === 'completed' ? (
     // Challenge Completed banner
-  ) : (!membership || membership.status !== 'active') && challengeIsOver ? (
+  ) : challengeIsOver ? (
     // "This challenge has ended."
   ) : !membership || membership.status !== 'active' ? (
     // Join Challenge button
   ) : requiresApproval ? (
     // Awaiting Approval
-  ) : hasEnded ? (
-    // Completed (disabled)
   ) : canLogWorkout ? (
     // Log Workout / Log Activity
   ) : (
     // Remind Me
   )}
```

**g) Leave button — persistent warning removed:**
```diff
-  {!!membership && membership.status === 'active' && (
-    (progress?.myLogs ?? 0) === 0 ? (
-      <button>Leave Challenge</button>
-    ) : (
-      <p>You've already logged activity...</p>
-    )
-  )}
+  {!!membership && membership.status === 'active' && !challengeIsOver && (progress?.myLogs ?? 0) === 0 && (
+    <button>Leave Challenge</button>
+  )}
```

---

### `scripts/testHomeChallengeFeeds.ts` — guard update

```diff
-  // Guard: wellnessLogs must be queried for myLogs (not only workouts)
-  assert(
-    useWorkouts.includes("'wellnessLogs'"),
-    'useChallengeProgress must query wellnessLogs for myLogs (wellness challenges)',
-  );
+  // Guard: myLogs must be sourced from activitiesCompleted on the membership doc,
+  // which is incremented by both workoutService and wellnessLogService.
+  assert(
+    useWorkouts.includes('activitiesCompleted') && useWorkouts.includes('myLogs') && useWorkouts.includes('myDoc'),
+    'useChallengeProgress must derive myLogs from membership activitiesCompleted (covers both workout and wellness challenges)',
+  );
```

---

## 4. Commands Executed

```
npx tsc -b --pretty false      → 0 errors
npm run build                  → ✓ built in 8.47s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

---

## 5. Browser Evidence

Browser verification requires user sign-in (not performable programmatically). The following checks should be confirmed manually after deploying to a test environment:

| Check | Expected |
|---|---|
| Pushup mania2 (`1S7cXHuHkwAONHhtSgLD`) — joined active user | "Log Workout" button (not "Join Challenge", not "Challenge Completed") |
| Squat + Pushup 50 (`Uqx8beHESmfbyelkkmZ0`) — joined active user | "Log Workout" button (not "Challenge Completed") |
| 14-day squats marathon (`bIMrgnrblJ0ajQaVtcnF`) — joined active user | "Log Workout" button (not "Challenge Completed") |
| 7-Day Daily Hydration — wellness challenge, joined active | "Log Activity" button |
| Any active challenge detail | Shows "Type: Collective/Competitive/Streak • Fitness/Wellness" |
| Any active challenge detail | Shows "Day N of D" while ongoing |
| Any active challenge detail | Shows "daily target X unit" per activity |
| My Logs counter | Never exceeds Total Logs counter |
| Leaderboard snapshot | Entries ranked by `totalPoints` |
| Joined member with myLogs > 0 | No warning text, no Leave button |
| Joined member with myLogs === 0 | Leave Challenge button visible |
| Ended challenge, any membership state except completed | "This challenge has ended." |

---

## 6. Risks

**Low.** All changes are read-path or display-path only.

- `myLogs` source change: removes 2 Firestore reads. If a user has logged activities but their `challengeMembers` doc doesn't exist (impossible post-Step 1 guard), `myLogs` would be 0. The service-layer guard ensures a membership doc always exists before any log write, so this is unreachable.
- `challengeIsOver` moved earlier: the previous `hasEnded` CTA branch for active members (showing disabled "Completed") is replaced by "This challenge has ended." This is a display-only change; logging is still prevented by `canLogWorkout = !hasEnded`.
- Wellness coverage: `activitiesCompleted` is incremented by both `workoutService` and `wellnessLogService`. The semantic coverage is preserved — wellness logs ARE counted.

---

## 7. Rollback Instructions

All changes are in three files with no Firestore writes. To revert:

```bash
git checkout HEAD -- src/hooks/useWorkouts.ts \
  src/features/Challenges/ChallengeDetailScreen.tsx \
  scripts/testHomeChallengeFeeds.ts
```

---

## 8. CTA Decision Table (post-fix)

| `membership.status` | `challengeIsOver` | `hasStarted` | CTA shown |
|---|---|---|---|
| `'completed'` | any | any | 🎉 Challenge Completed |
| any | `true` | any | This challenge has ended. |
| none / `'left'` / `'abandoned'` | `false` | any | Join Challenge |
| `'active'` | `false` | `false` | Remind Me |
| `'active'` | `false` | `true` | Log Workout / Log Activity |

Leave button visible only when: `status === 'active'` AND `!challengeIsOver` AND `myLogs === 0`.
