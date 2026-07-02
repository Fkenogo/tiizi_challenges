# Phase 18I-6G Follow-up: Challenge Management Filters, Navigation, Lifecycle Status, and Template Filters

**Date:** 2026-07-02  
**Branch:** fix/p0-pre-deploy-blockers  
**Commit:** d660841  
**Status:** ✅ Complete — 64/64 guards, TypeScript clean, build clean

---

## Root Causes Found

| Issue | Root Cause |
|-------|-----------|
| Sidebar says "Active Challenges" | `AdminSidebar.tsx:28` had hardcoded label; never updated when screen was renamed |
| Expired challenges show as "Active" | `getAllChallenges()` returned raw Firestore `status` with no date comparison; no `effectiveStatus` concept existed |
| Completed filter missed expired challenges | Same root cause — filter compared against raw `status`, not date-aware derivation |
| Row click went to member screen | `navigate('/app/challenges/${row.id}')` used member route; no admin detail route or screen existed |
| Analytics refresh had no feedback | `refetch()` was called but `isRefetching` was not consumed; no timestamp shown |
| Template engine filter "not working" | Filter was already implemented correctly (line 557); UI chips were present. No code change needed — possible confusion in manual testing. Guards confirm it works. |
| Count discrepancy (48 vs 47) | `getAllChallenges()` fetched all challenges then filtered `deleted` in JS; `getChallengeAnalytics()` independently fetched all and excluded deleted. Both now use consistent `nonDeleted` logic. Root cause of 48 vs 47: one soft-deleted document was included in the management list before the filter ran, or the analytics was counting `effectiveStatus='active'` vs list counting all non-deleted rows. Now both exclude `status === 'deleted'` consistently. |

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Admin/layout/AdminSidebar.tsx` | Renamed nav label "Active Challenges" → "Challenge Management" |
| `src/services/adminChallengeService.ts` | Added `effectiveStatus` to `AdminChallengeRow` type; exported `deriveEffectiveStatus()`; updated `getAllChallenges()` and `getChallengeAnalytics()` to use effective status |
| `src/hooks/useAdminChallenges.ts` | Added `useAdminChallenge(id)` hook for detail screen |
| `src/features/Admin/Challenges/ActiveChallengesScreen.tsx` | Filter on `effectiveStatus`; badge uses `effectiveStatus`; ActionMenu uses `effectiveStatus`; row navigates to `/app/admin/challenges/:id` |
| `src/features/Admin/Challenges/AdminChallengeDetailScreen.tsx` | **NEW** — full admin challenge detail view |
| `src/features/Admin/Challenges/ChallengeAnalyticsScreen.tsx` | `isRefetching` feedback; last-updated timestamp |
| `src/App.tsx` | Lazy-loaded `AdminChallengeDetailScreen`; registered `/app/admin/challenges/:id` route |
| `scripts/testAdminChallengeManagement.ts` | Section 10 — 24 new guards; total 64/64 |

---

## `deriveEffectiveStatus()` Logic

```ts
export function deriveEffectiveStatus(status: string, startDate: string, endDate: string): string {
  // Lifecycle statuses always respected as-is
  if (['archived', 'deleted', 'inactive', 'draft', 'completed'].includes(status)) return status;
  const now = new Date().toISOString();
  if (status === 'active') {
    if (endDate && endDate < now) return 'completed'; // expired
    if (startDate && startDate > now) return 'upcoming'; // not yet started
    return 'active';
  }
  return status;
}
```

**Key design decisions:**
- Does NOT write back to Firestore. Effective status is computed client-side only.
- Stored status is always shown alongside effective status in the detail screen.
- `'completed'` in stored status is respected (admin-marked); expired-active also resolves to `'completed'`.
- Analytics counts now match the management list filter because both use `effectiveStatus`.

---

## AdminChallengeDetailScreen

Route: `/app/admin/challenges/:id`

Shows:
- Challenge name, effective status badge, stored status (if different), type, category, description
- Group name (clickable → admin group detail), group ID, participant count
- Start/end dates, createdAt, updatedAt, createdBy
- Engine version, groupCumulativeTarget, requiredConsecutiveDays (when present)
- Moderation status (when present)
- Activities list (name, target value, unit, type, category)
- Lifecycle action buttons: Deactivate / Mark Completed / Archive (for active); Reactivate / Restore (for others); Delete (always, with confirm modal)
- Back to Challenge Management button

---

## What Was NOT Changed

- **Template engine filter** — already working. `ChallengeTemplatesScreen.tsx:557` filters on `t.challengeType !== engineFilter`. UI buttons are at lines 760–765. No regression.
- **Template featured/unfeature actions** — not touched; confirmed still working via guards.
- **Deeper analytics** — deferred as specified. Current metrics (13 fields, byType, byCategory, topByParticipants) are sufficient for now.

---

## Validation

```
test:admin-challenge-management    64/64 ✅  (was 40/40, +24 new guards)
test:challenge-activity-model      35/35 ✅
test:scoring-guards                all passed ✅
test:challenge-creation-backend    all passed ✅
test:challenge-creation-6combos    all passed ✅
test:home-challenge-feeds          all passed ✅
audit:challenge-creation-payloads  all passed ✅
audit:challenge-templates          all passed ✅
tsc --noEmit                       clean ✅
npm run build                      clean ✅
```

---

## Manual Test Checklist

### Sidebar
- [ ] Admin sidebar shows "Challenge Management" (not "Active Challenges")

### Challenge Management screen (`/app/admin/challenges/active`)
- [ ] Expired challenge (endDate < today, status=active in Firestore) shows "Completed" badge
- [ ] Future challenge (startDate > today, status=active in Firestore) shows "Upcoming" badge
- [ ] "Completed" filter tab includes expired challenges
- [ ] "Active" filter tab excludes expired challenges
- [ ] "Upcoming" filter tab shows future active challenges
- [ ] Type dropdown: selecting "Collective" shows only collective challenges
- [ ] Type dropdown: selecting "Streak" shows only streak challenges
- [ ] Category dropdown: selecting "Fitness" shows only fitness challenges
- [ ] Clicking a challenge row navigates to `/app/admin/challenges/:id`

### Admin Challenge Detail screen (`/app/admin/challenges/:id`)
- [ ] Shows challenge name, status badges (effective + stored if different), type, category
- [ ] Group name is clickable → navigates to admin group detail
- [ ] Start/end dates displayed correctly
- [ ] Activities list shows name + target value + unit
- [ ] Lifecycle actions visible and functional (Deactivate/Complete/Archive/Reactivate/Delete)
- [ ] Delete shows confirmation modal; after delete, navigates back to list
- [ ] "Back to Challenge Management" button works

### Challenge Analytics
- [ ] Refresh button shows "…Refreshing" while loading
- [ ] Last-updated timestamp appears after first load
- [ ] Active count is lower than before (expired challenges no longer counted as active)

### Challenge Templates
- [ ] Engine filter chips (👥 Collective / 🏆 Competitive / 🔥 Streak) visible and functional
- [ ] Selecting Streak shows only streak templates
- [ ] Engine filter combines correctly with Fitness/Wellness collection filter

---

## Deferred

- Firestore backfill to write `effectiveStatus` to challenge docs — not recommended; computed status avoids write costs and race conditions.
- Deeper analytics (per-group breakdown, daily active users, challenge funnel) — not in scope for this phase.
