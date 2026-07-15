# Group Deactivation Lifecycle — Design Spec (Phase 18I-6B)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Wire group deactivation end-to-end so that `status: inactive` groups are hidden from discovery, blocked at every write path (UI + service layer + Firestore rules + Cloud Function), and show a read-only deactivated banner to members who access them via direct link.

**Architecture:** Admin writes both `status: inactive` and `moderationStatus: deactivated` to the group doc, and logs a lifecycle event to `groupLifecycleEvents`. Every query, service method, rule, and Cloud Function uses `status` as the single operational source of truth. `moderationStatus` is kept for audit/admin display only. Challenges in inactive groups are NOT hard-closed — they are filtered out at the service/UI layer only.

**Tech Stack:** React + TypeScript + Firebase/Firestore, Firebase Cloud Functions v2 (`functions/src`), Firestore security rules, `tsx` test scripts.

---

## Global Constraints

- `status` is the single operational field governing group availability. `moderationStatus` is audit-only.
- `status: active` means the group is fully operational. Missing/undefined `status` is treated as `active` **during rollout only** — see Migration Note.
- `status: inactive` means: hidden from discovery, blocked for all writes, read-only for existing members.
- Admin screens (`adminGroupService`) must still return all groups regardless of `status`.
- Challenge creation by any active group member is permitted; no owner/admin restriction.
- Challenges in inactive groups are **not** hard-closed in Firestore. Their `status` field stays unchanged. They are excluded by group-status filtering at the service/UI layer.
- All test scripts use the `FakeDb` pattern from `scripts/testChallengeCreationBackend.ts`.
- Do NOT deploy. Do NOT run production writes. Do NOT bundle unrelated changes.

---

## Migration / Backfill Note

During rollout, missing `status` is treated as `active` (default-open) for legacy compatibility. Long-term, every group document must have an explicit `status` field.

**Follow-up task (not part of this phase):** Create `scripts/backfillGroupStatus.ts` — a dry-run-by-default script that reads all `groups` docs lacking a `status` field and writes `status: 'active'` to each. Requires `--execute --confirm` to write, same pattern as `auditChallengeProgressIntegrity.ts`.

---

## File Structure

### Modified files

| File | Change |
|---|---|
| `src/types/index.ts` | Add `status` and `moderationStatus` to `Group` interface |
| `src/utils/groupLifecycle.ts` | New utility: `isGroupActive()` helper |
| `src/services/adminGroupService.ts` | `setGroupModerationStatus`, `suspendGroup`, `activateGroup` write `status` + log lifecycle event; accept optional `reason` |
| `src/services/groupService.ts` | `getGroups()` filters inactive; `joinGroup()` rejects inactive groups; invalidates query cache |
| `src/services/challengeService.ts` | `getUserAccessibleChallenges`, `getVisibleChallengesForUser`, `getChallengesForMyGroups` cross-filter against group status; `joinChallenge` rejects inactive groups |
| `src/services/workoutService.ts` | `createWorkout` rejects if group is inactive |
| `src/services/activityLogSessionService.ts` | Wellness log creation rejects if group is inactive |
| `src/features/Groups/GroupDetailScreen.tsx` | Show deactivated banner + disable all write CTAs when `group.status === 'inactive'` |
| `src/features/Groups/GroupsScreen.tsx` | My-groups list shows inactive badge; discover tab excludes inactive |
| `firestore.rules` | Add `isActiveGroup()` helper; gate `groupMembers`, `challengeMembers`, `workouts`, `wellnessLogs` creates; add comment for new collections |
| `functions/src/challengeCreationBackend.ts` | Already checks `group.status === 'active'` — no change needed |
| `scripts/testGroupLifecycle.ts` | New test file covering all required scenarios |
| `scripts/testChallengeCreationBackend.ts` | Add guard: challenge creation blocked when group inactive |
| `scripts/testScoringGuards.ts` | Static guard: `groupService.getGroups()` filters by `isGroupActive` |
| `package.json` | Add `test:group-lifecycle` script |

### New files

| File | Purpose |
|---|---|
| `src/utils/groupLifecycle.ts` | `isGroupActive(group)` helper used by service layer |
| `scripts/testGroupLifecycle.ts` | Behavioural + static tests for group deactivation lifecycle |

