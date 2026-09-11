# Stage G — Tiizi Engine Alignment Assessment

**Task ID:** TIIZI-V2-STAGE-G-ENGINE-ALIGN-001  
**Mode:** Assessment only  
**Status:** Prepared for Founder review  
**Assessment date:** 2026-09-11  
**Canonical main assessed:** `c015dbeb94d985b66cff47639c5949a1670aae46`  
**Disposition:** **B. ENGINE BASELINE PARTIAL — BOUNDED ENGINE GAPS MUST CLOSE FIRST**

## Assessment method and statement labels

This assessment inspected the repository tree at the exact canonical commit above. It did not assess the later or earlier state of a local working tree. Evidence includes approved Stage F authority, the approved hybrid architecture decision, PostgreSQL migrations and domain/API code, Firestore rules and services, V2 hooks and screens, and executable test suites. Programme reports were used for scope and approval status, never as sole proof that a capability exists. A clean archive of the assessed commit passed `npm run typecheck --prefix api` and all **317/317** API tests (24 test files) on 2026-09-11; passing tests prove implemented behavior, not the absent or doctrinally conflicting capabilities identified here.

Every substantive conclusion uses one of these labels:

- **SETTLED AUTHORITY** — approved product, governance, or architecture direction.
- **CURRENT IMPLEMENTATION EVIDENCE** — directly observable code, schema, route, rule, test, or absence at the assessed commit.
- **ARCHITECTURAL INFERENCE** — a conclusion that follows from combining settled authority with implementation evidence.
- **NEW RECOMMENDATION** — the bounded next step proposed by this assessment; it is not authorization.

Classification vocabulary is: **IMPLEMENTED**, **PARTIALLY IMPLEMENTED**, **DEFINED BUT NOT IMPLEMENTED**, **EXPERIENCE-ONLY / LEGACY-ONLY**, and **DEFERRED BY AUTHORITY**.

## 1. Current Tiizi Product State

**SETTLED AUTHORITY.** Tiizi uses the engine-first product chain:

`Member → Group → Challenge → Participation → Activity → Calculation → Result`

Presentation consumes that truth; it does not establish it. Engine First is not backend-only: a UI can be an authoritative input surface, but authority must remain in the governed boundary behind it.

**SETTLED AUTHORITY.** The approved hybrid position retains Firebase Authentication as issuer and Firestore as current authority for Group existence/lifecycle and live Group Membership. PostgreSQL is authoritative for V2 Knowledge, Challenge/configuration, Participation, Evidence/application, and Derived Truth. Provider-neutral seams are mandatory; Group migration is not required. See `docs/programme/STAGE-G-HYBRID-ARCHITECTURE-DECISION-CANDIDATE.md:12-30` and `:121-166`.

**CURRENT IMPLEMENTATION EVIDENCE.** The canonical code has a substantial server-owned V2 domain:

- Firebase token-to-Tiizi-member mapping at `api/src/auth.ts:117-126`;
- a read-only, fail-closed Firestore Group/Membership authority adapter at `api/src/firestoreGroupAuthority.ts:1-27` and `:67-102`;
- atomic Challenge establishment, version-1 configuration, optional activation, and optional creator Participation at `api/src/challengeEstablishment.ts:1-27` and `:70-143`;
- explicit Participation episodes in `api/migrations/004_phase_c2a_challenges.sql:215-230`;
- one atomic Activity-to-application-to-derived-truth path at `api/src/challengeActivityApplication.ts:1-28`;
- deterministic Collective, Competitive, and Streak engines plus replay in `api/src/derivedTruth.ts:1-24`;
- published-only Knowledge runtime and PKG-2A publication controls in `api/src/knowledge.ts` and migrations `007_pkg2a_knowledge_readiness.sql` / `008_pkg2a_version_classes.sql`;
- V2 Challenge read, join, withdraw, and Activity logging routes registered at `api/src/app.ts:81-90`.

**ARCHITECTURAL INFERENCE.** This is not an experience-only prototype. The core calculation path is real, server-owned, and independently testable. It is nevertheless not yet an operational Tiizi Engine baseline because authoritative Group mutation is not governed sufficiently, Challenge establishment does not enforce the Group's Challenge-creation rule or canonical Metric/Unit compatibility, the approved Submission/Acceptance concepts are collapsed, Streak rules conflict with settled requirements, and general Challenge finalization/final-result freezing is absent.

## 2. Proposed Core Engine Boundary derived from existing authority

This is a derivation of existing authority, not a new architecture.

| Engine area | Minimum boundary | Source classification |
| --- | --- | --- |
| Membership and Relationship | Tiizi Member identity mapping; Group Membership lifecycle; voluntary Challenge Participation episodes; attributable transitions | **SETTLED AUTHORITY** |
| Group | Group identity, lifecycle, Charter/rules required for creation and membership, visibility relationships, and enforceable Challenge-creation authority; Firestore may remain operational authority | **SETTLED AUTHORITY** |
| Challenge | immutable identity and Group context; type; validated, pinned, versioned configuration; establishment, activation, Participation, ending, finalization, immutable history; Run Again creates a new Challenge | **SETTLED AUTHORITY** |
| Knowledge | canonical Activity, Metric and Unit identity/compatibility; guidance; draft/published/retired lifecycle; publication gate; version/locale history; optional templates | **SETTLED AUTHORITY** |
| Activity evidence and truth | Submission Intent → Evidence Eligibility → Acceptance Authority → Accepted Activity Event → calculation eligibility/application → Calculation Authority → Derived Truth | **SETTLED AUTHORITY** |
| Calculation | deterministic Collective, Competitive and Streak progress, completion and result; authoritative replay/recalculation; finalization and stable history | **SETTLED AUTHORITY** |
| Recognition boundary | Derived Truth may supply governed inputs; Recognition remains a separate Authority | **SETTLED AUTHORITY**; MOT-01 remains deferred |

