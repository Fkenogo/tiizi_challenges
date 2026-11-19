# TIIZI — AEC-004 Final Merge-Readiness Receipt — 2026-11-19

**Record ID:** AEC-004-FINAL-MERGE-READINESS-RECEIPT-2026-11-19
**PR:** #174 — `integration/aec-004-founder-experience-recovery-001`
**Exact head:** `2b23d5f0aa0583db9c78f679ff93fb90cf9426f8`
**Base / merge-base:** `main` / `21c88f681427172fdc2150f3122e6cce6b90a63e`
**Status:** G2 PASS WITH LIMITATIONS; G3 PASS WITH LIMITATIONS; independent exact-head review PASS; all seven GitHub checks PASS. PR #174 remains OPEN and Draft; this record is not merge authorization.

## 1. Founder decision and evidence boundary

The Founder disposition was reported as occurring **November 18, 2026**. The existing Founder Acceptance Addendum is dated **November 19, 2026**, its documentation/filing date. The separate date reconciliation preserves both dates without changing the original records.

Recorded Founder decisions: Join Challenge popup **ACCEPTED**; authorized Group Feed events **ACCEPTED**; newly created Group empty state **ACCEPTED**; existing Activity Logging form and persistence confirmed as the working baseline. These are component-level dispositions, not approval to merge PR #174. Post-log navigation, owner-only Recent Activity, and sharing remain open AEC-005 obligations and are not represented as implemented functionality.

No attributable Founder screenshot or transcript was supplied or located. The static images referenced by the existing addendum are visual references only. G2 browser captures were not durably attached and are not Founder evidence.

## 2. Exact-head independent review and Guardian receipts

- **Independent code review:** `AEC004Corr002Review` — **PASS** at exact head `2b23d5f0aa0583db9c78f679ff93fb90cf9426f8`. Static read-only review; no GitHub review was submitted.
- **Guardian G2:** `AEC004Corr002G2` — **PASS WITH LIMITATIONS**, exact-head source-delta receipt at `2b23d5f0aa0583db9c78f679ff93fb90cf9426f8`. The browser runtime was tested at `7255e0daa82787bdef20ae12de62702f986a512c`; G2 confirmed the only later delta is the S3c guard script and no runtime/app source changed. The preview was stopped and its disposable database removed.
- **Guardian G3:** `AEC004Corr002G3` — **PASS WITH LIMITATIONS** at exact head `2b23d5f0aa0583db9c78f679ff93fb90cf9426f8`; current `origin/main`, base and merge-base reconfirmed as `21c88f681427172fdc2150f3122e6cce6b90a63e`.

### G2 runtime evidence

G2 used an independent fresh disposable preview: frontend `127.0.0.1:5179`, API `127.0.0.1:57927`, Auth Emulator `127.0.0.1:57928` (`demo-tiizi-founder-72688-f42a1362`), PostgreSQL `127.0.0.1:57929`, marker `tiizi-disposable-preview:founder-preview:tiizi-founder-preview-PfhNFC`. The seed member initially had no Group or Challenge membership.

- Nonmember Challenge Preview restricted participation details and exposed no Challenge join action.
- Group Home, Discovery Preview and Challenge Details each required confirmation. In each path, Not now/Close produced zero join POSTs; explicit confirm produced exactly one successful join POST.
- Active state exposed no duplicate Join action.
- Withdrawal followed by a delayed canonical refetch retained Join again wording while Joining; settlement produced one join POST and one canonical GET.
- At 320px and 390px, document/dialog widths remained within the viewport and controls stayed in bounds.

G2 did not have a pending-approval persona or ended/finalized Challenge for browser checks. Main’s focused V2 DOM suite (21/21) and S3d lifecycle guard cover those states; G2 did not run those tests.

## 3. Stale S3c guard correction

The former S3c hero assertion expected obsolete inline-gradient implementation. At the fetched current main and PR head, `V2ChallengeHero.tsx` has blob `e8ffb2a197dc4e8e26d9dce6af9e44f440299763` and `V2ChallengeCover.tsx` has blob `b67c6ac6816d1fd828fb4e10c26dddb4442901f9`; both files are byte-identical between current main and PR. The guard now checks the actual shared `V2ChallengeCover` contract: Challenge-scoped local preview, local object URL, accessible neutral no-cover fallback, and the existing DOM test. No Hero/Cover component or application behavior changed.

Main ran `npm run test:s3c-live-progress` (**PASS**) and `npm run test:v2-dom -- src/v2/challenges/V2ChallengeCover.dom.test.tsx` (**1/1 PASS**). The guard-only commit is the sole change after the 7255 runtime-tested head; G2 and G3 independently reconciled that delta.

## 4. Current-main continuity and boundaries

G3 confirmed merged PRs #167 and #168 are inherited through main. Accepted but unmerged sources #150, #171 and the cited PFD sources remain separate; #150 remains conflicting and #171 remains Draft. Integration is selective, not wholesale source adoption.

The final guard correction changes only `scripts/testS3cLiveProgressGuards.ts`. It adds no product/runtime changes and introduces no current-main application regression. No production, V1, API, schema/database, migration, authentication, privacy-control, or deployment changes were made. Group and Challenge joining remain separate and server authorization is unchanged. Accepted Group Feed and Group/Today behavior remain covered by the exact-head continuity receipt. Recent Activity and sharing remain deferred to AEC-005.

## 5. GitHub review and CI

GitHub reports `main` is not branch-protected (branch-protection endpoint returned 404) and the applicable repository ruleset list is empty. No submitted approval is required by the observed GitHub configuration. PR #174 has `reviewDecision: ""`; the independent exact-head review above is retained as separate evidence, not misrepresented as a GitHub review.

All seven visible checks passed at exact head `2b23d5f0aa0583db9c78f679ff93fb90cf9426f8`: API typecheck/test/build; API image build/liveness; API namespace contract; boundary (V1 exclusion/API namespace); Functions build/typecheck; web typecheck/build; source and handover observations. GitHub reports PR #174 OPEN, Draft, and mergeable.

## 6. Disposition

Keep PR #174 Draft pending Founder merge authorization. This receipt does not approve the whole PR or authorize merge. PR #175 is the separate AEC-005 documentation PR and remains OPEN/Draft; it is not included here and must not be merged as part of this action. No AEC-005 implementation, production deployment, migration, Feed implementation, or database change is authorized.
