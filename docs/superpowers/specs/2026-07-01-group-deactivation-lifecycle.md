# Group Deactivation Lifecycle — Design Spec

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire group deactivation end-to-end so that `status: inactive` groups are hidden from discovery, blocked at every write path (service layer + Firestore rules + Cloud Function), and show a read-only deactivated banner to members who access them via direct link.

**Architecture:** Admin writes both `status: inactive` and `moderationStatus: deactivated` to the group doc. Every query, service method, rule, and Cloud Function uses `status` as the single operational source of truth. `moderationStatus` is kept for audit/admin display only.

**Tech Stack:** React + TypeScript + Firebase/Firestore, Firebase Cloud Functions v2 (functions/src), Firestore security rules, tsx test scripts.

---

## Global Constraints

- `status` is the single operational field governing group availability. `moderationStatus` is audit-only.
- `status: active` means the group is fully operational. Any other value (including missing/undefined) is treated as active for legacy documents — default-open semantics.
- `status: inactive` means: hidden from discovery, blocked for all writes, read-only for existing members.
- Admin screens (`adminGroupService`) must still return all groups regardless of status.
- Challenge creation by any active group member is permitted (no owner/admin restriction).
- All test scripts use the FakeDb pattern already established in `scripts/testChallengeCreationBackend.ts`.
- No Firestore migrations — `status` defaults to active when absent.
- Do NOT change challenge `status` values (challenges in inactive groups remain `active` in Firestore; they are excluded by group-status filtering at the service layer).
- Session-level hard constraints: Do NOT deploy. Do NOT run production writes. Do NOT bundle unrelated changes.

---

## File Structure

### Modified files

| File | Change |
|---|---|
| `src/types/index.ts` | Add `status` and `moderationStatus` to `Group` interface |
| `src/services/adminGroupService.ts` | `setGroupModerationStatus`, `suspendGroup`, `activateGroup` write `status` field |
| `src/services/groupService.ts` | `getGroups()` filters `status === active`; `joinGroup()` rejects inactive groups |
| `src/services/challengeService.ts` | `getUserAccessibleChallenges`, `getVisibleChallengesForUser`, `getChallengesForMyGroups` cross-filter against group status; `joinChallenge` rejects inactive groups |
| `src/services/workoutService.ts` | `createWorkout` rejects if group is inactive |
| `src/services/activityLogSessionService.ts` | Wellness log creation rejects if group is inactive |
| `src/features/Groups/GroupDetailScreen.tsx` | Show deactivated banner + disable all write CTAs when `group.status === 'inactive'` |
| `src/features/Groups/GroupsScreen.tsx` | My-groups list shows inactive-group indicator (badge/greyed) |
| `firestore.rules` | Add `isActiveGroup()` helper; gate `groupMembers`, `challengeMembers`, `workouts`, `wellnessLogs` creates |
| `functions/src/challengeCreationBackend.ts` | Already checks `group.status === 'active'` — no change needed |
| `scripts/testGroupLifecycle.ts` | New test file covering all required scenarios |
| `scripts/testChallengeCreationBackend.ts` | Add guards: challenge creation blocked when group inactive |
| `scripts/testScoringGuards.ts` | Static guard: `getGroups()` filters by status |
| `package.json` | Add `test:group-lifecycle` script |

### New files

| File | Purpose |
|---|---|
| `scripts/testGroupLifecycle.ts` | Behavioural + static tests for group deactivation lifecycle |

---

## Section 1 — Data Model

### `src/types/index.ts`

Add to `Group` interface:
```ts
export interface Group {
  // ... existing fields ...
  status?: 'active' | 'inactive' | 'suspended' | 'deleted';
  moderationStatus?: 'active' | 'flagged' | 'deactivated';  // audit-only
}
```

### Helper (used by service layer)

```ts
// src/utils/groupLifecycle.ts  (new tiny helper)
export function isGroupActive(group: { status?: string } | null | undefined): boolean {
  if (!group) return false;
  const s = String(group.status ?? 'active').toLowerCase();
  return s === 'active';
}
```

---

## Section 2 — Admin Write Path

### `src/services/adminGroupService.ts`

**`setGroupModerationStatus(groupId, status, adminUid)`** must now write both fields:

```ts
async setGroupModerationStatus(groupId: string, status: AdminGroupStatus, adminUid: string): Promise<void> {
  const operationalStatus = status === 'deactivated' ? 'inactive' : 'active';
  await updateDoc(doc(db, 'groups', groupId), {
    status: operationalStatus,
    moderationStatus: status,
    moderatedBy: adminUid,
    moderatedAt: new Date().toISOString(),
  });
}
```

