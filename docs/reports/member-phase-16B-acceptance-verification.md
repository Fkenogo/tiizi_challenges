# Phase 16B — End-to-End Acceptance Verification

**Date:** 2026-06-26
**Branch:** fix/p0-pre-deploy-blockers
**Verification method:** Static code analysis — complete trace of all creation paths, field writes, read queries, Firestore rules, and UI data flows. Live browser testing and Firestore document snapshots require human execution against a running environment (emulator or staging).

---

## Scope Clarification

This audit covers every item in the checklist via static analysis. Live browser testing items are clearly marked `[MANUAL REQUIRED]` with exact steps. Items confirmed via code are marked `[STATIC ✅]` or `[STATIC ⚠️]`.

---

## Part 1 — Challenge Document Fields

### Callable output (all creation paths)

| Field | Written by callable | Source | Status |
|---|---|---|---|
| `engineVersion` | `'v2'` | `requireEngineVersion(input.engineVersion)` — wizard always sends `'v2'` | STATIC ✅ |
| `challengeType` | `'collective' \| 'competitive' \| 'streak'` | `normalizeChallengeType(input.challengeType)` | STATIC ✅ |
| `durationDays` | Derived from `endDate − startDate` when `endDate` present | `Math.max(1, Math.round((Date.parse(endDate) − Date.parse(startDate)) / MILLISECONDS_PER_DAY))` — matches `challengeService.createChallenge()` formula exactly | STATIC ✅ |
| `startDate` | ISO string | `normalizeIsoDate(input.startDate, 'startDate', new Date())` | STATIC ✅ |
| `endDate` | ISO string | From wizard, normalized and validated | STATIC ✅ |
| `createdBy` | `actorUid` | JWT-extracted, not client-supplied | STATIC ✅ |
| `createdAt` | ISO string (`nowIso`) | Written by callable — was absent from client path | STATIC ✅ |
| `visibility` | `'public' \| 'private'` | `normalizeGroupVisibility(group)` — reads group doc inside transaction | STATIC ✅ |
| `groupVisibility` | Same as `visibility` | Same source | STATIC ✅ |
| `participantCount` | `0` on creation; `1` after trigger fires | `onChallengeMemberCreated` trigger increments asynchronously | STATIC ✅ (see known difference §6) |
| `status` | `'active'` or `'draft'` | `requiresDonationApproval ? 'draft' : 'active'` | STATIC ✅ |
| `moderationStatus` | `'approved'` or `'pending'` | Same gate | STATIC ✅ |
| `activities` | Normalized, validated array | `normalizeActivities()` — includes `targetType` | STATIC ✅ |
| `groupCumulativeTarget` | Collective only | Validated, stripped for non-collective | STATIC ✅ |
| `autoCompleteOnGroupTarget` | Collective only | Same | STATIC ✅ |
| `requiredConsecutiveDays` | Streak only | Validated ≥1 and ≤ durationDays | STATIC ✅ |
| `streakResetOnMiss` | Streak only | Same | STATIC ✅ |
| `donation` | Full object with `approvalRequired`, `approvalStatus`, `disclaimer`, `acceptingDonations` | `normalizeDonation()` | STATIC ✅ |
| `category` | Valid category | `normalizeCategory()` | STATIC ✅ |
| `name` | 3–120 chars | `requireString()` | STATIC ✅ |
| `description` | 1–2000 chars | `requireString()` | STATIC ✅ |

---

## Part 2 — Creator Membership Document

| Field | Fitness/Wellness Active Challenge | Donation/Draft Challenge | Status |
|---|---|---|---|
| Document written | ✅ Yes | ✅ No — matches client path | STATIC ✅ |
| `challengeId` | ✅ | N/A | STATIC ✅ |
| `userId` | actorUid | N/A | STATIC ✅ |
| `groupId` | ✅ | N/A | STATIC ✅ |
| `joinedAt` | `nowIso` (ISO string) | N/A | STATIC ✅ |
| `status: 'active'` | ✅ | N/A | STATIC ✅ |
| `activitiesCompleted: 0` | ✅ | N/A | STATIC ✅ |
| `totalActivities` | `activities.length × durationDays` — correct since Fix 1 | N/A | STATIC ✅ |
| `totalPoints: 0` | ✅ | N/A | STATIC ✅ |
| `completionRate: 0` | ✅ | N/A | STATIC ✅ |
| `currentStreak: 0` | Streak only | N/A | STATIC ✅ |
| `longestStreak: 0` | Streak only | N/A | STATIC ✅ |
| `lastLogDate` absent | ✅ — stale value removed by full-overwrite `set()` | N/A | STATIC ✅ |

