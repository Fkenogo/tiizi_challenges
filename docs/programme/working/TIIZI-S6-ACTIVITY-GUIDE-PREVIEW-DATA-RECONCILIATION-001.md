# TIIZI S6 Activity Guide Preview-Data Reconciliation 001 and Founder Correction 001 — closure record

**Disposition:** COMPLETE / FOUNDER ACCEPTED / MERGED.

**Scope:** documentation closure only. No new Product Truth, application code, catalogue data, lifecycle, readiness, eligibility or selectability change is made by this record.

## Merged work

| Item | PR | Merge commit |
| --- | --- | --- |
| S6: restore six accepted semantic definitions to governed catalogue (data-only; six `semanticDefinition` insertions) | #85 | `baa27340bfb5205777361696d66eb8704f6d742d` |
| S6 Activity Guide Founder Correction 001: Fitness/Wellness filter + category-rail containment | #86 | `0a53725e47dd94bb0ac334b52a92c7cbb237333a` |

Canonical `origin/main` at closure entry: `0a53725e47dd94bb0ac334b52a92c7cbb237333a`.

## Preview-data reconciliation

The local member-preview database (`tiizi_member_shell_preview_001`) had been populated with the 118 governed Activities (116 Draft / 2 Published) and was stale relative to the already-accepted S6 DEVELOPMENT publication state ([TIIZI-S6-DEVELOPMENT-CATALOGUE-PUBLICATION-001](TIIZI-S6-DEVELOPMENT-CATALOGUE-PUBLICATION-001.md)). Six Wellness records (`WEL-DLY-004`, `WEL-NUT-002`, `WEL-NUT-003`, `WEL-NUT-007`, `WEL-NUT-008`, `WEL-NUT-009`) lacked the accepted Knowledge version-2 `semanticDefinition` revisions because those strings had never been committed to the governed candidate JSON; the accepted 2026-09-29 DEVELOPMENT execution had applied them directly.

- The six accepted strings were recovered verbatim from the accepted 2026-09-29 execution evidence (one authorized six-record revision, version 1 to 2, `publicationReady` true, matching the apply output and the pre- and post-publication audits, with no later superseding revision) and restored to the governed candidate by PR #85. Recovery was historical restoration, not new authored content.
- The importer reported the six as updates and 112 unchanged; after apply the importer reports 118 unchanged.
- The 116 Drafts were published through the existing governed `setKnowledgeLifecycle(db, id, 'published')` operation with per-record identity, version and readiness checks. No direct lifecycle SQL, and no manual eligibility or selectability assignment.

## Accepted catalogue state (local preview, aligned to the accepted S6 state)

| Measure | State |
| --- | --- |
| Coded canonical Activities / unique Activity Codes | 118 / 118 |
| Fitness / Wellness | 84 / 34 |
| Published / Draft / Retired | 118 / 0 / 0 |
| publicationReady | 118 true / 0 false |
| challengeEligible | 118 true / 0 false |
| composerSelectable | 118 |
| Duplicate Activity Codes / codeless rows | 0 / 0 |
| The six restored records | Knowledge version 2 |
| `WEL-MND-003` | Knowledge version 2 |
| Other 111 records | Knowledge version 1 (no publication-induced version drift) |

`canonicalOnly` enforcement is unchanged.

## Accepted Activity Guide experience (Founder Correction 001)

- The member app remains mobile-only; the Guide is not widened and has no desktop layout.
- Search is retained with its existing semantics.
- A compact Fitness / Wellness first-level filter (existing canonical `kind`; no new taxonomy) sits between search and the category rail. Default is neither selected, showing all 118; pressing the active domain clears it.
- The category rail narrows to the categories present in the selected domain; a category not valid in a newly selected domain resets to All categories.
- Effective results are domain AND category AND search.
- The category rail is contained inside the member canvas (confirmed in the Founder browser); horizontal touch scrolling is preserved.
- The existing Activity detail experience and the Use in Challenge flow are preserved.

## Founder review

Reviewed and accepted: full 118-Activity catalogue visible; search; categories; Fitness / Wellness filter; rail containment in the Founder browser; Fasting, Avoid Added Sugar, Burpee and representative details. No Product Truth or content correction required and no further S6 UI change requested.

## Boundaries preserved

No production access. No deployment. PR #77 remains frozen: OPEN / DRAFT / UNMERGED at `ee18e629616c3a136ecd069cae5208871348ee09`. Operator Console functional expansion remains paused. GF-04 remains IMPLEMENTED / UNMERGED / FROZEN on PR #77 and was not resumed or modified by this closure.

## Note recorded for the programme (not a change)

The V2 member Activity detail does not render `semanticDefinition` text; it is available through the Knowledge API detail. This reflects the existing UI design and was not changed.
