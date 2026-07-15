# Phase 19A-8D — Feed Accuracy + Activity Logging Alignment

**Date:** 2026-07-07
**Branch:** fix/p0-pre-deploy-blockers

---

## 1. Root Causes Fixed

### Bug 1 — Double-counting: `cumulativeLoggedValue` inflated 2x

**Cause:** Phase 19A-8C added `cumulativeLoggedValue: FieldValue.increment(input.value)` to the `challengeMembers` batch in the CF. But the client engines (competitiveEngine, streakEngine, collectiveEngine) already write `cumulativeLoggedValue` to `challengeMembers` in the same atomic batch as the workout/wellness document. Since Firestore CF triggers fire *after* the client batch commits, `challengeMembers` was already at the post-log value when the CF ran — then the CF incremented it again. Result: a user logging 100 reps saw 200 total.

**Fix:** Removed the `challengeMembers` batch write from `queueActivitySummaryWrites` entirely. The CF now reads `challengeMembers.cumulativeLoggedValue` directly as the authoritative post-log cumulative value.

### Bug 2 — "0 reps behind Fred Kenogo": score used as proxy for cumulative value

**Cause:** The competitive snapshot computed `leaderDelta = leaderValue ?? leaderScore` to handle cases where `cumulativeLoggedValue` wasn't yet on a leader's leaderboard doc. `leaderScore` is integer ranking points; `newCumulative` is raw reps/steps. Subtracting different units → nonsensical result → clamped to 0 by `Math.max(0, ...)`.