---

## Part 3 — Group Member Document

| Scenario | Field | Callable | Client path | Status |
|---|---|---|---|---|
| Creator already has group membership | No change to group membership | Same | STATIC ✅ |
| Creator is group owner, membership missing | `role: 'owner'`, `status: 'active'`, `createdAt`, `approvedAt` | `role: 'member'` (unfixed client path) | STATIC ✅ Fixed in Phase 15E |
| Creator is non-owner group member | No auto-membership created | Same | STATIC ✅ |

---

## Part 4 — User Statistics

| Field | Non-donation | Donation | Status |
|---|---|---|---|
| `stats.totalChallenges` incremented | `FieldValue.increment(1)` in transaction | Not incremented | STATIC ✅ |
| `lastChallengeJoinedAt` updated | `nowIso` | Not updated | STATIC ✅ |

---

## Part 5 — Discoverability (visibility queries)

`getChallengesByGroupPage()` queries on `visibility == 'public'` OR `groupVisibility == 'public'`. The callable now writes both fields derived from the group doc inside the transaction. This means:

- **Public groups**: new challenges are immediately discoverable via the primary query path — no dependency on the membership fallback
- **Private groups**: callable writes `visibility: 'private'` and `groupVisibility: 'private'`; discovery falls back to membership-based lookup; since the creator has a membership, their own challenge appears
- **Old challenges (created before Phase 16A)**: lack `visibility`/`groupVisibility` fields; these continue to surface via the membership fallback path as before

STATIC ✅ — discoverability is now correct and no longer depends on the fallback path for new challenges in public groups.

---

## Part 6 — Known Behavioral Differences (Accepted, Not Defects)

### 6.1 `participantCount` timing

**Before (client path):** `participantCount` incremented synchronously to 1 inside `joinChallenge` write batch. Immediately after navigation, the challenge list shows `participantCount: 1`.

**After (callable path):** `participantCount` starts at 0. The `onChallengeMemberCreated` Cloud Function trigger increments it to 1 asynchronously (~1–5 seconds after creation). `useChallenge` uses TanStack Query with `staleTime: 5 * 60 * 1000` (one-shot `getDoc`, not real-time). The creator may see `participantCount: 0` briefly, then `1` only after navigating away and back (which triggers a cache re-fetch).

**Severity:** Low — cosmetic only; correct value written to Firestore within seconds; displayed stat (`progress?.uniqueParticipants || resolvedChallenge.participantCount || 0`) falls back correctly once the trigger fires.

**Classification:** Intentional architectural tradeoff documented in Phase 15C. No action required.

### 6.2 `durationDays` display vs stored value (pre-existing)

`ChallengeDetailScreen` re-derives `durationDays` from dates using `Math.ceil(...) + 1` for its "Day X of N" display. The callable stores `durationDays` using `Math.round(...)` (same as the old client path). The scoring engine reads the stored value. This inconsistency is pre-existing — introduced in the original `challengeService.createChallenge()` implementation, not by the callable migration.

**Severity:** Low — pre-existing; display uses dates, scoring uses stored value; no behavioral change introduced by Phase 16A.

### 6.3 `joinedAt` format

Client path wrote `Timestamp.now()` (Firestore Timestamp). Callable writes `nowIso` (ISO string). Both are sortable date values. Frontend reads both formats via `new Date(value)` or `.toDate()`. No query uses Timestamp-specific operators on this field.

**Severity:** None — format difference; no behavioral impact.

---

## Part 7 — Firestore Rules Compatibility

The callable uses the Admin SDK (server-side), which **bypasses all Firestore security rules** for writes. Rules apply only to subsequent client SDK reads of the created documents.