---

## Section 1 — Data Model

### `src/types/index.ts`

```ts
export interface Group {
  // ... existing fields ...
  /** Operational availability. 'active' = fully open; 'inactive' = deactivated by admin. */
  status?: 'active' | 'inactive' | 'suspended' | 'deleted';
  /** Admin moderation record — audit/display only. Use `status` for gating logic. */
  moderationStatus?: 'active' | 'flagged' | 'deactivated';
}
```

### `src/utils/groupLifecycle.ts` (new)

```ts
/** Returns true when the group is operational (status active or missing — legacy default). */
export function isGroupActive(group: { status?: string } | null | undefined): boolean {
  if (!group) return false;
  const s = String(group.status ?? 'active').toLowerCase();
  return s === 'active';
}
```

---

## Section 2 — Lifecycle Event Logging

Every admin activation/deactivation writes a document to `groupLifecycleEvents`:

```ts
// shape of each event doc
{
  groupId: string;
  type: 'activated' | 'deactivated';
  performedBy: string;        // adminUid
  previousStatus: string;     // 'active' | 'inactive' | unknown for first event
  newStatus: string;          // 'active' | 'inactive'
  moderationStatus: string;   // 'active' | 'deactivated'
  reason?: string;            // optional, supplied by admin UI
  timestamp: string;          // ISO 8601
}
```

Write in `adminGroupService` using `addDoc(collection(db, 'groupLifecycleEvents'), eventPayload)` — fire-and-forget (do not block the main deactivation on this write failing).

---

## Section 3 — Admin Write Path

### `src/services/adminGroupService.ts`

**`setGroupModerationStatus(groupId, status, adminUid, reason?)`**

```ts
async setGroupModerationStatus(
  groupId: string,
  status: AdminGroupStatus,
  adminUid: string,
  reason?: string,
): Promise<void> {
  const newOperationalStatus = status === 'deactivated' ? 'inactive' : 'active';
  // Fetch current status for event log
  const prev = await getDoc(doc(db, 'groups', groupId));
  if (!prev.exists()) throw new Error('Group not found');
  const previousStatus = String((prev.data() as Record<string, unknown>).status ?? 'active');

  await updateDoc(doc(db, 'groups', groupId), {
    status: newOperationalStatus,
    moderationStatus: status,
    moderatedBy: adminUid,
    moderatedAt: new Date().toISOString(),
  });

  // Fire-and-forget lifecycle event
  addDoc(collection(db, 'groupLifecycleEvents'), {
    groupId,
    type: status === 'deactivated' ? 'deactivated' : 'activated',
    performedBy: adminUid,
    previousStatus,
    newStatus: newOperationalStatus,
    moderationStatus: status,
    ...(reason ? { reason } : {}),
    timestamp: new Date().toISOString(),
  }).catch(console.error);
}
```

**`suspendGroup(groupId, adminUid, reason?)`** — delegates to `setGroupModerationStatus(groupId, 'deactivated', adminUid, reason)`.

**`activateGroup(groupId, adminUid)`** — before activating, verify the group exists and is not deleted:

```ts
async activateGroup(groupId: string, adminUid: string): Promise<void> {
  const snap = await getDoc(doc(db, 'groups', groupId));
  if (!snap.exists()) throw new Error('Group not found — cannot reactivate a deleted group.');
  await this.setGroupModerationStatus(groupId, 'active', adminUid);
}
```

---

## Section 4 — Discovery Layer

### `src/utils/groupLifecycle.ts`

Re-used from Section 1.

### `groupService.getGroups()` — Browse / Discover

Firestore cannot filter on missing fields, so use client-side filter after fetch:

```ts
async getGroups(): Promise<Group[]> {
  const snap = await getDocs(collection(db, this.collectionName));
  return snap.docs
    .map((d) => ({ id: d.id, ...(d.data() as Omit<Group, 'id'>) }))
    .filter((g) => isGroupActive(g))   // ← excludes inactive
    .map((group) => ({ ...group, memberCount: group.memberCount ?? 0 }))
    .sort((a, b) => (b.memberCount || 0) - (a.memberCount || 0));
}
```

