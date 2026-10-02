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
