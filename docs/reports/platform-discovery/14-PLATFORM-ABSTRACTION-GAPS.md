# Platform Abstraction Gaps

This section identifies narrow current concepts; it does not design replacements.

| Current narrow implementation | Broader concept requiring governance | Evidence | Affected flows | Migration risk |
|---|---|---|---|---|
| `workouts` stores individual fitness activity events | Governed activity event independent of domain | workoutService/types/logging | logging, progress, analytics | legacy event compatibility |
| Separate fitness and wellness log engines | Cross-domain measurement contract | workouts vs wellnessLogs/services | challenge logging/completion | behavior divergence |
| Exercise/wellness catalogue IDs copied without version | Versioned knowledge reference/snapshot | challenge activity snapshot | creation, history, audit | historical meaning changes |
| Hard-coded profile “exercise interests” | Governed interests/preferences | onboarding/edit arrays vs admin content | onboarding, recommendations, groups | ID/name mismatch |
| Fitness-oriented metrics drive challenge logic | Domain-neutral measurable contribution | challenge types/metric/unit handling | all challenges | unsuitable future domains |
| Group role “Coach” displayed over owner/admin/member | Governed social role and permission vocabulary | GroupMembersScreen/types/rules | invitations, editing, moderation | UI/data contradiction |
| Feed components define reactions and replies | Community content domain/lifecycle | feed subcollections/services | engagement/moderation | retention and abuse |
| Daily goals, challenge streaks and profile analytics are separate | Motivation/progress framework | dailyGoalsService, streakService, metrics | home/profile/challenges | conflicting definitions |
| Internal normalized “points” coexist with no points product | Scoring/ranking terminology decision | scoringConfig/log/member projections | tie/ranking/feed | founder intent mismatch |
| Notification array is user document metadata | Notification event/delivery domain | notificationService | awareness/re-engagement | migration and fan-out |
| Support donation records act as manual payment workflow | Support intent, payment instruction and verified settlement distinction | donation services/screens | user/admin/reporting | financial misstatement |
| Admin CRUD hard-deletes catalogue records | Governed knowledge lifecycle | admin catalogue services | knowledge/history | orphaned references |
| Library probes three collections | Governed content source | bookLibraryService | library/admin | ambiguous source of truth |
| Settings split across two collections | Platform configuration ownership | adminSettings/donation services | operations/support | drift |
| Browser-admin mutations | Privileged operational command model | admin services/rules | moderation/settings/users | audit/security |
| Profile privacy as display toggles | Enforced privacy/access policy | profile screens vs broad user reads | discovery/profile | privacy expectation breach |

## Fitness-centric conclusion

The platform shell is group/challenge/social, not merely fitness. However, its measurable-event vocabulary, catalogue names, workout logging, scoring normalization, interests and several UI labels remain fitness-centric. The V2 knowledge documents broaden fitness and wellness knowledge but do not yet govern groups, identity, social content, notifications, donations or operations at the same depth.
