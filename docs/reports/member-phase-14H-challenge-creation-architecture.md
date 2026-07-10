# Phase 14H — Challenge Creation Architecture Review

**Date:** 2026-06-26
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** Audit of both challenge creation paths; migration recommendation
**Code changes:** None (audit only)

---

## Implementations Audited

**Client path** — `CreateChallengeWizard.handleLaunch()` → `challengeService.createChallenge()` → `challengeService.joinChallenge()`
Three sequential async operations using the client Firebase SDK. Currently the only active path.

**Callable path** — `createChallengeWithCreatorMembershipCallable` → `createChallengeWithCreatorMembershipCore()`
Single Firestore transaction using the Admin SDK. Fully built and deployed. Zero frontend call sites.

---

## Side-by-Side Comparison

| Dimension | Client path | Callable path | Correct |
|---|---|---|---|
| **Transaction safety** | Three sequential non-atomic writes. If step 2 (`joinChallenge`) fails after step 1 (`setDoc(challenge)`), the challenge exists without a creator membership. Error is swallowed — `console.error`, no rollback. | Single `runTransaction()` atomically writes the challenge doc and creator membership. All-or-nothing. | ✅ Callable |
| **Auth enforcement** | `createChallenge(input)` accepts `input.createdBy` from the client payload. The `createdBy` value is client-supplied and could be spoofed. | `uidFromRequest()` pulls the UID from the verified Firebase Auth token. `createdBy !== actorUid` throws `permission-denied`. | ✅ Callable |
| **Group membership check** | Reads `groupMembers` doc. If missing AND user is group owner, creates membership via a separate `setDoc` then re-reads. Not transactional — race window between those two writes. | Reads `groupMembers` inside the transaction. Owner membership (if missing) is created atomically in the same transaction. | ✅ Callable |
| **`allowMemberChallenges` enforcement** | Not checked. Any active group member can create challenges regardless of the group's `allowMemberChallenges` flag. | Checked: `if (group.allowMemberChallenges === false && !isOwner)` throws `permission-denied`. | ✅ Callable |
| **`groupVisibility` / `visibility` on challenge doc** | Neither field is written. The Firestore discovery query (`getChallengesByGroupPage`) requires `visibility == 'public' OR groupVisibility == 'public'`. Challenges created by the client path are invisible to this query and fail the allow-list rule. | Reads `group.visibility` and `group.isPrivate` → derives `'public' \| 'private'` → writes both `visibility` and `groupVisibility` on the challenge doc. | ✅ Callable |
| **`createdAt` on challenge doc** | Not written. | Written as `nowIso` (ISO string). | ✅ Callable |
| **Server-side input length limits** | None. String lengths are bounded only by UI controls, which are bypassable. | Strict: name 3–120 chars, description 1–2000 chars, per-activity fields capped, exerciseIds/activities sliced at 50/30. | ✅ Callable |
| **`engineVersion: 'v2'`** | Always set in wizard payload. | **Not set.** Absent from `CreateChallengeWithCreatorMembershipInput` and from `challengePayload`. Challenges created via callable are treated as v1 by the scoring engine. | ✅ Client |
| **`groupCumulativeTarget` / `autoCompleteOnGroupTarget`** | Conditionally included when `challengeType === 'collective'`. | **Not present.** Not in input type, not passed through to `challengePayload`. Collective challenges via callable have no group target. | ✅ Client |
| **`requiredConsecutiveDays` / `streakResetOnMiss`** | Conditionally included when `challengeType === 'streak'`. | **Not present.** Streak challenges via callable are missing their core engine configuration. | ✅ Client |
| **`targetType` on activities** | Included (fixed Phase 14D). | **Not present.** `normalizeActivities()` does not accept or pass through `targetType`. Scoring always uses the heuristic fallback. | ✅ Client |
| **Mixed-unit collective validation** | `createChallenge()` rejects if collective challenge activities have different `unit` values. | Not checked. Mixed-unit collective challenges can be created, producing a meaningless score pool. | ✅ Client |
| **`participantCount` after creator joins** | `joinChallenge()` increments `participantCount` synchronously via atomic `increment(1)` in a write batch. Counter is accurate immediately. | Sets `participantCount: 0`. Creator membership is written in the transaction. The `onChallengeMemberCreated` Cloud Function trigger increments the counter asynchronously (~1–5 seconds later). | Tie — different consistency models, both correct at rest |
| **`user.stats.totalChallenges`** | `joinChallenge()` increments `user.stats.totalChallenges` and sets `lastChallengeJoinedAt` synchronously. | Not incremented. The callable does not call `joinChallenge`. User's displayed challenge count is wrong. | ✅ Client |
| **Streak membership initialisation** | `joinChallenge()` explicitly resets `currentStreak`, `longestStreak`, and removes `lastLogDate` for streak challenges (handles re-join edge case). | Creator membership is set with no streak fields. On re-join, stale streak state from a prior membership is not cleared. | ✅ Client |
| **Creator auto-join failure handling** | If `joinChallenge()` throws after the challenge doc is committed, the error is caught and logged but not propagated. User sees "Challenge launched" but has no membership and `participantCount` stays at 0. | Transactional: creator membership is always co-created or the entire operation rolls back. No partial state possible. | ✅ Callable |
| **Rollback on failure** | No rollback. Challenge may exist without membership, with stale `participantCount`, without `user.stats.totalChallenges` incremented. | Full rollback: if any read or write in the transaction fails, nothing is committed. | ✅ Callable |
| **Duplicate challenge protection** | UI `isLaunching` guard prevents double-tap. No server-side deduplication. Two concurrent sessions can create duplicates. | No server-side deduplication either. Same risk. | Tie |
| **Donation challenge flow** | Sets `donation.approvalRequired`, `approvalStatus: 'pending'`, disclaimer; challenge status → `'draft'`. | `normalizeDonation()` produces identical field structure. Equivalent behaviour. | Tie |
| **Template snapshot isolation** | Wizard builds the full snapshot from local state. No template collection reads at execution time. | Callable receives the full payload from the client. No template dependency at execution time. | Tie |
| **`incrementUsageCount` for templates** | Called fire-and-forget after `createChallenge.mutateAsync()` succeeds (fixed Phase 14D). Unaffected by callable migration. | Callable has no awareness of template source. `incrementUsageCount` is called by the wizard before/after whichever creation path runs. | Tie |
| **Notifications** | None. | None. | Tie |
| **Analytics (member summaries)** | Cloud Function triggers fire on the Firestore document writes regardless of which creation path produced them. | Same — triggers are document-level, path-agnostic. | Tie |

