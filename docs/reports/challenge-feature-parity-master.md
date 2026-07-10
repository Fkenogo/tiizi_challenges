# Challenge Feature Parity Master — Single Source of Truth

**Date:** 2026-06-27
**Branch:** fix/p0-pre-deploy-blockers
**Phase:** 16R-B — Functional Audit (No Code Changes)
**Status:** Definitive specification for all future implementation

---

## How to read this document

- **User Wizard** = `src/features/Challenges/CreateChallengeWizard.tsx`
- **Admin Create** = `src/features/Admin/Challenges/CreateChallengeScreen.tsx`
- **Admin Edit** = `src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx`
- ✅ = Present and correct
- ⚠️ = Present but differs from canonical
- ❌ = Absent
- — = Not applicable to this component

---

## Section 1 — General Fields

### 1.1 Master Comparison Table

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Challenge Name | ✅ label "CHALLENGE NAME", placeholder "e.g. 30 Day Shred" | ✅ label "CHALLENGE NAME", placeholder "e.g. 30 Day Shred" | ✅ label "TEMPLATE NAME", placeholder "e.g. 30 Day Shred" | Label "CHALLENGE NAME". Placeholder "e.g. 30 Day Shred". Required. |
| Description | ✅ label "CHALLENGE DESCRIPTION", min 8 chars | ✅ label "CHALLENGE DESCRIPTION", no min enforced in UI | ✅ label "DESCRIPTION", no min enforced | Required, min 8 characters enforced everywhere |
| Cover Image | ✅ full (file upload + URL paste + preview + size warning) | ✅ full (file upload + URL paste + preview) | ✅ file upload only, no URL paste | URL paste should exist in all three. Preview and size warning in all three. |
| Group Selection | ✅ dropdown, step 1 | ❌ not applicable (templates have no group) | — | Templates do not have group selection — correct |
| Template Mode (Fitness / Wellness) | ✅ two-pill toggle added in 16R-A | ✅ two-pill toggle "Fitness" / "Wellness" | ❌ fitness only, no mode toggle | Both Wizard and Admin Create: two-pill toggle. Edit: fitness only is acceptable (wellness has no edit screen) |
| Challenge Type (Collective / Competitive / Streak) | ✅ three pills with descriptions | ✅ three buttons, no descriptions shown inline | ✅ three buttons, no descriptions | All three: pills + inline description box beneath selection |
| Visibility | ❌ not present | ❌ not present | ❌ not present | Future field — not required now |
| Difficulty | ❌ not present | ❌ not present | ✅ select: Beginner / Intermediate / Advanced | Should be present in Admin Create. Currently missing. |
| Tags | ❌ | ❌ | ❌ | Not implemented — not required now |
| Category | ✅ derived from mode toggle (fitness / wellness) | ✅ derived from templateMode | ❌ no category field | Category is derived, not directly editable — correct |
| Duration (days) | ❌ not a direct field; computed from start/end dates | ❌ computed from dates | ✅ explicit "DURATION (DAYS)" number input | Duration should be computed from dates everywhere. Edit template has no dates so uses explicit days — acceptable. |
| Version Info | ❌ | ❌ | ✅ "Version N → saving will create version N+1" | Version display is Edit-only — correct |
| Usage Count | ❌ | ❌ | ✅ "Usage: N challenge(s) created" | Admin Edit only — correct |

---

## Section 2 — Fitness Mode (Exercise Picker)

### 2.1 Master Comparison Table

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Exercise search input | ✅ placeholder "Search activities (e.g. Pushups)" | ✅ text input with datalist | ✅ text input | Consistent label and placeholder across all |
| Live autocomplete suggestions | ✅ dropdown suggestion list while typing | ⚠️ datalist (browser-native, less control) | ⚠️ datalist | Use dropdown suggestion list (Wizard pattern) in all components |
| Browse exercise library button | ✅ "Browse exercise library" opens full picker modal | ✅ picker modal exists | ✅ picker modal exists | Consistent button label and modal pattern |
| Exercise picker — search within modal | ✅ | ✅ | ✅ | ✅ |
| Exercise picker — tier / category filter | ✅ pickerTier filter ("All" default) | ⚠️ unclear if tier filter present | ⚠️ unclear | Tier filter should be present in all |
| Add activity row | ✅ "Add Activity" button | ✅ | ✅ | ✅ |
| Remove activity row | ✅ × button per row | ✅ | ✅ | ✅ |
| Target value | ✅ number input, min 0, placeholder "0", label "Target Value" | ✅ | ✅ | ✅ label "TARGET VALUE", min 0 |
| Unit — fitness | ✅ select: Reps / Seconds / Minutes / Km / Kg | ✅ same options | ✅ same options | Standard set: Reps / Seconds / Minutes / Km / Kg |
| Frequency — fitness | ❌ not present for fitness activities | ❌ | ❌ | Frequency not applicable to fitness activities — correct |
| Points | ❌ label only: "Auto-calculated based on challenge target" | ❌ | ❌ | Auto-calculated — no input needed |
| Target type (daily / cumulative) | ❌ not exposed in UI | ❌ | ❌ | Not exposed — defaults handled by engine |
| Mixed-unit validation (collective) | ❌ UI does not warn | ❌ | ❌ | Validation exists in service layer. UI should warn when collective + mixed units detected. |
| Minimum activities | ✅ "Add at least one activity." | ✅ implied | ✅ implied | Explicit validation message required in all |

---

## Section 3 — Wellness Mode (Wellness Activity Picker)

### 3.1 Master Comparison Table

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Wellness picker modal | ✅ wellnessPickerOpen state | ✅ wellnessPickerOpen state | ❌ not present | Edit template does not support wellness — acceptable gap (no wellness edit screen exists) |
| Wellness category filter | ✅ wellnessCategoryFilter state | ✅ wellnessCategoryFilter: 'all' \| category | ❌ | Both creation screens: category filter present |
| Wellness search | ✅ placeholder "Search wellness activities" | ✅ | ❌ | Both creation screens: search present |
| Browse wellness button | ✅ "Browse wellness activity library" | ✅ | ❌ | Consistent label across Wizard and Admin Create |
| Unit — wellness | ✅ free-text input, placeholder "hours / ml / servings" | ✅ | ❌ | Free-text for wellness (not a fixed set) |
| Frequency — wellness | ✅ select: Daily / Weekly / 2x/week / 3x/week / 5x/week / Custom | ✅ | ❌ | Standard frequency set, same options in both |
| Points — wellness | ✅ label "Auto-calculated based on challenge target" | ✅ | ❌ | Auto-calculated |
| Target value — wellness | ✅ number input | ✅ | ❌ | ✅ |
| Multiple activities | ✅ multiple rows supported | ✅ | ❌ | Both: multiple wellness activities supported |
| Activity description | ✅ displayed from activity metadata | ✅ | ❌ | Displayed read-only from library data |
| Benefits | ✅ displayed read-only per activity | ✅ merged and stored on template | ❌ | Benefits sourced from activity library, merged at template creation |
| Warnings | ✅ displayed | ✅ merged | ❌ | Amber/warning styling |
| Guidelines | ✅ displayed | ✅ merged | ❌ | Displayed read-only |
| Wellness category on saved challenge | ✅ challengeCategory set to 'wellness' | ✅ category field set from first activity | ❌ | Category must reflect wellness mode |

