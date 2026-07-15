# Phase 10C-P5B — Challenge Participant Count & Creator Membership Integrity

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — audit clean, guard tests added, no production logic changes needed

---

## Audit Summary

A full read-only audit of participant count handling across client code, Cloud Functions, and scripts.

**Result: the architecture is correct and complete. No logic bugs were found.** The P5 audit's claim that "client `joinChallenge` doesn't increment `participantCount`" was a misread — by design, the client SDK never writes `participantCount`. The Firestore trigger handles it.

---

## Architecture Confirmed

### Counter ownership

`participantCount` on `challenges/{id}` is **exclusively server-owned**:

| Event | Trigger | Action |
|-------|---------|--------|
| `challengeMembers` doc created | `onChallengeMemberCreated` → `updateParticipantCountForCreate` | `increment(+1)` if member is active |
| `challengeMembers` doc updated | `onChallengeMemberUpdated` → `updateParticipantCountForUpdate` | `increment(+1)` or `increment(-1)` on status transition |
| `challengeMembers` doc deleted | `onChallengeMemberDeleted` → `updateParticipantCountForDelete` | `increment(-1)` if was active |

All three triggers have `retry: true`. Increment uses `FieldValue.increment()` — atomic server-side operation, no race conditions.

No client code writes `participantCount`. The `challengeService.joinChallenge` path creates the `challengeMembers` doc and that's it — the trigger handles the rest.

### Creator enrollment

`createChallengeWithCreatorMembershipCore` creates both the challenge doc and the creator's `challengeMembers` doc in a single Firestore transaction. After the transaction commits, `onChallengeMemberCreated` fires and increments `participantCount` to 1.

The challenge payload intentionally does **not** include `participantCount` — this is documented by the existing test at line 137 of `testChallengeCreationBackend.ts`. If the challenge doc started with `participantCount: 1` and the trigger then added 1 more, it would double-count the creator.

### Eventual consistency window

There is a brief window between transaction commit and trigger fire where `participantCount` is absent (`undefined`, reads as 0 via `?? 0`). This is expected Firestore counter behavior — it affects only the immediate post-creation card display and resolves within seconds. No code fix is possible without fundamentally changing the architecture.

### All creation paths use the callable

`challengeService.createChallenge` → `httpsCallable(..., 'createChallengeWithCreatorMembership')`. No direct Firestore write path exists. The callable is the sole entry point for challenge creation.

### Field name consistency

Every UI file uses `participantCount` (not `participantsCount`). All reads apply a safe `?? 0` default. No naming inconsistency exists anywhere in the codebase.

### Backfill repair path

`scripts/backfillGroupCounts.ts` already handles `participantCount` repair:
1. Reads all `challengeMembers` with active status, counts by `challengeId`
2. Reads all `challenges`, compares current vs expected `participantCount`
3. Writes corrected values for any mismatches (dry-run by default, apply with `CONFIRM_PROJECT_ID`)

This is the authoritative repair tool for counters that drifted due to trigger failures or pre-trigger legacy data.

---

## P5 Audit Correction

The P5 audit stated: *"`joinChallenge` client SDK does not increment `participantCount`"* and classified this as HIGH severity. **This was incorrect.** The counter is intentionally server-owned. The client SDK not writing `participantCount` is the correct design — the Firestore trigger handles it. No fix is needed for this finding.

---

## Changes Made

No production code changed. Only guard tests added.

### `scripts/testChallengeCreationBackend.ts`

Added a **P5B static source guards** section (9 new assertions):

1. `challengeService.createChallenge` calls `'createChallengeWithCreatorMembership'` callable
2. `challengeService.createChallenge` uses `httpsCallable` (not a direct Firestore write)
3. `joinChallenge` does not write `participantCount` (trigger owns this)
4. Functions index exports `onChallengeMemberCreated` for join counter increment
5. Functions index exports `onChallengeMemberUpdated` for status-change counter adjustment
6. Functions index exports `onChallengeMemberDeleted` for leave counter decrement
7. `memberCounters.ts` uses `FieldValue.increment` for atomic updates
8. Challenge payload has no `participantCount` at creation (trigger-owned — re-confirms existing behavioral test)
9. Creator `challengeMembers` doc is written with `status: 'active'` so the trigger fires
10. `backfillGroupCounts.ts` reads `challengeMembers` and handles `participantCount` repair

### `scripts/testHomeChallengeFeeds.ts`

Added a **P5B participant count field consistency guards** section (4 new assertions):

1. `ChallengesScreen` must not reference `participantsCount` (correct field is `participantCount`)
2. `BrowseChallengesScreen` must not reference `participantsCount`
3. `useHomeScreen` must not reference `participantsCount`
4. `ChallengesScreen` must use `participantCount ?? 0` as safe default
5. `challengeService.joinChallenge` must not write `participantCount`

---

## Rules / Indexes / Functions

No changes to Firestore rules, indexes, or Cloud Functions. All current — no deploy needed.

---

## Remaining Risks

| Risk | Severity | Status |
|------|----------|--------|
| Trigger failure leaves `participantCount` stale | LOW | Mitigated by `retry: true` on all triggers and `backfillGroupCounts` repair script |
| Brief 0-count window after challenge creation (trigger latency) | LOW | Accepted — expected eventual consistency; resolves within seconds |
| Pre-existing legacy challenges with wrong `participantCount` | MEDIUM | Repair with `npm run backfill:group-counts` (dry-run) then apply if corrections exist |

---

## Validation Results

```
npm run test:home-challenge-feeds        → home challenge feed guards passed
npm run test:home-performance-guards     → home performance guards passed
npm run test:pilot-ux-polish-guards      → pilot UX polish guards passed
npm run test:scoring-guards              → scoring guards passed
npm run test:challenge-creation-backend  → challenge creation backend tests passed
npm run test:group-invite-backend        → Group invite backend security tests passed
npx tsc -b --pretty false                → (no errors)
npm run build                            → ✓ built in 2.86s
npm --prefix functions run build         → (no errors)
npm --prefix functions run lint          → (no errors)
```

---

## Files Changed

| File | Change |
|------|--------|
| `scripts/testChallengeCreationBackend.ts` | Added P5B static source guard section (10 assertions) |
| `scripts/testHomeChallengeFeeds.ts` | Added P5B participant count field consistency section (5 assertions) |
