# Phase 18I-6G: Admin Challenge Management + Analytics + Featured Templates

**Date:** 2026-07-02  
**Branch:** fix/p0-pre-deploy-blockers  
**Status:** ✅ Complete — 40/40 guards passing, TypeScript clean, build clean

---

## Summary

Four deliverables shipped in this phase:
- **Task A+B:** Admin "Active Challenges" screen renamed to "Challenge Management" with full status/type/category filters and per-row lifecycle actions
- **Task C:** ChallengeAnalyticsScreen overhauled from static to dynamic metrics (13 fields, breakdowns, top-N lists)
- **Task D:** `isFeatured` / `featuredAt` / `featuredBy` added to both template collections; Feature/Unfeature admin actions; featured templates sort first in member-facing screens
- **Task F:** 40-guard static analysis test script

---

## Files Changed

### Services
| File | Changes |
|------|---------|
| `src/services/adminChallengeService.ts` | Added `ChallengeStatusFilter`, `AdminChallengeRow` types; `getAllChallenges()`, `archiveChallenge()`, `deactivateChallenge()`, `reactivateChallenge()`, `markChallengeCompleted()`, `deleteChallenge()`; enhanced `getChallengeAnalytics()` with 13 metrics including `byCategory`, `topByParticipants`, `completionRateByType`, `recentlyCreated` |
| `src/services/challengeTemplateService.ts` | Added `isFeatured`, `featuredAt`, `featuredBy` to `SuggestedChallengeTemplate`; fromDoc mapping; `getPublishedTemplates` sort (featured first); `featureTemplate()`, `unfeatureTemplate()` |
| `src/services/wellnessTemplateService.ts` | Same featured fields + methods; `getTemplates` sort (featured first) |

### Hooks
| File | Changes |
|------|---------|
| `src/hooks/useAdminChallenges.ts` | Added `useAllChallengesAdmin`, `useArchiveChallenge`, `useDeactivateChallenge`, `useReactivateChallenge`, `useMarkChallengeCompleted`, `useDeleteChallengeAdmin` |
| `src/hooks/useChallengeTemplates.ts` | Added `useFeatureTemplate`, `useUnfeatureTemplate` |
| `src/hooks/useWellnessTemplates.ts` | Added `useFeatureWellnessTemplate`, `useUnfeatureWellnessTemplate` |

### Types
| File | Changes |
|------|---------|
| `src/types/index.ts` | Added `isFeatured?`, `featuredAt?`, `featuredBy?` to `WellnessTemplate` |

### Screens
| File | Changes |
|------|---------|
| `src/features/Admin/Challenges/ActiveChallengesScreen.tsx` | Full overhaul → "Challenge Management": `STATUS_BADGE`, `STATUS_FILTERS`, type/category dropdowns, `StatusBadge`, `ActionMenu` with contextual per-row lifecycle actions, delete confirmation modal, group link, participant count |
| `src/features/Admin/Challenges/ChallengeAnalyticsScreen.tsx` | Full overhaul: `MetricCard`, `BarRow` components; 9 metric cards; by-type completion rates; by-category bars; top-10 by participants ranked list; refresh button |
| `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx` | Restored from session recovery (883 lines); added `Star` import, `isFeatured` to `AdminTemplate`, Feature/Unfeature menu items, Featured ⭐ badge in card, all feature hook wiring |

### Test / Audit
| File | Changes |
|------|---------|
| `scripts/testAdminChallengeManagement.ts` | NEW — 40 guards across 9 sections |
| `package.json` | Added `test:admin-challenge-management` script |

---

## Firestore Index Requirements

`getAllChallenges()` uses `orderBy('startDate', 'desc')` on the `challenges` collection — no composite index required (single-field ordering). All other analytics queries use in-memory aggregation on the already-fetched snapshot.

**No new Firestore indexes needed for this phase.**

---

## Validation Output

```
test:challenge-activity-model      35/35 ✅
test:scoring-guards                 all passed ✅
test:challenge-creation-backend     all passed ✅
test:challenge-creation-6combos     all passed ✅
test:home-challenge-feeds           all passed ✅
audit:challenge-creation-payloads   all passed ✅
audit:challenge-templates           28 guards passed ✅
test:admin-challenge-management     40/40 ✅
tsc --noEmit                        clean ✅
npm run build                       clean ✅
```

---

## Manual Test Checklist

### Challenge Management screen (`/app/admin/challenges/active`)
- [ ] Screen title shows "Challenge Management" not "Active Challenges"
- [ ] Status tabs filter rows (All / Active / Upcoming / Completed / Archived / Inactive / Draft / Pending)
- [ ] Type dropdown filters by collective / competitive / streak
- [ ] Category dropdown filters rows
- [ ] Search input filters by challenge name
- [ ] Status badge renders correct colour per row
- [ ] "Deactivate" action appears for active challenges; sets status to inactive
- [ ] "Reactivate" appears for inactive challenges; returns to active
- [ ] "Archive" appears for active/inactive challenges
- [ ] "Complete" appears for active challenges
- [ ] "Delete" shows confirmation modal before executing soft delete
- [ ] Group name in row is clickable (links to admin group detail)
- [ ] Row name is clickable (links to challenge detail)

### Challenge Analytics screen (`/app/admin/challenges/analytics`)
- [ ] Metric cards show live counts (not hard-coded zeros)
- [ ] "By Challenge Type" section shows three rows (collective / competitive / streak) with completion rates
- [ ] "By Category" section shows category bars
- [ ] "Top by Participants" shows ranked list (top 10)
- [ ] Refresh button re-fetches data

### Featured Templates (ChallengeTemplatesScreen)
- [ ] Published fitness template dropdown shows "Feature" option
- [ ] After featuring, "⭐ Featured" badge appears on card
- [ ] Featured option in dropdown changes to "Unfeature" for featured templates
- [ ] Unfeaturing removes the badge
- [ ] Same flow works for wellness templates
- [ ] In member-facing SuggestedChallengesScreen and WellnessTemplateGalleryScreen, featured templates appear first

---

## Key Design Decisions

1. **Soft delete only** — `deleteChallenge()` sets `status: 'deleted'`; no Firestore document is removed.
2. **Analytics are client-aggregated** — `getChallengeAnalytics()` fetches the full non-deleted challenge set and aggregates in-memory. This avoids new Firestore indexes and Cloud Function dependencies for the MVP. A note in the analytics screen reminds admins that a Cloud Function could provide real-time counts at scale.
3. **Featured badge uses fill style** — `<Star size={9} className="fill-yellow-500 text-yellow-500" />` renders a solid star to distinguish it from an outline icon.
4. **ChallengeTemplatesScreen recovery** — The 883-line pre-existing file was accidentally destroyed mid-session (Write + git checkout). It was recovered from the session JSONL transcript at `/tmp/ChallengeTemplatesScreen_recovered.tsx` and the 18I-6G changes were re-applied cleanly.