---

## Section 4 — Challenge Types

### 4.1 Collective

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Section heading | ✅ "Collective Settings" | ⚠️ no explicit heading visible in audit | ✅ implied | Heading: "Collective Settings" |
| Type pill / button label | ✅ "Collective" (uppercase) | ✅ "Collective" | ✅ "Collective" | "Collective" |
| Inline description | ✅ "Everyone contributes to a shared group target. The challenge completes when the group reaches the total." | ❌ no inline description box | ❌ | Description box beneath type pills in all components |
| Group Cumulative Target field label | ✅ "GROUP CUMULATIVE TARGET" | ✅ "GROUP CUMULATIVE TARGET" | ✅ "GROUP CUMULATIVE TARGET" | ✅ consistent |
| Group Cumulative Target help text | ✅ "Total units the whole group must log together (e.g. 50 000 kg, 1 000 km)." | ⚠️ "Total units the whole group must reach together (e.g. 10,000 reps)" | ❌ no help text | Canonical: "Total units the whole group must log together (e.g. 50 000 kg, 1 000 km)." |
| Group Cumulative Target placeholder | ✅ "e.g. 50000" | ⚠️ "e.g. 10000" | ✅ "e.g. 10000" | "e.g. 50000" |
| Group Cumulative Target validation | ✅ "Set a group cumulative target for this collective challenge." | ✅ implied | ✅ implied | Required > 0 |
| Auto-complete toggle label | ✅ "Auto-complete when target is reached" | ⚠️ "Auto-complete on target" | ⚠️ "Auto-complete on target" | Canonical: "Auto-complete when target is reached" |
| Auto-complete toggle description | ✅ "Mark all members complete the moment the group total hits the target." | ⚠️ "Mark challenge completed when group total is reached" | ❌ no description | Canonical: "Mark all members complete the moment the group total hits the target." |
| Auto-complete default | ✅ true | ✅ true | ✅ true | true |
| Mixed-unit warning | ❌ | ❌ | ❌ | Should warn when mixed units detected across activities |

### 4.2 Competitive

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Type pill / button label | ✅ "Competitive" | ✅ "Competitive" | ✅ "Competitive" | "Competitive" |
| Inline description | ✅ "Members compete individually. Each person tracks their own cumulative progress toward a personal target." | ❌ | ❌ | Description box beneath type pills in all components |
| Configuration section | ✅ step 2 section visible but no extra fields for competitive | ✅ | ✅ | No engine-specific fields for competitive — correct (per-activity targets drive it) |
| Step label (Wizard) | ✅ "Configure" | — | — | "Configure" |

### 4.3 Streak

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Type pill / button label | ✅ "Streak" | ✅ "Streak" | ✅ "Streak" | "Streak" |
| Inline description | ✅ "Members must log activity on consecutive days. Completing the required streak wins the challenge." | ❌ | ❌ | Description box beneath type pills in all components |
| Section heading | ✅ "Streak Settings" | ⚠️ no heading | ✅ implied | Heading: "Streak Settings" |
| Required Consecutive Days label | ✅ "REQUIRED CONSECUTIVE DAYS" | ✅ "REQUIRED CONSECUTIVE DAYS" | ✅ "REQUIRED CONSECUTIVE DAYS" | ✅ consistent |
| Required Consecutive Days help text | ✅ "How many days in a row a member must log to win this challenge." | ⚠️ "Number of consecutive days each member must log to complete the challenge" | ❌ no help text | Canonical: "How many days in a row a member must log to win this challenge." |
| Required Consecutive Days placeholder | ✅ "e.g. 7" | ⚠️ "e.g. 30" | ⚠️ "e.g. 30" | "e.g. 7" |
| Required Consecutive Days validation | ✅ "Set the required consecutive days for this streak challenge." | ✅ implied | ✅ implied | Required > 0 |
| Streak Reset toggle label | ✅ "Reset streak on missed day" | ⚠️ "Streak resets on missed day" | ⚠️ "Streak resets on missed day" | Canonical: "Reset streak on missed day" |
| Streak Reset toggle description | ✅ "If off, a missed day pauses the streak without resetting it." | ⚠️ "When off, missed days pause the streak rather than resetting it" | ❌ no description | Canonical: "If off, a missed day pauses the streak without resetting it." |
| Streak Reset default | ✅ true | ✅ true | ✅ true | true |
| Step label (Wizard) | ✅ "Frequency" | — | — | "Frequency" |

---

## Section 5 — Timeline

### 5.1 Master Comparison Table

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Start Date field | ✅ type="date", label "START DATE", calendar icon | ✅ type="date", calendar icon | ❌ not present (uses Duration Days instead) | Date inputs in creation flows. Duration Days in edit (no real dates on templates). |
| End Date field | ✅ type="date", label "END DATE", calendar icon | ✅ type="date", calendar icon | ❌ | Same as above |
| Duration display | ✅ computed: "{N} day(s)" or "Select both dates to calculate challenge duration." | ❌ no computed duration display | ✅ explicit "DURATION (DAYS)" input, default 30 | Wizard and Admin Create: computed display below date fields. Admin Edit: explicit input. |
| Start/End validation — both required | ✅ "Set start and end dates." | ❌ no explicit step validation (flat form) | — | Both dates required |
| End after start validation | ✅ "End date must be after start date." | ❌ not enforced in UI | — | Must enforce in all creation flows |
| Minimum duration | ❌ no minimum enforced | ❌ | ❌ | Service default is 1 day. UI should enforce minimum 1 day. |
| Maximum duration | ❌ no maximum | ❌ | ❌ | No enforced maximum — correct |
| Default duration (service) | — | — | ✅ 30 days default | Service defaults to 14 days when no dates provided |
| Challenge Duration label | ✅ "Challenge Duration" | ❌ no label | — | Label "CHALLENGE DURATION" |

