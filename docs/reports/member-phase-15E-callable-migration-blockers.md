# Phase 15E — Final Callable Migration Blockers

**Date:** 2026-06-26
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** `functions/src/challengeCreationBackend.ts`, `scripts/testChallengeCreationBackend.ts`, `scripts/testScoringGuards.ts`

---

## Fixes Implemented

### Fix 1 — `durationDays` parity

**Root cause:** The callable read `durationDays` from `input.durationDays`, defaulting to `14` when absent. The wizard sends `startDate`/`endDate` but not `durationDays`, so the callable would store `durationDays: 14` regardless of the actual date range — corrupting scoring thresholds and completion tracking for any challenge not exactly 14 days long.

**Implementation:** Replaced the single-path `?? 14` fallback with a two-branch resolution that matches `challengeService.createChallenge()` exactly:

```typescript
const MILLISECONDS_PER_DAY = 1000 * 60 * 60 * 24;

if (input.endDate) {
  endDate = normalizeIsoDate(input.endDate, 'endDate');
  const explicitDuration = optionalNumber(input.durationDays, 'durationDays', { min: 1, max: 366 });
  // Prefer explicit value when both are supplied; otherwise derive from dates.
  durationDays = explicitDuration
    ?? Math.max(1, Math.round((Date.parse(endDate) - Date.parse(startDate)) / MILLISECONDS_PER_DAY));
} else {
  durationDays = optionalNumber(input.durationDays, 'durationDays', { min: 1, max: 366 }) ?? 14;
  const date = new Date(startDate);
  date.setDate(date.getDate() + durationDays);
  endDate = date.toISOString();
}
```

The `?? 14` fallback is now only reached when neither `endDate` nor `durationDays` is supplied — matching the client's implicit default.

---

### Fix 2 — Owner membership `role` parity

**Root cause:** When auto-creating a missing group membership for the group owner, the callable wrote `role: 'member'` instead of `role: 'owner'`, and omitted `approvedAt`. Any downstream query, rule, or UI component filtering on `groupMembers.role === 'owner'` would see incorrect state.

**Implementation:**

```typescript
transaction.set(groupMemberRef, {
  groupId,
  userId: actorUid,
  role: 'owner',         // was 'member'
  status: 'active',
  createdAt: nowIso,
  approvedAt: nowIso,    // added — matches client setDoc({ approvedAt: new Date().toISOString() })
});
```

---

### Fix 3 — Donation challenge creator membership

**Root cause:** The callable always created a creator membership and incremented `stats.totalChallenges`, even for donation challenges that are created in `status: 'draft'`. The client path skips `joinChallenge` for donation challenges — no membership, no stats update, no `participantCount` increment.

**Implementation:** Gated the membership write, user-stats write, and the membership-populated return value behind `!requiresDonationApproval`:

```typescript
transaction.set(challengeRef, challengePayload);   // always written

if (!requiresDonationApproval) {
  // write challengeMemberRef + userRef stats
  return { challenge, challengeMember, challengeMemberId, creatorMembershipCreated };
}

return { challenge, challengeMember: null, challengeMemberId: null, creatorMembershipCreated };
```

`participantCount` is managed by the `onChallengeMemberCreated` trigger — since the member doc is not written for donation challenges, the trigger does not fire and `participantCount` stays at `0`, matching the client.

---

## Files Changed

| File | Change |
|---|---|
| `functions/src/challengeCreationBackend.ts` | Fix 1: `durationDays` derivation from dates; Fix 2: `role: 'owner'` + `approvedAt`; Fix 3: membership + stats gated behind `!requiresDonationApproval` |
| `scripts/testChallengeCreationBackend.ts` | Updated `.challengeMember.joinedAt` → `.challengeMember?.joinedAt` to reflect nullable return for donation challenges |
| `scripts/testScoringGuards.ts` | Added guards 15E-1 through 15E-7 |

---

## Regression Guards Added (15E-1 through 15E-7)

| Guard | What it verifies |
|---|---|
| 15E-1 | `durationDays` derived from `endDate − startDate` when `endDate` is provided |
| 15E-2 | Explicit `input.durationDays` overrides date-derived value when both are present |
| 15E-3 | Owner auto-membership uses `role: 'owner'` |
| 15E-4 | `approvedAt` written for owner auto-membership |
| 15E-5 | `challengeMemberRef` write is inside the `!requiresDonationApproval` gate |
| 15E-6 | `stats.totalChallenges` increment is inside the `!requiresDonationApproval` gate |
| 15E-7 | Challenge document is always written, before the donation gate |

---

## Validation Output

```
npm --prefix functions run build
> tsc -p tsconfig.json
(exit 0)

npx tsc -b --pretty false
(exit 0 — no errors)

npm run build
✓ built in 3.34s

npx tsx scripts/testScoringGuards.ts
scoring guards passed
(exit 0)
```

---

## Migration Status

All three blockers identified in Phase 15D are resolved:

| Blocker | Status |
|---|---|
| `durationDays` defaults to 14 when wizard sends only dates | ✅ Fixed — derived from dates |
| Owner auto-membership written with `role: 'member'` | ✅ Fixed — `role: 'owner'` + `approvedAt` |
| Donation challenge creator receives immediate membership | ✅ Fixed — membership only created for active challenges |

**The callable is now ready for frontend migration (Phase 15F).**
