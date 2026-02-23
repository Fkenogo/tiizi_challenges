# Tiizi Screen Status

Purpose: current source of truth for native screen coverage and future generation needs.

## 1) Active Placeholder Routes

None.

All previously placeholder-backed flows in the current roadmap have been migrated to native `/app/*` routes.

## 2) Native Routes Implemented

### Core App
- `/app/login`
- `/app/signup`
- `/app/home`
- `/app/exercises`
- `/app/exercises/:id`
- `/app/groups`
- `/app/group/:id`
- `/app/challenges`
- `/app/challenge/:id`
- `/app/create-group`
- `/app/join-group`
- `/app/create-challenge`
- `/app/workouts/select-activity`
- `/app/workouts/log`
- `/app/workouts/success`
- `/app/profile`
- `/app/quick-actions`
- `/app/flow`

### Support / Utility
- `/app/notifications`
- `/app/help`
- `/app/share`
- `/app/donate`
- `/app/welcome`

### Profile Subscreens
- `/app/profile/personal-info`
- `/app/profile/privacy-settings`
- `/app/profile/completion`
- `/app/profile/interests`
- `/app/profile/setup-finish`

### Group Subscreens
- `/app/group/:id/feed`
- `/app/group/:id/members`
- `/app/group/:id/leaderboard`
- `/app/group/:id/challenges/highlighted`

### Challenge Variant Subscreens
- `/app/challenges/suggested`
- `/app/challenges/preview`
- `/app/challenges/competitive`
- `/app/challenges/collective`
- `/app/challenges/streak`
- `/app/challenges/leaderboard`
- `/app/challenges/completed`

### Admin
- `/app/admin/dashboard`
- `/app/admin/challenges/pending`
- `/app/admin/challenges/approved`
- `/app/admin/challenges/templates`
- `/app/admin/challenges/active`
- `/app/admin/challenges/create`
- `/app/admin/challenges/analytics`
- `/app/admin/exercises`
- `/app/admin/exercises/add`
- `/app/admin/exercises/:id/edit`
- `/app/admin/exercises/import`
- `/app/admin/exercises/stats`
- `/app/admin/users`
- `/app/admin/users/:uid`
- `/app/admin/users/analytics`
- `/app/admin/users/support-tickets`
- `/app/admin/groups`
- `/app/admin/groups/:id`
- `/app/admin/groups/moderation`
- `/app/admin/donations/campaigns`
- `/app/admin/donations/transactions`
- `/app/admin/donations/reports`
- `/app/admin/content/interests-goals`
- `/app/admin/content/onboarding`
- `/app/admin/content/notifications`
- `/app/admin/analytics`
- `/app/admin/analytics/user-growth`
- `/app/admin/analytics/engagement`
- `/app/admin/analytics/revenue`
- `/app/admin/settings`
- `/app/admin/settings/admin-users`
- `/app/admin/settings/logs`

## 3) Migration Summary

- P0 complete: notifications/help/share
- P1 complete: profile personal-info/privacy/completion/interests
- P2 complete: group feed/members/leaderboard/highlighted
- P3 complete: suggested/preview/competitive/collective/streak
- P4 complete: welcome/admin pending/admin approved/donate
- P5 complete: admin dashboard foundation + role permissions + persisted moderation
- P6 complete: admin exercises module (list/add/edit/import/stats)
- P7 complete: admin users module (list/detail/suspend-activate)
- P8 complete: admin groups module (list/detail/moderation actions)
- P9 complete: admin analytics module (overview/user-growth/engagement)
- P10 complete: admin settings module (app config/admin users/system logs)
- P11 complete: admin challenge module expansion (templates/active/create/analytics)
- P12 complete: admin user module expansion (user analytics/support tickets)
- P13 complete: admin group moderation queue screen
- P14 complete: admin donations module (campaigns/transactions/reports)
- P15 complete: admin content module (interests-goals/onboarding/notifications)
- P16 complete: admin revenue analytics screen
- P17 complete: onboarding/auth/profile flow refresh (welcome, signup, step 1/2/3 + setup-finish)
- P18 complete: workout logging and completion flow refresh (select activity -> log workout -> success -> completion + challenge leaderboard + group completion card)
- P19 complete: group-first model enforcement (active-group route guard + groups list/create/join rebuild + tabbed group detail feed/challenges/members/leaderboard + private-group pending approval path)
- P20 complete: membership-aware access control (challenge/workout routes require joined membership; pending/non-members redirected to group detail)

## 4) Remaining Generation Backlog (Optional / New Scope)

No required screens remain for the currently defined roadmap.

If you expand scope, add new targets here using this format:

