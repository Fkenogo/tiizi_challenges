## START-01 — mandatory first response for coding agents (Founder direction 2026-11-11)

Before **any new or resumed coding, integration, correction, preview or release task**, apply the existing PRG-01/ECCL-005 contract and return a brief START-01 starting-point receipt **before changing code**. Repeat on agent, worktree, branch or repository handoff and after relevant upstream changes. Do not assume a handover or newer-looking branch is correct.

The receipt must identify: (1) task authority and observation time; (2) refreshed remote `main` SHA, working branch/HEAD, merge-base, dirty files/worktrees and relevant stacked/open PRs; (3) exact Founder-accepted implementation and evidence or UNKNOWN; (4) **START FROM** exact branch/commit and behaviour to preserve; (5) **DO NOT START FROM** known stale/superseded versions; (6) task-relevant active routes/imports/build selection; (7) preview artifact SHA, environment and fixture identity when relevant or UNKNOWN; and (8) CONFIRMED/CONFLICTED/UNKNOWN findings plus overall PASS / PASS WITH EXPLICIT LIMITATIONS / STOP.

A PASS never authorises work beyond the approved assignment. A limited PASS allows only independently unaffected authorised work. Missing approved ancestry, competing baselines or unknown source/preview identity material to the assignment means **STOP that affected implementation**: continue read-only investigation and escalate to the Technical Lead/Founder. Never overwrite dirty work or silently substitute old code. At HOV-01 handover, give the next agent the verified start point and separate implemented, tested, accepted, merged and deployed states.

This clause supplements, and never replaces, the project's stricter constitution, Founder decisions, review and release gates. It does not authorise merges, deployments, deletion, migrations or changes to production. Central reference: `MILEDGE-ECCL-005` in `Fkenogo/miledge-ventures`.

# Tiizi — Repository Engineering Instructions

These instructions apply to every coding agent and human contributor working in
this repository. They are repository-level authority. If any other document,
comment, test, fixture, or historical record appears to contradict them, these
instructions govern unless the Founder explicitly amends them.

---

## 1. TIIZI V1 EXCLUSION BOUNDARY

Tiizi V2 is a fresh product establishment built from current Product Truth and
the adopted Experience Reference.

**Archived Product V1 is excluded from V2 engineering consideration.**

Unless a Founder-authorised task explicitly reopens V1, agents **MUST NOT**:

- inspect V1 to derive a V2 implementation;
- reuse or adapt V1 services, hooks, screens, components, or utilities;
- use V1 Product Truth;
- preserve V1 compatibility;
- migrate or reconcile V1 operational data;
- use V1 UI/UX as an experience authority;
- introduce V1 fallbacks;
- restore V1 Firestore authorities;
- treat historical V1 behaviour as a V2 requirement.

Historical documentation may be read **only** when necessary to establish why a
boundary or a prior decision exists. It is evidence about the past, never an
implementation source for the present.

Current V2 programme documents, Product Truth, the Experience Reference, and
current runtime authorities govern V2.

### 1.1 What "V1" means here

Archived Product V1 is the legacy Firestore-backed product experience. Its
distinguishing surfaces are:

- browser routes under `/app/*` (the V1 shell);
- V1 feature screens (`src/features/**`), V1 hooks, and V1 services;
- **legacy Firestore Group/Challenge authority** — client or Admin SDK reads
  and writes to the `groups`, `groupMembers`, `challenges`, and
  `challengeMembers` collections, and the V1 read-model collections derived
  from them;
- V1-only Firebase Functions and V1 callables;
- V1 terminology, naming, navigation, and information architecture.

### 1.2 What is NOT V1

Do not confuse these with archived Product V1:

- **`/api/*` is the current, active, PRODUCT-NEUTRAL API namespace.** It is not
  a version marker and it is not Product V1. `/api/*` is where V2 is served.
