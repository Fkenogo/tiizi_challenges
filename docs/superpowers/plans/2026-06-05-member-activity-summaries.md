# Member Activity Summaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace member-facing cross-user raw workout/wellness reads with safe materialized activity summary documents.

**Architecture:** Member screens read `groupActivityFeed`, `groupMemberStats`, `groupLeaderboards`, and `challengeActivitySummaries`. Raw `workouts` and `wellnessLogs` remain owner-history data; new writes update summary docs in the same client batch, and a dry-run/apply script backfills existing data.

**Tech Stack:** React, TypeScript, Firebase Firestore client SDK, Firebase Admin SDK scripts, Firestore rules/indexes.

---

### Task 1: Summary Service and Types

**Files:**
- Create: `src/services/memberActivitySummaryService.ts`
- Modify: `src/types/index.ts`

- [x] Add typed summary models for feed items, member stats, leaderboard entries, and challenge summaries.
- [x] Add client read helpers that query summary collections with `where`, `orderBy`, and `limit`.
- [x] Add client write helpers used by activity logging batches.

### Task 2: Replace Member Raw Readers

**Files:**
- Modify: `src/services/groupInsightsService.ts`
- Modify: `src/hooks/useWorkouts.ts`
- Modify: `src/features/Home/useHomeScreen.ts`

- [x] Replace group feed/member/leaderboard raw scans with summary reads.
- [x] Replace challenge activity/progress hooks with summary reads.
- [x] Replace home active challenge progress raw reads with `challengeActivitySummaries` plus current user's `challengeMembers` membership.

### Task 3: Populate Summaries on New Activity

**Files:**
- Modify: `src/services/workoutService.ts`
- Modify: `src/services/wellnessLogService.ts`

- [x] Include summary writes in activity logging batches.
- [x] Preserve existing `challengeMembers` per-user progress updates.
- [x] Mark wellness membership complete when completion rate reaches 100.

### Task 4: Rules, Indexes, and Backfill

**Files:**
- Modify: `firestore.rules`
- Modify: `firestore.indexes.json`
- Modify: `package.json`
- Create: `scripts/backfillMemberActivitySummaries.ts`

- [x] Add rules for summary collections: group members can read; owners can create/update summaries generated from their own activity; admins can manage.
- [x] Add indexes for summary reads.
- [x] Add dry-run default script and guarded `--apply` mode.

### Task 5: Validation

- [x] Run `npx tsc -b`.
- [x] Run `npm run build`.
- [x] Run Firestore rules dry run.
- [x] Run Firestore indexes dry run.
- [x] Run summary backfill dry run.
