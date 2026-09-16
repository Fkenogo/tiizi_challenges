# TIIZI-S1 — V2 Experience Foundation

**Work package:** S1 — V2 Experience Foundation (first authorised experience slice)

**Status:** COMPLETE / FOUNDER ACCEPTED / MERGED (merge `d5183c8` of approved head
`dbb1ba7` into canonical main `a3c05a9`, 2026-09-16; PR #27, CI green; non-fast-forward
merge commit, no squash, no rebase, no force-push)

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
| Auth/entry boundary | `V2Authenticated` in `src/v2/auth/V2AuthGuard.tsx` + public `src/v2/auth/V2SignInPage.tsx` / `V2SignUpPage.tsx` | New V2 auth experience (CORR-001); session truth from shared `ProtectedRoute` with an explicit V2 entry; entry lands at `/v2/today` |

**Route structure (all under `/v2`, none under `/app`):**

- Public V2 auth experience: `/v2/sign-in`, `/v2/sign-up` (new V2 surfaces; unauthenticated `/v2/*` lands on `/v2/sign-in?next=…` and returns to the requested V2 route)
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
- **C. GOVERNED PRODUCT/DOMAIN CAPABILITY (extracted/adapted in CORR-001):** Firebase Auth identity boundary
  (session state + email/password + Google credential handling via `AuthContext`/`useAuth`; recovery delivery via
  `sendPasswordResetEmail` + neutral error copy in `src/utils/firebaseAuthErrors.ts`). The shared session gate
  (`ProtectedRoute`) keeps a configurable entry (`loginPath`; V1 default preserved) and V2 supplies its own
  (`/v2/sign-in`). The V1 Login/Sign-up screens, welcome, onboarding, and `/app/*`-only return-path defaults were
  NOT reused. No domain read models bound yet.
- **D. V1 EXPERIENCE COMPONENT:** NONE reused. No authorisation sought or granted.

## 4. V1 experience modules explicitly NOT reused

V1 shell/route hierarchy (`/app/*` in `src/App.tsx`), V1 auth experience (`LoginScreen`/`SignupScreen`
at `/app/login`/`/app/signup`, V1 welcome, V1 return-path defaults), V1 bottom navigation,
V1 Home composition, V1 Group journey (screens + `RequireGroupRoute` + group prerequisite),
V1 onboarding journey (`RequireOnboardedRoute`/`RequireOnboardingRoute`/`RequireProfileSetup`),
V1 challenge navigation (all legacy challenge screens), V1 Profile composition,
V1 feed/navigation assumptions, V1 return paths, V1 operator authority (`AdminRoute`).

## 5. V1 imports: expected ZERO — confirmed ZERO; runtime crossover guarded (CORR-001)

`npm run test:v2-experience-boundary` (`scripts/testV2ExperienceBoundary.mjs`):
zero frozen-V1 experience imports in `src/v2/**`; no V1 bottom navigation;
no `/app/` return paths; `/v2/*` mounted as a sibling of `/app/*`.
CORR-001 extension: no `/app/login` or `/app/signup` entry referenced from
`src/v2/**`; no frozen V1 journey/gate identifiers (`LoginScreen`,
`SignupScreen`, `WelcomeScreen`, `OnboardingSlides`, `RequireOnboardedRoute`,
`RequireOnboardingRoute`, `RequireGroupRoute`, `RequireProfileSetup`,
`AdminRoute`) used in V2 composition; V2 sign-in/sign-up routes exist and are
public (outside the authenticated scope); V2 guard supplies its own entry;
shared session gate keeps the configurable `loginPath` override.

`npm run test:v2-auth-returns` (`scripts/testV2AuthReturnPaths.ts`):
return-path contract — V2 routes pass through, V1 return paths and
open-redirect shapes fall back to `/v2/today`.

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

- Signed-out entry: open `http://localhost:5173/v2/today` while signed out → NEW V2 sign-in
  experience at `/v2/sign-in?next=%2Fv2%2Ftoday` (never the V1 login). Sign in → returns to `/v2/today`.
