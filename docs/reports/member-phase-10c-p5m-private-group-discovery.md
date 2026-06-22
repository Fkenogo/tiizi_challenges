# Phase 10C-P5M — Private Group Ongoing Challenge Discovery

Date: 2026-06-19  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all validation passing, no rules deployed, no production writes

---

## Fix 1 — `getActiveChallengesForUser`: Replace `where(documentId(), 'in')` with Individual `getDoc` Calls

### Root Cause

`getActiveChallengesForUser` fetched challenge documents using:

```ts
where(documentId(), 'in', chunk)
```

This executes a **list query**, which hits Firestore's `allow list` rule. The `allow list` rule for `/challenges/{id}` is field-only (no `get()/exists()` calls) and only allows public challenges:

```
allow list: if isAuthenticated()
              && (status == 'active')
              && (visibility == 'public' OR groupVisibility == 'public');
```

Private-group challenges (`visibility == 'private'`, `groupVisibility == 'private'`) are always denied by this rule, even for group members. Any chunk containing a private-group challenge ID causes a `permission-denied` error for the entire chunk, silently dropping those challenges from the "Ongoing" section.

### Fix

Replaced the `for` loop using `getDocs(where(documentId(), 'in', chunk))` with parallel individual `getDoc` calls:

```ts
const snaps = await Promise.all(
  uniqueChallengeIds.map((id) => getDoc(doc(db, this.collectionName, id))),
);
```

Individual `getDoc` hits `allow get`, which calls `canReadChallenge(resource.data)` → `isGroupMember(data.groupId)`. Group members can read their private group's challenges.

### Files Changed

| File | Change |
|------|--------|
| `src/services/challengeService.ts` | `getActiveChallengesForUser`: replaced `getDocs(where(documentId(), 'in', chunk))` loop with `Promise.all(ids.map(id => getDoc(...)))` |

### Tests Added

P5M assertion 3 in `scripts/testHomeChallengeFeeds.ts`:
- `getActiveChallengesForUser` block (stripped of `//` comments) must not match `where(documentId()`
- `getActiveChallengesForUser` block must contain `getDoc(doc(db`

### Validation Commands Run

```
npm run test:home-challenge-feeds  ✓ passed
npx tsc -b --pretty false          ✓ no errors
npm run build                      ✓ built in 2.96s
```

### Deploy Requirements

Client-only change — no Cloud Functions deploy required. Standard frontend deploy.

### Remaining Risks

- `getCompletedChallengesForUser` still uses `where(documentId(), 'in', chunk)`. Completed challenges are shown in the user's history tab, not the Ongoing section. Private-group completed challenges will also be invisible there. Left in scope for a follow-up phase.
- Individual `getDoc` calls are less efficient than a batch query but the array is capped at 25 IDs, so the cost is bounded.

---

## Fix 2 — `getUserAccessibleChallengesPage`: Per-Chunk Try/Catch + Membership-Based Supplement

### Root Cause

`getUserAccessibleChallengesPage` builds chunks of `groupId` values and queries:

```ts
where('groupId', 'in', chunk)
```

If a chunk contains any private group's ID, Firestore denies the entire chunk (`allow list` requires `visibility == 'public' OR groupVisibility == 'public'`). The original code used `Promise.all` with no error handling, so one denied chunk propagated as an unhandled rejection, crashing the entire page load. Private-group members saw zero ongoing challenges.

### Fix

**Two changes**:

1. **Per-chunk try/catch**: each status×chunk query is wrapped individually so a denied chunk is silently skipped rather than crashing `Promise.all`.

2. **Membership-based supplement**: after the group-based queries, query `challengeMembers where userId == uid` (allowed by the `allow list` rule: `resource.data.userId == request.auth.uid`), collect challenge IDs not already fetched, then `getDoc` each one (uses `allow get: canReadChallenge`). Only challenges where `groupId ∈ userGroupIds` are included, preventing exposure of challenges from groups the user left or was removed from.

### Files Changed

| File | Change |
|------|--------|
| `src/services/challengeService.ts` | `getUserAccessibleChallengesPage`: replaced `Promise.all(chunks.flatMap(...))` with per-chunk try/catch loop; added membership supplement block; deduplicated by ID |

### Tests Added

P5M assertions 1 & 2 in `scripts/testHomeChallengeFeeds.ts`:
- `getUserAccessibleChallengesPage` block must contain `try {` and `} catch {`
- `getUserAccessibleChallengesPage` block must contain `listDenied` (via assertion checks on `getChallengesByGroupPage` — the `getUserAccessibleChallengesPage` version checks try/catch directly)

### Validation Commands Run

```
npm run test:home-challenge-feeds  ✓ passed
npx tsc -b --pretty false          ✓ no errors
npm run build                      ✓ built in 2.96s
```

### Deploy Requirements

Client-only change.

### Remaining Risks

- The supplement is capped at 30 challenge IDs per call to bound read costs. Users in many groups with many private challenges may not see all of them in the supplement pass. Cursor-based pagination is not supported through the membership fallback path (pagination resets to null cursor when supplement activates).

---

## Fix 3 — `getChallengesByGroupPage`: Try/Catch + Membership Fallback with `options.userId`

### Root Cause

`getChallengesByGroupPage` (used by the Group Detail screen) queries:

