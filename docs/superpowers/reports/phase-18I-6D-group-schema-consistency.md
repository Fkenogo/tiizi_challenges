# Phase 18I-6D — Group Document Schema Consistency

**Date:** 2026-07-02
**Branch:** fix/p0-pre-deploy-blockers

---

## Root Cause

`groupService.createGroup()` wrote group documents without the `status` and `moderationStatus` fields that govern lifecycle gating. The Cloud Function `challengeCreationBackend.ts` checks:

```ts
if (String(group.status ?? '').toLowerCase() !== 'active') { ... }
```

When `status` is missing, `?? ''` evaluates to `''`, which is `!== 'active'`, so **challenge creation failed for every group created through the app** with a "group is not active" error. Seeded/legacy groups had `moderationStatus: 'active'` but also lacked `status`.

Additionally:
- `isGroupActive()` treated missing `status` as active (legacy default) but did **not** check `moderationStatus`. An admin could set `moderationStatus: 'deactivated'` without the service-layer guard catching it.
- New groups were missing: `visibility`, `isFeatured`, `isVerified`, `reviewStatus`.
- Seed data groups were missing: `status`, `visibility`, `isVerified`, `reviewStatus`.

---

## Files Changed

| File | Change |
|---|---|
| `src/types/index.ts` | Added `visibility`, `isFeatured`, `isVerified`, `reviewStatus`, `countersUpdatedAt` to `Group` interface |
| `src/utils/groupLifecycle.ts` | Added `buildGroupDefaults()` helper; updated `isGroupActive()` to also check `moderationStatus !== 'deactivated'` |
| `src/services/groupService.ts` | `createGroup()` now calls `buildGroupDefaults()` — all new groups get the full canonical schema |
| `scripts/seedAppData.ts` | All 6 seed groups now include `status`, `visibility`, `isVerified`, `reviewStatus` |
| `scripts/auditGroupDocumentSchema.ts` | **New** — dry-run audit + optional repair script for existing Firestore docs |
| `scripts/testGroupLifecycle.ts` | Added Tests 22–29 (8 new guards, 64 total) |
| `package.json` | Added `audit:group-document-schema` script |

---

## Canonical Group Schema (buildGroupDefaults)

Every new group document now writes:

```ts
{
  name, description, ownerId, coverImageUrl,
  isPrivate: boolean,
  requireAdminApproval: boolean,
  allowMemberChallenges: boolean,
  inviteCode: string,
  memberCount: 1,
  activeChallenges: 0,
  createdAt: ISO string,
  status: 'active',           // ← was missing
  moderationStatus: 'active', // ← was missing
  visibility: 'public' | 'private', // ← was missing
  isFeatured: false,          // ← was missing
  isVerified: false,          // ← was missing
  reviewStatus: 'pending',    // ← was missing
}
```

---

## isGroupActive() Updated Logic

```
status === 'active' (or missing for legacy docs)
AND
moderationStatus !== 'deactivated'
```

Previously only checked `status`. Now the belt-and-suspenders check means admin deactivation via either field alone is sufficient to block access.

---

## Audit Script

```
npx tsx scripts/auditGroupDocumentSchema.ts              # dry-run
npx tsx scripts/auditGroupDocumentSchema.ts --execute --confirm  # write repairs
```

Checks: `status`, `moderationStatus`, `visibility`, `allowMemberChallenges`, `requireAdminApproval`, `activeChallenges`, `id`

Audit-only (not auto-repaired): `reviewStatus`, `isFeatured`, `isVerified`

Safe repair defaults:
- `status` → `'active'` (skips if `status === 'inactive'` or `'deactivated'`)
- `moderationStatus` → `'active'` (skips if already `'deactivated'`)
- `visibility` → derived from `isPrivate`
- `allowMemberChallenges` → `true`
- `requireAdminApproval` → `false`
- `activeChallenges` → `0`
- `id` → document ID

---

## Audit Results (before repair — local Firestore not accessible in CI)

The audit script connects to the live Firestore project. Run manually:
```
npx tsx scripts/auditGroupDocumentSchema.ts
```

Expected findings for any group created before this fix:
- Missing: `status`, `moderationStatus`, `visibility`, `isFeatured`, `isVerified`, `reviewStatus`

---

## Validation

| Command | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm run build` | ✅ built in 3.68s |
| `npm run test:group-lifecycle` | ✅ 64/64 |
| `npm run test:challenge-creation-backend` | ✅ passed |
| `npm run test:home-challenge-feeds` | ✅ all guards passed |
| `npm run test:scoring-guards` | ✅ passed |
| `npm run audit:challenge-creation-payloads` | ✅ all guards passed |
