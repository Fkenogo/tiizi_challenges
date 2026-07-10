# Phase 15C — Complete Behaviour Parity for Challenge Creation

**Date:** 2026-06-26
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** `functions/src/challengeCreationBackend.ts`, `scripts/testScoringGuards.ts`
**Code changes:** Yes — side-effect writes added to transaction; no Firestore schema changes

---

## Goal

Bring `createChallengeWithCreatorMembership` to behavioural parity with the client
`challengeService.createChallenge()` + `joinChallenge()` flow.

---

## Audit: Client-side Side Effects vs Callable

| Side effect | Client path | Callable (before 15C) | Callable (after 15C) |
|---|---|---|---|
| `stats.totalChallenges` increment | ✅ `increment(1)` in write batch | ❌ missing | ✅ `FieldValue.increment(1)` in transaction |
| `lastChallengeJoinedAt` | ✅ `Timestamp.now()` in batch | ❌ missing | ✅ `nowIso` in transaction |
| `currentStreak: 0` / `longestStreak: 0` on streak join | ✅ added to membership via merge | ❌ missing | ✅ included in membership payload for streak challenges |
| `lastLogDate` removed on streak rejoin | ✅ `deleteField()` via merge | ✅ implicit — `transaction.set(memberRef, payload)` is a full overwrite, so stale `lastLogDate` is absent | ✅ unchanged |
| `participantCount` | ✅ `increment(1)` in batch | ✅ `onChallengeMemberCreated` trigger (async ~1–5s) | ✅ unchanged — trigger handles it; no duplicate added |

---

## Files Changed

### `functions/src/challengeCreationBackend.ts`

**Import change:**
```typescript
// before
import type { Firestore } from 'firebase-admin/firestore';

// after
import { FieldValue, type Firestore } from 'firebase-admin/firestore';
```

**Membership payload — streak fields added:**

```typescript
const challengeMemberPayload = removeUndefinedDeep({
  // ... base fields ...
  ...(challengeType === 'streak' ? { currentStreak: 0, longestStreak: 0 } : {}),
});
```

Streak challenges now include `currentStreak: 0` and `longestStreak: 0` in the creator membership
document. `lastLogDate` is absent from the payload, so the full-overwrite `set()` removes any stale
value from a prior membership document — matching the `deleteField()` behaviour in the client path.

**User stats write inside transaction:**

```typescript
const userRef = db.collection('users').doc(actorUid);

transaction.set(
  userRef,
  { stats: { totalChallenges: FieldValue.increment(1) }, lastChallengeJoinedAt: nowIso },
  { merge: true },
);
```

Written atomically with the challenge doc and creator membership. If the transaction rolls back, the
user stats are also rolled back — no partial state possible. `{ merge: true }` preserves all other
user document fields.

---

## participantCount: No Change Needed

The callable sets `participantCount: 0` on the challenge document at creation time. The
`onChallengeMemberCreated` Cloud Function trigger (`functions/src/index.ts:268`) fires when the
creator membership document is written and increments `participantCount` to 1 asynchronously.

Adding a second increment inside the transaction would double-count the creator. Guard 15C-7 locks
this out.

---

## Regression Guards Added (15C-1 through 15C-9)

| Guard | What it verifies |
|---|---|
| 15C-1 | `FieldValue` imported from `firebase-admin/firestore` |
| 15C-2 | `stats.totalChallenges` incremented with `FieldValue.increment(1)` |
| 15C-3 | `lastChallengeJoinedAt` written when creator joins |
| 15C-4 | User stats `transaction.set` uses `{ merge: true }` |
| 15C-5 | `currentStreak: 0` and `longestStreak: 0` present for streak membership |
| 15C-6 | Streak reset is conditional on `challengeType === 'streak'` |
| 15C-7 | No `participantCount` increment inside the transaction (trigger handles it) |
| 15C-8 | `userRef` targets `actorUid` (the creator) |
| 15C-9 | User stats write is inside `runTransaction`, not before it |

---

## Build & Guard Output

```
npm --prefix functions run build
> tsc -p tsconfig.json
(exit 0 — no errors)

npx tsx scripts/testScoringGuards.ts
scoring guards passed
(exit 0)
```

---

## Remaining Differences

The callable is now functionally equivalent to the client creation + join flow for all immediate
side effects. The only remaining architectural differences are:

| Difference | Impact | Resolution |
|---|---|---|
| `participantCount` timing | Callable: async via trigger (~1–5s). Client: synchronous. | Acceptable — both converge to the same value; the trigger already handles all membership creates |
| `lastChallengeJoinedAt` format | Callable writes ISO string; client writes Firestore `Timestamp`. | Low impact — both are sortable date values; frontend reads via `.toDate()` on Timestamp or `new Date()` on ISO string |
| Frontend not yet migrated | `CreateChallengeWizard` still uses `challengeService.createChallenge()` | Phase 15D — wizard migration to callable |
