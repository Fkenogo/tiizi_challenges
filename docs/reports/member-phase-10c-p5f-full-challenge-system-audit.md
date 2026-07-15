# Phase 10C-P5F — Full Challenge System State Audit

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: AUDIT COMPLETE — no code changes made

---

## Executive Summary

Across 10 audit areas, **4 bugs require fixes before deploy**, **3 items are safe to defer**, and **3 items need a product decision**. All P5A/P5B/P5C fixes are confirmed in place. The two highest-severity issues are raw `Date.parse()` calls in three screens (NaN risk on malformed dates) and a public-browse gap where challenges with only `groupVisibility == 'public'` (not `visibility == 'public'`) are invisible in Home Trending.

All current guard tests pass.

---

## Area 1 — Home Screen (HomeScreen.tsx, useHomeScreen.ts)

### 1A. Trending challenge feed only covers `visibility == 'public'` — misses `groupVisibility == 'public'`

| | |
|---|---|
| **Severity** | Medium |
| **Status** | Still broken |
| **Type** | Data / query gap |
| **File** | `src/features/Home/useHomeScreen.ts` |

**Current behavior**: `getChallengesPage({ pageSize: 15, statuses: ['active'], visibility: 'public' })` passes `visibility == 'public'` as the sole filter. Challenges where `groupVisibility == 'public'` but `visibility !== 'public'` are excluded from Trending but appear in Browse.

**Expected behavior**: Trending should use the same visibility contract as Browse (public on either `visibility` OR `groupVisibility`).

**Root cause**: `getChallengesPage` accepts a single `visibility` option; the Trending call hard-codes `visibility: 'public'` and does not pass a `groupVisibility` option.

**Fix**: Fetch with `visibility: 'public'` (Query A) and separately with `groupVisibility: 'public'` (Query B), deduplicate, then apply `isDiscoverableTrendingChallenge`. Alternatively, add a `groupVisibility` option to `getChallengesPage` so it executes both queries.

---

### 1B. Notification bell shows static red dot — not wired to actual count

| | |
|---|---|
| **Severity** | Low |
| **Status** | Needs product decision |
| **Type** | UX |
| **File** | `src/features/Home/HomeScreen.tsx` |

**Current behavior**: The notification bell always renders a red dot indicator regardless of whether the user has unread notifications.

**Expected behavior**: The dot should reflect actual unread notification count or be absent.

**Fix**: Wire to a notifications collection query, or explicitly remove the static dot if notifications are not yet live.

---

### 1C. Already confirmed working

- Active challenge rail: `getActiveChallengesForUser(uid, 10)` → queries `challengeMembers` directly (rule: `allow read: if isAuthenticated()`) ✓
- "See All →" → `/app/challenges` ✓
- Trending filters: `isDiscoverableTrendingChallenge` + `.slice(0, 5)` ✓
- Participating challenges appear in Trending with `Log Workout`/`Log Activity` label ✓
- `effectiveActiveChallengeCount` derived from rendered rail, not stale summary fields ✓

---

## Area 2 — ChallengesScreen (ChallengesScreen.tsx)

All routing, filtering, and CTA logic confirmed working post-P5C:

- Ongoing "View All" → `/app/challenges/browse` ✓ (P5C fixed — was routing to templates)
- Browse "View All" → `/app/challenges/browse` ✓
- Ongoing section shows max 3 cards (`.slice(0, 3)`) ✓
- Browse section shows max 6 cards (`.slice(0, 6)`) ✓
- Log CTA gated by `hasStarted` ✓
- Wellness challenges handled via `isWellness` flag ✓
- Browse excludes user's own group challenges (`!myGroupIds.has(challenge.groupId)`) ✓
- `parseChallengeEndMs` used for days-remaining (no raw `new Date(item.endDate)`) ✓
- `isChallengeExpired` used to exclude expired active challenges ✓
- `participantCount ?? 0` safe default ✓

---

## Area 3 — Browse Challenges (BrowseChallengesScreen.tsx)

All P5C fixes confirmed in place:

- Uses `useVisibleChallengesPage(25, ['active'])` ✓
- Client-side filter: `!isChallengeExpired(challenge) && (visibility === 'public' || groupVisibility === 'public')` ✓
- Error handling: `challengeQueryState(error)` from utility (no raw `permission-denied` in screen file) ✓
- `parseChallengeStartMs`/`parseChallengeEndMs` used for date display ✓
- Empty state text correctly distinguishes "no challenges at all" vs "challenges exist but are group-only" ✓
- "View" button routes to `/app/challenge/${item.id}` ✓
- Hint text: "To participate, join the challenge's group first." ✓
- Load More pagination supported ✓

---

