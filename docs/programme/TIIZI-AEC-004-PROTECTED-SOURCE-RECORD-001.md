# TIIZI — AEC-004 Protected Source Record: Recent Activity and Sharing

**Prepared:** 2026-11-18
**Authority:** Founder / Technical Lead, AEC-004 "Integrated Founder Experience Recovery"
**Status:** PROTECTED — NOT IMPLEMENTED, NOT CONNECTED, NOT REDESIGNED IN AEC-004
**Scope:** This record preserves the exact accepted source references and integration obligations for the accepted November 9 Recent Activity and post-log sharing UX, as required by AEC-004 §5.

## 1. Why this record exists

AEC-004 §5 requires that the accepted November 9 Recent Activity and post-log sharing UX "remain protected", that exact accepted source references and integration obligations are preserved in the register, that these experiences are **not redesigned**, and that **fixture-only prototypes are not represented as connected functionality**. AEC-004 authorises **no** new Activity History, Challenge Feed publishing or withdrawal backend.

This record discharges that obligation by fixing the source references and the obligations. It does **not** implement, connect, redesign or claim acceptance of anything.

## 2. Exact accepted source references

| Item | Accepted source | Notes |
| --- | --- | --- |
| Preservation branch | `codex/tiizi-pfd-activity-visibility-003` | Local branch; not pushed as a PR; preserved unchanged by AEC-004 |
| Accepted preserved head | `e2aee9239d42e6f92a66c22e4fcbbb97595c9521` | The commit that carries the four prototype changes together with the Founder handover record |
| Accepted V2 source baseline | `2476c9fe5ac62d888fd0fcbc02e2dc3a8fc2b384` | The baseline the Founder preview was isolated at; `e2aee92` descends from it (`2476c9f` → `e2aee92` adds only the prototype files and the handover) |
| Founder handover record | `docs/reports/TIIZI-PFD-ACTIVITY-VISIBILITY-003-FOUNDER-ACCEPTANCE-AND-ENGINEERING-HANDOVER.md` (at `e2aee92`) | The authoritative statement of what was accepted and what was not |
| Prototype component | `src/v2/today/ActivityVisibilityPreview.tsx` (147 lines) | Exports `TodayActivityTimelinePreview`, `ChallengeVisibilityPreview`, `ActivitySharePreview` |
| Prototype integration points | `src/v2/today/V2TodayScreen.tsx` (+3), `src/v2/challenges/V2CreatedChallengeScreen.tsx` (+3), `src/v2/challenges/V2LoggingSection.tsx` (+9) | All three are the accepted wiring |
| Founder acceptance date | **2026-11-09** | UX acceptance only; connected implementation pending |

These files are **absent from `origin/main`** (verified: `git ls-tree origin/main src/v2/today/` has no `ActivityVisibilityPreview.tsx`) and were **not** transplanted by AEC-004.

## 3. The accepted UX that must be preserved

Founder-accepted on 2026-11-09 (placement, structure and interaction patterns):

1. **Today — "Your activity today" personal timeline.**
2. **Challenge detail — participant count.**
3. **Challenge detail — Challenge Feed section.**
4. **Activity Logging confirmation — "Share to Challenge" or "Keep private", with a permitted-fields preview.**

The existing **connected** Activity Logging experience remains accepted and is the product baseline. Existing V2 Today, Challenge progress, Group, onboarding, Challenge creation and Activity Logging behaviour remain the product baseline and were preserved by AEC-004.

## 4. Connected versus fixture-only — the exact boundary

