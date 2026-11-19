# TIIZI — AEC-005 Logging Founder Disposition and Preparation

**Record ID:** AEC-005-LOG-FOUNDER-2026-11-19
**Disposition date:** 2026-11-19
**Status:** Founder direction recorded; AEC-005 scopes proposed for Technical Lead review; implementation not authorized by this record.

## 1. Evidence and source boundary

The Founder walkthrough statements below are direct evidence supplied for this record by the requester. No recording, transcript, or walkthrough runtime identity was supplied. Do not attribute the walked-through runtime to a particular port, account, or source SHA.

Repository reconciliation for this preparation:

- PR #174 was merged normally at `732c3316d06184916521591a1a9372051ab50538` from approved head `2b23d5f0aa0583db9c78f679ff93fb90cf9426f8`; the merge commit is on `origin/main`.
- `origin/main` was fetched at `732c3316d06184916521591a1a9372051ab50538`.
- The accepted November 9 Activity Visibility UX source remains `codex/tiizi-pfd-activity-visibility-003` at `e2aee9239d42e6f92a66c22e4fcbbb97595c9521`. It is preserved and is not changed by this record.
- The accepted prototype remains unconnected: its timeline entries and Feed cards are fictional; its Share choice is local-only and Publish is disabled. The G4 verification of merged AEC-004 did not implement Recent Activity, Challenge Feed publication, or post-log sharing; those remain AEC-005 or later.

Code-level baseline inspected in the AEC-004 candidate:

- `src/v2/challenges/V2LoggingSection.tsx` renders the existing success/completion step; `src/v2/challenges/useChallengeCreation.ts` handles the V2 log and accepted-log refresh.
- `src/v2/challenges/V2CreatedChallengeScreen.tsx` owns Challenge Details navigation; `src/v2/challenges/V2ProgressSection.tsx` routes to the existing server-derived Together, Race, and Streak progress views. The separate latest-own-contribution display is not evidenced.
- `api/src/challengeActivityRoutes.ts` and `api/src/challengeActivityApplication.ts` implement authenticated Activity application and canonical V2 writes. `api/src/app.ts` / `api/src/challengeReads.ts` do not provide an owner-only personal Activity history read.

This record captures product direction and a proposed engineering boundary. It does not claim that the November 19 post-log journey is implemented or that sharing is published. The separate G4 verification tested the merged AEC-004 runtime; it does not verify the AEC-005 journeys or identify the earlier Founder walkthrough runtime.

## 2. Founder walkthrough disposition

### Existing prototype and implementation confirmed

The Founder confirmed that the existing Activity Logging form and successful recording behavior are present. The completion screen says **Recorded** and offers **Log another** and **Done**. **Done** currently returns to the previous screen and does not complete the post-log journey. These observations confirm the existing logging baseline; they do not mark new history or sharing behavior implemented.

The previously accepted November 9 prototype remains the visual source to preserve without redesign:

- “Your activity today” personal timeline, shown newest first in the accepted fixture.
- A private-by-default Share preview with distinct **Share to Challenge** and **Keep private** choices.
- The accepted local preview displays the member's display name, Activity name, value, unit, and Challenge title. CF-01 v0.2's internal S1 publication allow-list is narrower: display name, Activity name, the member's own accepted value, and unit. Treat the Challenge title as preview-only unless the Founder explicitly amends CF-01; never publish it by implication. Exclude notes, evidence, location, exact routine time, points, raw metadata, and other members' data.
- The timeline and Challenge Feed sample data are explicitly fictional; the prototype has no history API or publication action.

### New November 19 navigation direction

The Founder directed that:

1. A successfully recorded Activity must become visible in the member's personal **Recent Activity**.
2. **Done** advances to a privacy/sharing choice instead of returning directly to the previous screen.
3. The member may keep the Activity private or explicitly choose to share it. Internal **Share to Challenge** and external social/link sharing are separate choices, not one combined publication action.
4. After the selected private or sharing path completes, navigate to **Challenge Details**.
5. Challenge Details shows refreshed authoritative progress and that member's latest logged contribution.

These are high-level navigation and behavior directions. The exact combined screen layout, exact copy, and external recipient experience were not separately accepted in the supplied evidence. Keep the November 9 accepted visual source intact; do not treat its fixture values or disabled Publish control as connected behavior.

