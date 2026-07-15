# Tiizi Full Pilot Readiness Audit - 2026-06-02

## A. Executive Summary

**Overall verdict: Not ready for pilot.** The app builds and TypeScript passes, but the current repository has multiple pilot blockers: Firestore role-escalation risk, onboarding redirect regressions, broad user document writes, manual/unverified payments, notification templates without delivery, and many full-collection admin/discovery reads.

### Biggest 10 risks

1. **P0 security: user self-escalation path exists.** Firestore allows a signed-in user to write their own `users/{uid}` document, while admin rules trust `users.role` and `users.profile.role` (`firestore.rules:7-39`, `firestore.rules:119-122`).
2. **P0 admin authorization inconsistency.** Client admin access reads only `admins/{uid}`, but rules also trust `users.role`; this can produce false access in rules or false denial in UI (`src/services/adminAccessService.ts:151-170`, `firestore.rules:25-96`).
3. **P0 onboarding loop/regression.** An already authenticated user who lands on `/app/signup` without `next` is redirected to `/app/profile/completion`, regardless of `profile.onboardingCompleted` (`src/features/Auth/SignupScreen.tsx:22-30`).
4. **P0 donation/payment is manual and unverified.** Support donations create intents and user-submitted confirmations; admin confirmation is manual, with no payment gateway/webhook verification (`src/services/donationService.ts:82-121`, `src/services/adminDonationService.ts:344-377`).
5. **P0 challenge contribution rules allow arbitrary pledged/skipped records.** Firestore only checks `userId == request.auth.uid` on create, not challenge status, membership, amount, or donation approval (`firestore.rules:289-302`).
6. **P1 notifications are not real delivery.** In-app notifications are arrays embedded on `users/{uid}`; no push, email, scheduler, or event-triggered delivery exists (`src/services/notificationService.ts:26-77`).
7. **P1 public/user reads are overly broad.** Any authenticated user can read all user docs, all workouts, and all challenge member docs (`firestore.rules:119-122`, `firestore.rules:169-191`).
8. **P1 scalability risk from full collection scans.** Groups, challenges, donations, analytics, and admin screens often load whole collections and aggregate client-side (`src/services/groupService.ts:73-82`, `src/services/challengeService.ts:387-391`, `src/services/adminDonationService.ts:120-125`, `src/services/adminAnalyticsService.ts:212-233`).
9. **P1 pilot/debug route exposed to all authenticated users.** `/app/flow` is protected but reachable in production and lists internal flows (`src/App.tsx`, `src/features/Flows/FlowHubScreen.tsx:8-29`).
10. **P1 no lint script.** `npm run lint` is missing, so style/static checks are not part of readiness (`package.json:6-28`).

### Recommended next 5 fixes

1. Lock Firestore role writes: split user profile writes from privileged fields, remove `users.role`/`users.profile.role` from rule trust, and allow admin roles only from `admins/{uid}`.
2. Fix onboarding redirects: signup should send authenticated completed users to `/app/home`, not `/app/profile/completion`; route decisions must read `profile.onboardingCompleted`.
3. Gate donation pledges in rules: require active group membership, approved active donation challenge, bounded amounts, immutable ownership, and admin-only confirmation.
4. Label or disable payment surfaces for pilot until verification exists; keep only clearly manual/unverified flows.
5. Add pagination/limits for admin lists, discovery, analytics, donations, groups, and challenges.

## B. Pilot Readiness Scorecard

