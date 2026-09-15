# Tiizi V1 Product Experience Freeze

## Status

**FROZEN — REFERENCE ONLY**

Effective at the current V2 Product Foundation programme boundary, before any
further V2 Experience Assembly. This is a freeze, not a deletion, migration,
or V1 repair programme. V1 remains intact as historical/reference material
until an explicitly authorized retirement or removal task says otherwise.

## Governing boundary

1. V1 is not the baseline implementation for V2 UX.
2. V1 screens, flows, navigation, Templates, activity libraries, Challenge
   creation, participant journeys, and presentation must not be copied or
   imported into V2 merely because they already exist.
3. V1 may be inspected for historical product intent, useful interaction
   ideas, prior terminology, lessons learned, and selectively reusable
   technical primitives.
4. Reuse must be deliberate and classified before it is adopted.
5. V1 product semantics may never override governed V2 Product Truth.
6. V1 UI structure may never create V2 domain requirements.
7. Existing V2 Product Truth remains authoritative.
8. V2 implementation proceeds as coherent vertical slices against:

   `Governed Product Truth + Reviewed Experience Reference = V2 Product Assembly`

## Classification convention

### A. V1 Product Experience — frozen / reference only

| Surface | Frozen modules/routes |
| --- | --- |
| Application shell and navigation | `/app/*` route hierarchy in `src/App.tsx`; `src/components/Layout/BottomNav.tsx`; Home and quick actions |
| Home and onboarding | `src/features/Home/**`, `src/features/Onboarding/**`, `src/features/Welcome/**`, `src/features/QuickActions/**` |
| Groups journey | `src/features/Groups/**`; `/app/groups`, `/app/group/:id/*`, `/app/create-group`, `/app/join-group` |
| Challenge journeys | `src/features/Challenges/CreateChallengeWizard.tsx`, `ChallengeDetailScreen.tsx`, `BrowseChallengesScreen.tsx`, `SuggestedChallengesScreen.tsx`, `ChallengePreviewScreen.tsx`, `CompetitiveChallengeScreen.tsx`, `CollectiveChallengeScreen.tsx`, `StreakChallengeScreen.tsx`, `ChallengeLeaderboardScreen.tsx`, `ChallengeCompletedScreen.tsx`, `CompletedChallengesScreen.tsx`; legacy `/app/challenges/*` routes |
| Templates and activity libraries as UX | `src/features/Challenges/WellnessTemplate*`; `src/features/Exercises/**`; `src/features/Wellness/**` |
| Participant/logging/social/profile presentation | `src/features/Workouts/**`, `src/features/Profile/**`, Group Feed/Members/Leaderboard screens, and V1 challenge participation/logging exits |

### B. Shared technical primitives — potentially reusable

These are not V2 design approval. They may be reused only when the consuming
slice confirms they are product-semantic-neutral.

| Primitive | Current location |
| --- | --- |
| Authentication context and route protection | `src/context/AuthContext.tsx`; `src/components/Auth/ProtectedRoute.tsx` |
| API transport and query infrastructure | `src/api/apiClient.ts`; `@tanstack/react-query` setup in `src/App.tsx` |
| Neutral display/error/loading primitives | `src/components/Layout/Screen.tsx`, `Section.tsx`, `LoadingSpinner.tsx`; `src/components/ErrorBoundary.tsx` |
| Design tokens and generic controls | global `st-*` styling and generic control primitives, subject to explicit slice review |
| Local emulator wiring | preview-harness environment/configuration and emulator client plumbing |

`BottomNav` is expressly excluded from this category: it is frozen V1 product
navigation even though it shares the Layout barrel with neutral primitives.

### C. Shared authoritative/domain infrastructure — reuse required or governed