## 3. Updated accepted-experience obligations

The register rows AEC-ACT-04, AEC-SHARE-05, AEC-SHARE-06, and AEC-LOG-11 are updated to cite this disposition. Their obligations are:

- **AEC-ACT-04 — personal Recent Activity:** replace fictional-only history with the signed-in owner's authoritative V2 Activity evidence. A successfully accepted log must appear; it must not appear for another member. Preserve the accepted timeline visual source. No history API is currently evidenced.
- **AEC-SHARE-05 — internal privacy choice:** preserve the November 9 private-by-default preview and add the November 19 Done → choice → Challenge Details navigation direction. A local choice is not publication. A Share action must remain gated on separately authorized server publication.
- **AEC-SHARE-06 — external sharing:** record the November 19 direction for a separate external social/link option. Recipient-safe content, access, expiry/revocation, and exact UX remain to be specified; no external-share feature is implemented or authorized here. CF-01 does not authorize external sharing.
- **AEC-LOG-11 — existing logging:** preserve the connected logging form, successful canonical recording, and Recorded / Log another / Done completion baseline. Do not regress it. The new post-log route does not change what constitutes accepted Activity evidence.
- **AEC-CF-07 — Challenge Feed:** its November 9 sample Feed remains illustrative only. Individual logs must not be published automatically to either Challenge Feed or Group Feed. The requested latest contribution on Challenge Details is an owner-facing detail/progress obligation, not permission to add Feed behavior.

All implementation, test, preview, merge, and deployment statuses remain separate from UX acceptance. The November 19 disposition records Founder direction; it does not assert an implementation state.

## 4. Proposed bounded AEC-005 packages

Both packages are proposals only. Technical Lead review and separate implementation authorization are required before code work. Preserve the AEC-004 integration candidate; use the accepted V2 source and the November 9 visual source, not V1 implementation files.

### AEC-005A — owner-only personal Recent Activity

**Goal:** Replace the fixture-only personal timeline with a real, owner-only read of authoritative V2 Activity records.

**Bounded work:**

- Assess the V2 PostgreSQL source and existing indexes. `member_activity_events` is the Activity evidence record (including `member_id`, `occurred_at`, `occurred_day`, `recorded_at`, value, unit, and correction/status fields). Successful Challenge applications are linked through `challenge_activity_records` and their participation/Challenge references. Read the authoritative owner and Activity data; do not synthesize history from a client cache or Share projection.
- Add an authenticated V2 read contract for the signed-in member's own Recent Activity. The server derives the member ID from the verified auth-to-member mapping; never accept a caller-selected member ID as authority. A route such as `GET /api/me/activity` is only a candidate name, not a settled API contract. No personal history route is currently evidenced in the V2 API.
- Preserve the accepted timeline presentation. Return only the minimal fields needed for the owner's list and links to authorized Challenge context. Keep Activity time (`occurred_at`) distinct from ledger/acceptance time (`recorded_at` / `accepted_at`); do not silently substitute one for the other. Handle correction/supersession status truthfully.
- Define stable newest-first ordering, pagination, empty/loading/error states, and retention behavior before implementation. Keep the read within the V2 PostgreSQL boundary; no V1 reads or compatibility layer.

**Out of scope:** Share publication/withdrawal; Challenge or Group Feed reads; participant counts; external links; changes to Activity acceptance/scoring; migration or production work.

**Dependencies / decisions:** Technical Lead must confirm the owner-bound API and event-source query. Founder must decide whether this timeline contains only accepted Activity logs or other V2 events (for example joins), what correction/supersession entries look like, which timestamp drives ordering, and whether both performed and recorded times are shown. Define page size/cursor and retention from existing product policy; do not invent these in the UI. A schema migration is not presumed; if assessment proves one necessary, stop for separate authorization and review.

### AEC-005B — post-log journey and Challenge Details convergence

**Goal:** Complete the path from the existing successful-log confirmation to the Founder-directed privacy/sharing choice and back to Challenge Details with current progress and the member's latest contribution.

**Bounded work:**