| Area | Status | Risk Level | Notes | Recommended Action |
|---|---|---:|---|---|
| Build/TypeScript | Passing | Low | `npm run build` and `npx tsc -b` pass. | Keep as release gate. |
| Linting | Missing | Medium | `npm run lint` does not exist. | Add ESLint or document no-lint policy. |
| Auth | Mostly complete | Medium | Email/password and Google exist; Apple disabled. | Pilot with email/Google only. |
| Profile/onboarding | Broken/risky | High | Authenticated `/app/signup` redirects to onboarding by default. | Fix before pilot. |
| Security rules | Broken | Critical | User self-write + role trust is a role escalation risk. | Fix before any pilot. |
| Admin dashboard | Partial | High | Many modules exist but depend on broad reads and client-side aggregates. | Use internal-only after security fix. |
| Groups | Mostly complete | Medium | Create/join/leave exist; counters can drift. | Add moderation and counter repair checks. |
| Challenges | Mostly complete | High | Donation-enabled challenges are approval gated in app, but rules are weaker for pledges. | Harden rules and indexes. |
| Logs/activity tracking | Mostly complete | Medium | Workout/wellness logs write, but completion counters can overcount repeated logs. | Add per-activity/day idempotency. |
| Streaks/leaderboards | Partial | Medium | Derived from client reads and membership summaries. | Verify with seeded production-like data. |
| Notifications | Partial | High | In-app only; no push/email delivery. | Pilot as in-app/manual only. |
| Donations/payments | Risky | Critical | No payment verification; manual admin confirmation only. | Label manual or disable. |
| Deployment/Firebase | Mostly complete | Medium | Hosting/rules/indexes configured; no CI evidence. | Add deploy checklist and rules tests. |
| Scripts/seed/reset | Risky | High | Reset scripts exist with `:apply`; dangerous if pointed at prod. | Add production guardrails. |

## C. P0 Blockers

1. **Role escalation through user document writes.** A normal user can write `users/{uid}` (`firestore.rules:119-122`) and rules trust `users.role` plus `users.profile.role` (`firestore.rules:7-39`). This can grant admin/rule permissions if a user writes privileged fields.
2. **Onboarding redirect sends authenticated users back to setup.** `SignupScreen` defaults `nextPath` to `/app/profile/completion` and redirects any authenticated user there (`src/features/Auth/SignupScreen.tsx:22-30`).
3. **Donation/payment cannot be treated as verified.** User-created support donations and user-entered transaction IDs become pending records, then admins manually confirm (`src/services/donationService.ts:82-121`, `src/services/adminDonationService.ts:344-377`).
4. **Challenge contribution writes are not rule-hardened.** `challengeContributionPledges` creation only checks ownership, not group membership, challenge approval, active status, or positive/bounded amounts (`firestore.rules:289-302`).

## D. P1 High Priority

- Restrict user/profile reads; current rules let any authenticated user read all `users`, workouts, and challenge memberships.
- Remove `/app/flow` from production or gate it to admins only.
- Replace full collection scans with paginated/indexed queries for groups, challenges, users, donations, and analytics.
- Add lint/static analysis and Firestore rules tests.
- Add notification delivery clarity: in-app only vs push/email.
- Add production safety prompts/guards to reset and cleanup scripts.

## E. P2 Post-pilot Improvements

- Improve loading/error states and retry handling across admin lists.
- Replace `window.prompt`/`window.confirm` flows with app modals.
- Move embedded notifications from `users.notifications.items` to a subcollection.
- Add CI with build, typecheck, lint, smoke audit, rules tests, and secret scan.
- Add backend aggregation or scheduled repair jobs for counters and analytics.

## F. Security Findings

| Severity | Finding | Affected files | Risk | Recommended fix |
|---|---|---|---|---|
| Critical | User self-write can set privileged fields trusted by rules. | `firestore.rules:7-39`, `firestore.rules:119-122` | Role escalation/admin access. | Permit self-updates only to whitelisted profile fields; trust roles only from `admins/{uid}`. |
| Critical | Pledge create rules do not enforce donation approval or membership. | `firestore.rules:289-302` | Fake pledges, donation abuse, incorrect campaign totals. | Mirror service checks in rules and make confirmation admin-only. |
| High | Any authenticated user can read all users/workouts/challenge members. | `firestore.rules:119-191` | Privacy exposure. | Scope reads to owner, same-group visibility, or admin. |
| High | Admin role model split across `admins` and `users`. | `src/services/adminAccessService.ts`, `src/services/adminSettingsService.ts` | UI/rules mismatch. | Use one canonical admin collection. |
| Medium | Storage fallback allows persisted base64 profile image in Firestore. | `src/features/Profile/ProfileCompletionScreen.tsx` | Large user docs and privacy/data bloat. | Require Storage upload or small avatar URL only. |

