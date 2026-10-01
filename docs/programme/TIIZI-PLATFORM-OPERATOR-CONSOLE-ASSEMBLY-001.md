# Tiizi Platform Operator Console Assembly 001

Status: Local Development Founder preview assembly. Starting implementation
SHA: `6306e7404b1e9ed7c1aadf9a28b1e088ec4f1e78`.

## Experience reference and precedence

- Prototype repository: `Fkenogo/tiizi-prototye`.
- Prototype `main` SHA inspected: `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6`.
- The prototype is the approved Experience Reference for information
  architecture, desktop shell, density, navigation, lists, filters and
  drill-down patterns. Its mock records, analytics, role model, simulated
  health/alerts, in-memory audit and unsupported actions are not Product Truth.
- The implementation repository and its PostgreSQL/API authority are Product
  Truth and take precedence wherever behavior differs.

The inspected reference includes `OperatorShell`, Overview, Users, Groups,
Activities, Challenges, Templates, Workqueues, Platform, operator mock data,
operator types, audit patterns, and app composition. Its persistent vertical
sidebar and operational list/detail patterns inform this assembly. Prototype
moderation, role editing, publishing, transaction reporting, simulated health,
and mock audit persistence were deliberately not adopted.

## Operating and security model

Tiizi has one Platform Operator Console. Fred Kenogo is the sole current
Platform Operator. Local / Development Preview describes the environment and
non-production data, not another operator class. The isolated local Firebase
identity is linked to Fred's member reference to keep member authentication
separate; the authenticated member is still authorized only by explicit,
revocable PostgreSQL grants. `platform_operator_console_readers` grants bounded
read access to this console. `platform_operator_cause_reviewers` remains a
separate, explicit grant required for Social Cause decisions. Neither the
Founder label nor ordinary membership or Group stewardship grants Operator
access. Existing revoked-grant, member-denial and Cause-creator self-approval
protections are preserved. No production grant is seeded.

## Prototype ↔ Product Truth capability matrix

| Section | Experience Reference pattern | Product Truth and source | Assembly / boundary |
|---|---|---|---|
| Overview | Operational snapshot, attention, shortcuts | PostgreSQL members, Groups, Challenges, participations, accepted Challenge Activity, Cause states/decisions, Support configuration | Assembled from authoritative counts, lifecycle, Cause queue counts, Support settings, recent accepted Challenge Activity and governed Cause decisions. No simulated alerts or analytics. |
| Users | Searchable directory and detail | PostgreSQL `members`, memberships, participations, accepted Challenge Activity; current schema stores no profile name/email/account state | Read-only, bounded directory/search and member drill-down. Displays Tiizi member UUID references and stored roles only; does not expose Auth UID/private profile or create support writes. |
| Groups | Search/filter, roster and detail | PostgreSQL `groups`, `group_memberships`, Challenges | Read-only Group directory/detail, visibility/status filters, steward reference, authoritative member/challenge counts, policies and related Challenge links. |
| Activities & Knowledge | Catalogue browsing and detail | PostgreSQL canonical `knowledge_items`, `knowledge_item_texts`, Challenge configs and accepted `challenge_activity_records` | Read-only catalogue/search/filter plus separately labelled accepted Challenge Activity records. No personal activity history or catalogue editing. |
| Challenges | Search/filter and drill-down | PostgreSQL Challenges, lifecycle timestamps, Group, participation, Challenge configs, Cause configuration | Read-only platform-wide list and detail; lifecycle/type/support filters, dates, participation, Cause, Group and accepted-Activity context. No lifecycle override. |
| Templates | Catalogue/detail | Firestore `challengeTemplates`/`wellnessTemplates`; separate legacy Firestore admin role model, not an authorized Fred read path | Deferred. No bypass across the Firestore authority boundary and no speculative publish/edit capability. |
| Review & Attention | Governed work queue | PostgreSQL Cause, Cause decisions and explicit Cause-reviewer roster | Existing queue/detail/reason-required Approve and Request Revision integrated into persistent shell. Creator self-approval remains denied; audit records remain authoritative. No unrelated moderation queue. |
| Donations / Support | Operational configuration inspection | PostgreSQL Challenge `support_tiizi_enabled` and beneficiary-owned Social Cause configuration | Read-only cross-Challenge configuration, Cause state, beneficiary, destination ownership/reference and Challenge context. No contributions, payment execution, custody, settlement, reconciliation or financial reporting. |
| Content & Localisation | Browse locale content | PostgreSQL canonical Knowledge and `knowledge_item_texts` | Read-only stored locale fields, coverage and default locales. Limited to this source; no CMS or edit/publish controls. |
| Access & Roles | Authority visibility | PostgreSQL read-only Console roster and separate Cause-reviewer roster | Read-only current grant scopes and Fred identity. No invitations, role changes or speculative multi-admin model. |
| Platform Health | Compact real signals | Existing API process and PostgreSQL connectivity checks | Live API/DB read only. Auth emulator, scheduling, notifications, storage and external integrations have no current health read model and are explicitly not represented. |
| Audit Log | Search/filter decision history | PostgreSQL Social Cause decision history | Searchable, filterable Cause decisions with actor reference, reason, time and current Cause state. Scope is labelled Cause decisions only; no synthetic global audit. |
| Settings | Product settings | No authoritative Operator settings model/API | Compact deferred state because no governed settings capability exists. |

## Added Operator read model

`api/src/operatorConsoleRoutes.ts` adds authenticated `GET /v1/operator/console`
reads for `overview`, `members` and member detail, `groups` and Group detail,
`activities`, `challenges` and Challenge detail, `support`, `localisation`,
`access`, `health`, and `audit`. Requests fail closed unless the authenticated
member has an active row in `platform_operator_console_readers`. Search terms
are bounded, list reads have bounded pagination, and all data comes from the
authoritative PostgreSQL models named above. The new migration creates only the
roster table; it inserts no grants. Local bootstrap grants Fred read access
alongside the already separate Cause-review grant. Existing Cause APIs and
decision authorization are unchanged.

## Local Development data and preview

The existing Development database contains 10 member rows, 10 Groups, 18
Challenges, 8 participations, 5 accepted Challenge Activity records, and 5
Social Causes, including pending, approved and revision-required states. It
includes Together/Race/Streak types, active/establishment/ended and finalized
state examples, public/private Groups, and Support enabled/disabled settings.
The deterministic `preview:operator:seed` preserves existing data and ensures
two clearly labelled, non-operator-authored Cause review fixtures exist. The
Founder pending Cause is retained. Running it twice reports both fixtures as
retained on the second run. Fixture state is stored in PostgreSQL and served
through the same Operator APIs as application data.

The bootstrap accepts its local-only password via
`TIIZI_SOCIAL_CAUSE_OPERATOR_PASSWORD`, requires loopback Auth and PostgreSQL,
refuses a production Node environment, and does not print/store the password
in tracked files. No application authorization is inferred from preview mode.

Founder preview URL: `http://127.0.0.1:5174/v2/operator/review`.
Sign in as `social-cause-operator@tiizi.local` using the separately handed-off
LOCAL DEVELOPMENT ONLY credential. After sign-in the presented actor is Fred
Kenogo, Platform Operator. No password is recorded in this programme document.

## Scope boundaries

This record does not redefine constitutional Product Truth. It does not
authorize merge, deployment, production access, broad admin writes, S8 payment
execution, S9 production scheduling, or additional administrator policy.
