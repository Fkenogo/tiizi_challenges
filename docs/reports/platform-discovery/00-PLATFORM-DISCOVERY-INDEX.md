# Tiizi Version 2 Platform Discovery Index

## Audit identity

- Repository: `/Users/theo/tiizi_revamp`
- Branch/SHA: `main` at `9dd1b4ccbc968afa782e93f582bc64afbd8dd435`
- Audit mode: repository-only, read-only runtime discovery
- Production data/deployment: not accessed or changed
- Observed implementation, documented intent, inference and unresolved questions are kept separate.

## Evidence pack

1. [Executive Summary](01-EXECUTIVE-SUMMARY.md)
2. [Repository Baseline](02-REPOSITORY-BASELINE.md)
3. [Existing Documentation Inventory](03-EXISTING-DOCUMENTATION-INVENTORY.md)
4. [Application Surface Catalogue](04-APPLICATION-SURFACE-CATALOGUE.md)
5. [Capability Map — Current State](05-CAPABILITY-MAP-CURRENT-STATE.md)
6. [User Journey and Flow Catalogue](06-USER-JOURNEY-AND-FLOW-CATALOGUE.md)
7. [Data and Information Model](07-DATA-AND-INFORMATION-MODEL.md)
8. [State Machine Catalogue](08-STATE-MACHINE-CATALOGUE.md)
9. [Roles, Permissions and Security](09-ROLES-PERMISSIONS-AND-SECURITY.md)
10. [Service, Function and Integration Catalogue](10-SERVICE-FUNCTION-AND-INTEGRATION-CATALOGUE.md)
11. [Test and Guard Coverage](11-TEST-AND-GUARD-COVERAGE.md)
12. [Documentation Coverage Matrix](12-DOCUMENTATION-COVERAGE-MATRIX.md)
13. [Documentation Master Index Draft](13-DOCUMENTATION-MASTER-INDEX-DRAFT.md)
14. [Platform Abstraction Gaps](14-PLATFORM-ABSTRACTION-GAPS.md)
15. [Gap and Risk Register](15-GAP-AND-RISK-REGISTER.md)
16. [Open Questions and Decisions](16-OPEN-QUESTIONS-AND-DECISIONS.md)
17. [Recommended Next Discovery Steps](17-RECOMMENDED-NEXT-DISCOVERY-STEPS.md)

## Supporting evidence

- [Repository baseline](evidence/repository-baseline.txt)
- [Route evidence](evidence/route-evidence.tsv)
- [Documentation file inventory](evidence/documentation-inventory.tsv)
- [Runtime source inventory](evidence/runtime-source-inventory.tsv)
- [Script risk inventory](evidence/script-risk-inventory.tsv)
- [Commands and validation](evidence/commands-and-validation.txt)

## Scope boundary

This pack maps the inspected working tree. It does not certify deployed Firebase rules, functions, indexes, data populations, schedules, IAM, analytics freshness, payment settlement, push delivery, or production secrets. Existing dirty worktree changes pre-dated the audit and are identified in the baseline; this task created only this directory.
