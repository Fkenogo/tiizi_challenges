# Phase 13H — Admin UX & Interface Audit

**Date:** 2026-06-26  
**Branch:** fix/p0-pre-deploy-blockers  
**Scope:** Every administrator screen audited for visual consistency, workflow friction, form quality, data presentation, and accessibility  
**Code changes:** 6 files  
**Schema changes:** None  
**Engine changes:** None

---

## Audit Coverage

| Module | Screens Reviewed | Defects Found | Fixed |
|---|---|---|---|
| Dashboard | AdminDashboardScreen | None | — |
| Challenges | ChallengeTemplatesScreen, CreateChallengeScreen, ActiveChallengesScreen | 3 | 3 |
| Moderation | AdminPendingChallengesScreen, AdminApprovedChallengesScreen | 5 | 5 |
| Analytics | ChallengeAnalyticsScreen | None (fixed in 13G) | — |
| Users | UserListScreen, UserDetailScreen | None blocking | — |
| Groups | GroupListScreen, GroupDetailScreen, GroupModerationScreen | None blocking | — |
| Exercises | ExerciseListScreen, AddExerciseScreen, EditExerciseScreen | Observed (non-blocking) | — |
| Wellness | WellnessActivityListScreen, AddWellnessActivityScreen | Observed (non-blocking) | — |
| Settings | AdminUsersScreen, AppSettingsScreen | 4 | 4 |
| Layout | AdminHeader, AdminSidebar, AdminLayout | 1 | 1 |

---

## Fixed Issues

### FIX-13H-1 — `window.prompt()` for moderation notes replaced with inline textarea

**File:** `src/features/Admin/AdminPendingChallengesScreen.tsx`  
**Category:** Workflow friction · Forms

`window.prompt()` is a browser-native dialog that cannot be styled, blocks the JS thread, is suppressed on some mobile browsers, and has no character limit or guidance text. Moderators clicking "Request Changes" were dropped into a bare system dialog with no context.

**Fix:** Replaced with inline stateful textarea that renders within the card. The "Request Changes" button now switches the card into an edit mode showing:
- A textarea pre-focused, with instructive placeholder text
- A "Send Request" button (disabled while note is empty or mutation is pending, shows "Sending…" while in-flight)
- A "Cancel" button to dismiss without action

The `noteTargetId` / `noteText` state tracks which challenge is being annotated, ensuring only one inline composer is open at a time.

---

### FIX-13H-2 — Raw ISO date strings formatted in pending challenge details

**File:** `src/features/Admin/AdminPendingChallengesScreen.tsx`  
**Category:** Data presentation

The expanded details panel showed raw `startDate`/`endDate` strings (`2024-01-15`) rather than locale-formatted dates. Fixed to `new Date(item.startDate).toLocaleDateString()`.

The owner UID truncation was also improved: `slice(0,8)` produced a meaningless stub with no indication it was truncated. Changed to `slice(0,12) + "…"` with the label "UID:" to clarify.

---

### FIX-13H-3 — Active Challenges: empty state moved outside table; broken Progress column removed

**File:** `src/features/Admin/Challenges/ActiveChallengesScreen.tsx`  
**Category:** Data presentation · Visual consistency

Two issues:
1. The empty state `<p>` was rendered *after* the `<table>` inside the same card — when the list was empty, an empty table with headers rendered above the message.
2. The "Progress" column displayed `challenge.progress`, which is always `0` (confirmed in Phase 13G: no engine ever updates this field). Showing "0%" for every row is actively misleading.

**Fix:** The empty state now replaces the table entirely (conditional rendering). The Progress column is removed; a "Type" column is added in its place so admins can see the challenge engine type at a glance. Participant counts now use `toLocaleString()` for thousands formatting.

---

### FIX-13H-4 — Approved challenge cards show only name + timestamp

**File:** `src/features/Admin/AdminApprovedChallengesScreen.tsx`  
**Category:** Data presentation

Each card showed only the challenge name and "Approved [date]". Admins had no way to distinguish a 500-person collective challenge from a 2-person streak without navigating elsewhere.

**Fix:** Cards now show:
- Challenge type (capitalized)
- Participant count with `toLocaleString()` + correct singular/plural ("1 participant" vs "12 participants")
- Approval date via `toLocaleDateString()` (was using `toLocaleString()` — time-of-day is not useful here)

