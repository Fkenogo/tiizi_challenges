# User Journey and Flow Catalogue

## Trace convention

Each flow is recorded as trigger → UI → validation → service/backend → data → downstream effects. A dash means no repository evidence was found.

## Identity and profile flows

| Flow | Trace | State/side effects | Failure/recovery | Gaps |
|---|---|---|---|---|
| Register | SignupScreen → AuthContext.create user → Firebase Auth → `users/{uid}` merge | user status active; onboarding begins | Firebase error mapping/toast | account terms/version consent not persisted |
| Login | LoginScreen → AuthContext sign-in/Google → next route | Auth listener hydrates user | Firebase error mapping; Google redirect fallback | session/security policy undocumented |
| Password reset | forgot modal → Firebase email | out-of-band reset | modal success/error | no reset audit |
| Logout | Profile → AuthContext.signOut → login | local auth cleared | client error handling | no server session revocation |
| Onboard | intro → personal info → exercise interests → wellness → goals → privacy → finish | incremental merges into `users`; completion flags | screens hydrate saved state; retry toast | option sources hard-coded; state flags drift |
| Edit profile | profile/edit → upload/fields/preferences → patch writer | nested user profile update | data URL fallback when upload fails | fallback may create large user docs; privacy enforcement unclear |

## Group flows

| Flow | Trace | State/side effects | Failure/recovery | Gaps |
|---|---|---|---|---|
| Create | CreateGroup screens + validation → groupService.create | `groups` then owner `groupMembers` | two client writes can partially succeed | callable/transaction not used |
| Public join | Group detail/header → groupService.join | member pending or active; group memberCount increment | existing states normalized | duplicated with callable request path |
| Private invite | owner panel → callable create/list/revoke/redeem | groupInvites, groupMembers, audit logs | backend validates token/expiry/use count | invitation notification absent |
| Join request | UI → request/approve/reject callables | groupJoinRequests pending→approved/rejected; membership | backend authorization | role vocabulary and rejection recovery undocumented |
| Leave | header → groupService.leave | groupMember left; group memberCount decrement | error toast | owner leave/ownership transfer not governed |
| Edit | owner-visible edit UI → updateDoc group | mutable metadata | service validation | rule allows broader owner/admin writes |
| Report/moderate | member report → groupReports → admin queue/service | open→reviewed/resolved; group active/inactive + moderationStatus | admin UI | policy, appeal and evidence retention absent |

## Challenge/activity flows

The complete challenge trace is in `docs/reports/challenge-creation-and-runtime-engine-audit.md`.

| Flow | Trace | State/side effects | Principal gap |
|---|---|---|---|
| Create | group CTA → four-step wizard/template prefill → validators → `createChallengeWithCreatorMembership` callable | challenge + creator challengeMember written atomically | activity/template versions absent |
| Join | detail → challengeService join transaction | challengeMember active; user projections | client/rules trust boundaries |
| Log fitness | picker/form → activityLogSession/workoutService transaction | workout + challengeMember progress + possibly challenge aggregate | duplicate/correction/idempotency absent |
| Log wellness | activity form → wellnessLogService transaction | wellnessLog + member progress | parallel behavior differs from fitness |
| Collective progress | log transaction + async summary trigger | challenge total/percentage and projections | two timing/authority paths |
| Competitive rank | members and leaderboard projections → screens | raw/normalized fields/tie ordering | multiple ranking sources |
| Streak | qualifying log date → member streak fields | current/longest streak, completion | any-one log vs UI “activities”; timezone undefined |
| Complete/expire | transaction completion or scheduled expiry | member/challenge statuses, recap/feed projections | final log may be skipped by async trigger |
| Leave | service membership status abandoned | participation stops | contribution retention/removal semantics unclear |
| Edit | creator/admin service status/content updates | challenge mutation | launched snapshot/version and participant notice absent |

## Social and notification flows

| Flow | Trace | Writes | Gap |
|---|---|---|---|
| Feed generation | workout/wellness/member trigger → memberActivitySummaries → groupActivityFeed | server projections | update/delete reconciliation incomplete |
| React | FeedCard → feedReactionService | deterministic reaction doc by user | no moderation/rate-limit policy |
| Comment/reply | FeedCard → feedCommentService | nested comments/replies | no admin moderation flow |
| Notify | NotificationsScreen/service | embedded bounded array in user doc | no event-driven delivery, channel preference or backend author |
| Share | Share screen/browser clipboard | no durable platform entity traced | no privacy/audit/link lifecycle |

## Donation/support flows

| Flow | Trace | State | Evidence-based limitation |
|---|---|---|---|
| Support CTA | Profile/DonateScreen → platform settings → support intent builder/service | supportDonations `intent` | records intention, not payment |
| User reports sent | DonateScreen → mark sent | `sent_reported` + timestamp | self-report is not verification |
| Abandon | pending intent → abandon | `abandoned` | terminal handling only partly guarded |
| Admin verify/reject/refund/flag/note | Admin PlatformSupport → adminDonationService | reviewed status/metadata | client-admin write; no payment gateway |
| Challenge pledge | challenge donation UI/service | pledged/confirmed/skipped | “confirmed” is user confirmation, not settlement |
| Reporting | admin services + donation summary trigger | aggregates/views | mixed legacy statuses and currencies |

## Missing or incomplete lifecycle flows

No complete evidence was found for user account deletion, group ownership transfer, member role change, challenge pause/cancel/archive, activity correction/deletion propagation, notification delivery acknowledgment, content appeal, knowledge deprecation migration, or verified payment settlement.