---

## Section 6 — Donation

### 6.1 Master Comparison Table

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Donation toggle | ✅ "Fitness + Cause" toggle | ✅ donation section exists | ❌ no donation fields | Donation not on templates — Admin Edit exclusion is correct |
| Toggle label | ✅ "Fitness + Cause" | ⚠️ label unclear from audit | — | Canonical toggle label: "Fitness + Cause" |
| Cause Name | ✅ label "CAUSE NAME", placeholder "e.g. Community Health Fund" | ✅ same | — | ✅ consistent |
| Cause Description | ✅ label "CAUSE DESCRIPTION", placeholder "Describe the cause and expected impact" | ✅ same | — | ✅ consistent |
| Target Contribution field label | ✅ "TARGET CONTRIBUTION (KES, OPTIONAL)" | ✅ "TARGET CONTRIBUTION (KES, OPTIONAL)" | — | ✅ consistent |
| Contribution Start Date | ✅ label "CONTRIBUTION START" | ✅ | — | ✅ |
| Contribution End Date | ✅ label "CONTRIBUTION END" | ✅ | — | ✅ |
| Mobile Number | ✅ label "DONATE HERE: MOBILE NUMBER", placeholder "e.g. +2547XXXXXXXX" | ✅ same | — | ✅ consistent |
| Card Link | ✅ label "DONATE HERE: CARD LINK (OPTIONAL)", placeholder "https://..." | ✅ same | — | ✅ consistent |
| Disclaimer text — Wizard | ✅ "Tiizi does not hold or manage funds. Contributions are coordinated by the group. Donation-enabled challenges require platform review before going active." | — | — | — |
| Disclaimer text — Admin | — | ✅ "Tiizi does not hold or manage funds. Contributions are coordinated by the group. Donation-enabled challenges require super admin approval before going active." | — | — |
| Disclaimer canonical | — | — | — | "Tiizi does not hold or manage funds. Contributions are coordinated by the group. Donation-enabled challenges require platform review before going active." |
| Donation validation — cause fields | ✅ "Add cause name and description for Fitness + Cause." | ✅ "Add cause name and description for Fitness + Cause." | — | ✅ identical — correct |
| Donation validation — contribution channel | ✅ "Provide a mobile number or card link for contributions." | ⚠️ "Add at least one contribution channel (phone/card URL)." | — | Canonical: "Provide a mobile number or card link for contributions." |
| Challenge status on donation-enabled | ✅ status: 'draft', moderationStatus: 'pending' (set in service/Cloud Function) | ✅ template status: 'draft' | — | Donation-enabled challenges always start as draft pending platform review |
| Template donation support | — | ✅ donation fields on templates | — | Templates can have donation config that prefills the Wizard |
| Approval flow | ✅ handled by Cloud Function | — | — | Cloud Function sets approvalRequired, approvalStatus on write |

---

## Section 7 — Images

### 7.1 Master Comparison Table

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| File upload button | ✅ "Choose Image", triggers hidden file input | ✅ same pattern | ✅ same | "Choose Image" button |
| Upload state label | ✅ "Uploading image..." during upload | ✅ "Uploading image..." | ✅ | ✅ consistent |
| URL paste input | ✅ input, placeholder "Paste image URL" | ✅ input | ❌ not present | URL paste input in all three |
| Preview after selection | ✅ `<img>` preview below controls | ✅ | ✅ | ✅ |
| Preview size | ✅ `h-28 w-full object-cover` | ✅ same | ✅ | ✅ consistent |
| Image removal | ❌ no explicit remove button (replacing clears) | ❌ | ❌ | No remove button — acceptable. Replacing clears previous. |
| URL validation — http/https | ✅ "Image URL should start with http:// or https://" | ✅ "Image URL should start with http:// or https://" | ❌ no URL input so N/A | ✅ |
| Non-direct URL warning — Wizard | ✅ "This looks like a page/album link. Use a direct image URL so the cover can render correctly." | — | — | — |
| Non-direct URL warning — Admin | — | ✅ "Album/page URL accepted (e.g. imgbb album links). Preview may not render unless the URL is a direct image file." | — | — |
| Non-direct URL warning canonical | — | — | — | Canonical: "This looks like a page/album link. Use a direct image URL so the cover can render correctly." (Wizard is more restrictive — correct for user-facing) |
| File too large warning | ✅ "Selected image is too large. Use a smaller file or paste an image URL." | ❌ not present | ❌ | Should be present in all |
| Upload success toast | ✅ "Challenge cover uploaded." | ✅ "Challenge cover uploaded." | ⚠️ "Cover uploaded." | Canonical: "Challenge cover uploaded." |
| Upload error toast | ✅ "Could not read selected image." | ✅ "Could not read selected image." | ✅ "Could not read selected image." | ✅ consistent |
| Local preview toast | ✅ "Using local image preview. Upload will depend on storage permissions." | ⚠️ "Using local image preview. Upload depends on storage permissions." | ❌ not present | Canonical: "Using local image preview. Upload will depend on storage permissions." |

---

## Section 8 — Template Support

### 8.1 Master Comparison Table

| Feature | User Wizard | Admin Create | Admin Edit | Canonical behaviour |
|---|---|---|---|---|
| Prefill from fitness template | ✅ `?templateId=<id>` param, useEffect lines 166–218 | — | — | Prefill: name, description, coverImageUrl, challengeType, activities, engine fields. templateApplied flag prevents re-run. |
| Prefill from wellness template | ✅ `?wellnessTemplateId=<id>` param, useEffect lines 220–271 | — | — | Prefill: wellness activities mapped to activity rows, challengeCategory='wellness', engine fields. wellnessTemplateApplied flag. |
| Template applied banner | ✅ shown when `template` exists | — | — | Show template name and source |
| Usage count increment | ✅ fire-and-forget on launch (fitness + wellness) | — | — | Increment on successful challenge launch only |
| Fitness template creation | — | ✅ createTemplateMutation → challengeTemplateService.createTemplate() → `challengeTemplates` | — | status: draft or published |
| Wellness template creation | — | ✅ wellnessTemplateService.createTemplate() → `wellnessTemplates` | — | Merges benefits/guidelines/warnings from activities |
| Template status: draft | — | ✅ "Save as Draft" | ✅ save as draft | status: 'draft', isPublished: false |
| Template status: publish | — | ✅ "Save & Publish" | ✅ "Save & Publish" | status: 'published', isPublished: true, publishedAt: now() |
| Template versioning | — | ✅ version: 1 on create | ✅ version: template.version + 1 on save | Immutable bump on each save |
| Template duplication | — | — via ChallengeTemplatesScreen | — via ChallengeTemplatesScreen | Copy with "(Copy)" suffix, status 'draft', version 1, usageCount 0 |
| Template archiving | — | — via ChallengeTemplatesScreen | — | status: 'archived', isPublished: false, archivedAt: now() |
| Template restore | — | — via ChallengeTemplatesScreen | — | status: 'draft', isPublished: false, archivedAt cleared |
| Template soft delete | — | — via ChallengeTemplatesScreen | — | status: 'deleted', isPublished: false |
| Fitness template editing | — | — | ✅ full form | Challenge templates already created from this are NOT affected (stated in UI) |
| Wellness template editing | — | — | ❌ no wellness edit screen | **Known gap.** Admin must create new draft to modify wellness template. |
| Difficulty on fitness template | — | ❌ not present in Admin Create | ✅ Beginner / Intermediate / Advanced | Missing from Admin Create. Should be present. |