- Keep the existing successful log response as canonical evidence and keep **Recorded** confirmation. **Log another** remains a deliberate new logging intent; request retries must continue to converge on the existing idempotency key rather than duplicate evidence.
- Route **Done** to the privacy/sharing choice. Reuse the accepted November 9 Share preview without redesign and preserve its private/default behavior. Before any future publication, enforce the CF-01 S1 allow-list; the prototype's Challenge title is not currently authorized for publication.
- After a completed choice, return to the same Challenge's Details route and use authenticated server reads for the current progress. Existing V2 progress presentation is server-authoritative; invalidate/refetch its detail and relevant Together/Race/Streak progress reads instead of calculating progress in the browser.
- Show the signed-in member's latest accepted contribution for that Challenge using the owner-bound AEC-005A read contract or an equivalent authorized V2 read. Do not expose another member's individual Activity record. It remains visible to its owner while private; sharing is not a prerequisite for canonical progress.
- Preserve the accepted mobile visual language and accessibility patterns; no unrelated redesign.

**Hard dependency:** AEC-005B cannot deliver a functional **Share to Challenge** choice until the separately authorized CF-01 S1 publication/withdrawal capability exists. It cannot deliver a functional external-share choice until a separate recipient-safe external-sharing capability is authorized and implemented. Do not ship a no-op, fake success, local-only Publish, or an option that silently changes audience. If either dependency is absent, keep the complete AEC-005B path blocked or explicitly stage only a separately approved, end-to-end usable private path; do not claim the full Founder-directed journey is complete.

**Out of scope:** Building the Challenge Feed backend, publication projection, automatic moments, Kudos, announcements, external-share service, Group Feed changes, production deployment, migrations, or any changes to the canonical Activity write.

## 5. Separate CF-01 publication and withdrawal dependencies

The November 9 private/share preview and November 19 direction do not themselves authorize Feed implementation. CF-01 v0.2 defines a distinct Challenge-local Feed; CF-2 is not authorized. Any future internal **Share to Challenge** must have its own explicit Founder/Technical Lead authorization and satisfy CF-01 before it is connected to AEC-005B.

At minimum, the separately authorized S1/CF-2/CF-3/CF-4 work must provide:

- A server-authorized explicit publish operation, preview-before-publish, self-only source binding, idempotency, and at most one active Share per source item.
- Private by default; no automatic publication from logging; no implicit publication to the Group Feed. Store publication state in Challenge-scoped structures, not `group_feed_*` and not by copying Activity evidence.
- Publish only CF-01 permitted fields (member display name, Activity name, own accepted value, unit); the accepted prototype also displays Challenge title in its local preview, but that field is not in the current publication allow-list and requires explicit Founder amendment before use. Enforce current Group membership and Challenge visibility for every Feed read. Keep suppression/retention and withdrawal semantics; withdrawal hides the Share and never deletes, rewrites, or changes canonical Activity, score, progress, or result.
- A real Challenge Feed read path and UI decision before claiming the post-log Share journey complete. The approved sample cards and count are not data or backend contracts.

CF-01 v0.2 additionally leaves implementation details open, including whether the accepted prototype's Challenge title may be added to the S1 publication allow-list, the Streak S2 qualifying schedule (Founder decision required before CF-2), Kudos-eligible item set, Challenge-administrator authority and announcement length, storage/projection and idempotency design, read-API shape, and CF-4 placement. Resolve the applicable decisions before authorizing the affected package. No migration ID is reserved.

## 6. Separate recipient-safe external-sharing dependency

The Founder directed a distinct external social/link-sharing option, but CF-01 explicitly excludes external sharing. Treat it as a separate capability and authorization, not as a Challenge Feed Share or an automatic consequence of **Share to Challenge**.

Before implementation, obtain Founder decisions on the recipient/audience model, whether recipients must authenticate, link scope and expiry/revocation, the data shown to recipients and social preview metadata, and whether an external share may exist while the Activity remains private to the Challenge Feed. Technical review must ensure no notes, evidence, location, exact routine time, private Challenge/Group content, or unrelated member data leaks through the page, URL, or metadata. Do not adopt V1 sharing code.

## 7. UX acceptance criteria for the complete journey

The full journey is acceptable only when all applicable authorized dependencies are real and verified:

