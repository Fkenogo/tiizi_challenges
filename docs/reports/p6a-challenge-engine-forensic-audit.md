# P6A — Challenge Engine Forensic Audit

**Date:** 2026-06-21  
**Branch:** fix/p0-pre-deploy-blockers  
**Constraint:** Evidence only. No fixes. No recommendations. No code changes.

---

## Part 1 — Logging Architecture Map

### Three Challenge Logging Paths

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ PATH A — Wellness Activity Logging                                          │
│                                                                             │
│  LogWellnessActivityScreen                                                  │
│    └─ logWellness.mutateAsync({ activityType })          (activityType from URL) │
│         └─ useLogWellnessActivity (src/hooks/useWorkouts.ts:95-135)        │
│              ├─ normalize: activityType → logType                          │
│              │    'fasting'          → logFasting                          │
│              │    'hydration'|'water'→ logHydration                        │
│              │    'sleep'            → logSleep                            │
│              │    'meditation'|...   → logMeditation                       │
│              │    'social' (else)    → logMeditation (metadata.mappedFrom:'social') │
│              └─ wellnessLogService.writeLog(logType, input)                │
│                   ├─ getDoc challenges/{challengeId}     (read)            │
│                   ├─ getDoc groupMembers/{groupId}_{userId} (read)         │
│                   ├─ getDoc challengeMembers/{challengeId}_{userId} (read) │
│                   └─ batch.commit()                                        │
│                        ├─ batch.set(wellnessLogs/{auto-id})  [create]      │
│                        └─ batch.set(challengeMembers/{id}, {merge:true})  [update] │
│                                                                             │
│  Firestore Rules: isValidWellnessCreate + isSafeChallengeProgressUpdate    │
│  Users collection: NOT written in Path A (post P5X)                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PATH B — Multi-Activity Session Logging                                     │
│                                                                             │
│  SelectChallengeActivityScreen                                              │
│    └─ "Save Activities" → activityLogSessionService.createActivitySession  │
│         ├─ entries.forEach → classify each entry:                          │
│         │    workoutEntry   → workouts/{auto-id}   [create]                │
│         │    wellnessEntry  → wellnessLogs/{auto-id} [create]              │
│         │    normalizedWellnessType(activityType):                         │
│         │       'fasting'         → 'fasting'                              │
│         │       'hydration'|'water'→ 'hydration'                           │
│         │       'sleep'           → 'sleep'                                │
│         │       else (incl.'social')→ 'meditation'                         │
│         └─ batch.commit()                                                  │
│              ├─ N × batch.set(workouts|wellnessLogs) [creates]             │
│              └─ batch.set(challengeMembers/{id}, {merge:true}) [update]    │
│                   completedIncrement = entries.length (not 1)              │
│                                                                             │
│  Firestore Rules: isValidWorkoutCreate / isValidWellnessCreate             │
│                   + isSafeChallengeProgressUpdate                          │
│  Users collection: NOT written in Path B                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│ PATH C — Workout Logging                                                    │
│                                                                             │
│  LogWorkoutScreen                                                           │
│    └─ workoutService.createWorkout(input)                                  │
│         ├─ getDoc challengeMembers/{id}  (read, may call joinChallenge)    │
│         └─ batch.commit()                                                  │
│              ├─ batch.set(workouts/{auto-id})              [create]         │
│              ├─ batch.set(users/{userId}, {merge:true})    [update]         │
│              │    { stats: { totalPoints, totalWorkouts }, lastWorkoutAt } │
│              └─ batch.set(challengeMembers/{id}, {merge:true}) [update]    │
│                                                                             │
│  Firestore Rules: isValidWorkoutCreate + isSafeUserUpdate                  │
│                   + isSafeChallengeProgressUpdate                          │
│  Users collection: WRITTEN in Path C (stats update)                        │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Completion Formula (all paths)

```
configuredActivities = challenge.activities.length   (Path A/B)
                     OR challenge.exerciseIds.length  (Path B fallback)
totalActivities = max(1, configuredActivities, membership.totalActivities)

completedCount = membership.activitiesCompleted + 1         (Path A/C: +1)
               = membership.activitiesCompleted + entries.length  (Path B: +N)
completedCount = min(completedCount, totalActivities)

completionRate = min(100, round(completedCount / totalActivities * 100))
if completionRate >= 100 → status = 'completed'
```

