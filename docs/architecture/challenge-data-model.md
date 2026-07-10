# Challenge Data Model — Additive Extensions
**Version:** 1.0  
**Date:** 2026-06-25  
**Status:** Specification — No code or Firestore changes made  
**Companion doc:** [challenge-engine-spec.md](./challenge-engine-spec.md)

---

## Design Principles

1. **Additive only.** Every field added here is optional and backwards-compatible. Existing Firestore documents remain valid without migration.
2. **Type determines semantics.** The `challengeType` field already exists in all `challenges` documents. New fields are type-scoped by naming convention and document comments, not schema enforcement.
3. **Individual truth lives in `challengeMembers`.** Group truth (Collective pool) lives on the `challenges` document itself. Raw logs live in `workouts`/`wellnessLogs`. No duplication except for the minimum needed to serve leaderboard and progress queries within Firestore's rule limits.
4. **No field removal.** Fields that are currently populated but semantically wrong for a type (e.g., `activitiesCompleted` on a Competitive challenge) are kept and remain updated — they are still meaningful for "how many times has this user logged?" analytics, even if they no longer drive completion.

---

## 1. Existing Fields (unchanged — reference only)

### `challenges/{challengeId}`

```
id                        string
name                      string
description               string
groupId                   string
category                  'fitness' | wellness sub-categories
challengeType             'collective' | 'competitive' | 'streak'
status                    'draft' | 'active' | 'completed' | 'expired'
startDate                 ISO string (YYYY-MM-DD)
endDate                   ISO string (YYYY-MM-DD)
durationDays              number
activities[]
  exerciseId?             string
  activityId?             string
  activityType?           string
  exerciseName?           string
  targetValue             number      ← semantics defined by targetType (new)
  unit                    string
  frequency?              'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom'
  dailyFrequency?         number
  pointsPerCompletion?    number      ← not used by scoring engine; kept for display
participantCount          number (denormalized)
moderationStatus          string
coverImageUrl             string?
visibility                string?
groupVisibility           string?
donation                  object?
```

### `challengeMembers/{challengeId}_{userId}`

```
challengeId               string
userId                    string
groupId                   string
joinedAt                  Timestamp
status                    'active' | 'completed' | 'abandoned'
activitiesCompleted       number    ← log event counter, capped at totalActivities
totalActivities           number    ← durationDays × activityCount
completionRate            number    ← activitiesCompleted / totalActivities × 100
totalPoints               number    ← running sum of per-session pointsEarned
lastActivityAt            Timestamp?
completedAt               Timestamp?
```

### `workouts/{id}` / `wellnessLogs/{id}`

```
userId, challengeId, groupId
exerciseId / activityId / activityType
value                     number
unit                      string
date                      YYYY-MM-DD
completedAt               ISO timestamp
loggedAt                  Timestamp
points                    number
scoringVersion            string
```

---

## 2. New Fields — `challenges/{challengeId}`

These fields are **optional** and default to `undefined` for legacy challenges. Services must treat `undefined` as the backward-compatible fallback.