---

### FIX-13H-5 — AppSettings numeric inputs accept zero and negative values

**File:** `src/features/Admin/Settings/AppSettingsScreen.tsx`  
**Category:** Forms · Validation

`maxChallengesPerUser`, `maxGroupsPerUser`, and `maxWorkoutLogsPerDay` had `type="number"` but no `min` attribute and no floor in the onChange handler. A setting of `maxChallengesPerUser = -5` would be saved to Firestore and enforced downstream, effectively disabling the feature in an undetectable way.

**Fix:** Added `min="1"` on all three inputs, and changed their onChange handlers to `Math.max(1, ...)` so the stored value is always ≥ 1 even if the browser ignores the `min` attribute (e.g., programmatic input). The Save button now shows "Saving…" while the mutation is pending.

---

### FIX-13H-6 — AdminUsersScreen: silent failure on empty UID + no table empty state

**File:** `src/features/Admin/Settings/AdminUsersScreen.tsx`  
**Category:** Forms · Validation · Data presentation

Two issues:
1. `onSave` had `if (!uid.trim()) return` — clicking Save with no UID silently did nothing. No error message appeared.
2. The admin users table had no empty state — if no admins were configured, an empty `<tbody>` rendered with no explanation.

**Fix:**
- Added `uidError` state. When Save is clicked with an empty UID, the input border turns red and an inline error message appears below: "User UID is required." The error clears as soon as the user starts typing.
- Added a `<td colSpan={5}>` empty-state row inside `<tbody>` for the zero-results case.
- Save button shows "Saving…" while the mutation is pending.

---

### FIX-13H-7 — AdminHeader notification bell missing aria-label

**File:** `src/features/Admin/layout/AdminHeader.tsx`  
**Category:** Accessibility

The bell icon button had no `aria-label`, `title`, or visible text. Screen readers would announce it as an unlabelled button.

**Fix:** Added `aria-label="Notifications"`.

---

## Non-Blocking Observations (Not Fixed)

| Screen | Observation | Rationale for deferral |
|---|---|---|
| `ExerciseListScreen` | `window.confirm()` for delete; no error toast on delete failure | Low blast radius; `window.confirm` is preferable to an unimplemented modal system |
| `WellnessActivityListScreen` | Same `window.confirm()` pattern | Same rationale |
| `AddExerciseScreen`, `EditExerciseScreen`, `AddWellnessActivityScreen` | Submit buttons don't show "Saving…" | These screens already show disabled state; forms are validated by ExerciseForm/WellnessActivityForm components not audited in detail |
| `UserListScreen`, `GroupListScreen` | No empty state after filtering to zero results | Filter state lives in local component state; empty tbody already renders; low user impact |
| All list screens | No result count ("Showing X of Y") | New feature, not a correction |
| All list screens | No column sorting | New feature, not a correction |
| `ChallengeTemplatesScreen` | Template cards have no edit/delete actions | Separate workflow; out of scope for UX-only audit |
| `AdminPendingChallengesScreen` | Owner UID not resolved to display name | Requires a Firestore user lookup per card — out of scope |

---

## Files Changed

| File | Change |
|---|---|
| `src/features/Admin/AdminPendingChallengesScreen.tsx` | Replaced `window.prompt` with inline textarea, formatted dates, improved UID label, added loading states to buttons |
| `src/features/Admin/AdminApprovedChallengesScreen.tsx` | Added challenge type, participant count, and formatted date to approved challenge cards |
| `src/features/Admin/Challenges/ActiveChallengesScreen.tsx` | Fixed empty state position; removed always-zero Progress column; added Type column; formatted participant counts |
| `src/features/Admin/Settings/AppSettingsScreen.tsx` | Added `min="1"` and `Math.max(1,…)` floor to numeric setting inputs; added "Saving…" button state |
| `src/features/Admin/Settings/AdminUsersScreen.tsx` | Added inline UID required-field validation error; added table empty state; added "Saving…" button state |
| `src/features/Admin/layout/AdminHeader.tsx` | Added `aria-label="Notifications"` to bell button |

---

## Validation

```
npx tsc -b --pretty false         → 0 errors ✅
npm run build                     → ✓ built in 2.86s ✅
npm run test:scoring-guards       → scoring guards passed (13C-1 through 13G-4) ✅
```