## Area 4 — Challenge Detail (ChallengeDetailScreen.tsx)

### 4A. Raw `Date.parse()` for `hasStarted`/`hasEnded` — NaN risk

| | |
|---|---|
| **Severity** | Medium |
| **Status** | Still broken |
| **Type** | Bug / data safety |
| **File** | `src/features/Challenges/ChallengeDetailScreen.tsx` lines 74–78 |

**Current behavior**:
```ts
const challengeStartsAt = resolvedChallenge ? Date.parse(resolvedChallenge.startDate) : 0;
const challengeEndsAt = resolvedChallenge ? Date.parse(resolvedChallenge.endDate) : 0;
const hasStarted = resolvedChallenge ? now >= challengeStartsAt : false;
const hasEnded = resolvedChallenge ? now > challengeEndsAt : false;
```
`Date.parse` returns `NaN` for missing or malformed date strings. `now >= NaN` is `false`, so a challenge with a missing `startDate` is treated as "not yet started" — the Log Workout CTA is hidden even if the challenge is ongoing.

**Expected behavior**: Use `parseChallengeStartMs`/`parseChallengeEndMs` which handle missing/malformed dates safely.

**Fix**:
```ts
const challengeStartsAt = parseChallengeStartMs(resolvedChallenge?.startDate) ?? 0;
const challengeEndsAt = parseChallengeEndMs(resolvedChallenge?.endDate) ?? Infinity;
```

---

### 4B. Confirmed working

- `canLogWorkout = !!membership && membership.status === 'active' && hasStarted && !hasEnded` ✓
- `canPreviewPublicChallenge` for non-members viewing public group challenges ✓
- Leaderboard from `activityLogs`, top 5 by score ✓
- `isWellnessChallenge` controls "Log Activity" vs "Log Workout" copy ✓
- Donation pledge flow present and gated by `donationsAvailable` ✓
- Post-join navigation to `/app/challenges/${challengeType}?challengeId=...` ✓

---

### 4C. No dedicated expired/completed challenge UI

| | |
|---|---|
| **Severity** | Low |
| **Status** | Needs product decision |
| **Type** | UX |
| **File** | `src/features/Challenges/ChallengeDetailScreen.tsx` |

**Current behavior**: Expired challenges render the same layout with "Completed" status text. No distinct completed-state screen is shown from the detail view. `ChallengeCompletedScreen.tsx` exists but is only navigated to after logging a final activity (via a direct route), not as a natural landing state for re-visiting a completed challenge.

**Product decision needed**: Should re-visiting a completed challenge show `ChallengeCompletedScreen` or a locked detail view?

---

## Area 5 — Group Detail (GroupDetailScreen.tsx)

### 5A. Raw `Date.parse()` for `activeProgress` — NaN risk

| | |
|---|---|
| **Severity** | Medium |
| **Status** | Still broken |
| **Type** | Bug / data safety |
| **File** | `src/features/Groups/GroupDetailScreen.tsx` lines 68–69 |

**Current behavior**:
```ts
const start = Date.parse(activeChallenge.startDate);
const end = Date.parse(activeChallenge.endDate);
```
If `startDate` or `endDate` is missing, `start`/`end` are `NaN`. All derived values (`daysRemaining`, `percent`, `progressLabel`) will be `NaN` or `Infinity`, which renders as visible garbage in the Active Challenges card.

**Fix**: Use `parseChallengeStartMs`/`parseChallengeEndMs` with safe fallbacks.

---

### 5B. Confirmed working (P5A fixes in place)

- `activeChallenge` uses `isChallengeOngoing` ✓ (P5A fixed)
- `upcomingChallenge` uses `parseChallengeStartMs` and correctly requires `startMs > nowMs` ✓ (P5A fixed)
- Private group gating: shows "Private group / Request to Join" for non-members ✓
- Public group: shows active challenge preview + "Join Group" CTA for non-members ✓

---

### 5C. Completed challenges not shown in Group Detail

| | |
|---|---|
| **Severity** | Low |
| **Status** | Safe to defer |
| **Type** | UX / feature gap |

**Current behavior**: Group Detail only queries `status == 'active'` challenges. After a challenge completes (status flips to `'completed'`), it disappears from the group page entirely.

**Expected behavior**: Show a "Past Challenges" section or at minimum a "Completed" badge on the last challenge.

---

## Area 6 — Challenge Creation (CreateChallengeWizard.tsx)

### 6A. No `visibility`/`groupVisibility` fields in wizard UI

| | |
|---|---|
| **Severity** | Low |
| **Status** | Safe to defer (server-side derived) |
| **Type** | Feature gap |
| **File** | `src/features/Challenges/CreateChallengeWizard.tsx` |

