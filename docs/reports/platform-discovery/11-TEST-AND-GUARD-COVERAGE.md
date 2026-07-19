# Test and Guard Coverage

## Inventory

The repository has 101 script files; `evidence/script-risk-inventory.tsv` classifies each as a read-only candidate, write-risk/do-not-run, or uncertain utility. Tests are predominantly executable TypeScript guard scripts rather than a conventional unit-test runner suite.

| Capability/flow | Evidence | Coverage character | Gap |
|---|---|---|---|
| Build/type safety | `npm run build` (`tsc -b && vite build`) | whole-project compile/bundle | no behavioral assertions |
| Challenge creation | `testChallengeCreation6Combinations.ts`, backend and payload audits | structural + pure/backend checks | not full browser/emulator journey |
| Challenge progress/scoring | scoring guards, progress integrity audit, activity model test | strong source/pure-function coverage | deletion, retry, concurrent log and timezone scenarios weak |
| Home/feed | home challenge feed/performance guards | source/shape/runtime helpers | projection/rule deployment integration absent |
| Group lifecycle | group lifecycle, invite backend, routing/UX guards | backend pure/guard coverage | ownership transfer/role changes absent |
| Onboarding/profile | onboarding guards and persistence runtime scripts | working-tree regression coverage | Auth/emulator end-to-end incomplete |
| Donations | donation pilot/admin/runtime/status rule guards | status and UI guard coverage | no payment-provider integration by design |
| Admin challenge/catalogue | admin management and template audits | service/source coverage | permission matrix/emulator coverage incomplete |
| Profile analytics | profile analytics guards | aggregation/UI checks | freshness/rule access not integrated |
| Security rules | targeted rule scripts and source inspection | partial | no comprehensive role × collection denial matrix |
| Catalogue | wellness/fitness audits and seed guard scripts | data/source coverage | live population not verified |
| Notifications | — | — | no delivery/read-state behavioral suite |
| Social comments/reactions | — | — | membership, moderation, deletion tests missing |
| Account lifecycle/privacy | — | — | privacy enforcement/deletion tests missing |
| Operational jobs | function core tests/guards | partial pure logic | scheduled deployment, retries and alerting unverified |

## Test quality findings

Many scripts use source-text assertions to prevent accidental regression. These are useful architecture guards but can pass while deployed rules, Firestore indexes, data or asynchronous behavior differs. Write-capable audit scripts exist alongside read-only ones; every script requires argument and credential review before execution.

No single command runs a platform acceptance suite. The root package has no Jest/Vitest/Cypress/Playwright script. Cloud Functions can be tested as pure cores, but active emulator integration is selective.

## Required QA governance

A platform flow-to-test standard is missing. It should distinguish pure domain tests, rule emulator tests, callable integration, projection/reconciliation, browser journeys, operational job tests, accessibility, and deployment smoke tests.