---

## Section 9 — Navigation Map

### 9.1 Route Table

| URL | Component | Reachable from |
|---|---|---|
| `/app/create-challenge` | `CreateChallengeWizard` | QuickActionsScreen, GroupDetailScreen, SuggestedChallengesScreen, WellnessTemplateDetailScreen, direct URL |
| `/app/create-challenge?groupId=<id>` | `CreateChallengeWizard` (group preselected) | QuickActionsScreen, GroupDetailScreen |
| `/app/create-challenge?templateId=<id>` | `CreateChallengeWizard` (fitness template prefilled) | SuggestedChallengesScreen |
| `/app/create-challenge?wellnessTemplateId=<id>` | `CreateChallengeWizard` (wellness template prefilled) | WellnessTemplateDetailScreen |
| `/app/create-challenge?wellnessTemplateId=<id>&groupId=<id>` | `CreateChallengeWizard` (both prefilled) | WellnessTemplateDetailScreen (group selection on detail screen) |
| `/app/admin/challenges/create` | `CreateChallengeScreen` | ChallengeTemplatesScreen "+ New" |
| `/app/admin/challenges/templates/:id/edit` | `EditChallengeTemplateScreen` | ChallengeTemplatesScreen "Edit" |
| `/app/admin/challenges/templates` | `ChallengeTemplatesScreen` | Admin sidebar |
| `/app/challenges/suggested` | `SuggestedChallengesScreen` | ChallengesScreen, direct |
| `/app/challenges/wellness` | `WellnessTemplateGalleryScreen` | ChallengesScreen, direct |
| `/app/challenges/wellness/:id` | `WellnessTemplateDetailScreen` | WellnessTemplateGalleryScreen |
| `/app/quick-actions` | `QuickActionsScreen` | BottomNav FAB |

### 9.2 Navigation Diagram

```
BottomNav FAB (+)
  └─ /app/quick-actions  [QuickActionsScreen]
        └─ "Create Challenge" → group picker (if >1 group)
              └─ /app/create-challenge?groupId=<id>
                    └─ [CreateChallengeWizard]

GroupDetailScreen
  └─ "Create Challenge" button
        └─ /app/create-challenge?groupId=<id>
              └─ [CreateChallengeWizard]

ChallengesScreen
  ├─ /app/challenges/suggested  [SuggestedChallengesScreen]
  │     └─ "Use Template" → preview modal → "Proceed to Create"
  │           └─ /app/create-challenge?templateId=<id>
  │                 └─ [CreateChallengeWizard] (fitness template prefilled)
  │
  └─ /app/challenges/wellness  [WellnessTemplateGalleryScreen]
        └─ card click
              └─ /app/challenges/wellness/:id  [WellnessTemplateDetailScreen]
                    └─ group selector + "Adopt to Group"
                          └─ /app/create-challenge?wellnessTemplateId=<id>&groupId=<id>
                                └─ [CreateChallengeWizard] (wellness template prefilled)

Admin Sidebar
  └─ /app/admin/challenges/templates  [ChallengeTemplatesScreen]
        ├─ "+ New" button
        │     └─ /app/admin/challenges/create  [CreateChallengeScreen]
        └─ "Edit" button (fitness templates only)
              └─ /app/admin/challenges/templates/:id/edit  [EditChallengeTemplateScreen]
```

---

## Section 10 — Backend Writes

### 10.1 Firestore Collections Written Per Component

| Component | challengeTemplates | wellnessTemplates | challenges | Cloud Function |
|---|---|---|---|---|
| CreateChallengeWizard | ❌ read-only (prefill) | ❌ read-only (prefill) | ❌ direct write | ✅ `createChallengeWithCreatorMembership` |
| CreateChallengeScreen (fitness mode) | ✅ createTemplate, addDoc | ❌ | ❌ | ❌ |
| CreateChallengeScreen (wellness mode) | ❌ | ✅ createTemplate, addDoc | ❌ | ❌ |
| EditChallengeTemplateScreen | ✅ updateTemplate, updateDoc | ❌ | ❌ | ❌ |
| ChallengeTemplatesScreen (actions) | ✅ publish / unpublish / archive / restore / delete / duplicate | ✅ same operations via wellnessTemplateService | ❌ | ❌ |
| WellnessTemplateDetailScreen | ❌ | ❌ | ❌ | ❌ (navigation only) |
| WellnessTemplateGalleryScreen | ❌ | ❌ | ❌ | ❌ (navigation only) |
| SuggestedChallengesScreen | ❌ | ❌ | ❌ | ❌ (navigation only) |
| QuickActionsScreen | ❌ | ❌ | ❌ | ❌ (navigation only) |

### 10.2 Cloud Function Payload

`createChallengeWithCreatorMembership` receives:

```
{
  name, description, groupId, createdBy,
  coverImageUrl?,
  challengeType: 'collective' | 'competitive' | 'streak',
  category: 'fitness' | 'wellness' | ...,
  startDate, endDate,
  activities: [{ exerciseId?, activityId?, exerciseName?, targetValue, unit, frequency?, ... }],
  engineVersion: 'v2',
  groupCumulativeTarget?,       // collective only
  autoCompleteOnGroupTarget?,   // collective only
  requiredConsecutiveDays?,     // streak only
  streakResetOnMiss?,           // streak only
  donation?: {
    enabled, causeName?, causeDescription?, targetAmountKes?,
    contributionStartDate?, contributionEndDate?,
    contributionPhoneNumber?, contributionCardUrl?,
    disclaimer?
  },
  templateId?,           // increments challengeTemplates.usageCount
  wellnessTemplateId?    // increments wellnessTemplates.usageCount
}
```