- Member shell: `http://localhost:5173/v2/today` (resize for mobile bottom bar ↔ desktop top treatment)
- Member routes: `/v2/challenges`, `/v2/groups`, `/v2/guide`, `/v2/profile`, `/v2/notifications`
- Operator shell: `http://localhost:5173/v2/operator/overview` (+ the 12 other sections)
- Brand check: orange-led `tiizi / Together We Move` mark in both shells and the auth experience; approved favicon/app icon
- Placeholders/states: every route shows title + human explanation + empty state + next slice

Unauthenticated visits land on the V2 sign-in experience and return to the requested `/v2/…` path.
Sign-up (`/v2/sign-up`) returns to the requested V2 route — never into V1 onboarding/profile setup.

## 8. CORR-001 — V1 auth experience leak: root cause + correction record

**Founder review finding:** unauthenticated `/v2/today` redirected to `/app/login?next=%2Fv2%2Ftoday`
and rendered the frozen V1 Login/Sign-up experience.

**Root cause:** `V2Authenticated` reused the shared `ProtectedRoute` session gate whose
unauthenticated entry was hardcoded to the V1 login route. The S1 import guard only scanned
`src/v2/**` source, so the runtime redirect into V1 experience escaped it.

**Correction (experience only; auth Product Truth unchanged):**
new V2 auth experience (`src/v2/auth/`: `V2AuthLayout`, `V2SignInPage` incl. password-recovery
dialog, `V2SignUpPage`, `V2AuthGuard`, `v2NextPath` return-path resolver) in the V2 visual
language; `ProtectedRoute` gained a `loginPath` override (V1 default `/app/login` preserved);
V2 supplies `/v2/sign-in`; return paths accept V2 routes only (fallback `/v2/today`); no
onboarding/profile/group gates on the S1 path. Firebase Auth, providers, session semantics,
and configuration untouched; no mock users; no production data changes.

S1 disposition: IMPLEMENTED CANDIDATE / FOUNDER REVIEW FAILED ON V1 AUTH EXPERIENCE LEAK
→ CORRECTION APPLIED → AWAITING FOUNDER EXPERIENCE REVIEW. S1 NOT marked COMPLETE; NOT merged.

## 9. CORR-002 — safe local Auth emulator support for Founder preview

**Finding:** the corrected V2 sign-in reached Firebase Auth, but the browser SDK was not wired
to the running local Auth emulator (127.0.0.1:9099), so existing seeded Founder preview
credentials were rejected. Repository search confirmed zero `connectAuthEmulator`/emulator
wiring; `firebase.json` carries no emulators section (the emulator is started externally).

**Correction (local-preview integration only; auth Product Truth unchanged):**
neutral helper `src/lib/firebaseEmulators.ts` + one wiring line in `src/lib/firebaseAuth.ts`.
Emulator mode activates if and only if DEV is true AND `VITE_USE_FIREBASE_EMULATORS=true`
(explicit, narrow opt-in; localhost serving alone never enables it; production builds never
connect to localhost; duplicate connection prevented via a `globalThis` marker across HMR
reloads). Default Firebase behaviour unchanged when the flag is absent. No secrets; no
provider/project/credential/semantics changes; no mock or bypassed authentication.

**Founder preview:** Auth emulator already running on 127.0.0.1:9099; set
`VITE_USE_FIREBASE_EMULATORS=true` in local `.env.local` (never committed); `npm run dev`;
open `/v2/today` → `/v2/sign-in` → existing Founder credentials → `/v2/today`.

**Guard:** `npm run test:firebase-emulator-mode` (`scripts/testFirebaseEmulatorMode.ts`) proves
opt-in connects (A), localhost alone never enables (B), production never activates (C), and
default production configuration is unchanged (D).

**Shell dependencies:** S1 surfaces bind no read models — Firestore/PostgreSQL/API are NOT
required to display the shell. On sign-in, the pre-existing user-document bootstrap and V1
warmup prefetches may log failed writes/reads against the default config; they are caught
and never block the V2 shell.

S1 disposition unchanged: IMPLEMENTED CANDIDATE / AWAITING FOUNDER EXPERIENCE REVIEW.
S1 NOT marked COMPLETE; NOT merged.

## 10. CORR-003 — deterministic local V2 preview identity

**Finding:** historical local preview credentials were rejected (stale/unknown emulator state;
no repo seeder ever created Auth accounts). Resolution: stop preserving old credentials;
reset one known local identity deterministically.