### Scoring Formula (all paths)

```
normalizedBase = round(100 / totalActivities)

scoringMethod is determined by challengeType + activityType:
  challengeType: 'streak'    → streak_binary
  challengeType: 'collective'→ proportional
  activityType in wellness   → binary

streak_binary:  value >= targetValue → points = basePoints, else 0
binary:         value >= targetValue → points = basePoints, else 0
proportional:   points = round(basePoints * min(value / targetValue, 1.5))

points = min(ACTIVITY_WRITE_LIMITS.maxWellnessPoints, max(0, scoredPoints))
```

### joinChallenge Write

```
challengeMembers/{challengeId}_{userId} created with:
  totalActivities: Array.isArray(challenge.activities) ? challenge.activities.length : 0
  activitiesCompleted: 0
  totalPoints: 0
  status: 'active'
  completionRate: 0
```

---

## Part 2 — Challenge Completion Audit: "Squat + Pushup 50"

**Challenge ID:** `Uqx8beHESmfbyelkkmZ0`

### Challenge Document (production)

```
title:           "Squat + Pushup 50"
description:     "Can you do 50 squats + 50 Push-ups daily for 21 days?"
status:          "active"
challengeType:   "streak"
startDate:       "2026-06-05"
endDate:         "2026-06-26"
durationDays:    21
groupId:         "seed_group_strength_club"
activities:      [
  { activityId: "squats-50-reps", label: "Squats",   targetValue: 1050, unit: "reps" },
  { activityId: "pushups-50-reps",label: "Push-ups", targetValue: 1050, unit: "reps" }
]
activities.length = 2
```

### Members (production)

| membershipId | userId | totalActivities | activitiesCompleted | completionRate | status | joinedAt |
|---|---|---|---|---|---|---|
| `Uqx8beHESmfbyelkkmZ0_OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | OAKeNr... | 2 | 2 | 100 | completed | 2026-06-13T09:27:42 |
| `Uqx8beHESmfbyelkkmZ0_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | sMfC7P... | 0 | 0 | 0 | active | 2026-05-25T... |
| `Uqx8beHESmfbyelkkmZ0_IePfI31u...` | IePfI3... | 0 | 0 | 0 | active | 2026-05-25T... |

### Why "completed" with 8 days remaining

**Step 1 — totalActivities set at join time:**  
`joinChallenge` writes `totalActivities: challenge.activities.length`.  
For OAKeNr: joined 2026-06-13 when `activities.length = 2` → `totalActivities = 2`.

**Step 2 — Two logging events (Day 8):**  
10 workout documents exist for this challenge. 2 belong to OAKeNr on 2026-06-13, one for each activityId.  
After first log: `activitiesCompleted = 1`, `completionRate = 50%`.  
After second log: `activitiesCompleted = 2 = totalActivities`, `completionRate = 100%`, `status = 'completed'`.

**Step 3 — Completion date vs endDate:**  
`completedAt: 2026-06-13`. `endDate: 2026-06-26`. 13 days of the challenge remain. The member is locked out by the client-side check: `if (membership.status === 'completed') throw new Error('You have already completed this challenge.')`.

### Root cause of premature completion

`totalActivities = activities.length = 2` counts **exercise types**, not **streak days**.  
The challenge intends 50 reps of each exercise per day for 21 days (= 42 total sessions).  
The data model stores `2`, so `2 completions = 100%`.

### Scoring: why all points = 0

```
challengeType: 'streak' → scoringMethod: 'streak_binary'
streak_binary: value >= targetValue ? basePoints : 0

Logged workouts for OAKeNr:
  activityId: squats-50-reps,  value: 50, targetValue: 1050 → 50 < 1050 → 0 pts
  activityId: pushups-50-reps, value: 50, targetValue: 1050 → 50 < 1050 → 0 pts
```

**The targetValue mismatch:** The challenge description says "50 reps daily" but `targetValue: 1050` is the cumulative total for 21 days (21 × 50 = 1050). A single session logging the daily target (50 reps) never meets the `targetValue` for streak scoring. Every workout log for this challenge produces 0 points.