**Current behavior**: The wizard collects `challengeType`, `startDate`, `endDate`, `activities`, donation settings, etc. It does NOT expose a `visibility` picker. The callable `createChallengeWithCreatorMembershipCore` is expected to derive `visibility` and `groupVisibility` from the group's `isPrivate`/`visibility` fields server-side (enforced by Firestore create rule line ~490–499: group public → challenge public, group private → challenge private).

**Assessment**: Correct by design for the current flow (one group = one visibility). A visibility picker would be needed if groups support per-challenge visibility overrides.

---

## Area 7 — Challenge Logging (Collective/Competitive/Streak screens)

### 7A. Collective/Competitive/Streak screens' Log button not gated by `hasStarted`

| | |
|---|---|
| **Severity** | Low |
| **Status** | Still broken |
| **Type** | UX inconsistency |
| **Files** | `CollectiveChallengeScreen.tsx`, `CompetitiveChallengeScreen.tsx`, `StreakChallengeScreen.tsx` |

**Current behavior**: The floating Log button (CirclePlus) in `CollectiveChallengeScreen` navigates unconditionally to `select-activity?challengeId=...`. There is no `hasStarted` check before showing or enabling the button.

**Expected behavior**: For upcoming challenges, the Log button should be hidden or disabled (consistent with the CTA gating in `ChallengeDetailScreen`).

**Impact**: Users can navigate to the activity selection screen for a challenge that has not started. The workout service's Firestore write will succeed (no server-side date enforcement), so they could log an early workout.

**Fix**: Derive `hasStarted` from `parseChallengeStartMs(challenge?.startDate)` and conditionally hide/disable the button.

---

### 7B. ChallengeCompletedScreen uses raw `new Date()` — NaN risk for `totalDays`

| | |
|---|---|
| **Severity** | Low |
| **Status** | Still broken |
| **Type** | Bug / data safety |
| **File** | `src/features/Challenges/ChallengeCompletedScreen.tsx` lines 47–50 |

**Current behavior**:
```ts
const start = new Date(challenge.startDate).getTime();
const end = new Date(challenge.endDate).getTime();
return Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)) + 1);
```
If `startDate`/`endDate` are missing, `start`/`end` are `NaN`. `totalDays` falls back to `1` via `Math.max(1, NaN + 1)` → `1`. `completionPct` becomes `Math.round((uniqueDays / 1) * 100)` which can exceed 100 and produce a false-100% completion rate.

**Fix**: Use `parseChallengeStartMs`/`parseChallengeEndMs`.

---

## Area 8 — Firestore Rules / Query Safety

### 8A. Confirmed fixes (P5C)

- `match /challenges/{challengeId}` uses `allow get:` + `allow list:` (not `allow read:`) ✓
- `allow list:` is field-only (no `isGroupMember`, no `get()`/`exists()` calls) ✓
- `canReadChallenge`: visibility field-check placed BEFORE `isGroupMember` in OR chain ✓
- Query C (member-group) in `getVisibleChallengesForUserPage` wrapped in try/catch ✓

---

### 8B. `challengeMembers` rule: open read for all authenticated users

| | |
|---|---|
| **Severity** | Medium |
| **Status** | Needs product decision |
| **Type** | Security / privacy |
| **File** | `firestore.rules` line 1089 |

**Current rule**:
```
match /challengeMembers/{membershipId} {
  allow read: if isAuthenticated();
```

**Impact**: Any signed-in user can query `challengeMembers where userId == <any uid>` to enumerate all challenge memberships for any user. For private groups, this reveals group membership information without requiring group membership.

**Product decision needed**: Should challenge membership be readable only by the member themselves, by group members, or by admins? This depends on whether leaderboards are meant to be cross-group-visible.

---

### 8C. `workouts` collection: user can only read own workouts — confirmed

- `allow read: if isAuthenticated() && resource.data.userId == request.auth.uid` ✓
- No cross-user workout visibility ✓

---

### 8D. `isValidChallengeMemberCreate` makes `get()` calls on challenge doc

`isValidChallengeMemberCreate` calls `get(/challenges/$(challengeId))` and `exists(/challenges/$(challengeId))`. This is a **create** operation (not a list query), so it is not subject to the 10-call list budget. Safe. ✓

---

## Area 9 — Data Quality

From the P5C-FINAL diagnostic (run 2026-06-17 against production):

| Metric | Value |
|--------|-------|
| Total challenge documents | 28 |
| Missing `visibility` field | 0 |
| Missing `groupVisibility` field | 0 |
| Missing `groupId` | 0 |
| Active + public challenges | 18 |
| Active + private challenges | 4 |
| Challenges needing backfill | 0 |

