# Phase 18E-1 — Group Challenge Creation Authorization

**Date:** 2026-06-28
**Branch:** fix/p0-pre-deploy-blockers

---

## Issue

When any group member attempted to launch a group challenge, the app returned:

> "Only the group owner can create challenges in this group"

The error fired even when the group had not explicitly disabled member challenges, because `allowMemberChallenges` defaulted to `undefined` in many groups — but the guard treated `=== false` as owner-only regardless of intent.

---

## Root Cause

`functions/src/challengeCreationBackend.ts` lines 404–406 (prior to fix):

```ts
if (group.allowMemberChallenges === false && !isOwner) {
  throw new HttpsError('permission-denied', 'Only the group owner can create challenges in this group');
}
```

This hard gate blocked any non-owner active member when `allowMemberChallenges` was explicitly `false`. There was no admin bypass.

---

## Fix

### `functions/src/challengeCreationBackend.ts`

**Removed** the `allowMemberChallenges` owner-only gate entirely.

**Added** `isAdmin` derived from the member's role, used in two places:

1. `isOwnerOrAdmin = isOwner || isAdmin` — determines whether the challenge needs moderation approval in private groups.
2. `requiresModerationApproval = groupVisibility === 'private' && !isOwnerOrAdmin` — causes private-group challenges created by regular members to enter `status: 'pending'` / `moderationStatus: 'pending'` rather than becoming active immediately.

**Authorization matrix after fix:**

| Actor | Group type | Allowed? | Challenge status |
|---|---|---|---|
| Non-member | any | ❌ blocked | — |
| Owner | public | ✅ | active / approved |
| Owner | private | ✅ | active / approved |
| Admin | public | ✅ | active / approved |
| Admin | private | ✅ | active / approved |
| Member | public | ✅ | active / approved |
| Member | private | ✅ | pending / pending |

Creator challenge membership is still written for all allowed cases (including pending challenges).

---

## Files Changed

| File | Change |
|---|---|
| `functions/src/challengeCreationBackend.ts` | Removed `allowMemberChallenges` owner gate; added `isAdmin`, `isOwnerOrAdmin`, `requiresModerationApproval`; updated `status` and `moderationStatus` fields in the challenge payload |
| `scripts/testChallengeCreationBackend.ts` | Replaced the old `allowMemberChallenges: false` test (1 case) with three new cases: public group member → active, private group member → pending, private group admin → active |

---

## Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 8.39s
npm run test:challenge-creation-backend   → ✅ All tests passed
npm run test:challenge-creation-6combos   → ✅ All 8 combinations passed
npm run audit:challenge-creation-payloads → ✅ All 8 guards passed
npm run test:scoring-guards               → ✅ All 14 guards passed
```

---

## Collections Touched

None. This is a Cloud Function backend logic change — no Firestore writes, no seed scripts, no schema changes.
