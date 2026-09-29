# TIIZI S6 DEVELOPMENT Catalogue Publication 001

**Disposition:** Founder approved publication of the 116 currently Draft canonical Activities whose live publication readiness was true.

**Result:** Publication complete in the local DEVELOPMENT PostgreSQL catalogue. S6 Library / Guide remains **IMPLEMENTED CANDIDATE / AWAITING FOUNDER EXPERIENCE REVIEW**. This record does not mark S6 complete, accept the interface, or authorize merge/deployment/production activity.

## Scope and baseline

- Candidate source SHA: `4f1beb336bdf7c6b07a16c27499633e35bbb78b3`
- Branch: `impl/tiizi-s6-activity-library-guide-001`
- DEVELOPMENT endpoint: `127.0.0.1:15433`, database `tiizi`
- PostgreSQL: 17.11; migrations `001_phase_a_foundation.sql` through `020_remove_group_reconciliation_timestamp_bypass.sql` (20 present)
- Pre-publication: 118 canonical coded Activities, 118 unique codes; 116 Draft / 2 Published / 0 Retired; 118 publicationReady
- Existing Published exemplars before the action: `FIT-STR-001`, `WEL-MND-003`
- Six accepted semantic-definition revisions remained at Knowledge version 2 and ready: `WEL-DLY-004`, `WEL-NUT-002`, `WEL-NUT-003`, `WEL-NUT-007`, `WEL-NUT-008`, `WEL-NUT-009`.

## Recovery point and state snapshots

A DEVELOPMENT-only PostgreSQL custom-format dump was created before lifecycle mutation:

- Path: `/private/tmp/tiizi-development-pre-publication-2026-09-29T0905Z.dump`
- Archive timestamp: 2026-09-29 09:04:10 UTC
- Size: 236 KiB
- SHA-256: `26ce737c731c4fb1dc1a7e7ba0a764277c270af0d364bd99210aef1aa565e378`
- Validation: `pg_restore -l` read the archive successfully and enumerated 204 TOC entries (custom format, PostgreSQL dump version 1.16).
- Listing: `/private/tmp/tiizi-development-pre-publication-2026-09-29T0905Z.restore-list.txt`

Restore into the same DEVELOPMENT database (this replaces its current contents):

```sh
# Stop the local API first. Then:
docker exec tiizi-development-postgres-1 dropdb --if-exists -U tiizi tiizi
docker exec tiizi-development-postgres-1 createdb -U tiizi tiizi
docker exec -i tiizi-development-postgres-1 pg_restore -U tiizi -d tiizi --no-owner --no-privileges < /private/tmp/tiizi-development-pre-publication-2026-09-29T0905Z.dump
```

The pre-publication machine snapshot at `/private/tmp/tiizi-s6-development-prepub-snapshot.json` contains all 118 Activity Codes, UUIDs, lifecycle/version, readiness, eligibility and selectability, authored fields, measurement contracts and content fingerprints. SHA-256: `88fd86d3d45c1df62d18dfc4aeb96ff149b355e24d03ce823b59d3efaff37139`.

The sequential operation log is `/private/tmp/tiizi-s6-development-publication-2026-09-29.json`. SHA-256: `ebc05bfcfc9f1d515092b59d6cff53d28101ab15726c9a5fbccb5f3daf0e52ee`.

The post-publication machine snapshot is `/private/tmp/tiizi-s6-development-postpub-snapshot.json`. SHA-256: `2e6dc1497f9f89334eb1e49918418cff6d00818cc8f1181257856c70969a90e0`.

## Governed publication operation

The execution utility captured the authorized pre-state and then, for each of the 116 pre-snapshot Drafts, re-read by immutable Activity Code and checked UUID, Draft lifecycle, unchanged Knowledge version, and `publicationReady=true`. It invoked the existing `setKnowledgeLifecycle(db, id, 'published')` operation once per Activity and verified the returned UUID/code, Published lifecycle, unchanged Knowledge version, and readiness. It stopped on the first unexpected condition.

- Transitions attempted: 116
- Successful: 116
- Failed: 0
- Direct lifecycle SQL updates: none
- Alternate/bulk publication authority: none
- Manual eligibility or composer-selectability changes: none

## Post-publication result

Live PostgreSQL reads and the canonical Knowledge engine report:

| Measure | Result |
| --- | ---: |
| Canonical coded Activities | 118 |
| Unique Activity Codes | 118 |
| Published / Draft / Retired | 118 / 0 / 0 |
| publicationReady | 118 true / 0 false |
| challengeEligible | 118 true / 0 false |
| composerSelectable | 118 true / 0 false |

