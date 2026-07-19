# Capability Map — Current State

Status meanings: **active** has a traced UI-to-data path; **partial** has only some layers; **prototype** is not established as runtime data behavior; **absent** was not found.

| Domain | Capability | Status | Runtime evidence | Current boundary/gap |
|---|---|---:|---|---|
| Identity | Email/password registration and login | Active | `AuthContext.tsx`, Login/Signup screens | Account deletion/reauth lifecycle absent |
| Identity | Google sign-in | Active | popup with redirect fallback in `AuthContext` | Provider/linking policy undocumented |
| Identity | Password reset | Active | `sendPasswordResetEmail` in LoginScreen | No in-app password change |
| Profile | Multi-step onboarding/profile completion | Active | onboarding/profile screens, `useProfileSetup`, `users` | State duplicated across flags and nested data |
| Profile | Interests, wellness preferences, goals | Active | hard-coded screen arrays; admin content collections separately | Option sources diverge |
| Profile | Privacy settings | Partial | profile fields/UI | Enforcement in discovery/search is incomplete |
| Groups | Create/edit/discover/join/leave | Active | `groupService`, group screens | Status vocabulary joined/active drift |
| Groups | Private invites and join approval | Active | seven callables, hooks/panel | Backend audit collections are server-only |
| Groups | Roles/permissions | Partial | owner/admin/member storage, creator UI checks | “Coach” UI name; transfer/change-role flow absent |
| Groups | Reports/moderation | Partial | groupReports, adminGroupService | Moderation lifecycle/policy undocumented |
| Challenges | Collective, competitive, streak creation | Active | four-step wizard + callable | All group-scoped; no individual type |
| Challenges | Templates | Active | fitness/wellness template collections | Snapshot lacks template/activity version |
| Challenges | Join/leave/activity logging | Active | challenge/workout/wellness services | Client-owned aggregate risks |
| Challenges | Progress/completion/expiry | Active but contradictory | transactions, triggers, scheduled expiry | Multiple authorities and async edge cases |
| Challenges | Leaderboards | Active but inconsistent | challengeMembers + projection collections | Ranking sources/tie rules diverge |
| Activity | Fitness workout logs | Active | workouts, workoutService/activityLogSession | “Workout” also represents exercise event |
| Activity | Wellness logs | Active | wellnessLogs, wellnessLogService | Separate path with differing validation |
| Social | Feed generation | Active | CF summary triggers → groupActivityFeed | Feed is projection; correction/delete behavior weak |
| Social | Reactions | Active | like/applaud/inspired subcollection | “Applause” is one reaction label, no policy |
| Social | Comments/replies | Active | nested subcollections | Only author deletion; moderation gap |
| Social | Share | Partial | Share screen/browser actions | No governed share event/entity |
| Notifications | In-app list/read state | Partial | embedded `users.notifications.items` | No push/email delivery engine traced |
| Motivation | Daily goals/streaks/milestones | Partial | dailyGoalsService, streakService, metrics | Multiple streak concepts; no governing framework |
| Rewards | XP/reward points | Absent as product | no end-to-end reward loop | Point-like scoring fields remain active internally |
| Knowledge | Fitness catalogue | Active | Firestore `catalogExercises` | local 154 JSON has no runtime fallback |
| Knowledge | Wellness catalogue | Active | Firestore + local 67 fallback | source divergence |
| Knowledge | Admin catalogue CRUD | Active | admin exercise/wellness services | no version/provenance/lifecycle |
| Search | Group/challenge/catalogue filtering | Partial | per-service queries/client filters | no platform search index |
| Recommendations | Personalized recommendations | Prototype/partial | profile preferences and suggestion UI | no governed recommendation engine |
| Analytics | User profile analytics | Active projection/query | userAnalyticsService | metric definitions undocumented |
| Analytics | Admin dashboards | Active | adminAnalyticsService + scheduled metrics | projections and source freshness vary |
| Admin | Users/groups/challenges/content/settings | Active/partial | 40 admin routes, admin services | permissions differ across role tables/rules |
| Moderation | Group/challenge/user reports | Partial | report queues/admin mutations | no unified case/audit policy |
| Donations | Platform support intent | Active in working tree | supportDonations lifecycle | not a payment processor |
| Donations | Challenge pledges | Active/partial | challengeContributionPledges | self-report/confirmation semantics |
| Donations | Payment confirmation | Manual/partial | admin verification statuses | no gateway/webhook/receipt verification |
| Media | Group/challenge cover uploads | Active | Firebase Storage folders/rules | profile-photo folder has no write rule |
| Platform | Settings and system logs | Partial | settings/app, platformSettings/support, systemLogs | fragmented settings ownership |
| Maintenance | Seeds/audits/cleanup/reset/deploy | Present | 101 scripts | write risk; uneven dry-run guarantees |
| Integrations | Firebase platform | Active | Auth/Firestore/Functions/Storage | no external wearable/payment/AI integration traced |
| Security | Rules and backend callables | Active but gaps | Firestore/storage rules, callable auth | client trust and missing projection read rules |
| Jobs | Expiry/metrics/projections/counts | Active code | Functions v2 exports | deployment/runtime schedule not verified |
| Recovery | Error boundary, toast, query retry | Partial | App/ErrorBoundary/services | no durable retry/reconciliation workflow |
| Auditability | system/group audit logs | Partial | systemLogs/groupAuditLogs | no unified audit trail/provenance |
| Library | Multi-source book library | Active/partial | books/libraryBooks/bookLibrary fallback | source-of-truth ambiguity |
