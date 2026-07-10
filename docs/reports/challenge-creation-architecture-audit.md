# Challenge Creation Architecture — Complete Audit Report

**Date:** 2026-06-27
**Branch:** fix/p0-pre-deploy-blockers
**Scope:** Read-only audit — no code modified
**Purpose:** Map every path through which a challenge can be created; identify duplicate implementations

---

## TL;DR

There are **two independent creation implementations** (~75% duplicate code). Fixes applied to one do **not** automatically apply to the other.

| Component | Purpose | Creation mechanism |
|---|---|---|
| `CreateChallengeWizard` | User creates live challenges | `httpsCallable('createChallengeWithCreatorMembership')` |
| `CreateChallengeScreen` | Admin creates templates | `challengeTemplateService.createTemplate()` + `wellnessTemplateService.createTemplate()` |

---

## Part 1 — Every React Component Involved in Challenge Creation

### Primary Creation Components

**1. CreateChallengeWizard** — User-facing
- File: `src/features/Challenges/CreateChallengeWizard.tsx`
- Route: `/app/create-challenge`
- Reachable: ✅ Yes (protected route + requires group)
- Exports: `CreateChallengeWizard` (default)
- Purpose: Multi-step wizard for users to create fitness or wellness challenges (collective / competitive / streak)
- Creates via: `httpsCallable('createChallengeWithCreatorMembership')`
- Key imports: `useCreateChallenge`, `useSuggestedChallengeTemplate`, `useWellnessTemplate`, `useExercises`, `useWellnessActivities`, `useMyGroups`, `httpsCallable`

**2. CreateChallengeScreen** — Admin-facing
- File: `src/features/Admin/Challenges/CreateChallengeScreen.tsx`
- Route: `/app/admin/challenges/create`
- Reachable: ✅ Admin only
- Exports: `CreateChallengeScreen` (default)
- Purpose: Create challenge templates (draft or published); supports both fitness and wellness modes
- Creates via: `challengeTemplateService.createTemplate()` (fitness) | `wellnessTemplateService.createTemplate()` (wellness)
- Key imports: `useCreateSuggestedChallengeTemplate`, `useExercises`, `useWellnessActivities`, `useAdminPermissions`, `wellnessTemplateService`

**3. EditChallengeTemplateScreen** — Admin-facing
- File: `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx`
- Route: `/app/admin/challenges/templates/:id/edit`
- Reachable: ✅ Admin only
- Purpose: Edit existing fitness challenge templates
- Note: No equivalent wellness template edit screen exists

**4. ChallengeTemplatesScreen** — Admin template management hub
- File: `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx`
- Route: `/app/admin/challenges/templates`
- Reachable: ✅ Admin only
- Purpose: Browse, filter, publish, duplicate, delete fitness + wellness templates
- Does NOT create; navigates to CreateChallengeScreen or EditChallengeTemplateScreen

**5. WellnessTemplateDetailScreen** — User discovery
- File: `src/features/Challenges/WellnessTemplateDetailScreen.tsx`
- Route: `/app/challenges/wellness/:id`
- Reachable: ✅ Yes
- Purpose: Display wellness template detail; "Launch as Challenge" → navigates to CreateChallengeWizard with `?wellnessTemplateId=<id>`

**6. WellnessTemplateGalleryScreen** — User discovery
- File: `src/features/Challenges/WellnessTemplateGalleryScreen.tsx`
- Route: `/app/challenges/wellness`
- Reachable: ✅ Yes
- Purpose: Browse published wellness templates; navigates to WellnessTemplateDetailScreen

**7. SuggestedChallengesScreen** — User discovery
- File: `src/features/Challenges/SuggestedChallengesScreen.tsx`
- Route: `/app/challenges/suggested`
- Reachable: ✅ Yes
- Purpose: Browse published fitness templates; "Proceed to Create" → navigates to CreateChallengeWizard with `?templateId=<id>`

**8. QuickActionsScreen** — Entry point
- File: `src/features/QuickActions/QuickActionsScreen.tsx`
- Route: `/app/quick-actions`
- Reachable: ✅ Yes (via FAB / BottomNav)
- Purpose: "Create Challenge" quick action with group picker; navigates to CreateChallengeWizard

### Supporting Components (navigation only, no creation logic)

