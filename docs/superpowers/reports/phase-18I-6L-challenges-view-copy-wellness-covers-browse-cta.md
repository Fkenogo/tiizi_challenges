# Phase 18I-6L — Challenges View Copy, Wellness Covers, Browse CTA Fixes

**Date:** 2026-07-03
**Branch:** fix/p0-pre-deploy-blockers
**Base commit:** 79c14a7

---

## Issues Fixed

### A — Rename "Suggested Templates" → "Fitness Challenges"

The section title at line 157 of `ChallengesScreen.tsx` showed "Suggested Templates". This was renamed to "Fitness Challenges" — matching the member-facing language used elsewhere in the app.

### B — Wellness template cards: use cover photo when available

Wellness template cards were rendering `{item.icon ?? '✨'}` as an emoji with no cover image, even though the `WellnessTemplate` type has `coverImage?: string` and the admin form supports uploading a cover photo.

Fix: when `isValidHttpImage(item.coverImage)` is true, render a 120px cover photo strip at the top of the card (rounded top corners, gradient overlay, category badge). Falls back to the original emoji layout if no valid cover photo exists.

### C — Remove false "No public challenges available to browse yet." empty state

The Browse Challenges section showed "No public challenges available to browse yet." when `browseCards.length === 0` locally — but clicking "View All" opened the browse screen with real challenges. The message was misleading.

Fix: replaced the static "no challenges" text with a link-style CTA: "Browse all available challenges →" pointing to `/app/challenges/browse`.

### D — Browse Activities Library CTA replacing single "Browse Exercise Library" button

The previous single-button CTA navigated only to `/app/exercises` (fitness exercises). There was no member-facing entry point to the wellness activities / wellness template gallery.

Fix: replaced the single button with a two-button row under a "Browse Activities Library" heading:
- **Exercise Library** → `/app/exercises`
- **Wellness Library** → `/app/challenges/wellness` (WellnessTemplateGalleryScreen)

### E — Guards (new test script)

Created `scripts/testChallengesViewPolish.ts` with 10 guards:
1. "Fitness Challenges" label present
2. "Suggested Templates" label absent
3. `isValidHttpImage(item.coverImage)` present in wellness cards
4. `item.coverImage` used as image src
5. "No public challenges available to browse yet." absent
6. "Browse Activities Library" heading present
7. "Exercise Library" entry present
8. "Wellness Library / Wellness Activities" entry present
9. `/app/exercises` route referenced
10. `/app/challenges/wellness` route referenced

Registered as `npm run test:challenges-view-polish`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/features/Challenges/ChallengesScreen.tsx` | A: rename label; B: cover photo on wellness cards; C: replace false empty state; D: Browse Activities Library two-button CTA |
| `scripts/testChallengesViewPolish.ts` | New — 10 guards for 18I-6L |
| `package.json` | Register `test:challenges-view-polish` |

---

## Validation

```
npx tsc --noEmit                    ✅ clean
npm run build                       ✅ built in 2.95s
npm run test:challenges-view-polish ✅ 10/10 passed
npm run test:home-challenge-feeds   ✅ passed
npm run test:challenge-activity-model ✅ 53/53 passed
npm run test:scoring-guards         ✅ passed
npm run test:challenge-creation-backend ✅ passed
npm run test:challenge-creation-6combos ✅ passed
npm run test:group-ux-polish        ✅ 20/20 passed
```

---

## Manual Test Checklist

- [ ] Challenges screen section title shows "Fitness Challenges" (not "Suggested Templates")
- [ ] Wellness template cards with a `coverImage` URL show the photo strip at top
- [ ] Wellness template cards without `coverImage` still show emoji icon + category badge
- [ ] Browse Challenges section — when empty locally — shows "Browse all available challenges →" (not the old misleading message)
- [ ] "Browse Activities Library" heading visible at bottom of screen
- [ ] Tapping "Exercise Library" button navigates to `/app/exercises`
- [ ] Tapping "Wellness Library" button navigates to `/app/challenges/wellness`