## G. Data Integrity Findings

- `AuthContext.ensureUserDocument` rewrites `createdAt` during periodic sync (`src/context/AuthContext.tsx:65-78`), which can corrupt signup analytics.
- Group member counts use increments on join/leave and separate membership docs; drift is possible on retries or failed partial writes (`src/services/groupService.ts:140-221`, `src/services/groupService.ts:251-260`).
- Challenge member completion increments once per log, not per unique required activity/day; repeated logs can complete a challenge early (`src/services/workoutService.ts`, `src/services/wellnessLogService.ts`).
- Donation reports mix confirmed platform support, legacy transactions, and pledged challenge contributions; challenge pledges are counted as pending, not verified money (`src/services/adminDonationService.ts:411-463`).
- Timestamp formats are mixed: strings, Firestore `Timestamp`, and date-only strings are all present, increasing query/index confusion.

## H. Performance / Scalability Findings

- `groupService.getGroups()` reads the full `groups` collection and sorts client-side (`src/services/groupService.ts:73-82`).
- `challengeService.getChallenges()` reads the full `challenges` collection (`src/services/challengeService.ts:387-391`).
- `challengeService.getVisibleChallengesForUser()` reads all groups to find public groups (`src/services/challengeService.ts:413-421`).
- `adminDonationService.getCampaigns()` reads all donation campaigns, all donation-enabled challenges, and all pledges (`src/services/adminDonationService.ts:120-125`).
- `adminAnalyticsService.getOverviewMetrics()` mixes count queries with full reads of challenges, groups, support donations, pledges, and transactions (`src/services/adminAnalyticsService.ts:212-233`).
- `notificationService` stores up to 100 notification items inside the user doc; this creates large-document and concurrent-write risk (`src/services/notificationService.ts:20-77`).

## I. Feature Completion Map

| Feature | Current State | Evidence | Pilot Risk | Recommendation |
|---|---|---|---|---|
| Auth | Mostly complete | Login/signup/Google routes exist. | Medium | Fix authenticated signup redirect. |
| Profile/onboarding | Broken | Signup redirects authenticated users to completion. | High | Fix before pilot. |
| Groups | Mostly complete | Create/join/leave/report services exist. | Medium | Add counter repair and moderation checks. |
| Group moderation | Partial | Admin moderation screens and reports exist. | Medium | Verify with rules after role fix. |
| Challenges | Mostly complete | Create/join/detail/logging exists. | High | Harden donation and member rules. |
| Challenge templates | Mostly complete | Admin templates service/screens exist. | Medium | Add validation and pagination. |
| Exercises | Mostly complete | Catalog and admin CRUD exist. | Medium | Confirm permissions after role fix. |
| Wellness activities | Mostly complete | Admin CRUD and user logging exist. | Medium | Add idempotency. |
| Logs/activity tracking | Mostly complete | Workout/wellness writes update member stats. | Medium | Prevent duplicate completion inflation. |
| Streaks | Partial | Service/hook exists, but no audit evidence of durable streak model. | Medium | Validate with scenario tests. |
| Leaderboards | Partial | Uses activity summaries/counts. | Medium | Validate aggregation correctness. |
| Notifications | Partial | In-app user doc array only. | High | Do not promise push/email. |
| Challenge donations | Risky | App blocks until approval, rules do not fully enforce. | Critical | Rules + verification required. |
| Platform support donations | Risky | Manual payment note and admin confirmation. | Critical | Label manual/unverified. |
| Admin analytics | Partial | Full reads and derived metrics. | High | Limit to internal testing or aggregate server-side. |
| Content pages | Partial | Admin content screens exist. | Low | Verify public consumption. |
| Support tickets | Placeholder/risky | Rules allow admin-only read/write; no user create path observed. | Medium | Add user submission flow or hide. |
| System settings | Partial | Admin settings exist. | Medium | Require super admin and audit logs. |

## J. Deployment / Firebase Readiness