- `GroupDetailScreen` — "Create Challenge" button → `/app/create-challenge?groupId=<id>`
- `ChallengesScreen` — Navigation hub to suggested / wellness / browse
- `BrowseChallengesScreen` — Discovery only, no creation

---

## Part 2 — Every Route

| URL | Component | Flow label |
|---|---|---|
| `/app/create-challenge` | `CreateChallengeWizard` | User challenge creation |
| `/app/admin/challenges/create` | `CreateChallengeScreen` | Admin template creation (fitness + wellness) |
| `/app/admin/challenges/templates` | `ChallengeTemplatesScreen` | Admin template management hub |
| `/app/admin/challenges/templates/:id/edit` | `EditChallengeTemplateScreen` | Admin fitness template edit |
| `/app/challenges/wellness` | `WellnessTemplateGalleryScreen` | Wellness template discovery |
| `/app/challenges/wellness/:id` | `WellnessTemplateDetailScreen` | Wellness template → launches wizard |
| `/app/challenges/suggested` | `SuggestedChallengesScreen` | Fitness template → launches wizard |
| `/app/quick-actions` | `QuickActionsScreen` | FAB entry point → launches wizard |

---

## Part 3 — Every Navigation Path

### Explicit "Create Challenge" triggers

| Trigger | Source component | Destination |
|---|---|---|
| FAB "+" button | BottomNav | `/app/quick-actions` → `QuickActionsScreen` |
| "Create Challenge" button | `QuickActionsScreen` | `/app/create-challenge?groupId=<id>` → `CreateChallengeWizard` |
| "Create Challenge" button | `GroupDetailScreen` | `/app/create-challenge?groupId=<id>` → `CreateChallengeWizard` |
| "Proceed to Create" card | `SuggestedChallengesScreen` | `/app/create-challenge?templateId=<id>` → `CreateChallengeWizard` |
| "Launch as Challenge" button | `WellnessTemplateDetailScreen` | `/app/create-challenge?wellnessTemplateId=<id>` → `CreateChallengeWizard` |
| "+ New" button | `ChallengeTemplatesScreen` | `/app/admin/challenges/create` → `CreateChallengeScreen` |
| "Edit" button | `ChallengeTemplatesScreen` | `/app/admin/challenges/templates/:id/edit` → `EditChallengeTemplateScreen` |
| "Duplicate" button | `ChallengeTemplatesScreen` | Fitness: duplicates + navigates to edit. Wellness: duplicates as draft |

### Group picker logic (QuickActionsScreen)

```
User clicks "Create Challenge"
↓
0 groups → toast + navigate('/app/groups')
1 group  → navigate('/app/create-challenge?groupId=<id>') directly
>1 groups → open group picker modal → user selects → navigate with groupId
```

---

## Part 4 — Every Service Call That Creates Challenges

### Active creation calls

| File | ~Line | Call | Writes to |
|---|---|---|---|
| `CreateChallengeWizard.tsx` | 587 | `httpsCallable('createChallengeWithCreatorMembership')` | `challenges` + `challenges/{id}/members` (via Cloud Function) |
| `CreateChallengeScreen.tsx` | 359–378 | `createTemplateMutation.mutateAsync()` → `challengeTemplateService.createTemplate()` → `addDoc('challengeTemplates')` | `challengeTemplates` |
| `CreateChallengeScreen.tsx` | 305–353 | `wellnessTemplateService.createTemplate()` → `addDoc('wellnessTemplates')` | `wellnessTemplates` |
| `CreateChallengeWizard.tsx` | ~597 | `challengeTemplateService.incrementUsageCount(templateId)` | `challengeTemplates/{id}` (usageCount only) |
| `CreateChallengeWizard.tsx` | ~598 | `wellnessTemplateService.incrementUsageCount(wellnessTemplateId)` | `wellnessTemplates/{id}` (usageCount only) |
| `EditChallengeTemplateScreen.tsx` | — | `useUpdateTemplate.mutateAsync()` → `challengeTemplateService.updateTemplate()` → `updateDoc` | `challengeTemplates/{id}` |

### Defined but not called by any current UI

| File | Function | Notes |
|---|---|---|
| `src/services/challengeService.ts` | `createChallenge()` → `addDoc('challenges')` | Not called by wizard; wizard uses httpsCallable |
| `src/services/adminChallengeService.ts` | `createChallengeFromAdmin()` → `addDoc('challenges')` | Not called by current UI |

