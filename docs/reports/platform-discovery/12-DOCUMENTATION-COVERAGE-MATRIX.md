# Documentation Coverage Matrix

Status: complete means a current governing document exists; partial means evidence/audit exists without complete governance; conflicting means documents and runtime diverge; missing means no adequate document was found.

| Class | Domain | Capability/flow | Required document | Existing document | Status | Evidence | Priority | Dependency/notes |
|---|---|---|---|---|---|---|---|---|
| A | Platform | Product purpose/boundaries | Tiizi Platform Constitution | — | Missing | capability map spans unrelated policies | P1 | founder product decisions |
| B | Platform | Runtime architecture | Current Platform Architecture | this audit only | Partial | App/services/functions/rules | P1 | deployment map |
| C | Identity | account/onboarding | Identity and Account Lifecycle Standard | pre-pilot onboarding report | Partial | AuthContext/profile guards | P1 | privacy/retention |
| D | Privacy | profile visibility/data use | Privacy and Profile Visibility Policy | legal PrivacyScreen + UI toggles | Conflicting | users broadly readable | P0 | security remediation decision |
| E | Groups | create/join/leave/manage | Group Product Behaviour Specification | scattered reports/tests | Partial | group services/callables | P1 | role/state standards |
| C | Groups | group/member/invite lifecycle | Group Lifecycle Standard | — | Missing | status vocabulary drift | P1 | ownership transfer decision |
| H | Groups | roles/permissions | Group Authorization Standard | rules + code only | Missing | owner/admin/member/Coach | P0 | role dictionary |
| E | Challenges | creation/participation | Challenge Behaviour Specification | V2 framework + runtime audit | Conflicting | active behavior differs from V2 | P1 | current behavior decisions |
| C | Challenges | challenge/member lifecycle | Challenge Lifecycle Standard | runtime audit | Partial | split authorities | P1 | correction/finalization |
| G | Activity | logging/progress/verification | Activity Event and Progress Standard | challenge audit | Partial | workouts/wellnessLogs | P0 | server ownership/idempotency |
| J | Ranking | leaderboard/ties | Competition and Ranking Standard | V2 compatibility docs | Conflicting | multiple ranking sources | P1 | metric contract |
| D | Social | feed/reactions/comments | Community Content and Moderation Policy | — | Missing | nested social writes | P1 | retention/appeals |
| C | Notifications | event/delivery/read lifecycle | Notification Standard | templates + service | Missing | embedded client list only | P2 | channel strategy |
| C | Motivation | daily goals/streak/milestones | Motivation and Recognition Framework | — | Missing | several unrelated streak/score fields | P1 | points decision |
| F | Knowledge | fitness/wellness objects | Knowledge Governance Framework | extensive knowledge-catalogue docs | Partial | future model not runtime | P1 | implementation mapping |
| L | Knowledge | authoring/editorial/safety | Exercise Authoring and Content Standard | V2 guide | Partial | wellness/general domains incomplete | P1 | domain experts |
| G | Data | entities/provenance/versioning | Platform Data and Information Standard | this audit | Missing | denormalized mixed SoT | P0 | ownership map |
| H | Security | platform authorization | Security and Permission Standard | rules only | Missing | UI/service/rule drift | P0 | admin and privacy policy |
| I | Admin | admin roles/operations | Admin Operating Standard | — | Missing | browser-admin services | P1 | escalation/audit |
| I | Moderation | report/case handling | Moderation Operations Standard | — | Missing | groupReports/supportTickets | P1 | policy/SLA |
| D | Donations | intent/payment/status language | Support and Donation Policy | pre-beta report | Partial | manual self-report/verification | P1 | legal/financial decisions |
| J | Analytics | metric definitions/freshness | Analytics Measurement Plan | — | Missing | client queries + scheduled metrics | P2 | product KPIs |
| K | AI | recommendations/personalization | AI and Recommendation Standard | Phase 3A-12 framework | Partial/future | no active AI engine | P2 | consent/evidence |
| G | Media | upload/retention/rights | Media and File Standard | storage rules only | Missing | public covers/data URL fallback | P1 | privacy/storage policy |
| I | Operations | jobs/logging/recovery | Platform Operations Runbook | — | Missing | schedules/triggers/systemLogs | P1 | deployment observability |
| N | Migration | V1→V2 compatibility | Version 2 Migration Plan | knowledge docs discuss migration | Partial | snapshots/legacy statuses | P1 | schema decisions |
| O | QA | acceptance/regression | Platform QA and Acceptance Standard | scripts only | Missing | no unified suite | P1 | flow catalogue |
| M | Engineering | doc-to-code traceability | Platform Atlas Mapping | this evidence pack draft | Partial | evidence registers | P2 | architecture decisions |
