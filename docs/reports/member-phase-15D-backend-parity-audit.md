# Phase 15D — Backend Feature Parity Audit

**Date:** 2026-06-26
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** Audit only — no code changes
**Files compared:**
- Client path: `src/services/challengeService.ts`, `src/features/Challenges/CreateChallengeWizard.tsx`
- Callable path: `functions/src/challengeCreationBackend.ts`

---

## Full Comparison Matrix

### Challenge Document Fields

| Field | Client path | Callable | Classification |
|---|---|---|---|
| `category` | `input.category ?? 'fitness'` — any string accepted | `normalizeCategory()` — silently corrects invalid value to `'fitness'` | ✅ Intentional improvement |
| `name` | No server validation | `requireString(name, 'name', { min: 3, max: 120 })` | ✅ Intentional improvement |
| `description` | No server validation | `requireString(description, 'description', { min: 1, max: 2000 })` | ✅ Intentional improvement |
| `groupId` | `input.groupId` — client-supplied | Required string, validated | ✅ Intentional improvement |
| `challengeType` | `input.challengeType ?? 'collective'` | `normalizeChallengeType()` — defaults on absent, throws on invalid non-empty | ✅ Intentional improvement |
| `coverImageUrl` | `input.coverImageUrl` — unbounded | `optionalString(input.coverImageUrl, 500)` — capped at 500 chars | ✅ Intentional improvement |
| `exerciseIds` | Wizard deduplicates using `Set` | `stringArray(input.exerciseIds, 50, 120)` — no deduplication | 🔵 Safe difference — deduplication belongs in the wizard payload construction, not the server |
| `activities` | Raw from wizard — no server-side validation | `normalizeActivities()` — validates `targetValue`, `unit`, `targetType`, caps at 30 | ✅ Intentional improvement |
| `donation` | Constructs object with `enabled`, `approvalRequired`, `approvalStatus`, `disclaimer`. Does **not** write `acceptingDonations`. | `normalizeDonation()` writes `enabled`, `approvalRequired`, `approvalStatus`, `disclaimer`, **`acceptingDonations: !enabled`** | 🔵 Safe difference — `acceptingDonations` is an additive field; client reads are unaffected by its absence |
| `startDate` | `startDate.toISOString()` | `normalizeIsoDate()` → ISO string | ✅ Tie |
| `endDate` | `endDate.toISOString()` | `normalizeIsoDate()` or derived from `durationDays` | ✅ Tie (when both dates are provided) |
| `durationDays` | **Derived from dates**: `Math.max(1, Math.round((endDate - startDate) / ms_per_day))` | **Taken from input**, default `14` when absent — wizard does NOT send `durationDays` | 🔴 **Behavioural bug — MUST FIX before migration** |
| `createdBy` | `input.createdBy` — client-supplied, not verified | `actorUid` — extracted from verified Firebase Auth JWT | ✅ Intentional improvement |
| `status` | `requiresDonationApproval ? 'draft' : 'active'` | Same | ✅ Tie |
| `participantCount` | `0` on creation, then incremented to `1` via `joinChallenge` batch | `0` on creation, then incremented to `1` asynchronously by `onChallengeMemberCreated` trigger | 🔵 Safe difference — same value at rest, different timing (~1–5s async delay) |
| `moderationStatus` | `requiresDonationApproval ? 'pending' : 'approved'` | Same | ✅ Tie |
| `createdAt` | **Not written** | `nowIso` — written at creation | ✅ Intentional improvement |
| `groupVisibility` | **Not written** | Derived from group doc inside transaction — `'public' \| 'private'` | ✅ Intentional improvement |
| `visibility` | **Not written** | Same as `groupVisibility` | ✅ Intentional improvement |
| `engineVersion` | `'v2'` — always set by wizard | `requireEngineVersion(input.engineVersion)` — validates; wizard always sends `'v2'` | ✅ Tie |
| `groupCumulativeTarget` | Conditionally included for collective | Same | ✅ Tie |
| `autoCompleteOnGroupTarget` | Conditionally included for collective | Same | ✅ Tie |
| `requiredConsecutiveDays` | Conditionally included for streak | Same | ✅ Tie |
| `streakResetOnMiss` | Conditionally included for streak | Same | ✅ Tie |