| Priority | Proposed Route | Source Reference | Status |
|---|---|---|---|
| Px | `/app/...` | mockup slug or spec section | Pending |

## 5) Journey Audit Matrix (Compact)

Status key:
- `Working`: routes exist and are linked end-to-end.
- `Partial`: route exists but UX/data continuity still needs refinement.
- `Missing`: route or critical step not implemented.

| Journey | Entry | Core Path | Exit/Success | Status | Main Gaps | Next Action |
|---|---|---|---|---|---|---|
| Auth + Welcome | `/app/welcome` | `/app/signup` or `/app/login` → onboarding flow | Authenticated onboarding entry | Working | Apple auth still placeholder | Add Apple provider integration when needed |
| Profile Completion | `/app/profile/completion` | step1 → `/app/profile/interests` → `/app/profile/privacy-settings` → `/app/profile/setup-finish` | Onboarding completed then home | Working | Profile photo upload is UI-only | Add storage upload + profile photo persistence |
| Profile Settings | `/app/profile` | personal-info/privacy/interests/help | Back to profile | Working | Basic persistence in place; no server-side validation/audit trail | Add schema validation and profile update timestamps |
| Support + Donate | `/app/profile` | help `/app/help`, donate `/app/donate` | Return to profile | Partial | Donate is non-transactional mock flow | Integrate real payment flow when ready |
| Notifications | `/app/home` bell | `/app/notifications` | Return to home | Working | Uses local in-memory list | Optionally bind to Firestore notifications |
| Groups Discovery | `/app/groups` | tabs: My Groups / Discover / Invites | open/join/request group | Working | Invite deep links still UI-level prompt | Add universal-link invite token ingestion |
| Group Deep Flows | `/app/group/:id` | tabbed hub: feed/challenges/members/leaderboard | continue challenge/log from group context | Working | Feed reactions/comments are mock interactions | Add persisted feed reactions and comments |
| Challenge Discovery | `/app/challenges?groupId=...` | variants (`suggested/preview/competitive/collective/streak`) | challenge detail/create | Working | Public challenge catalog still visible via direct links if group context present | Keep strict group guard, add membership-state checks on server |
| Challenge Participation | `/app/challenge/:id?groupId=...` | detail → log workout → exercises | Back to group challenge | Working | Basic aggregated progress only; no trend/history visuals yet | Add per-period trend widgets and workout history list |
| Exercise Library | `/app/exercises` | filters/search → detail | return/back flows | Working | Catalog-backed; no personalized ranking | Optional recommendation ranking layer |
| Admin Moderation | `/app/admin/dashboard` | dashboard → pending moderation → approved/templates/active/create/analytics | moderated challenge states updated | Working | Firestore rules are role-hardened; high-risk actions still execute directly from client | Move high-risk admin actions to callable Cloud Functions |
| Admin Exercises | `/app/admin/exercises` | list → add/edit/import/stats | catalog admin operations complete | Working | Bulk import is sequential and can be optimized for large files | Add batched import + rollback report support |
| Admin Users | `/app/admin/users` | list → user detail/analytics/support tickets → suspend/activate | user account status updated | Working | Pagination controls not yet implemented | Add paging and advanced filter presets |
| Admin Groups | `/app/admin/groups` | list → group detail/moderation queue → moderation actions | group moderation status/feature flags updated | Working | No member role management yet | Add member role controls |
| Admin Donations | `/app/admin/donations/campaigns` | campaigns → transactions/reports | donation oversight baseline visible | Working | No campaign create/edit UI yet | Add campaign create/edit + export actions |
| Admin Content | `/app/admin/content/interests-goals` | interests/goals → onboarding → notifications | content governance baseline visible | Working | Edit/reorder actions not yet exposed in UI | Add CRUD + reorder actions |
| Admin Analytics | `/app/admin/analytics` | overview → user-growth / engagement / revenue | admin analytics baseline visible | Working | No charting library visuals yet; tabular KPI presentation only | Add chart components and exportable reports |
| Admin Settings | `/app/admin/settings` | app config → admin users → system logs | settings + audit controls available | Working | Action-level controls are in place; change approval workflow not implemented | Add settings change approval workflow for sensitive actions |
| Quick Actions Hub | `/app/quick-actions` | links into all core journeys | route-specific destination | Working | Mostly navigation launcher | Keep as control panel for audits |

## 6) Immediate Work Queue

1. Add challenge progress trend/history views for deeper engagement analytics.
2. Move high-risk admin actions (moderation, role changes, bulk import) to callable Cloud Functions with server-side validation.
3. Enforce membership-state checks server-side for challenge/log routes (joined vs pending/rejected).
4. Add profile schema validation and update timestamps for governance/auditability.