- `firebase.json` includes Firestore rules/indexes, Storage rules, and SPA hosting rewrites (`firebase.json:1-23`).
- `firestore.indexes.json` covers several group/challenge/workout/wellness queries, but not all admin analytics/donation query patterns.
- `.env.example` includes Vite Firebase variables and firebase-admin script variables.
- `package.json` has deploy scripts for hosting and Firestore, but no CI script or lint script (`package.json:6-28`).
- Reset/cleanup scripts include `:apply` commands and should be guarded against production project IDs.

## K. Notification Readiness

- In-app notifications: **partially delivered** by writing `users/{uid}.notifications.items`.
- Push notifications: **not implemented**. No FCM token collection or send path found.
- Email notifications: **not implemented**. No email provider or function trigger found.
- Event triggers: **not implemented**. Challenge reminders are only created when client code calls the hook.
- Templates: **configuration only** from `notificationTemplates`; no delivery engine found.
- Safe pilot label: **"In-app reminders only; push/email not available."**

## L. Donation / Payment Readiness

- Real payment verification: **No.**
- Donation intents vs confirmed: **Partially separated** for platform support (`intent`, `pending_confirmation`, `confirmed`).
- Admin confirmations: **Yes, manual only** for platform support.
- Hardcoded payment details: default settings are generic; live payment details are admin-configured.
- Challenge donations blocked until admin approval: **Client service checks yes; Firestore pledge rules insufficient.**
- Platform support separated from challenge donations: **Yes by collection/source, but reports combine categories.**
- Safe pilot label: **"Manual/unverified contribution tracking; Tiizi does not verify payment automatically."**

## M. Route & Screen Audit

- `/app/signup`: risky for already authenticated users; redirects to onboarding completion by default.
- `/app/flow`: production-reachable internal flow hub for authenticated users.
- `/mockups` and mockup aliases: guarded by `import.meta.env.DEV`, safe for production build.
- `/app/admin/*`: gated by `AdminRoute`, but rule-level role escalation must be fixed first.
- `/app/donate`: usable, but payment is manual/unverified.
- `/app/profile/completion`, `/app/profile/interests`, `/app/profile/privacy-settings`, `/app/profile/setup-finish`: onboarding screens exist but are not governed by a consistent completed/incomplete router decision.

## N. Recommended Fix Plan

**Fix 1: Firestore role/security hardening**
- Remove `hasUserRole` and `hasProfileRole` from admin decisions.
- Restrict `users/{uid}` self-writes to profile-safe fields only.
- Add rules tests for failed self-escalation.

**Fix 2: Onboarding redirect repair**
- Load profile setup status after auth.
- Redirect authenticated completed users away from `/app/signup` and `/app/profile/completion` to `/app/home`.
- Preserve new-user onboarding start after true signup only.

**Fix 3: Donation pledge and payment safety**
- Mirror donation approval/membership/amount checks in `challengeContributionPledges` rules.
- Disable or clearly mark manual payments in pilot.
- Require admin-only confirmation for confirmed payment states.

**Fix 4: Notification truth-in-product**
- Hide push/email wording unless implemented.
- Move templates behind "configuration only" copy or wire a delivery service.
- Convert in-app notifications to a subcollection if pilot volume grows.

**Fix 5: Scalability pass**
- Add `limit`, pagination, ordering, and filters to group/challenge/admin/donation lists.
- Replace large client aggregations with count queries or server-maintained summary docs.
- Add missing indexes after query changes.

## O. Commands Run

| Command | Result |
|---|---|
| `git status --short` | Dirty worktree with many modified/deleted/untracked files, including `firestore.rules`, `firestore.indexes.json`, `src/App.tsx`, many admin/user services, and new `src/components/ErrorBoundary.tsx`. |
| `git branch --show-current` | `fix/p0-pre-deploy-blockers` |
| `npm run build` | Passed. Ran `tsc -b && vite build`; Vite built production assets successfully. |
| `npx tsc -b` | Passed with no output. |
| `npm run lint` | Failed because script is missing: `npm error Missing script: "lint"`. npm also reported it could not write logs to `/Users/theo/.npm/_logs`. |
| `rg` risky pattern scan | Found `window.prompt`, `window.confirm`, full collection reads, TODO/placeholder strings, Firebase env usage, role/admin patterns, donation and notification collections. |