### Members with totalActivities = 0

sMfC7P and IePfI3 joined on 2026-05-25 — before the challenge `activities` array was populated. `joinChallenge` ran `Array.isArray(challenge.activities) ? challenge.activities.length : 0` at a time when `activities` was `[]` or not yet set, yielding `totalActivities = 0`.

For these members: `totalActivities = max(1, 2, 0) = 2` (runtime value, from `configuredActivities`). Their first two workout logs would also complete the challenge.

---

## Part 3 — Scoring Audit: "8-Hour Sleep Streak"

**Challenge ID:** `yv1EGn1flBo8euOwQ5Ww`  
**Member:** `sMfC7PsPp7cpGwnr3tGvsKSEOB32`

### Challenge Document (production)

```
title:         "8-Hour Sleep Streak"
challengeType: "streak"
startDate:     "2026-06-06"
endDate:       "2026-06-26"
durationDays:  20  (implied; 20 days)
groupId:       "seed_group_early_birds"
activities:    [
  { activityId: "sleep-8hr-nightly", activityType: "sleep", targetValue: 8, unit: "hours" }
]
activities.length = 1
```

### Member Pre-log State (production)

```
membershipId:        yv1EGn1flBo8euOwQ5Ww_sMfC7PsPp7cpGwnr3tGvsKSEOB32
activitiesCompleted: 0
totalActivities:     1
totalPoints:         0
status:              "active"
completionRate:      0
lastActivityAt:      (none)
```

### Hypothetical Log: value = 8 hours

**Completion calculation:**
```
configuredActivities = 1
totalActivities = max(1, 1, 1) = 1
normalizedBase = round(100 / 1) = 100

computeActivityScore({
  value: 8,
  targetValue: 8,
  challengeType: 'streak',
  activityType: 'sleep',
  basePoints: 100
})
→ scoringMethod: 'streak_binary'
→ 8 >= 8 → metTarget: true → pointsEarned: 100

completedCount = min(0 + 1, 1) = 1
completionRate = min(100, round(1 / 1 * 100)) = 100
status = 'completed'
completedAt = serverTimestamp()
```

**Post-log state (hypothetical):**
```
activitiesCompleted: 1
totalPoints:         100
completionRate:      100
status:              "completed"
lastActivityAt:      [serverTimestamp]
```

**A 20-day streak challenge completes on the first log.** One sleep entry of ≥8 hours yields `status: 'completed'`, regardless of how many days remain.

### wellnessLogs Written

`wellnessLogs` query for `challengeId = yv1EGn1flBo8euOwQ5Ww` → **0 documents**. No log has ever been successfully written. See Part 4 for root cause.

---

## Part 4 — Wellness Failure Audit: "8-Hour Sleep Streak"

### Evidence: Zero Writes

| Collection | Query | Result |
|---|---|---|
| `wellnessLogs` | `challengeId == yv1EGn1flBo8euOwQ5Ww` | **0 documents** |
| `wellnessLogs` | `challengeId == pyOO8M1SIBDBV3HCiiuP` | **0 documents** |
| `challengeMembers` | `yv1EGn1flBo8euOwQ5Ww_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | `activitiesCompleted: 0` |
| `challengeMembers` | `pyOO8M1SIBDBV3HCiiuP_OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | `activitiesCompleted: 0` |

No wellness activity has ever been successfully logged for either wellness challenge.

### Confirmed Production Error (Social Challenge)

From browser console logs captured in P5X:

```json
[wellnessLogService] batch commit failed
{
  "code": "permission-denied",
  "message": "Missing or insufficient permissions.",
  "plannedWrites": ["wellnessLogs create", "challengeMembers update", "users update"],
  "challengeId": "pyOO8M1SIBDBV3HCiiuP",
  "groupId": "zGO3H0GUZyKwQhbLuNyQ",
  "activityId": "social-interaction-daily",
  "logType": "meditation",
  "value": 1,
  "unit": "interactions",
  "points": 100,
  "targetValue": 1,
  "completionRate": 100,
  "scoringVersion": "v2",
  "membershipStatus": "active"
}
```

The log shows THREE planned writes at the time of the error. The `users update` write is the third write and the root cause of the failure.

### Root Cause: P5W `batch.update` with Dotted Field Paths