**Fix:** `leaderDelta` and `leadingBy` are now only computed when `leaderValue` (the leader's `cumulativeLoggedValue`) is explicitly > 0. When `leaderValue` is unavailable, the label falls back to showing progress vs target or raw total — never "0 reps behind".

### Bug 3 — Streak double-recompute: CF recomputed streak from `lastLogDate`

**Cause:** Phase 19A-8C streak branch read `lastLogDate` from `challengeMembers` and recomputed `newStreak` from scratch. But `streakEngine` already ran and wrote the correct post-log `currentStreak` and `lastLogDate` before the CF trigger fired.

**Fix:** The streak snapshot now reads `challengeMembers.currentStreak` directly and uses it as `streakDay`. No recomputation. Removed `memberUpdate` return from `SnapshotResult`.

### Bug 4 — Duplicate "days left" text

**Cause:** `SnapshotProgress` renders `snap.daysRemaining`; the outer FeedCard also rendered `daysRemaining(item.challengeEndDate)` unconditionally.

**Fix:** The outer days block is now gated on `!item.feedProgressSnapshot`.

### Bug 5 — Comments show raw email instead of display name

**Cause:** `useFeedComments` used `user!.displayName ?? user!.email ?? 'Member'`. For email/password Firebase accounts, `user.displayName` is null unless explicitly set at auth time, so it fell through to `user!.email` (full email string like `member@gmail.com`).

**Fix:** Both `addComment` and `addReply` now use `profile?.displayName ?? user!.displayName ?? user!.email?.split('@')[0] ?? 'Member'`. `profile.displayName` from `AuthContext` already derives the email prefix as a fallback.

### Enhancement — Competitive two-line rendering in SnapshotProgress

Added a distinct two-line layout for competitive cards:
- Line 1: `Progress: X / Y unit` (user's cumulative vs per-person target)
- Line 2: Leader context label (`Leading by X unit` / `Tied for the lead with Name` / `X unit behind Name`)

---

## 2. Architectural Insight

The key invariant underpinning all fixes:

> Client engines write to `challengeMembers` in the **same atomic batch** as the workout/wellness document. Firestore CF triggers fire asynchronously **after** that batch commits. Therefore `challengeMembers.cumulativeLoggedValue`, `currentStreak`, and `lastLogDate` are **already post-log** when the CF reads them.

Data source ownership:
| Field | Owner | State when CF reads it |
|---|---|---|
| `challengeMembers.cumulativeLoggedValue` | Client engine | POST-log |
| `challengeMembers.currentStreak` | streakEngine | POST-log |
| `challengeMembers.lastLogDate` | streakEngine | POST-log |
| `challengeActivitySummaries.totalValue` | CF | PRE-log (CF increments it) |
| `challengeLeaderboards.*` | CF | PRE-log (CF increments score) |

---

## 3. Files Modified

| File | Change |
|---|---|
| `functions/src/memberActivitySummaries.ts` | Rewrote with all 8D fixes: removed `challengeMembers` write, removed streak recomputation, removed `memberUpdate` from `SnapshotResult`, fixed competitive branch to read from `challengeMembers` directly, fixed `leaderDelta` / `leadingBy` to require explicit `leaderValue`, added `leadingBy` to snapshot, fixed `Tied for the lead` label, improved fallback labels |
| `src/features/Groups/FeedCard.tsx` | `SnapshotProgress`: competitive two-line rendering; outer days block gated on `!item.feedProgressSnapshot` |
| `src/hooks/useFeedComments.ts` | Both `addComment` and `addReply` use `profile?.displayName` as primary; split email at `@` in final fallback |
| `scripts/testGroupFeedProgressSnapshotGuards.ts` | Updated: removed stale `prevCumulative`/`newStreak`/`memberUpdate` assertions; added assertions for `leadingBy`, post-log `challengeMembers` read, `!feedProgressSnapshot` day gate, `userCumulativeValue` render |
| `scripts/testGroupFeedAccuracyGuards.ts` | **New** — 18 assertions |

---

## 4. Commands Executed and Results

```bash
npx tsx scripts/testGroupFeedAccuracyGuards.ts             # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts     # ✅ 38 assertions passed
npx tsx scripts/testGroupFeedProgressGuards.ts             # ✅ 24 assertions passed
npx tsx scripts/testGroupFeedFinalQaGuards.ts              # ✅ 18 assertions passed
npx tsx scripts/testGroupFeedLiveStatsGuards.ts            # ✅ 20 assertions passed
npx tsx scripts/testGroupFeedCardUiGuards.ts               # ✅ 15 assertions passed
npx tsc --noEmit                                           # ✅ 0 errors
npm run build                                              # ✅ built in 3.29s
cd functions && npm run build                              # ✅ 0 errors
```

**Total guard assertions: 133, all passing.**

---

## 5. Manual QA Checklist

- [ ] Log a competitive activity (not leading) → card shows "Progress: X / Y unit" + "X unit behind [name]" (not "0 unit behind")
- [ ] Log a competitive activity (leading) → card shows "Progress: X / Y unit" + "Leading by X unit"
- [ ] Log a competitive activity (tied) → card shows "Tied for the lead with [name]"
- [ ] Log a competitive activity (new participant, no prior leaderboard doc) → card shows "Progress: X / Y unit" (no spurious delta)
- [ ] Log a collective activity → card shows team progress (not doubled after multiple logs)
- [ ] Log a streak activity → card shows "Day N streak" read from challengeMembers (not recomputed)
- [ ] Feed card for challenge with endDate → "X days left" appears ONCE (in snapshot, not both in snapshot and bottom)
- [ ] Feed card for challenge without feedProgressSnapshot → "X days left" still appears in bottom
- [ ] Add comment to feed → author name shows display name / email prefix, not raw email
- [ ] Add reply to comment → same display name fix

---

## 6. Risks / Limitations

1. **Race condition on first log:** If the client batch commits but the CF trigger fires before `challengeMembers` doc is written (very narrow window), the CF reads an old or missing `cumulativeLoggedValue`. The fix adds `Math.max(memberSnapValue, input.value)` as a floor so the cumulative is at minimum the current log value.

2. **Old `challengeLeaderboards` docs without `cumulativeLoggedValue`:** Leader comparison silently skips delta computation and shows a safe fallback label. Resolves on next log by that user.

3. **`challengeMembers` no longer written by CF:** If a third-party system reads `challengeMembers.cumulativeLoggedValue` expecting CF to maintain it, it will find only client-engine values. This is intentional — the CF was creating the double-count.