**ARCHITECTURAL INFERENCE.** The Core Engine boundary crosses Firestore and PostgreSQL. “Engine completeness” means the chain is governed and testable across the approved adapter boundary, not that all data must be moved to one provider.

## 3. Existing Engine Capabilities

| Capability | Classification | Evidence and operational reading |
| --- | --- | --- |
| Firebase identity mapped to Tiizi Member | **IMPLEMENTED** for pre-existing mappings | `api/src/auth.ts:117-126`; unknown mappings fail closed |
| Live Group/Membership eligibility read | **IMPLEMENTED** | Firestore liveness and `active`/`joined` membership are read fail-closed; PG shadow never authorizes (`api/src/firestoreGroupAuthority.ts:11-27`, `:76-102`) |
| Challenge schema and lifecycle guard | **IMPLEMENTED** | type/status constraints, terminal `ended`, immutable identity, no delete (`api/migrations/004_phase_c2a_challenges.sql:40-135`) |
| Immutable configuration versions and Knowledge pins | **IMPLEMENTED** | append-only snapshots/activity configs (`004_phase_c2a_challenges.sql:137-213`) |
| Atomic Challenge establishment seam | **IMPLEMENTED**, controlled entry only | `establishChallengeV2` validates and commits Challenge/config/activation/creator Participation atomically (`api/src/challengeEstablishment.ts:70-143`); exposed only by `api/src/challengeCreateCli.ts`, not HTTP |
| Participation join/withdraw episodes | **IMPLEMENTED** | PostgreSQL lifecycle plus authenticated routes; live Group Membership checked by server |
| V2 Activity application | **PARTIALLY IMPLEMENTED** | one transaction enforces active Challenge, live Group membership, owning Participation episode, current config, Knowledge, exact unit, idempotency, scoring, and one-Challenge application (`api/src/challengeActivityApplication.ts:1-41`, `:266-300`) |
| Collective calculation | **IMPLEMENTED** for active runtime/goal completion | exact sum retains overshoot and goal crossing ends Collective Challenge; derived rows persist |
| Competitive calculation/ranking | **IMPLEMENTED** for active runtime | cumulative completion; read-time standard competition ranking with no artificial tie-break (`api/src/derivedTruth.ts:345-370`) |
| Streak calculation | **PARTIALLY IMPLEMENTED** | all configured daily Activities are required and gaps reset, but timezone, late logging, and completion timing are not aligned |
| Server-owned Derived Truth and read-only replay | **IMPLEMENTED** for current state | pure fold over accepted application records (`api/src/derivedTruth.ts:1-24`, `:238-343`); replay does not provide an authoritative persisted rebuild command |
| V2 list/detail/leaderboard/log/join/withdraw | **IMPLEMENTED** as thin consumers/inputs | routes in `api/src/app.ts:81-90`, client adapter in `src/api/v2ChallengeApi.ts`, hooks in `src/hooks/useV2Challenges.ts` |
| Knowledge identity, lifecycle, versions, KCS gate, locales | **IMPLEMENTED IN CODE** | migrations 002/007/008 and `api/src/knowledge.ts`; PKG-2A code is merged but migrations 007/008 are explicitly not deployed |

## 4. Engine Capabilities Defined but Not Yet Implemented

| Capability | Classification | Evidence |
| --- | --- | --- |
| Governed Group creation and Membership mutation boundary | **DEFINED BUT NOT IMPLEMENTED** for V2 | Group and owner-membership writes are two direct client writes (`src/services/groupService.ts:158-197`); joins/leaves directly mutate Firestore (`:200-250`, `:278-299`) |
| Enforced Group Charter Challenge-creation authority | **DEFINED BUT NOT IMPLEMENTED** | `allowMemberChallenges` is stored (`src/services/groupService.ts:166-184`, `:319-320`) but establishment requires only any live membership; code explicitly applies no Charter-role restrictions (`api/src/challenges.ts:214-248`) |
| Canonical Activity/Metric/Unit permitted-combination validation | **PARTIALLY IMPLEMENTED** | Knowledge identity/version is pinned, but Challenge-supplied unit is only shape/exact-config validated; no canonical compatibility relation is consulted |
| Explicit Submission Intent and acceptance decision/event | **DEFINED BUT NOT IMPLEMENTED** as distinct concepts | C1 event and C2 application collapse the approved multi-authority chain; no submitted/accepted/rejected lifecycle or acceptance-authority attribution |
| Challenge-wide scheduled ending and finalization | **DEFINED BUT NOT IMPLEMENTED** | `endChallenge` exists only as domain function (`api/src/challenges.ts:332-341`); no route/scheduler/final result snapshot; Competitive and Streak do not close at period end |
| Persisted final Competitive result/ranking | **DEFINED BUT NOT IMPLEMENTED** | positions are intentionally calculated at read time and not stored (`api/src/derivedTruth.ts:20-22`) |
| Correct settled Streak temporal semantics | **PARTIALLY IMPLEMENTED** | arbitrary historical `occurred_at` is accepted within period (`api/src/challengeActivityApplication.ts:37-41`); no governing timezone field; engine marks completion upon reaching the streak length rather than at period end |
| Authoritative replay/recalculation that can repair persisted projections | **PARTIALLY IMPLEMENTED** | read-only replay exists; no governed persist/rebuild/finalize operation |
| Run Again as a new Challenge | **PARTIALLY IMPLEMENTED** | schema prevents reopening and ordinary establishment can mint a new identity (`api/src/challenges.ts:319-329`); there is no explicit copy/run-again operation |
| V2 templates integration | **EXPERIENCE-ONLY / LEGACY-ONLY** | templates remain in Firestore/legacy administration; optional mechanism, not a baseline blocker |
| Verification, correction authority/workflow, Recognition | **DEFERRED BY AUTHORITY** | ACT-03, ACT-04 and MOT-01 remain deferred by `STAGE-F-FAD-01`; no inference is made |