The P5W phase changed wellness logging to use `batch.update(userRef, { 'stats.totalPoints': increment(n), 'stats.totalWorkouts': increment(1), lastWorkoutAt })`.

**How Firestore security rules evaluate `diff().affectedKeys()`:**

| Client operation | `diff().affectedKeys()` in rules |
|---|---|
| `batch.set(ref, { stats: { totalPoints, totalWorkouts } }, { merge: true })` | `{'stats', 'lastWorkoutAt'}` |
| `batch.update(ref, { 'stats.totalPoints': ..., 'stats.totalWorkouts': ... })` | `{'stats.totalPoints', 'stats.totalWorkouts', 'lastWorkoutAt'}` |

`isSafeUserUpdate` (firestore.rules line 156):
```
request.resource.data.diff(resource.data).affectedKeys().hasOnly(userSelfWritableFields())
```

`userSelfWritableFields()` contains `'stats'` (top-level key) but not `'stats.totalPoints'` or `'stats.totalWorkouts'`. When `batch.update` uses dotted field paths, Firestore rules surfaces literal dotted path strings in `affectedKeys()`. The `hasOnly()` check fails → `isSafeUserUpdate` returns false → `users update` denied → entire batch rejected.

### Write Sequence Replay: Sleep Challenge (current code, post P5X)

Current `wellnessLogService.ts` (post P5X) has **2 writes**, not 3. The `users update` was removed from wellness logging entirely.

**Write 1: `wellnessLogs create`**

Payload keys for sleep log:
```
userId, groupId, challengeId, activityId, logType, value, unit, points,
rawValue, targetValue, metTarget, scoringMethod, capped, scoringVersion,
notes, date, createdAt, loggedAt, metadata
```

Rule: `isValidWellnessCreate`:

| Check | Value | Pass? |
|---|---|---|
| `keys().hasOnly(wellnessClientCreateFields())` | all keys in allowlist | ✅ |
| `!keys().hasAny(activityServerOnlyFields())` | no server fields present | ✅ |
| `userId == request.auth.uid` | sMfC7P | ✅ |
| `challengeId.size() > 0` | `yv1EGn1flBo8euOwQ5Ww` | ✅ |
| `groupId.size() > 0` | `seed_group_early_birds` | ✅ |
| `isValidActivityContext` (challenge.status) | `'active'` | ✅ |
| `isValidActivityContext` (groupMember.status) | `'joined'` ✅ (rules allow 'joined') | ✅ |
| `isValidActivityContext` (challengeMember.status) | `'active'` | ✅ |
| `isValidActivityTimestamps` | `createdAt == request.time && loggedAt == request.time` | ✅ |
| `logType in ['fasting','hydration','sleep','meditation']` | `'sleep'` | ✅ |
| `value > 0 && <= 10000` | `8` | ✅ |
| `scoringVersion == 'v2' → points >= 0` | `100 >= 0` | ✅ |
| `points <= 1000` | `100` | ✅ |
| `unit.size() > 0` | `'hours'` | ✅ |
| `metadata is map` | `{ bedtime, wakeTime, quality }` | ✅ |
| All optional fields type-safe | metTarget:bool, targetValue:number, etc. | ✅ |

**Write 1 passes all rule conditions.** ✅

**Write 2: `challengeMembers update`**

Payload for sleep log (if `completionRate = 100`):
```
activitiesCompleted: 1
totalPoints: increment(100)
lastActivityAt: serverTimestamp()
completionRate: 100
status: 'completed'
completedAt: serverTimestamp()
```

Rule: `isSafeChallengeProgressUpdate`:

| Check | Value | Pass? |
|---|---|---|
| `affectedKeys().hasOnly([...allowlist...])` | `activitiesCompleted, totalPoints, lastActivityAt, completionRate, status, completedAt` | ✅ |
| `activitiesCompleted <= activityCount` | `1 <= configuredChallengeActivityCountFrom(challenge) = activities.size() = 1` | ✅ |
| `totalPoints` increment constraint | `increment(100) <= 1000` | ✅ |
| completion pairing valid | `completionRate=100 + status='completed' + completedAt` all present together | ✅ |

**Write 2 passes all rule conditions.** ✅