### 10.3 Firestore Field Written by Cloud Function

```
challenges/{id}:
  status: 'active' | 'draft'          ← 'draft' if donation.enabled
  moderationStatus: 'pending' | 'approved'
  approvalRequired: boolean
  approvalStatus: 'pending' | 'approved'
  participantCount: 1                  ← creator
  totalChallenges: incremented on group

challenges/{id}/members/{creatorId}:
  userId, joinedAt, role: 'creator'
```

---

## Missing Features Matrix

### Present only in User Wizard (not in Admin Create / Edit)

| Feature | Where missing | Impact |
|---|---|---|
| Step-by-step wizard UI (4 steps) | Admin has flat form — intentional | None (admin UX is different by design) |
| Group selection | Admin templates have no group — intentional | None |
| Template prefill from fitness template | Admin does not prefill — intentional | None |
| Template prefill from wellness template | Admin does not prefill — intentional | None |
| Usage count increment on launch | Admin does not launch — intentional | None |
| File-too-large warning on image | Admin Create, Admin Edit | Users can upload oversized images in admin; should add |
| "Select both dates to calculate duration" helper text | Admin Create | Minor UX gap |
| Step validation per step | Admin has flat form — intentional | None |
| Template Mode toggle (Fitness / Wellness) in step 1 | ✅ now added (16R-A) | Resolved |

### Present only in Admin Create (not in User Wizard)

