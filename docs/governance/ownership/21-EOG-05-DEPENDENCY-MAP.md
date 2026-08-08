# EOG-05 Phase 0 — Constitutional Dependency Map

**Status:** Planning dependency map; no decision is resolved

**Date:** 2026-07-20

## 1. Purpose

This map identifies how a future Entity Ownership Register depends on approved EOG governance and the pending GRP, CHL, ACT, KNW and RSK decision families.

It records what each dependency blocks. It does not select an option, allocate a relationship, create lifecycle treatment or change a decision's status.

## 2. Constitutional Dependency Direction

```text
Document 00 and 00A
        ↓
Platform constitutional governance
        ↓
EOG-01 — mandatory accountability semantics
        ↓
EOG-02 — approved Group constitutional treatment
EOG-03 — approved Platform Knowledge treatment
EOG-04 — approved Challenge constitutional treatment
        ↓
EOG-05 Phase 0 — inventory, coverage and scope only
        ↓
Future reconciled Entity Ownership Register draft
        ↓
Founder and later-standard decisions allocate remaining relationships
        ↓
Final approved Entity Ownership Register
```

Lower layers may record approved treatment and explicit gaps. They may not supply an answer withheld by an upper layer or pending founder decision.

## 3. GRP Dependency Map

| Decision | Pending constitutional subject | Candidate entities affected | Relationship coverage affected | Register effect if later approved | Current restraint |
|---|---|---|---|---|---|
| GRP-01 | Canonical Group roles and authority | Group, Member, Group administrative action, Group Charter, Stewardship Council | Administrator, Delegate, Presenter, Downstream User; Authority scope | Enables role-independent accountability allocations to be mapped to later roles | EOG-05 may record no role bundle or administrative allocation. |
| GRP-02 | Stewardship reassignment, relinquishment and departure | Group, Group purpose, Group Charter, Stewardship Council | Accountable Steward, Delegate, Attributable Originator | Enables continuing Group stewardship treatment beyond the approved initial creator consequence | Exactly one Accountable Steward remains approved; reassignment procedure remains deferred. |
| GRP-03 | Group and membership lifecycle and history | Group, membership relationship, Member, Group purpose, Group Charter | Custodian, Administrator, Operator, Presenter, Downstream User | Enables lifecycle-dependent stewardship continuity, custody, history and departure treatment | No state, transition, archive or historical-access allocation may be inferred. |
| GRP-04 | Invitation, join request, removal and appeal | Membership relationship, Member, Group communication, Group administrative action | Attributable Originator, Administrator, Delegate, Participant boundary | Enables action-specific origin and administrative treatment under Participation Authority | Invitation or administration does not establish membership by implication. |

## 4. CHL Dependency Map

| Decision | Pending constitutional subject | Candidate entities affected | Relationship coverage affected | Register effect if later approved | Current restraint |
|---|---|---|---|---|---|
| CHL-01 | Challenge identity, purpose, Goal, authority, stewardship and taxonomy | Challenge, Challenge purpose, Goal, Target, Challenge Policy, Group Configuration, Community Context | Authority to Establish Truth, Accountable Steward, Contributor, Administrator, Delegate | Resolves the central Challenge truth and accountability cells and informs classification of purpose/Goal/Target rows | Governance, Group stewardship, creation and Administration cannot be assumed to establish these truths. |
| CHL-02 | Challenge lifecycle | Challenge, Challenge participation relationship, Participant, Challenge administrative action | Custodian, Administrator, Operator, Presenter, Downstream User | Enables state-sensitive allocation and continuity treatment | EOG-04 identity continuity is not a lifecycle or replacement test. |
| CHL-03 | Amendment and historical immutability | Challenge, purpose, Goal, Target, Policy reference, Historical Representation | Authority to Establish Truth, Custodian, Administrator, Attributable Originator | Enables attributable amendment and historical-preservation allocation | No materiality, amendment, snapshot, replacement or versioning rule is approved. |
| CHL-04 | Withdrawal, late activity, early completion and reopening | Participation relationship, Participant, events, Progress, Completion, Ranking, Streak | Participant, Authority to Establish Truth, Administrator, Downstream User | Enables event and derived-result use across later Challenge treatment | No withdrawal, lateness, finalization or reopening outcome may be entered in the register. |

## 5. ACT Dependency Map

| Decision | Pending constitutional subject | Candidate entities affected | Relationship coverage affected | Register effect if later approved | Current restraint |
|---|---|---|---|---|---|
| ACT-03 | Idempotency, duplicates, correction and deletion | Submission Intent, Acceptance Decision, Accepted Activity Event, Correction reference, Event administrative action, Progress, Completion, Ranking, Streak | Authority to Establish Truth, Attributable Originator, Administrator, Custodian, Downstream User | Enables correction-authority and downstream recalculation allocations | Historical integrity does not itself authorize correction, reversal or deletion. |
| ACT-04 | Verification, audit and downstream effects | Verification, Accepted Activity Event, Evidence Eligibility, Audit record and derived results | Information Subject, Authority to Establish Truth, Accountable Steward, Custodian, Administrator, Downstream User | Resolves the Verification truth row and its separation from acceptance and eligibility | Verification cannot be inferred to be Acceptance, Evidence Eligibility or Calculation Authority. |