**Conclusion:** Post P5X, the sleep challenge write sequence should succeed. The P5W regression (dotted path `batch.update`) was the sole cause of the permission-denied failure. The fix removed the users write from wellness logging.

### Social Challenge: activityType Fallthrough

`activityType: "social"` → `useLogWellnessActivity` dispatch:
```
if ('fasting') → ...
else if ('hydration'|'water') → ...
else if ('sleep') → ...
else if ('meditation'|'mindfulness'|'breathing') → ...
else → logMeditation({ ..., metadata: { mappedFrom: 'social' } })
```
Result: `logType = 'meditation'`. The `wellnessLogs create` rule allows `logType in ['fasting','hydration','sleep','meditation']`, so `'meditation'` passes. This is not a rules failure — it's an intentional (if lossy) type coercion. The logged activityId remains `'social-interaction-daily'` but the document carries `logType: 'meditation'`.

---

## Part 5 — Data Model Audit: completionRate Semantics

### Field Definitions

| Field | Written by | Value | Semantic |
|---|---|---|---|
| `totalActivities` | `joinChallenge` | `challenge.activities.length` | Number of **activity types** configured on the challenge at join time |
| `activitiesCompleted` | logging services | increment by 1 (Path A/C) or N (Path B) | Total number of **logging events** for this member |
| `completionRate` | logging services | `(activitiesCompleted / totalActivities) * 100` | % of activity types logged at least once |
| `status` | logging services | `'completed'` when `completionRate >= 100` | Whether the member has reached `totalActivities` logs |

### Intended vs Implemented

**Intended (from challenge descriptions):**
- "50 squats + 50 Push-ups **daily for 21 days**" → expects 42 total logging events (2 types × 21 days)
- "8-Hour Sleep Streak" (20-day) → expects 20 total logging events (1 type × 20 days)
- "1 Daily Social Connection" (7-day) → expects 7 total logging events (1 type × 7 days)

**Implemented:**
- `totalActivities = activities.length` = 2 (Squat + Pushup) or 1 (sleep/social)
- Completion after 2 logs (Squat + Pushup) or 1 log (sleep, social)
- `durationDays` is stored on the challenge document but never used in completion calculation

### Consequence

| Challenge | activities.length | Expected logs (daily × days) | Actual to complete |
|---|---|---|---|
| Squat + Pushup 50 (21d) | 2 | 42 | **2** |
| 8-Hour Sleep Streak (20d) | 1 | 20 | **1** |
| 1 Daily Social Connection (7d) | 1 | 7 | **1** |
| 7-Day Hydration Challenge | 1 | 7 | **1** |

### Rule-Side configuredChallengeActivityCountFrom

```
function configuredChallengeActivityCountFrom(challenge) {
  return challenge.data.activities.size() > 0
    ? challenge.data.activities.size()
    : (challenge.data.exerciseIds.size() > 0 ? challenge.data.exerciseIds.size() : 1);
}
```

The Firestore rule also uses `activities.size()` (not `durationDays * activities.size()`), so the rule and the client are consistent — both are wrong relative to the challenge descriptions.

---

## Part 6 — UX Flow Audit

### Home Screen

**Source:** `src/features/Home/useHomeScreen.ts`

**Active challenges card:**
```
getActiveChallengesForUser(uid, 10)
  → Firestore query: challengeMembers where userId=uid AND status='active' LIMIT 10
  → client filter: isChallengeOngoing(challenge)
     = status == 'active' AND startDate <= now AND endDate >= now
```
Challenges with `endDate` in the past: present in Firestore query result (status='active'), then removed by `isChallengeOngoing` client filter. They do not appear on Home.

**Trending challenges:**
```
Query 1: challenges where visibility='public' LIMIT 20
Query 2: challenges where groupVisibility='public' LIMIT 20
merged + deduped
→ client filter: isDiscoverableTrendingChallenge
   = isChallengeOngoing AND (visibility='public' OR groupVisibility='public')
```

### Browse / Challenges Screen

**Source:** `src/features/Challenges/ChallengesScreen.tsx`

**Browse tab:**
```
all public challenges (visibility='public' OR groupVisibility='public')
MINUS challenges the user belongs to (membershipIndex)
+ isChallengeOngoing filter
```