**Workflow (local development only):** `npm run preview:v2-auth:reset` + `npm run preview:v2-auth:list`
(`scripts/previewV2Auth*.ts`). Loopback-only (127.0.0.1:9099, fail-closed), refuses
NODE_ENV=production, password via `TIIZI_V2_PREVIEW_PASSWORD` (never printed), project
resolution prefers `VITE_FIREBASE_PROJECT_ID` so seeder and browser share one namespace,
drift fails closed. Identity: `founder1@tiizi.local`. Safety proofs:
`npm run test:preview-v2-auth-workflow`.

**Founder procedure (forget old accounts/passwords):**

Terminal 1 — start the Auth emulator (repo root):
```sh
firebase emulators:start --only auth --project "$VITE_FIREBASE_PROJECT_ID"
```
(Use the same project ID as the frontend `.env.local`. `firebase.json` pins auth to 127.0.0.1:9099.)

Terminal 2 — reset the deterministic preview account (same worktree):
```sh
export TIIZI_V2_PREVIEW_PASSWORD='choose-a-local-password'
npm run preview:v2-auth:reset
npm run preview:v2-auth:list   # shows email/uid/disabled; never secrets
```

Terminal 3 — start Vite with emulator mode (same worktree, `.env.local` holds
`VITE_USE_FIREBASE_EMULATORS=true`):
```sh
npm run dev
```

Browser: open `/v2/today` → V2 sign-in → `founder1@tiizi.local` + the Terminal 2
password → `/v2/today`. The browser console shows
`[tiizi] Auth emulator mode: connected to http://127.0.0.1:9099` (development only).

**Post-auth V1 check (CORR-003):** successful V2 authentication navigates only to the
resolved V2 return path; no `/app/*` navigation, no V1 onboarding/profile/group gates,
no V1 UI renders. Background only: user-document bootstrap write + V1 warmup data
prefetches (caught, non-blocking) — left for a later integration slice, not an S1 violation.

## 11. Closure — Founder preview acceptance and merge (TIIZI-S1-CLOSE-MERGE-001)

Founder completed the local S1 experience preview and accepted the foundation for its
bounded purpose. Confirmed manually:

1. Local Auth emulator starts successfully.
2. Deterministic preview Founder account reset works.
3. V2 sign-in succeeds.
4. Signed-out `/v2/today` routes to the NEW V2 sign-in experience.
5. Successful authentication returns to `/v2/today`.
6. No V1 Login, Welcome, onboarding, group-prerequisite journey, or V1 shell appears.
7. V2 member shell renders successfully.
8. Member navigation works for Today, Challenges, Groups, Activity Guide, Profile, Notifications.
9. Operator transition works.
10. V2 Operator shell renders separately with its intended 13-section navigation.
11. Local preview clearly indicates Firebase emulator mode.
12. S1 accepted as a FOUNDATION slice: placeholders stay placeholders; no surfaces polished;
    no S2/S3+ implementation; Product Truth, engines, and domain semantics unchanged.

Architectural boundary preserved at closure: V1 = FROZEN / REFERENCE ONLY; V1 cannot host
V2; no compatibility obligation exists; the adopted Experience Reference
(`Fkenogo/tiizi-prototye` @ `cfa696fb`) remains the experience authority beneath Product
Truth (`PRODUCT TRUTH + ADOPTED EXPERIENCE REFERENCE = TIIZI PRODUCT ASSEMBLY`);
S1 establishes the NEW V2 composition root (`src/v2/`); `NEW V2 SHELL ≠ V1 SHELL MODIFIED
TO LOOK LIKE THE PROTOTYPE`.

Merge: PR #27, approved head `dbb1ba7`, base `a3c05a9` (no drift), CI green (api,
api-image, functions, web), merged as non-fast-forward commit `d5183c8` — no squash, no
rebase, no force-push. Approved head is an ancestor of main. No deployment occurred.

Next authorised implementation slice: **S2 — GROUP CONTEXT & CHALLENGE CREATION**
(NOT IMPLEMENTED in this task). Subsequent slices are vertical product assembly slices
(Product Truth / engine authority → existing governed domain capability → adopted
Experience Reference → V2 working experience) — not a sequence of independently polished
placeholder screens.

Final status: **TIIZI-S1 — V2 EXPERIENCE FOUNDATION: COMPLETE / FOUNDER ACCEPTED / MERGED.**
