# Phase 10B-P1 - Group Member Count Cleanup

Date: 2026-06-14  
Scope: Member-facing group count scalability  
Mode: Implementation completed. No deploy was run.

## Summary

Member-facing group screens no longer read all `groupMembers` documents to calculate member counts. Counts now come from the server-owned `groups.memberCount` field introduced in Phase 7B.

## Files Changed

- `src/hooks/useGroups.ts`
- `src/services/groupService.ts`
- `src/features/Groups/GroupDetailScreen.tsx`
- `src/features/Groups/GroupFeedScreen.tsx`
- `src/features/Groups/GroupMembersScreen.tsx`
- `docs/reports/member-phase-10b-p1-group-member-count-cleanup.md`

## Old Read Pattern Removed

Old member-facing path:

```ts
useGroupMemberCount(groupId)
  -> groupService.getGroupMemberCount(groupId)
  -> getDocs(query(collection(db, 'groupMembers'), where('groupId', '==', groupId)))
  -> client-side count active/joined statuses
```

This was an unbounded per-group membership read on Group Detail, Group Feed, and Group Members.

Removed:

- `useGroupMemberCount()` from `src/hooks/useGroups.ts`
- `groupService.getGroupMemberCount()` from `src/services/groupService.ts`
- `group-member-count` query invalidations from join/leave mutations

Post-change sentinel:

```bash
rg -n "useGroupMemberCount|getGroupMemberCount" src -S
```

Result: no matches.

## New Read Pattern

Group screens already load the group document with `useGroup(id)`. They now derive:

```ts
const memberCount = group?.memberCount ?? 0;
```

Confirmed screens:

| Screen | Count source |
| --- | --- |
| `GroupDetailScreen` | `group?.memberCount ?? 0` |
| `GroupFeedScreen` | `group?.memberCount ?? 0` |
| `GroupMembersScreen` | `group?.memberCount ?? 0` |
| `GroupsScreen` / group cards | Already used `group.memberCount` |

## Firestore Rules

No Firestore rules were changed. This fix relies on the existing Phase 7B trust boundary: clients do not own `groups.memberCount`; Cloud Functions/Admin SDK own derived counters.

## Remaining Count-Related Full Reads

No remaining `getGroupMemberCount()` or `useGroupMemberCount()` references exist in `src`.

Related but separate from this P1 fix:

- `useGroupMembers()` still reads `groupMemberStats` with a bounded limit for the member roster, not raw `groupMembers`.
- `groupService.getMyGroups()` still reads the current user's own membership docs to list their groups. This is user-scoped, not a group-wide member count scan.

## Validation Output

### Invite backend test

Command:

```bash
npm run test:group-invite-backend
```

Result:

```text
Group invite backend security tests passed
```

### TypeScript

Command:

```bash
npx tsc -b --pretty false
```

Result: passed with no output.

### Production build

Command:

```bash
npm run build
```

Result:

```text
✓ 1844 modules transformed.
✓ built in 4.37s
```

Build warning remains unchanged: `vendor-firebase-*.js` is larger than 500 kB.

## Deployment Notes

Deploy needed for app behavior:

```bash
firebase deploy --only hosting --project tiizi-challenges
```

No rules, indexes, functions, or data backfill are required for this cleanup.
