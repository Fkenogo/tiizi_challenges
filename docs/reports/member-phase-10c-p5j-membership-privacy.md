# Phase 10C-P5J — Challenge Membership Privacy

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all validation passing, not deployed

---

## Security Issue

`challengeMembers` had `allow read: if isAuthenticated()`, granting any signed-in user read access to every challenge membership document in the database. This means any user could:

- List all memberships across all challenges and groups
- Read other users' activity progress, completion rates, points, and status
- Enumerate who has joined any challenge without being a member of that challenge's group

This violates the product requirement that membership visibility must be scoped to self, same-group members, and admins.

---

## Root Cause

The rule was written as a broad default to unblock leaderboard and participant-count features. The actual client-side queries are all self-scoped (every list query includes `where('userId', '==', uid)` for the current user), so the broad rule was never functionally required. The leaderboard reads from a separate `challengeLeaderboards` collection and participant counts come from the `challenges.participantCount` field — neither touches `challengeMembers` for cross-user reads.

---

## Audit: Every `challengeMembers` Read Path

| Caller | Operation | Scope | Safe with new rule? |
|--------|-----------|-------|---------------------|
| `isMember(uid, challengeId)` | `getDoc({challengeId}_{uid})` | Self (always called with `request.auth.uid`) | ✓ `allow get` self branch |
| `getChallengeMembership(uid, challengeId)` | `getDoc({challengeId}_{uid})` | Self | ✓ `allow get` self branch |
| `joinChallenge` (read before write) | `getDoc({challengeId}_{uid})` | Self | ✓ `allow get` self branch |
| `leaveChallenge` (read before write) | `getDoc({challengeId}_{uid})` | Self | ✓ `allow get` self branch |
| `getUserChallengeMembershipIndex(uid)` | `getDocs(where('userId','==',uid))` | Self | ✓ `allow list` self branch |
| `getUserChallengeMembershipSummaries(uid)` | `getDocs(where('userId','==',uid))` | Self | ✓ `allow list` self branch |
| `getActiveChallengesForUser(uid)` | `getDocs(where('userId','==',uid) + where('status','==','active'))` | Self | ✓ `allow list` self branch |
| `getCompletedChallengesForUser(uid)` | `getDocs(where('userId','==',uid) + where('status','==','completed'))` | Self | ✓ `allow list` self branch |
| Leaderboard | Reads `challengeLeaderboards` — **not** `challengeMembers` | N/A | Not affected |
| Participant counts | Reads `challenges.participantCount` field — **not** `challengeMembers` | N/A | Not affected |
| `isValidActivityContext()` (rules) | Internal `get()` in rules function | Rules-internal | Not a client read |

---

## Rule Change

**Before (`firestore.rules` line 1089):**
```
match /challengeMembers/{membershipId} {
  allow read: if isAuthenticated();
```

**After:**
```
match /challengeMembers/{membershipId} {
  // Single-doc read: self, same-group member, or moderator.
  // isGroupMember uses get()/exists() — safe for per-doc reads, not for list queries.
  allow get: if isAuthenticated()
               && (resource.data.userId == request.auth.uid
                   || isGroupMember(resource.data.groupId)
                   || canModerateChallenges());
  // List query: field-only check avoids get()/exists() budget exhaustion.
  // All client list queries are scoped to where('userId', '==', uid), so every
  // returned document satisfies resource.data.userId == request.auth.uid.
  allow list: if isAuthenticated()
                && (resource.data.userId == request.auth.uid
                    || canModerateChallenges());
```

### Why `allow get` vs `allow list` split

The `isGroupMember()` function calls `exists()` + up to 2 `get()` calls on `groupMembers`. For a single-doc read (`allow get`), this is fine — there is no per-request call budget for single-doc reads. For a list query (`allow list`), Firestore evaluates the rule per returned document; calling `isGroupMember` on each would exhaust the 10 `get()`/`exists()` calls-per-list-query budget (same root cause as the P5C Browse Challenges bug). The `allow list` rule is therefore field-only.

### Why all current list queries remain safe

Every client list query on `challengeMembers` includes `where('userId', '==', uid)` where `uid` is always `request.auth.uid`. Firestore only returns documents matching the query, so every document in the result has `resource.data.userId == request.auth.uid` — the `allow list` field check passes for all of them.

---

## Files Changed

| File | Change |
|------|--------|
| `firestore.rules` | Replaced `allow read: if isAuthenticated()` with `allow get` (self ∥ group-member ∥ moderator) + `allow list` (self ∥ moderator) |
| `scripts/testHomeChallengeFeeds.ts` | Added P5J guard section: 7 assertions |

---

## Query Changes

None. All existing client queries are self-scoped and remain compatible with the new rules.

---

## Validation Output

```
npm run test:home-challenge-feeds        ✓ passed
npm run test:home-performance-guards     ✓ passed
npm run test:pilot-ux-polish-guards      ✓ passed
npm run test:scoring-guards              ✓ passed
npm run test:challenge-creation-backend  ✓ passed
npm run test:group-invite-backend        ✓ passed
npx tsc -b --pretty false               ✓ no errors
npm run build                            ✓ built in 3.02s
```

---

## Deploy Requirement

**Yes — `firestore.rules` must be deployed.** This is a security fix. Until deployed, the overly-broad read access remains live in production. The client code requires no changes.

Deploy command (when ready):
```
firebase deploy --only firestore:rules
```

---

## Remaining Risks

- **Group-member `allow get` uses `isGroupMember`**: For the future "see who else joined" feature (reading a specific other member's doc), the group-member branch is already in place. It costs 1–3 `get()`/`exists()` calls per single-doc read — acceptable.
- **`challengeMembers` rule for `isValidActivityContext`**: The internal `get()` in `isValidActivityContext` is a rules-level call, not subject to client read rules. No impact.
- **No list query currently reads cross-user memberships**: If a future feature (e.g., admin bulk export) needs to list ALL memberships across users, it will need the `canModerateChallenges()` branch, which is already included.