---

## Part 5 — Template Creation Flow

### Fitness template

```
Super Admin
↓
/app/admin/challenges/create (CreateChallengeScreen, templateMode = 'fitness')
↓
Fills: name, description, challenge type (collective/competitive/streak),
       activities (from exercise library), dates, donation (optional)
↓
"Save & Publish"
↓
challengeTemplateService.createTemplate(payload)
↓
addDoc('challengeTemplates', {
  ...payload,
  status: 'published',
  isPublished: true,
  version: 1,
  usageCount: 0,
  createdAt: now(),
  createdBy: userId
})
↓
invalidateQueries: 'admin-challenge-templates-all', 'suggested-challenge-templates'
↓
Template appears in SuggestedChallengesScreen
  (queries challengeTemplates where status = 'published')
↓
User clicks "Proceed to Create"
↓
navigate('/app/create-challenge?templateId=<id>')
↓
CreateChallengeWizard prefills from template (useEffect lines 166–218):
  name, description, coverImageUrl, challengeType, activities,
  engine settings (groupCumulativeTarget, requiredConsecutiveDays, etc.)
  templateApplied flag prevents re-application
↓
User customizes + launches → httpsCallable
↓
Fire-and-forget: challengeTemplateService.incrementUsageCount(templateId)
```

### Wellness template

```
Super Admin
↓
/app/admin/challenges/create (CreateChallengeScreen, templateMode = 'wellness')
↓
Fills: name, description, type, wellness activities
       (picked from wellnessActivities library), dates, difficulty
↓
"Save & Publish"
↓
wellnessTemplateService.createTemplate(payload)
↓
addDoc('wellnessTemplates', {
  category: primaryCategory (inferred from first activity),
  name, description, difficulty, type, duration, coverImage,
  activities: [...],
  benefits, guidelines, warnings (merged from activities),
  isPublished: true,
  status: 'published',
  version: 1,
  usageCount: 0,
  createdAt: now(),
  createdBy: userId,
  groupCumulativeTarget?, requiredConsecutiveDays? (optional engine fields)
})
↓
invalidateQueries: 'wellness-templates', 'admin-challenge-templates'
↓
Template appears in WellnessTemplateGalleryScreen
  (queries wellnessTemplates where isPublished = true)
↓
User navigates to /app/challenges/wellness/:id (WellnessTemplateDetailScreen)
↓
User clicks "Launch as Challenge"
↓
navigate('/app/create-challenge?wellnessTemplateId=<id>')
↓
CreateChallengeWizard prefills from wellness template (useEffect lines 220–271):
  Maps wellness template activities to activity rows
  Sets challengeCategory = 'wellness' (activates isWellnessMode)
  Prefills type, dates, engine settings
  wellnessTemplateApplied flag prevents re-application
↓
User customizes + launches → httpsCallable
↓
Fire-and-forget: wellnessTemplateService.incrementUsageCount(wellnessTemplateId)
```

### Known gap

Wellness templates have **no edit screen**. Admin must create a new draft to modify an existing wellness template. Fitness templates have `EditChallengeTemplateScreen`.

---

## Part 6 — Quick Action / FAB Creation Flow

```
User presses FAB ("+" in BottomNav)
↓
navigate('/app/quick-actions')
↓
QuickActionsScreen renders action sheet
  useMyGroups() loads user's groups
↓
User clicks "Create Challenge"
↓
0 groups  → toast("Join a group first") + navigate('/app/groups')
1 group   → navigate('/app/create-challenge?groupId=<id>')
>1 groups → open group picker modal
             user selects group
             setActiveGroupId(groupId) → local storage
             navigate('/app/create-challenge?groupId=<id>')
↓
CreateChallengeWizard mounts with groupId preselected (step 1 group auto-selected)
↓
User fills 4-step form
↓
httpsCallable('createChallengeWithCreatorMembership')
↓
Cloud Function:
  Creates challenge doc in 'challenges'
  Adds creator as member in 'challenges/{id}/members'
  If donation enabled: status = 'draft' (pending review)
  Otherwise: status = 'active'
↓
Navigate to challenge detail
```

---

## Part 7 — Import Tree (One Level Deep)

### CreateChallengeWizard

