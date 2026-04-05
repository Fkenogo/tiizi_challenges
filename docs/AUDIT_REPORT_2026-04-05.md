# Tiizi — Full Pre-Deployment Technical Audit
**Date:** 2026-04-05  
**Auditor:** Claude Code (Senior Software Auditor Mode)  
**Verdict:** ⛔ NOT SAFE TO DEPLOY AS-IS — Multiple P0 blockers present

---

## A. Executive Summary

### Is this safe to deploy?
**No.** There are several serious issues that must be resolved before production launch:

1. **Production Firebase API key is committed to `.env`** — while `.env` is in `.gitignore`, the key was present locally and may have been exposed in git history or staging environments.
2. **`groupService.joinGroup` never increments `memberCount` in Firestore** — visible member counts are permanently stale.
3. **Streak calculation ignores `wellnessLogs`** — streak breaks silently for all non-fitness challenge users.
4. **Admin analytics service does full collection scans without indexes** — will timeout at any real scale.
5. **Challenge approval restores `status: active` but does not auto-join creator** — challenges approved late can have 0 participants shown.
6. **`RequireGroupRoute` blocks users from challenge log routes when `groupId` is not in URL** — hard deadlock possible for returning users.
7. **Donation flow is honor-system only with a hardcoded phone number** — no real payment verification; unsuitable for production trust.
8. **No push notifications** — notification system is a pull-only array in user document with a 100-item cap; no delivery mechanism.

### Post-launch tolerable issues
Content placeholder screens, TTS missing endpoint, analytics charts are text tables not graphs, books redirect to content pages.

---

## B. Critical Issues (P0)