## 5. Participant / Experience Capabilities

| Surface | Layer classification | Engine relationship | Baseline priority |
| --- | --- | --- | --- |
| Group create/join/leave | **ENGINE INPUT** and **PARTICIPANT INTERACTION** | must call a governed Firestore authority boundary; current direct writes create truth | P0 boundary, not polished UI |
| Challenge creation | **ENGINE INPUT** and **PARTICIPANT INTERACTION** | must call validated establishment; controlled CLI exists, participant API/UI does not | P1 for broad experience; controlled preview may use CLI |
| Challenge join/withdraw | **ENGINE INPUT** and **PARTICIPANT INTERACTION** | V2 server route owns Participation truth | already usable |
| Log Activity | **ENGINE INPUT** and **PARTICIPANT INTERACTION** | UI supplies intent only; server must own acceptance/application/calculation | P0 acceptance alignment; simple UI exists |
| Home | **PRESENTATION** | consumes membership, Challenge and result summaries | P2 |
| Group pages | **PRESENTATION** plus governed inputs | must consume Group and membership truth | P1 after boundary |
| Challenge browse/detail | **PRESENTATION** | consumes visibility, eligibility, config, Participation and Derived Truth | P1 |
| Progress/result views | **PRESENTATION** | consume Derived Truth/final result; percentages may be display derivations | preview-simple first; polish P2 |
| Feed | **SOCIAL EXPERIENCE** | must consume eligible events; never calculate progress | P2 |
| Kudos | **SOCIAL EXPERIENCE** | must not alter Activity, progress, ranking, completion or Recognition | P2 |
| Sharing, notifications, discovery | **SOCIAL EXPERIENCE** / **PRESENTATION** | downstream consumers only | P2 |
| Cause/contribution presentation | **PRESENTATION** | consumes governed contribution/result truth | P2; no new authority implied |

**ARCHITECTURAL INFERENCE.** None of Home, Feed, Kudos, sharing, notifications, discovery, or visual refinement is needed to prove the Engine. Broad implementation of them now would mask rather than close the authoritative-chain gaps.

## 6. Current Implementation vs Engine Boundary

The following compact map distinguishes provider from authority:

| Truth | Current owner | Boundary assessment |
| --- | --- | --- |
| Authentication assertion | Firebase Auth | **ALIGNED** with approved hybrid position |
| Tiizi Member identity/mapping | PostgreSQL API | **ALIGNED**, but provisioning is not self-service |
| Group existence/lifecycle | Firestore | provider is **ALIGNED**; mutation controls are **PARTIAL** |
| Live Group Membership | Firestore | read adapter is **ALIGNED**; direct client mutation/rules are a **MATERIAL ENGINE LEAK** |
| PG Group/member shadow | PostgreSQL import/mapping | valid referential/discovery aid; must not authorize, and code correctly avoids doing so |
| Challenge/config/Participation | PostgreSQL | **ALIGNED**, with establishment-policy and public-entry gaps |
| Submission/accepted Activity/application | PostgreSQL | storage exists, but approved concepts/authorities are **COLLAPSED** |
| Derived current truth | PostgreSQL server engine | **ALIGNED** for Collective/Competitive active runtime; Streak and finalization are **PARTIAL** |
| Recognition | not implemented | correctly outside Challenge Engine; **DEFERRED BY AUTHORITY** |

## 7. Engine Operational Chain Assessment