**Hooks:**
- `useCreateChallenge()` → `useChallenges.ts` → TanStack Query + `challengeService`
- `useSuggestedChallengeTemplate(templateId)` → `useChallengeTemplates.ts` → `challengeTemplateService`
- `useWellnessTemplate(wellnessTemplateId)` → `useWellnessTemplates.ts` → `wellnessTemplateService`
- `useExercises()` → `exerciseService`
- `useWellnessActivities(category, search)` → `wellnessActivityService`
- `useMyGroups()` → `groupService`
- `useAuth()` → FirebaseAuth context
- `useToast()`

**Services:**
- `challengeTemplateService.incrementUsageCount(templateId)`
- `wellnessTemplateService.incrementUsageCount(wellnessTemplateId)`
- `imageUploadService.uploadImageFile()`, validation helpers

**Firebase:**
- `getFunctions(app, 'us-central1')`
- `httpsCallable(..., 'createChallengeWithCreatorMembership')`

---

### CreateChallengeScreen

**Hooks:**
- `useCreateSuggestedChallengeTemplate()` → `useChallengeTemplates.ts` → `challengeTemplateService.createTemplate()`
- `useExercises()` → `exerciseService`
- `useWellnessActivities(category, search)` → `wellnessActivityService`
- `useAdminPermissions(uid)` → `adminAccessService`
- `useQueryClient()` → TanStack Query

**Services:**
- `wellnessTemplateService.createTemplate(data)` — called directly (no hook)
- `imageUploadService.*`

**Firebase:**
- None direct; all writes go through service layer

---

### WellnessTemplateDetailScreen

**Hooks:**
- `useWellnessTemplate(id)` → `wellnessTemplateService.getTemplate(id)`
- `useMyGroups()` → `groupService`

**Navigation:**
- `navigate('/app/create-challenge?wellnessTemplateId=<id>')` → `CreateChallengeWizard`

---

### QuickActionsScreen

**Hooks:**
- `useMyGroups()` → `groupService`
- `getStoredActiveGroupId()`, `setActiveGroupId()` → local storage helpers

**Navigation:**
- `navigate('/app/create-challenge?groupId=<id>')` → `CreateChallengeWizard`

---

## Part 8 — Duplicate Code Detection

### CreateChallengeWizard vs. CreateChallengeScreen — ~75% duplication

| Duplicated element | Wizard | Admin Screen | Severity |
|---|---|---|---|
| Form state: `name`, `description`, `coverImageUrl`, `challengeType`, `startDate`, `endDate` | ✅ | ✅ | HIGH |
| Engine state: `groupCumulativeTarget`, `autoCompleteOnGroupTarget`, `requiredConsecutiveDays`, `streakResetOnMiss` | ✅ | ✅ | HIGH |
| Donation state: `donationEnabled`, `causeName`, `causeDescription`, etc. | ✅ | ✅ | HIGH |
| Activities array + `updateActivity()`, `removeActivity()`, `addActivity()` | ✅ | ✅ | HIGH |
| Exercise picker (search, filter, select, suggestions) | ✅ | ✅ | HIGH |
| Wellness picker (category filter, search, modal open/close) | ✅ | ✅ | HIGH |
| Image upload + validation logic | ✅ | ✅ | HIGH |
| Donation block validation | Inline | Function | MEDIUM |
| `normalizeSearchTerm()` / `normalize()` (same logic, different name) | ✅ | ✅ | MEDIUM |
| Challenge type pill UI | ✅ | ✅ | LOW |
| Duration days calculation | ✅ | ✅ | LOW |

**Key differences** (what separates them):

| Aspect | CreateChallengeWizard | CreateChallengeScreen |
|---|---|---|
| UI shape | 4-step wizard with progress indicator | Flat form (desktop admin UX) |
| Save target | Live `challenges` collection via Cloud Function | `challengeTemplates` or `wellnessTemplates` via service |
| Group selection | Required (step 1) | Not required |
| Template prefill | `useSuggestedChallengeTemplate`, `useWellnessTemplate` | None |
| Wellness edit UI | No edit, no admin controls | Has template status controls (publish/archive/restore) |

---

## Part 9 — Dependency Diagram (All 7 Paths)

