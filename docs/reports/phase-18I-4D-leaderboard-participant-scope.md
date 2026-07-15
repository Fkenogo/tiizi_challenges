# Phase 18I-4D — Fix Challenge Leaderboard Participant/Name Scope

**Date:** 2026-06-29
**Branch:** fix/p0-pre-deploy-blockers
**Fixes:** BUG-3-2 from Phase 18I-3 audit

---

## 1. Problem

`ChallengeLeaderboardScreen` fetched display names from **all group members** via `useGroupMembers(groupId)`, regardless of whether those users were challenge participants. This created two risks:

1. If a group member who never joined the challenge happened to share a userId with a seeded `challengeMembers` document, their name could appear against that row.
2. If the challenge had seeded/orphaned `challengeMembers` docs for users outside the group, those rows would show the fallback label `Member XXXXXX` — but the name resolution path was drawing from the wrong pool (group, not challenge).

`ChallengeDetailScreen` mini-leaderboard showed `entry.userId.slice(0, 8)` — a truncated raw UID with no name resolution at all.

---

## 2. Root Cause

**`ChallengeLeaderboardScreen` data flow (before fix):**

```
challengeMembers where challengeId == X  →  rawRows  (✅ correct scope)
groupMembers where groupId == Y          →  members  (❌ wrong scope for names)
namesById = Map(members.map(m => [m.id, m.name]))    (❌ populated from all group members)
displayName(userId) = namesById.get(userId) ?? fallback
```

The rows were scoped correctly; the name pool was not.

**`ChallengeDetailScreen` mini-leaderboard (before fix):**

```
challengeMembers where challengeId == X  →  leaderboard entries  (✅ correct scope)
entry.userId.slice(0, 8)                                         (❌ raw UID, no name)
```

---

## 3. Fix

### `src/features/Challenges/ChallengeLeaderboardScreen.tsx`

**Removed:** `import { useGroupMembers } from '../../hooks/useGroupInsights'`

**Added:** `getDoc, doc` to the firebase/firestore import.

**Added `UserProfileDoc` type + `resolveDisplayName` helper:**
```ts
type UserProfileDoc = {
  email?: string;
  profile?: { personalInfo?: { displayName?: string; fullName?: string } };
};

function resolveDisplayName(uid: string, data?: UserProfileDoc): string {
  const name =
    data?.profile?.personalInfo?.displayName ||
    data?.profile?.personalInfo?.fullName ||
    data?.email?.split('@')[0] || '';
  return name.trim() || `Member ${uid.slice(0, 6).toUpperCase()}`;
}
```

**Added `useChallengeParticipantNames` hook:**
```ts
function useChallengeParticipantNames(userIds: string[]) {
  return useQuery({
    queryKey: ['challenge-participant-names', userIds.join(',')],
    queryFn: async () => {
      const map = new Map<string, string>();
      if (userIds.length === 0) return map;
      const snaps = await Promise.all(userIds.map((uid) => getDoc(doc(db, 'users', uid))));
      snaps.forEach((snap, i) => {
        map.set(userIds[i], resolveDisplayName(userIds[i], snap.exists() ? snap.data() : undefined));
      });
      return map;
    },
    enabled: userIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
```

**In the component:**
```ts
// Before:
const resolvedGroupId = groupId || challenge?.groupId;
const { data: members = [] } = useGroupMembers(resolvedGroupId);
const namesById = useMemo(() => new Map(members.map((m) => [m.id, m.name])), [members]);

// After:
const participantUserIds = useMemo(() => rawRows.map((r) => r.userId), [rawRows]);
const { data: namesById = new Map<string, string>() } = useChallengeParticipantNames(participantUserIds);
```

**New data flow:**
```
challengeMembers where challengeId == X  →  rawRows               (✅ rows)
rawRows.map(r => r.userId)               →  participantUserIds     (✅ scoped userIds)
users/{uid} for each participantUserId   →  namesById             (✅ names scoped to participants)
```

### `src/features/Challenges/ChallengeDetailScreen.tsx`

**Added:** `getDoc, doc` to the firebase/firestore import.

