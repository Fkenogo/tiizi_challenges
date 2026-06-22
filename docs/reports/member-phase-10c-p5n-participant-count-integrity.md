# Phase 10C-P5N — Participant Count Integrity

Date: 2026-06-19  
Branch: fix/p0-pre-deploy-blockers  
Status: COMPLETE — all validation passing, backfill dry-run executed, not deployed

---

## Fix 1 — Initialize `participantCount: 0` in Challenge Creation Payload

### Root Cause

`functions/src/challengeCreationBackend.ts` built the challenge document payload using `removeUndefinedDeep({...})` with no `participantCount` field. The field was entirely absent from the document written to Firestore at creation time.

The Cloud Function trigger `onChallengeMemberCreated` uses `FieldValue.increment(1)` with `{ merge: true }` on the challenge document. `FieldValue.increment` initializes a missing field to 0 then adds the delta, so this works correctly when functions are deployed. However, if the trigger is delayed, fails before the first retry, or was not yet deployed when challenges were created, the field remains absent indefinitely. The client reads `item.participantCount ?? 0` and displays 0.

Adding `participantCount: 0` to the creation payload makes the field present immediately, before the trigger fires. The trigger's `FieldValue.increment(1)` then correctly advances it to 1.

### Files Changed

| File | Change |
|------|--------|
| `functions/src/challengeCreationBackend.ts` | Added `participantCount: 0` to `challengePayload` inside `removeUndefinedDeep({...})` |
| `scripts/testChallengeCreationBackend.ts` | Updated two stale assertions expecting `participantCount === undefined` → `=== 0`; added P5N static source guard (assertion 6) |

### Tests Added

- Functional test (line 270): `assert.equal(challengeDoc?.participantCount, 0, ...)` — verifies the creation payload includes the field
- Static source guard (P5N assertion 6): reads `challengeCreationBackend.ts`, slices the `challengePayload` block, asserts `participantCount: 0` is present

### Validation Commands Run

```
npm run test:challenge-creation-backend  ✓ passed
npm run test:home-challenge-feeds        ✓ passed
npm run test:home-performance-guards     ✓ passed
npm run test:pilot-ux-polish-guards      ✓ passed
npm run test:scoring-guards              ✓ passed
npm run test:group-invite-backend        ✓ passed
npx tsc -b --pretty false               ✓ no errors
npm run build                            ✓ built in 3.78s
npm --prefix functions run build        ✓ no errors
npm --prefix functions run lint         ✓ no errors
```

### Deploy Requirements

**Requires Cloud Functions deploy** — `challengeCreationBackend.ts` is a Cloud Functions source file. Deploy command: `firebase deploy --only functions:createChallengeWithCreatorMembership`.

### Remaining Risks

- Challenges created before this deploy still have no `participantCount` field or have stale counts. The backfill script (see Fix 3) corrects these.

---

## Fix 2 — `completed` Members Count as Participants

### Root Cause

`functions/src/memberCounters.ts` defined:

```ts
const ACTIVE_MEMBER_STATUSES = new Set(['active', 'joined']);
```

`'completed'` was not included. The `updateParticipantCountForUpdate` trigger fires when a `challengeMembers` document changes. When a member's status transitions from `'active'` → `'completed'` (as enabled by the P5L fix), `transitionDelta(true, false)` returns `-1`. The trigger decrements `participantCount`. A challenge where all members have completed would show 0 participants, even though everyone participated and finished.

**Product decision**: Completed members still count as participants — they joined, they participated, they finished. Only members who explicitly left (`abandoned`, `removed`, `rejected`, or document deleted) should be excluded.

Adding `'completed'` to `ACTIVE_MEMBER_STATUSES` means:
- `active` → `completed`: `transitionDelta(true, true) = 0` — no change to count ✓
- `active` → `abandoned`: `transitionDelta(true, false) = -1` — decrements ✓
- `completed` → deleted: `transitionDelta(true, false) = -1` — decrements ✓

### Files Changed

| File | Change |
|------|--------|
| `functions/src/memberCounters.ts` | `ACTIVE_MEMBER_STATUSES` extended: `new Set(['active', 'joined', 'completed'])` |
| `scripts/backfillGroupCounts.ts` | `activeMemberStatuses` extended identically: `new Set(['active', 'joined', 'completed'])` — keeps backfill in sync with trigger semantics |
| `scripts/testChallengeCreationBackend.ts` | P5N assertions 2, 3, 4 verify the status sets (see Tests Added) |

### Tests Added

- **P5N assertion 2**: `memberCounters ACTIVE_MEMBER_STATUSES` must match `/completed/` — completed members count
- **P5N assertion 3**: `ACTIVE_MEMBER_STATUSES` string must not include `abandoned`, `removed`, or `rejected` — left/removed members do not count
- **P5N assertion 4**: `backfillGroupCounts activeMemberStatuses` must match `/completed/` — backfill uses same semantics as trigger

### Validation Commands Run

Same full suite as above — all passed.

### Deploy Requirements