| # | Required step | Existing authority | Current implementation / entry point | Persistence authority | UI needed for truth? | Independently testable? | Missing dependency / blocker | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | Tiizi Member exists | Tiizi Member + Firebase issuer | Firebase token maps to existing PG member in `requireAuth`; shadow import/domain helper provisions | PostgreSQL | No | Yes | no self-registration/mapping boundary; controlled member works | **IMPLEMENTED** (bounded) |
| 2 | Member creates or joins valid Group | Group and Membership Authority; Firestore retained | V1 `groupService` direct Firestore writes | Firestore | Currently yes for ordinary path | Partly; client/emulator only | non-atomic create+owner membership; permissive transition rules; PG mapping/import lag | **PARTIALLY IMPLEMENTED** |
| 3 | Valid Challenge established inside Group | Challenge Authority constrained by Group rules | atomic `establishChallengeV2`; controlled CLI only | PostgreSQL; live Firestore eligibility read | No | Yes | Group Challenge-creation rule not enforced; no participant API | **PARTIALLY IMPLEMENTED** |
| 4 | Challenge references valid Activity/Metric/Unit Knowledge | Knowledge Authority/KRC/KCS | published Knowledge identity/version pinned | PostgreSQL | No | Yes | permitted Metric/Unit combination not validated | **PARTIALLY IMPLEMENTED** |
| 5 | Eligible Member voluntarily establishes Participation | Participation Authority | authenticated join route and establishment optional creator join; live membership gate | PostgreSQL, with Firestore live eligibility | No | Yes | Challenge-specific eligibility configuration/policy not represented beyond Group membership | **PARTIALLY IMPLEMENTED** |
| 6 | Participant submits Activity | Participant Authority establishes Submission Intent | `POST /v1/challenges/:id/activity`; V2 logging UI | PostgreSQL transaction | No (HTTP sufficient) | Yes | no durable Submission Intent state/ID/status | **PARTIALLY IMPLEMENTED** |
| 7 | Evidence/acceptance path governs submission | Policy + Acceptance Authorities | embedded server gates and immediate application; rejected request rolls back | PostgreSQL | No | Only as all-or-nothing request | no explicit eligibility determination, acceptance decision/authority, or accepted-event object | **PARTIALLY IMPLEMENTED** |
| 8 | Accepted Activity becomes calculation input | accepted event + one declared Challenge application | unique `challenge_activity_records.event_id`, built only after gates | PostgreSQL | No | Yes | approved Accepted Event and application are collapsed | **PARTIALLY IMPLEMENTED** |
| 9 | type engine derives correct truth | Calculation Authority | server selects Collective/Competitive/Streak engine | PostgreSQL calculation | No | Yes | Streak temporal/completion semantics conflict | **PARTIALLY IMPLEMENTED** |
| 10 | progress/result persists | Calculation Authority | participation/challenge derived rows persist; Competitive position read-time | PostgreSQL | No | Yes | no final result/ranking snapshot | **PARTIALLY IMPLEMENTED** |
| 11 | Challenge ends/finalizes | Challenge lifecycle + Calculation Authority | Collective goal may auto-end; domain-only `endChallenge` | PostgreSQL | No | end function yes, full finalization no | no scheduled close, finalization operation, or period-end Streak outcome | **DEFINED BUT NOT IMPLEMENTED** |
| 12 | historical result remains stable | immutable history / Run Again new identity | config, applications and terminal Challenge protected; derived result remains mutable projection | PostgreSQL | No | Partly | no frozen final result and no governed persisted replay/finalize gate | **PARTIALLY IMPLEMENTED** |

**ARCHITECTURAL INFERENCE.** The chain can be demonstrated through current truth for a controlled Collective or Competitive case, but it cannot yet prove the required general operational baseline through final stable history.

## 8. Submission / Evidence / Acceptance Assessment

### Approved chain

**SETTLED AUTHORITY.** Stage F requirements FR-V2-070 through FR-V2-076 preserve Submission Intent, Evidence Eligibility, Accepted Activity Event, and Derived Truth as distinct concepts. The CIC further requires an attributable acceptance authority and permits initial automatic system acceptance without making acceptance factual certification. ACT-03 Verification is separate; ACT-04 Correction is separate.

`Submission Intent → Evidence Eligibility → Acceptance Authority → Accepted Activity Event → Calculation Authority → Derived Truth`

### Current semantics

| Question | Finding |
| --- | --- |
| What is Submission Intent now? | **CURRENT IMPLEMENTATION EVIDENCE:** the incoming Activity request plus the new `member_activity_events` row function as the practical intent/evidence, but the row has `committed/superseded`, not `submitted/accepted/rejected`, and is not named or linked as a Submission Intent. See `api/migrations/003_phase_c1_events.sql:1-30`. |
| What determines Evidence Eligibility? | **CURRENT IMPLEMENTATION EVIDENCE:** embedded server checks: authenticated Member, live Group membership, active Challenge, owning Participation episode at occurrence time, current pinned config, canonical Knowledge identity, configured Activity/variant/unit, period, and idempotency. There is no separately persisted eligibility decision or policy attribution. |
| Who accepts/rejects? | **ARCHITECTURAL INFERENCE:** the V2 server transaction acts as a bounded automatic Acceptance Authority; success means immediate application and failure rejects the request. That authority is not explicitly attributed in stored data, and rejected intent is not retained. |
| Does Evidence creation equal Accepted Activity? | **CURRENT IMPLEMENTATION EVIDENCE:** a raw `member_activity_events` row is not independently consumed by calculation; only the unique Challenge application record is. But the same transaction creates both and rolls both back on failure, so the approved distinctions among intent, accepted event, and Challenge-specific application are operationally collapsed. |
| Do ACT-03/ACT-04 block ordinary acceptance? | **SETTLED AUTHORITY:** no. Automatic, unverified ordinary self-accountability may operate without resolving Verification. ACT-04 prevents inventing correction authority/workflow; it does not prevent append-only ordinary acceptance. |
| Do calculations consume only accepted input? | **CURRENT IMPLEMENTATION EVIDENCE:** yes under the current provisional rule: `applyAcceptedRecord` receives only a successfully inserted `challenge_activity_records` row, never raw Evidence (`api/src/challengeActivityApplication.ts:23-28`; `api/src/derivedTruth.ts:238-264`). The issue is authority representation and auditability, not an observed raw-input bypass. |