**Added targeted name lookup after the `leaderboard` query:**
```ts
const leaderboardUserIds = useMemo(() => leaderboard.map((e) => e.userId), [leaderboard]);
const { data: leaderboardNames = new Map<string, string>() } = useQuery({
  queryKey: ['challenge-participant-names', leaderboardUserIds.join(',')],
  queryFn: async () => { /* fetch users/{uid} for each participant */ },
  enabled: leaderboardUserIds.length > 0,
  staleTime: 5 * 60 * 1000,
});
```

**Replaced raw userId display:**
```tsx
// Before:
{entry.userId.slice(0, 8)}

// After:
{entry.userId === user?.uid
  ? `You (${leaderboardNames.get(entry.userId) ?? 'Me'})`
  : (leaderboardNames.get(entry.userId) ?? `Member ${entry.userId.slice(0, 6).toUpperCase()}`)}
```

---

## 4. Evidence That Unrelated Group Members Are Excluded

- `useGroupMembers` is no longer called in either screen.
- The only input to the name map is `rawRows.map(r => r.userId)` — i.e., exactly the users who have a `challengeMembers` document for this `challengeId`.
- A group member who never joined the challenge has no `challengeMembers` doc, so they produce no row and no entry in `participantUserIds` — they cannot appear.

---

## 5. Seed-Data Contamination Note (Not Fixed Here)

If the Firestore database contains seeded `challengeMembers` documents belonging to test UIDs that are also in the `groupMembers` collection, those rows will still appear — because the row source (`challengeMembers where challengeId == X`) is already correct and includes them. Fixing seed-data contamination requires a Firestore cleanup script, tracked separately.

---

## 6. What Was Not Changed

- `sortLeaderboardRows` — untouched ✅
- Engine-sensitive `renderRowScore` / `podiumScore` / `renderMyStatCard` — untouched ✅
- `challengeMembers` query (row source) — untouched ✅
- Firestore security rules — untouched ✅
- Scoring engines — untouched ✅

---

## 7. Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | Removed `useGroupMembers`; added `useChallengeParticipantNames` hook + `resolveDisplayName` helper |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Added targeted `leaderboardNames` query; replaced `userId.slice(0,8)` with resolved name |
| `scripts/testScoringGuards.ts` | Added guards 18I-4D-1 through 18I-4D-8 |

---

## 8. Regression Guards

| ID | What it guards |
|----|---------------|
| 18I-4D-1 | `ChallengeLeaderboardScreen` does not import `useGroupMembers` |
| 18I-4D-2 | `ChallengeLeaderboardScreen` fetches user profiles from `users` collection via `getDoc` |
| 18I-4D-3 | `challengeMembers` filtered by `challengeId` remains the row source |
| 18I-4D-4 | Name lookup is keyed from `rawRows` participant userIds (not group member list) |
| 18I-4D-5 | Missing profile produces safe `Member XXXXXX` fallback |
| 18I-4D-6 | Mini-leaderboard no longer displays raw truncated userId |
| 18I-4D-7 | Mini-leaderboard resolves names from `users` collection, not `groupMembers` |
| 18I-4D-8 | `ChallengeDetailScreen` does not use `useGroupMembers` for leaderboard names |

---

## 9. Manual Retest Required

1. Open a competitive wellness challenge with 2–3 real joined users.
2. Navigate to the full leaderboard (`/app/challenges/leaderboard?challengeId=...`).
3. Confirm only challenge participants appear, with correct display names (not truncated UIDs).
4. Confirm users who are group members but not challenge participants do not appear.
5. On the `ChallengeDetailScreen`, confirm the mini-leaderboard shows real names instead of `UID12345`.

---

## 10. Validation

```
npx tsc --noEmit                          → ✅ No errors
npm run build                             → ✅ Built in 4.53s
npm run test:scoring-guards               → ✅ All guards passed (incl. 18I-4D-1…8)
npm run test:home-challenge-feeds         → ✅ All guards passed
npm run audit:challenge-creation-payloads → ✅ All guards passed
```