| Capability | Status | Authority |
| --- | --- | --- |
| Activity logging, accepted submission, Challenge progress | **Existing connected V2 capability**, Founder-accepted | Accepted product baseline; preserved unchanged by AEC-004 |
| Today "Your activity today" history | **UX accepted, FIXTURE ONLY.** The Activity, Streak, Challenge-join and Group-join records shown are **fictional preview data**. There is no personal-history read API; `api/src/app.ts` has no member Activity-history route. | Handover §3 |
| Challenge participant count | **UX accepted, FIXTURE ONLY.** The displayed preview counts are **fictional sample counts**, not connected participant reads. | Handover §3 |
| Challenge Feed | **UX accepted, FIXTURE ONLY.** The walkthrough cards are fictional. CF-01 v0.2 is effective product truth for the Challenge-local Feed but its own status states implementation is **not authorised**. It requires its own publication/read authority; Group Feed storage and APIs are separate and unchanged. | Handover §3 |
| Optional Share to Challenge | **UX accepted, FIXTURE ONLY.** The prototype choice and permitted-fields preview are **local UI state only**. There is no working Publish action, publication or persistence. | Handover §3 |
| External sharing, Share-to-Group, Kudos, announcements | **Not part of this accepted prototype.** Not authorised by the handover. | Handover §3 |

Fictional preview records and counts are visibly labelled `SAMPLE DATA · FICTIONAL PREVIEW`. The Feed states that private Activity is absent unless its owner shares it. The prototype does not create an alternate source of Activity, Challenge, Group, Feed or Recognition truth.

**AEC-004 obligation:** the integrated candidate must neither contain nor be described as containing connected Recent Activity, connected participant counts, a connected Challenge Feed, or connected Share publishing/withdrawal. The AEC-004 candidate contains **none** of these; the accepted prototype remains the sole protected source, unmodified.

## 5. No-redesign and no-new-backend obligations

- The accepted prototype must not be redesigned in AEC-004 or any subsequent bounded task without a new dated Founder acceptance record naming the exact accepted source.
- **AEC-004 authorises no new Activity History backend.** The personal-history read authority (H1) requires its own separate Technical Lead/Founder scope and authorization gate.
- **AEC-004 authorises no Challenge Feed publishing or withdrawal backend.** CF-01 v0.2 states that CF-2 and later implementation packages are not authorised; CF-2/CF-3/CF-4 require separate Founder authorization before implementation.
- **AEC-004 authorises no explicit Share publication or withdrawal backend.** S1 requires separate authorization, and only after the existing Group Feed automatic-only boundary is preserved.
- The Group Feed automatic-only boundary is preserved and unchanged by AEC-004.

## 6. Remaining integration queue (open after AEC-004)

| # | Item | Package | Authority needed |
| --- | --- | --- | --- |
| 1 | Personal Activity history authority — owner-only read contract, ordering, pagination, retention/deletion, performed-vs-accepted time separation, authorised entity links | **H1** | Separate Technical Lead/Founder scope |
| 2 | Participant count read and visibility — inventory existing server-derived counts first; define member-vs-episode semantics, visibility for non-member views, behaviour after exit/rejoin | **P1** | Separate scope + count definition decision |
| 3 | Challenge Feed authority, read and experience — event allow-list, audience/visibility recheck, retention, cursor paging, idempotency, suppression; resolve CF-01 open details (Kudos-able item set, qualifying admin/announcement rule, persistence/idempotency, API shape, placement, Streak S2 milestone schedule) | **CF-2 / CF-3 / CF-4** | Explicit Founder authorization; CF-01 details resolved first |
| 4 | Explicit Share publication and withdrawal — private by default, one active Share per member/source item, withdrawal without changing Activity evidence or progress, permitted-fields preview only | **S1** | Separate authorization |
| 5 | External Copy Link / native sharing, separate "Log Another" / "Done" | CF-01 external share | Out of scope of the accepted prototype; not authorised |

Additional open Founder/product decisions recorded in the handover and still unresolved: the final personal-history event inventory and retention; whether Today entries link to related entities under the same authorization predicate; the exact participant-count definition and which viewers may see it; and whether the accepted Share flow offers publishing immediately after submission, from an existing Activity later, or both.

## 7. Boundary statement

No backend, schema, API, engine, Recognition or Group Feed implementation was performed for Recent Activity or Sharing in AEC-004. The accepted prototype source is preserved unmodified at `e2aee9239d42e6f92a66c22e4fcbbb97595c9521`. No merge, deployment or production authorization is claimed or implied.