---

### Creator Membership Fields

| Field | Client path (`joinChallenge`) | Callable | Classification |
|---|---|---|---|
| `challengeId` | ✅ | ✅ | Tie |
| `userId` | ✅ | ✅ | Tie |
| `groupId` | ✅ | ✅ | Tie |
| `joinedAt` | `Timestamp.now()` (Firestore Timestamp) | `nowIso` (ISO string) | 🔵 Safe difference — both are sortable; frontend reads both formats |
| `status: 'active'` | ✅ | ✅ | Tie |
| `activitiesCompleted: 0` | ✅ | ✅ | Tie |
| `totalActivities` | `computeRequiredLogs(durationDays, activities.length)` — uses actual `durationDays` from challenge doc | `Math.max(1, activities.length) * durationDays` — uses `durationDays` from input (potentially `14` if not sent) | 🔴 **Consequential on `durationDays` gap** — same formula, wrong input if `durationDays` is incorrect |
| `totalPoints: 0` | ✅ | ✅ | Tie |
| `completionRate: 0` | ✅ | ✅ | Tie |
| `currentStreak: 0` | Only for streak | Only for streak | ✅ Tie |
| `longestStreak: 0` | Only for streak | Only for streak | ✅ Tie |
| `lastLogDate` removal | `deleteField()` via `{ merge: true }` set | Implicitly absent — full-overwrite `set()` removes stale value | ✅ Intentional implementation difference — same result |
| **Donation challenge membership** | **Not created** — `joinChallenge` is not called when `requiresDonationApproval === true` | **Always created** in transaction | 🟡 **Behavioural difference — needs product decision** |

---

### User Statistics

| Field | Client path | Callable | Classification |
|---|---|---|---|
| `stats.totalChallenges` | `increment(1)` in `joinChallenge` batch — **not incremented for donation challenges** | `FieldValue.increment(1)` in transaction — **always incremented, including donation challenges** | 🟡 **Behavioural difference — follows from donation membership decision** |
| `lastChallengeJoinedAt` | `Timestamp.now()` — **not written for donation challenges** | `nowIso` ISO string — **always written** | 🟡 **Same — follows from donation membership decision** |

---

### Participant Counters

| Behaviour | Client path | Callable | Classification |
|---|---|---|---|
| `participantCount` on challenge doc | Incremented to `1` synchronously via `joinChallenge` write batch | Starts at `0`; incremented to `1` by `onChallengeMemberCreated` trigger (~1–5s) | 🔵 Safe difference |
| Double increment risk | Not possible — single batch | Not possible — trigger fires once per member document creation event | ✅ Tie |
| Donation challenge counter | Stays `0` (no `joinChallenge` call) | Stays `0` until trigger fires, then `1` | 🟡 Follows from donation membership decision |

---

### Group Ownership Checks

| Check | Client path | Callable | Classification |
|---|---|---|---|
| Group must exist | Checked (throws if group doc missing) | Checked in transaction (throws `not-found`) | ✅ Tie |
| Group must be `active` | Not checked | Checked: `status !== 'active'` throws `failed-precondition` | ✅ Intentional improvement |
| Creator must be group member | Checked (throws on missing or inactive membership) | Checked in transaction | ✅ Tie |
| `allowMemberChallenges` | **Not enforced** | Enforced: non-owner blocked if `false` | ✅ Intentional improvement |
| Owner auto-membership `role` | **`'owner'`** + `approvedAt` written | **`'member'`** only, no `approvedAt` | 🟡 **Behavioural difference — see note below** |

**Owner `role` note:** The client writes `role: 'owner'` when creating a missing group membership for the group owner. The callable writes `role: 'member'`. If any Firestore query, rule, or UI component filters or branches on `groupMembers.role === 'owner'`, this would produce incorrect results. The callable should write `role: 'owner'` for group owner memberships.

---

### Validation