1. Submitting a valid log produces one authoritative accepted V2 Activity record. The completion view says **Recorded**; the record is visible in the owner's Recent Activity without requiring a share.
2. **Log another** begins a deliberate new entry. A network retry does not create a duplicate record.
3. **Done** opens the privacy/sharing choice. Private is visibly the default; internal Share to Challenge and external social/link are separately labeled and separately consented.
4. The internal Share preview and any published item use only the current CF-01 S1 fields (member display name, Activity name, own accepted value, unit) and clearly distinguish preview from publication. The accepted prototype's Challenge title remains preview-only until explicitly approved for publication. Publication requires a separate affirmative action and a successful server response. A private choice creates no Share.
5. An external share is not implied by internal Share, and internal Share is not implied by an external link. A recipient sees only the explicitly approved, recipient-safe content.
6. After the selected operation succeeds—or **Keep private** is chosen—the app opens that Challenge's Details. It shows refreshed server-authoritative progress and the signed-in member's latest accepted contribution, even when kept private. Reopening or refreshing the page retains the same truth.
7. Together, Race, and Streak retain their existing correct progress presentation. The personal Activity item is not mistaken for a Feed card and is not exposed as another member's individual evidence.
8. The journey fits narrow mobile viewports without clipped dialogs, hidden actions, horizontal overflow, or obscured content. Keyboard focus, screen-reader labels/status announcements, and a clear route back are usable.
9. Existing Group Feed behavior is unchanged. No individual Activity appears there automatically. Withdrawal removes only the authorized Challenge Share projection; the owner's Activity evidence and Challenge progress remain unchanged.

## 8. Required acceptance tests for later authorized work

- Owner-only history: authenticated owner sees their canonical V2 row; another member cannot read it by changing a URL, query, cursor, or submitted member identifier. Unauthenticated reads are rejected. Cursor pages are stable and do not duplicate/skip rows under the defined ordering.
- Time and correction behavior: performed and recorded times are distinct; timezone/date boundaries and superseded/corrected Activity follow the Founder-approved policy.
- Post-log: successful write → owner history row → Done → choice → Challenge Details with fresh progress and latest own contribution. Exercise Together, Race, and Streak. A refresh/reopen proves state comes from the server.
- Private: no Share is created and no Feed read exposes the private Activity; canonical Activity and progress remain.
- Internal publication/withdrawal: preview allow-list, explicit server publish, owner/source authorization, idempotent retry, current audience checks, one active Share, withdrawal visibility, and unchanged underlying Activity/progress. Assert no Group Feed event is generated.
- External: unauthorized/expired recipients cannot obtain protected content; authorized recipients and social metadata contain only approved fields; revocation follows the approved policy.
- UI: narrow mobile layout, keyboard-only operation, focus management, accessible names/status and visible errors for failed log, publication, history read, and progress refresh.

Tests for Feed or external behavior are requirements for later authorized packages, not work performed in this preparation.

## 9. PR #174 merge-readiness blockers (historical pre-merge snapshot)

The findings below describe the pre-merge state recorded at the original preparation baseline. They are preserved as historical evidence and are superseded for current PR #174 status by the post-merge G4 reconciliation in §12.

PR #174 remains **Draft** by explicit instruction and must not be merged. Live GitHub reconciliation for head `56ea62e369bef3e4fe523d672cd9e4af7d9e9d28` reported `mergeStateStatus=CLEAN`; all seven listed CI/informational checks completed successfully. However, `latestReviews` is empty and `reviewDecision` is unset. A clean merge state and green CI do not satisfy review or governance gates.

Current blockers / holds:

- Keep Draft and do not merge; no merge authorization was granted.
- No current GitHub review/approval is recorded for the exact head. Obtain the required exact-head independent review and resolve any review threads before any future merge decision.
- The AEC-004 coverage activation records temporary CG-1 authority for G1/G2 only; it expires at G2 closeout and explicitly leaves G3/G4 unassigned. The prior G2 PASS WITH EXPLICIT LIMITATIONS is recorded against ancestor `976b60a9829a6b452bb72343f746e29ce7bec1e2`, not this later PR head. A new authorized G2 receipt for `56ea62e…` and a separately activated Guardian G3 are required; the Coding Agent cannot self-certify either.
- The repository records AEC-DISC-02 as accepted and the November 9 PFD handover accepts Challenge Feed prototype UX. The AEC-004 completion report's Founder walkthrough checklist remains unchecked and ends “STOP — awaiting Founder browser acceptance.” No durable evidence was located for Founder acceptance of the specific Join Challenge popup and Group Feed. The current task asserts prior acceptance, but exact date/runtime evidence is not in the inspected repository records. Do not conflate the accepted Challenge-local Feed prototype with Group Feed.
- The November 19 activity-logging disposition is limited to that journey. It is not acceptance of the whole AEC-004 integration or confirmation that all registered journeys passed in a verified runtime.
- The AEC-004 integration worktree has a pre-existing dirty completion-report file. Preserve/reconcile that local work separately; it is not evidence in the committed PR head.