**Requires Cloud Functions deploy** — `memberCounters.ts` is compiled into the functions bundle. Deploy command: `firebase deploy --only functions`. All three counter triggers (`onChallengeMemberCreated`, `onChallengeMemberUpdated`, `onChallengeMemberDeleted`) use `isActiveMemberStatus`, so all three are affected by this change.

### Remaining Risks

- After deploy, new `active` → `completed` transitions will correctly produce delta = 0 (no count change). Existing production counters are already wrong for historical completions — the backfill corrects them.
- `'joined'` is included in `ACTIVE_MEMBER_STATUSES` to cover any legacy documents using that status string. Current creation code writes `'active'`; `'joined'` is a defensive inclusion.

---

## Fix 3 — Backfill: `backfillGroupCounts.ts` Updated and Dry-Run Executed

### What the Script Does

`scripts/backfillGroupCounts.ts` reads all `groups`, `groupMembers`, `challenges`, and `challengeMembers` documents in a single parallel fetch, then:

1. Counts group members with `status ∈ {active, joined, completed}` per `groupId` → corrects `groups.memberCount`
2. Counts active challenges per `groupId` → corrects `groups.activeChallenges`
3. Counts challenge members with `status ∈ {active, joined, completed}` per `challengeId` → corrects `challenges.participantCount`

Only documents where the stored value differs from the recount are written. Uses batched writes (450 per batch) and requires `CONFIRM_PROJECT_ID=tiizi-challenges` for production apply.

### Script Change

`activeMemberStatuses` was `new Set(['active', 'joined'])`. Updated to `new Set(['active', 'joined', 'completed'])` to match the updated `ACTIVE_MEMBER_STATUSES` in `memberCounters.ts`.

### Dry-Run Output

```json
{
  "mode": "dry-run",
  "projectId": "tiizi-challenges",
  "durationMs": 4004,
  "collectionsRead": {
    "groups": 7,
    "groupMembers": 86,
    "challenges": 28,
    "challengeMembers": 222
  },
  "groupsProcessed": 7,
  "challengesProcessed": 28,
  "memberCountCorrections": 0,
  "activeChallengesCorrections": 0,
  "participantCountCorrections": 22,
  "writesPlanned": 22,
  "writesApplied": 0
}
```

**22 of 28 challenges** have stale `participantCount`. All are under-counted; none are over-counted. Sample corrections:

| Challenge | Current | Expected | Note |
|-----------|---------|----------|------|
| `seed_challenge_01` | 2 | 12 | Seed data with many completed members now included |
| `seed_challenge_02` | 3 | 13 | Same |
| `seed_challenge_03` | 0 | 11 | Functions not deployed at creation; all completions excluded |
| `1S7cXHuHkwAONHhtSgLD` | 0 | 1 | Creator enrolled, trigger never fired |
| `9j0Op19Sr2A8s6qNc7UZ` | 0 | 1 | Creator enrolled, trigger never fired |
| `Uqx8beHESmfbyelkkmZ0` | 2 | 3 | One completed member previously excluded |

Group counters (`memberCount`, `activeChallenges`) are correct — 0 corrections needed.

### Apply Command (when ready to deploy)

```bash
CONFIRM_PROJECT_ID=tiizi-challenges npm run backfill:group-counts:apply
```

Do not run until Cloud Functions are deployed. The trigger will own new increments; the backfill corrects historical records once.

### Validation Commands Run

Same full suite — all passed. Dry-run executed against production project in read-only mode.

### Deploy Requirements

Run **after** functions deploy. The backfill uses `activeMemberStatuses` consistent with the updated trigger, so running it before functions deploy would produce counts that the old trigger would then immediately corrupt on the next status change.

### Remaining Risks

- None for the script itself. The dry-run confirms all corrections are additive (no existing count is higher than expected). Running apply is safe.

---

## Guard Tests Added (P5N section in `testChallengeCreationBackend.ts`)

6 assertions total:

| # | What it checks |
|---|---------------|
| 1 | `challengeCreationBackend` source contains `participantCount: 0` |
| 2 | `memberCounters ACTIVE_MEMBER_STATUSES` includes `completed` |
| 3 | `ACTIVE_MEMBER_STATUSES` does not include `abandoned`, `removed`, or `rejected` |
| 4 | `backfillGroupCounts activeMemberStatuses` includes `completed` |
| 5 | `joinChallenge` in `challengeService` does not write `participantCount` |
| 6 | The `challengePayload` block in `challengeCreationBackend` contains `participantCount: 0` (static slice check) |

2 stale assertions updated:
- Line 138: `participantCount === undefined` → `=== 0` (functional creation test)
- Lines 258–282: "absent from creation payload" block → "initialized to 0" block

---

## Summary of All Changes

| File | Type | Change |
|------|------|--------|
| `functions/src/challengeCreationBackend.ts` | Functions source | `participantCount: 0` added to challenge creation payload |
| `functions/src/memberCounters.ts` | Functions source | `'completed'` added to `ACTIVE_MEMBER_STATUSES` |
| `scripts/backfillGroupCounts.ts` | Backfill script | `'completed'` added to `activeMemberStatuses` |
| `scripts/testChallengeCreationBackend.ts` | Guard tests | 2 stale assertions updated; P5N section with 6 new assertions |

No client-side code changed. No Firestore rules changed.