The challenge and composer states are derived by the existing engine after publication. No manual state assignment was made.

### Identity and content preservation

A comparison of all 118 pre/post rows found no Activity Code, UUID, Knowledge version, or authored-content fingerprint drift. The fingerprint covers name/category/description, all measurement and content fields, metrics/units, load-reporting bases, semantic definitions and safety notes. Lifecycle is the intended change.

- The six semantic-definition Activities remain version 2; publication did not create a content version.
- `WEL-NUT-009` remains Duration / Hours. Guidance records actual elapsed hours without days conversion; content prescribes no duration, schedule, frequency or intake protocol.
- `WEL-NUT-002` and `WEL-NUT-003` remain Quantity / servings. Participants use their own consistent serving interpretation; there is no universal physical portion definition.
- Optional Weight bases remain empty for `FIT-STR-019`, `FIT-STR-023`, `FIT-STR-025` and `FIT-STR-036`.

## Authenticated Knowledge API verification

The local V2 API was run against the DEVELOPMENT PostgreSQL database and authenticated via the loopback Auth emulator. Reads returned:

- `GET /v1/knowledge`: 118 Published items.
- `GET /v1/knowledge?canonicalOnly=true`: 118 items, all canonical V2 Activity Codes.
- `GET /v1/knowledge?composerSelectable=true`: 118 Published, ready, eligible items.
- Category `Nutrition & Hydration`: 9 items.
- Search `fasting`: `WEL-NUT-009`.
- By-UUID Fitness detail: `FIT-STR-001`, Published.
- By-Code Wellness detail: `WEL-MND-003`, Published.
- PF-04 options by UUID worked for both exemplars: `FIT-STR-001` returned Repetitions / reps; `WEL-MND-003` returned Completion and Duration / completion, minutes and seconds.

No authentication weakening was added. No direct Firestore or V1 catalogue read was introduced.

## Founder preview preparation

The preview is running locally at:

- Guide URL: **http://127.0.0.1:5173/v2/guide**
- Unauthenticated browser entry redirects to `/v2/sign-in?next=%2Fv2%2Fguide`.
- API: `http://127.0.0.1:4000`, bound to loopback, using the DEVELOPMENT database.
- Firebase Auth: loopback emulator at `http://127.0.0.1:9099`, project `demo-tiizi-s6-local` only.
- Test account: `founder1@tiizi.local`
- Local emulator password: `TiiziPreview2026` (local-only; do not use outside the emulator).

The local preview is authenticated in the loopback Auth emulator using the DEVELOPMENT Founder test account. The member identity is linked to a DEVELOPMENT `members` row. This task did not seed a Group or persist a Challenge. Founder preview was exercised in the browser: the compact Guide showed all 118 published records; search and category filters returned canonical results; Activity detail retained its authored sections; Challenge Step 3 returned to the existing draft after inspection without selecting Burpee, added Burpee only after the explicit detail CTA, then removed it while remaining on Step 3. The non-persisted browser draft was left with no Activities selected. The Guide remains open at `/v2/guide`, and a second tab is at Challenge Step 3. Completing Challenge setup still requires the existing governed Group context and the current UI must not be submitted as a Challenge. No alternate Challenge authority was created. This operational evidence is not Founder acceptance of the corrected experience.

## Validation

- Full API suite: **726 passed / 8 skipped** (the skipped tests require the Firestore emulator); includes Knowledge, PF-01, PF-02, PF-03 and PF-04 regressions.
- API typecheck and build: passed.
- Frontend TypeScript/Vite build: passed; Vite reported existing advisory warnings for an old Browserslist database and a >500 kB minified chunk.
- Functions lint and build: passed.
- S6 Activity Library guards: passed.
- S6 Challenge Activity discovery and draft-handoff regression: passed.
- V2 Experience boundary: passed.
- V2 runtime boundary: passed.
- Mobile primary navigation: passed.
- V2 frontend guards: passed.
- S2a API seam and S2b Challenge creation guards: passed.
- `git diff --check`: passed after documentation changes.

## Programme disposition

S6 remains **IMPLEMENTED CANDIDATE / AWAITING FOUNDER EXPERIENCE REVIEW**. The full 118-Activity DEVELOPMENT catalogue is published and the V2 Guide is ready for review at the local URL above. Founder experience review, S6 acceptance, and any later merge are separate decisions. S4 slices are not reopened. Production was not accessed or written. No deployment or merge occurred.
