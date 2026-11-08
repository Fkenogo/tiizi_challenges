# TIIZI PFD V2 Experience Handover 001

**Date:** 8 November 2026  
**Authority:** Founder acceptance of Group listing, Group detail and Group Hub polish  
**Status:** Experience acceptance only; no functional or production acceptance implied.

## Accepted V2 experience

The Founder accepted the Group listing, Group detail and Group Hub information/actions polish at `2f065546dd7051b5c6401e52da897b8c82d6cc93` on `codex/tiizi-pfd-group-cards-001`.

This source preserves the reconciled Today and Challenge experience. The accepted Challenge card/photo alignment is present from PR #163's head `3e8c663f710a00de3fcc5c830077d64c0ddb245b`; the Today alignment integration is `38d7bf906e5ff5c91542be7c72bd34d98cd9e0b9`, including PR #150's current head `3aa0147d558eeba8371cd4cccffcbbc2326dd02f`. Both heads and the Today integration are ancestors of the accepted Group source. Group and Challenge actions, discovery and membership behavior remain governed by their existing V2 contracts.

## Pull requests and local branches

| Work | Current verified state | Local branch/worktree |
| --- | --- | --- |
| PR #150, Today/discovery | Open, not merged; head `3aa0147d558eeba8371cd4cccffcbbc2326dd02f`, base `main` | `codex/tiizi-pfd-today-cards-001` at `38d7bf906e5ff5c91542be7c72bd34d98cd9e0b9`, clean |
| PR #163, image/Challenge cards | Open, not merged; head `3e8c663f710a00de3fcc5c830077d64c0ddb245b`, base `feat/tiizi-fp-001` | `codex/tiizi-pfd-img-001` at `3e8c663f710a00de3fcc5c830077d64c0ddb245b`, clean |
| Group cards + Hub integration | Founder-accepted local integration at `2f065546dd7051b5c6401e52da897b8c82d6cc93`; not pushed as a PR | `codex/tiizi-pfd-group-cards-001`, clean before this handover record, no upstream |

The local ancestry is `3e8c663` + PR #150 head `3aa0147` → Today integration `38d7bf9` → Group cards `33e6354` → Group Hub polish `2f06554`. The cached `origin/main` at reconciliation was `3de78e4e31862bdd7e687e0711fd3967d49946e3`; no fetch was performed, so remote-main freshness is unknown.

## Pending test corrections

- **About sheet:** the existing `test:groups-founder-final-pass` guard expects an Escape-key handler. The current About sheet uses browser-history dismissal. This mismatch remains unresolved; the Group Hub polish did not alter the sheet or its dismissal/navigation behavior.
- **Profile preferences:** `npm run test:v2-preferences` has two failing assertions: “Profile can save, clear all, and re-edit from server state” and “Profile saves only the side(s) that changed (never records an untouched side as decided).” These are separate pending corrections and were not changed here.

## Preview image lifetime

Selected Group and Challenge photos are held as browser-tab-local `File` objects keyed by their entity IDs and rendered with temporary object URLs. They are not persisted to API or database records. A page reload or closing the tab clears the local selections. The Founder Preview is loopback-only, not public hosting.

## Continuation baseline

Start the next bounded V2 UX task from `codex/tiizi-pfd-group-cards-001` at accepted application source `2f065546dd7051b5c6401e52da897b8c82d6cc93`, after confirming current PR and worktree state. This includes the accepted Group, Challenge-card and Today experience. Keep the local integration branch and the PR #150/#163 worktrees intact; do not infer merge or production authorization from experience acceptance.