---

## Defects by Path

### Client path

| Defect | Severity | Impact |
|---|---|---|
| No `groupVisibility` / `visibility` on challenge doc | **High** | Challenges are invisible to the discovery query; allow-list Firestore rules may reject reads by other members |
| Non-transactional: challenge can exist without creator membership | **High** | Creator sees "Challenge launched" but has no membership; challenge appears in group with 0 participants including the creator |
| `allowMemberChallenges` not enforced | **Medium** | Any active group member can create challenges in groups that restrict this permission to owners |
| No `createdAt` on challenge doc | **Low** | Missing for display timestamps and admin analytics |
| No server-side input length enforcement | **Low** | Overlong strings can be written to Firestore by bypassing UI controls |

### Callable path

| Defect | Severity | Impact |
|---|---|---|
| `engineVersion` absent from payload | **Critical** | All challenges treated as v1 — the streak and collective v2 engine behaviour is entirely disabled |
| `groupCumulativeTarget` / `autoCompleteOnGroupTarget` absent | **Critical** | Collective challenges have no group target; auto-complete on group achievement never fires |
| `requiredConsecutiveDays` / `streakResetOnMiss` absent | **Critical** | Streak challenges have no consecutive-day requirement; every log satisfies the streak regardless of cadence |
| `targetType` absent from `normalizeActivities` | **High** | Scoring always uses the heuristic fallback; explicit `daily` / `cumulative` intent set on the template is lost |
| Mixed-unit collective validation absent | **Medium** | Collective challenges with mixed-unit activities can be created; the score pool sums incompatible units |
| `user.stats.totalChallenges` not incremented | **Medium** | User's displayed challenge count is undercounted |
| Streak membership not initialised on re-join | **Low** | Stale streak state from a prior membership is not cleared when a user re-joins a streak challenge |

