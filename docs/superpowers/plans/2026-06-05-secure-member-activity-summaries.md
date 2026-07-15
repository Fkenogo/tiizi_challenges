# Secure Member Activity Summaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move member activity summary writes from normal clients to Firebase Functions/Admin SDK only.

**Architecture:** Firestore rules deny all client writes to summary collections. Client services retain read-only summary helpers. Cloud Functions `onDocumentCreated` triggers for workouts, wellness logs, group members, and challenge members generate/update summary documents with Admin SDK privileges.

**Tech Stack:** React/TypeScript, Firebase Firestore rules, Firebase Functions v2, Firebase Admin SDK.

---

### Task 1: Remove Client Summary Writes

- [x] Remove client write helper methods from `src/services/memberActivitySummaryService.ts`.
- [x] Remove summary batch writes from `src/services/workoutService.ts`.
- [x] Remove summary batch writes from `src/services/wellnessLogService.ts`.
- [x] Remove group join/create summary writes from `src/services/groupService.ts`.

### Task 2: Lock Firestore Rules

- [x] Set `challengeActivitySummaries`, `groupActivityFeed`, `groupMemberStats`, and `groupLeaderboards` writes to `false`.
- [x] Preserve group-member/admin read access.

### Task 3: Add Firebase Functions Triggers

- [x] Create reusable summary generation logic in `functions/src/memberActivitySummaries.ts`.
- [x] Add triggers in `functions/src/index.ts` for `workouts`, `wellnessLogs`, `groupMembers`, and `challengeMembers` creation.

### Task 4: Align Backfill and Validate

- [x] Keep backfill script Admin SDK based and schema-compatible.
- [x] Run TypeScript/build/functions/rules/index validations.