- Shared neutral infrastructure that V2 legitimately uses — Firebase
  **Auth** (authentication/identity only), the API transport client, mobile
  UI primitives, and i18n scaffolding — is not Product V1.
- PostgreSQL is the sole V2 authority for Group, Group Membership,
  Group-scoped Challenge Group/Membership, Challenge, participation, activity
  application, and Knowledge.

### 1.3 Separation of concepts (do not conflate)

| Concept | Meaning |
| --- | --- |
| `/app/*` | Archived Product V1 browser shell. Excluded. |
| `/api/*` | Current active V2 API namespace. Product-neutral. |
| `/v2/*` | Current active V2 browser shell. |

The retired `/v1/*` API prefix had **no API-version authority**, no published
contract, and no external consumer. It was removed so that it can no longer be
mistaken for a Product V1 marker. **Do not reintroduce `/v1`**, and do not add
`/v1` aliases, redirects, proxies, duplicate registrations, or fallbacks.

### 1.4 Authority

- `docs/experience/TIIZI-EA-01-PRODUCT-TRUTH-RECONCILIATION.md` — V1
  architectural disposition (frozen / reference-only; IS-1 retirement timing).
- `docs/experience/TIIZI-EXPERIENCE-INTEGRATION-MAP.md` §10 — V1 reuse
  classification A–D.
- `docs/architecture/TIIZI-API-NAMESPACE-CORRECTION-001.md` — the `/api`
  namespace correction and the `/v1` removal record.
- `docs/programme/TIIZI-V2-MASTER-PROGRAMME.md` — single authoritative source
  of programme state.

V1 source removal is sequenced separately and bounded. Until that pass lands,
the physical presence of V1 source in the repository creates **no**
compatibility obligation and grants **no** implementation authority.

---

## 2. V2 ARCHITECTURAL RULES

1. **V2 browser routes live under `/v2/*` only** and mount in `src/v2/**`.
2. **The active API namespace is `/api/*`.** All server routes are registered
   through the canonical prefix constant (`api/src/apiPrefix.ts`); all client
   callers compose paths through the mirror constant (`src/api/apiClient.ts`).
   Never inline a namespace prefix anywhere else.
3. **PostgreSQL is the sole V2 domain authority.** V2 must never fall back to
   Firestore for Group, Membership, Challenge, participation, activity, or
   Knowledge authority.
4. **Firebase Auth is authentication/identity only.** It is not a domain
   authority.
5. **`/health` and `/ready` remain unversioned infrastructure routes**, outside
   the API namespace and exempt from the API authentication hook.

---

## 3. ENFORCEMENT

The rules above are enforced by an automated architecture guard that runs in
repository CI:

```bash
npm run test:boundary
```

The guard is defined in `scripts/boundaryGuard/`. It proves, mechanically:

1. the registered V2 runtime cannot import or transitively reach archived
   Product V1 browser modules;
2. the current V2 Group/Challenge runtime cannot reach legacy Firestore
   Group/Challenge authority;
3. no active API route is registered under `/v1/*`;
4. no active V2 API client contains a `/v1/*` request target;
5. no registered V2 navigation/runtime root can reach an `/app/*` route;
6. the guard itself fails when a prohibited dependency, a `/v1` route, or a
   `/v1` client target is deliberately introduced (regression fixture).

A change that violates these rules fails CI. Do not weaken, skip, or delete the
guard to make a change pass. If the guard is wrong, correct it with evidence
and record why.

---

## 4. Engineering-team coordination (FEF-TLC-001)

