# Phase 19A — Challenge Performance Source-of-Truth Fix Tracker

Audit: `docs/superpowers/audits/2026-07-07-phase-19A-9-challenge-performance-source-of-truth-audit.md`

## Phases

| Phase | Status | Description | Report |
|-------|--------|-------------|--------|
| 19A-10A | ✅ Complete | Fix `activityLogSessionService` missing `cumulativeLoggedValue` write | [report](../implementation-reports/2026-07-07-phase-19A-10A-activity-session-cumulative-progress.md) |
| 19A-10B | ✅ Complete | Remove `challengeLeaderboards.cumulativeLoggedValue` from CF; confirmed `feedLiveStatsService` already reads from `challengeMembers` | [report](../implementation-reports/2026-07-07-phase-19A-10B-remove-duplicate-leaderboard-cumulative.md) |
| 19A-10C | ✅ Complete | Replace Home first-card raw log query with `challengeMembers.cumulativeLoggedValue` | [report](../implementation-reports/2026-07-07-phase-19A-10C-home-progress-source-of-truth.md) |
| 19A-10D | ✅ Complete | Remove raw workout sum from `ChallengeCompletedScreen` legacy v1 display; all branches now use `cumulativeLoggedValue` | [report](../implementation-reports/2026-07-07-phase-19A-10D-challenge-completed-single-total.md) |
| 19A-10F | ✅ Complete | Final regression guard script + screen verification matrix; no gaps found | [report](../implementation-reports/2026-07-08-phase-19A-10F-final-regression-guard.md) |
| 19A-10E | ✅ Complete | Confirmed `challenge-leaderboard-snapshot` invalidation already present in both log mutations; added guard assertions | [report](../implementation-reports/2026-07-07-phase-19A-10E-post-log-cache-invalidation.md) |
| 19A-10G | ✅ Complete | Fix collective challenge double-counting: replace `challenges.groupCurrentTotal` with `challengeActivitySummaries.totalValue` (CF-maintained) as the canonical collective team total | [report](../implementation-reports/2026-07-08-phase-19A-10G-collective-double-count-fix.md) |
| 19A-10H | ✅ Complete | Fix collective team progress regression on Home + WorkoutLoggedScreen caused by 10G: restore `userContribFloor` as a lower-bound; add `activitySummaryTotal` to `buildChallengeProgress`; batch-read `challengeActivitySummaries` in Home | [report](../implementation-reports/2026-07-08-phase-19A-10H-home-and-completion-team-progress-regression.md) |
| 19A-10I | ✅ Complete | Fix collective team progress showing user's own contribution as team total on Home + WorkoutLoggedScreen: replace `userContribFloor` (individual value) with `optimisticTeamFloor` from `priorTeamTotal` (`challenge.groupCurrentTotal` — a team-level aggregate) | [report](../implementation-reports/2026-07-08-phase-19A-10I-collective-team-progress-user-total-fix.md) |
| 19A-10J | ✅ Complete | Align activity log screens (`LogWorkoutScreen`, `LogWellnessActivityScreen`) with canonical team progress source: add `useChallengeSummary`, pass `activitySummaryTotal` + `priorTeamTotal`; upgrade collective banner to progress card with bar + user contribution line | [report](../implementation-reports/2026-07-08-phase-19A-10J-activity-log-screen-team-progress-fix.md) |
| 19A-10K | ✅ Complete | Fix Group Feed step value cap: `maxActivityValue` raised from 10,000 to 1,000,000 in CF `memberActivitySummaries.ts` — logs of 16,700+ steps now display correctly in feed activity box and contribute correctly to `challengeActivitySummaries.totalValue` | [report](../implementation-reports/2026-07-08-phase-19A-10K-group-feed-step-value-cap-fix.md) |
| 19A-10L | ✅ Complete | Fix (1) group cards showing historical challenge count instead of active-only: filter changed to `status !== 'active'`, label updated to "Active Challenge(s)"; fix (2) WorkoutLoggedScreen "View Completion" CTA shown at 80% instead of only on true completion: `showCompletion` now uses `resolved.isUserCompleted` + `membership.status === 'completed'` | [report](../implementation-reports/2026-07-08-phase-19A-10L-group-card-count-and-completion-cta.md) |

## Source-of-Truth Rules (locked)

| Value | Authoritative field | Owner |
|-------|--------------------|----|
| User cumulative contribution | `challengeMembers.cumulativeLoggedValue` | Client engines (`workoutService`, `wellnessLogService`, `activityLogSessionService`) |
| Collective team total | `challengeActivitySummaries.totalValue` | Cloud Function |
| Competitive ranking score | `challengeLeaderboards.score` | Cloud Function |
| Streak progress | `challengeMembers.currentStreak` | Client `streakEngine` |
| Days remaining | Derived from `challenge.endDate` | N/A |

## 19A-10A Change Detail

**File:** `src/services/activityLogSessionService.ts`

Added after `nextRate` computation (line ~373):

```typescript
const sessionContributionTotal = summaryEntries.reduce((s, e) => s + Math.max(0, e.value), 0);
const nextCumulativeLoggedValue = Math.max(0, Number(membership.cumulativeLoggedValue ?? 0)) + sessionContributionTotal;
```

Added to `membershipUpdate`:
```typescript
cumulativeLoggedValue: nextCumulativeLoggedValue,
```

**Guard:** `scripts/testChallengePerformanceSourceOfTruthGuards.ts` — 9 assertions

**Build:** `tsc --noEmit` clean, `npm run build` clean. Total 142 guard assertions passing.