```typescript
// Additive fields on the challenges document
{
  // ── Activity target semantics ──────────────────────────────────────────
  /**
   * How targetValue should be interpreted.
   *   'daily'      → per logging session (Streak default; current behavior)
   *   'cumulative' → personal total to accumulate over challenge lifetime (Competitive)
   *   'group-pool' → group-wide cumulative total to reach together (Collective)
   *
   * When undefined: legacy behavior = 'daily'
   */
  targetType?: 'daily' | 'cumulative' | 'group-pool';

  // ── Collective-specific ────────────────────────────────────────────────
  /**
   * The combined value the group must accumulate across all members.
   * Only meaningful when challengeType === 'collective'.
   * When undefined: Collective falls back to the legacy per-member frequency model.
   */
  groupCumulativeTarget?: number;

  /**
   * Running total of all members' logged values for this challenge.
   * Updated atomically in the same batch as individual member log writes.
   * Only populated when challengeType === 'collective'.
   */
  groupCurrentTotal?: number;

  /**
   * Whether the challenge auto-completes when groupCurrentTotal >= groupCumulativeTarget.
   * Default: true for Collective challenges with groupCumulativeTarget set.
   */
  autoCompleteOnGroupTarget?: boolean;

  // ── Streak-specific ────────────────────────────────────────────────────
  /**
   * Minimum number of consecutive calendar days required for streak completion.
   * When undefined: Streak uses legacy frequency model (durationDays × activityCount).
   * When set: completion requires this many consecutive days with ≥1 log each.
   */
  requiredConsecutiveDays?: number;

  /**
   * Whether missing a day resets the member's streak counter.
   * Only meaningful when requiredConsecutiveDays is set.
   * Default: true
   */
  streakResetOnMiss?: boolean;

  // ── Engine version ─────────────────────────────────────────────────────
  /**
   * Which engine schema version this challenge was created under.
   *   undefined → v1 (legacy — all types use frequency model)
   *   'v2'      → type-aware completion logic
   */
  engineVersion?: 'v2';
}
```

---

## 3. New Fields — `challengeMembers/{challengeId}_{userId}`

```typescript
// Additive fields on challengeMembers
{
  // ── Competitive-specific ───────────────────────────────────────────────
  /**
   * Running sum of the user's raw logged values for all activities in this challenge.
   * Updated in the same batch as every log write.
   * Only populated when challengeType === 'competitive'.
   *
   * Note: This is the sum of workout.value across all log events.
   * Not to be confused with totalPoints (proportional scoring) or activitiesCompleted (count).
   */
  cumulativeLoggedValue?: number;

  // ── Streak-specific ────────────────────────────────────────────────────
  /**
   * YYYY-MM-DD string of the most recent calendar day on which this user logged.
   * Used to determine streak continuity.
   */
  lastLogDate?: string;

  /**
   * Number of consecutive calendar days the user has logged (including today if logged).
   * Reset to 0 when a day is missed and streakResetOnMiss === true.
   */
  currentStreak?: number;

  /**
   * Highest value currentStreak reached during this challenge.
   */
  longestStreak?: number;

  // ── Engine version ─────────────────────────────────────────────────────
  /**
   * Engine version under which this membership was created.
   * Matches the parent challenge's engineVersion.
   * undefined → v1 legacy rules apply to this membership.
   */
  engineVersion?: 'v2';
}
```

---

## 4. Per-Activity Target Fields — `challenges/{challengeId}.activities[]`

Each activity in the `activities` array may carry per-activity target overrides. Existing fields are unchanged.

```typescript
// Additive per-activity fields
{
  /**
   * Per-activity override for targetType.
   * Falls back to the challenge-level targetType when undefined.
   */
  activityTargetType?: 'daily' | 'cumulative' | 'group-pool';

  /**
   * Per-activity cumulative target (used for Competitive multi-activity challenges).
   * When set, this activity contributes cumulativeLoggedValue per-activity, not per-challenge.
   * When undefined and challengeType === 'competitive': targetValue is the cumulative target.
   */
  activityCumulativeTarget?: number;
}
```

---

## 5. Backward Compatibility Matrix

| Existing field | New behavior | Notes |
|---|---|---|
| `challengeType` | Unchanged | Now gates engine selection |
| `activities[].targetValue` | Unchanged | Interpreted via `targetType`; defaults to 'daily' |
| `activities[].frequency` | Unchanged | Still stored; now read by Streak engine for daily-log validation |
| `challengeMembers.activitiesCompleted` | Unchanged | Kept for all types; no longer drives completion for v2 Competitive/Collective |
| `challengeMembers.completionRate` | Unchanged for v1; updated for v2 | v2: type-specific formula |
| `challengeMembers.totalPoints` | Unchanged | Points accumulation remains valid for all types |
| `challengeMembers.totalActivities` | Unchanged for v1 | v2 Competitive/Collective: still written but not used for completion |

**The backward compatibility invariant:** any challenge document where `engineVersion` is `undefined` or missing uses the v1 (current) engine. No behavior changes for legacy data.