```
PATH 1: User — scratch creation
────────────────────────────────────────────────────────
User
↓ (FAB or GroupDetail or direct URL)
/app/create-challenge
↓
CreateChallengeWizard
  ├── useMyGroups()       → groupService       → Firestore: groups
  ├── useExercises()      → exerciseService     → Firestore: exercises
  ├── useWellnessActivities() → wellnessActivityService
  └── useAuth()           → Firebase Auth
↓
httpsCallable('createChallengeWithCreatorMembership')
↓
Cloud Function (us-central1)
↓
Firestore: challenges (1 doc)
Firestore: challenges/{id}/members (1 doc — creator)


PATH 2: User — from fitness template
────────────────────────────────────────────────────────
User
↓
SuggestedChallengesScreen
  └── useSuggestedChallengeTemplates() → challengeTemplateService
      → Firestore: challengeTemplates (query: status='published')
↓
Clicks template card → /app/create-challenge?templateId=<id>
↓
CreateChallengeWizard
  └── useSuggestedChallengeTemplate(id)
      → challengeTemplateService.getTemplateById(id)
      → Firestore: challengeTemplates/{id} (read)
  └── useEffect prefills form (lines 166–218)
↓
httpsCallable → Cloud Function
↓
Firestore: challenges + challenges/{id}/members
Firestore: challengeTemplates/{id} (usageCount +1, fire-and-forget)


PATH 3: User — from wellness template
────────────────────────────────────────────────────────
User
↓
WellnessTemplateGalleryScreen
  └── useWellnessTemplates() → wellnessTemplateService
      → Firestore: wellnessTemplates (query: isPublished=true)
↓
Clicks template → /app/challenges/wellness/:id
↓
WellnessTemplateDetailScreen
  └── useWellnessTemplate(id) → wellnessTemplateService
      → Firestore: wellnessTemplates/{id} (read)
↓
"Launch as Challenge" → /app/create-challenge?wellnessTemplateId=<id>
↓
CreateChallengeWizard
  └── useWellnessTemplate(id)
  └── useEffect prefills form (lines 220–271), sets isWellnessMode=true
↓
httpsCallable → Cloud Function
↓
Firestore: challenges + challenges/{id}/members
Firestore: wellnessTemplates/{id} (usageCount +1, fire-and-forget)


PATH 4: Admin — creates fitness template
────────────────────────────────────────────────────────
Admin
↓
ChallengeTemplatesScreen → "+ New"
↓
/app/admin/challenges/create
↓
CreateChallengeScreen (templateMode = 'fitness')
  ├── useExercises()      → exerciseService
  └── useAdminPermissions()
↓
"Save & Publish"
↓
createTemplateMutation.mutateAsync()
→ challengeTemplateService.createTemplate()
→ addDoc('challengeTemplates', { status:'published', isPublished:true, ... })
↓
invalidateQueries → 'suggested-challenge-templates' refreshes
↓
Firestore: challengeTemplates (1 new doc)


PATH 5: Admin — creates wellness template
────────────────────────────────────────────────────────
Admin
↓
/app/admin/challenges/create (templateMode = 'wellness')
↓
CreateChallengeScreen
  └── useWellnessActivities() → wellnessActivityService
↓
"Save & Publish"
↓
wellnessTemplateService.createTemplate(payload) ← direct call, no mutation hook
→ addDoc('wellnessTemplates', { status:'published', isPublished:true, ... })
↓
invalidateQueries → 'wellness-templates' refreshes
↓
Firestore: wellnessTemplates (1 new doc)


PATH 6: Admin — edits fitness template
────────────────────────────────────────────────────────
Admin
↓
ChallengeTemplatesScreen → "Edit"
↓
/app/admin/challenges/templates/:id/edit
↓
EditChallengeTemplateScreen
  └── useSuggestedChallengeTemplate(id) → reads Firestore
↓
Admin modifies → "Save"
↓
useUpdateTemplate.mutateAsync()
→ challengeTemplateService.updateTemplate(id, payload)
→ updateDoc('challengeTemplates/{id}', { ...payload, updatedAt, updatedBy })
↓
Firestore: challengeTemplates/{id} (updated)


PATH 7: FAB quick action
────────────────────────────────────────────────────────
User presses FAB (BottomNav "+")
↓
/app/quick-actions
↓
QuickActionsScreen
  └── useMyGroups() → groupService → Firestore: groups
↓
"Create Challenge" → group picker (if >1 group)
↓
/app/create-challenge?groupId=<id>
↓
[Same as PATH 1]
```

---

## Part 10 — Recommendations

### 1. Architecture map summary

