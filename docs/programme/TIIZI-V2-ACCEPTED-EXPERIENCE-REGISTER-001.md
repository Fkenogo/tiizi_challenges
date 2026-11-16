# TIIZI — Accepted Experience Register (AEC-REG-001)

**Status:** PROPOSED / RECONCILIATION CANDIDATE — not yet approved or merged.
**Compiled:** 2026-11-16 from `ECCL-005 APPROVED EXPERIENCE RECOVERY-001` handover and verified GitHub PR #150/#168/#171 metadata.
**Purpose:** Preserve latest Founder-accepted V2 UX evidence and outstanding integration separately from implementation, testing, merged-state, preview verification, and deployment.
**Maintainer (role):** Programme Controller under Technical Lead oversight; assignments not yet verified.
**Companion procedure:** [AEC-001](./TIIZI-V2-APPROVED-EXPERIENCE-CONTINUITY-001.md).

## Interpretation

Each row is an **evidence queue entry**, not a claim that preview code has been merged or connected. The status columns are separate. `UNKNOWN` requires investigation; it never means rejected, deferred or removed. Source SHAs are preservation pointers, **not** default coding bases. Every new task refetches `origin/main`.

### Reconciliation register (initial entries)

| ID | Accepted journey and evidence | Last located accepted source | Integration state / next action |
| --- | --- | --- | --- |
| AEC-TODAY-01 | New-member Today Group/Challenge recommendations; accepted Dada/Didi walkthrough cited by PR #150; Founder 2026-11-16 walkthrough accepted recommendations | PR #150 head `3aa0147d558eeba8371cd4cccffcbbc2326dd02f`; PR #171 head `7ebe03ba5ffaeed5c21b109137a94c7630b18e8c` | ACCEPTED yes; IMPLEMENTED candidate #171; TESTED reported; MERGED no; PREVIEW VERIFIED Founder observed recommendations 2026-11-16, immutable artifact SHA unknown; DEPLOYED no evidence. Keep #171 open and reconcile with other accepted work before merge. |
| AEC-DISC-02 | Public Group/Challenge preview before Group membership; separate Group and Challenge joins; Founder 2026-11-16 found Group Home hosted-card link broken | #150 source; #171 `V2DiscoverableChallengePreviewScreen.tsx`, `V2GroupHomeScreen.tsx` | ACCEPTED journey yes; IMPLEMENTED partially #171; TESTED partially; MERGED no; PREVIEW VERIFIED failing Group Home → hosted Challenge path; DEPLOYED no evidence. Fix path, approval persona and repeat Founder walkthrough. |
| AEC-TODAY-03 | Existing-member Today Together/Race/Streak, Group opportunities; prior S5b/S5c records and Founder 2026-11-16 walkthrough | Merged Today source in current `main`; #171 preserves active member view | ACCEPTED yes; IMPLEMENTED yes; TESTED reported; MERGED yes; PREVIEW VERIFIED Founder observed 2026-11-16 from local candidate; DEPLOYED no evidence. Preserve during future Today work. |
| AEC-ACT-04 | “Your activity today” personal activity timeline, 4 fictional entries newest first; Founder accepted UX 2026-11-09 in `TIIZI-PFD-ACTIVITY-VISIBILITY-003-FOUNDER-ACCEPTANCE-AND-ENGINEERING-HANDOVER.md` | `codex/tiizi-pfd-activity-visibility-003` @ `e2aee9239d42e6f92a66c22e4fcbbb97595c9521`; `ActivityVisibilityPreview.tsx` | ACCEPTED UX yes; IMPLEMENTED fixture-only; TESTED build only, DOM assertions failed before execution; MERGED no; PREVIEW VERIFIED Founder walkthrough, artifact SHA unknown; DEPLOYED no. Preserve exact UX; connected personal read model and history navigation remain separate scoped integration. |
| AEC-SHARE-05 | Post-log “Share to Challenge” / “Keep private” plus preview of allowed fields; Founder accepted UX 2026-11-09; CF-01 effective explicit Share rules | `e2aee9239d42e6f92a66c22e4fcbbb97595c9521`, `ActivitySharePreview` in `ActivityVisibilityPreview.tsx` | ACCEPTED UX yes; IMPLEMENTED local UI only; TESTED build only; MERGED no; PREVIEW VERIFIED walkthrough reported; DEPLOYED no. Recover UI, do not imply server publishing/withdrawal already exists. Preserve Group Feed automatic-only boundary. |
| AEC-SHARE-06 | External Copy Link/native sharing and separate Log Another / Done; Founder reiterated 2026-11-10 and 2026-11-16 | `TIIZI-V2-UX-FOUNDER-DECISION-RECONCILIATION-001.md` in merged PR #168; visual implementation not located | Founder DIRECTION yes; specific Copy Link UX acceptance artifact UNKNOWN; IMPLEMENTED no connected evidence; TESTED no; MERGED decision document yes, feature no; PREVIEW VERIFIED no; DEPLOYED no. Preserve intention; avoid claiming the prototype already has this UI. External link must honor recipient authorization. |
| AEC-CF-07 | Challenge participant count and Challenge Feed illustrative cards; accepted as UX 2026-11-09 | PFD activity visibility prototype `e2aee9239d42e6f92a66c22e4fcbbb97595c9521` | ACCEPTED UX yes; IMPLEMENTED fictional preview; TESTED no DOM assertions; MERGED no; PREVIEW VERIFIED historical; DEPLOYED no. Connected participant count and feed read remain separate integration. |
| AEC-GROUP-08 | Accepted Group listing/detail/Hub polish; integrated Today/Challenge card and cover presentation; 2026-11-08 PFD handovers | Group/Today `2f065546dd7051b5c6401e52da897b8c82d6cc93`; Today cover `38d7bf906e5ff5c91542be7c72bd34d98cd9e0b9`; preserved divergent `e2aee9239d42e6f92a66c22e4fcbbb97595c9521` | ACCEPTED yes; IMPLEMENTED on local isolated branch; TESTED partial with outstanding About-sheet Escape / preferences guard failures; MERGED no for PFD integration; PREVIEW VERIFIED historical walkthrough, artifact unknown; DEPLOYED no. Selectively reconcile with merged #167/#168 and #171; never wholesale merge old base. |
| AEC-IMG-09 | Group/Profile image selection, Challenge covers/cards, template entry and Profile preferences; 2026-11-08 PFD acceptance | merged PR #167 `ae089c09f89f7acec77935a8d5bda93a6404ffce` and Package A #168 `4829787343b5811e085db755286b7e447e18b9ac` | ACCEPTED yes; IMPLEMENTED browser-local preview media; TESTED/merged per PR evidence; PREVIEW VERIFIED historical; DEPLOYED no evidence. Do not claim persistent uploads. Preserve merged functionality in integration. |
| AEC-HDR-10 | Remove repeated Tiizi branding from member header; Founder 2026-11-16 walkthrough confirmed | Draft PR #171 `7ebe03ba5ffaeed5c21b109137a94c7630b18e8c` | ACCEPTED yes; IMPLEMENTED and tested candidate; MERGED no; PREVIEW VERIFIED Founder observed 2026-11-16, artifact SHA unknown; DEPLOYED no evidence. Preserve when reconciling #171. |
| AEC-LOG-11 | All 118 activities in disposable Founder Preview, immediate-logging timestamp precision, friendly errors | Merged PR #168 `4829787343b5811e085db755286b7e447e18b9ac` | ACCEPTED fix direction; IMPLEMENTED/TESTED/MERGED yes; Founder preview observed successful activity log 2026-11-16, exact immutable preview SHA unknown; DEPLOYED no. Must not regress. |

