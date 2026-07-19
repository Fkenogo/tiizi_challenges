# Gap and Risk Register

Priorities reflect repository evidence, not production incident confirmation.

| ID | Priority | Category | Finding/evidence | Affected flows | Impact | Required decision / next audit |
|---|---|---|---|---|---|---|
| PD-001 | P0 | Security/privacy | Authenticated users can read all `users` docs while UI offers privacy toggles (`firestore.rules`) | profile/discovery | private data expectations may not be enforced | define public/private profile fields; emulator rule audit |
| PD-002 | P0 | Data integrity | challengeMembers/log writers can influence progress-derived fields; validation is incomplete | logging/ranking/completion | forged progress/leaderboards | decide server-owned event/aggregate boundary |
| PD-003 | P0 | Security/availability | UI reads projection collections lacking explicit inspected read rules | home/feed/leaderboards | permission failures or rules drift | verify deployed rules and add collection access matrix |
| PD-004 | P0 | Data governance | no unified entity ownership/source-of-truth/version standard | all domains | silent divergence and unsafe migration | approve data ownership register |
| PD-005 | P1 | Challenge correctness | completion-causing activity may be ignored by async summary trigger after status changes | feed/recap/summary | final contribution missing | reproduce in emulator; define event ordering/idempotency |
| PD-006 | P1 | Competition | different screens/projections rank from different fields/sources | competitive leaderboard/results | inconsistent winner | define authoritative ranking/ties |
| PD-007 | P1 | Activity integrity | duplicate, corrected or deleted logs lack full reconciliation | progress/feed/streak | permanent over/under-counts | define immutable event + correction policy |
| PD-008 | P1 | Lifecycle | group/challenge/account state machines lack transfer, cancel/archive, correction and recovery | core lifecycle | stranded ownership and ambiguous history | lifecycle decision workshops |
| PD-009 | P1 | Permissions | roles duplicated across admins/users/groups and UI “Coach” terminology | admin/group | inconsistent authorization | canonical role dictionary and rule matrix |
| PD-010 | P1 | Knowledge | runtime catalogues lack V2 version/provenance/lifecycle | creation/history | mutable meaning, hard-delete risk | implementation mapping before V2 migration |
| PD-011 | P1 | Privacy | broad workout/challenge-member reads exceed evident user need | activity/profile | activity data exposure | data-classification/rule audit |
| PD-012 | P1 | Media | profile editor uploads to unsupported Storage folder then data-URL fallback | profile edit | failed uploads or oversized docs | decide profile-media path and policy |
| PD-013 | P1 | Donations | manual intent/self-report/verification and legacy confirmed states can be confused with settlement | support/admin reports | financial misstatement | approve terminology/status contract |
| PD-014 | P1 | Moderation | comments/replies/reactions lack unified moderation/appeal lifecycle | social/community | abuse and inconsistent removal | moderation policy and admin flow audit |
| PD-015 | P1 | Operations | trigger/schedule deployment, retries, dead-letter and reconciliation are undocumented | expiry/projections/metrics | stale state without recovery | production operations audit |
| PD-016 | P1 | Documentation | no platform constitution/current architecture/lifecycle suite | all | local decisions conflict | execute documentation sequence |
| PD-017 | P2 | Notifications | embedded client-managed array has no traced event delivery backend | notifications | missed/forgeable notices | define notification scope |
| PD-018 | P2 | Analytics | metric definitions and freshness vary between live queries/projections | dashboards/profile | misleading reporting | analytics dictionary/lineage audit |
| PD-019 | P2 | Search | no unified governed search/discovery model | groups/catalogues/library | inconsistent discoverability | search requirements audit |
| PD-020 | P2 | Source of truth | fitness local JSON, wellness fallback, templates and three book collections diverge | knowledge/library | environment-specific behavior | source reconciliation |
| PD-021 | P2 | Testing | guards are often structural; no unified end-to-end suite | all | runtime regressions escape | QA coverage programme |
| PD-022 | P2 | Status language | ISO/Timestamp and status vocabularies differ | all entities | brittle comparisons/migrations | shared data standard |
| PD-023 | P2 | Product ambiguity | point-like normalized scoring remains active despite no points product | ranking/feed | misleading future design | founder decision: remove/rename/govern later |
| PD-024 | P3 | Prototype exposure | mockup/dev routes remain in main route graph | navigation/release | confusing or unintended surface | verify production build exposure |
| PD-025 | P3 | Extensibility | challenge activity model assumes fitness/wellness metric patterns | future domains | costly expansion | requirements-only cross-domain audit |