`getMyGroups()` returns all user groups including inactive — the screen renders an inactive badge. This lets members see their history.

### `challengeService` — Private helper

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
    .filter((d) => isGroupActive(d.data() as { status?: string }))
    .map((d) => d.id);
}
```

Apply in `getUserAccessibleChallenges`, `getVisibleChallengesForUser`, and `getChallengesForMyGroups`: replace `userGroupIds` with `await this.filterActiveGroupIds(userGroupIds)` before querying the `challenges` collection.

---

## Section 5 — Write Guards (Service Layer)

### `groupService.joinGroup(groupId, userId)`

After `const group = await this.getGroupById(groupId)`:
```ts
if (!isGroupActive(group)) {
  throw new Error('This group is no longer active and cannot be joined.');
}
```

### `challengeService.joinChallenge(userId, challengeId)`

After verifying group membership, add:
```ts
const groupSnap = await getDoc(doc(db, 'groups', challenge.groupId));
if (!isGroupActive(groupSnap.exists() ? (groupSnap.data() as Group) : null)) {
  throw new Error('Cannot join a challenge in a deactivated group.');
}
```

### `workoutService.createWorkout(input)`

After fetching the challenge doc, add:
```ts
if (input.groupId) {
  const groupSnap = await getDoc(doc(db, 'groups', input.groupId));
  if (!isGroupActive(groupSnap.exists() ? (groupSnap.data() as { status?: string }) : null)) {
    throw new Error('Activity logging is not available — this group has been deactivated.');
  }
}
```

### `activityLogSessionService` — Wellness Logs

Same pattern: after loading the challenge and group membership, fetch the group doc and throw if inactive.

---

## Section 6 — UI

### `src/features/Groups/GroupDetailScreen.tsx`

```tsx
const isDeactivated = group?.status === 'inactive';

{isDeactivated && (
  <div className="mx-4 mt-4 rounded-2xl bg-slate-100 border border-slate-300 px-4 py-3">
    <p className="text-[14px] font-bold text-slate-800">This community is no longer active.</p>
    <p className="text-[12px] text-slate-600 mt-0.5">
      It has been deactivated by Tiizi administrators. Challenges are now read-only and no new activity can be recorded.
    </p>
  </div>
)}
```

**Hidden/disabled when `isDeactivated === true`:**
- Join Group button
- Create Challenge button
- Log Workout / Log Activity CTAs in challenge cards
- Invite members button
- Any edit actions

Challenge list still renders (read-only history). Challenge CTAs replaced with a lock indicator or simply hidden.

### `src/features/Groups/GroupsScreen.tsx`

In "My Groups" tab, render inactive badge per group:
```tsx
{group.status === 'inactive' && (
  <span className="text-[10px] font-bold text-slate-500 bg-slate-100 rounded px-1.5 py-0.5 ml-1">
    Inactive
  </span>
)}
```

Discover tab uses `useGroups()` → `groupService.getGroups()` → already filtered.

### Cache Invalidation

After `setGroupModerationStatus` / `activateGroup` the admin UI must invalidate:
- `['groups']`
- `['my-groups', uid]`
- `['challenges', ...]`
- `['home-screen-data', uid]`
- `['group-detail', groupId]`

Use `queryClient.invalidateQueries` on the relevant keys in the admin mutation's `onSuccess` callback.

---

## Section 7 — Firestore Rules

Add helper (immediately after `isPublicGroup`):

```
// Returns true when the group is active or has no status field (legacy default-open).
// Any new collection that links to a group by groupId MUST use this helper on create.
function isActiveGroup(groupId) {
  let g = get(/databases/(default)/documents/groups/$(groupId));
  return !g.data.keys().hasAll(['status']) || g.data.status != 'inactive';
}
```

Gate write rules:

```
// groupMembers — only allow joining active groups
match /groupMembers/{membershipId} {
  allow create: if isAuthenticated()
                && request.resource.data.userId == request.auth.uid
                && isActiveGroup(request.resource.data.groupId);   // ← added
  // ... existing update/delete ...
}

