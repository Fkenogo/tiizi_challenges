# Application Surface Catalogue

## Route architecture

`src/App.tsx` wraps the application in `QueryClientProvider → AuthProvider → ToastProvider → BrowserRouter → ErrorBoundary → Suspense`. `RouteWarmup` prefetches daily goals, groups and challenges after authentication.

The complete line-level route register is `evidence/route-evidence.tsv`. Routes fall into these surfaces:

| Surface | Representative routes | Gate | Principal implementation/data |
|---|---|---|---|
| Public/legal | `/install`, `/terms`, `/privacy` | None | Static screens |
| Authentication | `/app/login`, `/app/signup`, `/app/welcome` | Public; redirects after auth | `AuthContext`, Firebase Auth |
| Onboarding | `/app/onboarding/intro`, profile completion/interests/wellness/goals/privacy/finish | `RequireOnboarding` | `users/{uid}` profile setup |
| Home/quick actions | `/app/home`, `/app/flow`, `/app/quick-actions` | Auth + profile | summaries, challenges, groups, daily goals |
| Groups | list, create, detail, edit, challenges, members, invites, feed | Auth/profile; some member gating | groups, groupMembers, callable invite/join backend |
| Challenges | list, create, detail, type views, activity picker/logging, leaderboard, completed/history | Auth/profile; group gate for creation/logging | challenge service, callable creator transaction, workouts/wellnessLogs |
| Catalogues/workouts | exercises, wellness activities, workouts and details | Auth/profile | Firestore catalogues, local wellness fallback, workout services |
| Social | group feed and card interactions | Group membership/rules | groupActivityFeed projections, reactions, comments/replies |
| Profile/settings | profile, edit, analytics, privacy, notifications, support | Auth/profile | users, metrics, donations |
| Library/help/share | books/detail, help, share | Auth/profile | multi-collection book fallback and local/UI behavior |
| Admin | dashboard, analytics, users, groups, challenges/templates, fitness/wellness, content, donations, settings/logs | `AdminRoute` permission profile | admin services and rules |
| Development | `/mockups`, `/mockups/:slug`, aliases | Present in route graph | prototype/mockup catalogue |
| Error/fallback | suspense loader, ErrorBoundary, wildcard redirect | Contextual | client recovery/navigation |

## Entry and gating observations

- `RequireProfileSetup` controls post-auth profile completion from a `users` document.
- `RequireGroupRoute` resolves group context from query string or local storage and checks membership.
- `AdminRoute` reads `admins/{uid}` via `useAdminPermissions`; UI gating is separate from Firestore rules.
- Private group members and detail screens apply UI checks, while Firestore rules are the actual authorization boundary.
- Dev mockup routes are part of the built route graph unless environment/deployment configuration excludes them; deployment exposure is unresolved.
- Screens contain hard-coded onboarding interests/goals in addition to admin-managed content collections, creating multiple option sources.

## Surface gaps

Account deletion, ownership transfer, member role editing, challenge pause/cancel/archive, notification preferences/delivery channels, and user-facing moderation recovery do not appear as complete end-to-end flows. Some labels imply capabilities (sharing, verification, rewards) that are UI-only or incomplete.
