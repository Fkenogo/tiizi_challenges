# TIIZI-S1 — V2 Experience Foundation

**Work package:** S1 — V2 Experience Foundation (first authorised experience slice)

**Status:** IMPLEMENTED candidate — verification + Founder preview pending (NOT marked COMPLETE)

**Date:** 2026-09-16

**Base:** `origin/main` @ `a3c05a98d9aba4da697fea9ba9bd884b4fc7c56a` (EA-01 merged)

**Branch:** `impl/s1-v2-experience-foundation-001`

**Adopted Experience Reference:** `Fkenogo/tiizi-prototye` @
`cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6`
(`docs/TIIZI-EXPERIENCE-REFERENCE.md` + `src/**` at that commit)

**Governing formula:** PRODUCT TRUTH + ADOPTED EXPERIENCE REFERENCE = TIIZI PRODUCT ASSEMBLY.
NEW V2 SHELL ≠ V1 SHELL MODIFIED TO LOOK LIKE THE PROTOTYPE.

---

## 1. Implemented shell elements

**New V2 composition root:** `src/v2/` — isolated from V1 screen composition.

| Element | Location | Notes |
| --- | --- | --- |
| Composition root / route definitions | `src/v2/routes.tsx` (`V2Routes`, mounted as `<Route path="/v2/*">` sibling of `/app/*` in `src/App.tsx`) | Member + Operator boundaries, shared providers |
| Member shell | `src/v2/member/MemberShell.tsx` | Primary Today/Challenges/Groups; Activity Guide contextual-secondary; Profile + notifications secondary; mobile-first bottom bar (V2 labels/routes); desktop top treatment |
| Member surfaces (placeholders) | `src/v2/member/memberPages.tsx` | Today, Challenges, Groups, Activity Guide, Profile, Notifications |
| Operator shell | `src/v2/operator/OperatorShell.tsx` | Desktop-first responsive sidebar, all 13 sections |
| Operator surfaces (placeholders) | `src/v2/operator/operatorPages.tsx` | Overview, Users, Groups, Activities & Knowledge, Challenges, Templates, Review & Attention, Donations/Support, Content & Localisation, Access & Roles, Platform Health, Audit Log, Settings |
| Shared primitives | `src/v2/components/V2Primitives.tsx` | `V2Page`, `V2SectionHeader`, `V2NavItem`, `V2Responsive`, `V2EmptyState`, `V2LoadingState`, `V2ErrorState`, `V2Sheet`, `V2AccountTrigger`, `V2NotificationTrigger` |
| Product-like placeholder | `src/v2/components/V2Placeholder.tsx` | Title + human explanation + empty state + next slice |
| Brand carry-forward | `src/v2/brand.tsx` | Class A (see §3) |
| Localisation scaffolding | `src/v2/i18n/V2Locale.tsx` | English first (`V2LocaleProvider`, `useV2Locale`, friendly day labels) |
| Group context | `src/v2/group/V2GroupScope.tsx` | Contextual scope only; no global active-group state |
| Auth/entry boundary | `V2Authenticated` in `src/v2/routes.tsx` | `ProtectedRoute` only (Class C); entry lands at `/v2/today` |

**Route structure (all under `/v2`, none under `/app`):**

- Member: `/v2/today`, `/v2/challenges`, `/v2/groups`, `/v2/guide`, `/v2/profile`, `/v2/notifications` (`/v2` → `/v2/today`)
- Operator: `/v2/operator/overview|users|groups|activities|challenges|templates|review|support|content|access|health|audit|settings` (`/v2/operator` → `overview`)

## 2. Deliberately deferred (later slices)

Challenge Creation binding (S2), Challenge detail engines (S3), Group management (S4),
Today read models (S5), Activity Guide knowledge binding (S6), Templates incl. PF-06 (S7),
Profile/Recognition/Notifications/Support authority (S8), Operator authority/RBAC (S9),
commercial model (S10). Placeholders state the next slice where useful.

## 3. Reuse classification

- **A. BRAND ASSET:** orange-led identity (`--primary #ff6b00`), Lexend typography,
  `public/favicon.png`, `public/apple-touch-icon.png`, `public/logo-icon/…`, `public/icons/…`.
  No brand redesign.
- **B. NEUTRAL TECHNICAL PRIMITIVE:** `ProtectedRoute` (+ `useAuth`/`AuthContext` session),
  `react-router-dom`, `@tanstack/react-query` setup (untouched), Tailwind design tokens.
  New V2 presentational primitives in `src/v2/components/` (no V1 experience import).
- **C. GOVERNED PRODUCT/DOMAIN CAPABILITY:** Firebase Auth identity boundary (via
  `ProtectedRoute` → existing login at `/app/login`). No domain read models bound yet.
- **D. V1 EXPERIENCE COMPONENT:** NONE reused. No authorisation sought or granted.

## 4. V1 experience modules explicitly NOT reused

V1 shell/route hierarchy (`/app/*` in `src/App.tsx`), V1 bottom navigation,
V1 Home composition, V1 Group journey (screens + `RequireGroupRoute` + group prerequisite),
V1 onboarding journey (`RequireOnboardedRoute`/`RequireOnboardingRoute`/`RequireProfileSetup`),
V1 challenge navigation (all legacy challenge screens), V1 Profile composition,
V1 feed/navigation assumptions, V1 return paths, V1 operator authority (`AdminRoute`).

## 5. V1 imports: expected ZERO — confirmed ZERO

`npm run test:v2-experience-boundary` (`scripts/testV2ExperienceBoundary.mjs`):
zero frozen-V1 experience imports in `src/v2/**`; no V1 bottom navigation;
no `/app/` return paths; `/v2/*` mounted as a sibling of `/app/*`.

## 6. Product Truth boundaries preserved

- No domain authority invented from prototype mock behaviour; placeholders bind no read models.
- No operator authority/RBAC: console states intent, grants nothing, changes no data.
- No Group prerequisite flow; Group context contextual only.
- No V1 onboarding assumptions: entry uses `ProtectedRoute`, not onboarding gating.
- No PF-05 merge, no PF-06, no deployment, no production data mutation.
- V1 `/app/*` routes untouched; EA-01 NOT reopened.

## 7. Founder local preview

No hosted preview, no deploy. From this branch:

```sh
git fetch origin
git checkout impl/s1-v2-experience-foundation-001
npm install
npm run dev        # → http://localhost:5173
```

Sign in with any existing account (governed auth boundary is reused), then visit:

- Member shell: `http://localhost:5173/v2/today` (resize for mobile bottom bar ↔ desktop top treatment)
- Member routes: `/v2/challenges`, `/v2/groups`, `/v2/guide`, `/v2/profile`, `/v2/notifications`
- Operator shell: `http://localhost:5173/v2/operator/overview` (+ the 12 other sections)
- Brand check: orange-led `tiizi / Together We Move` mark in both shells; approved favicon/app icon
- Placeholders/states: every route shows title + human explanation + empty state + next slice

Unauthenticated visits redirect to the existing login and return to the requested `/v2/…` path.
