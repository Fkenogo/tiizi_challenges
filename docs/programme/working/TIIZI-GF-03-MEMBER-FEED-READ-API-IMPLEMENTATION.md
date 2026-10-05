# TIIZI — GF-03 Member Feed Read Model & API — Implementation Record

**Status:** IMPLEMENTED CANDIDATE / AWAITING INDEPENDENT R2 REVIEW
**Canonical base:** `ec4a6385ad59f75415cf48480cfc9fb149d265ee`
**Branch:** `codex/gf03-member-feed-read-api`
**Review classification:** R2 — independent high-rigor review required
**Product Truth:** GF-01, effective
**Publication authority:** GF-02, merged
**External review authority:** [FEF-EWPCS-001-AMD-001 — Development Preview and Proportionate Review](https://github.com/Fkenogo/founder-engineering-framework/blob/main/docs/engineering/FEF-EWPCS-001-AMD-001-DEVELOPMENT-PREVIEW-AND-PROPORTIONATE-REVIEW.md), APPROVED — ACTIVE

## Scope delivered

GF-03 adds one authenticated member endpoint, `GET /api/groups/:groupId/feed`, backed by a bounded PostgreSQL read service. It reuses the existing Firebase token → Tiizi Member identity seam and PostgreSQL `GroupMembershipAuthority`; only a currently eligible `active`/`joined` membership reads the Feed. The Accountable Steward receives no bypass. Membership is checked on every request, including cursor requests, and denials use the generic Group 404 contract.

The read query consumes only `group_feed_projection`, scoped to the route Group, with `suppressed_at IS NULL`, an inclusive rolling 90-day boundary, active Group, and a current Challenge joined by both Challenge and Group IDs. It does not read outbox rows. Challenge lifecycle state is not compared with historical event type, preserving valid established/started cards after normal progression. Missing or mismatched source Challenges are silently omitted.

Cards contain only Feed event ID, allow-listed event type, current visible Challenge ID/title, the fixed GF-01 presentation title, source transition timestamp, and a server-derived Challenge navigation target. GF-02 operational fields, suppression reasons, Activity, evidence, notes, identities and result values are absent. Responses use `Cache-Control: private, no-store`, including authentication failures.

Pagination uses 20 by default and 50 maximum, newest first by `(source_transition_at DESC, feed_event_id DESC)`. The opaque cursor binds version, Group, ordering, direction, page size, last returned/scan boundary, issue time and 24-hour expiry. HMAC-SHA-256 uses the runtime secret `TIIZI_GROUP_FEED_CURSOR_SECRET` (minimum 32 UTF-8 bytes), following the API's existing runtime-secret convention. Tampered, cross-Group, expired, and unsupported cursors fail with one generic error.

Ended/finalized consolidation occurs in the relational visibility set before page limiting. An ended card is omitted only when an unsuppressed, retained finalized projection exists for the same Group and Challenge and its current source remains visible. No GF-02 event is modified.

## Files and schema

- `api/src/groupFeedReads.ts` — response contract, authorization, query, cursor validation/signing, route.
- `api/src/app.ts` — route registration with the existing Group Membership authority seam.
- `api/test/groupFeedReads.test.ts` — focused security/contract tests.
- `api/.env.example`, `api/README.md`, `api/DEPLOY.md` — signing-secret configuration seam.
- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` — programme version/status update.

No migration was added or changed. Migration 025 remains undeployed. GF-04, Feed UI, Group Home, Today, Kudos, Share, Recognition, notifications, moderation UI and production scheduling remain out of scope.

## Required independent review

The implementing agent does not self-certify final technical acceptance. The independent reviewer must inspect the exact pushed commit for:

1. route and authentication chain;
2. Group membership and private-Group denial behavior;
3. source visibility and historical-transition validity;
4. cross-Group source/query/cursor/navigation isolation;
5. cursor signing, tampering, expiry and pagination behavior;
6. suppression, retention and ended/finalized consolidation;
7. cache/revocation semantics;
8. disclosure minimization and focused security-test evidence;
9. scope creep, migration 025 containment, and absence of UI/Today/social features.

Required evidence: exact implementation SHA, reviewed diff, focused security/contract test results, full API validation, and any findings with disposition. No merge or deployment is authorized by this record.
