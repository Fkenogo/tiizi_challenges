# Challenge Architecture — Official Reference

**Version:** 1.0
**Date:** 2026-06-27
**Branch:** fix/p0-pre-deploy-blockers
**Source:** Phase 16R-B parity audit (`docs/reports/challenge-feature-parity-master.md`)
**Status:** Frozen — no code changes permitted during this phase

---

## Table of Contents

1. [Overview](#overview)
2. [Entry Points](#entry-points)
3. [Routes](#routes)
4. [Component Hierarchy](#component-hierarchy)
5. [Navigation Flow](#navigation-flow)
6. [Data Flow](#data-flow)
7. [Firestore Collections](#firestore-collections)
8. [Cloud Functions](#cloud-functions)
9. [Services](#services)
10. [Challenge Lifecycle](#challenge-lifecycle)
11. [Template Lifecycle](#template-lifecycle)
12. [User Lifecycle](#user-lifecycle)
13. [Wellness Lifecycle](#wellness-lifecycle)
14. [Firestore Write Map](#firestore-write-map)

---

## Overview

The challenge system has two independent creation implementations feeding three Firestore collections through two distinct write paths. All user-facing challenge creation goes through a Cloud Function. All admin template creation goes through direct service writes.

```
Users                          Admins
  │                              │
  ▼                              ▼
CreateChallengeWizard     CreateChallengeScreen
  │                         EditChallengeTemplateScreen
  │
  ▼
httpsCallable                service.createTemplate()
  │                              │
  ▼                              ▼
challenges                 challengeTemplates
challenges/{id}/members    wellnessTemplates
```

---

## Entry Points

Every path that can open a challenge creation screen.

| # | Trigger | Source Component | Destination | Notes |
|---|---|---|---|---|
| 1 | FAB "+" button | BottomNav | `/app/quick-actions` | Primary mobile entry point |
| 2 | "Create Challenge" button | QuickActionsScreen | `/app/create-challenge?groupId=<id>` | Group picker if >1 group |
| 3 | "Create Challenge" button | GroupDetailScreen | `/app/create-challenge?groupId=<id>` | Group pre-selected |
| 4 | "Use Template" → "Proceed to Create" | SuggestedChallengesScreen | `/app/create-challenge?templateId=<id>` | Fitness template prefill |
| 5 | "Adopt to Group" | WellnessTemplateDetailScreen | `/app/create-challenge?wellnessTemplateId=<id>&groupId=<id>` | Wellness template + group prefill |
| 6 | Direct URL | Browser / deep link | `/app/create-challenge` | No prefill |
| 7 | "+ New" button | ChallengeTemplatesScreen (Admin) | `/app/admin/challenges/create` | Admin template creation |
| 8 | "Edit" button | ChallengeTemplatesScreen (Admin) | `/app/admin/challenges/templates/:id/edit` | Fitness templates only |

---

## Routes

### User Routes

| URL | Component | File |
|---|---|---|
| `/app/create-challenge` | CreateChallengeWizard | `src/features/Challenges/CreateChallengeWizard.tsx` |
| `/app/create-challenge?groupId=<id>` | CreateChallengeWizard | — group preselected |
| `/app/create-challenge?templateId=<id>` | CreateChallengeWizard | — fitness template prefilled |
| `/app/create-challenge?wellnessTemplateId=<id>` | CreateChallengeWizard | — wellness template prefilled |
| `/app/create-challenge?wellnessTemplateId=<id>&groupId=<id>` | CreateChallengeWizard | — both prefilled |
| `/app/quick-actions` | QuickActionsScreen | `src/features/QuickActions/QuickActionsScreen.tsx` |
| `/app/challenges/suggested` | SuggestedChallengesScreen | `src/features/Challenges/SuggestedChallengesScreen.tsx` |
| `/app/challenges/wellness` | WellnessTemplateGalleryScreen | `src/features/Challenges/WellnessTemplateGalleryScreen.tsx` |
| `/app/challenges/wellness/:id` | WellnessTemplateDetailScreen | `src/features/Challenges/WellnessTemplateDetailScreen.tsx` |

### Admin Routes

| URL | Component | File |
|---|---|---|
| `/app/admin/challenges/create` | CreateChallengeScreen | `src/features/Admin/Challenges/CreateChallengeScreen.tsx` |
| `/app/admin/challenges/templates` | ChallengeTemplatesScreen | `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx` |
| `/app/admin/challenges/templates/:id/edit` | EditChallengeTemplateScreen | `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx` |

---

## Component Hierarchy

```mermaid
graph TD
    App["App.tsx (router)"]

    App --> UserRoutes["User Routes"]
    App --> AdminRoutes["Admin Routes"]

    UserRoutes --> QA["QuickActionsScreen\n/app/quick-actions"]
    UserRoutes --> SC["SuggestedChallengesScreen\n/app/challenges/suggested"]
    UserRoutes --> WG["WellnessTemplateGalleryScreen\n/app/challenges/wellness"]
    UserRoutes --> WD["WellnessTemplateDetailScreen\n/app/challenges/wellness/:id"]
    UserRoutes --> CW["CreateChallengeWizard\n/app/create-challenge"]

    QA -->|navigates to| CW
    SC -->|navigates to| CW
    WG -->|navigates to| WD
    WD -->|navigates to| CW

    AdminRoutes --> CT["ChallengeTemplatesScreen\n/app/admin/challenges/templates"]
    AdminRoutes --> CS["CreateChallengeScreen\n/app/admin/challenges/create"]
    AdminRoutes --> ET["EditChallengeTemplateScreen\n/app/admin/challenges/templates/:id/edit"]

    CT -->|"+ New"| CS
    CT -->|Edit| ET

    CW -->|uses| FitnessHooks["useSuggestedChallengeTemplate\nuseExercises\nuseMyGroups\nuseAuth"]
    CW -->|uses| WellnessHooks["useWellnessTemplate\nuseWellnessActivities"]
    CW -->|calls| CF["Cloud Function\ncreateChallenge\nWithCreatorMembership"]

    CS -->|uses| AdminHooks["useCreateSuggestedChallengeTemplate\nuseExercises\nuseWellnessActivities\nuseAdminPermissions"]
    CS -->|calls fitness| CTS["challengeTemplateService\n.createTemplate()"]
    CS -->|calls wellness| WTS["wellnessTemplateService\n.createTemplate()"]

    ET -->|uses| EditHooks["useSuggestedChallengeTemplate\nuseUpdateTemplate\nuseExercises"]
```

---

## Navigation Flow

```mermaid
flowchart TD
    USER(["User"])
    ADMIN(["Admin"])

    FAB["BottomNav FAB (+)"]
    GD["GroupDetailScreen"]
    CHALLENGES["ChallengesScreen"]
    CT_ADMIN["ChallengeTemplatesScreen\n(Admin)"]

    QA["QuickActionsScreen\n/app/quick-actions"]
    SC["SuggestedChallengesScreen\n/app/challenges/suggested"]
    WG["WellnessTemplateGalleryScreen\n/app/challenges/wellness"]
    WD["WellnessTemplateDetailScreen\n/app/challenges/wellness/:id"]

    CW_BASE["CreateChallengeWizard\n/app/create-challenge"]
    CW_GROUP["CreateChallengeWizard\n?groupId=X"]
    CW_TMPL["CreateChallengeWizard\n?templateId=X"]
    CW_WELL["CreateChallengeWizard\n?wellnessTemplateId=X&groupId=X"]

    CS["CreateChallengeScreen\n/app/admin/challenges/create"]
    ET["EditChallengeTemplateScreen\n/app/admin/challenges/templates/:id/edit"]

    CF["Cloud Function\ncreateChallenge\nWithCreatorMembership"]
    FS_CHALLENGE[("Firestore\nchallenges")]

    CTS_SVC["challengeTemplateService\n.createTemplate()"]
    WTS_SVC["wellnessTemplateService\n.createTemplate()"]
    FS_TMPL[("Firestore\nchallenge\nTemplates")]
    FS_WELL[("Firestore\nwellness\nTemplates")]

    USER --> FAB
    USER --> GD
    USER --> CHALLENGES
    ADMIN --> CT_ADMIN

    FAB --> QA
    GD -->|"?groupId=X"| CW_GROUP
    CHALLENGES --> SC
    CHALLENGES --> WG

    QA -->|"0 groups → join group flow"| STOP1(["End: no group"])
    QA -->|"1 group"| CW_GROUP
    QA -->|">1 groups: group picker"| CW_GROUP

    SC -->|"Use Template\n→ Proceed to Create"| CW_TMPL
    WG -->|card click| WD
    WD -->|"Adopt to Group"| CW_WELL

    CW_BASE --> CF
    CW_GROUP --> CF
    CW_TMPL --> CF
    CW_WELL --> CF

    CF --> FS_CHALLENGE

    CT_ADMIN -->|"+ New"| CS
    CT_ADMIN -->|Edit| ET

    CS -->|fitness mode| CTS_SVC --> FS_TMPL
    CS -->|wellness mode| WTS_SVC --> FS_WELL
    ET --> CTS_SVC
```

---

## Data Flow

### User Challenge Creation (all paths)

```mermaid
sequenceDiagram
    participant U as User
    participant CW as CreateChallengeWizard
    participant TS as challengeTemplateService
    participant WS as wellnessTemplateService
    participant CF as Cloud Function
    participant FS as Firestore

    U->>CW: Open /app/create-challenge[?params]

    alt templateId param present
        CW->>TS: getTemplateById(templateId)
        TS->>FS: read challengeTemplates/{id}
        FS-->>TS: template doc
        TS-->>CW: SuggestedChallengeTemplate
        CW->>CW: prefill form (useEffect, templateApplied flag)
    else wellnessTemplateId param present
        CW->>WS: getTemplate(wellnessTemplateId)
        WS->>FS: read wellnessTemplates/{id}
        FS-->>WS: wellness template doc
        WS-->>CW: WellnessTemplate
        CW->>CW: prefill form (useEffect, wellnessTemplateApplied flag)
    end

    U->>CW: Fill form (4 steps)
    U->>CW: "Launch Challenge"

    CW->>CW: validate all fields
    CW->>CF: httpsCallable('createChallengeWithCreatorMembership', payload)

    CF->>FS: addDoc('challenges', {..., status, moderationStatus})
    CF->>FS: setDoc('challenges/{id}/members/{uid}', {role:'creator'})

    alt donation enabled
        CF->>CF: set status='draft', moderationStatus='pending'
    else no donation
        CF->>CF: set status='active', moderationStatus='approved'
    end

    CF-->>CW: {challenge: {id}}
    CW->>CW: fire-and-forget incrementUsageCount (if template used)
    CW->>U: navigate to challenge detail
```

### Admin Fitness Template Creation

```mermaid
sequenceDiagram
    participant A as Admin
    participant CS as CreateChallengeScreen
    participant TS as challengeTemplateService
    participant FS as Firestore
    participant QC as TanStack QueryClient

    A->>CS: Open /app/admin/challenges/create
    A->>CS: Select templateMode = 'fitness'
    A->>CS: Fill form
    A->>CS: "Save & Publish" or "Save as Draft"

    CS->>CS: validate fields
    CS->>TS: createTemplate(payload)
    TS->>FS: addDoc('challengeTemplates', {<br/>  status: 'published'|'draft',<br/>  isPublished: true|false,<br/>  version: 1,<br/>  usageCount: 0,<br/>  createdAt, createdBy<br/>})
    FS-->>TS: templateId
    TS-->>CS: templateId

    CS->>QC: invalidateQueries(['admin-challenge-templates-all',<br/>'suggested-challenge-templates'])
    CS->>A: navigate back / show toast
```

### Admin Wellness Template Creation

```mermaid
sequenceDiagram
    participant A as Admin
    participant CS as CreateChallengeScreen
    participant WS as wellnessTemplateService
    participant FS as Firestore
    participant QC as TanStack QueryClient

    A->>CS: Open /app/admin/challenges/create
    A->>CS: Select templateMode = 'wellness'
    A->>CS: Pick wellness activities from library
    A->>CS: Fill form
    A->>CS: "Save & Publish"

    CS->>CS: merge benefits/guidelines/warnings from all activities
    CS->>WS: createTemplate(payload)
    WS->>FS: addDoc('wellnessTemplates', {<br/>  category: inferred from first activity,<br/>  status: 'published',<br/>  isPublished: true,<br/>  version: 1,<br/>  usageCount: 0,<br/>  templateSource: 'admin',<br/>  createdAt, createdBy<br/>})
    FS-->>WS: templateId
    WS-->>CS: templateId

    CS->>QC: invalidateQueries(['wellness-templates',<br/>'admin-challenge-templates'])
    CS->>A: navigate back / show toast
```

---

## Firestore Collections

### `challenges`

Written by: Cloud Function `createChallengeWithCreatorMembership`

```
challenges/{challengeId}
├── name                    string
├── description             string
├── groupId                 string
├── createdBy               string (uid)
├── coverImageUrl           string?
├── category                'fitness'|'wellness'|'fasting'|'hydration'|'sleep'
│                           |'mindfulness'|'nutrition'|'habits'|'stress'|'social'
├── challengeType           'collective'|'competitive'|'streak'
├── startDate               string (ISO date)
├── endDate                 string (ISO date)
├── durationDays            number
├── engineVersion           'v2'
├── status                  'draft'|'active'|'completed'|'expired'
├── moderationStatus        'pending'|'approved'|'needs_changes'
├── approvalRequired        boolean
├── approvalStatus          'pending'|'approved'|'rejected'
├── participantCount        number (starts at 1 — creator)
├── exerciseIds             string[]
├── activities              ActivityEntry[]
│   └── { exerciseId?, activityId?, exerciseName?, targetValue,
│          unit, frequency?, pointsPerCompletion?, instructions?,
│          benefits?, guidelines?, warnings? }
├── visibility              'public'|'private'?
├── groupVisibility         'public'|'private'?
│
│── [collective only]
├── groupCumulativeTarget   number
├── autoCompleteOnGroupTarget boolean
├── groupCurrentTotal       number (starts at 0)
│
│── [streak only]
├── requiredConsecutiveDays number
├── streakResetOnMiss       boolean
│
│── [donation only]
├── donation
│   ├── enabled             boolean
│   ├── causeName           string?
│   ├── causeDescription    string?
│   ├── targetAmountKes     number?
│   ├── contributionStartDate string?
│   ├── contributionEndDate   string?
│   ├── contributionPhoneNumber string?
│   ├── contributionCardUrl   string?
│   ├── disclaimer          string
│   ├── approvalStatus      'pending'|'approved'|'rejected'
│   └── approvalRequired    boolean
│
├── createdAt               Timestamp
└── updatedAt               Timestamp?
```

### `challenges/{challengeId}/members`

Written by: Cloud Function on join/rejoin

```
challenges/{challengeId}/members/{userId}
├── userId                  string
├── joinedAt                Timestamp
├── role                    'creator'|'member'
├── status                  'active'|'left'
│
│── [streak only]
├── currentStreak           number (0 on join)
├── longestStreak           number (0 on join)
└── lastLogDate             field deleted on join/rejoin
```

### `challengeTemplates`

Written by: `challengeTemplateService` from `CreateChallengeScreen` and `EditChallengeTemplateScreen`

```
challengeTemplates/{templateId}
├── name                    string
├── description             string
├── coverImageUrl           string?
├── category                'fitness' (default)
├── challengeType           'collective'|'competitive'|'streak'
├── durationDays            number
├── difficultyLevel         'beginner'|'intermediate'|'advanced'
├── activities              ActivityRow[]
├── status                  'draft'|'published'|'archived'|'deleted'
├── isPublished             boolean
├── version                 number (starts at 1, increments on each save)
├── usageCount              number (incremented fire-and-forget on challenge launch)
│
│── [collective only]
├── groupCumulativeTarget   number?
├── autoCompleteOnGroupTarget boolean?
│
│── [streak only]
├── requiredConsecutiveDays number?
├── streakResetOnMiss       boolean?
│
│── [donation config]
├── donationEnabled         boolean?
├── causeName               string?
├── causeDescription        string?
├── targetAmountKes         number?
├── contributionPhoneNumber string?
├── contributionCardUrl     string?
│
├── createdAt               Timestamp
├── createdBy               string (uid)
├── updatedAt               Timestamp?
├── updatedBy               string (uid)?
├── publishedAt             Timestamp?
└── archivedAt              Timestamp?
```

### `wellnessTemplates`

Written by: `wellnessTemplateService` from `CreateChallengeScreen`

```
wellnessTemplates/{templateId}
├── name                    string
├── description             string
├── category                'fasting'|'hydration'|'sleep'|'mindfulness'
│                           |'nutrition'|'habits'|'stress'|'social'
├── difficulty              'beginner'|'intermediate'|'advanced'|'expert'
├── type                    'collective'|'competitive'|'streak'
├── duration                number (days)
├── coverImage              string?
├── icon                    string?
├── color                   string?
├── templateSource          'admin'
├── activities              WellnessActivityEntry[]
│   └── { activityId, order, activityType, name, description?,
│          metricUnit, targetValue, targetType?,
│          frequency?, dailyFrequency?, pointsPerCompletion?,
│          instructions?, protocolSteps?,
│          benefits?, guidelines?, warnings? }
├── benefits                string[]  (merged from all activities)
├── guidelines              string[]  (merged from all activities)
├── warnings                string[]  (merged from all activities)
├── status                  'draft'|'published'|'archived'|'deleted'
├── isPublished             boolean
├── version                 number
├── usageCount              number
│
│── [collective only]
├── groupCumulativeTarget   number?
├── autoCompleteOnGroupTarget boolean?
│
│── [streak only]
├── requiredConsecutiveDays number?
└── streakResetOnMiss       boolean?
│
├── createdAt               Timestamp
├── createdBy               string (uid)
├── updatedAt               Timestamp?
├── updatedBy               string (uid)?
├── publishedAt             Timestamp?
└── archivedAt              Timestamp?
```

---

## Cloud Functions

### `createChallengeWithCreatorMembership`

Region: `us-central1`
Callable: Yes (requires authenticated user)
Called by: `CreateChallengeWizard` only

**Input payload:**

```typescript
{
  name: string
  description: string
  groupId: string
  createdBy: string           // uid
  coverImageUrl?: string
  challengeType: 'collective' | 'competitive' | 'streak'
  category?: string
  startDate: string
  endDate: string
  activities: ActivityEntry[]
  engineVersion: 'v2'
  groupCumulativeTarget?: number    // collective
  autoCompleteOnGroupTarget?: boolean
  requiredConsecutiveDays?: number  // streak
  streakResetOnMiss?: boolean
  donation?: DonationConfig
  templateId?: string               // triggers usageCount increment
  wellnessTemplateId?: string       // triggers usageCount increment
}
```

**Side effects:**

1. Validates creator is an active member of `groupId`
2. Validates activities are non-empty
3. For collective: validates all activities share the same unit
4. Writes `challenges/{id}` with computed `status` and `moderationStatus`
5. Writes `challenges/{id}/members/{creatorId}` with `role: 'creator'`
6. Atomically increments `groups/{groupId}.totalChallenges`
7. Sets `participantCount: 1` on the challenge doc
8. If `templateId` provided: increments `challengeTemplates/{templateId}.usageCount`
9. If `wellnessTemplateId` provided: increments `wellnessTemplates/{wellnessTemplateId}.usageCount`

**Status determination:**

```
donation.enabled === true
  → status: 'draft'
  → moderationStatus: 'pending'
  → approvalRequired: true
  → approvalStatus: 'pending'

donation.enabled === false (or absent)
  → status: 'active'
  → moderationStatus: 'approved'
  → approvalRequired: false
  → approvalStatus: 'approved'
```

---

## Services

### `challengeTemplateService`

File: `src/services/challengeTemplateService.ts`
Writes to: `challengeTemplates`

| Method | Operation | Notes |
|---|---|---|
| `createTemplate(payload)` | `addDoc` | version:1, usageCount:0, default status from isPublished |
| `updateTemplate(id, uid, payload)` | `updateDoc` | bumps version, sets updatedAt/updatedBy |
| `publishTemplate(id)` | `updateDoc` | status:'published', isPublished:true, publishedAt:now() |
| `unpublishTemplate(id)` | `updateDoc` | status:'draft', isPublished:false |
| `archiveTemplate(id)` | `updateDoc` | status:'archived', isPublished:false, archivedAt:now() |
| `restoreTemplate(id)` | `updateDoc` | status:'draft', isPublished:false, clears archivedAt |
| `deleteTemplate(id)` | `updateDoc` | status:'deleted', soft delete |
| `duplicateTemplate(id)` | `addDoc` | name+"(Copy)", status:'draft', version:1, usageCount:0 |
| `incrementUsageCount(id)` | `updateDoc` | usageCount+1, fire-and-forget |
| `getPublishedTemplates(category)` | `getDocs` | query: status='published' |
| `getTemplateById(id)` | `getDoc` | single doc read |
| `getAllTemplatesAdmin()` | `getDocs` | query: status!='deleted' |

### `wellnessTemplateService`

File: `src/services/wellnessTemplateService.ts`
Writes to: `wellnessTemplates`

| Method | Operation | Notes |
|---|---|---|
| `createTemplate(data)` | `addDoc` | merges benefits/guidelines/warnings from activities, templateSource:'admin' |
| `updateTemplate(id, uid, payload)` | `updateDoc` | same pattern as challengeTemplateService |
| `publishTemplate(id)` | `updateDoc` | same lifecycle pattern |
| `unpublishTemplate(id)` | `updateDoc` | — |
| `archiveTemplate(id)` | `updateDoc` | — |
| `restoreTemplate(id)` | `updateDoc` | — |
| `deleteTemplate(id)` | `updateDoc` | soft delete |
| `duplicateTemplate(id)` | `addDoc` | name+"(Copy)", status:'draft', version:1, usageCount:0 |
| `incrementUsageCount(id)` | `updateDoc` | usageCount+1, fire-and-forget |
| `getPublishedTemplates(filters)` | `getDocs` | query: isPublished=true, optional category/difficulty |
| `getTemplate(id)` | `getDoc` | single doc read |
| `getAllTemplatesAdmin()` | `getDocs` | query: status!='deleted' |

**Category validation:** If parsed category is not in the allowed set, defaults to `'habits'`.
**Difficulty validation:** If parsed difficulty is not in the allowed set, defaults to `'beginner'`.
**Type validation:** Falls back to `'streak'` if invalid.

### `challengeService`

File: `src/services/challengeService.ts`
Writes to: `challenges`

> ⚠️ `createChallenge()` is defined but **not called by any current UI**. The Wizard uses the Cloud Function instead. Do not call this method from new UI code.

| Method | Status | Notes |
|---|---|---|
| `createChallenge(input)` | ⚠️ Unused by UI | Bypasses Cloud Function; no membership creation |
| `joinChallenge(challengeId, userId)` | Active | Validates group membership, creates member doc |
| `leaveChallenge(challengeId, userId)` | Active | Sets member status: 'left', decrements participantCount |
| `getChallengesByGroup(groupId)` | Active | Used by GroupDetailScreen |
| `getChallengeById(id)` | Active | — |

### `adminChallengeService`

File: `src/services/adminChallengeService.ts`

> ⚠️ `createChallengeFromAdmin()` is defined but **not called by any current UI**. Dead code.

---

## Challenge Lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft : donation enabled on creation
    [*] --> active : no donation on creation

    draft --> active : admin approves donation
    draft --> rejected : admin rejects donation

    active --> completed : end date reached OR group target hit (collective, auto-complete on)
    active --> expired : end date passed with no completion

    completed --> [*]
    expired --> [*]
    rejected --> [*]

    note right of draft
        moderationStatus: pending
        approvalStatus: pending
        Not visible to members
    end note

    note right of active
        moderationStatus: approved
        Visible and joinable
    end note

    note right of completed
        Leaderboard frozen
        No new joins
    end note
```

### Status Field Values

| `status` | `moderationStatus` | `approvalStatus` | Visible to members |
|---|---|---|---|
| `draft` | `pending` | `pending` | No |
| `active` | `approved` | `approved` | Yes |
| `completed` | `approved` | `approved` | Yes (read-only) |
| `expired` | `approved` | `approved` | Yes (read-only) |

### Collective Auto-Completion

When `autoCompleteOnGroupTarget = true`:
- Engine monitors `groupCurrentTotal`
- When `groupCurrentTotal >= groupCumulativeTarget`: status → `completed`
- All members marked complete simultaneously

---

## Template Lifecycle

```mermaid
stateDiagram-v2
    [*] --> draft : createTemplate() with isPublished=false

    draft --> published : publishTemplate()
    draft --> deleted : deleteTemplate()

    published --> draft : unpublishTemplate()
    published --> archived : archiveTemplate()
    published --> deleted : deleteTemplate()

    archived --> draft : restoreTemplate()
    archived --> deleted : deleteTemplate()

    deleted --> [*]

    note right of draft
        isPublished: false
        Not visible in user galleries
        Editable
    end note

    note right of published
        isPublished: true
        publishedAt: timestamp
        Visible in SuggestedChallenges
        or WellnessTemplateGallery
    end note

    note right of archived
        isPublished: false
        archivedAt: timestamp
        Hidden from users
        Not editable via UI
    end note

    note right of deleted
        isPublished: false
        Soft delete only
        Excluded from all queries
        Cannot be restored
    end note
```

### Template Version Lifecycle

Every call to `updateTemplate()` increments `version` by 1. Versions are write-only — there is no rollback to a prior version. The UI displays:

> "Version {N} → saving will create version {N+1}"
> "Editing this template does not modify any challenges already created from it."

### usageCount

`usageCount` is incremented fire-and-forget (non-blocking) immediately after a successful challenge launch from `CreateChallengeWizard`. The counter is informational only — it does not gate any functionality.

---

## User Lifecycle

```mermaid
stateDiagram-v2
    [*] --> notJoined : challenge exists

    notJoined --> member : joinChallenge()
    member --> left : leaveChallenge()
    left --> member : rejoinChallenge()

    member --> completed : challenge completes while member
    member --> expired : challenge expires while member

    note right of notJoined
        No member doc exists
    end note

    note right of member
        member doc: status='active'
        participantCount incremented
        Streak fields reset on join
    end note

    note right of left
        member doc: status='left'
        participantCount decremented
    end note
```

### Member Document on Join/Rejoin

```
challenges/{id}/members/{uid}:
  userId:         uid
  joinedAt:       Timestamp
  role:           'creator' | 'member'
  status:         'active'

  [streak challenges only]
  currentStreak:  0         ← reset on every join/rejoin
  longestStreak:  0         ← reset on every join/rejoin
  lastLogDate:    (deleted) ← deleteField() on join/rejoin
```

### Creator vs Member

The creator is automatically added as a member by the Cloud Function with `role: 'creator'`. There is no functional difference between creator and member in the current engine — `role` is metadata only.

---

## Wellness Lifecycle

```mermaid
flowchart TD
    ADMIN(["Admin"])
    CS["CreateChallengeScreen\n(wellness mode)"]
    WTS[("wellnessTemplates\n(Firestore)")]

    WG["WellnessTemplateGalleryScreen"]
    WD["WellnessTemplateDetailScreen"]
    CW["CreateChallengeWizard\n?wellnessTemplateId=X&groupId=Y"]
    CF["Cloud Function\ncreateChallenge\nWithCreatorMembership"]
    CHALLENGE[("challenges\n(Firestore)")]

    ADMIN -->|"Select wellness mode\nFill form\nSave & Publish"| CS
    CS -->|"wellnessTemplateService\n.createTemplate()"| WTS

    USER(["User"]) -->|browse| WG
    WG -->|"query isPublished=true"| WTS
    WTS -->|template docs| WG
    WG -->|card click| WD
    WD -->|"useWellnessTemplate(id)"| WTS
    WTS -->|single doc| WD
    WD -->|"Select group\nAdopt to Group"| CW
    CW -->|"useWellnessTemplate(id)\nfor prefill"| WTS
    CW -->|prefills form| CW
    CW -->|"Launch Challenge\nhttpsCallable"| CF
    CF -->|"write challenge\nwith wellness activities"| CHALLENGE
    CF -->|"fire-and-forget\nincrementUsageCount"| WTS

    style ADMIN fill:#f5a623,color:#000
    style USER fill:#4a90e2,color:#fff
```

### Wellness Template → Challenge Activity Mapping

When a wellness template is applied to the Wizard (lines 220–271 of `CreateChallengeWizard.tsx`):

```
WellnessTemplate.activities[i]
  activityId        → ActivityRow.activityId
  name              → ActivityRow.query (display name)
  metricUnit        → ActivityRow.unit
  targetValue       → ActivityRow.targetValue (as string)
  frequency         → ActivityRow.frequency
  instructions[]    → ActivityRow.instructions
  protocolSteps[]   → ActivityRow.protocolSteps
  benefits[]        → ActivityRow.benefits
  guidelines[]      → ActivityRow.guidelines
  warnings[]        → ActivityRow.warnings

WellnessTemplate.type → challengeType ('collective'|'competitive'|'streak')
WellnessTemplate.category → challengeCategory (activates isWellnessMode)
WellnessTemplate.groupCumulativeTarget → groupCumulativeTarget
WellnessTemplate.requiredConsecutiveDays → requiredConsecutiveDays
WellnessTemplate.streakResetOnMiss → streakResetOnMiss
WellnessTemplate.autoCompleteOnGroupTarget → autoCompleteOnGroupTarget
```

### Wellness Mode Flag

`isWellnessMode = challengeCategory !== 'fitness'`

When `true`:
- Activity picker opens `WellnessPickerModal` instead of exercise picker
- Unit field changes from fixed select to free-text input
- Frequency field becomes visible
- Activity search placeholder changes to "Search wellness activities"
- Browse button label changes to "Browse wellness activity library"
- Cloud Function receives wellness `activityId` fields instead of `exerciseId`

---

## Firestore Write Map

```mermaid
flowchart LR
    CW["CreateChallengeWizard"]
    CS["CreateChallengeScreen"]
    ET["EditChallengeTemplateScreen"]
    CTS["ChallengeTemplatesScreen\n(action buttons)"]
    CF["Cloud Function"]

    FS_C[("challenges")]
    FS_M[("challenges\n/{id}/members")]
    FS_CT[("challengeTemplates")]
    FS_WT[("wellnessTemplates")]

    CW -->|"httpsCallable only\n(never direct write)"| CF
    CF -->|addDoc| FS_C
    CF -->|setDoc| FS_M
    CW -->|"incrementUsageCount\n(fire-and-forget)"| FS_CT
    CW -->|"incrementUsageCount\n(fire-and-forget)"| FS_WT

    CS -->|"fitness mode\naddDoc"| FS_CT
    CS -->|"wellness mode\naddDoc"| FS_WT

    ET -->|updateDoc| FS_CT

    CTS -->|"publish/unpublish\narchive/restore\ndelete/duplicate\nupdateDoc or addDoc"| FS_CT
    CTS -->|"same operations\nfor wellness"| FS_WT

    style CF fill:#e74c3c,color:#fff
    style FS_C fill:#27ae60,color:#fff
    style FS_M fill:#27ae60,color:#fff
    style FS_CT fill:#2980b9,color:#fff
    style FS_WT fill:#8e44ad,color:#fff
```

### Write Permission Summary

| Collection | Who can write | How |
|---|---|---|
| `challenges` | Cloud Function only (on behalf of authenticated user) | `createChallengeWithCreatorMembership` |
| `challenges/{id}/members` | Cloud Function only | Same callable |
| `challengeTemplates` | Admin UI only | `challengeTemplateService` direct Firestore calls |
| `wellnessTemplates` | Admin UI only | `wellnessTemplateService` direct Firestore calls |

No component writes to `challenges` directly. The Cloud Function is the sole write path for live challenges.

---

## Query Keys (TanStack Query)

| Key | Data | Stale Time |
|---|---|---|
| `'suggested-challenge-templates'` | Published fitness templates | 60s |
| `'admin-challenge-templates-all'` | All non-deleted fitness templates | 30s |
| `'admin-challenge-templates'` | Admin fitness templates | — (invalidated on mutation) |
| `'wellness-templates'` | Published wellness templates (with filters) | 2 min |
| `'admin-wellness-templates-all'` | All non-deleted wellness templates | 30s |

Mutations invalidate their related query keys on success. `useCreateSuggestedChallengeTemplate` invalidates both `'admin-challenge-templates-all'` and `'suggested-challenge-templates'` so new templates appear immediately in both admin and user views.

---

## Known Gaps (do not fix in this phase)

| Gap | Location | Severity |
|---|---|---|
| Mixed-unit validation is silent | All creation UIs | HIGH — service rejects but UI gives no warning |
| End-date-before-start not enforced | Admin Create | MEDIUM |
| Wellness template has no edit screen | Admin | MEDIUM |
| Description 8-char minimum not enforced | Admin Create, Admin Edit | MEDIUM |
| Difficulty field missing from Admin Create | Admin Create | LOW |
| File-too-large image warning missing | Admin Create, Admin Edit | LOW |
| `challengeService.createChallenge()` unused | challengeService | LOW — dead code |
| `adminChallengeService.createChallengeFromAdmin()` unused | adminChallengeService | LOW — dead code |

---

*This document was generated from the Phase 16R-B parity audit and reflects the codebase as of 2026-06-27. Update this document before implementing any structural change to the challenge creation system.*
