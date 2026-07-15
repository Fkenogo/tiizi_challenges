# Phase 18G-2B — Remove Duplicate participantCount Writes

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Bug fixed:** BUG-G1 (HIGH — data corruption)

---

## 1. Root Cause Confirmation

`participantCount` on challenge documents was written by two independent paths on every join and leave:

| Path | Location | Trigger condition |
|---|---|---|
| Client batch | `challengeService.joinChallenge:246` | Every join / rejoin |
| Cloud Function | `onChallengeMemberCreated → updateParticipantCountForCreate` | New `challengeMembers` doc |
| Client batch | `challengeService.leaveChallenge:288` | Every leave |
| Cloud Function | `onChallengeMemberUpdated → updateParticipantCountForUpdate` | Status change active→abandoned |

Result: every join wrote +2, every leave wrote -2. `participantCount` grew at 2× the true member count.

The Cloud Function path (`functions/src/memberCounters.ts`) is already complete and correct:
- **Create** (`onChallengeMemberCreated`): `transitionDelta(false, isActiveMemberStatus(status))` → +1 for any active-status new doc
- **Update** (`onChallengeMemberUpdated`): `transitionDelta(beforeActive, afterActive)` → +1 for abandoned→active (rejoin), -1 for active→abandoned (leave), 0 for no-op status changes
- **Delete** (`onChallengeMemberDeleted`): -1 if the deleted doc was active

The Cloud Function uses the Admin SDK (`db.collection('challenges').doc(id).set(...)`) which bypasses Firestore security rules — so it can always write `participantCount` regardless of who triggered the action.

**`totalChallenges` (user stats):** not written by any Cloud Function — client-side writes in `joinChallenge` and `leaveChallenge` are the only path. No duplicate. Untouched.

---

## 2. Changes Made

### `src/services/challengeService.ts`

#### joinChallenge — before

```ts
batch.set(memberRef, { ...basePayload, ...streakReset }, { merge: true });

// BUG-005: keep participantCount in sync — increment atomically on every (re)join.
batch.set(challengeRef, { participantCount: increment(1) }, { merge: true });

// BUG-006: totalChallenges tracks active memberships.
```

#### joinChallenge — after

```ts
batch.set(memberRef, { ...basePayload, ...streakReset }, { merge: true });

// participantCount is maintained exclusively by onChallengeMemberCreated/Updated
// Cloud Function triggers (memberCounters.ts). Client-side increment removed
// in Phase 18G-2B to eliminate double-write (BUG-G1).

// BUG-006: totalChallenges tracks active memberships.
```

#### leaveChallenge — before

```ts
const challengeRef = doc(db, this.collectionName, challengeId);
const userRef = doc(db, 'users', userId);
const batch = writeBatch(db);

batch.set(membershipRef, { status: 'abandoned', leftAt: Timestamp.now() }, { merge: true });

// BUG-005: keep participantCount in sync.
// Decrement is safe here because we confirmed status === 'active'.
batch.set(challengeRef, { participantCount: increment(-1) }, { merge: true });

// BUG-006: reverse the join-time increment ...
```

#### leaveChallenge — after

```ts
const userRef = doc(db, 'users', userId);
const batch = writeBatch(db);

batch.set(membershipRef, { status: 'abandoned', leftAt: Timestamp.now() }, { merge: true });

// participantCount decrement removed in Phase 18G-2B — handled exclusively by
// onChallengeMemberUpdated trigger (active→abandoned transition, delta = -1).

// BUG-006: reverse the join-time increment ...
```

`challengeRef` was also removed from `leaveChallenge` — it was only referenced by the now-removed `participantCount` write.

---

### `firestore.rules`

Removed the temporary `participantCount`-only challenge update branch that was added in Phase 18G-2A.1:

#### Before

