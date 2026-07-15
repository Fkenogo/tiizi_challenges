# Phase 19A-10B — Remove Duplicate `challengeLeaderboards.cumulativeLoggedValue`

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Files Modified

| File | Change |
|------|--------|
| `functions/src/memberActivitySummaries.ts` | Removed `cumulativeLoggedValue: FieldValue.increment(...)` from `challengeLeaderboardPayload` |
| `scripts/testChallengePerformanceSourceOfTruthGuards.ts` | Added 4 new assertions (10B rules) |

---

## 2. Code Diff Summary

**`functions/src/memberActivitySummaries.ts`** — `queueActivitySummaryWrites`, `challengeLeaderboardPayload`:

Before:
```typescript
activityCount: FieldValue.increment(1),
score: FieldValue.increment(input.score),
// Track cumulative logged value so future competitive snapshots can read it from the leader
cumulativeLoggedValue: FieldValue.increment(Math.max(0, input.value)),
lastActivityAt: input.createdAt,
```

After:
```typescript
activityCount: FieldValue.increment(1),
score: FieldValue.increment(input.score),
lastActivityAt: input.createdAt,
```

`challengeLeaderboards` is now ranking-only: `score`, `activityCount`, `displayName`, `lastActivityAt`, `lastScoringVersion`, `lastScoringMethod`.

---

## 3. Why `feedLiveStatsService.ts` Was Not Modified

The Phase 19A-9 audit found that `feedLiveStatsService.ts` already read `cumulativeLoggedValue` exclusively from `challengeMembers` (line 122 `getDoc(doc(db, 'challengeMembers', ...))`, line 158 `num(d, 'cumulativeLoggedValue')`). It never read `challengeLeaderboards.cumulativeLoggedValue`. No code change was needed.

---

## 4. Source-of-Truth State After 10B

| Value | Authoritative field | Written by |
|-------|--------------------|----|
| User cumulative contribution | `challengeMembers.cumulativeLoggedValue` | `workoutService`, `wellnessLogService`, `activityLogSessionService` |
| Collective team total | `challengeActivitySummaries.totalValue` | Cloud Function |
| Competitive ranking score | `challengeLeaderboards.score` | Cloud Function |
| Streak progress | `challengeMembers.currentStreak` | Client `streakEngine` |

`challengeLeaderboards` no longer contains `cumulativeLoggedValue`. Any historical docs that have the field will be ignored by all read paths (which now exclusively use `challengeMembers`).

---

## 5. Commands Executed

```bash
npx tsx scripts/testChallengePerformanceSourceOfTruthGuards.ts  # ✅ all guards passed
npx tsc --noEmit                                                 # ✅ 0 errors
npm run build                                                    # ✅ built in 7.76s
# Full guard suite: all scripts/test*.ts                        # ✅ all passed
```

---

## 6. Risks

1. **Stale `challengeLeaderboards` docs.** Historical docs from before this fix still carry `cumulativeLoggedValue`. No read path uses it (all reads go to `challengeMembers`), so stale data is harmless. No migration required.

2. **CF retry safety.** Removing the `FieldValue.increment` from leaderboard writes makes CF retries safer for `cumulativeLoggedValue` — it can no longer over-count from a retried trigger. Leaderboard `score` and `activityCount` still use `FieldValue.increment`; those were already idempotency concerns independent of this change.

---

## 7. Rollback Instructions

Add back to `challengeLeaderboardPayload` in `functions/src/memberActivitySummaries.ts`:
```typescript
cumulativeLoggedValue: FieldValue.increment(Math.max(0, input.value)),
```