| Rule | Client path | Callable | Classification |
|---|---|---|---|
| Name present | UI only | `requireString(name, 'name', { min: 3, max: 120 })` | ✅ Callable better |
| Description length | `< 8` chars (UI) | `min: 1, max: 2000` | ✅ Callable better |
| At least one activity | UI only | Throws if `activities.length === 0` | ✅ Callable better |
| Activity `targetValue > 0` | UI only | `requirePositiveNumber` per activity | ✅ Callable better |
| Duplicate activity IDs | Not checked | Throws on duplicate `exerciseId`/`activityId` | ✅ Callable better |
| `challengeType` valid | Not validated | Throws on invalid non-empty value | ✅ Callable better |
| `engineVersion` valid | Not validated | Throws on non-`'v2'` non-empty value | ✅ Callable better |
| `targetType` valid | Not validated | Throws on invalid non-empty value | ✅ Callable better |
| Mixed-unit collective | Client-side throw | Server-side throw | ✅ Tie (both check) |
| `groupCumulativeTarget > 0` | UI only | Throws if provided and `<= 0` | ✅ Callable better |
| `requiredConsecutiveDays <= durationDays` | Not checked | Throws if exceeds duration | ✅ Callable better |
| Donation contact method | UI only | Throws if `enabled` and no phone/card URL | ✅ Callable better |
| `createdBy` == authenticated user | Not checked | Throws if `createdBy !== actorUid` | ✅ Callable better |
| `endDate` after `startDate` | UI only | Throws | ✅ Callable better |

---

### Rollback Behaviour

| Scenario | Client path | Callable |
|---|---|---|
| Challenge doc written, `joinChallenge` fails | **Partial state** — challenge exists without creator membership; error swallowed (`console.error`); `participantCount: 0` indefinitely; no user stats update | **Full rollback** — nothing committed if any transaction step fails |
| Group membership write fails | **Partial state** — challenge may be created with a phantom membership reference | Full rollback |

---

### Duplicate Protection

| Mechanism | Client path | Callable |
|---|---|---|
| UI guard | `isLaunching` flag prevents double-tap | N/A (server-side) |
| Server-side deduplication | None | None |
| Risk | Two concurrent browser sessions can create duplicates | Same |

---

### Trigger Interactions

| Trigger | Client path interaction | Callable interaction |
|---|---|---|
| `onChallengeMemberCreated` | Fires when `joinChallenge` writes member doc; increments `participantCount` by 1 | Fires when transaction writes member doc; increments `participantCount` by 1. Net result: counter goes from `0` to `1` correctly |
| `onChallengeMemberUpdated` | Not involved in creation | Not involved in creation |
| `onChallengeMemberCreatedUpdateMemberSummaries` | Fires on member doc creation — analytics summary update | Same |
| Double-trigger risk | Not possible — one write path | Not possible — one write inside transaction |

---

### Other Behaviours

| Behaviour | Client path | Callable | Classification |
|---|---|---|---|
| Template usage count | Fire-and-forget in wizard after creation | Not called by callable — remains in wizard; unchanged by migration | ✅ Tie (wizard handles this) |
| Notifications | None | None | ✅ Tie |
| Analytics fields | Cloud Function triggers handle these | Same trigger fires | ✅ Tie |
| Error retry | Wizard retries once after `permission-denied` via `joinGroup()` + second `createChallenge` call | Callable enforces membership server-side; retry logic would be redundant | 🔵 Safe to remove retry when migrating |

---

## Remaining Differences

### 🔴 Must Fix Before Migration (Blockers)

#### 1. `durationDays` source (Critical)

**The gap:** The wizard builds a payload with `startDate` and `endDate` but does **not** include `durationDays`. `createChallenge` derives `durationDays` from the dates (`Math.max(1, Math.round((endDate - startDate) / ms_per_day))`). The callable reads `durationDays` from `input.durationDays`, defaulting to `14` when absent.

**Impact:** If the wizard migrates without sending `durationDays`, every challenge created via the callable would store `durationDays: 14` regardless of the actual date range. Since `durationDays` drives:
- `computeRequiredLogs()` — the completion threshold
- `deriveDailyTargetValue()` — per-session scoring for cumulative streak activities
- `totalActivities` on creator membership

...challenges with any duration other than 14 days would have incorrect scoring and completion thresholds.