FEF-TLC-001 v1.0 is merged (PR #106, merge `542052c12ca7910a297da89f28ae01120b220980`) and Founder adoption/effectiveness approval was confirmed on 2026-11-06 (Member Completion Founder Disposition §18.3). Apply its execution-role separation alongside — not above — the V2 exclusions and architecture rules in §§1–3. The Founder coordinates directly with the Technical Lead; the Technical Lead is accountable for engineering coordination; the Programme Controller tracks; the Architecture & Decision Controller protects decisions; the Coding Agent implements; and an independent Code Reviewer verifies. The Chief of Staff is a portfolio role, is not the Tiizi Technical Lead, and is not an engineering approval gatekeeper. No agent may self-merge or claim its own changes were independently reviewed. Founder-reserved decisions and the Master Programme continue to control scope and authority.

**Activation evidence boundary:** Founder approval is recorded; completion of required role assignments and other activation prerequisites is not verified. The Technical Lead's role-assignment confirmation and current-state refresh remain pending in the FEF-TLC-001 activation record. Do not infer missing assignments or claim a verification date. This uncertainty does not waive independent review or authorize a package, merge, or deployment.

Protect the assembled volunteer experience: first reproduce the affected
member/steward journey against the adopted V2 Experience Reference, then show
founder-visible behavior and test evidence for any correction. Avoid layering
unapproved interaction restrictions onto the product. Local preview is a regular
engineering activity; no production deploy is implied.

---

## 5. Agent Entry Reconciliation Pilot (TIIZI-ECCL-PRG-01)

Before starting or resuming a task on a different branch or worktree, read
`docs/programme/TIIZI-ECCL-PRG-01-AGENT-ENTRY-PILOT.md` and perform the
read-only source-state collection with
`node scripts/prg01LocalReconciliation.mjs`. Independently reconcile
Founder-accepted behaviour, current open/stacked PR ancestry, active V2
routes/imports and the actual preview build. The script is informative only:
its successful exit or `SOURCE_ONLY_RECONCILED` output never grants
implementation, merge, deletion or deployment permission.

If approved baselines conflict, a stale branch might omit accepted work,
the active UI/preview SHA is unknown for the task, or dirty work may be
overwritten, STOP the affected implementation and report evidence to the
Technical Lead. Keep unrelated authorised tasks independent. Existing
V1 exclusion, boundary CI, Master Programme and FEF/TLC controls in §§1–4
remain unchanged.

## Portfolio Code Lifecycle Guardian — ECCL-005 adoption candidate

This repository participates in the Miledge Ventures Code Lifecycle Guardian rollout. The [central ECCL-005 contract](https://github.com/Fkenogo/miledge-ventures/blob/main/docs/miledge-ventures-knowledge/00-governance/MILEDGE-ECCL-005-PORTFOLIO-ENGINEERING-CONTINUITY-CONTRACT.md) is the proposed versioned portfolio source; it becomes effective only after Founder approval and merge, and does not override this project's approved product truth, security holds, FEF-TLC-001 roles, or merge authority. This local minimum remains usable if the central private document is inaccessible.

**PRG-01 — before starting or resuming a coding task (additional portfolio coverage; §5 remains binding):** inspect the current remote main SHA and branch/worktree state (preserve dirty work); relevant open and stacked PR ancestry; applicable Founder-approved behaviour and latest handover; active route/import/entrypoint; and, when relevant, preview build SHA, environment and isolated test-fixture identity. Distinguish code presence from Founder acceptance. Record facts, unknowns, exact SHAs and the scoped implementation-readiness result. A successful diagnostic command is not an authorization to code. If accepted changes are absent, branch ancestry conflicts, source/preview identity is unknown, or authority is unclear, STOP **only the affected task** and escalate to the Technical Lead; unrelated authorised work may continue.

**HOV-01 — at every handover:** identify the exact baseline/head SHA, branch and PR, accepted and unaccepted functionality, runtime/preview evidence or limitations, outstanding dependencies, known stale or replacement candidates, test results, and the next explicit approval boundary. Preserve historical and unmerged work until consumers and acceptance are verified. Do not delete legacy paths, overwrite dirty work, change CI gates or deploy based solely on this paragraph. Add project-specific automation through separate reviewed PRs, initially non-gating.