The challenge creation system has **7 distinct entry points** feeding into **2 creation components** writing to **3 Firestore collections** via **2 different mechanisms** (Cloud Function vs. direct service write).

```
Entry points (7)                  Creation components (2)      Firestore (3)
─────────────────                 ───────────────────────      ─────────────
FAB → QuickActions  ─────────────┐
GroupDetail         ─────────────┤ CreateChallengeWizard ──── challenges
SuggestedChallenges ─────────────┤ (httpsCallable)             challenges/{id}/members
WellnessGallery     ─────────────┘
                                 ┌ CreateChallengeScreen ──── challengeTemplates
ChallengeTemplates "New" ────────┤ (service direct write)      wellnessTemplates
ChallengeTemplates "Edit" ───────┘
```

### 2. Duplicate component report

| Component pair | Duplication | Impact |
|---|---|---|
| `CreateChallengeWizard` vs. `CreateChallengeScreen` | **~75%** | Any fix to one must be manually replicated in the other. This is the primary architectural liability. |
| Challenge type pill UI | ~60% | Appears in multiple screens; not harmful |
| Activity picker logic (exercise + wellness) | ~50% | Duplicated in both creation components |

### 3. Active vs. dead code

**Fully active:**
- ✅ `CreateChallengeWizard` — all user creation paths
- ✅ `CreateChallengeScreen` — all admin template creation
- ✅ `EditChallengeTemplateScreen` — fitness template editing
- ✅ `ChallengeTemplatesScreen` — admin management hub
- ✅ `WellnessTemplateGalleryScreen` + `WellnessTemplateDetailScreen` — wellness discovery
- ✅ `SuggestedChallengesScreen` — fitness template discovery
- ✅ `QuickActionsScreen` — FAB entry point
- ✅ `challengeTemplateService`, `wellnessTemplateService` — all operations
- ✅ `httpsCallable('createChallengeWithCreatorMembership')` — user challenge creation

**Partially active (defined, not called by UI):**
- ⚠️ `challengeService.createChallenge()` — exists, not called by wizard (uses httpsCallable instead)
- ⚠️ `adminChallengeService.createChallengeFromAdmin()` — exists, not called by any current UI

**Missing (known gap):**
- ❌ Wellness template edit screen — admin must create a new draft to modify wellness templates

### 4. Canonical component recommendation

**`CreateChallengeWizard` is the canonical implementation.**

Reasons:
- It is the user-facing component for all live challenge creation
- It uses the Cloud Function which handles membership creation, security, and moderation in one atomic operation
- It supports template prefill from both fitness and wellness templates
- It is more battle-tested (7 entry paths) vs. `CreateChallengeScreen` (1 admin entry)
- The Cloud Function approach is correct for production; the direct `addDoc` approach in `CreateChallengeScreen` bypasses the membership creation step

All future form logic changes should be anchored in `CreateChallengeWizard` and extracted into shared hooks that `CreateChallengeScreen` can also consume.

### 5. Migration plan toward ONE unified challenge creation system

**Phase 1 — Extract shared hooks (no UI changes)**

1. Create `src/hooks/useChallengeFormState.ts`
   - Consolidate all ~25 shared `useState` calls: name, description, coverImageUrl, challengeType, startDate, endDate, activities array, groupCumulativeTarget, autoCompleteOnGroupTarget, requiredConsecutiveDays, streakResetOnMiss, donationEnabled, all donation fields
   - Include `updateActivity()`, `removeActivity()`, `addActivity()` implementations
   - Returns stable references (useCallback, useMemo where appropriate)

2. Create `src/hooks/useChallengeActivityPicker.ts`
   - Consolidate: pickerIndex, pickerSearch, pickerTier, wellnessPickerOpen, wellnessCategoryFilter, wellnessSearch
   - Encapsulate open/close/select handlers for both exercise and wellness pickers
   - Same interface regardless of fitness/wellness mode

3. Create `src/hooks/useChallengeImageUpload.ts`
   - Consolidate: coverImageUrl, coverImageUploadState, handleCoverFileSelected, handleCoverUrlChange, isValidImageUrl, isLikelyDirectImageUrl, isPersistableImageSource
   - Already partially delegated to `imageUploadService`; this hook adds React state layer

4. Update both `CreateChallengeWizard` and `CreateChallengeScreen` to import these hooks instead of duplicating state