### Read access to new challenges

Challenge read rule (line 157–160):
```
allow read: if isAuthenticated() && (
  isGroupMember(resource.data.groupId) || isPublicGroup(resource.data.groupId) || canModerateChallenges()
);
```

The creator is either already a group member or was made one atomically in the transaction. The challenge `groupId` is set. Read access is satisfied immediately after creation. STATIC ✅

### Read access to creator membership

Member read rule (line 186–193) allows: own userId match OR group member OR public group. Creator satisfies `resource.data.userId == request.auth.uid`. STATIC ✅

### Challenge create rule (legacy path still valid)

Line 162: `request.resource.data.createdBy == request.auth.uid` — this rule applies to client SDK creates only, not callable. The callable bypasses it. The callable enforces the equivalent check server-side via `createdBy !== actorUid → throw permission-denied`. STATIC ✅

---

## Part 8 — UI Flows (Static Analysis)

### Post-creation navigation

```typescript
navigate(challengeRoute(challengeType, challenge.id));
// → /app/challenges/${type}?challengeId=${id}&groupId=${activeGroupId}
```

Routes to `CollectiveChallengeScreen` / `CompetitiveChallengeScreen` / `StreakChallengeScreen` with `challengeId` as a query param. The callable returns `{ challenge: { id: challengeId, ...payload } }` — `challenge.id` is present and typed as `string`. Navigation works. STATIC ✅

### `challenge.id` origin

Client path returned `{ id: challengeId, ...sanitizedPayload }` — same structure. The wizard's navigation code is unchanged. STATIC ✅

### Toast messages

```typescript
if (payload.donation?.enabled) {
  showToast('Challenge submitted for platform review before going active.', 'success');
} else {
  showToast('Challenge launched.', 'success');
}
```

`payload.donation` is built by the wizard before the callable call — `payload.donation?.enabled` is correct for both donation and non-donation cases. STATIC ✅

### Error path

Callable errors propagate to the outer `try/catch` in `handleLaunch` (lines 601–605):
```typescript
} catch (error) {
  console.warn('Challenge launch failed:', error);
  const message = error instanceof Error ? error.message : 'Failed to launch challenge.';
  showToast(message, 'error');
}
```

Firebase Callable errors (`HttpsError`) are instances of `FirebaseError`, which extends `Error`. Their `.message` contains the `HttpsError` message string. `showToast(message, 'error')` displays it. STATIC ✅

### Donation challenge creator UX

After creating a donation challenge, the wizard shows "Challenge submitted for platform review" and navigates to the challenge screen. The creator has no membership (correct — donation challenges start in `draft`). The challenge screen reads the challenge doc (readable by creator as group member). The screen shows `requiresApproval: true` (line 118 of `ChallengeDetailScreen`), which gates the join button and shows an approval notice. STATIC ✅

---

## Part 9 — Admin Flows (Static Analysis)

Admin screens read challenge documents via admin-scoped Firestore queries. The callable writes all fields admin screens use: `status`, `moderationStatus`, `createdAt`, `groupId`, `challengeType`, `participantCount`, `donation`. Admin reads use `canModerateChallenges()` rule — bypass normal group membership checks. STATIC ✅

Template usage counts (`usageCount` on `challengeTemplates` and `wellnessTemplates`) are still incremented fire-and-forget in the wizard after the callable resolves (lines 598–599). STATIC ✅

---

## Part 10 — Dead Code Introduced (Non-Breaking)

| Item | Location | Impact |
|---|---|---|
| `isPermissionDenied()` helper | `CreateChallengeWizard.tsx:54–58` | Defined but no longer called; harmless; retained for rollback |
| `createChallenge.isPending` guard | Line 418 | Always `false` now (mutateAsync never called); `isLaunching` still guards correctly; harmless |
| `useCreateChallenge` hook | Line 73 | Hook instantiated but mutation never fired; retained for rollback |

---

## Part 11 — Manual Test Plan [MANUAL REQUIRED]

The following must be executed against a running environment (emulator or staging) before sign-off:

### Fitness challenges

