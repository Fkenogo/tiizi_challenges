# Phase 10c Change Log

## Session: P6H Task 1 Re-Fix (2026-06-22)

### Files Modified

| File | Change |
|------|--------|
| `src/services/challengeService.ts` | `getChallengesByGroup` restored to direct Firestore query — no visibility filter |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | "Linked to selected group" → real group name; added `console.warn` for Join Challenge errors; "super admin" → "platform review" |
| `src/features/Challenges/CreateChallengeWizard.tsx` | `console.error` → `console.warn` × 2; "super admin" → "platform review" × 2; seed copy removed |
| `src/features/Groups/GroupDetailScreen.tsx` | `window.prompt` removed |
| `src/features/Groups/GroupMembersScreen.tsx` | admin → organizer copy; ADMIN badge → LEAD; window.prompt removed |
| `src/features/Groups/GroupsScreen.tsx` | `console.error` → `console.warn` |
| `src/features/Groups/CreateGroupScreen.tsx` | `console.error` → `console.warn` |
| `src/features/Profile/ProfileCompletionScreen.tsx` | Added `birthdayError` inline validation state |
| `firestore.rules` | `challengeMembers` create: added `|| isPublicGroup(groupId)` |

### Root Cause (CRIT-1)

Prior session's fix delegated to `getChallengesByGroupPage` which added `where('visibility', '==', 'public')` and `where('groupVisibility', '==', 'public')`. No challenges have these fields. Both queries returned 0 docs. `primaryQueriesSucceeded = true` on empty results skipped the fallback. Firestore rules do NOT require visibility fields.

### Pending (Task 2-5)

- CRIT-2: ChallengeDetailScreen participant/log counts
- CRIT-4: durationDays backfill script
- CRIT-3: premature completion repair
- CRIT-5: wellness logging verification

### Remaining pilot-ux-polish-guard gaps (pre-existing, feature work needed)

- LoginScreen: forgot password + sendPasswordResetEmail
- firebaseAuthErrors.ts: auth/missing-email
- ProfileInterestsScreen: min 3 interests guard
- HomeScreen: activation card for new users
- ProfileScreen: navigate to /app/challenges