**Phase 2 — Extract utilities**

5. Create `src/utils/challengeFormValidation.ts`
   - Export `validateDonationBlock()`, `validateActivities()`, `validateDates()`, `validateName()`
   - Unify inline validation in `CreateChallengeWizard` with function-form in `CreateChallengeScreen`

6. Create `src/utils/challengeNormalization.ts`
   - Unify `normalizeSearchTerm()` (Wizard) and `normalize()` (Admin Screen) into single export
   - Export `buildChallengePayload()` to consolidate payload construction

7. Create `src/components/ChallengeActivityPickerModal.tsx`
   - Props: `{ isOpen, mode: 'exercise' | 'wellness', onSelect, onClose, ... }`
   - Shared UI used by both creation components

**Phase 3 — Unified component (optional, after Phase 1–2 stable)**

8. Create `src/features/Challenges/CreateChallengeUnified.tsx`
   - Accepts `mode: 'user' | 'admin'`
   - Uses all extracted hooks (zero duplication)
   - Renders 4-step wizard UI when `mode='user'`; flat form when `mode='admin'`
   - On save: delegates to `httpsCallable` (user) or service mutation (admin) via injected `onSave` prop

9. Migrate admin route first (`/app/admin/challenges/create`)
   - Lower risk (smaller audience, can revert quickly)
   - Test thoroughly

10. Migrate user route (`/app/create-challenge`)
    - Retire `CreateChallengeWizard` and `CreateChallengeScreen`

**Phase 4 — Template unification (future)**

11. Create wellness template edit screen (closes known gap in admin flow)
12. Consider merging `challengeTemplates` and `wellnessTemplates` Firestore collections into one with a `mode` field discriminator (breaking backend change — coordinate separately)
13. Consider moving admin template creation to also use a Cloud Function for consistency

**Phase 5 — Cleanup**

14. Delete `challengeService.createChallenge()` or document it as internal-only
15. Delete `adminChallengeService.createChallengeFromAdmin()` or migrate any remaining callers
16. Add unit tests for extracted hooks
17. Add integration tests covering all 7 entry paths

---

## Summary Table

| Part | Key finding |
|---|---|
| 1. Components | 8 components involved; 2 primary creation UIs, 4 discovery/navigation screens, 2 admin management screens |
| 2. Routes | 8 distinct routes; 3 direct creation routes, 5 discovery/navigation |
| 3. Navigation | 7 entry points; all user paths converge on `CreateChallengeWizard`; admin paths on `CreateChallengeScreen` |
| 4. Service calls | 2 active creation mechanisms: `httpsCallable` (user) and direct service `addDoc` (admin); 2 unused creation functions exist in service layer |
| 5. Template flow | Admin → template service → `challengeTemplates` / `wellnessTemplates` → gallery → user selects → wizard prefills → `httpsCallable` → live challenge |
| 6. Quick action | FAB → QuickActionsScreen → group picker → wizard. Uses same `httpsCallable` as all user paths |
| 7. Import tree | Wizard imports 8+ hooks + 3 services + Firebase directly. Admin screen imports 5 hooks + 2 services. No shared hook layer exists today |
| 8. Duplicates | **~75% code duplication** between `CreateChallengeWizard` and `CreateChallengeScreen`. Every bug fix must be applied twice |
| 9. Dependency diagram | 7 distinct data flows documented above |
| 10. Recommendations | Extract 3 shared hooks + 2 utility modules (Phase 1–2); optionally unify into single `CreateChallengeUnified` component (Phase 3) |

---

## Architecture Health Assessment

| Aspect | Score | Notes |
|---|---|---|
| Code organization | 7/10 | Clear user vs. admin separation; routable components; but significant duplication |
| Reusability | 5/10 | Hooks pattern used correctly but form logic heavily duplicated |
| Maintainability | 5/10 | Every change requires double implementation |
| Bug surface | HIGH | Fixes to wizard do not propagate to admin screen and vice versa |
| Scalability | 6/10 | Adding new challenge type requires changes in 2–3 places |
| Dead code | LOW | Only 2 unused service functions identified |
| Missing features | 1 gap | No wellness template edit screen for admin |

**Overall: Functional but fragile.** The 75% duplication between the two creation components is the single largest risk. Phases 1–2 (hook extraction) can be completed without any user-visible changes and immediately eliminate the "fix one, break the other" problem.