| Feature | Where missing | Impact |
|---|---|---|
| Difficulty field | User Wizard — by design (user-created challenges don't have difficulty) | None |
| Save as Draft option | User Wizard — by design (users always launch live) | None |
| Publish / unpublish controls | User Wizard — by design | None |
| Template versioning | User Wizard — by design | None |

### Present only in Admin Edit (not in Admin Create)

| Feature | Where missing | Impact |
|---|---|---|
| Difficulty field | Admin Create | **Gap** — Admin Create should expose difficulty |
| Explicit duration days input | Admin Create uses date pickers instead | Acceptable — different UX approach |
| Version info display | Admin Create — newly created, no version yet | Acceptable |
| Usage count display | Admin Create — newly created, count is 0 | Acceptable |

### Missing from all three components

| Feature | Expected behaviour | Priority |
|---|---|---|
| Mixed-unit warning for collective challenges | Warn when activities have different units; service rejects but UI is silent | HIGH |
| "End date must be after start date" in Admin Create | Validation exists in Wizard but not Admin Create | MEDIUM |
| File-too-large warning in Admin Create and Admin Edit | Present in Wizard only | LOW |
| Wellness template edit screen | No edit path for wellness templates — admin must create new draft | MEDIUM |
| Minimum duration validation (1 day) | Service has default but UI has no guard | LOW |

### Implemented differently (divergent logic)

| Feature | User Wizard | Admin Create | Canonical |
|---|---|---|---|
| Donation contribution channel validation message | "Provide a mobile number or card link for contributions." | "Add at least one contribution channel (phone/card URL)." | Wizard wording |
| Collective target help text | "Total units the whole group must log together (e.g. 50 000 kg, 1 000 km)." | "Total units the whole group must reach together (e.g. 10,000 reps)" | Wizard wording |
| Collective target placeholder | "e.g. 50000" | "e.g. 10000" | "e.g. 50000" |
| Streak required days placeholder | "e.g. 7" | "e.g. 30" | "e.g. 7" |
| Streak required days help text | "How many days in a row a member must log to win this challenge." | "Number of consecutive days each member must log to complete the challenge" | Wizard wording |
| Auto-complete toggle label | "Auto-complete when target is reached" | "Auto-complete on target" | Wizard wording |
| Auto-complete toggle description | "Mark all members complete the moment the group total hits the target." | "Mark challenge completed when group total is reached" | Wizard wording |
| Streak reset toggle label | "Reset streak on missed day" | "Streak resets on missed day" | Wizard wording |
| Streak reset toggle description | "If off, a missed day pauses the streak without resetting it." | "When off, missed days pause the streak rather than resetting it" | Wizard wording |
| Disclaimer text (last word) | "…require platform review before going active." | "…require super admin approval before going active." | "…require platform review before going active." |
| Cover uploaded toast | "Challenge cover uploaded." | "Challenge cover uploaded." | "Challenge cover uploaded." |
| Cover uploaded toast (Edit) | — | — | ⚠️ Edit says "Cover uploaded." — should match |
| Local image preview toast | "Using local image preview. Upload will depend on storage permissions." | "Using local image preview. Upload depends on storage permissions." | Wizard wording (with "will") |
| Non-direct URL warning | "This looks like a page/album link. Use a direct image URL so the cover can render correctly." | "Album/page URL accepted (e.g. imgbb album links). Preview may not render unless the URL is a direct image file." | Wizard wording (more restrictive, correct for user-facing) |
| Challenge type inline description | ✅ shown in description box | ❌ not shown | All components: show inline description box |

### Regressions (functionality that exists but is broken or bypassed)

| Issue | Location | Description |
|---|---|---|
| Mixed-unit rejection is silent | All UI | Service rejects mixed-unit collective challenges but no UI warning. Users will get an opaque error on submission. |
| End date after start not enforced in Admin | Admin Create | Admin can save a template with endDate before startDate — service may accept this on templates since templates don't enforce date ordering at service level. |
| Wellness template has no edit path | Admin | Any published wellness template can only be modified by creating a new draft — the published version cannot be corrected in place. |

### Unused implementations

| Item | File | Status |
|---|---|---|
| `challengeService.createChallenge()` | `src/services/challengeService.ts` | Not called by any UI. Wizard uses Cloud Function instead. Could be an orphan or internal utility. |
| `adminChallengeService.createChallengeFromAdmin()` | `src/services/adminChallengeService.ts` | Not called by any current UI. Dead code. |

---

## UX Inconsistencies

### Wording inconsistencies

| String | User Wizard | Admin Create | Admin Edit | Canonical |
|---|---|---|---|---|
| Collective target help text | "Total units the whole group must log together (e.g. 50 000 kg, 1 000 km)." | "Total units the whole group must reach together (e.g. 10,000 reps)" | No help text | Wizard |
| Collective target placeholder | "e.g. 50000" | "e.g. 10000" | "e.g. 10000" | "e.g. 50000" |
| Streak days placeholder | "e.g. 7" | "e.g. 30" | "e.g. 30" | "e.g. 7" |
| Streak days help text | "How many days in a row a member must log to win this challenge." | "Number of consecutive days each member must log to complete the challenge" | No help text | Wizard |
| Auto-complete label | "Auto-complete when target is reached" | "Auto-complete on target" | "Auto-complete on target" | Wizard |
| Auto-complete description | "Mark all members complete the moment the group total hits the target." | "Mark challenge completed when group total is reached" | None | Wizard |
| Streak reset label | "Reset streak on missed day" | "Streak resets on missed day" | "Streak resets on missed day" | Wizard |
| Streak reset description | "If off, a missed day pauses the streak without resetting it." | "When off, missed days pause the streak rather than resetting it" | None | Wizard |
| Contribution channel error | "Provide a mobile number or card link for contributions." | "Add at least one contribution channel (phone/card URL)." | — | Wizard |
| Donation disclaimer ending | "…require platform review before going active." | "…require super admin approval before going active." | — | Wizard |
| Cover upload toast | "Challenge cover uploaded." | "Challenge cover uploaded." | "Cover uploaded." | "Challenge cover uploaded." |
| Local preview toast | "Upload will depend on storage permissions." | "Upload depends on storage permissions." | — | Wizard |
| Non-direct image URL warning | More restrictive (Wizard) | More permissive (Admin) | — | Keep both — intentional difference |

### Layout inconsistencies

| Area | User Wizard | Admin Create | Admin Edit | Canonical |
|---|---|---|---|---|
| Challenge Type section | Pills + description box below | Pills only, no description box | Pills only | Pills + description box in all |
| Engine settings section | Titled "Collective Settings" / "Streak Settings" | No section title | Implied | Titled sections in all |
| Help text below engine fields | Present for all fields | Inconsistent | Absent | Present for all engine-specific fields |
| Difficulty field | Not present | Not present | Present | Admin Create should have difficulty |
| Step 2 label (competitive) | "Configure" | — | — | "Configure" |
| Image section card | Dashed border card with camera icon, heading "Upload Challenge Cover", subtext "Add a visual for your challenge" | Different card style | Different | Wizard style canonical for user-facing |

### Default value inconsistencies

| Field | User Wizard | Admin Create | Admin Edit | Canonical |
|---|---|---|---|---|
| Initial challenge type | 'collective' | 'collective' | 'collective' | 'collective' ✅ consistent |
| Initial duration | computed from dates | computed from dates | 30 days | 30 days for template edit, computed otherwise |
| Initial difficulty | N/A | N/A | 'beginner' | 'beginner' for templates |
| Initial streak days placeholder | "e.g. 7" | "e.g. 30" | "e.g. 30" | "e.g. 7" — implies 7-day streak as default intent |
| autoCompleteOnGroupTarget | true | true | true | true ✅ consistent |
| streakResetOnMiss | true | true | true | true ✅ consistent |

### Validation inconsistencies

| Validation | User Wizard | Admin Create | Admin Edit | Canonical |
|---|---|---|---|---|
| Description minimum length | ✅ 8 chars enforced with message | ❌ not enforced | ❌ not enforced | 8 char minimum everywhere |
| End date after start | ✅ "End date must be after start date." | ❌ not enforced | — | Enforce in Admin Create |
| Minimum duration | ❌ | ❌ | ❌ | 1 day minimum everywhere |
| Activities minimum | ✅ step 3 validation | ❌ not shown | ❌ | Enforce before save in all |
| Collective target required | ✅ enforced at step 2 | ❌ not clear if enforced | ❌ | Required > 0 when challengeType = 'collective' |
| Streak days required | ✅ enforced at step 2 | ❌ not clear if enforced | ❌ | Required > 0 when challengeType = 'streak' |

---

## Recommended Canonical Behaviour

### Challenge Name

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Label | "CHALLENGE NAME" | Consistent across all three today | All |
| Placeholder | "e.g. 30 Day Shred" | Memorable, concrete, consistent | All |
| Required | Yes, non-empty | Core field | All |
| Minimum length | 1 character | Name of 1 char is valid | All |

### Description

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Label | "CHALLENGE DESCRIPTION" | Consistent | All |
| Placeholder | "Tell everyone what this is about..." | Friendly, consistent | All |
| Required | Yes | Core field | All |
| Minimum length | 8 characters | Prevents meaningless descriptions | All |
| Validation message | "Description must be at least 8 characters." | Clear, specific | All |

### Cover Image

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Upload button label | "Choose Image" | Consistent | All |
| Upload in-progress label | "Uploading image..." | Consistent | All |
| URL paste field | Yes, always present | Needed for admin and user | All |
| Preview | Yes, `h-28 w-full object-cover` rounded | Consistent dimensions | All |
| File too large warning | "Selected image is too large. Use a smaller file or paste an image URL." | User needs guidance | All |
| http/https URL validation | "Image URL should start with http:// or https://" | Consistent | All |
| Non-direct URL warning | Wizard: stricter ("Use a direct image URL"). Admin: permissive ("Preview may not render"). | Different audiences — intentional | Keep both |
| Upload success toast | "Challenge cover uploaded." | Full phrase | All |
| Local preview toast | "Using local image preview. Upload will depend on storage permissions." | Wizard wording with "will" | All |
| Upload error toast | "Could not read selected image." | Consistent | All |

### Template Mode Toggle

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Options | "Fitness" / "Wellness" | Binary, clear | User Wizard, Admin Create |
| Default | Fitness | Fitness is the primary mode | All |
| Description box | Yes — one sentence below toggle | Guides user on what mode means | User Wizard, Admin Create |
| Fitness description | "Track workouts and physical activities — strength, cardio, sports, and more." | Concrete, inclusive | User Wizard, Admin Create |
| Wellness description | "Track wellness habits — mindfulness, nutrition, sleep, hydration, and more." | Concrete, inclusive | User Wizard, Admin Create |

### Challenge Type

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Options | "Collective" / "Competitive" / "Streak" | Consistent | All |
| Style | Pill buttons, 3-column grid | Wizard pattern | All |
| Description box | Yes — shown beneath pills, updates on selection | Wizard pattern | All |
| Collective description | "Everyone contributes to a shared group target. The challenge completes when the group reaches the total." | Wizard wording | All |
| Competitive description | "Members compete individually. Each person tracks their own cumulative progress toward a personal target." | Wizard wording | All |
| Streak description | "Members must log activity on consecutive days. Completing the required streak wins the challenge." | Wizard wording | All |
| Default | 'collective' | Most common, most collaborative | All |

### Collective Settings

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Section heading | "Collective Settings" | Wizard pattern | All |
| Field label | "GROUP CUMULATIVE TARGET" | Uppercase, consistent | All |
| Field help text | "Total units the whole group must log together (e.g. 50 000 kg, 1 000 km)." | Wizard wording, more examples | All |
| Field placeholder | "e.g. 50000" | Higher number avoids confusion | All |
| Required | Yes, > 0 | Engine requires it | All |
| Validation message | "Set a group cumulative target for this collective challenge." | Wizard wording | All |
| Auto-complete toggle label | "Auto-complete when target is reached" | Wizard wording — more descriptive | All |
| Auto-complete toggle description | "Mark all members complete the moment the group total hits the target." | Wizard wording | All |
| Auto-complete default | true | Expected behaviour | All |
| Mixed-unit warning | Warn in UI when mixed units detected | Currently silent — service rejects but UI is quiet | All |

### Streak Settings

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Section heading | "Streak Settings" | Wizard pattern | All |
| Field label | "REQUIRED CONSECUTIVE DAYS" | Uppercase, consistent | All |
| Field help text | "How many days in a row a member must log to win this challenge." | Wizard wording — outcome-focused | All |
| Field placeholder | "e.g. 7" | 7-day streak is more common starting point than 30 | All |
| Required | Yes, > 0 | Engine requires it | All |
| Validation message | "Set the required consecutive days for this streak challenge." | Wizard wording | All |
| Streak reset toggle label | "Reset streak on missed day" | Wizard wording — action-focused | All |
| Streak reset toggle description | "If off, a missed day pauses the streak without resetting it." | Wizard wording — explains the off-state clearly | All |
| Streak reset default | true | Conservative default — players expect reset | All |

### Timeline

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Start Date label | "START DATE" | Consistent | User Wizard, Admin Create |
| End Date label | "END DATE" | Consistent | User Wizard, Admin Create |
| Date inputs | type="date" with calendar icon | Consistent | User Wizard, Admin Create |
| Computed duration display | "{N} day(s)" below date fields | Wizard pattern | User Wizard, Admin Create |
| Both required message | "Set start and end dates." | Wizard wording | User Wizard, Admin Create |
| End after start message | "End date must be after start date." | Wizard wording | User Wizard, Admin Create |
| Admin Edit duration | Explicit "DURATION (DAYS)" number input, default 30 | Templates have no real dates | Admin Edit only |

### Donation

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Toggle label | "Fitness + Cause" | Wizard wording | User Wizard |
| Cause Name label | "CAUSE NAME" | Consistent | User Wizard, Admin Create |
| Cause Description label | "CAUSE DESCRIPTION" | Consistent | User Wizard, Admin Create |
| Target field label | "TARGET CONTRIBUTION (KES, OPTIONAL)" | Consistent | User Wizard, Admin Create |
| Mobile number label | "DONATE HERE: MOBILE NUMBER" | Consistent | User Wizard, Admin Create |
| Card link label | "DONATE HERE: CARD LINK (OPTIONAL)" | Consistent | User Wizard, Admin Create |
| Channel validation message | "Provide a mobile number or card link for contributions." | Wizard wording — user-friendly | All |
| Cause validation message | "Add cause name and description for Fitness + Cause." | Consistent | All |
| Disclaimer | "Tiizi does not hold or manage funds. Contributions are coordinated by the group. Donation-enabled challenges require platform review before going active." | Wizard wording — "platform review" is correct term for users | User Wizard |
| Disclaimer (admin) | "…require super admin approval before going active." | Admin sees internal process | Admin Create |
| Challenge status on enable | status: 'draft', moderationStatus: 'pending' | Cloud Function enforces | All (service) |

### Activities

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Minimum required | 1 | Cannot launch without an activity | All |
| Validation message | "Add at least one valid activity." | Wizard wording | All |
| Activity target label | "TARGET VALUE" | Clear | All |
| Activity target type | number, min 0 | Consistent | All |
| Unit — fitness | Select: Reps / Seconds / Minutes / Km / Kg | Standard set | All (fitness mode) |
| Unit — wellness | Free text input, placeholder "hours / ml / servings" | Wellness is open-ended | All (wellness mode) |
| Frequency — wellness | Daily / Weekly / 2x/week / 3x/week / 5x/week / Custom | Standard options | All (wellness mode) |
| Frequency — fitness | Not shown | Not applicable | All (fitness mode) |
| Points | Auto-calculated, display only | Engine handles scoring | All |
| Add activity | "Add Activity" button | Consistent | All |
| Remove activity | × button per row | Consistent | All |

### Template Lifecycle (Admin only)

| Aspect | Canonical | Reason | Apply to |
|---|---|---|---|
| Save as draft | status: 'draft', isPublished: false | Unpublished work | Admin Create, Admin Edit |
| Publish | status: 'published', isPublished: true, publishedAt: now() | Makes visible to users | Admin Create, Admin Edit, ChallengeTemplatesScreen |
| Archive | status: 'archived', isPublished: false | Hides without deleting | ChallengeTemplatesScreen |
| Restore | status: 'draft', isPublished: false | Back to draft after archive | ChallengeTemplatesScreen |
| Delete | status: 'deleted', soft delete | Cannot undo in UI | ChallengeTemplatesScreen |
| Duplicate | Copy with "(Copy)" suffix, status: 'draft', version: 1, usageCount: 0 | Fresh start from copy | ChallengeTemplatesScreen |
| Version bump | version + 1 on every save | Audit trail | Admin Edit |
| Editing note | "Editing this template does not modify any challenges already created from it." | Prevent confusion | Admin Edit (shown in UI) |

---

## Appendix A — Complete State Variable Inventory

### CreateChallengeWizard.tsx

| Variable | Type | Initial Value |
|---|---|---|
| `coverImageUrl` | string | `''` |
| `coverImageUploadState` | 'idle' \| 'uploading' | `'idle'` |
| `name` | string | `''` |
| `description` | string | `''` |
| `challengeType` | 'collective' \| 'competitive' \| 'streak' | `initialType` (param or 'collective') |
| `startDate` | string | `''` |
| `endDate` | string | `''` |
| `activities` | ActivityRow[] | `[{ query:'', exerciseId:'', targetValue:'', unit:'Reps' }]` |
| `activeSearchRow` | number \| null | `null` |
| `pickerRowIndex` | number \| null | `null` |
| `pickerSearch` | string | `''` |
| `pickerTier` | string | `'All'` |
| `wellnessPickerOpen` | boolean | `false` |
| `donationEnabled` | boolean | `false` |
| `causeName` | string | `''` |
| `causeDescription` | string | `''` |
| `targetDonation` | string | `''` |
| `contributionStartDate` | string | `''` |
| `contributionEndDate` | string | `''` |
| `contributionPhone` | string | `''` |
| `contributionCardUrl` | string | `''` |
| `templateApplied` | boolean | `false` |
| `wellnessTemplateApplied` | boolean | `false` |
| `isLaunching` | boolean | `false` |
| `wizardStep` | 1 \| 2 \| 3 \| 4 | `1` |
| `stepError` | string | `''` |
| `groupCumulativeTarget` | string | `''` |
| `autoCompleteOnGroupTarget` | boolean | `true` |
| `requiredConsecutiveDays` | string | `''` |
| `streakResetOnMiss` | boolean | `true` |
| `challengeCategory` | string | `'fitness'` |
| `selectedGroupId` | string | `''` (or param `groupId`) |

### CreateChallengeScreen.tsx (Admin)

| Variable | Type | Initial Value |
|---|---|---|
| `templateMode` | 'fitness' \| 'wellness' | `'fitness'` |
| `wellnessPickerOpen` | boolean | `false` |
| `wellnessCategoryFilter` | string | `'all'` |
| `wellnessSearch` | string | `''` |
| `coverImageUrl` | string | `''` |
| `coverImageUploadState` | 'idle' \| 'uploading' | `'idle'` |
| `name` | string | `''` |
| `description` | string | `''` |
| `challengeType` | 'collective' \| 'competitive' \| 'streak' | `'collective'` |
| `startDate` | string | `''` |
| `endDate` | string | `''` |
| `activities` | ActivityRow[] | `[{ query:'', exerciseId:undefined, targetValue:'', unit:'Reps' }]` |
| `pickerIndex` | number \| null | `null` |
| `pickerSearch` | string | `''` |
| `groupCumulativeTarget` | string | `''` |
| `autoCompleteOnGroupTarget` | boolean | `true` |
| `requiredConsecutiveDays` | string | `''` |
| `streakResetOnMiss` | boolean | `true` |
| `donationEnabled` | boolean | `false` |
| `causeName` | string | `''` |
| `causeDescription` | string | `''` |
| `targetAmountKes` | string | `''` |
| `contributionStartDate` | string | `''` |
| `contributionEndDate` | string | `''` |
| `contributionPhoneNumber` | string | `''` |
| `contributionCardUrl` | string | `''` |
| `isSavingWellnessTemplate` | boolean | `false` |

### EditChallengeTemplateScreen.tsx

| Variable | Type | Initial Value |
|---|---|---|
| `initialized` | boolean | `false` |
| `coverImageUrl` | string | `''` |
| `coverImageUploadState` | 'idle' \| 'uploading' | `'idle'` |
| `name` | string | `''` |
| `description` | string | `''` |
| `challengeType` | 'collective' \| 'competitive' \| 'streak' | `'collective'` |
| `durationDays` | string | `'30'` |
| `difficultyLevel` | 'beginner' \| 'intermediate' \| 'advanced' | `'beginner'` |
| `activities` | ActivityRow[] | `[{ query:'', exerciseId:undefined, targetValue:'', unit:'Reps' }]` |
| `groupCumulativeTarget` | string | `''` |
| `autoCompleteOnGroupTarget` | boolean | `true` |
| `requiredConsecutiveDays` | string | `''` |
| `streakResetOnMiss` | boolean | `true` |
| `pickerIndex` | number \| null | `null` |
| `pickerSearch` | string | `''` |

---

## Appendix B — All Validation Messages (Canonical)

| Field / Rule | Message |
|---|---|
| Challenge name empty | "Challenge name is required." |
| Description < 8 chars | "Description must be at least 8 characters." |
| No group selected | "Please select a group." |
| Start or end date missing | "Set start and end dates." |
| End date before start date | "End date must be after start date." |
| Collective target missing | "Set a group cumulative target for this collective challenge." |
| Streak days missing | "Set the required consecutive days for this streak challenge." |
| No activities | "Add at least one activity." / "Add at least one valid activity." |
| Donation cause fields empty | "Add cause name and description for Fitness + Cause." |
| Donation channel empty | "Provide a mobile number or card link for contributions." |
| Image URL not http/https | "Image URL should start with http:// or https://" |
| Non-direct image URL (user-facing) | "This looks like a page/album link. Use a direct image URL so the cover can render correctly." |
| Image file too large | "Selected image is too large. Use a smaller file or paste an image URL." |

---

## Appendix C — All Toast Messages (Canonical)

| Event | Toast |
|---|---|
| Cover image uploaded | "Challenge cover uploaded." |
| Cover image local preview only | "Using local image preview. Upload will depend on storage permissions." |
| Cover image read error | "Could not read selected image." |
| Challenge launched (no donation) | "Challenge launched." |
| Challenge launched (donation enabled) | "Challenge submitted for platform review before going active." |
| No group — create challenge | "Join or create a group first to create challenges." |
| No group — log activity | "Join or create a group first to log activities." |
| Template saved as draft | "Template saved as draft." |
| Template published | "Template published." |
| Template save error | "Could not save template." |

---

## Appendix D — Engine Fields by Challenge Type

### Collective
| Field | Type | Default | Stored on |
|---|---|---|---|
| `groupCumulativeTarget` | number | — (required) | Challenge, Template |
| `autoCompleteOnGroupTarget` | boolean | true | Challenge, Template |
| `groupCurrentTotal` | number | 0 | Challenge (live) |

### Competitive
| Field | Type | Default | Stored on |
|---|---|---|---|
| Per-activity `targetValue` | number | — (required) | Challenge activities array |
| Per-activity `unit` | string | 'Reps' | Challenge activities array |
| No engine-level fields | — | — | — |

### Streak
| Field | Type | Default | Stored on |
|---|---|---|---|
| `requiredConsecutiveDays` | number | — (required) | Challenge, Template |
| `streakResetOnMiss` | boolean | true | Challenge, Template |
| `currentStreak` (member) | number | 0 | challenges/{id}/members/{uid} |
| `longestStreak` (member) | number | 0 | challenges/{id}/members/{uid} |
| `lastLogDate` (member) | date | deleted on join | challenges/{id}/members/{uid} |

---

*This document is the single source of truth for all challenge creation behaviour. No code changes were made in this phase. All future implementation must reference and update this document.*
