# Roles, Permissions and Security

## Role map

| Role | UI capability | Service/backend authority | Rules authority | Finding |
|---|---|---|---|---|
| Anonymous | public/legal/auth/install; public catalogue reads per rules | Firebase Auth entry | catalogExercises and some content readable | public data policy undocumented |
| Authenticated user | core app after profile gate | creates profile/groups/logs/support intents | broad user/group/workout reads | authentication is often treated as sufficient authorization |
| Group member | group detail/feed/challenges/logging | join/leave/react/comment | membership helper in rules | status aliases joined/active complicate checks |
| Group admin | create challenge, invite/manage requests in UI | callable authorization | group update/challenge authority | role management flow absent |
| Group owner | edit/manage/invite/challenge | owner checks | ownerId/role checks | transfer/owner-leave undefined |
| Challenge creator | edit/status actions | challenge service/admin service | createdBy checks | creator vs group-admin boundaries vary |
| Participant | log/progress/leaderboard | client transactions | challengeMember/log rules | derived fields insufficiently server-owned |
| content_manager | catalogue/content admin | admin services | specific rule helpers | two role sources (`admins`, `users.role`) |
| moderator/admin | moderation/admin surfaces | admin services | role helper capabilities | “admin” and “moderator” partially overlap |
| support | donation/support admin surfaces | admin donation/user tools | role-based helpers | support data scope not formally documented |
| super_admin | all admin surfaces/settings/users | client admin services | broad rule helpers | high-impact writes occur from browser |
| Cloud Functions service account | callables/projections/jobs | Admin SDK | bypasses client rules | deployment/IAM/monitoring not audited live |

## Authorization layers

`AdminRoute` is navigation gating only. `adminAccessService` reads `admins/{uid}`; Firestore rules also inspect admin/user roles. Backend callables authenticate and perform group membership/role checks. Storage rules enforce path owner or admin for group/challenge covers. These layers are not generated from one permission source.

## Highest-impact rule findings

1. `challengeMembers` list is allowed to any authenticated user, and client writes are not restricted to a minimal self-owned field set.
2. `workouts` are readable by any authenticated user.
3. `users` are readable by any authenticated user, despite profile privacy toggles.
4. Projection collections read by services (`challengeActivitySummaries`, leaderboards, member stats/home/metrics) have no explicit match blocks in the inspected rules.
5. `groupJoinRequests` reads are broadly authenticated, while writes are callable-only.
6. Catalogue hard deletes are allowed to privileged clients, without lifecycle/version enforcement.
7. Admin mutations for users/groups/challenges/donations/settings are browser-originated and depend on role rules.
8. Storage supports group/challenge cover folders but not the `profile-photos` upload folder used by profile editing; the UI falls back to a data URL.

These are repository rule findings. Whether the modified local `firestore.rules` is deployed is unresolved.

## Security documentation gaps

Missing: data classification, privacy-field enforcement, admin permission constitution, retention/deletion, moderation access, donation financial-data handling, callable abuse/rate limits, incident response, audit logging, production IAM and secrets ownership.