**`suspendGroup(groupId, adminUid)`** — update to write `status: 'inactive'`:
```ts
await updateDoc(doc(db, 'groups', groupId), {
  status: 'inactive',
  moderationStatus: 'deactivated',
  moderatedBy: adminUid,
  moderatedAt: new Date().toISOString(),
});
```

**`activateGroup(groupId, adminUid)`** — update to write `status: 'active'`:
```ts
await updateDoc(doc(db, 'groups', groupId), {
  status: 'active',
  moderationStatus: 'active',
  moderatedBy: adminUid,
  moderatedAt: new Date().toISOString(),
});
```

---

## Section 3 — Discovery Layer

### `groupService.getGroups()` — Browse / Discover

Add Firestore filter so only active groups are returned to non-admin callers:
```ts
async getGroups(): Promise<Group[]> {
  const snap = await getDocs(
    query(collection(db, this.collectionName), where('status', 'in', ['active', null]))
  );
  // ...
}
```

Actually Firestore can't query for null/missing. Use client-side filter as the safe approach:
```ts
async getGroups(): Promise<Group[]> {
  const snap = await getDocs(collection(db, this.collectionName));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }))
    .filter((g) => isGroupActive(g))
    .map((group) => ({ ...group, memberCount: group.memberCount ?? 0 }))
    .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
}
```

### `challengeService` — Challenge Discovery

`getUserAccessibleChallenges`, `getVisibleChallengesForUser`, and `getChallengesForMyGroups` all compute a `userGroupIds` array from memberships before querying challenges. Add an extra step: after computing `userGroupIds`, batch-fetch the group docs and filter to only those with `status: active` (or missing, for legacy).

```ts
// After computing userGroupIds, before querying challenges:
const activeGroupIds = await this.filterActiveGroupIds(userGroupIds);
if (activeGroupIds.length === 0) return [];
// use activeGroupIds in the challenges query instead of userGroupIds
```

```ts
private async filterActiveGroupIds(groupIds: string[]): Promise<string[]> {
  if (groupIds.length === 0) return [];
  const chunks: string[][] = [];
  for (let i = 0; i < groupIds.length; i += 10) chunks.push(groupIds.slice(i, i + 10));
  const snaps = await Promise.all(
    chunks.map((chunk) =>
      getDocs(query(collection(db, 'groups'), where(documentId(), 'in', chunk)))
    )
  );
  return snaps
    .flatMap((snap) => snap.docs)
    .filter((d) => isGroupActive(d.data() as Group))
    .map((d) => d.id);
}
```

---

## Section 4 — Write Guards (Service Layer)

### `groupService.joinGroup(groupId, userId)`

After `const group = await this.getGroupById(groupId)`:
```ts
if (!isGroupActive(group)) {
  throw new Error('This group is no longer active and cannot be joined.');
}
```

### `challengeService.joinChallenge(userId, challengeId)`

After fetching group membership, add a group-status check:
```ts
const groupRef = doc(db, 'groups', challenge.groupId);
const groupSnap = await getDoc(groupRef);
if (!isGroupActive(groupSnap.data())) {
  throw new Error('Cannot join a challenge in a deactivated group.');
}
```

### `workoutService.createWorkout(input)`

After fetching the challenge, add a group-status check:
```ts
if (input.groupId) {
  const groupSnap = await getDoc(doc(db, 'groups', input.groupId));
  if (!isGroupActive(groupSnap.data())) {
    throw new Error('Activity logging is not available — this group has been deactivated.');
  }
}
```

### `activityLogSessionService` (wellness logs)

Same pattern — after loading the challenge, fetch the group doc and check status.

---

## Section 5 — UI: Group Detail Screen

### `src/features/Groups/GroupDetailScreen.tsx`

```tsx
// After loading group data:
const isDeactivated = group?.status === 'inactive';

// Show banner at top when deactivated:
{isDeactivated && (
  <div className="mx-4 mt-4 rounded-2xl bg-red-50 border border-red-200 px-4 py-3">
    <p className="text-[14px] font-bold text-red-700">This group has been deactivated.</p>
    <p className="text-[12px] text-red-600 mt-0.5">Challenges and activity logging are unavailable.</p>
  </div>
)}

// Gate all write CTAs on !isDeactivated:
// - Join Group button: hidden when isDeactivated
// - Create Challenge button: hidden when isDeactivated
// - Log Workout / Log Activity CTAs in challenge cards: hidden/disabled when isDeactivated
// - Invite button: hidden when isDeactivated
```

