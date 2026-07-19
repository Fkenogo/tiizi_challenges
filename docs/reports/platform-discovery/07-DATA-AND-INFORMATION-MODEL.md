# Data and Information Model

## Authoritative storage map

| Entity | Location | Creators/writers | Readers | Lifecycle/source concern |
|---|---|---|---|---|
| User/profile/onboarding/notifications | `users/{uid}` | AuthContext, profile/daily goal/notification services, admins/functions | user/admin/home/profile | unrelated domains embedded in one mutable doc |
| Admin identity | `admins/{uid}` plus `users.role` | adminSettingsService/admin rule | AdminRoute/rules | duplicated role ownership |
| Groups | `groups/{id}` | client groupService; admin service | group/challenge/admin UI | active/inactive plus moderationStatus |
| Memberships | `groupMembers/{groupId_uid}` | client join/create/leave; callables; admin | group gates, analytics, functions | joined/active compatibility and left/expelled states |
| Invites | `groupInvites` | callables only | callable only | server-only by rules |
| Join requests | `groupJoinRequests` | callables | authenticated list + callable | list rule broader than owner/admin need |
| Group audit | `groupAuditLogs` | callables/functions | no client read | operational ownership absent |
| Challenges | `challenges/{id}` | creation callable; creator/admin; log transactions | members/discovery/admin | snapshots but no catalogue/template version |
| Challenge members | `challengeMembers/{challengeId_uid}` | callable/client transaction/functions | broad authenticated list | client-owned progress fields |
| Fitness activity event | `workouts/{id}` | authenticated client | authenticated users/admin/functions | broad read; “workout” is an event, not only routine |
| Wellness event | `wellnessLogs/{id}` | authenticated client | challenge/group participants | distinct validator/schema |
| Challenge summary | `challengeActivitySummaries/{challengeId}` | functions | home/detail/hooks | no explicit inspected read rule |
| Challenge/group leaderboards | `challengeLeaderboards`, `groupLeaderboards` | functions | feed/home/leaderboards | no explicit inspected read rule |
| Member stats/home/metrics | `groupMemberStats`, `memberHome`, `userMetrics` | functions | home/profile/group | projection freshness and rule coverage |
| Feed | `groupActivityFeed` | functions | group members | immutable client; projection correction gap |
| Reactions/comments/replies | nested below feed item | authenticated members | feed members | limited moderation |
| Fitness knowledge | `catalogExercises` | admin exercise service/seeds | runtime exercise service/public read | local JSON divergence; no versions |
| Wellness knowledge | `wellnessActivities` + local fallback | admin/seeds | authenticated runtime | Firestore/local divergence |
| Templates | `challengeTemplates`, `wellnessTemplates` | admin/seeds | authenticated users | mutable source; launch copies without version |
| Interest/goal content | `exerciseInterests`, `wellnessGoals` | content admin | admin/read public | onboarding screens also hard-code arrays |
| Content/library | `contentPages`, `books`, `libraryBooks`, `bookLibrary` | admin/local | user library | three collection fallbacks |
| Notifications | embedded `users.notifications.items`; `notificationTemplates` | client/content admin | current user/admin | no event/delivery entity |
| Reports/tickets | `groupReports`, `supportTickets` | users/admin | admin | no unified moderation case model |
| Support donations | `supportDonations`, preferences | user/admin/functions | owner/admin | intent vs verified payment distinction |
| Challenge pledges | `challengeContributionPledges` | user | participant/admin | confirmation semantics ambiguous |
| Donation admin legacy | `donationCampaigns`, `donationTransactions` | super admin/legacy | admin analytics | overlaps challenge donations/support |
| Settings | `settings/app`, `platformSettings/support` | admins | admin/all authenticated for support | fragmented configuration |
| Logs | `systemLogs` | admin clients | privileged admins | not immutable creator-only after create rule, but no backend provenance |
| Media | Storage `group-covers/{uid}`, `challenge-covers/{uid}` | authenticated path owner/admin | public | profile-photos not permitted by storage rule |

## Denormalisation and lifecycle observations

Challenges snapshot activity identity/name/metric data, but not a version or provenance. Member progress, challenge totals, activity summaries, leaderboard rows, group member stats, home metrics and feed items repeat derived data across documents. Write-time transactions and asynchronous functions both participate, so stale or contradictory projections are possible.

Deletion semantics are inconsistent: social authors can delete comments/replies; reactions can be removed; groups are normally left/deactivated rather than deleted; challenges expose delete permissions but no governed archive; catalogue admin supports hard delete; knowledge governance documents require deprecation/archive but runtime does not.

Timestamps mix ISO strings, Firestore timestamps and derived client dates. Status fields use overlapping vocabularies without a shared state standard.

## Unsafe ownership signals

Firestore rules allow authenticated listing of all challengeMembers and reading all workouts. Member/log create/update rules do not comprehensively constrain all progress/aggregate fields to server-owned derivation. User documents are broadly readable by authenticated users. These are current rule observations, not a claim about deployed rules.
