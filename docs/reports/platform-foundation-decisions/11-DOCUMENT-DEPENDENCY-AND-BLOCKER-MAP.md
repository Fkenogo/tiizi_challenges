# Document Dependency and Blocker Map

## Constitutional and ownership documents

| Blocked document | Decisions that must be settled first |
|---|---|
| Tiizi Platform Constitution | PLT-01, PLT-02, PLT-03, PLT-04 |
| Product Domain and Terminology Standard | PLT-01, GRP-01, RSK-02, MOT-01 |
| Platform Data and Information Standard | IDP-01, IDP-03, ACT-01, ACT-02, KNW-01 |
| Entity Ownership and Source-of-Truth Register | ACT-02, KNW-01, KNW-04, ADM-01 |
| Roles, Permissions and Authorization Standard | IDP-01, GRP-01, CHL-01, ADM-01 |
| Privacy and Profile Visibility Policy | IDP-01, IDP-02, IDP-04, SOC-01 |

## Lifecycle and product behavior documents

| Blocked document | Decisions that must be settled first |
|---|---|
| Identity and Account Lifecycle Standard | IDP-02, IDP-03, IDP-04 |
| Group/Membership/Invitation Lifecycle | GRP-01, GRP-02, GRP-03, GRP-04 |
| Challenge Lifecycle and Behaviour Specification | PLT-04, CHL-01, CHL-02, CHL-03, CHL-04 |
| Activity Event, Verification and Correction Lifecycle | ACT-01, ACT-02, ACT-03, ACT-04 |
| Competition, Ranking and Tie Standard | RSK-01, RSK-02, RSK-03 |
| Streak Behaviour and Time Standard | RSK-04 |
| Social Content and Moderation Lifecycle | SOC-01, SOC-02 |
| Notification Product/Lifecycle Standard | NTF-01 |
| Motivation and Recognition Framework | RSK-02, MOT-01 |
| Support and Donation Policy | SUP-01, SUP-02 |

## Knowledge, analytics and operations documents

| Blocked document | Decisions that must be settled first |
|---|---|
| Knowledge Runtime Contract | PLT-03, KNW-01, KNW-04 |
| Snapshot, Provenance and Versioning Standard | CHL-03, KNW-02, KNW-03 |
| Cross-Domain Taxonomy and Interest Standard | PLT-03, KNW-04 |
| Product Analytics Measurement Plan | ANL-01, SUP-01, MOT-01 |
| Admin Operating and Audit Standard | GRP-04, SOC-02, SUP-02, ADM-01 |
| Deployment/Environment and Operations Runbook | ACT-03, ANL-01, ADM-01, OPS-01 |
| V1-to-V2 Migration Plan | IDP-03, GRP-03, CHL-03, ACT-01, KNW-01, KNW-02, KNW-03 |
| Platform QA and Acceptance Standard | Every approved lifecycle; especially IDP-01, ACT-02, ACT-03, RSK-01, OPS-01 |

## Discovery issue coverage

### P0

| Risk | Mapped decisions |
|---|---|
| PD-001 profile privacy | IDP-01, IDP-02 |
| PD-002 client/aggregate integrity | ACT-01, ACT-02 |
| PD-003 projection access/security | ACT-02, ADM-01, OPS-01 |
| PD-004 entity/source ownership | ACT-01, ACT-02, KNW-01, KNW-04, ADM-01 |

### P1

| Risk | Mapped decisions |
|---|---|
| PD-005 final-event async integrity | CHL-04, ACT-03 |
| PD-006 ranking contradictions | RSK-01, RSK-03 |
| PD-007 correction/idempotency | CHL-04, ACT-03, ACT-04 |
| PD-008 lifecycle gaps | IDP-03, GRP-02, GRP-03, CHL-01, CHL-02 |
| PD-009 role inconsistency | GRP-01, ADM-01 |
| PD-010 knowledge versioning | PLT-03, CHL-03, KNW-01, KNW-02, KNW-03 |
| PD-011 broad activity/profile access | IDP-01, ACT-02 |
| PD-012 profile media | IDP-04 |
| PD-013 donation truth | SUP-01, SUP-02 |
| PD-014 moderation | GRP-04, SOC-01, SOC-02, ADM-01 |
| PD-015 operations/recovery | ANL-01, OPS-01 |
| PD-016 missing platform governance | PLT-01, PLT-02, MOT-01 |

## Open-question reconciliation

| Open question | Consolidated into |
|---|---|
| OQ-01 deployed state | OPS-01 |
| OQ-02 profile audiences | IDP-01 |
| OQ-03 owner departure | GRP-02 |
| OQ-04 Coach/admin | GRP-01 |
| OQ-05 inactive group history | GRP-03 |
| OQ-06 ranking authority | RSK-01 |
| OQ-07 timezone/streak day | RSK-04 |
| OQ-08 corrected/deleted/late activity | CHL-04, ACT-03, RSK-04 |
| OQ-09 internal scoring | RSK-02, MOT-01 |
| OQ-10 payment truth | SUP-01 |
| OQ-11 catalogue/snapshots | KNW-01, KNW-02 |
| OQ-12 interest ownership | KNW-04 |
| OQ-13 notification channels | NTF-01 |
| OQ-14 retention | IDP-03, GRP-03, SOC-01, SUP-02 |
| OQ-15 moderation/appeal | SOC-02 |
| OQ-16 prototype routes | OPS-01 |
| OQ-17 KPI truth | ANL-01 |
| OQ-18 individual challenge | PLT-04, CHL-01 |
| OQ-19 profile media | IDP-04 |
| OQ-20 future domains | PLT-03 |