## 6. KNW Dependency Map

| Decision | Pending constitutional subject | Candidate entities affected | Relationship coverage affected | Register effect if later approved | Current restraint |
|---|---|---|---|---|---|
| KNW-02 | Catalogue and Template versioning and historical representations | Knowledge Assets, Template, Runtime Catalogue, Runtime availability, Runtime Projection, Historical Knowledge reference, Historical Representation | Custodian, Administrator, Operator, Presenter, Downstream User | Enables historical and representation accountability without changing Authoritative Meaning | EOG-03 approves no snapshot, version format or lifecycle. |
| KNW-03 | Deprecation, deletion and historical references | All Knowledge Assets, Runtime Catalogue, Runtime Projection, historical candidates, Knowledge administrative action | Accountable Steward, Custodian, Administrator, Operator, Downstream User | Enables preservation, deprecation and historical-use allocations | Deletion or local absence cannot silently erase or redefine authoritative history. |
| KNW-04 | Interests, Goals, taxonomy, Knowledge relationships and Runtime Projection detail | Interest, Goal, taxonomy/controlled-vocabulary asset, Knowledge relationship, Runtime Projection, Exercise Asset, Wellness Activity Asset | Governed Subject classification, Information Subject, Contributor, Downstream User | Resolves row boundaries and cross-domain relationship detail | Discovery classifications remain outside Platform Knowledge; Runtime Projection remains a representation. |

## 7. RSK Dependency Map

| Decision | Pending constitutional subject | Candidate entities affected | Relationship coverage affected | Register effect if later approved | Current restraint |
|---|---|---|---|---|---|
| RSK-01 | Authoritative ranking source and metric | Ranking, Leaderboard, Progress, Projection | Authority to Establish Truth, Downstream User, Presenter | Refines which approved Calculation truth the rows concern | Calculation Authority remains controlling; leaderboard remains presentation. |
| RSK-02 | Normalisation and terminology | Ranking, Projection, Leaderboard, Analytical interpretation | Authority to Establish Truth, Presenter, Downstream User | Enables method-specific derived and presentation treatment | A Metric or normalized value is not a Reward or ungoverned “points” by implication. |
| RSK-03 | Tie, fairness and finalization | Ranking, Leaderboard, Completion, Audit record | Authority to Establish Truth, Administrator, Custodian, Presenter | Enables finalization and accountable correction dependencies | No tie or fairness rule may be inferred from the Calculation Authority boundary. |
| RSK-04 | Streak qualification, time, grace and correction | Streak, Activity Events, Evidence Eligibility, Progress, Recognition | Authority to Establish Truth, Administrator, Downstream User | Enables Streak-specific Policy and correction treatment | No timezone, grace, multi-activity or correction rule is approved. |

## 8. Cross-Family Dependencies

| Cross-family dependency | Why both are required | Register consequence |
|---|---|---|
| GRP-01 + CHL-01 | Group administration or stewardship cannot imply Challenge governance. | Challenge accountability allocations must be declared independently of Group role titles. |
| GRP-03 + CHL-04 | Membership and Challenge participation have separate lifecycles. | Member and Participant rows cannot share a state or actor allocation by implication. |
| CHL-03 + KNW-02/KNW-03 | Challenge history depends on historically applicable Knowledge while remaining distinct from Knowledge lifecycle. | Historical Representation must preserve both layers without transferring Authority. |
| CHL-04 + ACT-03/ACT-04 | Challenge outcomes depend on accepted and eligible evidence, including later correction and Verification treatment. | Event and Derived Truth rows cannot be finalized until their relationship effects are governed. |
| ACT-03 + RSK-03/RSK-04 | Corrections may affect ranking and Streak outcomes. | Correction Authority and calculation finalization remain separate register dependencies. |
| KNW-04 + CHL-01 | Goal, taxonomy and Knowledge relationships affect composition meaning without turning Goals into Knowledge. | Candidate-row classification must preserve the Discovery, Knowledge and Challenge boundaries. |

## 9. Other Dependencies Preserved

This task's required map focuses on GRP, CHL, ACT, KNW and RSK. A final register also remains dependent on approved or future IDP, SOC, NTF, MOT, ANL, ADM and OPS governance for identity, social content, notification, Recognition, analytics, administration and operations.

Their omission from the five-family matrix is not an approval or a finding that they are resolved.

## 10. Dependency Result

The pending families do not prevent a transparent draft register from recording approved boundaries and explicit gaps. They do prevent approval of a fully allocated Entity Ownership Register.

CHL-01 is the primary Challenge allocation blocker. ACT-03 and ACT-04 remain the principal activity-integrity blockers. GRP decisions govern continuing Group accountability beyond approved initial stewardship. KNW decisions govern classification and historical treatment. RSK decisions refine calculation and presentation accountability without changing Calculation Authority.
