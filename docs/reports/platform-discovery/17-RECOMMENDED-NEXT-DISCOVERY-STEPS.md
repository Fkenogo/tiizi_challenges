# Recommended Next Discovery Steps

These are investigation/documentation steps, not implementation proposals.

1. Verify production inventory read-only: deployed rules, indexes, functions, schedules and collection existence/counts, with explicit credentials and no writes.
2. Run a security-rules emulator matrix covering anonymous, user, member, group admin/owner, content manager, moderator, support and super-admin access.
3. Reproduce challenge completion, correction, duplicate-log, timezone and projection races in an isolated emulator.
4. Hold founder decision sessions for privacy, group ownership/roles, challenge ranking/streak semantics, internal scoring, donation terminology, retention and V2 domain scope.
5. Approve the entity ownership/source-of-truth register before designing V2 schemas.
6. Turn observed state machines into current-behavior lifecycle standards, explicitly recording unsupported transitions.
7. Reconcile all catalogue/template/content sources and establish historical snapshot/provenance requirements.
8. Audit production operational behavior: trigger failures, retries, scheduler health, logs, metrics freshness and recovery.
9. Draft the platform constitution and terminology standard, then the security/data standards, before domain designs.
10. Build a QA coverage plan from `06-USER-JOURNEY-AND-FLOW-CATALOGUE.md` and `11-TEST-AND-GUARD-COVERAGE.md`.

The immediate next phase should be a short founder governance and production-verification phase. Architecture finalisation should wait until the P0 data/privacy ownership questions and P1 lifecycle decisions are resolved.
