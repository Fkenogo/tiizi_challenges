# Tiizi — Technical Control Board (derived, non-authoritative)

**As observed:** 28 October 2026 (P0 closure). **Read first:** `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` v2.82 (merged `main` `8c69381`), Disposition §17 and `TIIZI-FER-001-A/B/C`. Refresh before any implementation assignment. This board is derived from the Master Programme; it is not a roadmap, decision register or permission to implement.

| Item | Evidence / current disposition | Action |
| --- | --- | --- |
| V2 authority | Master Programme v2.81; Disposition §17 *Complete Experience, Controlled Pilot* (Founder direction 28 Oct 2026; effective upon Gate 0 merge) | Acceptance gate = **Complete Product Experience (CPE)**; Controlled Pilot = restricted-user launch of the complete product; Wider Launch separately authorized. No launch implied |
| FD-PILOT-01 | Feature deferrals superseded for sequencing (Disposition §17.3); operational, privacy, legal, eligibility, access-control and deployment gates retained | Apply §17.4 gates at Controlled Pilot entry |
| V2 repository boundaries | Root `AGENTS.md`; PostgreSQL domain, Firebase Auth identity; no V1 reuse | Enforce `npm run test:boundary` |
| Legal content | PR #105 merged 27 Oct; publication candidates only (Q8 open) | Do not publish until separate acceptance |
| Open PRs | #107 (experience-recovery candidate, unmerged, unmodified); #94 (CI efficiency, unrelated) | Do not merge incidentally; #107 handled per FER-001-C §6 |
| Support Tiizi | P8a placeholders acceptable for CPE page acceptance; **P8b activation required before Controlled Pilot entry**; Q5 facts and SUP-01/02 allocation open | No payment configuration or activation authorized |
| Challenge Templates (P5T) | Founder direction 28 Oct 2026: Operator-created Templates + member adoption **required for CPE** (capability 12). Architecture already fixed by PF-04 (`TEMPLATE_AUTHORING`, same Wizard, no second form); no implementation exists. Alignment: [TIIZI-FER-TPL-001](TIIZI-FER-TPL-001-CHALLENGE-TEMPLATE-CAPABILITY-ALIGNMENT.md), FER-001-B Amendment 002. Master Programme entry deliberately deferred (next free version, after rebase on then-current `main`) | Per-slice written authorization needed before P5T-1; Founder decisions FD-TPL-01…04 recorded (TPL-001 §5): Operator self-publication with separate author/publisher audit; continuous searchable/filterable library, no cap (~4 per type illustrative only); mandatory internal provenance not shown to members; adoption = successfully established Challenge. **P5T — IMPLEMENTATION NOT STARTED / NOT AUTHORIZED** |
| Local worktree and unmerged coding work | Not visible from GitHub snapshot | Programme Controller verify with working agent; do not assume idle/complete |

## Integrated-experience acceptance register (derived)

Historical technical completion is **preserved and shown separately** from current integrated acceptance. States: *preserve/verified · correction required · implementation missing · deferred by decision · needs Founder decision*. Observed at `a618d61`/code `542052c`. Package ids are FER-001-B. **Founder acceptance column is blank until the Founder records an outcome and approved SHA.** CPE # = capability in FER-001-A §3.2.

| Page / capability | CPE # | Historical technical completion | Current integrated acceptance | Package(s) | Founder acceptance |
| --- | --- | --- | --- | --- | --- |
| Welcome (4 public slides, before registration) | 1 | none | Implementation missing | P1a | — |
| Registration / account / legal acknowledgement, 18+ | 1, 11 | Sign-up + MC-1 bootstrap complete (migration 026 not deployed); legal pending | Correction required (no acknowledgement; "not published yet") | P1d (Q8) | — |
| Interests (0–5) / Goals (0–3), skippable, editable | 2, 3 | none (no storage/API/UI) | Implementation missing | P1b | — |
| Discovery + preference relevance + join-return | 3, 4 | S4c complete | Correction required (chronological only; Challenge→Group join dead-ends) | P2 | — |
| 118-Activity catalogue in V2 experience | 5 | S6 complete (development: 118 published) | **P0 technically complete / merged (PR #110)**: disposable-DB dev import+publish utility; 118 Published / 84 Fitness / 34 Wellness verified in an isolated database and the mobile preview. Local evidence done; **Founder acceptance pending** | P0 | — |
| Today / Streak / logging | 9 | S5, S3b/c complete | Correction required (reminder, ordering, empty states, in-context logging) | P3 | — |
| Groups list / Home / wizard | 4 | S4a–d complete | Preserve/verified | — | — |
| Group Details / Settings | 4, 7 | S4 complete | Correction required; creator provenance missing. (Roster refresh after Steward approval: **P0 technically complete / merged**, local evidence done, Founder acceptance pending) | P0 (roster), P4, P4a | — |
| Member identities (authorized contexts) | 7 | MC-4 not started | Implementation missing | P1c | — |
| Challenges list / detail / wizard | 4 | S3, S6, Challenge Page review complete | Preserve; Activity Guide return defect: **P0 technically complete / merged**, local mobile evidence done, **Founder acceptance pending**; labels/layout corrections remain (P5) | P0, P5 | — |
| Profile (full page, order per baseline) | 7, 11 | MC-2 profile exists; MC-2C conditional, MC-2D not started | Correction required (avatar opens sheet; sections missing) | P1a, P1b, P1d | — |
| Images (Profile, Group, Challenge) | 6 | none (gradients/initials work) | Implementation missing | P6 | — |
| Challenge Feed, Share, Kudos, announcements | 8 | CF-01 contract approved; no code | Implementation missing; Q3 bounds affected components | P7 | — |
| Challenge Templates: Operator authoring (desktop) and member adoption (mobile) | 12 | PF-04 Composer `TEMPLATE_AUTHORING` mode and draft codec only; no Template store, route or UI | Implementation missing (Operator Console `templates` page is a deferred placeholder; Wizard says Templates unavailable). Two separate journeys, searchable libraries (Operator + member), Operator adoption reporting; evidence for Together, Race and Streak, no inventory-count threshold | P5T (after P5, before P6) | — |
| Support Tiizi (manual mobile money) | 10 | none | Implementation missing (P8a); activation (P8b) required before pilot entry | P8a, P8b | — |
| Account, Privacy, Help | 11 | none | Implementation missing | P1d | — |
| **CPE gate** | all | — | **Not started** — all rows above accepted with approved SHA | — | — |
| **Controlled Pilot entry** | — | — | After CPE + P8b + operational gates; separate Founder authorization | — | — |

**Residual (P1d):** sign-out does not yet clear an outstanding Challenge-draft session backup (LOW; member-scoped isolation holds). Owned by P1d (Account section / sign-out), not a new workstream.

**Next exercise:** Founder reviews the P0 local evidence for the affected pages; Technical Lead then authorizes **P1a** (four public welcome slides before registration; full Profile page; avatar → Profile) per FER-001-B with a named Coding Agent and independent reviewer, local mobile-preview evidence and a single consolidated report.