**NEW RECOMMENDATION.** Preserve the already approved bounded automatic rule explicitly and in the required order: persist attributable Submission Intent, Evidence Eligibility, an automatic-system Acceptance Authority decision/Accepted Activity Event, and the Challenge calculation application as separately identifiable facts. Do not add Verification, correction semantics, or a human review gate. This is alignment to settled CIC authority, not resolution of ACT-03/ACT-04.

**CURRENT IMPLEMENTATION EVIDENCE.** C1 contains append-only supersession/correction-ready structures and replay can exclude superseded Evidence. No public correction route or approved correction workflow exists. This dormant readiness must not be read as ACT-04 implementation or authority.

## 9. Group Engine Assessment

| Question | Assessment |
| --- | --- |
| Can a V2 Member create a Group through an engine boundary? | **No.** The only ordinary path is the V1 client service. Group creation and owner Membership are separate writes (`src/services/groupService.ts:158-197`). No V2 server/callable Group establishment seam is registered. |
| Can membership be established/changed through a governed boundary? | **Not reliably.** UI logic computes pending/active and directly writes membership (`:200-250`) and leave state (`:278-299`). Rules allow a user to create/update their own document but do not restrict role/status/identity-field transitions (`firestore.rules:231-240`). |
| Is Group Charter/governance represented? | **Partly.** `groupRules`, `requireAdminApproval`, and `allowMemberChallenges` exist. There is no versioned/historical Charter boundary, and the Challenge establishment seam ignores creation restrictions. |
| Is Challenge-creation authority enforced by Engine truth? | **No.** The V2 seam checks active Group and any current membership only (`api/src/challengeEstablishment.ts:84-99`). It does not evaluate owner/admin/member role or `allowMemberChallenges`. |
| Are visibility rules engine-owned? | **Partly.** Challenge API reads use live membership. Legacy discovery uses `visibility/isPrivate`, while `/groups` is readable by every authenticated user (`firestore.rules:222-229`). Visibility remains substantially client/rules-owned and is not a complete V2 relationship policy. |
| Is current Group functionality V1 UI/client behavior? | **Yes for mutation.** V2 uses a sound read adapter, but establishment/lifecycle/membership mutation remain legacy client operations whose truth V2 later consumes. |

**ARCHITECTURAL INFERENCE.** Because the V2 engine trusts the resulting live Firestore state, the direct-write weakness is not merely a legacy UI concern; it is a material cross-boundary Engine gap. Closing it does not require moving Group authority to PostgreSQL.

**NEW RECOMMENDATION.** Add a bounded, server-enforced Firestore Group establishment/Membership transition boundary (or equivalently restrictive rules plus trusted callable operations), including atomic owner relation, private approval, allowed transitions, and Challenge-create authorization. Make deterministic stable PG identity mapping a tested prerequisite to V2 Challenge establishment through the existing shadow/import approach; do not invent a cross-provider transaction. Keep Firestore authoritative.

## 10. Challenge Engine Assessment

| Capability | Status | Evidence / distinction |
| --- | --- | --- |
| Establish Challenge | **IMPLEMENTED** controlled; no participant API | atomic seam and CLI |
| Pin current config version | **IMPLEMENTED** | current version and immutable snapshots |
| Validate Knowledge inputs | **PARTIAL** | published identity/version yes; Metric/Unit compatibility no |
| Establish Participation | **IMPLEMENTED** | episode model, join/withdraw API |
| Submit Activity | **IMPLEMENTED** as HTTP input | acceptance concepts remain collapsed |
| Apply Activity once to one Challenge | **IMPLEMENTED** | client key idempotency plus unique event application |
| Collective truth | **IMPLEMENTED** active runtime | exact sum/overshoot; goal completion |
| Competitive truth | **IMPLEMENTED** active runtime | cumulative completion and 1,2,2,4 ranking |
| Streak truth | **PARTIAL** | all-requirement days work; timezone/no-late-log/period-end result do not |
| Update progress | **IMPLEMENTED** | persisted server projection |
| Determine completion | **PARTIAL** | Collective/Competitive yes; Streak completion occurs too early |
| Close/end | **PARTIAL** | terminal state/domain function; Collective goal auto-end only |
| Finalize result | **DEFINED BUT NOT IMPLEMENTED** | no explicit finalization or final snapshot |
| Preserve immutable completed history | **PARTIAL** | immutable identity/config/applications and terminal status; mutable derived projection/final ranking absent |
| Replay/recalculation | **PARTIAL** | deterministic read-only replay; no authoritative persisted rebuild/finalize operation |
| Run Again as new Challenge | **PARTIALLY IMPLEMENTED** | reopening is prohibited and ordinary establishment creates a new identity; no dedicated copy operation |

### Lifecycle distinctions

- **Establishment:** sound atomic persistence exists, but authorization and Knowledge compatibility are incomplete.
- **Active runtime:** Collective and Competitive are substantially functional; Streak is not settled-rule complete.
- **Completion:** participant/goal crossing is derived and persisted, but Streak timing is wrong and time-expiry is absent.
- **Finalization:** absent as an authoritative operation.
- **Historical immutability:** source/config history is strong; stable finalized result history is incomplete.

## 11. Knowledge Engine Assessment