```ts
where('groupId', '==', groupId), where('status', '==', status)
```

This hits `allow list`. For a private group, the query is always denied — no active challenges appear on the Group Detail screen for any member of that group.

Additionally, `ChallengeDiscoveryPageOptions` had no `userId` field, so there was no way to pass the user's identity from the hook to the service for a membership-based fallback.

### Fix

**Three changes**:

1. **`ChallengeDiscoveryPageOptions.userId?: string`** added to the type.

2. **Try/catch** around the list query in `getChallengesByGroupPage`. Sets `listDenied = true` on failure.

3. **Membership fallback**: if `listDenied && options.userId`, query `challengeMembers where userId == uid`, filter client-side to `groupId == groupId && status ∈ statusFilter`, then `getDoc` each.

4. **Hooks updated** (`src/hooks/useChallenges.ts`):
   - `useChallengesByGroup` passes `userId: user?.uid` to `getChallengesByGroup`
   - `useChallengesByGroupPage` passes `userId: user?.uid` in options

### Files Changed

| File | Change |
|------|--------|
| `src/services/challengeService.ts` | `ChallengeDiscoveryPageOptions`: added `userId?: string`; `getChallengesByGroup`: accepts and forwards `userId`; `getChallengesByGroupPage`: try/catch + `listDenied` + membership fallback |
| `src/hooks/useChallenges.ts` | `useChallengesByGroup`: passes `user?.uid`; `useChallengesByGroupPage`: passes `userId: user?.uid` in options |

### Tests Added

P5M assertions 2 & 4 in `scripts/testHomeChallengeFeeds.ts`:
- `getChallengesByGroupPage` block must contain `listDenied`
- `getChallengesByGroupPage` block must contain `options.userId`
- `useChallenges.ts` must contain `userId: user?.uid`

### Validation Commands Run

```
npm run test:home-challenge-feeds  ✓ passed
npx tsc -b --pretty false          ✓ no errors
npm run build                      ✓ built in 2.96s
```

### Deploy Requirements

Client-only change. No Firestore rules change. No Cloud Functions change.

### Remaining Risks

- Fallback group membership filter uses client-side `groupId == groupId` comparison rather than a Firestore index. For users with many challenge memberships, this reads all their `challengeMembers` docs and filters in memory. Bounded to 30 getDoc calls.

---

## Fix 4 — Firestore Rules: No Change Required

### Why No Change

The existing `allow list` rule for challenges is intentionally field-only:

```
allow list: if isAuthenticated()
              && (status == 'active')
              && (visibility == 'public' OR groupVisibility == 'public');
```

Adding `isGroupMember(data.groupId)` to this rule would:
- Require a `get()` call per document in the result set
- Exhaust Firebase's 10-`get()`-calls-per-list-query budget with any non-trivial result
- Make the rule unprovable at query planning time (Firebase evaluates field predicates before fetching, but `isGroupMember` requires the document to be read first)

The correct fix is the client-side strategy above: public challenges via list query, private-group challenges via `getDoc` (using `allow get: canReadChallenge`).

Dry-run confirmed no rule changes and no compilation errors:

```
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges  ✓
```

---

## Guard Tests Summary (`scripts/testHomeChallengeFeeds.ts` P5M section)

| # | What it checks |
|---|---------------|
| 1 | `getUserAccessibleChallengesPage` contains `try {` and `} catch {` |
| 2 | `getChallengesByGroupPage` contains `listDenied` (fallback tracking) |
| 3 | `getChallengesByGroupPage` contains `options.userId` |
| 4 | `getActiveChallengesForUser` (code only, no comments) does NOT match `where(documentId()` |
| 5 | `getActiveChallengesForUser` contains `getDoc(doc(db` |
| 6 | `useChallenges.ts` contains `userId: user?.uid` |
| 7 | Firestore `allow list: if` rule body does not contain `exists(` or `isGroupMember(` |

---

## Full Validation Suite

```
npm run test:home-challenge-feeds        ✓ passed
npm run test:home-performance-guards     ✓ passed
npm run test:pilot-ux-polish-guards      ✓ passed
npm run test:scoring-guards              ✓ passed
npm run test:challenge-creation-backend  ✓ passed
npm run test:group-invite-backend        ✓ passed
npx tsc -b --pretty false               ✓ no errors
npm run build                            ✓ built in 2.96s
firebase deploy --only firestore:rules --dry-run --project tiizi-challenges  ✓ compiled successfully
```

---

## Summary of All Changes

| File | Type | Change |
|------|------|--------|
| `src/services/challengeService.ts` | Client service | `ChallengeDiscoveryPageOptions.userId?` added; `getActiveChallengesForUser` switched from `getDocs(documentId 'in')` to individual `getDoc` calls; `getUserAccessibleChallengesPage` per-chunk try/catch + membership supplement; `getChallengesByGroupPage` try/catch + `listDenied` + membership fallback; `getChallengesByGroup` accepts `userId?` |
| `src/hooks/useChallenges.ts` | React hook | `useChallengesByGroup` and `useChallengesByGroupPage` pass `userId: user?.uid` |
| `scripts/testHomeChallengeFeeds.ts` | Guard tests | P5M section with 7 assertions |

No Firestore rules changed. No Cloud Functions changed.