```
allow update: if isAuthenticated() && (
  ...
  || isActiveCollectiveProgressUpdate(challengeId)
  // Group members may update only participantCount (join/leave counter sync).
  // The Cloud Function trigger is authoritative; this client write is optimistic
  // and will be superseded. Removed in Phase 18G-2B.
  || (
    (isGroupMember(resource.data.groupId) || isPublicGroup(resource.data.groupId))
    && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['participantCount'])
  )
  || canModerateChallenges()
);
```

#### After

```
allow update: if isAuthenticated() && (
  ...
  || isActiveCollectiveProgressUpdate(challengeId)
  || canModerateChallenges()
);
```

---

### `scripts/testScoringGuards.ts`

- Guards **13D-1** and **13D-2** inverted: now assert that client service does NOT write `participantCount` (previously asserted it did)
- Guards **18G-6** updated: now asserts `hasOnly(['participantCount'])` is absent from rules; adds **18G-6b** and **18G-6c** confirming service doesn't write either increment or decrement

---

## 3. Consistency After This Change

| Action | participantCount effect | Who writes it |
|---|---|---|
| Member joins (new doc) | +1 | `onChallengeMemberCreated` trigger |
| Member rejoins (abandoned→active) | +1 | `onChallengeMemberUpdated` trigger |
| Member leaves (active→abandoned) | -1 | `onChallengeMemberUpdated` trigger |
| Member completes (collective cascade) | 0 (stays counted) | No write — `completed` is in `ACTIVE_MEMBER_STATUSES` |
| Challenge creator's membership (set during creation) | +1 | `onChallengeMemberCreated` trigger |

**Latency note:** The trigger fires asynchronously after the client batch commits. `participantCount` will be stale for ~1–3 seconds after a join or leave. This is cosmetically acceptable and is the standard Firestore fan-out pattern. Previously, the count was instantly wrong (2× inflated) — eventual consistency is strictly better.

---

## 4. Files Changed

| File | Change |
|---|---|
| `src/services/challengeService.ts` | Removed `participantCount: increment(1)` from `joinChallenge`; removed `challengeRef` declaration and `participantCount: increment(-1)` from `leaveChallenge` |
| `firestore.rules` | Removed temporary `participantCount`-only update branch from challenge `allow update` |
| `scripts/testScoringGuards.ts` | Updated 13D-1, 13D-2; updated 18G-6; added 18G-6b, 18G-6c |

---

## 5. Requires Deployment

**Yes** — both `firestore.rules` and the compiled frontend bundle must be deployed. The rules change removes a write path that no longer exists client-side; both must change together or the client would be denied (rules removed before client stops writing) or the client would write without a rule path (rule removed before client stops writing — same race, still denied by default-deny). In practice, the order is:

1. Deploy rules first (`firebase deploy --only firestore:rules`)
2. Deploy frontend (the old client would still try to write `participantCount` but be denied — a cosmetic miss during the transition window; no data corruption)
3. After frontend deploys, both paths are clean

---

## 6. Validation

```
npx tsc --noEmit                                  → ✅ No errors
npm run build                                     → ✅ Built in 6.23s
npm run test:scoring-guards                       → ✅ All guards passed
npm run test:home-challenge-feeds                 → ✅ All guards passed
firebase deploy --only firestore:rules --dry-run  → ✅ Compiled (pre-existing warnings unchanged)
```

---

## 7. Manual Test Checklist

| Scenario | Expected |
|---|---|
| Member joins challenge | Join succeeds (no permission error); `participantCount` increments by 1 after trigger (~1–3s delay) |
| Member leaves challenge | Leave succeeds; `participantCount` decrements by 1 after trigger |
| Creator counts in `participantCount` | Yes — creator's `challengeMembers` doc fires `onChallengeMemberCreated` (+1) |
| Rejoin (abandoned → active) | `participantCount` increments once via `onChallengeMemberUpdated` |
| `participantCount` after 3 joins | = 3 (previously would have been 6) |
| Challenge display while trigger pending | May show stale count for 1–3s — cosmetically acceptable |