| # | Test case | Pass criteria |
|---|---|---|
| F1 | Create collective from scratch, public group | Challenge in Firestore with `visibility: 'public'`, `groupVisibility: 'public'`, `engineVersion: 'v2'`, `createdAt` present, `durationDays` matches selected dates |
| F2 | Create collective from template | Same fields as F1; `templateId` not in challenge doc; `usageCount` incremented on template |
| F3 | Create competitive from scratch | `challengeType: 'competitive'`; no `groupCumulativeTarget` or `requiredConsecutiveDays` in doc |
| F4 | Create streak from scratch | `requiredConsecutiveDays` present; `streakResetOnMiss` present; creator membership has `currentStreak: 0`, `longestStreak: 0` |
| F5 | All types: creator membership | `challengeMembers/${challengeId}_${uid}` exists immediately; `totalActivities = activities.length × durationDays`; `status: 'active'` |
| F6 | All types: group member role | If creator had no prior group membership: `groupMembers/${groupId}_${uid}` has `role: 'owner'`; otherwise unchanged |
| F7 | All types: user stats | `users/${uid}.stats.totalChallenges` incremented by 1; `lastChallengeJoinedAt` present |
| F8 | All types: `participantCount` | Challenge doc has `participantCount: 0` immediately; after ~5s, `participantCount: 1` |
| F9 | Challenge appears in group challenge list | Navigate to challenge list for the group; new challenge visible without refresh |
| F10 | Creator shown as participant | Challenge detail shows creator in participant/leaderboard list |

### Wellness challenges

| # | Test case | Pass criteria |
|---|---|---|
| W1 | Create wellness collective from scratch | `category: 'wellness'`; activities have `targetType`; same field checks as F1 |
| W2 | Create wellness challenge from wellness template | `wellnessTemplateId` not in challenge doc; `usageCount` incremented on wellness template |
| W3 | Wellness streak challenge | Same as F4 |

### Donation challenge

| # | Test case | Pass criteria |
|---|---|---|
| D1 | Create donation challenge | Challenge doc `status: 'draft'`, `moderationStatus: 'pending'`; NO `challengeMembers` doc for creator; `stats.totalChallenges` NOT incremented |
| D2 | Creator UX | Wizard shows "submitted for review" toast; challenge screen shows approval-pending state |
| D3 | `participantCount` | Stays at `0` (no membership → no trigger) |

### Activity logging post-creation

| # | Test case | Pass criteria |
|---|---|---|
| A1 | Log activity on collective challenge | `workoutService` reads `durationDays` from challenge doc; scoring uses stored value correctly |
| A2 | Log activity on streak challenge | `currentStreak` increments; `requiredConsecutiveDays` respected |
| A3 | Leaderboard updates after log | New log appears in leaderboard query |

### Private group challenge

| # | Test case | Pass criteria |
|---|---|---|
| P1 | Create challenge in private group | Challenge doc has `visibility: 'private'`, `groupVisibility: 'private'`; challenge appears via membership fallback in challenge list |

---

## Part 12 — Findings Summary

### Confirmed defects: None

No production defects were identified via static analysis. All field writes, validation paths, rule compatibility, and UI data flows check out.

### Known behavioral differences: 2 (pre-accepted)

1. `participantCount: 0 → 1` async delay (~1–5s) — documented and accepted in Phase 15C
2. `durationDays` display vs stored formula mismatch — pre-existing, not introduced by migration

### Dead code: 3 items (non-breaking, retained for rollback)

`isPermissionDenied`, `createChallenge.isPending`, `useCreateChallenge` hook.

---

## Recommendation

**READY FOR 16C** — subject to manual test plan execution (Part 11) passing.

Static verification confirms all fields are correctly written, all query paths work, Firestore rules are satisfied, and the UI data flow is unbroken. The two behavioral differences are pre-accepted architectural decisions.

Manual test plan execution (11 test cases across F1–P1) is required before final sign-off. Each test takes approximately 2–3 minutes against the Firebase emulator or staging environment.

**If all Part 11 tests pass:** proceed to Phase 16C (cleanup of old client creation path).

**If any Part 11 test fails:** file defect with Firestore document snapshot, classify severity, and return to Phase 15 for targeted fix before re-testing.