**Required fix (either):**
- Option A: The callable derives `durationDays` from `endDate − startDate` when `durationDays` is not explicitly provided (matching client path behaviour)
- Option B: The wizard sends `durationDays` explicitly computed from the selected dates

Option A keeps the callable self-consistent and removes a migration footgun from the wizard side. Option B is simpler in the callable but requires wizard changes and risks drift if dates are later changed independently.

---

#### 2. Owner group membership `role` (High)

**The gap:** Client writes `role: 'owner'` + `approvedAt` for owner auto-membership. Callable writes `role: 'member'`, no `approvedAt`.

**Impact:** If `groupMembers.role` is queried or displayed anywhere (e.g. group owner badge, admin checks, Firestore rules referencing `role`), challenges created by the callable for group owners without a pre-existing membership would produce incorrect role state.

**Required fix:** Callable should write `role: 'owner'` (and optionally `approvedAt`) when creating the membership for the group owner.

---

### 🟡 Needs Product Decision (Not Blockers, but Behavioural Changes)

#### 3. Creator membership for donation challenges

**The gap:** Client does not create a creator membership when `requiresDonationApproval === true` (challenge status is `'draft'`). Callable always creates one.

**Impact of callable behaviour:** The challenge creator has a membership immediately upon creation of a draft challenge. This affects `totalChallenges`, `lastChallengeJoinedAt`, `participantCount` (via trigger), and the creator's membership view.

**Decision required:** Should the creator be a member of a donation challenge before it is approved? If yes — callable behaviour is correct and an improvement. If no — the callable should skip the membership write when `requiresDonationApproval === true`.

---

### 🔵 Safe Differences (No Action Required)

| Difference | Why safe |
|---|---|
| `acceptingDonations` written by callable but not client | Additive — existing client reads that don't expect it are unaffected |
| `participantCount` timing (async vs sync) | Same value at rest; ~1–5s delay is cosmetic for creation flow |
| `joinedAt` format (ISO string vs Firestore Timestamp) | Frontend reads both; no query depends on Timestamp-specific properties here |
| Client-side retry on `permission-denied` | Redundant once callable enforces membership server-side |
| Pre-flight `getMembershipStatus` check in wizard | Redundant with transaction-level check in callable |
| `exerciseIds` deduplication in wizard (not callable) | UI concern; duplicates in `exerciseIds` have no scoring impact |
| Category validation difference (`fitness` default vs silent correction) | Same output for all well-formed inputs |
| Callable improvements (`createdAt`, `groupVisibility`, `visibility`, validation, auth) | These make the callable strictly better; no regression risk |

---

## Verdict

**NOT READY FOR FRONTEND MIGRATION**

Two blockers must be resolved first:

| # | Blocker | Severity |
|---|---|---|
| 1 | `durationDays` defaults to `14` when not provided — wizard does not send it | **Critical** — wrong scoring for all challenges with non-14-day duration |
| 2 | Owner group membership written with `role: 'member'` instead of `role: 'owner'` | **High** — incorrect role state for owner-created memberships |

One product decision should be recorded before migration:

| # | Decision | Impact |
|---|---|---|
| 3 | Should donation-challenge creators receive an immediate membership? | Affects `totalChallenges`, `participantCount`, creator membership display |

---

## What Must Remain After Migration

The following wizard behaviours must be **retained** after migration regardless of which creation path is used:

1. `incrementUsageCount` fire-and-forget for `templateId` and `wellnessTemplateId` — the callable has no template awareness; the wizard calls these after creation resolves
2. Client-side UI validation (name, description, dates, activities) — UX convenience; does not replace server validation
3. `isLaunching` guard — prevents double-tap; server has no deduplication either

---

## Recommended Fix Plan (Phase 15E, if approved)

| Task | File | Change |
|---|---|---|
| Fix `durationDays` | `functions/src/challengeCreationBackend.ts` | Derive `durationDays` from `endDate − startDate` when not explicitly provided (matching client `Math.max(1, Math.round(...))` formula) |
| Fix owner membership `role` | `functions/src/challengeCreationBackend.ts` | Write `role: 'owner'` + `approvedAt: nowIso` when creating auto-membership for group owner |
| Record product decision | — | Confirm whether donation-challenge creator should receive immediate membership |