CI is not the current blocker. There are no unresolved GitHub review threads. Do not close Guardian G2, merge, push, or change PR #174 under this preparation task.

## 10. Handover boundary (historical AEC-005 preparation)

**Next action:** Technical Lead review this disposition, register updates, AEC-005A/AEC-005B boundaries, open Founder decisions, and the CF-01/external-sharing dependencies. No implementation, migration, backend publication, merge, deployment, or Guardian gate closure is included. Preserve the AEC-004 source candidate and the accepted November 9 source unchanged.

## 11. AEC-004 documentation dependency and PR isolation (historical pre-merge snapshot)

This section records the original pre-merge documentation comparison. PR #174's AEC-004 supporting records are now on `main`; the current baseline and separate PR status are updated in §12.

The canonical Register rows updated here (AEC-ACT-04, AEC-SHARE-05/06, AEC-CF-07, and AEC-LOG-11) already exist on the current `origin/main` baseline. The committed PR #174 delta contains no prior change to the canonical Register, so this documentation change updates existing rows and does not silently omit or replace an AEC-004-specific Register entry.

AEC-004-specific supporting records — `TIIZI-AEC-004-ACCEPTED-INVENTORY-001.md`, `TIIZI-AEC-004-PROTECTED-SOURCE-RECORD-001.md`, `TIIZI-AEC-004-COVERAGE-ACTIVATION-001.md`, `TIIZI-AEC-004-G1-GUARDIAN-RECEIPT-001.md`, and `TIIZI-AEC-004-COMPLETION-REPORT-001.md` — are on PR #174 and are absent from the current main baseline. This AEC-005 documentation PR intentionally excludes those files and all #174 application changes; it cross-references PR #174 for AEC-004-specific reconciliation and governance evidence. The November 9 handover is also absent from current main; its accepted source remains separately preserved at `e2aee9239d42e6f92a66c22e4fcbbb97595c9521` on the remote `codex/tiizi-pfd-activity-visibility-003` branch. Neither that source nor its worktree is modified here.

This documentation PR was initially prepared against `origin/main` `21c88f681427172fdc2150f3122e6cce6b90a63e` and intentionally excluded PR #174 application changes. That baseline statement is historical: PR #174 has since merged at `732c3316d06184916521591a1a9372051ab50538`. PR #175 remains a separate documentation-only proposal; no merge or AEC-005 implementation is authorized here.

## 12. 2026-11-19 post-merge reconciliation

PR #174 is merged at `732c3316d06184916521591a1a9372051ab50538`. The independent Guardian's G4 verdict is **VERIFIED WITH LIMITATIONS**: merged runtime identity was independently verified, and the Guardian reviewed the operator's browser evidence, but did not independently replay the full browser matrix or read the disposable database marker. The Technical Lead accepts that G4 evidence for AEC-004 closure with explicit limitations; the detailed receipt is in separate PR [#176](https://github.com/Fkenogo/tiizi_challenges/pull/176).

The operator's G4 browser evidence includes successful existing Activity logging, canonical persistence, and refreshed progress. It does not make the Recent Activity timeline, Challenge Feed publication, internal or external post-log sharing, or the full AEC-005 journeys implemented. Pending-member and ended/finalized Challenge browser personas remain accepted G4 limitations. The November 19 Founder walkthrough runtime remains unknown; do not attribute it to the G4 preview.

AEC-005A (owner-only Recent Activity) and AEC-005B (post-log choice and Challenge Details convergence) remain proposals for Technical Lead review and separate implementation authorization. Preserve the November 19 Founder direction, private-by-default boundary, CF-01 publication dependency, and separate recipient-safe external-sharing dependency. No connected Recent Activity, Challenge Feed publication, Share, or external-sharing behavior is claimed here.