---

## 6. Firestore Index Requirements

### Existing indexes (unchanged)
- `challengeMembers` by `challengeId` + `totalPoints` (desc) — challenge leaderboard
- `challengeMembers` by `groupId` + `totalPoints` (desc) — group leaderboard
- `challengeMembers` by `challengeId` + `userId` — progress lookup
- `workouts` by `challengeId` + `userId` + `date` — per-user log history
- `wellnessLogs` by `challengeId` + `userId` + `date` — per-user wellness log history

### New indexes required for v2 engines

```json
// For Competitive leaderboard (rank by cumulative value)
{
  "collectionGroup": "challengeMembers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "challengeId", "order": "ASCENDING" },
    { "fieldPath": "cumulativeLoggedValue", "order": "DESCENDING" }
  ]
}

// For Streak leaderboard (rank by currentStreak)
{
  "collectionGroup": "challengeMembers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "challengeId", "order": "ASCENDING" },
    { "fieldPath": "currentStreak", "order": "DESCENDING" }
  ]
}

// For Competitive leaderboard by group
{
  "collectionGroup": "challengeMembers",
  "queryScope": "COLLECTION",
  "fields": [
    { "fieldPath": "groupId", "order": "ASCENDING" },
    { "fieldPath": "cumulativeLoggedValue", "order": "DESCENDING" }
  ]
}
```

---

## 7. Firestore Security Rules — Additions

The following rules extend `firestore.rules` for new fields. Existing rules remain unchanged.

```javascript
// In challengeMembers write rules:
// Allow clients to read cumulativeLoggedValue and streak fields (read-only from client)
// All writes to these fields happen server-side via Admin SDK or Cloud Functions.

// challenges document: allow read of groupCurrentTotal (public to group members)
// No client write allowed to groupCurrentTotal — server-only via batch.

// Rule principle: new fields follow the same access pattern as their parent document.
// No new rule surfaces required.
```

---

## 8. Type → Engine → Field Mapping Summary

| Challenge type | Engine | Key completion field | Key progress field | Key leaderboard field |
|---|---|---|---|---|
| `streak` (v1) | Legacy frequency | `activitiesCompleted >= totalActivities` | `completionRate` | `totalPoints` |
| `streak` (v2) | Streak Engine | `currentStreak >= requiredConsecutiveDays` | `currentStreak / requiredConsecutiveDays` | `currentStreak` |
| `competitive` (v1) | Legacy frequency | `activitiesCompleted >= totalActivities` | `completionRate` | `totalPoints` |
| `competitive` (v2) | Competitive Engine | `cumulativeLoggedValue >= targetValue` | `cumulativeLoggedValue / targetValue` | `cumulativeLoggedValue` |
| `collective` (v1) | Legacy frequency | `activitiesCompleted >= totalActivities` | `completionRate` | `totalPoints` |
| `collective` (v2) | Collective Engine | `groupCurrentTotal >= groupCumulativeTarget` | `groupCurrentTotal / groupCumulativeTarget` | group pool progress |

---

## 9. Data Migration Strategy

### Principle: no mandatory migration

Legacy challenges (v1) continue to work exactly as before. No batch migration is required.

### Optional backfill for active challenges

When a group admin wants to upgrade an active challenge from v1 to v2:

1. Set `engineVersion = 'v2'` and `targetType` on the challenge document.
2. For Competitive: set `cumulativeLoggedValue` on each membership by summing `workout.value` from the `workouts` collection where `challengeId` matches and `userId` matches.
3. For Collective: set `groupCurrentTotal` on the challenge document by summing all `workout.value` across all members.
4. For Streak: set `lastLogDate` and `currentStreak` by walking the `workouts` collection in date order.

This backfill is a one-time admin operation per challenge, not a platform-wide migration.

### New challenge creation

All challenges created after v2 engine deployment use v2 rules when the creator selects the appropriate type and fills in the new fields (groupCumulativeTarget for Collective, etc.). The creation wizard gates `engineVersion = 'v2'` on the presence of the new fields.
