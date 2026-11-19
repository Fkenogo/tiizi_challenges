# TIIZI — AEC-004 Founder Acceptance Addendum — 2026-11-19

**Record ID:** AEC-004-FOUNDER-ACCEPTANCE-ADDENDUM-2026-11-19
**Evidence date:** 2026-11-19
**Status:** Direct Founder feedback recorded for the listed experience elements. This addendum is **not** approval to merge PR #174, a G2/G3 receipt, or approval of the entire integration.

## 1. Evidence boundary

The direct Founder evidence is the feedback provided in the 2026-11-19 `AEC-004 FINAL GATE RECOVERY 001` instruction. No transcript, screenshot attachment, or exact Founder-walkthrough runtime identity accompanied that instruction. The statements below are recorded as direct acceptance/direction, not inferred from code, a design reference, a CI result, or an agent review.

PR #174 remains Draft at `56ea62e369bef3e4fe523d672cd9e4af7d9e9d28`. Acceptance of these components does not approve the complete PR, satisfy Guardian checkpoints, or authorize merge.

## 2. Founder disposition

| Experience | Founder disposition on 2026-11-19 | Boundary |
|---|---|---|
| Join Challenge mobile popup | **ACCEPTED** | Acceptance of this experience only; not evidence that every journey or the entire PR is accepted. |
| Authorized Group Feed event display | **ACCEPTED** | Group Feed event display only; do not infer Challenge Feed acceptance or publication of individual Activity logs. |
| Newly created Group empty-state behavior | **ACCEPTED** | Acceptance of the empty-state behavior only. |
| Existing Activity Logging form and persistence | **Working baseline confirmed** | Preserve connected logging; this does not approve new post-log navigation or sharing behavior. |
| Post-log navigation | **OPEN — deferred** | To separately authorized AEC-005 work. |
| Personal Recent Activity | **OPEN — deferred** | Accepted prototype remains protected; connected personal history is not claimed. |
| Sharing | **OPEN — deferred** | Private-by-default preview remains protected; no connected publication or external sharing is claimed. |

## 3. Screenshot and source references

No attributable Founder screenshot of the current PR #174 Join Challenge mobile popup, the accepted authorized Group Feed events, or the newly created Group empty state was supplied or located in the inspected AEC-004 records. The following tracked images are available at merged source commit `ae089c09f89f7acec77935a8d5bda93a6404ffce` on `origin/main`. They are **visual reference assets only**, not captures of the PR #174 runtime and not proof of the Founder acceptance recorded above:

- [Group Feed visual reference](../ui-reference/tiizi_revamp_screens/group_detail_-_feed_highlighted/screen.png) — older static Group Feed design; not evidence for the current authorized event set.
- [Group Challenges-tab visual reference](../ui-reference/tiizi_revamp_screens/group_detail_-_challenges_highlighted/screen.png) — static Group Challenges tab; not the accepted Join Challenge popup.
- [Challenge preview visual reference](../ui-reference/tiizi_revamp_screens/challenge_preview_%28aligned%29/screen.png) — static preview ending in “Proceed to Create”; not the Join Challenge popup.
- [Challenges-list reference with Join Challenge buttons](../ui-reference/tiizi_revamp_screens/challenges_%28aligned%29/screen.png) — static list buttons, not the accepted mobile popup.
- [Join Group visual reference](../ui-reference/tiizi_revamp_screens/join_group_%28aligned%29/screen.png) — Group join screen; not Challenge joining.

The references above are retained at the exact source commit; no source image was modified. If Founder walkthrough screenshots are later supplied, record their original path/source and exact runtime identity without replacing these classifications.

## 4. Preservation and open gates

- Keep AEC-004’s accepted Group/Challenge join separation and the server-side visibility boundary unchanged.
- Keep personal Recent Activity and the post-log Share preview as accepted-but-unimplemented obligations. Do not represent them as connected functionality.
- Keep individual Activity logs from being automatically published to Group Feed. Sharing remains a separately authorized action and implementation scope.
- This record does not alter the AEC-004 candidate or its exact head. Guardian G2/G3 and exact-head review remain separate gates; PR #174 stays Draft until all required gates and explicit merge authorization are satisfied.