### B1 — Firebase API Key in `.env` May Have Been Committed
**File:** `.env`  
**Severity:** CRITICAL  
The `.env` file contains the full production Firebase config including `VITE_FIREBASE_API_KEY`. While `.gitignore` now excludes it, the key has been sitting in the working directory and may exist in git history. Firebase API keys are technically public (they're used client-side), but combined with permissive Firestore rules, they enable unauthenticated users to probe the database.

**Action:** Audit git log for committed `.env`. Rotate Firebase API key in console. Enforce server-side Firestore rules (already mostly correct). Consider adding `.env` check to CI.

---

### B2 — `groupService.joinGroup` Never Updates `memberCount`
**File:** `src/services/groupService.ts:156-200`  
The `joinGroup` function creates the `groupMembers` document but **never writes `increment(1)` to `groups/{groupId}.memberCount`**. The returned object computes a fake local value: `memberCount: Math.max(1, group.memberCount || 0)` — but nothing persists to Firestore. Every group will show `1` member forever unless explicitly seeded.

**Impact:** Every group leaderboard, member count badge, and analytics metric is wrong from the first join.

---

### B3 — Streak Calculation Ignores Wellness Logs
**File:** `src/services/streakService.ts:68-148`  
`calculateUserStreak` and `calculateChallengeStreak` only query the `workouts` collection. Users doing wellness challenges (fasting, hydration, sleep, meditation) log to `wellnessLogs`, not `workouts`. Their streaks always show 0, even with daily activity.

**Impact:** Streak challenges are broken for ~50% of challenge types.

---

### B4 — Admin Analytics Does Full Collection Scans
**Files:** `src/services/adminAnalyticsService.ts`, `src/services/adminChallengeService.ts`  
`getPendingChallenges()`, `getApprovedChallenges()`, `getActiveChallenges()`, `getChallengeAnalytics()` all call `getDocs(collection(db, 'challenges'))` — returning **every challenge document** before filtering in-memory. The same pattern appears in `getUserGrowth` and engagement metrics.

**Impact:** At 1,000 challenges this times out. At 10,000 it's unusable. Admin dashboard will hang in production.

**Fix:** Add `where('moderationStatus', '==', 'pending')`, `where('status', '==', 'active')` etc. and create matching composite indexes.

---

### B5 — `RequireGroupRoute` Can Create Navigation Deadlock
**File:** `src/components/Auth/RequireGroupRoute.tsx:28`  
```tsx
if (membershipStatus && membershipStatus !== 'joined') {
  return <Navigate to={`/app/group/${groupId}`} replace />;
}
```
If `membershipStatus` comes back as `'pending'` or `'none'` (non-joined statuses), the user is redirected to group detail. That group detail page may have a "Log Workout" button that navigates back to the log route. The user is stuck in a loop with no escape.

Additionally, the gate condition reads `membershipStatus && membershipStatus !== 'joined'` — which passes if status is `undefined` (loading), meaning users with slow connections could slip through unchecked.

---

### B6 — `auth.login()` Silently Does Nothing With No Password
**File:** `src/context/AuthContext.tsx:131-141`  
```tsx
const login = async (email: string, password?: string) => {
  if (password) { ... }
};
```
If `password` is `undefined` or empty string, login resolves successfully without authenticating. This is a logic error — the `login` function silently exits without error. Any caller that omits the password parameter will believe login succeeded.

---

### B7 — Workouts `activitiesCompleted` Can Exceed `totalActivities`
**File:** `src/services/workoutService.ts:96-98`  
```tsx
const nextCompleted = (membership.activitiesCompleted ?? 0) + 1;
const totalActivities = Math.max(1, membership.totalActivities ?? 1);
const nextRate = Math.min(100, Math.round((nextCompleted / totalActivities) * 100));
```
`activitiesCompleted` is incremented unconditionally via `increment(1)` on every workout log — there is **no cap check against `totalActivities`**. A user can log the same exercise 1000 times, resulting in `activitiesCompleted: 1000` and `totalActivities: 3`. The `completionRate` is capped at 100% but the raw counter keeps growing, corrupting the membership document.

Same issue exists in `wellnessLogService.ts:58-61`.

---

## C. Major Structural Gaps

### C1 — No Real Payment Processing
**File:** `src/features/Donate/DonateScreen.tsx`  
The donation flow is fully honor-system. It:
1. Redirects to MPESA USSD dial string `*344*2*0*722361789#` (hardcoded to a phone number)
2. Creates a `supportDonations` document with `status: 'intent'`
3. Asks user to self-report a transaction ID

There is no server-side payment webhook, no M-Pesa API integration, no verification of payment completion. The hardcoded phone number (`0722361789`) and card URL (`https://payments.tiizi.app/support`) are baked into source code. This is unsuitable for a production fintech feature.

**Risk:** Users can report false donations. Revenue data is entirely unverifiable.

---

### C2 — Notifications Are Not Push Notifications
**File:** `src/services/notificationService.ts`  
Notifications are stored as a flat JSON array inside `users/{uid}.notifications.items` with a 100-item cap. There are no FCM tokens, no Firebase Cloud Messaging, no push delivery. The notification bell in the header shows a hardcoded red dot regardless of actual unread count. Users must open the app to see any notification.

---

### C3 — Group `memberCount` is Permanently Stale
See B2. Additionally, `leaveGroup` sets status to `'left'` but also never decrements `memberCount`. `createGroup` sets it to `1` on creation. Groups that grow to 50 members will show `1` forever.

---

### C4 — Admin Creates Challenges Without Group Assignment
**File:** `src/features/Admin/Challenges/CreateChallengeScreen.tsx`  
Admin-created challenges via `adminChallengeService.createChallengeFromAdmin` do not require or assign a `groupId`. The challenges collection rule requires `groupId` for all reads (the `isGroupMember(resource.data.groupId)` check in Firestore rules). Admin-created challenges with no `groupId` will be inaccessible to all non-admin users via Firestore rules.

---

### C5 — `wellnessLogs` Not Queried for Streak, Leaderboard, or User Stats
Wellness activity logs (`wellnessLogService`) write to `wellnessLogs` collection. However:
- `streakService` only reads from `workouts`
- `ChallengeDetailScreen` leaderboard only reads from `workouts`
- `useHomeScreen` only queries `workouts`-based metrics
- Admin engagement metrics count `workouts` only

All wellness challenge activity is invisible to the app's core metrics.

---

### C6 — `/app/admin/content/books` Route Redirects to Pages
**File:** `src/App.tsx:232`  
```tsx
<Route path="/app/admin/content/books" element={<Navigate to="/app/admin/content/pages" replace />} />
```
`BooksScreen` (`src/features/Admin/Content/BooksScreen.tsx`) is a fully implemented screen that exists but is unreachable via routing. There is no route that renders it. The `BooksScreen` is imported and ready but silently dead.

---

### C7 — Missing Composite Indexes for Key Queries
**File:** `firestore.indexes.json` — only 1 index defined  
Critical queries that will fail without indexes at scale:
- `workouts` where `userId` + `date` + orderBy `date` (streakService)
- `workouts` where `completedAt >=` (adminAnalytics — Firestore requires index for range + collection-level query)
- `groupMembers` where `userId` + where `status` (multiple places)
- `challengeMembers` where `userId` (getUserChallengeMembershipIndex)
- `challenges` where `groupId` + where `status`

These queries will trigger Firestore to prompt for index creation with a URL, meaning they fail silently for the first user until an admin manually creates the index.

---

### C8 — No Error Boundaries
There are no React error boundaries in the application. A single JS runtime error in any lazy-loaded screen will crash the entire app with a blank screen. Given the heavy use of Firestore data that can be malformed, this is a high-risk gap.

---

## D. Medium Issues

### D1 — Active Users Metric Uses String Comparison for Timestamps
**File:** `src/services/adminAnalyticsService.ts:108-111`, `src/services/adminUserService.ts:155-162`  
Workouts created by `workoutService` write `loggedAt: Timestamp.now()` (a Firestore Timestamp) but `completedAt` as ISO string. The analytics service filters `where('completedAt', '>=', sevenDaysAgoIso)` which works only if `completedAt` is stored as a string. If any workout was created via admin or script with a Firestore Timestamp object, it will be excluded from the active user count.

### D2 — `ensureUserDocument` Called With `merge: true` Overwrites `stats`
**File:** `src/context/AuthContext.tsx:57-87`  
On every login that passes the 6-hour `shouldSyncUserDocument` throttle, `ensureUserDocument` writes `stats: { level: 1, totalPoints: 0, totalWorkouts: 0, ... }` with `merge: true`. Because `stats` is a map field and `merge: true` only merges top-level keys, the entire `stats` sub-map is **overwritten** to zeros. Users who logged 50 workouts will see their stats reset to 0 every 6 hours if the field structure has changed.

**Update:** Verified — `setDoc` with `merge: true` merges sub-objects field-by-field (not full replacement) only for nested keys that are explicitly set. But because `stats.level: 1` is always set, users' level will be reset to 1 on sync. This is a real issue.

### D3 — `ChallengeDetailScreen` Leaderboard Shows User IDs
**File:** `src/features/Challenges/ChallengeDetailScreen.tsx:64-73`  
The leaderboard computes ranks from `workouts` and renders `userId` directly without resolving display names. Users see `abc123` not actual names.

### D4 — `window.prompt()` Used in Production Admin UI
**File:** `src/features/Admin/AdminPendingChallengesScreen.tsx:34`  
`window.prompt()` is used to collect moderation notes. This is browser-native, unstyled, and blocked by some browser policies. It is not suitable for production admin tooling.

### D5 — All Admin Collection Scans Risk Firestore Bill Spike
**Files:** `adminChallengeService.ts`, `adminAnalyticsService.ts`, `adminUserService.ts`, `adminDonationService.ts`  
Calling `getDocs(collection(db, 'users'))` returns all user documents. At 10,000 users this is 10,000 reads per admin page load. No pagination implemented anywhere in admin. This will cause Firestore billing spikes and slow admin pages.

### D6 — `BooksLibraryScreen` TTS Feature Has No Endpoint
**File:** `src/services/ttsService.ts:13`  
`VITE_TTS_ENDPOINT` is not in `.env` or `.env.example`. The TTS feature silently fails — but gracefully (falls back to `canUseServerTts() → false`). Not a blocker but the feature is dead in production.

### D7 — Hardcoded Receiver Phone & USSD in Source
**File:** `src/features/Donate/DonateScreen.tsx:10-12`  
```tsx
const RECEIVER_PHONE = '0722361789';
const MPESA_USSD_CODE = '*344*2*0*722361789#';
```
This cannot be changed without a code deploy. Should be an environment variable or admin-configurable setting.

### D8 — `challengeService.getVisibleChallengesForUser` Loads ALL Groups
**File:** `src/services/challengeService.ts:418`  
```tsx
getDocs(collection(db, 'groups')),
```
Fetches every group in the database to find public ones. At 500 groups this is 500 reads per page load.

---

## E. Minor Issues

### E1 — `AdminModulePlaceholderScreen` Still Reachable
The screen `AdminModulePlaceholderScreen` exists but is no longer wired to any route. Its `titles` map references paths that are now implemented. Safe to delete.

### E2 — Dead Mockup Routes in Production
`/mockups` and `/mockups/:slug` routes are in the production router. These serve HTML screen layout mockups from `public/screen-layouts/`. They should be removed before go-live or gated to dev environments.

### E3 — `removeUndefinedDeep` Duplicated
Identical function in `challengeService.ts:67`, `workoutService.ts:30`. Should be a shared util.

### E4 — `firebase-admin` in `dependencies` Not `devDependencies`
**File:** `package.json`  
`firebase-admin: ^13.0.2` is in `dependencies`, not `devDependencies`. It is only used by server scripts. This unnecessarily inflates the production bundle if bundler tree-shaking fails.

### E5 — No `404` Route — All Unknown Paths Redirect to `/app/flow`
**File:** `src/App.tsx:279`  
```tsx
<Route path="*" element={<Navigate to="/app/flow" replace />} />
```
Any mistyped URL silently redirects to flow hub. Should be an explicit 404 screen.

### E6 — `useAdminAccess` Falls Back to `users` Collection Role Field
**File:** `src/services/adminAccessService.ts:174`  
The service reads `users/{uid}.role` and `users/{uid}.profile.role` as legacy admin role checks. This means any user who finds a way to write `role: 'super_admin'` to their own user document gets full admin access. The Firestore rule says users can write their own document when authenticated — this is a privilege escalation vector.

### E7 — Daily Goals Stored in User Document, Not Collection
**File:** `src/services/dailyGoalsService.ts`  
Daily goals are written as `users/{uid}.dailyGoals` map field. There's no historical record — each day's goals overwrite the previous day. The analytics accumulator (`dailyGoalsAnalytics`) tracks cumulative counts but has no per-day history. Historical goal analysis is permanently impossible.

### E8 — No Input Sanitization for Notification Messages
**File:** `src/services/notificationService.ts`  
Notification messages include raw user-supplied challenge names. If an admin challenge is named `<script>alert(1)</script>`, it will appear in notifications. While React escapes by default in JSX, this is worth noting.

---

## F. Feature Completion Map

| Feature | Status | Evidence | Risk | Action |
|---------|--------|----------|------|--------|
| Auth (email/password login) | Mostly complete | AuthContext.tsx — silent no-op on missing password | High | Fix login guard |
| Auth (Google login) | Complete | signInWithPopup + fallback to redirect | Low | — |
| Signup | Mostly complete | Creates user doc, no email verification gate | Medium | Add verification check |
| Home screen | Complete | HomeScreen.tsx — real data, fallback logic | Low | — |
| Create group | Mostly complete | groupService — memberCount never incremented | High | Fix memberCount |
| Join group | Partial | Membership created, memberCount not updated | High | Fix memberCount |
| Leave group | Partial | Status set to 'left', memberCount not decremented | Medium | Fix memberCount |
| Group detail | Complete | GroupDetailScreen with tabs | Low | — |
| Group leaderboard | UI only | GroupLeaderboardScreen loads data but no `wellnessLogs` | Medium | Include wellnessLogs |
| Create challenge | Complete | CreateChallengeWizard — full form, group guard | Low | — |
| Challenge donation approval | Complete | Moderation flow works end to end | Low | — |
| Join challenge | Complete | joinChallenge with membership creation | Low | — |
| Log workout (fitness) | Complete | LogWorkoutScreen → workoutService | Low | — |
| Log wellness activity | Complete | LogWellnessActivityScreen → wellnessLogService | Low | — |
| Streak challenges | Broken | streakService only reads workouts, not wellnessLogs | Critical | Fix streak query |
| Notifications | Partial | Pull-only, no FCM push, hardcoded unread dot | High | Note to users |
| Donate (support Tiizi) | Partial | USSD redirect + honor-system confirmation | High | Disclose as manual |
| Challenge contribution pledge | Complete | donationService.createChallengeContribution | Low | — |
| Profile (personal info) | Complete | ProfilePersonalInfoScreen → userProfileService | Low | — |
| Profile (privacy settings) | Complete | ProfilePrivacySettingsScreen | Low | — |
| Profile interests | Complete | ProfileInterestsScreen | Low | — |
| Profile analytics | Partial | ProfileAnalyticsScreen shows goals + streak | Medium | Add wellnessLogs |
| Exercise library | Complete | ExerciseLibraryScreen with search/filter | Low | — |
| Books library | Complete | BooksLibraryScreen + BookReaderScreen | Low | — |
| Books TTS | Not implemented | VITE_TTS_ENDPOINT not configured | Low | Document limitation |
| Admin dashboard | Complete | Real data from adminAnalyticsService | Medium | Add pagination |
| Admin: pending challenges | Complete | Full moderation flow | Low | — |
| Admin: exercise management | Complete | CRUD with bulk import | Low | — |
| Admin: wellness activities | Complete | CRUD | Low | — |
| Admin: user management | Mostly complete | List, detail, suspend/activate | Medium | Add pagination |
| Admin: group management | Mostly complete | List, detail, moderation | Medium | Add pagination |
| Admin: analytics (overview) | Mostly complete | Real data, no charts | Low | — |
| Admin: analytics (user growth) | Complete | Bar chart (text), table | Low | — |
| Admin: analytics (engagement) | Complete | DAU/WAU/MAU from workouts only | Medium | Include wellnessLogs |
| Admin: analytics (revenue) | Partial | Shows donation totals but counts pending donations | Medium | Filter by confirmed |
| Admin: donation campaigns | Complete | Real data from donationCampaigns + challenges | Low | — |
| Admin: content pages | Complete | Full CRUD | Low | — |
| Admin: books management | Dead route | BooksScreen exists but unreachable | Medium | Fix route |
| Admin: notifications | Complete | Template CRUD | Low | — |
| Admin: settings | Complete | AppSettingsScreen | Low | — |
| Admin: admin users | Complete | AdminUsersScreen with role assignment | Low | — |
| Admin: system logs | Complete | SystemLogsScreen | Low | — |

---

## G. Security Findings

| Severity | Issue | Risk | Fix |
|----------|-------|------|-----|
| **HIGH** | `users` document writable by user — `role` field writeable by account owner | User can set `role: 'super_admin'` and gain admin access via `adminAccessService` legacy fallback | Remove role from `users` write rules or strip role from user-writeable path |
| **HIGH** | `ensureUserDocument` resets `stats.level` to 1 every 6 hours | Users' levels are silently overwritten | Remove level/points from ensureUserDocument payload |
| **MEDIUM** | Firebase API key committed in `.env` (may exist in git history) | Key exposure enables abuse of Firebase project | Rotate key, audit git history |
| **MEDIUM** | `supportTickets` collection: write rule is `canManageUsers()` — users cannot create their own tickets | There is no user-facing way to create support tickets | Add `allow create: if isAuthenticated() && request.resource.data.userId == request.auth.uid` |
| **MEDIUM** | `groupReports` read/write restricted to admins | Regular users cannot report groups (no rule for reporting) | Add user `create` rule |
| **MEDIUM** | `donationTransactions` writable only by `super_admin` — donation confirmations written by user go to `supportDonations` not `donationTransactions` | Revenue reporting conflates unverified user-submitted data with admin-verified transactions | Separate data sources more clearly |
| **LOW** | `onboardingContent` readable only by admins | If any screen needs to display onboarding content to users, it will fail with permission-denied | Review intended audience |
| **LOW** | Storage rules allow any authenticated user to write to `/group-covers/{userId}/...` where `userId` is their own | No per-group ownership check — user can upload to any path matching their UID | Already scoped correctly to UID; low risk |

---

## H. Database / Schema Findings

### H1 — Notifications Embedded in User Document
`users/{uid}.notifications.items` — array up to 100 items. Not queryable, no real-time listener, no collection-level rules. Impossible to fan out notifications to multiple users. **Should be its own collection.**

### H2 — Daily Goals Embedded in User Document  
`users/{uid}.dailyGoals` — single day, no history. `users/{uid}.dailyGoalsAnalytics` — aggregate counters only. No historical data possible.

### H3 — `memberCount` on Groups is Stale
`groups/{groupId}.memberCount` is never updated after group creation. Always shows initial value.

### H4 — `participantCount` on Challenges Partially Maintained
`challenges/{challengeId}.participantCount` is set to `1` after challenge creation auto-join. It is updated on `approveChallenge` approval transition (re-join not called). The service falls back to live count from `challengeMembers`, but the field stays stale.

### H5 — `activitiesCompleted` Can Exceed `totalActivities`
Both `workoutService` and `wellnessLogService` increment `activitiesCompleted` without checking if it has reached `totalActivities`. Documents become corrupt over time.

### H6 — `createdAt` Field Type Inconsistency
`users/{uid}.createdAt` is written as `Timestamp.now()` (Firestore Timestamp) in `ensureUserDocument`, but read/filtered as an ISO string in `adminAnalyticsService` (`where('createdAt', '>=', startIso)`). Firestore range queries mixing Timestamp and String types will silently return 0 results.

### H7 — `completedAt` Field Type Inconsistency
`workoutService` stores `completedAt` as ISO string but `loggedAt` as `Timestamp.now()`. Some admin queries filter on `completedAt` as a string, others might encounter Timestamp objects from older data.

### H8 — `groupId` Missing from Admin-Created Challenges
`adminChallengeService.createChallengeFromAdmin` does not require `groupId`. Challenges without `groupId` fail Firestore read rules for all non-admins.

### H9 — Missing Required Composite Indexes
Only 1 index is defined (`catalogExercises` tier_1 + difficulty). At minimum, these indexes are missing:
- `workouts`: (userId ASC, date ASC)
- `workouts`: (userId ASC, challengeId ASC, date ASC)
- `groupMembers`: (userId ASC, status ASC)
- `challenges`: (groupId ASC, status ASC)
- `challengeMembers`: (userId ASC, status ASC)
- `challengeMembers`: (challengeId ASC, status ASC)

---

## I. Deployment Checklist

- [ ] **Rotate Firebase API key** after auditing git history
- [ ] **Fix `groupService.joinGroup`** to increment `memberCount` in Firestore
- [ ] **Fix `streakService`** to include `wellnessLogs` dates
- [ ] **Fix `auth.login()`** to throw if no password provided
- [ ] **Add composite Firestore indexes** for all compound queries
- [ ] **Remove or gate `/mockups` routes** from production build
- [ ] **Fix `ensureUserDocument`** to not overwrite user `stats.level`
- [ ] **Add `groupId` validation** to admin challenge creation
- [ ] **Cap `activitiesCompleted`** in workoutService and wellnessLogService
- [ ] **Fix route**: Add a real route to `BooksScreen` (or remove the import)
- [ ] **Remove or replace `window.prompt()`** in AdminPendingChallengesScreen
- [ ] **Add React error boundaries** — at minimum one at app root
- [ ] **Verify `.env` not in git history**: `git log --all -- .env`
- [ ] **Remove or gate mockup/dev screens** from production
- [ ] **Confirm `VITE_TTS_ENDPOINT`** is defined or TTS feature visibly disabled
- [ ] **Remove hardcoded payment phone number** from source; move to admin config or env var
- [ ] **Add error boundary for Suspense fallback** — current fallback is just a spinner
- [ ] **Deploy Firestore rules** with `npm run deploy:firestore`
- [ ] **Disable debug logging** — no `console.error` left exposed in auth flows
- [ ] **Set up crash/error monitoring** (Sentry or Firebase Crashlytics)

---

## J. Priority Fix Plan

### P0 — Fix Before Deployment (Blockers)

| Issue | Affected Files | Proposed Fix | Difficulty | Risk if Ignored |
|-------|---------------|-------------|------------|-----------------|
| `groupService.joinGroup` never increments `memberCount` | `src/services/groupService.ts:156` | Add `updateDoc(doc(db, 'groups', groupId), { memberCount: increment(1) })` inside the `status === 'active'` branch | Easy | All member counts wrong forever |
| `streakService` ignores wellness logs | `src/services/streakService.ts:68-148` | Add parallel query to `wellnessLogs` and merge dates before calling `calculateStreakFromDates` | Medium | Streak challenges show 0 for all wellness users |
| `auth.login()` silent no-op | `src/context/AuthContext.tsx:131` | Throw `new Error('Password is required')` when no password | Easy | Users believe they are logged in when not |
| `activitiesCompleted` not capped | `src/services/workoutService.ts:96`, `wellnessLogService.ts:58` | Check `if (nextCompleted <= totalActivities)` before incrementing | Easy | Corrupt membership data |
| `ensureUserDocument` resets stats.level | `src/context/AuthContext.tsx:76` | Remove `level: 1` from the `stats` payload in ensureUserDocument | Easy | User levels reset every 6 hours |
| Missing composite Firestore indexes | `firestore.indexes.json` | Add indexes for all compound queries | Medium | Queries fail silently at scale |
| Mockup routes in production | `src/App.tsx:181-190` | Gate behind `import.meta.env.DEV` check | Easy | Dev scaffolding visible in production |
| Admin challenge missing `groupId` | `src/services/adminChallengeService.ts:111` | Require `groupId` in admin challenge creation form and service | Medium | Admin challenges unreadable by users |
| `users.role` privilege escalation | `src/services/adminAccessService.ts:174` | Remove legacy `users/{uid}.role` fallback from `getAdminAccess` | Easy | Users can escalate to admin |

### P1 — Should Fix Before Deployment

| Issue | Affected Files | Proposed Fix | Difficulty |
|-------|---------------|-------------|------------|
| `window.prompt()` in admin | `AdminPendingChallengesScreen.tsx:34` | Replace with inline form/modal | Easy |
| `leaveGroup` doesn't decrement `memberCount` | `src/services/groupService.ts:241` | Add `updateDoc` to decrement | Easy |
| `createdAt` field type inconsistency | `src/context/AuthContext.tsx:75` | Write `createdAt` as ISO string (not Timestamp) for `users` collection | Easy |
| BooksScreen route dead | `src/App.tsx:232` | Replace redirect with real route to BooksScreen | Easy |
| Admin challenge scans entire collection | `src/services/adminChallengeService.ts:41-65` | Add `where()` filters for status/moderationStatus | Medium |
| Group leaderboard missing wellness data | `src/features/Groups/GroupLeaderboardScreen.tsx` | Query `wellnessLogs` alongside `workouts` | Medium |

### P2 — Fix Within First Week After Launch

| Issue | Affected Files | Proposed Fix |
|-------|---------------|-------------|
| No React error boundaries | `src/App.tsx` | Add `<ErrorBoundary>` component wrapping `<Suspense>` |
| Notification bell shows static dot | `src/features/Home/HomeScreen.tsx:217` | Drive unread count from `useNotifications` hook |
| Hardcoded receiver phone in donate | `DonateScreen.tsx:10-12` | Move to env var or admin settings |
| ChallengeDetailScreen leaderboard shows UIDs | `ChallengeDetailScreen.tsx:64` | Batch-resolve display names |
| `getVisibleChallengesForUser` loads all groups | `challengeService.ts:418` | Add `where('isPrivate', '==', false)` filter with index |
| Full user list scan in admin | `adminUserService.ts:79` | Add pagination (`startAfter`, `limit(50)`) |

### P3 — Cleanup Later

| Issue | Files |
|-------|-------|
| `removeUndefinedDeep` duplicated | `challengeService.ts`, `workoutService.ts` |
| `firebase-admin` in wrong dependencies block | `package.json` |
| `AdminModulePlaceholderScreen` dead code | `AdminModulePlaceholderScreen.tsx` |
| TTS feature silently missing | `ttsService.ts`, `useBookTts.ts` |
| Missing `404` route | `src/App.tsx:279` |

---

## K. Suggested Refactors

### K1 — `activitiesCompleted` Increment Logic
Both `workoutService.ts` and `wellnessLogService.ts` duplicate identical logic to compute `completionRate`. Extract to a shared utility:
```ts
// src/services/challengeMembershipUtils.ts
export function computeCompletionRate(completed: number, total: number): number {
  return Math.min(100, Math.round((completed / Math.max(1, total)) * 100));
}
```

### K2 — Streak Service Should Accept Both Collections
Refactor `calculateUserStreak` to accept an array of date-keyed log sources rather than hardcoding the `workouts` collection.

### K3 — Admin Services Should Use Firestore Queries, Not In-Memory Filters
All `getPendingX`, `getActiveX`, `getCompletedX` functions should use `where()` clauses and only load the documents they need. This is the single biggest performance improvement available.

### K4 — Notifications Should Be a Subcollection
`notifications/{uid}/{notifId}` would allow real-time listeners, proper pagination, and avoid bloating user documents.

---

## L. Evidence Reference

| Finding | File | Line |
|---------|------|------|
| B2 — memberCount never incremented | `src/services/groupService.ts` | 156–201 |
| B3 — streak ignores wellnessLogs | `src/services/streakService.ts` | 68–148 |
| B4 — full collection scans | `src/services/adminChallengeService.ts` | 41–65 |
| B5 — RequireGroupRoute deadlock | `src/components/Auth/RequireGroupRoute.tsx` | 28–30 |
| B6 — login silent no-op | `src/context/AuthContext.tsx` | 131–141 |
| B7 — activitiesCompleted uncapped | `src/services/workoutService.ts` | 96–98 |
| C1 — hardcoded payment phone | `src/features/Donate/DonateScreen.tsx` | 10–12 |
| C2 — notifications not push | `src/services/notificationService.ts` | 1–80 |
| C4 — admin challenge no groupId | `src/services/adminChallengeService.ts` | 111–173 |
| C6 — BooksScreen unreachable | `src/App.tsx` | 232 |
| D2 — stats.level reset | `src/context/AuthContext.tsx` | 76–82 |
| D4 — window.prompt in admin | `src/features/Admin/AdminPendingChallengesScreen.tsx` | 34 |
| E6 — privilege escalation via users.role | `src/services/adminAccessService.ts` | 174 |
| H6 — createdAt type mismatch | `src/context/AuthContext.tsx` + `adminAnalyticsService.ts` | 75 / 151 |
| G2 — supportTickets no user create rule | `firestore.rules` | 228–231 |

---

*Audit completed 2026-04-05. All findings based on static code analysis of the full repository.*
