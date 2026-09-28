# TIIZI S6 Persistent Development Catalogue Population 001

**Date:** 2026-09-28

**Disposition:** Controlled persistent DEVELOPMENT population completed; stop for Founder review.

## Canonical authorization and target

Canonical repository: https://github.com/Fkenogo/tiizi_challenges. Canonical main at task start was b70390c81e450ddaefdc9eabfa623c91b54f3b99; Master Programme v2.14. Accepted catalogue content e45ecc9094bc6aae64fc71467904ea2afd0af834 and importer 0e695088b2e462b432d3f2aeafee7fa06d09eec7 are merged as PRs #56 and #57.

Repository inspection found no managed database target or credentials in the local API environment. The repository’s existing local-development configuration defines docker-compose.yml with PostgreSQL 17, restart: unless-stopped, and named volume tiizi-postgres-data; api/.env.example names the local database tiizi. No standard Compose development service/volume was running. Other live database containers were attached to task-specific preview worktrees, so they were not selected. The unrelated Homebrew cluster contained no tiizi database and was not used for catalogue data.

Established the configured service with Compose project tiizi-development, using the existing repository Compose file and POSTGRES_PORT=15433 to avoid the Homebrew service on port 5432. Target: local Docker Desktop, container tiizi-development-postgres-1, PostgreSQL 17.11 (postgres:17-alpine), database tiizi, loopback only at 127.0.0.1:15433, persistent named volume tiizi-development_tiizi-postgres-data, restart policy unless-stopped. The volume persists across container restarts and host sessions while Docker’s local volume is retained. This is a local DEVELOPMENT target and is not production. The service is left running for ongoing development/Founder preview. No managed provider was used and no persistent remote credentials were obtained.

## Migration and pre-import state

The new database had no application tables or data before migrations. Repository migrations 001–020 were applied from the accepted importer candidate; migration 020 is the current repository migration. After migration and before import: two Knowledge records, both coded canonical Activities and both Published exemplars; no other Activity Codes. FIT-STR-001 Push-Up UUID 11111111-1111-4111-8111-111111111111, Published v1; WEL-MND-003 Breathing Practice UUID 22222222-2222-4222-8222-222222222222, Published v1. No Challenges, group memberships, or Challenge activity configurations existed.

## Recovery point

Before apply, created custom-format PostgreSQL dump:

- Artifact: /private/tmp/tiizi-development-pre-import-20260928.dump
- SHA-256: 34fd1b5609e48cb9fcb0fabd7fbedb6b7e5a80d79b325bd759cb3b101aeafeb9
- Size: 127,520 bytes; mode 0600
- Created with PostgreSQL 17.11 pg_dump; pg_restore --list verified the archive.

To restore the captured pre-import state, stop any API/importer using this database, then restore the archive into the same local tiizi database using the local container: docker exec -i tiizi-development-postgres-1 pg_restore --clean --if-exists --no-owner --no-privileges --username=tiizi --dbname=tiizi. The named volume is separate from the dump; keep the dump artifact outside the Docker volume. This restores the migrated two-exemplar pre-import snapshot.

## Dry-run and controlled apply

The accepted importer candidate ran against this target in default dry-run mode (no --apply). Complete plan JSON and command log are held outside the repository at /private/tmp/tiizi-development-import-plan-001.json and .log. Result: expected/received 118; CREATE 116; REVISE 1; NO-OP 1; CONFLICT 0; BLOCKED 0; ERROR 0; applied 0. KCS applicability totals: Universal 118, Quantity/measurement 111, Technique 84, Protocol 34, Completion 43, Semantic 7, Safety 118.

Push-Up reconciled to NO-OP, preserving its UUID, Published lifecycle, version 1, and existing approved content. Breathing Practice reconciled by Activity Code to a legitimate revision with seven additional content deltas (setup, execution, formCues, commonMistakes, equipment, environment, adaptation). The approved measurementGuidance was explicitly retained in the resolved state. No duplicate was planned.

After the recovery point and safety gates passed, ran npm run knowledge:import-s6 -- --apply only against this local persistent development target. Result: expected/received 118; 116 CREATE; one REVISE; one NO-OP; zero conflicts; 117 entries applied. Existing Push-Up was unchanged. Breathing Practice advanced normally from version 1 to version 2, retained its UUID/lifecycle and approved measurementGuidance. No Activity was published.

## Post-population proof

Post-apply database state:

- Knowledge records: 118.
- Coded canonical Activities: 118; unique Activity Codes: 118; duplicates: 0.
- Lifecycle: 116 Draft, two Published (the existing Push-Up and Breathing Practice exemplars).
- Existing UUIDs and lifecycles preserved. The 116 new records received database-generated UUIDs.
- No Challenges, Challenge activity configurations, or memberships were created. Challenge eligibility is derived, not assigned by the importer: all new Draft Activities return challengeEligible=false; the two existing Published exemplars remain eligible under their existing contracts.
- No stored composer-selectability assignment exists; Composer options return 404 for Draft items.

Measurement contracts remain correct:

- WEL-NUT-009 Fasting: duration in hours; no day conversion.
- WEL-NUT-002 Fruit Intake and WEL-NUT-003 Vegetable Intake: quantity/servings with participant-declared portions; no universal portion equivalence.
- Optional-Weight Activities FIT-STR-019, FIT-STR-023, FIT-STR-025, and FIT-STR-036: empty load_reporting_bases; no Weight basis was invented. Their import succeeded; unsupported load-basis configuration remains unavailable through the fail-closed options seam.

The required second dry-run was saved at /private/tmp/tiizi-development-post-apply-plan-001.json with its command log alongside it. Result: 118 NO-OP, zero CREATE/REVISE/CONFLICT/BLOCKED/ERROR.

## API read verification

Read-only Fastify buildApp route injections used the actual local PostgreSQL database and Knowledge/options route handlers. A local synthetic token verifier and non-persisted member lookup projection satisfied the API authentication hook; no authentication, member, or membership row was created. This proves route/read behavior against the populated database, not Firebase token verification or a network-hosted preview.

- GET /v1/knowledge: 200, two Published Activities (Push-Up and Breathing Practice); Draft records excluded.
- GET /v1/knowledge?composerSelectable=true: 200, those same two existing eligible Published exemplars; new Draft records excluded.
- GET /v1/knowledge/:id and GET /v1/knowledge/code/:code: both existing exemplars resolve with preserved UUID, Published lifecycle, and measurement guidance. Representative new Fitness (FIT-BAL-001, Balance Practice) and Wellness (WEL-NUT-001, Water Intake) records resolve by identity with Draft lifecycle, publicationReady=true, challengeEligible=false. These direct identity reads are deliberately lifecycle-unfiltered so known records remain addressable; this does not publish them.
- GET /v1/knowledge/:id/options: 200 for both Published exemplars; 404 for representative Drafts, so Drafts cannot be configured in Composer.

No publication state was changed to increase API-visible counts.

## Boundaries

Population means the 118 canonical records now exist in persistent local development PostgreSQL. It does not mean publication completion. The 116 new records remain Draft; no Challenge eligibility/selectability was assigned to them. Production was not queried or modified; production Firebase was not queried. No S6 UI was implemented, no deployment occurred, and S6 Activity Library / Activity Guide assembly remains outstanding.