| Knowledge capability | Status | Evidence / qualification |
| --- | --- | --- |
| Canonical identity | **IMPLEMENTED** | PG UUID + canonical key/kind in migration 002 |
| Activity/Metric/Unit compatibility | **PARTIALLY IMPLEMENTED** | one `metric_unit`/detail shape exists; the resolver returns only Knowledge ID/version and the Challenge validator checks unit shape, not a governed permitted-combination relation (`api/src/challengeConfigs.ts:23-38`, `:83-105`, `:170-183`) |
| draft/published/retired | **IMPLEMENTED IN CODE** | forward lifecycle and published-only runtime |
| KCS publication gate | **IMPLEMENTED IN CODE** | migration 007 fields/classes and `api/src/knowledge.ts` publication validation |
| Version history | **IMPLEMENTED IN CODE** | append-only versions; migration 008 versions content classes |
| Locale structure | **IMPLEMENTED IN CODE** | locale rows/subset/fallback in PKG-2A |
| Grandfathered catalogue compatibility | **IMPLEMENTED IN CODE** | bounded grandfathering of existing published rows in migration 007 |
| Challenge pinning | **IMPLEMENTED** | `knowledge_id` + `knowledge_version` pinned in immutable config rows |
| Templates | **EXPERIENCE-ONLY / LEGACY-ONLY** | Firestore template CRUD remains; full template migration is not required for the operational baseline |

**CURRENT IMPLEMENTATION EVIDENCE.** PKG-2A is canonical and merged, with migrations 007/008 code-authorized but not deployed. Therefore the mechanism is implemented in canonical code but is not yet operational in an environment until normal deployment authorization occurs. This assessment does not run those migrations.

**ARCHITECTURAL INFERENCE.** Catalogue content completeness is not Engine completeness. The publication/version/locale mechanism may be implemented with a small catalogue. Conversely, a large catalogue would not cure the missing permitted Activity/Metric/Unit combination check.

## 12. UI / Client Authority Leak Assessment

| Finding | Classification | Reason |
| --- | --- | --- |
| V2 Challenge list/detail/leaderboard consume API data | **ALIGNED** | V2 client does not persist Challenge/Derived Truth |
| V2 percentage/progress bars derive display ratios from authoritative totals | **NON-BLOCKING PRESENTATION DERIVATION** | display-only and reversible; server values remain source |
| `WorkoutLoggedScreen` labels route/query values as “Server recorded” | **NON-BLOCKING PRESENTATION DERIVATION** | URL state can be altered and should not be presented as authority; no persistence effect (`src/features/Activity/WorkoutLoggedScreen.tsx`) |
| Firestore Group create/join/leave/update direct client writes | **MATERIAL ENGINE LEAK** | these writes establish live truth consumed by V2, and current rules do not sufficiently constrain transitions |
| `/groups` authenticated read plus client visibility filters | **MATERIAL ENGINE LEAK** before broad discovery | visibility truth is incompletely enforced at the authority boundary |
| V1 `challengeMembers`, client progress/ranking, direct Challenge/log updates | **LEGACY-ONLY** where V2 feature paths do not call them | do not migrate merely for V2; keep isolated |
| Firestore `isActiveCollectiveProgressUpdate` client progress allowance | **LEGACY-ONLY** | belongs to V1 Challenge model; V2 PG engine does not consume it |
| Server read-time Competitive ranking | **ALIGNED** during active runtime | deterministic Calculation Authority; lack of frozen final result is a separate finalization gap |
| PG membership shadow used to enumerate candidate groups, followed by live Firestore eligibility | **ALIGNED** for authorization, **PARTIAL** for availability | shadow does not grant access, but unsynchronized new membership can be omitted from lists |

## 13. Sequencing Gaps

The shortest dependency order is:

1. Govern Group establishment/Membership mutations and stable identity mapping; enforce Group Challenge-creation permission.
2. Enforce canonical Activity/Metric/Unit combinations at Challenge establishment and later config versions.
3. Make the approved automatic acceptance path explicit and attributable without resolving deferred Verification/correction.
4. Correct Streak timezone, same-day/no-late-log, and period-end result semantics.
5. Add time-based ending, authoritative finalization/final result, and persisted replay/rebuild across all three types.
6. Expose the aligned establishment/lifecycle seam to participants (revised PKG-1), then run the integrated Founder Preview.

**ARCHITECTURAL INFERENCE.** A standalone PKG-1 that merely exposes the existing establishment seam would publish incomplete Group authorization and Knowledge constraints. Polished experience work would then depend on truth that the Core Engine does not yet govern completely.

## 14. Existing Work That Remains Valid

The following work should be preserved and extended, not replaced:

- approved Stage EK, E1 and Stage F product doctrine and all recorded deferrals;
- approved hybrid provider allocation and provider-neutral interfaces;
- Firebase token issuer and PG Tiizi Member mapping;
- Firestore Group/Membership authority and the fail-closed read adapter;
- PG UUID referential shadows, provided they never authorize;
- Challenge identity/type/status schema, terminal no-reopen rule, and immutable config versions;
- Participation episode model and authenticated join/withdraw routes;
- canonical Knowledge identity/version pinning and PKG-2A publication readiness;
- atomic single-Challenge Activity application, idempotency, server scoring, and source-to-derived transaction;
- Collective exact total/overshoot behavior;
- Competitive cumulative completion and standard competition ranking;
- Streak all-configured-Activities-per-day handling and deterministic folds;
- V2 API client/hooks/read/log/participation screens as thin surfaces;
- V1 code that remains isolated legacy behavior; it is not a V2 migration requirement.

