# TIIZI — GF-02 PostgreSQL Publication Authority — Implementation Record

**Status:** COMPLETE / R1 TECHNICALLY ACCEPTED / FOUNDER ACCEPTED / READY FOR MERGE
**Canonical base:** `origin/main` at `7e2113e1f97de87897ebd698fbbddfef434e74cf`
**Branch:** `codex/gf02-publication-authority`
**Programme:** Master Programme 2.34
**Migration:** `025_group_feed_publication_authority.sql`
**Review classification:** R1 — targeted technical review

## Authority and boundary

This implementation follows GF-01 at `docs/product-truth/TIIZI-GF-01-GROUP-FEED-EVENT-CONTRACT.md`. It treats Feed as a subordinate publication and projection of Challenge truth. The publication record is written in the same PostgreSQL transaction as each eligible source transition; projection processing is downstream and cannot modify source truth.

The only automatic event types are `challenge_established`, `challenge_started`, `together_goal_achieved`, `challenge_ended`, and `challenge_finalized`. The source-transition uniqueness key is `(source_type, source_id, event_type, source_transition_version)` and a deterministic server-generated event identity is additionally unique. Publication Group and timestamps are derived from the stored Challenge, not caller-supplied metadata. The envelope contains no arbitrary JSON or Activity, evidence, note, rank, score, result, or health-like payload.

The schema adds three Feed-owned tables: `group_feed_outbox`, `group_feed_projection`, and `group_feed_projection_actions`. Composite Group-bound constraints connect Feed-owned rows without making Feed storage own or cascade-delete Challenge or Group truth. Projection records preserve ended and finalized events independently. They contain only transition identity and timestamps; member-facing card assembly remains GF-03.

The bounded worker claims PostgreSQL batches with `FOR UPDATE SKIP LOCKED` and a lease. Projection and successful outbox completion commit atomically. Failures retry with bounded exponential delay, then remain visible as `blocked`; an explicit trusted CLI command reopens blocked rows. Expired claims are recovered or blocked according to attempt count. Projection expiry is a bounded CLI operation at 90 days; minimal outbox transition identity remains for deduplication. No scheduler or production purge process was added. A formal retention period for minimal publication/action metadata remains an operational policy question and does not block this package.

System suppression and source-revalidated restoration affect only projection state and append fixed-code, system-attributed action records. No human actor pathway, role, permission, console, or route is introduced.

## Source seams

- Challenge establishment: `establishChallengeV2` and the canonical definition establishment transaction in `api/src/challengeEstablishment.ts`.
- Challenge start: `activateChallenge` in `api/src/challenges.ts`; its existing establishment-to-active transition and outbox insertion now share a transaction. The original date gate and lifecycle semantics remain in place.
- Together Goal: the authoritative `collective_goal_reached` false-to-true processing path in `api/src/challengeActivityApplication.ts`; the event uses the governing config version. The same transaction publishes `challenge_ended` only if that transaction also actually changes lifecycle state to ended.
- Challenge ended: `endChallenge` in `api/src/challenges.ts` publishes only active-to-ended. Existing establishment-to-ended behavior remains but is not an approved automatic event.
- Challenge finalized: successful canonical finalization in `api/src/challengeFinalization.ts`; if expiry processing ends an active Challenge as part of finalization, its ended event is recorded in that source transaction too.

Ended and finalized remain separate outbox/projection identities. No member-facing consolidation or supersession behavior is implemented.

## Processing operations

From `api/`, the package adds:

- `npm run feed:process -- --limit 50`
- `npm run feed:retry-blocked -- --limit 50`
- `npm run feed:expire-projections -- --limit 50`

Each batch is limited to 100 rows and prints a structured summary. These commands are execution mechanisms only; no scheduler or hosted worker was configured.

## Verification

Executed from the isolated branch worktree:

- API full test suite after R1 correction: **826 passed, 8 skipped; 61 files passed, 1 skipped**. The skips are the existing Firestore-emulator suite (8 tests; emulator not configured).
- API typecheck: **passed** (`npm run typecheck`).
- API build: **passed** (`npm run build`).
- Root architecture guards: **passed** (`npm run test:architecture-guards`): boundary guard, boundary regression fixtures, V2 experience boundary, V2 runtime boundary, and V2 frontend guards.
- Root application build: **passed** (`npm run build`, TypeScript and Vite). Existing informational warnings reported stale Browserslist data and a large bundle chunk.
- Focused GF-02 and source-seam rerun after R1 correction: **110 passed across 6 files** (`groupFeedPublication`, `groupFeedCli`, `challengeEstablishment`, `challengeScheduledLifecycle`, `challengeActivityApplication`, and `ebc04EndingFinalizationRebuild`).
- Root boundary guard: **passed** (`npm run test:boundary`).
- `git diff --check`: **passed** for the correction commit.

Root/frontend and API dependencies were installed from the lockfiles using offline npm cache in ignored `node_modules`; no lockfiles changed. Root architecture guard verified the V2-to-V1 runtime boundary, including its V1 Feed inaccessibility guard. V1 Feed implementation files were not opened, inspected, or reused.

## Exclusions and review