| Authority | Current location/direction |
| --- | --- |
| Firebase Auth identity boundary | Auth verifier/client boundary; no V2 experience may replace it |
| Group authority and eligibility | Firestore Group existence/lifecycle and live Membership authority; PG remains shadow only |
| Group identity bridge | `resolveEstablishmentGroupId` and V2 establishment seam; Group context must resolve normally |
| V2 domain and API | `api/src/**` V2 contracts/routes, PostgreSQL V2 model, V2 API clients/read models |
| Product truth | PF-01 Knowledge, PF-02 Metrics/Units/compatibility, PF-03 Challenge Definition, PF-04 Composer, Engines, finalization/result contracts |

### D. V2 product implementation — preserve

- `api/src/challengeComposer.ts`, PF-03 validation and V2 establishment.
- `src/api/v2ChallengeCreationApi.ts`, `src/api/v2ChallengeApi.ts`, and
  `src/features/Challenges/V2/composerDraft.ts`.
- Knowledge-backed selection, compatibility validation, Group bridge, V2
  read model, and challenge engines.
- The local preview harness and its governed fixture:
  `api/src/previewComponentGroup.ts`, `api/src/previewComponentRoutes.ts`,
  and `src/features/Challenges/V2/ChallengeCreationComponentPreview.tsx`.

### E. Mixed / contaminated — retain as evidence, not V2 UX precedent

| Module | Preserved V2 truth | Frozen V1-experience dependency or assumption |
| --- | --- | --- |
| `src/features/Challenges/V2/V2CreateChallengeWizard.tsx` | PF-04 draft, PF-03 preview, Knowledge options, Group bridge, V2 establishment | imports `BottomNav`; ordinary mode returns to `/app/challenges/v2` and is mounted below V1 onboarding/Group journey |
| `src/features/Challenges/V2ChallengeDetailScreen.tsx` | V2 read model and V2 participation mutations | imports `BottomNav`; ordinary mode exposes V1-hosted navigation and logging exits |
| `src/features/Challenges/V2ChallengesScreen.tsx` | V2 list read model | imports `BottomNav`; `/app/challenges/v2` is an extension of the V1 route hierarchy |
| `src/App.tsx` | V2 routes and local preview gate | mixed composition root: it hosts both V1 `/app/*` and V2 routes; it is not a future V2 shell |

## Enforced frontend boundary

`scripts/testV1ExperienceFreezeBoundary.mjs` is the repository convention and
enforcement point. It scans V2 experience modules—files under a `V2/`
namespace or V2-named feature screens—and rejects a new import of the frozen
V1 experience manifest. It explicitly permits neutral primitives and governed
V2 API/domain imports.

The three `BottomNav` imports above are a recorded pre-freeze mixed baseline.
They remain visible in guard output and are not approval to replicate them.
Any additional frozen import, or any baseline change, fails until an explicit,
authorized V2 Experience Assembly reconciliation records the decision.

## PF-05 disposition

| Aspect | Status |
| --- | --- |
| PF-05 domain/technical implementation | **IMPLEMENTED** |
| PF-05 experience assembly | **NOT APPROVED** |

Founder component review stopped because the current human-facing composition
is influenced by V1 product experience. PF-05 remains implementation evidence
for the preserved V2 integrations; its current screen composition is not a V2
UX contract. It is not merged and must not receive further UX polishing before
Experience Reference reconciliation.

## Experience Reference

**IN DEVELOPMENT / NOT YET ADOPTED**

Once reviewed and Founder-approved, the greenfield Experience Reference may
inform the V2 application shell, navigation hierarchy, screen composition,
interaction patterns, journey assembly, information hierarchy, and
presentation model. It may not establish domain authority, permissions,
lifecycle rules, scoring, Challenge semantics, Knowledge semantics, Group
authority, Member eligibility, or result truth.

No broad V2 Experience Assembly proceeds until that review occurs. PF-01
through PF-04 remain settled, PF-06 remains **NOT BEGUN**, and this boundary
does not reopen domain, engine, Group, or Auth architecture.