**Ongoing tab:**
```
all user memberships WHERE membershipIndex.get(challengeId) !== 'completed'
+ isChallengeOngoing filter on underlying challenge
```

Memberships with `status: 'completed'` are excluded from Ongoing. They appear only if the app has an explicit Completed tab reading the other branch.

### Group Challenges

**Source:** `src/features/Admin/Groups/GroupDetailScreen.tsx`

Reads active challenges via `getGroupActiveChallenges(groupId)` — queries `challenges` collection with `groupId` and `status='active'`. No client-side `isChallengeOngoing` filter applied at read time (audit finding from P0 phase: expired challenges appear in group detail). This is a separate tracked issue.

### isChallengeOngoing vs Firestore Status

Firestore `status` field is written only by:
- `createChallenge`: sets `'active'`
- `joinChallenge` / logging services: never update challenge status
- There is no TTL-based or scheduled job updating `status` to `'expired'`

Result: challenges past their `endDate` keep `status: 'active'` indefinitely in Firestore. The client-side `isChallengeOngoing` filter in Home and Browse acts as a real-time guard, but group detail and raw queries can surface stale challenges.

**Stale challenges observed in production (as of 2026-06-21):**

From the active challenges query (15 results), several have `endDate` values in the past with `status: 'active'`. The client filters them from Home and Browse but they remain in member queries.

---

## Root-Cause Ranking

| Rank | Issue | Evidence | Impact |
|---|---|---|---|
| 1 | **`totalActivities` counts activity types, not streak days** | All 4 wellness challenges complete in 1-2 logs. `durationDays` never used in completion formula. | High: all streak challenges are broken by design |
| 2 | **P5W `batch.update` dotted path permission failure** | Confirmed production error log, 0 wellnessLogs written, `isSafeUserUpdate` rule analysis | High: wellness logging silently fails; fixed in P5X (code not yet deployed) |
| 3 | **`targetValue` mismatch (cumulative vs daily)** | Squat+Pushup `targetValue: 1050` for "50 reps daily" | High: all workout points = 0 for affected challenges |
| 4 | **`totalActivities: 0` written at join for 2 of 3 members** | sMfC7P and IePfI3 joinedAt before activities populated | Medium: affects completion calculation for early joiners |
| 5 | **`activityType: 'social'` → `logType: 'meditation'` coercion** | Dispatch else-branch in `useLogWellnessActivity`; confirmed in Path B `normalizedWellnessType()` | Medium: social logs recorded as meditation, activityType information lost |
| 6 | **Stale challenges with `status: 'active'` past endDate** | 15 active challenges query; no scheduled status update job | Low: filtered client-side, but pollutes queries |
| 7 | **`batch.set(merge:true)` replaces entire `stats` map** | P5X known tradeoff; `stats.totalChallenges` overwritten | Low: data integrity, tracked as separate issue |

---

## Appendix: Production Data Collected

### Challenge IDs

| ID | Title | challengeType | activities.length | status |
|---|---|---|---|---|
| `Uqx8beHESmfbyelkkmZ0` | Squat + Pushup 50 | streak | 2 | active |
| `yv1EGn1flBo8euOwQ5Ww` | 8-Hour Sleep Streak | streak | 1 | active |
| `pyOO8M1SIBDBV3HCiiuP` | 1 Daily Social Connection | streak | 1 | active |

### GroupMember Documents (relevant to write sequence)

| id | userId | groupId | status |
|---|---|---|---|
| `seed_group_early_birds_sMfC7PsPp7cpGwnr3tGvsKSEOB32` | sMfC7P | seed_group_early_birds | `joined` |
| `zGO3H0GUZyKwQhbLuNyQ_OAKeNrvRkbPOMPjwdKAjqC0tWQK2` | OAKeNr | zGO3H0GUZyKwQhbLuNyQ | `active` |

Both statuses (`joined`, `active`) pass `isValidActivityContext` (rules line 676: `status == 'active' || status == 'joined'`).

### Wellness Logs Queries

```
wellnessLogs where challengeId == 'yv1EGn1flBo8euOwQ5Ww' → 0 results
wellnessLogs where challengeId == 'pyOO8M1SIBDBV3HCiiuP' → 0 results
```