// challengeMembers — challenge's group must be active
match /challengeMembers/{membershipId} {
  allow create: if isAuthenticated()
                // ... existing checks ...
                && isActiveGroup(resource.data.groupId);           // ← added (resource = challenge)
}

// workouts — group must be active (or no group)
match /workouts/{workoutId} {
  allow create: if isAuthenticated()
                && request.resource.data.userId == request.auth.uid
                && (
                  !('groupId' in request.resource.data)
                  || isActiveGroup(request.resource.data.groupId)  // ← added
                );
}

// wellnessLogs — same pattern as workouts
match /wellnessLogs/{logId} {
  allow create: if isAuthenticated()
                && request.resource.data.userId == request.auth.uid
                && (
                  !('groupId' in request.resource.data)
                  || isActiveGroup(request.resource.data.groupId)  // ← added
                );
}

// NOTE: Any future collection that stores a groupId and allows member writes
// MUST add && isActiveGroup(request.resource.data.groupId) to its create rule.
```

---

## Section 8 — Tests

### `scripts/testGroupLifecycle.ts` (new)

1. `setGroupModerationStatus('deactivated')` writes `{ status: 'inactive', moderationStatus: 'deactivated' }` to the group doc
2. `activateGroup()` writes `{ status: 'active', moderationStatus: 'active' }`
3. `activateGroup()` throws when group doc does not exist
4. `joinGroup()` throws when group `status === 'inactive'`
5. `joinChallenge()` throws when group `status === 'inactive'`
6. `createWorkout()` throws when group `status === 'inactive'`
7. Wellness log creation throws when group `status === 'inactive'`
8. `getGroups()` excludes groups with `status === 'inactive'`
9. `getMyGroups()` includes inactive groups (member sees history)
10. Challenge discovery excludes challenges from inactive groups
11. Admin `getGroups()` returns all groups including inactive
12. Reactivation: group with `status: 'inactive'` → `activateGroup()` → `status: 'active'`, group operational again

### `scripts/testChallengeCreationBackend.ts` — additions

13. Challenge creation blocked when group `status === 'inactive'`
14. Non-owner active member creates challenge successfully
15. Non-member cannot create challenge
16. Owner without membership gets membership doc created on challenge creation

### `scripts/testScoringGuards.ts` — static guard

17. `groupService.ts` source references `isGroupActive` in `getGroups()`

### `package.json`

```json
"test:group-lifecycle": "tsx scripts/testGroupLifecycle.ts"
```

---

## Lifecycle Diagram

```
Admin Action: Deactivate Group
│
├─ setGroupModerationStatus(groupId, 'deactivated', adminUid, reason?)
│   ├─ writes: { status: 'inactive', moderationStatus: 'deactivated', ... }
│   └─ logs: groupLifecycleEvents/{ type: 'deactivated', ... } (fire-and-forget)
│
├─ DISCOVERY (immediate, cache-invalidated)
│   ├─ groupService.getGroups()            → isGroupActive = false → excluded
│   ├─ challengeService.*()                → filterActiveGroupIds removes group
│   └─ Home / My Challenges / Suggestions  → no challenges from inactive group
│
├─ DIRECT LINK (member opens /app/group/:id)
│   ├─ group doc loads (reads still allowed)
│   ├─ GroupDetailScreen: group.status === 'inactive'
│   ├─ Banner: "This community is no longer active."
│   └─ All write CTAs hidden; challenge list read-only
│
└─ WRITE PATHS — blocked at three independent layers
    │
    ├─ UI layer:      write CTAs hidden / disabled
    ├─ Service layer: joinGroup / joinChallenge / createWorkout / wellnessLog throw
    ├─ Firestore:     isActiveGroup() blocks direct Firestore writes
    └─ Cloud Function: group.status === 'active' check (already in place)

Admin Action: Re-activate Group
│
├─ activateGroup(groupId, adminUid)
│   ├─ verifies group doc exists
│   ├─ writes: { status: 'active', moderationStatus: 'active', ... }
│   └─ logs: groupLifecycleEvents/{ type: 'activated', ... }
│
└─ All paths immediately re-enabled (no Firestore cascade, no migrations needed)
```
