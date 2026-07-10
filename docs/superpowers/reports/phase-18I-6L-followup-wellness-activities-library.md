# Phase 18I-6L Follow-up — Wellness Library CTA routes to Wellness Activities

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers

---

## Problem

Phase 18I-6L added a "Browse Activities Library" two-button CTA. The "Wellness Library" button routed to `/app/challenges/wellness` — the **Wellness Templates Gallery** (`WellnessTemplateGalleryScreen`), not a wellness activities browser.

Wellness activities (managed under Admin → Wellness Activities) had no member-facing browse screen. Users tapping "Wellness Library" saw challenge templates, not the activities catalog.

---

## Root Cause

No member-facing `WellnessActivitiesLibraryScreen` existed. The closest thing was:
- `/app/admin/wellness-activities` — admin-only
- `/app/challenges/wellness` — wellness templates, not activities

The CTA was routed to wellness templates as a placeholder, which was semantically wrong.

---

## Fix

### 1. New `WellnessActivitiesLibraryScreen`

Created `src/features/Wellness/WellnessActivitiesLibraryScreen.tsx`:
- Read-only, no admin actions (no Edit/Delete/Add buttons)
- Uses `useWellnessActivities` hook (same data source as admin screen, no writes)
- Search field (activates at ≥2 chars)
- Category filter pill row (All + 10 categories)
- Card list showing name, icon, category, difficulty, default target
- Back button navigates to previous screen
- `BottomNav active="challenges"`

### 2. Route registered in App.tsx

```
/app/wellness-activities → WellnessActivitiesLibraryScreen (ProtectedRoute)
```

Lazy-loaded; no `RequireGroupRoute` (browse is open to all authenticated members).

### 3. ChallengesScreen CTA updated

```tsx
// Before:
onClick={() => navigate(`/app/challenges/wellness${querySuffix}`)}  // templates gallery

// After:
onClick={() => navigate('/app/wellness-activities')}  // activities library
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Wellness/WellnessActivitiesLibraryScreen.tsx` | New — read-only member-facing wellness activities browser |
| `src/App.tsx` | Register `/app/wellness-activities` route + lazy import |
| `src/features/Challenges/ChallengesScreen.tsx` | Wellness Library CTA → `/app/wellness-activities` |
| `scripts/testChallengesViewPolish.ts` | Updated to 15 guards (was 10); new guards enforce correct route + screen existence + no admin actions |

---

## Guards (15 total, up from 10)

New guards added in this follow-up:
- Wellness Library CTA navigates to `/app/wellness-activities`
- Wellness Library CTA does NOT navigate to `/app/challenges/wellness` (templates)
- `WellnessActivitiesLibraryScreen` file exists
- Screen does not contain Edit/Delete/Add admin actions
- Screen uses `useWellnessActivities` hook
- App.tsx registers `/app/wellness-activities` route
- App.tsx imports `WellnessActivitiesLibraryScreen`

---

## Validation

```
npx tsc --noEmit                      ✅ clean
npm run build                         ✅ built in 2.96s
npm run test:challenges-view-polish   ✅ 15/15 passed
npm run test:home-challenge-feeds     ✅ passed
npm run test:challenge-activity-model ✅ 53/53 passed
```

---

## Manual Test Checklist

- [ ] Challenges screen → Browse Activities Library → "Wellness Library" opens a list of wellness activities (fasting, hydration, sleep, etc.) — NOT wellness challenge templates
- [ ] Search field filters activities by name
- [ ] Category pills filter by category (Fasting, Sleep, Mindfulness, etc.)
- [ ] No Edit/Delete/Add buttons visible on this screen
- [ ] Back button returns to Challenges screen
- [ ] "Exercise Library" button still navigates correctly to `/app/exercises`
- [ ] Wellness Templates remain accessible via "Wellness Templates" section → View All