## 15. Minimum Missing Engine Capabilities

Only these gaps are needed for the minimum operational Engine baseline:

1. A governed Firestore Group/Group Membership mutation seam with enforced transitions and Group Challenge-creation policy, plus deterministic stable cross-store identity mapping before V2 Challenge establishment.
2. Challenge establishment/config-version validation against canonical Activity/Metric/Unit permitted combinations.
3. Separately identifiable Submission Intent, Evidence Eligibility, acceptance authority/Accepted Activity Event, and Challenge calculation application, retaining bounded automatic unverified acceptance.
4. Settled-rule-correct Streak processing, including governing timezone/day boundary, no ordinary late logging, and result at period end rather than early completion.
5. General scheduled ending/finalization, stable final result history (including Competitive position), and an authoritative persisted replay/rebuild seam.

Self-service onboarding, polished creation UI, templates, Run Again UX, Feed, Kudos, sharing, notifications, discovery, and broad visual work are not P0.

## 16. Tiizi Engine Operational Baseline

| ID | Operational capability | Exit test |
| --- | --- | --- |
| EOB-01 | Member identity/mapping | a Firebase-authenticated fixture resolves to one Tiizi Member and unknown mapping fails closed |
| EOB-02 | Group establishment/Membership | a Member creates or joins a valid Firestore Group through governed transitions; owner/private approval/leave rules and PG identity mapping are testable |
| EOB-03 | Challenge establishment/config validation | authorized Group Member creates each type; immutable v1 pins only published, compatible Activity/Metric/Unit Knowledge |
| EOB-04 | Participation | eligible Member affirmatively joins; exit/history and log-time episode ownership are enforced |
| EOB-05 | Activity submission/acceptance | attributable intent passes explicit eligibility and bounded automatic acceptance into exactly one accepted event and one Challenge application; rejection creates no derived effect |
| EOB-06 | Calculation/Derived Truth | each type deterministically persists correct current truth; replay reproduces and can authoritatively rebuild it |
| EOB-07 | Completion/finalization/history | goal/time rules end and finalize the Challenge; final participant/result truth is stable; same identity cannot reopen |

**NEW RECOMMENDATION.** Treat EOB-01 through EOB-07 as the gate before broad participant-facing work becomes primary. A simple Founder inspection surface may be built concurrently only to exercise these truths.

## 17. Gap / Priority Matrix

| Engine capability | Authority settled? | Implemented? | Operational? | Dependency | Next action | Priority |
| --- | --- | --- | --- | --- | --- | --- |
| Member identity mapping | Yes | Yes, pre-provisioned | Yes for controlled flow | Firebase token + PG mapping | reuse; add self-service later | P1 |
| Group establishment and owner Membership | Yes | legacy client only | No, not governed/atomic | Firestore retained | bounded trusted mutation seam | **P0** |
| Membership lifecycle/approval | Yes | partial client/rules | No | Group seam | enforce roles, statuses, transitions | **P0** |
| Group visibility relationship | Yes at product class level | partial | not broad-experience ready | Firestore rules/query model | enforce visibility at authority boundary | P1 |
| Group Charter representation | Required where applicable | fields exist | partial | Group seam | enforce creation/membership rules; version history later | **P0** for creation rule; P1 for broader Charter history |
| Challenge establishment seam | Yes | yes, CLI/domain | controlled only | Group + Knowledge checks | preserve seam; expose after alignment | P1 |
| Challenge creation authorization | Yes | membership-only | No | Group Charter | enforce owner/admin/member permission | **P0** |
| Knowledge publication/version/locale | Yes | yes in code | pending deployment | migrations 007/008 | deploy only under separate authorization | **P0 environment prerequisite; no code gap** |
| Activity/Metric/Unit compatibility | Yes | partial | No | Knowledge model/resolver | validate permitted combinations | **P0** |
| Participation join/withdraw | Yes | yes | Yes for simple eligibility | live Group Membership | preserve; add configured eligibility if used | P1 unless a preview Challenge uses extra eligibility |
| Submission Intent | Yes | collapsed into request/event | No as distinct fact | Activity path | persist attributable intent/state | **P0** |
| Evidence Eligibility/Acceptance | Yes for bounded automatic ordinary path | embedded, unattributed | Partial | Submission Intent | explicit policy decision + system acceptance attribution | **P0** |
| one-event/one-Challenge application | Yes | yes | Yes | accepted input | preserve uniqueness/idempotency | valid |
| Collective current truth | Yes | yes | Yes | accepted application | preserve | valid |
| Competitive current truth/ranking | Yes | yes | Yes pre-finalization | accepted application | preserve; freeze at finalization | valid/P0 finalization dependency |
| Streak truth | Yes | partial | No | timezone/day/period close | correct settled semantics | **P0** |
| Ending/finalization/final result | Yes | partial/absent | No | calculation + time trigger | add close/finalize and stable snapshot | **P0** |
| Replay/recalculation | Yes | read-only replay | Partial | immutable source records | authoritative persisted rebuild/finalize | **P0** |
| Run Again | Yes | no operation | No | finalized source Challenge | new-identity operation after preview | P1 |
| Templates | mechanism optional | legacy only | not needed | Knowledge/creation UX | reuse later if useful | P2 |
| Verification | No detailed decision | no | intentionally no | ACT-03 | preserve deferral | **DEFERRED** |
| Correction authority/workflow | No detailed decision | dormant event structure only | intentionally no | ACT-04 | preserve deferral; expose no workflow | **DEFERRED** |
| Recognition/Rewards | deferred | no V2 authority | intentionally no | MOT-01/Rewards | keep outside Challenge Engine | **DEFERRED** |
| V1 Challenge/progress/social truth | superseded for V2 | legacy | not a V2 dependency | isolation | no V2 work required | **LEGACY** |