### `src/features/Groups/GroupsScreen.tsx`

In the "My Groups" tab, render an inactive badge for deactivated groups:
```tsx
{group.status === 'inactive' && (
  <span className="text-[10px] font-bold text-red-600 bg-red-50 rounded px-1.5 py-0.5">Inactive</span>
)}
```

---

## Section 6 — Firestore Rules

Add helper function:
```
function isActiveGroup(groupId) {
  // Returns true if the group exists and is not inactive.
  // Default-active: missing status field treated as active (legacy docs).
  return !exists(/databases/(default)/documents/groups/$(groupId))
    || get(/databases/(default)/documents/groups/$(groupId)).data.keys().hasAny(['status']) == false
    || get(/databases/(default)/documents/groups/$(groupId)).data.status != 'inactive';
}
```

Gate write rules:

```
// groupMembers create: only for active groups
allow create: if isAuthenticated()
              && request.resource.data.userId == request.auth.uid
              && isActiveGroup(request.resource.data.groupId);

// challengeMembers create: group must be active
allow create: if isAuthenticated()
              // ... existing checks ...
              && isActiveGroup(resource.data.groupId);  // resource = challenge doc

// workouts create: group must be active
allow create: if isAuthenticated()
              && request.resource.data.userId == request.auth.uid
              && (request.resource.data.groupId == null || isActiveGroup(request.resource.data.groupId));

// wellnessLogs create: same pattern
allow create: if isAuthenticated()
              && request.resource.data.userId == request.auth.uid
              && (request.resource.data.groupId == null || isActiveGroup(request.resource.data.groupId));
```

**Important:** `isActiveGroup()` does a Firestore document get — count it against the 10-read-per-request rule. All affected rules already do at most 1-2 gets, so this stays within limits.

---

## Section 7 — Tests

### `scripts/testGroupLifecycle.ts` (new)

Uses FakeDb / FakeTransaction pattern from `testChallengeCreationBackend.ts`.

Required test cases:
1. `setGroupModerationStatus('deactivated')` writes `{ status: 'inactive', moderationStatus: 'deactivated' }`
2. `activateGroup()` writes `{ status: 'active', moderationStatus: 'active' }`
3. `joinGroup()` throws when group `status: 'inactive'`
4. `joinChallenge()` throws when group `status: 'inactive'`
5. `createWorkout()` throws when group `status: 'inactive'`
6. `getGroups()` static guard: uses `isGroupActive` filter
7. Admin `getGroups()` (adminGroupService) returns all groups regardless of status

### `scripts/testChallengeCreationBackend.ts` — additions

8. Challenge creation blocked when group `status: 'inactive'`
9. Active member (non-owner) creates challenge in active group — succeeds
10. Non-member cannot create challenge
11. Owner without membership gets membership doc created

### `scripts/testScoringGuards.ts` — static guard

12. `groupService.getGroups()` references `isGroupActive` (static source check)

### `package.json`

```json
"test:group-lifecycle": "tsx scripts/testGroupLifecycle.ts"
```

---

## Lifecycle Diagram

```
Admin Action: Deactivate Group
│
├─ writes: { status: 'inactive', moderationStatus: 'deactivated' }
│
├─ DISCOVERY (immediate)
│   ├─ groupService.getGroups()       → filters out (isGroupActive = false)
│   ├─ challengeService.*()           → filterActiveGroupIds removes group
│   └─ Home / My Challenges           → no challenges from inactive group
│
├─ DIRECT LINK (member opens /app/group/:id)
│   ├─ group doc loads (read allowed)
│   ├─ GroupDetailScreen detects status === 'inactive'
│   ├─ Deactivated banner shown
│   └─ All write CTAs hidden/disabled
│
└─ WRITE PATHS (all blocked at multiple layers)
    ├─ joinGroup()         → service throws
    ├─ joinChallenge()     → service throws
    ├─ createWorkout()     → service throws
    ├─ wellnessLog()       → service throws
    ├─ createChallenge()   → Cloud Function checks group.status === 'active'
    └─ Firestore rules     → isActiveGroup() blocks all of the above at DB level

Admin Action: Re-activate Group
│
└─ writes: { status: 'active', moderationStatus: 'active' }
    └─ All above paths immediately re-enabled (no migrations needed)
```
