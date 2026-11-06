# Tiizi — FEF-TLC-001 Engineering Team Activation Candidate

**Status:** **Founder adoption/effectiveness approval confirmed 2026-11-06; operational role-assignment and activation-prerequisite verification PENDING.** The candidate merged in PR #106 on 2026-10-27; Founder approval is a separate event recorded in Member Completion Founder Disposition §18.3. **Candidate date:** 27 October 2026.
**Base:** `main` at `63ab0f628866f40f4eb9ee33654eb5666b7ea604`.
**Nature:** Team-working instructions only. No code, tests, migration, release, or product-policy authority.

## Why

Tiizi has substantial approved V2 Product Truth and an adopted Experience Reference, yet Founder experience feedback has identified regressions and excessive cycles of micro-governance. The engineering team must turn approved truth into a useful, coherent, visibly working volunteer-participation experience. The model serves delivery, not documentation volume.

## Responsibilities — one team, no competing authorities

| Responsibility | Accountable for |
| --- | --- |
| Technical Lead | Owns execution coordination, selects a bounded approved package, assigns implementer, integrates reports, proposes readiness. Does not claim to be Chief of Staff. |
| Programme Controller | Reads current V2 Master Programme first, maintains a brief derived work/dependency view, marks unknowns rather than inventing progress. |
| Architecture & Decision Controller | Checks effective Founder dispositions, Product Truth, V2 boundaries, and whether changes respect the adopted experience. No fresh architecture without real need. |
| Coding Agent | Makes authorized code/UI/test changes on an isolated branch, runs local checks and previews, provides exact files/commit/test evidence. Does not self-approve or self-merge. |
| Code Reviewer | Independently checks exact implementation head for correctness, experience regression, privacy/tenant rules and proportional risks. R2 needs a distinct reviewer/session. |

These are **five distinct functions**, not five required people/accounts. One person or AI session may cover low-risk functions if explicit; the implementer cannot represent its own work as independently reviewed. The Founder retains product decisions, PR merge, and deployment authorization. The portfolio Chief of Staff is outside the Tiizi project team and is not an engineering approval gatekeeper.

**Founder operating direction (2026-11-06):** the Founder coordinates directly with the Technical Lead; the Technical Lead is accountable for engineering coordination; the Coding Agent is an explicitly recognized implementation role; independent review and existing engineering controls remain applicable; Founder-reserved decisions remain with the Founder. These principles do not assign named people to framework functions or waive any review control.

## Existing Tiizi authorities must be preserved

1. `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` is authoritative for programme state and sequence; this note must never create a second roadmap.
2. Current Founder dispositions, V2 Product Truth, and `docs/experience/**` plus the adopted `Fkenogo/tiizi-prototye` experience reference govern features and visual assembly.
3. Root `AGENTS.md` governs V1 exclusion, `/v2/*` browser routes, `/api/*` transport, PostgreSQL domain authority, Firebase Auth identity only, and `npm run test:boundary`. No return to V1.
4. The member experience is mobile-first, volunteer-friendly and readable. Do not impose unsupported participation constraints or regress the agreed steward/member experience through risk-driven microdesign.
5. Legal Terms/Privacy publication candidates are **not approved for public publication** by PR #105 alone. FD-PILOT-01 is the approved limited-pilot amendment, not a launch authorization.
6. Existing PR #94 is separately open; do not merge it incidentally or treat it as a work-package authorization.

## First operational exercise

**Start with evidence, not a new feature.** Programme Controller identifies the current genuinely active slice; Technical Lead selects one small end-to-end correction to an existing member/steward journey affected by the Founder experience feedback, or explains why another approved package is more urgent.

- Controller: precise baseline, active package, conflicts, owners, dependencies.
- Architecture: approved Product Truth and experience reference, necessary safety boundaries, no invented rules.
- Coding Agent: reproduce the present experience in local preview; implement the bounded correction; include before/after screenshots or demonstrable interaction notes and tests.
- Reviewer: R0 for clearly isolated documentation, R1 for ordinary UI/low-risk code, R2 for domain authority, access/privacy, data/migration or security-sensitive work.
- Lead: one consolidated summary of the actual product difference, test results, exact SHA, outstanding risks, and merge recommendation.

Founder should be able to **see and try** the result. Local preview is routine; hosted deployment is a separate authorization. Avoid lengthy new review cycles where a targeted test and a visible product check suffice.

## Activation sequence and stop conditions

1. Review this candidate and companion root instructions; Founder authorizes merge. **Completed:** PR #106 merged on 2026-10-27; Founder adoption/effectiveness approval separately confirmed 2026-11-06.
2. Lead confirms role assignments and refreshes current programme status against the current repository, branch and Founder feedback. **Status: pending evidence.** Do not infer role assignments or claim activation prerequisites complete until this is recorded.
3. Team performs a bounded, actually implemented engineering exercise within existing scope; merge/deployment requires its own authorization. **Status: not evidenced as complete.**
4. Chief of Staff may assess operational evidence before successful portfolio adoption is claimed. This is not an engineering approval gate and does not replace Founder or independent review.

STOP for a conflicting Founder decision, attempted V1 reintroduction, unapproved domain/security change, material undisclosed data risk, or a proposed deployment. Do **not** STOP unrelated authorized local development merely because a different workstream is held.

## Minimal handoff

Every handoff should state: package; exact source baseline; Product Truth / experience reference; owner and reviewer; affected files; changed behavior; tests and preview evidence; risks/blocked decisions; next authorized action. Keep this to one concise report/board entry, not five parallel reports.

**Disposition:** Founder adoption/effectiveness approval confirmed; operational role-assignment and activation-prerequisite verification is pending. No implementation, merge, or deployment authorization is implied.

## Founder approval and activation evidence reconciliation (2026-11-06)

| Item | Evidence/status |
|---|---|
| Candidate merge | Confirmed: PR #106, merge commit `542052c12ca7910a297da89f28ae01120b220980`, 2026-10-27 |
| Founder adoption/effectiveness approval | Confirmed: 2026-11-06, recorded in Member Completion Founder Disposition §18.3 |
| Date all activation prerequisites verified | **Not established.** No completion date is claimed |
| Technical Lead named assignment and step-2 confirmation | **Not confirmed in an attributable current role-assignment record** |
| Programme Controller and Architecture & Decision Controller assignments | **Not confirmed in an attributable current role-assignment record** |
| Coding Agent | Role explicitly recognized; this approval does not establish a permanent person/account assignment |
| Independent Code Reviewer assignment | **Not confirmed as a standing assignment**; each review still requires an independent reviewer/session appropriate to the change |
| Chief of Staff operational assessment | Not found as completed; it is not an engineering approval gate |

The approval and the role-assignment completion date are separate facts. Unknown assignments remain unassigned/unknown until supported by attributable evidence.
