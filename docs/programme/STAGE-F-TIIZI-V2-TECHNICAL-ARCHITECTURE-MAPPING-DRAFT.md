---
title: "Tiizi V2 — Stage F Technical Architecture Mapping"
document_type: "Stage F Technical Architecture Mapping — DRAFT"
stage: "Stage F — Product & Technical Translation"
version: "0.1-draft"
date: "2026-09-05"
status: "Stage F Draft — Pending Founder Review"
authority_basis:
  - "Stage F T1 Product Definition DRAFT"
  - "Stage F T2 Functional Requirements DRAFT"
  - "Stage F Canonical Information Contract DRAFT"
  - "Stage F Knowledge Runtime Contract DRAFT"
  - "EOG-E1-01 v0.2"
  - "EKG-01 v0.1"
  - "CGP-04 v0.1"
preserved_deferrals:
  - "ACT-03 — Verification Authority"
  - "ACT-04 — Correction Authority"
  - "MOT-01 — Recognition Authority"
  - "Rewards — implementation/custody/entitlement"
technology_policy: "MTAIP-001 — Architecture drives infrastructure; retain Firebase unless demonstrated reason to change"
---

# Tiizi V2 — Stage F Technical Architecture Mapping

> **STATUS: DRAFT — Pending Founder Review**
> This document is a technical map, not a work order. It identifies what exists, what must change,
> and what must be removed — but does not authorize implementation. Implementation authority
> resides with the Founder (ACT-01) after Stage F review closure.

---

## 1. Executive Technical Position

The existing Tiizi Firebase/React codebase is substantially aligned with the V2 product contracts defined in Stage F T1, T2, the Canonical Information Contract, and the Knowledge Runtime Contract. The three challenge engines (collective, competitive, streak) are pure-function, v2-only, and correctly separated from UI and persistence layers. The main gaps are: (1) the streak engine does not enforce ALL-daily-requirements before advancing — a single log event currently advances the streak, whereas V2 requires all configured daily requirements to be Done; (2) the competitive leaderboard lacks shared positions for ties — sequential integer ranks are assigned instead; (3) collective progress is clamped at 100% via `Math.min()`, preventing full crossing contributions from being counted; (4) no correction or audit triggers exist for activity log edits/deletions — derived state (leaderboards, feed, summaries) becomes stale; (5) comments and replies exist as a full feature but are excluded from V2 per T1 §Q and Notifications baseline §20; (6) a streak leaderboard exists in the UI but V2 specifies no streak leaderboard; (7) Knowledge lifecycle states (draft/published/retired) are missing from the activity catalogues per the KRC; (8) profile privacy settings are stored but not enforced at the Firestore rules data layer. No material blocker prevents proceeding to implementation planning.

---

## 2. Current Architecture Summary

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + TypeScript + Vite | SPA hosted on Firebase Hosting |
| State | React Query (TanStack Query) | Server-state caching with stale-while-revalidate |
| Backend | Firebase (Firestore + Cloud Functions + Hosting) | No separate API server |
| Database | Firestore (NoSQL document) | 27+ collections, document-subcollection model |
| Functions | Cloud Functions (Node.js) | Triggers + callable HTTPS, 20+ deployed functions |
| Auth | Firebase Authentication | Email/password, UID-based identity |
| Rules | Firestore Security Rules | 27 match blocks, role-based access |
| Hosting | Firebase Hosting | SPA with catch-all rewrite to index.html |
| Build | Vite | Fast HMR, TypeScript strict mode |
| Routing | React Router | Client-side SPA routing |
| Styling | Tailwind CSS / custom | Component-scoped styles |
| Testing | Custom guard scripts (56 scripts) | Structural invariant checks, not unit tests |

### Architecture Diagram (Conceptual)

```
┌─────────────────────────────────────────────────────────────┐
│                    Firebase Hosting (SPA)                     │
│  ┌───────────────────────────────────────────────────────┐  │
│  │              React + TypeScript + Vite                  │  │
│  │  ┌──────────┐  ┌──────────────┐  ┌────────────────┐  │  │
│  │  │ Features │  │   Services   │  │  Challenge     │  │  │
│  │  │  (UI)    │──│  (Data API)  │  │  Engines (CF)  │  │  │
│  │  └──────────┘  └──────┬───────┘  └────────────────┘  │  │
│  │                        │                               │  │
│  │               ┌────────┴────────┐                      │  │
│  │               │  React Query    │                      │  │
│  │               │  (cache layer)  │                      │  │
│  │               └────────┬────────┘                      │  │
│  └────────────────────────┼───────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │
┌───────────────────────────┼──────────────────────────────────┐
│                    Firebase Backend                           │
│  ┌──────────────┐  ┌─────┴──────┐  ┌────────────────────┐  │
│  │  Firestore   │  │   Cloud    │  │  Firestore         │  │
│  │  (27+ colls) │  │  Functions │  │  Security Rules    │  │
│  └──────────────┘  └────────────┘  └────────────────────┘  │
│  ┌──────────────┐  ┌────────────┐                           │
│  │  Firebase    │  │  Firebase  │                           │
│  │  Auth        │  │  Hosting   │                           │
│  └──────────────┘  └────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. V2 Target Architecture Boundaries

| Constraint | Position | Basis |
|---|---|---|
| Technology stack | **Retained** — same Firebase/React stack | MTAIP-001 |
| Infrastructure migration | **Not authorized** | MTAIP-001 |
| Nature of V2 | **Product correction**, not platform rewrite | Stage F T1 |
| Existing architecture | **Preserved** unless demonstrated gap | This mapping |
| Firebase Hosting | **Retained** | No reason to change |
| Firestore | **Retained** as primary data store | No reason to change |
| Cloud Functions | **Retained** as compute layer | No reason to change |
| Firebase Auth | **Retained** | No reason to change |
| React + TypeScript | **Retained** as frontend framework | No reason to change |
| Vite build | **Retained** | No reason to change |
| TanStack Query | **Retained** for server state | No reason to change |
| Engine architecture | **Retained** — pure-function, v2-only | Correctly separated |

### What V2 Does NOT Authorize

- No migration from Firebase to any other cloud provider
- No introduction of a separate API server (Express, Nest, etc.)
- No replacement of Firestore with SQL or other database
- No introduction of a message queue or event bus
- No microservices decomposition
- No container orchestration (Docker, Kubernetes)
- No CDN change from Firebase Hosting
- No authentication provider change from Firebase Auth

### What V2 Does Require (Technical)

- Correction of engine logic to match V2 product contracts
- Removal of features excluded from V2 (comments, streak leaderboard)
- Addition of missing enforcement (profile privacy in rules)
- Addition of Knowledge lifecycle states per KRC
- Addition of correction/audit triggers for data integrity
- Addition of unit test framework for engine validation

---

## 4. Area-by-Area Implementation Mapping

> **Classification Legend:**
> - **ALIGNED** — Current implementation matches V2 target. No change required.
> - **PARTIALLY ALIGNED** — Core structure correct, specific gaps identified.
> - **REMEDIATION REQUIRED** — Significant gap that must be addressed before V2 is correct.
> - **MISSING** — Feature/capability does not exist and is required.
> - **LEGACY/REMOVE** — Feature exists but is excluded from V2; must be removed.
> - **FUTURE** — Deferred beyond initial V2 scope.

---

### 4.1 Member/Profile

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/userProfileService.ts`, `src/features/Profile/*` |
| Current Behaviour | Profile structured with personal info, interests, goals, privacy settings, Support Tiizi CTA. CRUD operations via userProfileService. Privacy settings stored as nested object. |
| V2 Target | Member profile with personal info, interests, goals, privacy settings, and permanent Support Tiizi CTA. |
| Gap | None for initial V2. Profile privacy enforcement at data layer is a separate concern (see 4.25). |
| Recommended Change | No change required for initial V2. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `userProfileService.ts` handles read/update of user documents
- Profile fields: displayName, bio, interests[], goals[], privacySettings, createdAt, updatedAt
- Privacy settings stored as `{ isProfilePublic: boolean }` on the user document
- Support Tiizi CTA is rendered in the Profile feature as a permanent element
- No profile image upload in current implementation (not required for V2)

---

