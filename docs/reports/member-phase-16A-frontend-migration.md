# Phase 16A — Frontend Migration to Transactional Challenge Creation

**Date:** 2026-06-26
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** `src/features/Challenges/CreateChallengeWizard.tsx`, `scripts/testScoringGuards.ts`

---

## Migration Summary

The challenge creation wizard now calls `createChallengeWithCreatorMembership` (Cloud Function callable) instead of the client-side `challengeService.createChallenge()` + `joinChallenge()` sequence.

### Old flow

```
handleLaunch()
  → validate payload
  → createChallenge.mutateAsync(payload)          ← client setDoc
      [on permission-denied]
      → groupService.joinGroup()                  ← retry shim
      → createChallenge.mutateAsync(payload)      ← retry
  → joinChallenge()                               ← inside createChallenge (separate write)
  → incrementUsageCount()
  → navigate()
```

### New flow

```
handleLaunch()
  → validate payload
  → createChallengeCallable(payload)              ← single Cloud Function call
      [on error — propagates to outer catch → showToast]
  → incrementUsageCount()
  → navigate()
```

---

## Files Changed

### `src/features/Challenges/CreateChallengeWizard.tsx`

**Imports added:**
```typescript
import { getFunctions, httpsCallable } from 'firebase/functions';
import { app } from '../../lib/firebase';
```

**Module-level callable setup (above component):**
```typescript
const _functions = getFunctions(app, 'us-central1');
const createChallengeCallable = httpsCallable<Record<string, unknown>, { challenge: { id: string } }>(
  _functions,
  'createChallengeWithCreatorMembership',
);
```

**Creation block replaced (inside `handleLaunch`):**
```typescript
// Before (3 operations, non-atomic, with retry):
let challenge;
try {
  challenge = await createChallenge.mutateAsync(payload);
} catch (error) {
  if (!isPermissionDenied(error)) throw error;
  await groupService.joinGroup(activeGroupId, user.uid).catch(() => null);
  challenge = await createChallenge.mutateAsync(payload);
}

// After (single atomic callable call):
const callableResult = await createChallengeCallable(payload as Record<string, unknown>);
const challenge = callableResult.data.challenge;
```

**Unchanged:**
- All payload construction (all engine fields, donation fields, activities, template metadata)
- Pre-flight membership validation (`getMembershipStatus` check)
- `incrementUsageCount` fire-and-forget for `templateId` and `wellnessTemplateId`
- Toast messages for success and error
- Navigation (`navigate(challengeRoute(..., challenge.id))`)
- `useCreateChallenge` hook kept in place (rollback: restore `createChallenge.mutateAsync`)
- `challengeService.createChallenge()` and `joinChallenge()` untouched in service file
- `isPermissionDenied` helper left in place (rollback reference)

---

## What the callable provides that the old flow did not

| Capability | Old flow | New flow |
|---|---|---|
| Atomic create + join | ❌ Three separate writes | ✅ Single transaction |
| `groupVisibility` / `visibility` on challenge doc | ❌ Not written | ✅ Written from group doc |
| `createdAt` on challenge doc | ❌ Not written | ✅ Written |
| `allowMemberChallenges` enforcement | ❌ Not checked | ✅ Enforced |
| `createdBy` verified via JWT | ❌ Client-supplied | ✅ Server-verified |
| Full rollback on failure | ❌ Partial state possible | ✅ All-or-nothing |
| Server-side input validation | ❌ UI only | ✅ name/description/activities/engine fields |
| Retry-after-join hack | ✅ Present | ✅ Removed (server handles membership) |

---

## Regression Guards Added (16A-1 through 16A-8 + rollback check)

| Guard | What it verifies |
|---|---|
| 16A-1 | Wizard calls `createChallengeCallable` |
| 16A-2 | Wizard no longer calls `createChallenge.mutateAsync()` |
| 16A-3 | Wizard no longer calls `joinChallenge()` during creation |
| 16A-4 | `incrementUsageCount` still fires for both template types after creation |
| 16A-5 | All v2 engine fields present in callable payload |
| 16A-6 | Donation fields present in callable payload |
| 16A-7 | Collective engine payload intact |
| 16A-8 | Streak engine payload intact |
| Rollback | `challengeService.createChallenge` and `joinChallenge` still exist in service |

---

## Validation Output

```
npm --prefix functions run build
> tsc -p tsconfig.json
(exit 0)

npx tsc -b --pretty false
(exit 0 — no errors)

npm run build
✓ built in 3.30s

npx tsx scripts/testScoringGuards.ts
scoring guards passed
(exit 0)
```

---

## Rollback Plan

To revert to the client path, in `CreateChallengeWizard.tsx` restore:

```typescript
let challenge;
try {
  challenge = await createChallenge.mutateAsync(payload);
} catch (error) {
  if (!isPermissionDenied(error)) throw error;
  await groupService.joinGroup(activeGroupId, user.uid).catch(() => null);
  challenge = await createChallenge.mutateAsync(payload);
}
```

The callable imports and module-level constants can remain or be removed separately. `challengeService.createChallenge()` and `joinChallenge()` are untouched and immediately available.