## 18. Recommended Reordering

**Disposition:** **B. ENGINE BASELINE PARTIAL — BOUNDED ENGINE GAPS MUST CLOSE FIRST.**

**NEW RECOMMENDATION.** PKG-1 should **not proceed next as a standalone exposure package in its current sequence**. Preserve its authorized purpose, but place its participant-facing establishment endpoint at the tail of one bounded Engine Baseline Closure sequence:

1. Group mutation/identity/Challenge-create authorization and Knowledge compatibility.
2. Explicit ordinary automatic acceptance chain.
3. Streak correction plus ending/finalization/rebuild/final history.
4. Revised PKG-1 exposure of the now-aligned establishment/lifecycle seam.
5. Integrated Engine Founder Preview.
6. Broad participant experiences.

This is smaller than a corrective programme: it closes five concrete Engine capabilities and reuses the existing schemas, engines, adapters, and V2 UI. It does not create a new stage, migrate Group authority, or reopen settled decisions.

## 19. First Engine Founder Preview Target

The first useful preview is a plain, auditable harness over real authoritative paths—not a polished Home.

It must allow the Founder to inspect:

1. one Firebase-authenticated Tiizi Member;
2. governed creation/join of one Firestore Group and visible Membership state;
3. establishment of at least one Challenge of each type inside that Group with published compatible Knowledge pins;
4. voluntary Participation;
5. one attributable Submission Intent and its eligibility/automatic unverified acceptance/application trace;
6. server-calculated current truth and source identifiers;
7. Collective goal completion, Competitive final position, and Streak period-end result;
8. ending/finalization followed by repeat reads/replay proving stable history;
9. an attempted post-end log and same-identity reopen failing;
10. Run Again demonstrated, if included, as a new Challenge identity (the operation itself may remain P1 immediately after the first preview).

The existing V2 list/detail/join/log views may be reused. A small diagnostic trace/result panel and controlled establishment operation are sufficient. Feed, notifications, discovery, Kudos, sharing, cause presentation, and visual refinement are expressly out of scope.

## 20. Implication for Canonical Information

**SETTLED AUTHORITY.** Canonical Information continues to require separate identities and provenance for participant expression, accepted Activity, policy eligibility/application, and Derived Truth.

**ARCHITECTURAL INFERENCE.** The current two-row C1/C2 representation is insufficiently expressive for that approved chain even though its transaction prevents raw Evidence from reaching calculation. Alignment requires clearer authoritative records/links, not a new product concept and not a Verification decision.

## 21. Implication for Knowledge Runtime

**CURRENT IMPLEMENTATION EVIDENCE.** PKG-2A provides the publication, KCS, version, locale, lifecycle, and grandfathering mechanism in canonical code.

**NEW RECOMMENDATION.** Complete the narrow runtime-to-Challenge constraint: a config must pin not just a published Activity identity/version but an allowed Metric/Unit combination. Do not make catalogue authoring completeness or template migration a prerequisite for Engine readiness.

## 22. Implication for Technical Mapping / hybrid architecture

**SETTLED AUTHORITY.** No provider change is required. Keep:

- Firebase Auth as identity issuer;
- Firestore as Group existence/lifecycle and live Membership authority;
- PostgreSQL as V2 Knowledge, Challenge, Participation, accepted application, and Derived Truth authority;
- provider-neutral server interfaces at the boundary.

**NEW RECOMMENDATION.** Strengthen the Firestore mutation side behind a governed boundary and make mapping readiness an explicit, tested precondition using the existing shadow/import approach. Do not invent distributed atomicity, use the PG shadow for authorization, or propose Group migration. The current read adapter remains valid.

## 23. Immediate Next Action

**NEW RECOMMENDATION.** Founder reviews this assessment and, through the existing work-package authorization process, authorizes one bounded **Engine Baseline Closure** package scoped only to the five P0 areas in §15, with revised PKG-1 exposure last. No implementation is authorized by this document.

Before coding, the package should translate each EOB exit test into executable acceptance tests against the real Firestore/PG boundary. Migrations 007/008 remain not deployed until separately authorized.

## 24. Founder Decision Required, if any

**No new material product or authority decision is required to reach the operational baseline.** The P0 findings follow from settled Stage F, CIC/KRC/KCS, and hybrid authority. ACT-03, ACT-04, MOT-01, and Rewards stay deferred and do not block the bounded ordinary self-accountability preview.

**A programme authorization decision is required before implementation:** approve, reject, or amend the proposed reordering that places a bounded Engine Baseline Closure before standalone PKG-1/broad experience work. Until that decision, this assessment is prepared for review and authorizes no package.

## Assessment verdict

Tiizi has a credible and reusable engine foundation, not a finished operational Engine. The shortest path is to close the bounded authority and lifecycle gaps, expose the aligned chain in a simple Founder Preview, and only then make participant/social experience the primary implementation focus.

**FINAL DISPOSITION: B. ENGINE BASELINE PARTIAL — BOUNDED ENGINE GAPS MUST CLOSE FIRST.**