---

## Recommendation: Option C — Merge, then migrate

Neither implementation is production-correct in isolation.

The callable is **architecturally superior** — transaction safety, server-side auth, group visibility denormalization, `allowMemberChallenges` enforcement, input validation, and full rollback — but is **fatally missing all v2 engine fields**. It cannot be used as-is.

The client path **has all engine fields** but creates challenges non-transactionally, omits `groupVisibility`/`visibility` (breaking discoverability and Firestore rules), and cannot enforce `allowMemberChallenges`.

The callable is the correct long-term architecture for three structural reasons:

1. The atomic create-and-join pattern (challenge doc + creator membership in one operation) _requires_ a server-side transaction. The client SDK cannot run a Firestore transaction that spans both documents under the security rules as written.
2. Server-side auth token verification prevents `createdBy` spoofing. The client path accepts `createdBy` from the payload — a Firestore rules check catches most abuse, but the field value itself is not bound to the authenticated user.
3. Denormalizing `groupVisibility` onto the challenge doc at write time requires a server read of the group doc under admin privileges. A client SDK read of the group may fail Firestore rules for non-members.

---

## Migration Plan

### Phase A — Complete the callable (prerequisite)

Add the following to `functions/src/challengeCreationBackend.ts`:

- Add `engineVersion`, `groupCumulativeTarget`, `autoCompleteOnGroupTarget`, `requiredConsecutiveDays`, `streakResetOnMiss` to `CreateChallengeWithCreatorMembershipInput`
- Add `targetType` to `ChallengeActivityInput` and pass it through `normalizeActivities()`
- Conditionally include engine fields in `challengePayload` (matching client path pattern)
- Add mixed-unit collective validation (copy the guard from `challengeService.createChallenge`)
- After `transaction.set(challengeMemberRef, ...)`, add `transaction.set(userRef, { stats: { totalChallenges: FieldValue.increment(1) }, lastChallengeJoinedAt: nowIso }, { merge: true })`
- For streak challenges, ensure `currentStreak: 0`, `longestStreak: 0`, and `FieldValue.delete()` on `lastLogDate` are included in the creator membership payload on re-join

### Phase B — Migrate the wizard (after Phase A passes review)

Update `CreateChallengeWizard.handleLaunch()`:

- Replace `createChallenge.mutateAsync(payload)` with `httpsCallable(functions, 'createChallengeWithCreatorMembership')(payload)`
- Remove the multi-step membership retry block in the wizard — the callable handles creator membership atomically and re-throws on failure
- Remove the explicit `groupService.joinGroup()` fallback — no longer needed
- The `incrementUsageCount` calls remain unchanged (fire-and-forget after the callable resolves)

**Migration risk: Low-medium.** The callable is already deployed. The wizard change is a drop-in swap of the mutation call. The only regression risk is the callable's `normalizeActivities` stripping fields — which is eliminated by Phase A. No Firestore schema changes are required. Existing challenges are unaffected.

---

## Files to Change in Phase A

| File | Change |
|---|---|
| `functions/src/challengeCreationBackend.ts` | Add engine fields to input type, `normalizeActivities`, and payload; add mixed-unit validation; add user stats increment; add streak membership reset |

## Files to Change in Phase B

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Replace `createChallenge.mutateAsync` with callable; remove membership retry logic |
| `src/hooks/useChallenges.ts` | `useCreateChallenge` hook may become unused — audit and remove if so |