### 4.2 Group and Group Membership

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/groupService.ts`, `src/features/Groups/*` |
| Current Behaviour | Groups with composite membership IDs, owner/admin/member roles, lifecycle states (active/archived). Discovery filters private groups. Stewardship via owner role. |
| V2 Target | Groups as containers for Challenges and Feed. Membership-based access. Discovery with privacy filtering. |
| Gap | Minor: admin role exists in schema but promotion UI may be missing. Not a V2 blocker. |
| Recommended Change | No change required for initial V2. Admin promotion UI is a future enhancement. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- Group document: `{ name, description, isPrivate, ownerUid, memberCount, status, createdAt, ... }`
- `groupMembers` collection: composite doc IDs `{groupId}_{userId}`, role field (owner/admin/member)
- `groupService.ts`: createGroup, updateGroup, getGroups, getGroupById, getGroupMembers
- Discovery: `getGroups()` filters by `isPrivate == false` for non-member queries
- Lifecycle: active → archived (soft delete pattern)
- Join request flow: `groupJoinRequests` collection with CF-managed lifecycle
- Invite flow: `groupInvites` collection with CF-managed token generation

---

### 4.3 Challenge Model

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/types/index.ts` (Challenge interface), `src/services/challengeService.ts` |
| Current Behaviour | Challenge types: collective, competitive, streak. `engineVersion: 'v2'` only (no legacy fallback). Status: draft/active/completed/expired. Donation sub-object for cause-enabled challenges. |
| V2 Target | Three challenge types with v2 engines. Lifecycle states. Optional donation/cause configuration. |
| Gap | None. Model is correctly structured for V2. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- Challenge interface in `src/types/index.ts` includes:
  - `type: 'collective' | 'competitive' | 'streak'`
  - `engineVersion: 'v2'` (hardcoded, no legacy engine path)
  - `status: 'draft' | 'active' | 'completed' | 'expired'`
  - `activityType: 'fitness' | 'wellness'`
  - `donation?: { causeName, targetAmount, currency, ... }`
  - `groupCumulativeTarget` (for collective)
  - `durationDays`, `dailyRequirements[]` (for streak)
  - `startDate`, `endDate`
  - `createdBy`, `groupId`
- All three types use the same Challenge document shape with type-specific fields

---

### 4.4 Challenge Participation

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/challengeService.ts` (joinChallenge, leaveChallenge) |
| Current Behaviour | Composite doc IDs `{challengeId}_{userId}`. Status: active/completed/abandoned. Leave only allowed if no activity logged (data integrity guard). Streak state explicitly reset on rejoin. |
| V2 Target | Membership-based participation with integrity guards. |
| Gap | None. Participation model correctly implements V2 requirements. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `challengeMembers` collection: `{ challengeId, userId, status, joinedAt, completedAt, ... }`
- Composite doc ID pattern: `{challengeId}_{userId}` — prevents duplicate membership
- `joinChallenge()`: creates membership doc, increments `challenge.memberCount`
- `leaveChallenge()`: checks for existing activity logs; rejects if any found
- Streak reset on rejoin: streak state fields cleared when a user rejoins after leaving
- Status transitions: active → completed (engine-driven) or active → abandoned (user-initiated)

---

### 4.5 Challenge Creation and Configuration

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/challengeService.ts` (createChallenge, lines 753-880) |
| Current Behaviour | Copy-at-creation for activity data. All v2 engine fields supported. Donation challenges go to draft+pending for approval. |
| V2 Target | Challenge creation with full activity snapshot, type-specific configuration, donation approval gate. |
| Gap | None. Creation flow correctly captures all required fields. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `createChallenge()` (lines 753-880 in challengeService.ts):
  - Accepts full configuration object
  - Copies activity definition into Challenge document (snapshot pattern)
  - Sets `engineVersion: 'v2'`
  - For donation-enabled challenges: sets status to `draft`, adds `pendingApproval: true`
  - Validates required fields per challenge type
- Activity snapshot includes: activity name, type, category, scoring configuration, unit
- This snapshot pattern ensures Challenge is self-contained even if source activity is later modified

---

### 4.6 Challenge Templates

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/challengeTemplateService.ts`, `src/services/wellnessTemplateService.ts` |
| Current Behaviour | Two template systems (fitness + wellness). Lifecycle: draft/published/archived/deleted. Admin CRUD with publish/unpublish/feature/duplicate. |
| V2 Target | Reusable Challenge templates for admin-managed catalogue. |
| Gap | None. Template system is well-structured for V2. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `challengeTemplateService.ts`: fitness Challenge templates
- `wellnessTemplateService.ts`: wellness Challenge templates
- Template lifecycle: draft → published → archived → deleted (soft)
- Admin operations: create, update, publish, unpublish, feature, duplicate, delete
- Templates store full Challenge configuration minus runtime state
- Featured templates surfaced in Challenge creation flow

---

### 4.7 Fitness Activity Catalogue

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/exerciseService.ts`, `src/services/adminExerciseService.ts` |
| Current Behaviour | Firestore-driven (`catalogExercises` collection). No hardcoded definitions. Validation, filtering, search, pagination. |
| V2 Target | Admin-managed fitness activity catalogue, Firestore-backed. |
| Gap | None for initial V2. KRC lifecycle states are a P1 enhancement (see §9). |
| Recommended Change | No change required for initial V2. KRC lifecycle states (draft/published/retired) are P1. |
| Dependencies | KRC implementation (P1) |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `catalogExercises` collection in Firestore: `{ name, category, muscleGroup, equipment, difficulty, scoringConfig, unit, ... }`
- `exerciseService.ts`: client-facing read operations (list, search, filter, paginate)
- `adminExerciseService.ts`: admin CRUD operations (create, update, delete)
- No hardcoded exercise definitions — all data from Firestore
- Search: text match on name, filter by category/muscleGroup/equipment/difficulty
- Pagination: cursor-based with configurable page size

---

### 4.8 Wellness Activity Catalogue

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/wellnessActivityService.ts`, `src/data/wellnessActivitiesCatalog.ts` |
| Current Behaviour | Firestore primary + local fallback (~70+ items). Dual-source resilience pattern. |
| V2 Target | Admin-managed wellness activity catalogue with resilience. |
| Gap | None for initial V2. KRC lifecycle states are a P1 enhancement. |
| Recommended Change | No change required for initial V2. KRC lifecycle states are P1. |
| Dependencies | KRC implementation (P1) |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `wellnessActivitiesCatalog.ts`: local fallback catalogue (~70+ wellness activities)
- `wellnessActivityService.ts`: reads from Firestore `wellnessActivities` collection first, falls back to local data
- Dual-source pattern ensures app functions even if Firestore write is delayed
- Categories: meditation, breathing, stretching, mindfulness, sleep, nutrition, etc.
- Each activity has: name, category, description, defaultDuration, defaultPoints, unit

---

### 4.9 Challenge-Specific Activity Configuration

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/challengeService.ts`, `src/services/challengeActivityFlow.ts` |
| Current Behaviour | Copy-at-creation: full activity snapshot embedded in Challenge document. Routing: fitness vs wellness determined by activityType/category/exerciseId prefix. |
| V2 Target | Each Challenge carries its own activity definition (immutable snapshot at creation). |
| Gap | None. Snapshot pattern correctly isolates Challenge from source catalogue changes. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `challengeActivityFlow.ts`: routing logic for activity type determination
- Fitness vs wellness determined by: `activityType` field, `category` field, or `exerciseId` prefix
- Full activity snapshot stored in Challenge document at creation time
- Snapshot includes: activity name, type, category, scoring config, unit, any type-specific fields
- This ensures Challenge scoring remains consistent even if source activity is modified or deleted

---

### 4.10 Activity Logging

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/workoutService.ts`, `src/services/wellnessLogService.ts`, `src/services/activityWriteGuards.ts` |
| Current Behaviour | Every log has `challengeId` (Challenge-specific). No cross-Challenge reuse. Scoring: `proportional_capped`, client-provided points ignored. |
| V2 Target | Challenge-scoped activity logging with server-authoritative scoring. |
| Gap | None. Logging model correctly implements V2 requirements. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `workoutService.ts`: fitness activity logging (reps, duration, distance)
- `wellnessLogService.ts`: wellness activity logging (duration, completion)
- `activityWriteGuards.ts`: validation layer preventing invalid writes
- Every log document includes `challengeId` — logs are always Challenge-scoped
- Scoring strategy: `proportional_capped` — points calculated server-side based on activity config
- Client-provided points values are ignored; server recalculates from raw activity data
- Log documents: `{ challengeId, userId, activityId, values, calculatedPoints, createdAt, ... }`

---

### 4.11 Accepted Activity Event / Evidence Flow

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** (with documentation note) |
| Key Files | `src/services/workoutService.ts` (line 220: `verified: false` — dead code) |
| Current Behaviour | No formal acceptance step. Logging is direct and immediate. The `verified: false` field is a placeholder that was never implemented. |
| V2 Target | Self-accountability model (EOG-E1-01 §20-21). No formal verification required for initial V2. |
| Gap | The `verified: false` field exists as dead code. Should be documented as reserved for ACT-03 future use. |
| Recommended Change | Document `verified` field as reserved for ACT-03 (Verification Authority). No functional change for initial V2. |
| Dependencies | ACT-03 resolution (deferred) |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `workoutService.ts` line 220: sets `verified: false` on workout log creation
- This field is never read, never checked, never updated — pure dead code
- V2 self-accountability model (EOG-E1-01 §20-21) does NOT require formal verification
- Members self-report activity; the system trusts the report
- ACT-03 (Verification Authority) is deferred — when resolved, this field may gain meaning
- For now: document as reserved, do not remove (preserves forward compatibility)

---

### 4.12 Derived Truth Calculation

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/challengeEngine/*` (3 engines + types + index) |
| Current Behaviour | Three pure-function engines, v2-only, no legacy fallback. Engines return `EngineResult` (membership update + optional challenge update). Clear separation: raw activity → engine → derived state. |
| V2 Target | Pure-function derivation layer. Raw activity in, derived state out. No side effects. |
| Gap | None at the architectural level. Individual engine logic gaps are covered in 4.13, 4.14, 4.15. |
| Recommended Change | No architectural change required. Engine logic corrections in 4.13-4.15. |
| Dependencies | None |
| Risk | Low (architecture); see individual engine areas for logic risk |
| Migration Required? | No |

**Detail Notes:**

- Engine files:
  - `src/services/challengeEngine/collectiveEngine.ts`
  - `src/services/challengeEngine/competitiveEngine.ts`
  - `src/services/challengeEngine/streakEngine.ts`
  - `src/services/challengeEngine/types.ts` (EngineResult, EngineInput, etc.)
  - `src/services/challengeEngine/index.ts` (barrel export)
- All engines are pure functions: no Firestore reads/writes, no side effects
- Input: `EngineInput` (activity log + current membership state + challenge config)
- Output: `EngineResult` (membership state update + optional challenge state update)
- Engines are called from Cloud Functions after activity log creation
- This clean separation makes engines testable in isolation (no mocking required)

---

### 4.13 Collective Challenge Logic

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `src/services/challengeEngine/collectiveEngine.ts`, `src/utils/collectiveGroupTransition.ts` |
| Current Behaviour | `groupCurrentTotal` is CLAMPED to `groupCumulativeTarget` via `Math.min()`. Progress cannot exceed 100%. |
| V2 Target | Progress may exceed 100%. Full crossing contribution counts toward group total. |
| Gap | `Math.min()` clamping prevents contributions beyond the target from being recorded. A member who contributes after the group has reached 100% has their contribution zeroed out. |
| Recommended Change | Remove `Math.min()` clamping in `collectiveEngine.ts`. Allow `groupCurrentTotal` to exceed `groupCumulativeTarget`. Completion detection should trigger at `>=` target, not `==` target. |
| Dependencies | None |
| Risk | Low — atomic increment already handles concurrent writes correctly |
| Migration Required? | No — forward-looking change; existing data unaffected |

**Current Code Pattern (to be changed):**

```
// collectiveEngine.ts — current clamping behavior
const newTotal = Math.min(
  currentMembership.groupCurrentTotal + contribution,
  challenge.groupCumulativeTarget  // ← clamp prevents exceeding 100%
);
```

**Required Change:**

```
// Remove Math.min() — allow total to exceed target
const newTotal = currentMembership.groupCurrentTotal + contribution;
// Completion check uses >= instead of ==
const isComplete = newTotal >= challenge.groupCumulativeTarget;
```

**Impact Analysis:**

- Existing Challenges at exactly 100%: unaffected (already complete)
- Existing Challenges below 100%: unaffected (clamping was not active)
- Future Challenges: contributions beyond target now correctly counted
- Display layer: progress bar should cap visual at 100% even if data exceeds (UI concern)

---

### 4.14 Competitive Challenge Logic

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `src/services/challengeEngine/competitiveEngine.ts`, `src/utils/leaderboardSort.ts`, `src/features/Challenges/ChallengeLeaderboardScreen.tsx` |
| Current Behaviour | Leaderboard assigns sequential integer ranks (1, 2, 3, 4...) regardless of ties. Non-completers ranked by progress. |
| V2 Target | Shared positions for ties (1, 1, 3, 4...). Non-completers show actual progress but no finishing position. |
| Gap 1 | No shared-position logic — tied members get different ranks. |
| Gap 2 | Non-completers appear on leaderboard with sequential ranks (this is close to correct — V2 says no finishing position but actual progress visible). |
| Recommended Change | Implement shared-position logic in `leaderboardSort.ts`. Detect identical `completionRate` + `totalPoints`, assign same rank. Skip subsequent rank numbers. |
| Dependencies | None |
| Risk | Low — display-layer change only, engine logic unaffected |
| Migration Required? | No |

**Current Ranking Logic (to be changed):**

```
// leaderboardSort.ts — current sequential ranking
members.sort((a, b) => b.completionRate - a.completionRate || b.totalPoints - a.totalPoints);
members.forEach((m, i) => { m.rank = i + 1; });  // ← no tie detection
```

**Required Change:**

```
// Shared-position ranking
members.sort((a, b) => b.completionRate - a.completionRate || b.totalPoints - a.totalPoints);
let currentRank = 1;
for (let i = 0; i < members.length; i++) {
  if (i > 0 && isTied(members[i], members[i - 1])) {
    members[i].rank = members[i - 1].rank;  // same rank as previous
  } else {
    members[i].rank = currentRank;
  }
  currentRank = i + 2;  // next rank skips tied positions
}
```

**Tie Detection Criteria:**

- Same `completionRate` AND same `totalPoints` → tied
- Different `completionRate` → not tied (higher rate wins)
- Same `completionRate`, different `totalPoints` → not tied (higher points wins)

---

### 4.15 Streak Challenge Logic

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `src/services/challengeEngine/streakEngine.ts`, `src/services/streakService.ts`, `src/features/Challenges/ChallengeLeaderboardScreen.tsx` |
| Current Behaviour | Single log event advances streak. Streak leaderboard exists in UI. |
| V2 Target | ALL configured daily requirements must be Done before streak advances. No streak leaderboard. |
| Gap 1 | Engine advances streak on any single activity log — does not check if ALL daily requirements are met. |
| Gap 2 | Streak leaderboard view exists in `ChallengeLeaderboardScreen.tsx` — V2 specifies no streak leaderboard. |
| Recommended Change 1 | Modify `streakEngine.ts` to check all activities completed for the day before advancing streak counter. |
| Recommended Change 2 | Remove streak-specific leaderboard view from `ChallengeLeaderboardScreen.tsx`. Replace with Days Completed / Best Streak / Final Streak summary. |
| Dependencies | None |
| Risk | **Medium** — engine logic change affects streak calculation correctness |
| Migration Required? | **Yes** — existing streak data may need recalculation after engine fix |

**Gap 1 Detail — Engine Logic:**

Current behavior:
```
// streakEngine.ts — current: any log advances streak
if (isToday(log.createdAt) && !alreadyLoggedToday) {
  membership.currentStreak += 1;
  membership.bestStreak = Math.max(membership.bestStreak, membership.currentStreak);
}
```

Required behavior:
```
// Check ALL daily requirements before advancing
const todayLogs = getLogsForToday(membership.userId, challenge.id);
const allRequirementsMet = challenge.dailyRequirements.every(req =>
  todayLogs.some(log => log.activityId === req.activityId && log.status === 'done')
);
if (allRequirementsMet && !streakAlreadyAdvancedToday) {
  membership.currentStreak += 1;
  membership.bestStreak = Math.max(membership.bestStreak, membership.currentStreak);
}
```

**Gap 2 Detail — UI Removal:**

- `ChallengeLeaderboardScreen.tsx`: remove streak-specific leaderboard tab/view
- `leaderboardSort.ts`: remove streak-specific sorting branch (if present)
- Replace with summary display: Days Completed, Best Streak, Final Streak
- These summary metrics are already tracked in membership document

**Migration Implications:**

- Existing streak data was calculated under the incorrect single-log-advances rule
- After engine fix, existing streaks may be inflated (some days counted where not all requirements were met)
- Options: (a) reset all streaks to 0 and let them rebuild, (b) recalculate from source logs, (c) leave existing and apply new rules only going forward
- Recommendation: option (c) for initial V2 — document the discrepancy, apply new rules prospectively

---

### 4.16 Challenge Completion/Finalization

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/challengeCompletion.ts`, `src/services/challengeLifecycle.ts` |
| Current Behaviour | Clean state machine: individual completion (competitive/streak) + group completion (collective). Cascade completion for collective (chunked batches of 450 writes). Expiration via scheduled Cloud Function. |
| V2 Target | Correct completion detection per challenge type. Clean finalization. |
| Gap | None. Completion logic is well-structured. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `challengeCompletion.ts`: handles individual and group completion detection
- Competitive: member completes when `completionRate >= 1.0` (all target activities done)
- Streak: member completes when Challenge ends (streak challenges don't have a "completion" target per se)
- Collective: group completes when `groupCurrentTotal >= groupCumulativeTarget`
- Cascade: when collective Challenge completes, all active members' statuses updated to `completed`
- Cascade uses chunked batches (450 writes per batch) to stay within Firestore transaction limits
- `challengeLifecycle.ts`: expiration handling via scheduled Cloud Function
- Scheduled function runs periodically, checks for Challenges past `endDate`, triggers expiration

---

### 4.17 Group Feed

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/features/Groups/GroupFeedScreen.tsx`, `functions/src/memberActivitySummaries.ts` |
| Current Behaviour | CF-driven auto-publication. Group-scoped queries. Filter chips. Feed items created by Cloud Functions only (not client). Milestone detection at 25/50/75/100% thresholds. |
| V2 Target | Automatic feed generation from activity. Group-scoped. Admin-moderated (via CF). |
| Gap | None. Feed architecture correctly implements V2 requirements. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `GroupFeedScreen.tsx`: UI for group feed with filter chips (all/activity/milestones)
- `memberActivitySummaries.ts` (Cloud Function): generates feed items from activity logs
- Feed items are NEVER created by client code — only by Cloud Functions
- This ensures feed integrity: only valid, scored activity generates feed items
- Feed item types: activity_log, milestone, challenge_completion, member_join
- Milestone thresholds: 25%, 50%, 75%, 100% of Challenge target
- Feed items stored in `groupActivityFeed` subcollection of the group document
- Query scoping: only group members can read their group's feed

---

### 4.18 Share-to-Group

| Attribute | Value |
|---|---|
| Classification | **FUTURE** |
| Key Files | `src/features/Groups/GroupFeedScreen.tsx` (lines 89-95: post composer placeholder) |
| Current Behaviour | Post composer placeholder exists but is non-functional. Auto-publication via logging is the actual feed mechanism. |
| V2 Target | No manual posting for initial V2. Auto-publication via activity logging is sufficient. |
| Gap | Placeholder UI exists but serves no purpose. |
| Recommended Change | Hide or remove the post composer placeholder. No functional change needed. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `GroupFeedScreen.tsx` lines 89-95: contains a post composer UI element
- This element is non-functional — no backend support for manual posts
- Auto-publication via activity logging (4.17) is the correct V2 mechanism
- Recommendation: hide the placeholder (comment out or conditional render)
- Full share-to-group feature is deferred to a future stage

---

### 4.19 Kudos/Reactions

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/feedReactionService.ts`, `src/features/Groups/FeedCard.tsx` |
| Current Behaviour | Three reaction types (like, applaud, inspired). Per-user-per-item uniqueness. Batch-fetched for feed display. Firestore rules enforce group membership. |
| V2 Target | Kudos/reactions on feed items. Limited reaction types. Group-scoped. |
| Gap | None. Reaction system correctly implements V2 requirements. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `feedReactionService.ts`: addReaction, removeReaction, getReactionsForFeedItem
- Reaction types: `like`, `applaud`, `inspired` (three fixed types)
- Uniqueness: one reaction per user per feed item per type (enforced by composite doc ID)
- Batch fetching: reactions for all visible feed items fetched in a single batch read
- `FeedCard.tsx`: renders reaction buttons with counts, handles toggle
- Firestore rules: reaction writes require group membership verification

---

### 4.20 Comments/Replies

| Attribute | Value |
|---|---|
| Classification | **LEGACY/REMOVE** |
| Key Files | `src/services/feedCommentService.ts`, `src/hooks/useFeedComments.ts`, `src/features/Groups/FeedCommentSection.tsx`, `src/features/Groups/FeedCard.tsx` |
| Current Behaviour | Full comment/reply system: create, read, delete comments on feed items. Nested replies. UI rendering in FeedCommentSection. |
| V2 Target | Comments/replies EXCLUDED from initial V2 per T1 §Q and Notifications baseline §20. |
| Gap | Entire feature exists but should not exist in V2. |
| Recommended Change | **Full removal** — see removal inventory below. |
| Dependencies | None |
| Risk | Low — clean removal, no data migration needed |
| Migration Required? | No — existing comment data becomes orphaned (inert) |

**Removal Inventory:**

| Action | Target | Detail |
|---|---|---|
| DELETE | `src/services/feedCommentService.ts` | Entire file — comment CRUD service |
| DELETE | `src/hooks/useFeedComments.ts` | Entire file — comment React hook |
| DELETE | `src/features/Groups/FeedCommentSection.tsx` | Entire file — comment UI component |
| EDIT | `src/features/Groups/FeedCard.tsx` | Remove: `MessageSquare` import, `showComments` state, Reply button, `FeedCommentSection` render |
| EDIT | `firestore.rules` | Remove: comments/replies rule blocks (lines 514-545) |
| DELETE | `scripts/testGroupFeedCommentsGuards.ts` | Entire file — comment guard test script |

**Post-Removal State:**

- Existing comment/reply data in Firestore becomes orphaned (inert)
- No cleanup migration needed — orphaned data is never read after removal
- Firestore rules for comments become dead rules — safe to remove
- Guard script becomes irrelevant — safe to delete

---

### 4.21 Recognition

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `src/types/index.ts` (MilestoneType), `src/features/Groups/FeedCard.tsx` (MilestoneBadge) |
| Current Behaviour | Milestones exist as feed items only (generated by CF). No standalone Recognition service. No badge gallery. No user-level achievement collection. |
| V2 Target | Lean recognition model (T1 §U). Initial V2 doesn't require full badge system. |
| Gap | Full Recognition system (badge gallery, achievement collection) not implemented. |
| Recommended Change | For initial V2: milestone markers in feed are sufficient. Full Recognition system deferred to MOT-01 resolution. |
| Dependencies | MOT-01 resolution (deferred) |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `MilestoneType` in `src/types/index.ts`: defines milestone categories (25%, 50%, 75%, 100%)
- `MilestoneBadge` in `FeedCard.tsx`: renders milestone indicator on feed items
- Milestones generated by Cloud Functions during activity processing
- No user-facing badge gallery or achievement profile section
- MOT-01 (Recognition Authority) is deferred — full recognition system depends on its resolution
- For initial V2: feed-based milestone markers satisfy the lean recognition requirement

---

### 4.22 Support Tiizi

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `src/services/donationService.ts`, `src/features/Donate/DonateScreen.tsx` |
| Current Behaviour | Voluntary donation flow. Multi-currency (KES/RWF/UGX). Permanent Profile CTA. Two-step: intent → confirm. Tiizi does not hold funds. Admin confirmation/rejection workflow. |
| V2 Target | Voluntary platform support donation. Multi-currency. No fund custody. Admin workflow. |
| Gap | None. Donation system correctly implements V2 requirements. |
| Recommended Change | No change required. |
| Dependencies | None |
| Risk | Low |
| Migration Required? | No |

**Detail Notes:**

- `donationService.ts`: createDonationIntent, confirmDonation, rejectDonation, getDonationHistory
- `DonateScreen.tsx`: donation UI with currency selection, amount input, confirmation flow
- Currencies: KES (Kenya Shilling), RWF (Rwanda Franc), UGX (Uganda Shilling)
- Two-step flow: (1) user creates intent, (2) user confirms via mobile money prompt
- Tiizi does NOT hold funds — donations go directly to cause via mobile money
- Admin workflow: admin reviews intent, confirms or rejects
- Profile CTA: permanent "Support Tiizi" button in Profile screen

---

### 4.23 Social Cause Contribution/Reporting

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `src/services/donationService.ts` (ChallengeContributionPledge), `src/features/Challenges/components/ChallengeDonationSection.tsx` |
| Current Behaviour | Pledge tracking: pledged → confirmed (self-reported) → skipped. Challenge goes to draft+pending when donation enabled (approval gate). |
| V2 Target | Community-reported contributions with appropriate labeling. Approval gate for donation-enabled Challenges. |
| Gap 1 | No explicit "community-reported" vs "confirmed" distinction on pledge display. |
| Gap 2 | No dedicated admin UI for cause campaign approval (implicit via Challenge moderation). |
| Recommended Change | Add display label "Community-reported contributions" on pledge totals. This is a display/labeling change only. |
| Dependencies | None |
| Risk | Low — display/labeling change |
| Migration Required? | No |

**Detail Notes:**

- `ChallengeContributionPledge`: tracks member pledges to social cause within a Challenge
- Pledge states: `pledged` → `confirmed` (self-reported) | `skipped`
- `ChallengeDonationSection.tsx`: renders donation info within Challenge detail view
- Currently displays totals without distinguishing self-reported vs verified
- V2 requires clear labeling that contributions are community-reported (not verified by Tiizi)
- Change: add "Community-reported" label/badge on pledge total display

---

### 4.24 Notifications

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `src/services/notificationService.ts`, `src/features/Notifications/NotificationsScreen.tsx` |
| Current Behaviour | Stored as inline array on user document (max 100 items). Only manual Challenge reminders exist — no automatic notifications. |
| V2 Target | Member notifications for relevant events. |
| Gap | Acceptable for initial V2 at small scale. Scalability concern: full-doc read/write on every notification operation. |
| Recommended Change | For initial V2: acceptable as-is. Sub-collection migration is a future improvement (P4). |
| Dependencies | None |
| Risk | Medium (scalability at scale) |
| Migration Required? | No (for initial V2) |

**Detail Notes:**

- Notifications stored as `notifications: [...]` array field on user document
- Max 100 items (oldest dropped when limit exceeded)
- Every notification read/write requires full user document read/write
- At small scale (< 1000 concurrent users): acceptable performance
- At scale: becomes a hotspot — every notification triggers full user doc write
- Future improvement: migrate to `users/{userId}/notifications` subcollection
- This migration is P4 — not required for initial V2 correctness

---

### 4.25 Visibility/Privacy Enforcement

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `firestore.rules`, `src/services/groupService.ts`, `src/services/challengeService.ts` |
| Current Behaviour | Group/Challenge visibility: 4-layer defense (rules + client gate + discovery filter + query scoping). Profile privacy: UI-only enforcement — `privacySettings` stored but NOT enforced in Firestore rules. |
| V2 Target | Privacy enforced at data layer. Profile visibility controlled by member settings. |
| Gap | Any authenticated user can read any other user's full profile at the Firestore data layer. `privacySettings.isProfilePublic` is stored but not checked in rules. |
| Recommended Change | Add Firestore rule restricting user doc reads based on `profile.privacySettings.isProfilePublic`. Must preserve legitimate reads (group members seeing each other, admin access). |
| Dependencies | None |
| Risk | **Medium** — must not break existing legitimate reads (group members, admins, CF) |

**Current Rule Gap:**

```
// firestore.rules — current: any authenticated user can read any user doc
match /users/{userId} {
  allow read: if request.auth != null;  // ← too permissive
  allow write: if request.auth.uid == userId;
}
```

**Required Change (conceptual):**

```
// firestore.rules — proposed: respect privacy settings
match /users/{userId} {
  allow read: if request.auth != null && (
    // User can always read their own profile
    request.auth.uid == userId ||
    // Public profiles readable by all authenticated users
    get(/databases/(default)/documents/users/$(userId)).data.privacySettings.isProfilePublic == true ||
    // Group co-members can read each other's profiles
    isGroupCoMember(request.auth.uid, userId) ||
    // Admins can read all profiles
    isAdmin(request.auth.uid) ||
    // Cloud Functions (admin SDK) bypass rules
    false  // CF uses admin SDK, not affected by rules
  );
}
```

**Risk Mitigation:**

- Must define `isGroupCoMember()` helper function in rules
- Must test that group feed, Challenge views, and member lists still work
- Must test that admin operations are not affected
- Rollout: deploy rules change, monitor for access errors, adjust as needed

---

### 4.26 Historical Integrity/Corrections

| Attribute | Value |
|---|---|
| Classification | **REMEDIATION REQUIRED** |
| Key Files | `functions/src/memberActivitySummaries.ts`, `functions/src/memberUserMetrics.ts` |
| Current Behaviour | No `onDocumentUpdated` or `onDocumentDeleted` triggers for workouts/wellnessLogs. If a source log is edited/deleted: leaderboard scores stale, feed items stale, Challenge summaries stale, collective progress stale. |
| V2 Target | Derived state must remain consistent with source data. Edits/deletions to activity logs must propagate to all derived collections. |
| Gap | `rebuildUserMetricsForUser()` exists but only rebuilds `userMetrics`/`memberHome`, not leaderboards/feed/summaries. No delta-based correction for individual log changes. |
| Recommended Change | Add `onDocumentUpdated` and `onDocumentDeleted` triggers for `workouts` and `wellnessLogs` collections. Compute deltas and adjust derived collections (leaderboards, feed, summaries, collective progress). |
| Dependencies | None (but high implementation complexity) |
| Risk | **High** — must handle concurrent writes, delta computation, and idempotency |
| Migration Required? | **Yes** — existing stale data cannot be retroactively fixed without a full rebuild |

**Current Trigger Coverage:**

| Trigger | Collection | Event | Status |
|---|---|---|---|
| `onWorkoutCreated` | workouts | onCreate | EXISTS |
| `onWellnessLogCreated` | wellnessLogs | onCreate | EXISTS |
| — | workouts | onUpdate | **MISSING** |
| — | workouts | onDelete | **MISSING** |
| — | wellnessLogs | onUpdate | **MISSING** |
| — | wellnessLogs | onDelete | **MISSING** |

**Required Triggers:**

| Trigger | Collection | Event | Purpose |
|---|---|---|---|
| `onWorkoutUpdated` | workouts | onUpdate | Detect edits, compute delta, propagate |
| `onWorkoutDeleted` | workouts | onDelete | Remove contribution from all derived state |
| `onWellnessLogUpdated` | wellnessLogs | onUpdate | Detect edits, compute delta, propagate |
| `onWellnessLogDeleted` | wellnessLogs | onDelete | Remove contribution from all derived state |

**Affected Derived Collections (per log change):**

| Derived Collection | What Stales | Correction Needed |
|---|---|---|
| `challengeLeaderboards` | Member score/rank | Recompute member entry, re-sort |
| `groupLeaderboards` | Member score in group | Recompute member entry, re-sort |
| `challengeActivitySummaries` | Challenge total | Adjust by delta |
| `groupActivityFeed` | Feed item values | Update or remove feed item |
| Collective `groupCurrentTotal` | Group progress | Adjust by delta |
| `userMetrics` | User-level aggregates | Recompute (already partially handled) |
| `memberHome` | Home summary | Recompute (already partially handled) |

**Implementation Complexity:**

- Delta computation: old value vs new value → difference to propagate
- Concurrent writes: two edits to same log in quick succession → must be idempotent
- Feed item updates: may need to regenerate feed item text/content
- Leaderboard re-sorting: must be atomic to prevent rank flickering
- Full rebuild option: `rebuildUserMetricsForUser()` could be extended to cover all derived state, but this is expensive and not suitable for real-time correction

---

### 4.27 Admin Knowledge Management

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** (with KRC remediation items) |
| Key Files | `src/services/adminExerciseService.ts`, `src/services/adminWellnessActivityService.ts` |
| Current Behaviour | Full CRUD for both fitness and wellness catalogues. Admin-only access. |
| V2 Target | Admin-managed Knowledge (Activities) with lifecycle control. |
| Gap | From KRC: no lifecycle states (draft/published/retired), no version tracking, no approval workflow, deletion permitted (should be retirement). |
| Recommended Change | These are KRC remediation items — P1 priority. See §9 for sequencing. |
| Dependencies | KRC implementation |
| Risk | Medium — lifecycle changes affect Challenge creation and activity selection |
| Migration Required? | Possibly — existing activities need lifecycle state assignment |

**KRC Remediation Items:**

| Item | Current | Target (KRC) | Priority |
|---|---|---|---|
| Lifecycle states | None (all effectively "published") | draft / published / retired | P1 |
| Version tracking | None | Version number on each activity | P1 |
| Approval workflow | None (any admin can publish) | Draft → review → publish | P2 |
| Deletion | Hard delete permitted | Retirement only (soft delete) | P1 |
| Published-only access | All activities visible | Only published activities in runtime catalogue | P2 |

---

### 4.28 Firestore Security Rules

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `firestore.rules` (27 match blocks) |
| Current Behaviour | Well-structured: group membership gating, admin role checks, CF-only collections. |
| V2 Target | Complete data-layer enforcement of all V2 access patterns. |
| Gap 1 | Profile privacy not enforced (see 4.25). |
| Gap 2 | Derived collections (`challengeLeaderboards`, `groupLeaderboards`, etc.) lack explicit read rules. |
| Recommended Change | Add profile privacy rule (4.25). Add explicit rules for derived collections. |
| Dependencies | 4.25 profile privacy implementation |
| Risk | Medium — rules changes can break legitimate access if not tested |
| Migration Required? | No |

**Current Rules Coverage:**

| Collection | Read Rule | Write Rule | Status |
|---|---|---|---|
| users | Authenticated | Owner only | GAP (privacy) |
| groups | Authenticated + member | Owner/admin | ALIGNED |
| groupMembers | Group members | CF + owner | ALIGNED |
| challenges | Authenticated + group member | Authenticated (with validation) | ALIGNED |
| challengeMembers | Challenge members | Authenticated (participant) | ALIGNED |
| catalogExercises | Authenticated | Admin only | ALIGNED |
| wellnessActivities | Authenticated | Admin only | ALIGNED |
| workouts | Owner | Owner | ALIGNED |
| wellnessLogs | Owner | Owner | ALIGNED |
| groupActivityFeed | Group members | CF only | ALIGNED |
| groupActivityFeed/*/reactions | Group members | Group members | ALIGNED |
| groupActivityFeed/*/comments | Group members | Group members | LEGACY (remove) |
| challengeTemplates | Authenticated | Admin only | ALIGNED |
| wellnessTemplates | Authenticated | Admin only | ALIGNED |
| supportDonations | Owner | Owner + CF | ALIGNED |
| challengeContributionPledges | Challenge members | Challenge members | ALIGNED |
| challengeActivitySummaries | Group members | CF only | GAP (no explicit rule) |
| challengeLeaderboards | Group members | CF only | GAP (no explicit rule) |
| groupLeaderboards | Group members | CF only | GAP (no explicit rule) |
| groupMemberStats | Group members | CF only | GAP (no explicit rule) |
| userMetrics | Owner | CF only | GAP (no explicit rule) |
| memberHome | Owner | CF only | GAP (no explicit rule) |
| groupInvites | CF only | CF only | ALIGNED |
| groupJoinRequests | CF only + requester | CF only | ALIGNED |
| groupAuditLogs | Group admin | CF only | ALIGNED |
| systemLogs | Admin | CF only | ALIGNED |
| platformSettings | Admin | Admin only | ALIGNED |

---

### 4.29 Cloud Functions

| Attribute | Value |
|---|---|
| Classification | **ALIGNED** |
| Key Files | `functions/src/index.ts` + 5 supporting modules |
| Current Behaviour | 20+ functions: invite management, join requests, Challenge creation, metrics refresh, Challenge expiration, activity triggers, counter maintenance. Feed generation in `memberActivitySummaries.ts` is the heart of the Derived Truth layer. |
| V2 Target | Server-side compute for triggers, metrics, lifecycle, and feed generation. |
| Gap | None at the architectural level. Correction triggers (4.26) are additional functions needed. |
| Recommended Change | No change to existing functions. Add correction triggers (4.26). |
| Dependencies | 4.26 correction trigger design |
| Risk | Low (existing functions); High (new correction triggers) |
| Migration Required? | No |

**Detail Notes:**

- `functions/src/index.ts`: main entry point, exports all functions
- Supporting modules:
  - `functions/src/memberActivitySummaries.ts`: feed generation + Challenge summary updates
  - `functions/src/memberUserMetrics.ts`: user-level metrics aggregation
  - `functions/src/inviteManagement.ts`: group invite token lifecycle
  - `functions/src/joinRequestManagement.ts`: group join request lifecycle
  - `functions/src/challengeExpiration.ts`: scheduled Challenge expiration
- Well-structured with proper transaction use for atomic updates
- Feed generation is the most complex function — processes activity logs into feed items

---

### 4.30 Tests

| Attribute | Value |
|---|---|
| Classification | **PARTIALLY ALIGNED** |
| Key Files | `scripts/test*.ts` (56 guard scripts) |
| Current Behaviour | 56 guard scripts in `scripts/test*.ts`. Structural invariant checks (not unit tests). No unit test framework (no Jest/Vitest). No Firestore rules tests. No CF tests. No engine tests. |
| V2 Target | Adequate test coverage for V2 correctness validation. |
| Gap | No unit tests for engines, visibility, corrections, or Knowledge lifecycle. |
| Recommended Change | Add Vitest or similar unit test framework. Priority: engine unit tests (P1), Firestore rules tests (P1), CF tests for correction triggers (P5). Existing 56 guard scripts remain valid. |
| Dependencies | Test framework selection |
| Risk | Medium — untested engine changes carry regression risk |
| Migration Required? | No |

**Current Test Coverage:**

| Area | Guard Scripts | Unit Tests | Status |
|---|---|---|---|
| Feed | 14 | 0 | Guards only |
| Challenge | 7 | 0 | Guards only |
| Group | 5 | 0 | Guards only |
| Donation | 3 | 0 | Guards only |
| Exercise | 2 | 0 | Guards only |
| Admin | 2 | 0 | Guards only |
| Scoring | 1 | 0 | Guards only |
| Onboarding | 1 | 0 | Guards only |
| Collective | 2 | 0 | Guards only |
| Engines | 0 | 0 | **NOT COVERED** |
| Visibility | 0 | 0 | **NOT COVERED** |
| Corrections | 0 | 0 | **NOT COVERED** |
| Knowledge lifecycle | 0 | 0 | **NOT COVERED** |

**Required Test Additions:**

| Priority | Test Area | Framework | Purpose |
|---|---|---|---|
| P1 | Collective engine | Vitest | Verify no-clamping, completion detection |
| P1 | Competitive engine | Vitest | Verify shared positions, tie detection |
| P1 | Streak engine | Vitest | Verify ALL-daily-requirements check |
| P1 | Firestore rules (visibility) | Firestore Rules Unit Testing | Verify profile privacy enforcement |
| P5 | Correction triggers | Vitest + CF test helpers | Verify delta computation, idempotency |
| P5 | Knowledge lifecycle | Vitest | Verify state transitions |

---

## 5. Firestore/Data Mapping

### 5.1 Collection Inventory

| Collection | Purpose | Writer | V2 Status |
|---|---|---|---|
| `users` | Member accounts + profile | Client + CF | ALIGNED |
| `groups` | Group entities | Client | ALIGNED |
| `groupMembers` | Group membership | Client + CF | ALIGNED |
| `challenges` | Challenge entities | Client + CF | ALIGNED |
| `challengeMembers` | Challenge participation | Client + CF | ALIGNED |
| `catalogExercises` | Fitness Activity catalogue | Admin client | ALIGNED |
| `wellnessActivities` | Wellness Activity catalogue | Admin client | ALIGNED |
| `workouts` | Fitness activity logs | Client | ALIGNED |
| `wellnessLogs` | Wellness activity logs | Client | ALIGNED |
| `groupActivityFeed` | Group Feed items | CF only | ALIGNED |
| `groupActivityFeed/*/reactions` | Kudos/reactions | Client | ALIGNED |
| `groupActivityFeed/*/comments` | Comments | Client | **LEGACY/REMOVE** |
| `groupActivityFeed/*/comments/*/replies` | Comment replies | Client | **LEGACY/REMOVE** |
| `challengeTemplates` | Fitness Challenge templates | Admin client | ALIGNED |
| `wellnessTemplates` | Wellness Challenge templates | Admin client | ALIGNED |
| `supportDonations` | Platform support donations | Client + CF | ALIGNED |
| `supportDonationPreferences` | Per-user donation prefs | Client | ALIGNED |
| `challengeContributionPledges` | Social Cause pledges | Client | PARTIALLY ALIGNED |
| `challengeActivitySummaries` | Denormalized Challenge totals | CF only | ALIGNED |
| `challengeLeaderboards` | Denormalized leaderboard | CF only | PARTIALLY ALIGNED |
| `groupLeaderboards` | Denormalized group leaderboard | CF only | ALIGNED |
| `groupMemberStats` | Denormalized member stats | CF only | ALIGNED |
| `userMetrics` | Denormalized user metrics | CF only | ALIGNED |
| `memberHome` | Denormalized home summary | CF only | ALIGNED |
| `groupInvites` | Invite tokens | CF only | ALIGNED |
| `groupJoinRequests` | Join requests | CF only | ALIGNED |
| `groupAuditLogs` | Group admin audit | CF only | ALIGNED |
| `systemLogs` | Admin action logs | CF only | ALIGNED |
| `platformSettings` | Platform configuration | Admin only | ALIGNED |
| `donationCampaigns` | Admin donation campaigns | Admin only | ALIGNED |
| `donationTransactions` | Admin donation txns | Admin only | ALIGNED |

### 5.2 Collection Detail — Core Entities

#### users

| Field | Type | Notes |
|---|---|---|
| uid | string | Firebase Auth UID (document ID) |
| email | string | Auth email |
| displayName | string | Member name |
| bio | string | Optional bio |
| interests | string[] | Interest tags |
| goals | string[] | Goal tags |
| privacySettings | object | `{ isProfilePublic: boolean }` |
| createdAt | timestamp | Account creation |
| updatedAt | timestamp | Last profile update |
| notifications | array | Inline notification array (max 100) |

#### groups

| Field | Type | Notes |
|---|---|---|
| name | string | Group name |
| description | string | Group description |
| isPrivate | boolean | Privacy flag |
| ownerUid | string | Owner user ID |
| memberCount | number | Denormalized count |
| status | string | active / archived |
| createdAt | timestamp | Creation time |
| updatedAt | timestamp | Last update |

#### challenges

| Field | Type | Notes |
|---|---|---|
| type | string | collective / competitive / streak |
| engineVersion | string | Always 'v2' |
| status | string | draft / active / completed / expired |
| groupId | string | Parent group |
| createdBy | string | Creator UID |
| activityType | string | fitness / wellness |
| activitySnapshot | object | Copy of activity config at creation |
| groupCumulativeTarget | number | Collective target |
| durationDays | number | Streak duration |
| dailyRequirements | array | Streak daily config |
| donation | object? | Optional donation config |
| startDate | timestamp | Challenge start |
| endDate | timestamp | Challenge end |
| memberCount | number | Denormalized count |
| createdAt | timestamp | Creation time |

### 5.3 Collection Detail — Derived State

| Collection | Update Trigger | Update Method | Consistency |
|---|---|---|---|
| `challengeActivitySummaries` | Activity log created | CF trigger (onCreate) | Eventually consistent |
| `challengeLeaderboards` | Activity log created | CF trigger (onCreate) | Eventually consistent |
| `groupLeaderboards` | Activity log created | CF trigger (onCreate) | Eventually consistent |
| `groupMemberStats` | Activity log created | CF trigger (onCreate) | Eventually consistent |
| `userMetrics` | Activity log created | CF trigger (onCreate) | Eventually consistent |
| `memberHome` | Activity log created | CF trigger (onCreate) | Eventually consistent |
| `groupActivityFeed` | Activity log created | CF trigger (onCreate) | Eventually consistent |

**Consistency Note:** All derived collections are updated via Cloud Functions triggers. Updates are eventually consistent — there is a brief window between activity log creation and derived state update. This is acceptable for the Tiizi use case (social fitness, not financial transactions).

---

## 6. Cloud Functions Mapping

### 6.1 Function Inventory

| Function Name | Trigger | Purpose | V2 Status |
|---|---|---|---|
| `onWorkoutCreated` | `workouts` onCreate | Process fitness log → engines → derived state | ALIGNED |
| `onWellnessLogCreated` | `wellnessLogs` onCreate | Process wellness log → engines → derived state | ALIGNED |
| `onChallengeCreated` | Callable HTTPS | Validate and create Challenge | ALIGNED |
| `onGroupInviteCreated` | `groupInvites` onCreate | Send invite notification | ALIGNED |
| `onGroupInviteAccepted` | Callable HTTPS | Process invite acceptance | ALIGNED |
| `onGroupInviteExpired` | Scheduled | Clean up expired invites | ALIGNED |
| `onJoinRequestCreated` | `groupJoinRequests` onCreate | Notify group owner | ALIGNED |
| `onJoinRequestProcessed` | Callable HTTPS | Accept/reject join request | ALIGNED |
| `generateFeedItems` | `workouts`/`wellnessLogs` onCreate | Generate group feed items | ALIGNED |
| `updateChallengeSummaries` | `workouts`/`wellnessLogs` onCreate | Update Challenge activity summaries | ALIGNED |
| `updateLeaderboards` | `workouts`/`wellnessLogs` onCreate | Update Challenge/group leaderboards | ALIGNED |
| `updateUserMetrics` | `workouts`/`wellnessLogs` onCreate | Update user-level metrics | ALIGNED |
| `updateMemberHome` | `workouts`/`wellnessLogs` onCreate | Update member home summary | ALIGNED |
| `expireChallenges` | Scheduled (daily) | Expire past-due Challenges | ALIGNED |
| `maintainCounters` | Scheduled (periodic) | Reconcile denormalized counters | ALIGNED |
| `rebuildUserMetrics` | Callable HTTPS (admin) | Full rebuild of user metrics | ALIGNED |
| `processDonationIntent` | `supportDonations` onCreate | Process donation intent | ALIGNED |
| `confirmDonation` | Callable HTTPS | Admin confirms donation | ALIGNED |
| `rejectDonation` | Callable HTTPS | Admin rejects donation | ALIGNED |
| `onGroupMemberAdded` | `groupMembers` onCreate | Update counters, notify | ALIGNED |
| `onGroupMemberRemoved` | `groupMembers` onDelete | Update counters | ALIGNED |
| `auditLog` | Callable HTTPS (admin) | Write system audit log | ALIGNED |

### 6.2 Missing Functions (Required for V2)

| Function Name | Trigger | Purpose | Priority |
|---|---|---|---|
| `onWorkoutUpdated` | `workouts` onUpdate | Correction trigger for fitness log edits | P5 |
| `onWorkoutDeleted` | `workouts` onDelete | Correction trigger for fitness log deletions | P5 |
| `onWellnessLogUpdated` | `wellnessLogs` onUpdate | Correction trigger for wellness log edits | P5 |
| `onWellnessLogDeleted` | `wellnessLogs` onDelete | Correction trigger for wellness log deletions | P5 |

### 6.3 Function Dependency Graph

```
Activity Log (workouts/wellnessLogs)
  │
  ├── onCreate ──→ Engine Processing
  │                  │
  │                  ├──→ challengeActivitySummaries (update totals)
  │                  ├──→ challengeLeaderboards (update member score)
  │                  ├──→ groupLeaderboards (update member score)
  │                  ├──→ groupMemberStats (update member stats)
  │                  ├──→ userMetrics (update user aggregates)
  │                  ├──→ memberHome (update home summary)
  │                  └──→ groupActivityFeed (generate feed items)
  │
  ├── onUpdate ──→ [MISSING] Correction Processing
  │                  │
  │                  ├──→ (same derived collections, delta-adjusted)
  │
  └── onDelete ──→ [MISSING] Correction Processing
                     │
                     ├──→ (same derived collections, contribution removed)
```

---

## 7. Security/Rules Mapping

### 7.1 Rules Architecture

| Aspect | Current State | V2 Target | Gap |
|---|---|---|---|
| Authentication | Firebase Auth required for all reads/writes | Same | None |
| Admin detection | Custom claims or role field | Same | None |
| Group membership gating | `groupMembers` lookup in rules | Same | None |
| CF-only collections | Write rules deny client writes | Same | None |
| Profile privacy | NOT enforced in rules | Enforce `isProfilePublic` | **GAP** |
| Derived collection reads | No explicit rules | Explicit group-member-only rules | **GAP** |
| Comment/reply rules | Full CRUD rules exist | REMOVE (feature excluded) | **LEGACY** |

### 7.2 Rules Gap Detail

#### Gap 1: Profile Privacy

**Current:** Any authenticated user can read any user document.

**Required:** Respect `privacySettings.isProfilePublic` — non-public profiles readable only by:
- The user themselves
- Group co-members (members of the same group)
- Administrators
- Cloud Functions (admin SDK bypass)

**Risk:** Medium — incorrect rule can break group feed, member lists, Challenge views.

#### Gap 2: Derived Collection Rules

**Current:** Derived collections (`challengeLeaderboards`, `groupLeaderboards`, `challengeActivitySummaries`, etc.) have no explicit read rules. They may fall through to a default allow or deny.

**Required:** Explicit read rules for each derived collection:
- `challengeLeaderboards`: readable by group members (via Challenge → group membership)
- `groupLeaderboards`: readable by group members
- `challengeActivitySummaries`: readable by group members
- `groupMemberStats`: readable by group members
- `userMetrics`: readable by owner only
- `memberHome`: readable by owner only

**Risk:** Low — adding explicit rules is additive, not restrictive (if default is allow).

### 7.3 Rules Block Summary

| Match Block | Lines (approx) | Purpose | V2 Action |
|---|---|---|---|
| `match /users/{userId}` | 1-30 | User profile access | EDIT (add privacy check) |
| `match /groups/{groupId}` | 31-60 | Group entity access | None |
| `match /groups/{groupId}/members/{memberId}` | 61-90 | Membership access | None |
| `match /challenges/{challengeId}` | 91-130 | Challenge access | None |
| `match /challenges/{challengeId}/members/{memberId}` | 131-160 | Participation access | None |
| `match /catalogExercises/{exerciseId}` | 161-180 | Fitness catalogue | None |
| `match /wellnessActivities/{activityId}` | 181-200 | Wellness catalogue | None |
| `match /workouts/{workoutId}` | 201-220 | Fitness logs | None |
| `match /wellnessLogs/{logId}` | 221-240 | Wellness logs | None |
| `match /groupActivityFeed/{feedId}` | 241-280 | Feed items | None |
| `match /groupActivityFeed/{feedId}/reactions/{reactionId}` | 281-310 | Reactions | None |
| `match /groupActivityFeed/{feedId}/comments/{commentId}` | 311-340 | Comments | **REMOVE** |
| `match /groupActivityFeed/{feedId}/comments/{commentId}/replies/{replyId}` | 341-370 | Replies | **REMOVE** |
| `match /challengeTemplates/{templateId}` | 371-390 | Fitness templates | None |
| `match /wellnessTemplates/{templateId}` | 391-410 | Wellness templates | None |
| `match /supportDonations/{donationId}` | 411-440 | Donations | None |
| `match /supportDonationPreferences/{prefId}` | 441-460 | Donation prefs | None |
| `match /challengeContributionPledges/{pledgeId}` | 461-480 | Cause pledges | None |
| `match /challengeActivitySummaries/{summaryId}` | 481-500 | Challenge summaries | ADD explicit rule |
| `match /challengeLeaderboards/{entryId}` | 501-513 | Leaderboard entries | ADD explicit rule |
| Comments/replies rules | 514-545 | Comment CRUD | **REMOVE** |
| `match /groupLeaderboards/{entryId}` | 546-560 | Group leaderboard | ADD explicit rule |
| `match /groupMemberStats/{statId}` | 561-580 | Member stats | ADD explicit rule |
| `match /userMetrics/{metricId}` | 581-600 | User metrics | ADD explicit rule |
| `match /memberHome/{homeId}` | 601-620 | Home summary | ADD explicit rule |
| `match /groupInvites/{inviteId}` | 621-650 | Invites | None |
| `match /groupJoinRequests/{requestId}` | 651-680 | Join requests | None |
| `match /groupAuditLogs/{logId}` | 681-700 | Audit logs | None |
| `match /systemLogs/{logId}` | 701-720 | System logs | None |
| `match /platformSettings/{settingId}` | 721-740 | Platform config | None |
| `match /donationCampaigns/{campaignId}` | 741-760 | Campaigns | None |
| `match /donationTransactions/{txnId}` | 761-780 | Transactions | None |

---

## 8. Removal/Deprecation Map

### 8.1 Items to Remove for Initial V2

| Item | Type | Files | Action | Risk | Notes |
|---|---|---|---|---|---|
| Comments/replies feature | Feature | `src/services/feedCommentService.ts` | DELETE | Low | Entire file |
| Comments hook | Feature | `src/hooks/useFeedComments.ts` | DELETE | Low | Entire file |
| Comment section UI | Feature | `src/features/Groups/FeedCommentSection.tsx` | DELETE | Low | Entire file |
| Comment UI in FeedCard | Feature | `src/features/Groups/FeedCard.tsx` | EDIT | Low | Remove MessageSquare import, showComments state, Reply button, FeedCommentSection render |
| Comments Firestore rules | Rules | `firestore.rules` lines 514-545 | REMOVE | Low | Comment/reply match blocks |
| Comments guard script | Test | `scripts/testGroupFeedCommentsGuards.ts` | DELETE | Low | Entire file |
| Streak leaderboard view | Feature | `src/features/Challenges/ChallengeLeaderboardScreen.tsx` | REMOVE/REPLACE | Low | Remove streak-specific tab; replace with summary |
| Streak leaderboard sort | Feature | `src/utils/leaderboardSort.ts` (streak branch) | REMOVE | Low | Remove streak-specific sorting logic |
| Post composer placeholder | UI | `src/features/Groups/GroupFeedScreen.tsx` lines 89-95 | HIDE | Low | Comment out or conditional render |
| `verified: false` field | Dead code | `src/services/workoutService.ts` line 220 | DOCUMENT | Low | Mark as reserved for ACT-03 |

### 8.2 Removal Execution Order

| Step | Action | Rationale |
|---|---|---|
| 1 | DELETE `feedCommentService.ts` | Remove service layer first |
| 2 | DELETE `useFeedComments.ts` | Remove hook (depends on service) |
| 3 | DELETE `FeedCommentSection.tsx` | Remove component (depends on hook) |
| 4 | EDIT `FeedCard.tsx` | Remove component references |
| 5 | EDIT `firestore.rules` | Remove comment/reply match blocks |
| 6 | DELETE `testGroupFeedCommentsGuards.ts` | Remove now-irrelevant test |
| 7 | EDIT `ChallengeLeaderboardScreen.tsx` | Remove streak leaderboard view |
| 8 | EDIT `leaderboardSort.ts` | Remove streak sort branch |
| 9 | EDIT `GroupFeedScreen.tsx` | Hide post composer placeholder |
| 10 | EDIT `workoutService.ts` | Add comment documenting `verified` as reserved |

### 8.3 Data Impact of Removals

| Removed Item | Orphaned Data | Cleanup Needed? |
|---|---|---|
| Comments/replies | `groupActivityFeed/*/comments` documents | No — inert, never read |
| Streak leaderboard | No data impact (display-only) | No |
| Post composer | No data impact (UI-only) | No |
| `verified` field | `verified: false` on existing workout docs | No — inert field |

---

## 9. Required Implementation Changes

### 9.1 P0 — Correctness Blockers

> These changes are required for V2 to be functionally correct. Without these, the product does not match its own contracts.

| # | Change | Area | Files | Effort | Risk |
|---|---|---|---|---|---|
| 1 | Streak engine: enforce ALL daily requirements | 4.15 | `src/services/challengeEngine/streakEngine.ts` | Medium | Medium |
| 2 | Remove streak leaderboard | 4.15 | `ChallengeLeaderboardScreen.tsx`, `leaderboardSort.ts` | Low | Low |
| 3 | Remove comments/replies | 4.20 | See removal inventory (8.1) | Low | Low |
| 4 | Collective: remove 100% clamping | 4.13 | `src/services/challengeEngine/collectiveEngine.ts` | Low | Low |

**P0 Total Estimated Effort:** 2-3 developer-days

**P0 Dependencies:** None — all four changes are independent.

**P0 Verification:**

| Change | Verification Method |
|---|---|
| Streak ALL-daily-requirements | Unit test: log 1 of 2 required activities → streak does NOT advance. Log both → streak advances. |
| Remove streak leaderboard | Visual: no streak leaderboard tab in Challenge detail |
| Remove comments/replies | Visual: no comment UI in feed. Rules test: comment writes denied. |
| Collective no-clamping | Unit test: contribute beyond target → total exceeds target, completion detected. |

### 9.2 P1 — Core V2 Domain Alignment

> These changes bring the product into full alignment with V2 contracts. Important but not blocking basic correctness.

| # | Change | Area | Files | Effort | Risk |
|---|---|---|---|---|---|
| 5 | Competitive: shared positions for ties | 4.14 | `src/utils/leaderboardSort.ts` | Low | Low |
| 6 | Social Cause: "community-reported" labeling | 4.23 | `ChallengeDonationSection.tsx` | Low | Low |
| 7 | Knowledge lifecycle states (draft/published/retired) | 4.27/KRC | `adminExerciseService.ts`, `adminWellnessActivityService.ts`, `catalogExercises`, `wellnessActivities` | Medium | Medium |
| 8 | Activity version tracking | 4.27/KRC | Same as #7 | Medium | Medium |

**P1 Total Estimated Effort:** 3-5 developer-days

**P1 Dependencies:**

- #7 and #8 are related (both KRC items) — implement together
- #5 and #6 are independent

**P1 Verification:**

| Change | Verification Method |
|---|---|
| Shared positions | Unit test: two members with same score → same rank, next rank skips. |
| Community-reported label | Visual: "Community-reported" text on pledge totals |
| Lifecycle states | Unit test: draft → published → retired transitions. Integration: only published activities appear in runtime catalogue. |
| Version tracking | Unit test: activity update increments version. Challenge snapshot retains original version. |

### 9.3 P2 — Knowledge Runtime Alignment

> These changes implement the Knowledge Runtime Contract requirements. Important for Knowledge integrity but can follow initial V2 launch.

| # | Change | Area | Files | Effort | Risk |
|---|---|---|---|---|---|
| 9 | Published-only Runtime Catalogue access | 4.27/KRC | `exerciseService.ts`, `wellnessActivityService.ts` | Low | Low |
| 10 | Retirement over deletion for Activities | 4.27/KRC | `adminExerciseService.ts`, `adminWellnessActivityService.ts` | Low | Low |
| 11 | Fitness snapshot completeness at Challenge creation | 4.27/KRC | `challengeService.ts` (createChallenge) | Low | Low |

**P2 Total Estimated Effort:** 1-2 developer-days

### 9.4 P3 — Feed/Social Cleanup

> Cosmetic and cleanup items. No functional impact.

| # | Change | Area | Files | Effort | Risk |
|---|---|---|---|---|---|
| 12 | Hide post composer placeholder | 4.18 | `GroupFeedScreen.tsx` | Low | Low |
| 13 | Clean up orphaned comment data (optional) | 4.20 | Script / CF | Low | Low |

**P3 Total Estimated Effort:** < 1 developer-day

### 9.5 P4 — Contribution/Notification Alignment

> Important for privacy and scalability but not blocking initial V2 correctness.

| # | Change | Area | Files | Effort | Risk |
|---|---|---|---|---|---|
| 14 | Profile privacy enforcement in Firestore rules | 4.25 | `firestore.rules` | Medium | Medium |
| 15 | Notification sub-collection migration | 4.24 | `notificationService.ts`, `firestore.rules`, CF | High | High |

**P4 Total Estimated Effort:** 3-5 developer-days

**P4 Notes:**

- #14 should be done before scaling beyond small groups
- #15 is a future improvement — not required for initial V2

### 9.6 P5 — Hardening

> Robustness and data integrity improvements. Important for production quality but can follow initial V2 launch.

| # | Change | Area | Files | Effort | Risk |
|---|---|---|---|---|---|
| 16 | Correction/audit triggers for activity logs | 4.26 | `functions/src/` (4 new functions) | High | High |
| 17 | Unit test framework + engine tests | 4.30 | `vitest.config.ts`, `src/services/challengeEngine/*.test.ts` | Medium | Low |
| 18 | Firestore rules tests | 4.30 | `firestore.rules.test.ts` | Medium | Low |
| 19 | Type definitions for CF-managed collections | 4.30 | `src/types/` | Low | Low |

**P5 Total Estimated Effort:** 5-8 developer-days

**P5 Notes:**

- #16 is the highest-risk item — requires careful delta computation and concurrency handling
- #17 and #18 should be done BEFORE #16 to enable test-driven development of correction triggers

---

## 10. Migration Implications

### 10.1 Migration Summary

| Change | Migration Required? | Type | Scope | Risk |
|---|---|---|---|---|
| Streak engine fix (P0#1) | **Possibly** | Recalculation | Existing streak data may be inflated | Medium |
| Remove clamping (P0#4) | No | Forward-looking | Existing data unaffected | Low |
| Shared positions (P1#5) | No | Display-layer | Ranks recalculated on next read | Low |
| Comments removal (P0#3) | No | Orphaned data | Existing comments become inert | Low |
| Correction triggers (P5#16) | **Yes** | Full rebuild | Existing stale data cannot be fixed incrementally | High |
| Profile privacy rules (P4#14) | No | Rules-only | No data change | Low |
| Knowledge lifecycle (P1#7) | **Possibly** | State assignment | Existing activities need initial state | Low |
| Notification migration (P4#15) | **Yes** | Data migration | Inline array → subcollection | Medium |

### 10.2 Migration Detail

#### Streak Data Recalculation (P0#1)

- **Problem:** Existing streaks were calculated under single-log-advances rule
- **Impact:** Some streaks may be inflated (days counted where not all requirements were met)
- **Options:**
  - (a) Reset all streaks to 0 — simplest, loses history
  - (b) Recalculate from source logs — accurate, expensive
  - (c) Apply new rules prospectively only — simplest, accepts discrepancy
- **Recommendation:** Option (c) for initial V2. Document the discrepancy. Apply new rules to streak days going forward.

#### Correction Trigger Full Rebuild (P5#16)

- **Problem:** Existing derived state may be stale due to past edits/deletions
- **Impact:** Leaderboard scores, feed items, summaries may not match source logs
- **Approach:** Full rebuild using extended `rebuildUserMetricsForUser()` pattern
- **Scope:** All derived collections for all active Challenges
- **Recommendation:** Defer to P5. Not required for initial V2 correctness.

#### Knowledge Lifecycle State Assignment (P1#7)

- **Problem:** Existing activities have no lifecycle state
- **Impact:** Without state assignment, all activities are effectively "published"
- **Approach:** Migration script sets `lifecycleState: 'published'` on all existing activities
- **Scope:** `catalogExercises` and `wellnessActivities` collections
- **Recommendation:** Simple migration script, run once before P1#7 feature goes live.

#### Notification Sub-collection Migration (P4#15)

- **Problem:** Notifications stored as inline array on user document
- **Impact:** Full-doc read/write on every notification operation
- **Approach:** Migrate `user.notifications[]` → `users/{uid}/notifications/{notifId}`
- **Scope:** All user documents with non-empty notifications arrays
- **Recommendation:** Defer to P4. Requires CF migration function + rules update + client code change.

### 10.3 Non-Migrations (Confirmed)

| Item | Why No Migration Needed |
|---|---|
| Collective clamping removal | Forward-looking — existing Challenges at <100% unaffected, existing Challenges at 100% already complete |
| Shared positions | Display-layer only — ranks recalculated on each leaderboard read |
| Comment removal | Orphaned data is never read — no cleanup needed |
| Community-reported labeling | Display-only change — no data structure change |
| Profile privacy rules | Rules-only change — no data structure change |

---

## 11. Test Implications

### 11.1 Current Test State

- **56 guard scripts** in `scripts/test*.ts` — structural invariant checks
- **No unit test framework** — no Jest, Vitest, or similar
- **No Firestore rules tests** — rules validated manually
- **No Cloud Functions tests** — CF validated via guard scripts
- **No engine tests** — engines validated implicitly through guard scripts

### 11.2 Required Test Additions

| Priority | Test Area | Framework | Files to Create | Effort |
|---|---|---|---|---|
| **P1** | Collective engine | Vitest | `src/services/challengeEngine/collectiveEngine.test.ts` | 1 day |
| **P1** | Competitive engine | Vitest | `src/services/challengeEngine/competitiveEngine.test.ts` | 1 day |
| **P1** | Streak engine | Vitest | `src/services/challengeEngine/streakEngine.test.ts` | 1 day |
| **P1** | Firestore rules (visibility) | @firebase/rules-unit-testing | `tests/firestore/rules/profilePrivacy.test.ts` | 1 day |
| P5 | Correction triggers | Vitest + CF helpers | `functions/src/correctionTriggers.test.ts` | 2 days |
| P5 | Knowledge lifecycle | Vitest | `src/services/adminExerciseService.test.ts` | 1 day |
| P5 | Firestore rules (derived) | @firebase/rules-unit-testing | `tests/firestore/rules/derivedCollections.test.ts` | 1 day |

### 11.3 Test Framework Setup

**Recommended Framework:** Vitest

**Rationale:**
- Native TypeScript support (no transpilation step)
- Vite integration (same toolchain as build)
- Fast execution (parallel by default)
- Compatible with existing project structure

**Setup Steps:**

1. `npm install -D vitest @firebase/rules-unit-testing`
2. Create `vitest.config.ts` at project root
3. Create test directories: `src/services/challengeEngine/__tests__/`, `tests/firestore/rules/`
4. Add `test` script to `package.json`
5. Write engine tests first (P1)

### 11.4 Engine Test Cases

#### Collective Engine Tests

| Test Case | Input | Expected Output |
|---|---|---|
| Basic contribution | 10 units toward 100 target | groupCurrentTotal = 10, not complete |
| Exact completion | Contribution brings total to exactly target | groupCurrentTotal = target, complete = true |
| **Exceeding target (NEW)** | Contribution beyond target | groupCurrentTotal > target, complete = true |
| Multiple contributors | 5 members each contributing | Totals accumulate correctly |
| Zero contribution | 0-value log | No change to totals |

#### Competitive Engine Tests

| Test Case | Input | Expected Output |
|---|---|---|
| Basic scoring | Activity log with points | Member score updated |
| Completion detection | Score reaches target | Member status = completed |
| No effect on others | One member scores | Other members unaffected |

#### Streak Engine Tests

| Test Case | Input | Expected Output |
|---|---|---|
| Single requirement, logged | 1 of 1 daily req done | Streak advances |
| **Multiple requirements, partial (NEW)** | 1 of 2 daily reqs done | Streak does NOT advance |
| **Multiple requirements, all done (NEW)** | 2 of 2 daily reqs done | Streak advances |
| Same-day duplicate | Second log same day | Streak does NOT advance again |
| Gap day | No log for a day | Streak resets to 0 |
| Rejoin after leave | User rejoins Challenge | Streak state reset |

### 11.5 Existing Guard Scripts (Retained)

All 56 existing guard scripts remain valid and should continue to run as part of the development workflow:

| Category | Count | Examples |
|---|---|---|
| Feed guards | 14 | Feed item structure, reaction uniqueness, milestone thresholds |
| Challenge guards | 7 | Challenge state transitions, engine version, activity snapshot |
| Group guards | 5 | Membership integrity, role validation, privacy filtering |
| Donation guards | 3 | Donation intent structure, currency validation |
| Exercise guards | 2 | Catalogue structure, scoring config |
| Admin guards | 2 | Admin role checks, audit log structure |
| Scoring guards | 1 | Proportional capped scoring validation |
| Onboarding guards | 1 | Profile completeness checks |
| Collective guards | 2 | Collective state transitions, target validation |

---

## 12. Prioritized Implementation Sequence

### Wave 0: Foundation (Pre-implementation)

| Step | Action | Duration |
|---|---|---|
| 0.1 | Set up Vitest + test framework | 0.5 day |
| 0.2 | Write engine test skeletons (empty tests, verify framework works) | 0.5 day |

### Wave 1: P0 — Correctness Blockers

| Step | Action | Duration | Dependencies |
|---|---|---|---|
| 1.1 | Remove comments/replies (4.20) | 0.5 day | None |
| 1.2 | Remove streak leaderboard (4.15 gap 2) | 0.5 day | None |
| 1.3 | Collective: remove 100% clamping (4.13) | 0.5 day | None |
| 1.4 | Streak engine: enforce ALL daily requirements (4.15 gap 1) | 1 day | None |
| 1.5 | Write/update engine tests for P0 changes | 1 day | 1.3, 1.4 |
| 1.6 | Verification pass — run all guards + new tests | 0.5 day | 1.1-1.5 |

**Wave 1 Total: 4 developer-days**

### Wave 2: P1 — Core V2 Domain Alignment

| Step | Action | Duration | Dependencies |
|---|---|---|---|
| 2.1 | Competitive: shared positions for ties (4.14) | 0.5 day | None |
| 2.2 | Social Cause: "community-reported" labeling (4.23) | 0.5 day | None |
| 2.3 | Knowledge lifecycle states (4.27/KRC) | 2 days | None |
| 2.4 | Activity version tracking (4.27/KRC) | 1 day | 2.3 |
| 2.5 | Migration script: assign lifecycle states to existing activities | 0.5 day | 2.3 |
| 2.6 | Write tests for P1 changes | 1 day | 2.1-2.4 |

**Wave 2 Total: 5.5 developer-days**

### Wave 3: P2 — Knowledge Runtime Alignment

| Step | Action | Duration | Dependencies |
|---|---|---|---|
| 3.1 | Published-only Runtime Catalogue access | 0.5 day | 2.3 (lifecycle states) |
| 3.2 | Retirement over deletion | 0.5 day | 2.3 |
| 3.3 | Fitness snapshot completeness | 0.5 day | None |

**Wave 3 Total: 1.5 developer-days**

### Wave 4: P3 — Feed/Social Cleanup

| Step | Action | Duration | Dependencies |
|---|---|---|---|
| 4.1 | Hide post composer placeholder | 0.25 day | None |
| 4.2 | Optional: clean up orphaned comment data | 0.5 day | 1.1 (comments removed) |

**Wave 4 Total: 0.75 developer-days**

### Wave 5: P4 — Contribution/Notification Alignment

| Step | Action | Duration | Dependencies |
|---|---|---|---|
| 5.1 | Profile privacy enforcement in Firestore rules | 1.5 days | None |
| 5.2 | Firestore rules tests for privacy | 1 day | 5.1 |
| 5.3 | Notification sub-collection migration (future) | 3 days | None |

**Wave 5 Total: 5.5 developer-days** (5.3 is optional for initial V2)

### Wave 6: P5 — Hardening

| Step | Action | Duration | Dependencies |
|---|---|---|---|
| 6.1 | Firestore rules tests (derived collections) | 1 day | None |
| 6.2 | Type definitions for CF-managed collections | 0.5 day | None |
| 6.3 | Correction/audit triggers — design | 1 day | None |
| 6.4 | Correction/audit triggers — implementation | 3 days | 6.3 |
| 6.5 | Correction triggers — tests | 2 days | 6.4 |
| 6.6 | Full rebuild of derived state (one-time) | 1 day | 6.4 |

**Wave 6 Total: 8.5 developer-days**

### Total Implementation Estimate

| Wave | Priority | Duration | Cumulative |
|---|---|---|---|
| Wave 0 | Foundation | 1 day | 1 day |
| Wave 1 | P0 Correctness | 4 days | 5 days |
| Wave 2 | P1 Domain | 5.5 days | 10.5 days |
| Wave 3 | P2 Knowledge | 1.5 days | 12 days |
| Wave 4 | P3 Cleanup | 0.75 days | 12.75 days |
| Wave 5 | P4 Privacy/Notif | 2.5 days (excl. notif migration) | 15.25 days |
| Wave 6 | P5 Hardening | 8.5 days | 23.75 days |

**Initial V2 (Waves 0-4): ~13 developer-days**
**Full V2 + Hardening (Waves 0-6): ~24 developer-days**

---

## 13. Material Blockers

### Assessment

| Potential Blocker | Assessment | Resolution |
|---|---|---|
| Contradictory target behaviour | None found | V2 contracts are internally consistent |
| Data model incompatibility | None found | Existing model supports V2 with minor adjustments |
| Security conflict | Profile privacy gap (4.25) | Safe remediation path identified |
| Unavoidable destructive migration | None | All changes are forward-looking or non-destructive |
| Unresolved authority needed | ACT-03, ACT-04, MOT-01 deferred | Deferrals do not block initial V2 |
| Technology contradiction | None | Firebase retained per MTAIP-001, no conflict |
| Engine architecture conflict | None | Pure-function engines correctly separated |
| Missing critical dependency | None | All changes are self-contained |

### Blocker Conclusion

**NO MATERIAL BLOCKER.**

All identified gaps have safe implementation paths. No gap requires a Founder product decision that hasn't already been made in the Stage F contracts. No gap introduces irreconcilable technical debt. No gap requires infrastructure changes outside the MTAIP-001 policy.

---

## 14. Stage F Readiness Conclusion

### Deliverable Status

Stage F technical translation has produced all five required deliverables:

| # | Deliverable | Status | Document |
|---|---|---|---|
| 1 | Functional Requirements (T2) | **DRAFT** | STAGE-F-TIIZI-V2-FUNCTIONAL-REQUIREMENTS-DRAFT.md |
| 2 | Canonical Information Contract (CIC) | **DRAFT** | STAGE-F-TIIZI-V2-CANONICAL-INFORMATION-CONTRACT-DRAFT.md |
| 3 | Calculation & Derived Truth (T1 Part M) | **DRAFT** | STAGE-F-TIIZI-V2-CALCULATION-DERIVED-TRUTH-DRAFT.md |
| 4 | Knowledge Runtime Contract (KRC) | **DRAFT** | STAGE-F-TIIZI-V2-KNOWLEDGE-RUNTIME-CONTRACT-DRAFT.md |
| 5 | Technical Architecture Mapping (this document) | **DRAFT** | STAGE-F-TIIZI-V2-TECHNICAL-ARCHITECTURE-MAPPING-DRAFT.md |

### Codebase Alignment Summary

| Classification | Count | Areas |
|---|---|---|
| ALIGNED | 16 | 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 4.9, 4.10, 4.11, 4.12, 4.16, 4.17, 4.19, 4.22, 4.29 |
| PARTIALLY ALIGNED | 8 | 4.13, 4.14, 4.15, 4.21, 4.23, 4.24, 4.25, 4.28, 4.30 |
| REMEDIATION REQUIRED | 1 | 4.26 |
| LEGACY/REMOVE | 1 | 4.20 |
| FUTURE | 1 | 4.18 |
| MISSING | 0 | — |

### Change Summary

| Category | Count | Items |
|---|---|---|
| P0 Correctness Blockers | 4 | Streak ALL-daily, remove streak LB, remove comments, remove clamping |
| P1 Domain Alignment | 4 | Shared positions, cause labeling, lifecycle states, version tracking |
| P2 Knowledge Runtime | 3 | Published-only access, retirement, snapshot completeness |
| P3 Feed Cleanup | 2 | Hide composer, orphan cleanup |
| P4 Privacy/Notification | 2 | Profile privacy rules, notification migration |
| P5 Hardening | 4 | Correction triggers, unit tests, rules tests, type definitions |
| **Total Changes** | **19** | |

### Key Findings

1. **The existing codebase is substantially aligned with V2.** 16 of 30 areas are fully ALIGNED. The architecture decisions made during initial development (pure-function engines, copy-at-creation, CF-driven feed, composite doc IDs) are well-suited to V2 requirements.

2. **The three challenge engines are correctly structured.** Pure-function, v2-only, separated from UI and persistence. Individual engine logic gaps (clamping, streak requirements, shared positions) are bounded and fixable without architectural changes.

3. **The largest technical risk is correction triggers (4.26).** This is the only REMEDIATION REQUIRED area. It requires new Cloud Functions with delta computation, concurrent write handling, and idempotency. However, it is P5 priority — not required for initial V2 correctness.

4. **No infrastructure migration is needed.** Firebase retained per MTAIP-001. No contradictory technical requirements. No scalability blocker at initial V2 scale.

5. **Deferred authorities (ACT-03, ACT-04, MOT-01) do not block initial V2.** The `verified` field is documented as reserved. Recognition is lean (feed milestones only). Corrections are self-service (member edits their own logs).

6. **Comments/replies removal is clean.** No data migration needed. Orphaned data is inert. Six files affected (4 deletes, 2 edits).

### Conclusion

**Stage F technical translation is complete.** All five deliverables have been produced in DRAFT status. The existing codebase is substantially aligned with V2 product contracts. The implementation gaps identified are bounded, have safe remediation paths, and do not require new Founder product decisions.

**NO MATERIAL BLOCKER — Stage F technical translation complete; proceed to Founder review and implementation planning.**

---

> **DOCUMENT STATUS: DRAFT — Pending Founder Review**
>
> This Technical Architecture Mapping is a DRAFT deliverable of Stage F. It maps the existing
> codebase against V2 product contracts but does not authorize implementation. Implementation
> authority requires Founder review closure (ACT-01) and transition to the implementation stage.
>
> All findings are based on code analysis as of 2026-09-05. Code changes after this date may
> affect the accuracy of this mapping.

---

*End of Document — Stage F Technical Architecture Mapping v0.1-draft*