All production challenges have required fields. Backfill is not needed. ✓

---

## Area 10 — Routes / Navigation

From `App.tsx`:

| Route | Component | Guard |
|-------|-----------|-------|
| `/app/challenges` | ChallengesScreen | requireCompletedProfile |
| `/app/challenges/browse` | BrowseChallengesScreen | requireCompletedProfile |
| `/app/challenges/suggested` | SuggestedChallengesScreen | requireCompletedProfile |
| `/app/challenges/collective` | CollectiveChallengeScreen | requireCompletedProfile + RequireGroupRoute |
| `/app/challenges/competitive` | CompetitiveChallengeScreen | requireCompletedProfile + RequireGroupRoute |
| `/app/challenges/streak` | StreakChallengeScreen | requireCompletedProfile + RequireGroupRoute |
| `/app/challenge/:id` | ChallengeDetailScreen | requireCompletedProfile |
| `/app/challenge-completed` | ChallengeCompletedScreen | requireCompletedProfile |

`RequireGroupRoute` on Collective/Competitive/Streak ensures a user can only access these screens from a group context. ✓

---

## Summary Table

| # | Area | Issue | Severity | Status | Fix Required |
|---|------|-------|----------|--------|-------------|
| 1 | Home | Trending misses `groupVisibility == 'public'` challenges | Medium | Still broken | Yes — before deploy |
| 2 | ChallengeDetail | Raw `Date.parse()` for `hasStarted`/`hasEnded` | Medium | Still broken | Yes — before deploy |
| 3 | GroupDetail | Raw `Date.parse()` for `activeProgress` | Medium | Still broken | Yes — before deploy |
| 4 | ChallengeCompleted | Raw `new Date()` for `totalDays` NaN risk | Low | Still broken | Yes — before deploy |
| 5 | Collective/etc. | Log button not gated by `hasStarted` | Low | Still broken | Yes — before deploy |
| 6 | Rules | `challengeMembers` open read | Medium | Needs product decision | Decision needed |
| 7 | Home | Notification bell static red dot | Low | Needs product decision | Decision needed |
| 8 | ChallengeDetail | No distinct completed-challenge UI | Low | Needs product decision | Decision needed |
| 9 | GroupDetail | No past/completed challenges section | Low | Safe to defer | No |
| 10 | Creation | No visibility picker in wizard | Low | Safe to defer (server-derived) | No |
| — | Browse | Access restricted (P5C fix) | — | Already fixed ✓ | — |
| — | ChallengesScreen | Ongoing "View All" routing (P5C fix) | — | Already fixed ✓ | — |
| — | Rules | `allow get`/`allow list` split (P5C fix) | — | Already fixed ✓ | — |
| — | Rules | Removed `isApprovedPublicGroup` (P5C fix) | — | Already fixed ✓ | — |

---

## Recommended Fix Order (before deploy)

1. **Issue 2 + 3 + 4** (same root cause): Replace `Date.parse`/`new Date` with `parseChallengeStartMs`/`parseChallengeEndMs` in `ChallengeDetailScreen`, `GroupDetailScreen`, and `ChallengeCompletedScreen`. Can be done in one pass across all three files.
2. **Issue 5**: Gate Collective/Competitive/Streak Log buttons on `hasStarted`. Low risk, one button per screen.
3. **Issue 1**: Fix Trending to cover `groupVisibility == 'public'` (requires adding a second query or extending `getChallengesPage`).

---

## Validation

All guard tests pass at time of audit (no code was changed in P5F):

```
npm run test:pilot-ux-polish-guards  → passed
npm run test:home-challenge-feeds    → passed
```

---

## Files Reviewed

| File | Purpose |
|------|---------|
| `src/features/Home/useHomeScreen.ts` | Trending + active challenge data fetching |
| `src/features/Home/HomeScreen.tsx` | Home screen rendering |
| `src/features/Challenges/ChallengesScreen.tsx` | Main challenge hub |
| `src/features/Challenges/BrowseChallengesScreen.tsx` | Public browse |
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Challenge detail + Log CTA |
| `src/features/Challenges/ChallengeCompletedScreen.tsx` | Post-challenge summary |
| `src/features/Challenges/CollectiveChallengeScreen.tsx` | In-challenge collective view |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Challenge creation flow |
| `src/features/Groups/GroupDetailScreen.tsx` | Group challenge section |
| `src/services/challengeService.ts` | Data fetching / query logic |
| `src/utils/challengeErrorUtils.ts` | Error code utility |
| `firestore.rules` | Firestore security rules |
| `firestore.indexes.json` | Composite index definitions |
| `src/App.tsx` | Route definitions |
| `scripts/testHomeChallengeFeeds.ts` | Guard tests |