No member Feed endpoint/read authorization, cursor or pagination contract, UI, Group Home assembly, Today change, Kudos, Share, Recognition, notification, comments/posts, production scheduler, broker, or deployment was added. GF-03 retains member-scoped reads. No migration was deployed. No schema or behavior beyond additive publication authority and the minimal authorized lifecycle atomicity correction was intended.

R1 applies while the package remains additive, contained, subordinate to source truth, and without new authorization, cross-tenant read capability, production infrastructure, or changes to domain/derived-truth semantics. Targeted review should focus on the five source seams, start/end/finalization concurrency, Together crossing idempotency, transaction retry behavior, group binding, worker recovery, and migration containment. No known R2 escalation trigger was introduced.

TLC-001 remains deferred for Tiizi. This package does not change prior readiness decisions or rely on Klockit pilot evidence.

## Changed files

- `api/migrations/025_group_feed_publication_authority.sql`
- `api/package.json`
- `api/src/challengeActivityApplication.ts`
- `api/src/challengeEstablishment.ts`
- `api/src/challengeFinalization.ts`
- `api/src/challenges.ts`
- `api/src/groupFeedCli.ts`
- `api/src/groupFeedPublication.ts`
- `api/test/challengeEstablishment.test.ts`
- `api/test/challengeScheduledLifecycle.test.ts`
- `api/test/ebc04EndingFinalizationRebuild.test.ts`
- `api/test/groupFeedCli.test.ts`
- `api/test/groupFeedPublication.test.ts`
- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md`
- `docs/programme/working/TIIZI-GF-02-POSTGRESQL-PUBLICATION-AUTHORITY-IMPLEMENTATION.md`

The exact implementation commit, validation rerun results, PR identity, and any subsequent review finding will be recorded in the delivery response.

## R1 targeted review correction

Reviewed PR #75 head `166ba9d1e8c565d4a71a6eff98588cc63c6a9aa7` returned **GF-02 IMPLEMENTED — R1 CORRECTION REQUIRED**. Current `origin/main` was fetched before correction and remained `7e2113e1f97de87897ebd698fbbddfef434e74cf`; the existing PR branch was continued.

**Finding 1 — Group/source mismatch:** the prior worker classified a Challenge Group mismatch as ordinary invalidation and wrote a suppressed projection using the poisoned outbox Group. The worker now re-reads and locks the authoritative Challenge source (`FOR SHARE`), distinguishes Group mismatch, missing source, invalid publication identity, and same-Group source ineligibility, and does not swallow database errors as invalidation. Group mismatch blocks the outbox with fixed code `group_scope_mismatch`, clears the claim, and writes no projection. Missing source and invalid publication identity also block with bounded fixed codes. A same-Group source transition that is no longer eligible can still create a system-suppressed projection. The new test proves no projection is written under the substituted Group, Challenge Group truth remains unchanged, the outbox retains the mismatch for diagnosis, and the trusted blocked-row recovery path succeeds after the inconsistency is explicitly corrected.

**Finding 2 — processing/suppression states:** migration 025 no longer allows `suppressed` as an outbox status. Outbox processing is limited to `pending`, `processing`, `projected`, `blocked`, and `expired`. Projection suppression remains in `group_feed_projection.suppressed_at` and `suppression_reason_code`, with the existing system action trace. Applying and restoring suppression leave outbox status `projected`. Same-Group source invalidation that creates an already-suppressed projection also completes the outbox as `projected`. Added assertions cover projected→suppressed, suppressed→restored, source invalidation, and Group mismatch. Recovery remains deterministic; projection errors remain isolated from Challenge truth.

Migration 025 was corrected directly while unmerged and undeployed; no migration 026 was added. No database deployment occurred. GF-02 remains an implemented candidate awaiting R1 revalidation, not complete or Founder accepted. GF-03 remains unstarted.

## Founder acceptance and merge closure

Founder disposition: **GF-02 COMPLETE / R1 TECHNICALLY ACCEPTED / FOUNDER ACCEPTED / READY FOR MERGE**, with R2 escalation not required. PR #75 was reviewed at corrected technical head `1e063d026f0f412e2657e1f40becf65b1ce0f0d2`; initial implementation head `166ba9d1e8c565d4a71a6eff98588cc63c6a9aa7`. R1 Finding 1 (Group/source mismatch fails closed as blocked with no projection) and Finding 2 (outbox processing state is separate from projection suppression) are closed.

The technical head passed the complete API suite (826 passed; 8 existing Firestore-emulator tests skipped), focused GF-02/source-seam tests (110 passed across 6 files), API typecheck/build, root boundary guard and root application build. Repository CI on the reviewed technical head was green: API, API contract, API image, web, Functions, and boundary. The Cloudflare Workers Builds check failed separately and is treated as the documented non-gating external check; no Cloudflare configuration was changed and no deployment occurred. Migration 025 remains code-authorized and NOT deployed.

The closure commit changes programme/implementation records only. It records no additional technical implementation. GF-03 remains unstarted and NOT IMPLEMENTATION-AUTHORISED; member Feed reads/API/UI remain unimplemented. Today GF-07, Kudos, Share and Recognition remain deferred. No production scheduler or deployment was added.