## Integration queue at creation

1. **HOLD / RECONCILE:** Draft PR #171 and unmerged #150 versus accepted PFD Group/Today source and Group Home outsider-preview defect. Do not merge #171 as complete while known accepted journey is absent.
2. **PRESERVE:** Local/differing PFD accepted source. Ensure durable remote source/receipt as separately authorized before cleanup; do not build new work on its old baseline.
3. **IMPLEMENT ONLY WITH SEPARATE AUTHORITY:** Connect Activity timeline and Challenge Feed Share to canonical current V2 data; preserve already accepted preview UX. Distinguish Challenge Feed from automatic Group Feed events.
4. **RECHECK:** Profile, cover and template changes against merged source and the integrated candidate.
5. **VERIFY POST-MERGE:** Run isolated Founder Preview from exact merged SHA and document all registered affected journeys before marking integration complete.

## Updates and supersession

Every accepted UX change requires a new exact accepted source, date and evidence; every integration PR updates affected rows. Record explicit Founder supersession for removed or changed behavior. The Programme Controller tracks the queue and references it from the existing Master Programme; this register is not a second roadmap. No entry is marked DEPLOYED without runtime/deployment evidence. Role assignment and independent review remain UNKNOWN until attributable evidence exists.

## Status at first draft

At 2026-11-16 observation, `origin/main = ce477b0756129119c6ee93e99029984db35cecfc`. This is a point-in-time observation only. The current code base for a subsequent task must always be fetched anew.
