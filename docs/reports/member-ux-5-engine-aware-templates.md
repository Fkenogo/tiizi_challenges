# UX-5 — Engine-aware Challenge Templates
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Objective

Redesign the template discovery and selection experience so admins and users understand Collective, Competitive, and Streak challenge behaviour before creating a challenge. Presentation / UX only — no engine logic, scoring, Firestore writes, or schema were modified.

---

## 2. Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/SuggestedChallengesScreen.tsx` | Full rewrite — engine grouping, explanation callouts, engine badges on cards, improved modal |
| `src/features/Challenges/WellnessTemplateGalleryScreen.tsx` | Added engine filter row, grouped view by `template.type`, engine badges on cards |
| `src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx` | Added engine filter row, grouped display by type, engine badges on cards |
| `src/features/Challenges/CreateChallengeWizard.tsx` | Improved review section — full engine model table (completion model, winner determination, leaderboard, scoring, type-specific settings) |

**Files confirmed NOT modified:**
- All engine files, scoring services, Firestore rules, logging paths, schema, types

---

## 3. Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.85s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

---

## 4. Changes in Detail

### 4.1 SuggestedChallengesScreen — Engine Grouping + Explanation

**`ENGINE` config object** defines per-type metadata: icon, emoji, badge colours, headline, explanation, completion model, leaderboard model, winner rule.

**Filter bar:** Updated to show `👥 Collective`, `🏆 Competitive`, `🔥 Streak` labels on filter chips.

**When `filter === 'all'`:** Templates rendered in three sections (Collective → Competitive → Streak). Each section leads with:
- Section header with emoji, label, template count badge
- `EngineExplanationCallout` — engine explanation + completion/leaderboard/winner rule

**When `filter === single type`:** Explanation callout appears above a flat list of matching templates.

**`TemplateListCard` component:** New card design with:
- Cover image at 200px (was 270px — saves screen space)
- Engine badge top-right (e.g. `👥 Collective` in blue)
- Difficulty, duration, activity count tags
- Popularity text
- `Use Template` button

**Preview modal** improved with:
- Engine badge on cover overlay
- "How [Engine] works" callout — completion/leaderboard/winner rule
- First activity preview card (unchanged)

### 4.2 WellnessTemplateGalleryScreen — Engine Filter + Grouping

Added `engineFilter` state (all / collective / competitive / streak).

New engine filter row above the existing category and difficulty rows.

**When `engineFilter === 'all'`:** Templates grouped into sections by `template.type` — each section has a 1-line engine description and the matching templates. Empty sections are hidden.

**When `engineFilter === single type`:** Flat list with a description callout at top.

Engine badge added to each template card (`flex items-center gap-1 rounded-full px-2 py-0.5`).

### 4.3 ChallengeTemplatesScreen (Admin) — Engine Filter + Grouped View

Added `engineFilter` state alongside existing `modeFilter` (fitness/wellness).

Two filter rows: Mode (All / Fitness / Wellness) + Engine type (All / 👥 / 🏆 / 🔥).

**When `engineFilter === 'all'`:** Grouped display — Collective → Competitive → Streak. Each group has section header, description line, and template cards.

**When `engineFilter === single type`:** Flat filtered list.

All template cards: engine badge with emoji + label + colour.

### 4.4 CreateChallengeWizard — Improved Review Section

The summary card before launch replaced with:

1. **Header card:** Name, engine type badge (colour-coded), Engine v2 badge, duration badge.

2. **Engine Model card:** Four rows — Completion model / Winner determination / Leaderboard / Scoring. Values are engine-specific:
   - Collective: shared cumulative target / team together / ranked by contribution / points per contribution
   - Competitive: per-activity targets / highest % wins / ranked by % / points scale with target
   - Streak: consecutive day log / longest streak wins / ranked by streak / points per consistent day

3. **Type-specific settings card** (conditional):
   - Collective: Group target + Auto-complete on target
   - Streak: Required consecutive days + On missed day (resets/pauses)
   - Competitive: Per-activity target table (activity name + target + unit)

---

## 5. Engine Visual Language

| Engine | Emoji | Badge colours | Section accent |
|---|---|---|---|
| Collective | 👥 | `bg-blue-100 text-blue-700` | `bg-blue-50 border-blue-200` |
| Competitive | 🏆 | `bg-amber-100 text-amber-700` | `bg-amber-50 border-amber-200` |
| Streak | 🔥 | `bg-orange-100 text-orange-700` | `bg-orange-50 border-orange-200` |

---

## 6. Regression Audit

| Area | Checked | Result |
|---|---|---|
| Template selection → `/app/create-challenge?templateId=…` | SuggestedChallengesScreen modal "Proceed to Create" | ✅ Unchanged |
| Template selection → `/app/challenges/wellness/${id}` | WellnessTemplateGalleryScreen card nav | ✅ Unchanged |
| Wellness detail → `/app/create-challenge?wellnessTemplateId=…` | WellnessTemplateDetailScreen "Adopt to Group" | ✅ Not modified |
| Wizard launch flow | CreateChallengeWizard handleLaunch | ✅ Not modified |
| Admin template creation | `/app/admin/challenges/create` | ✅ Navigation unchanged |
| Scoring guards | `npm run test:scoring-guards` | ✅ Passed |
| Home challenge feeds | `npm run test:home-challenge-feeds` | ✅ Passed |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| `template.challengeType` may be undefined for old templates | Falls back to `ENGINE.collective` in badge renders; no crash |
| `WellnessTemplate.type` field coverage | All templates must have `type` set at creation time; existing templates without it are hidden from engine-grouped sections but visible under "all" |

---

## 8. Rollback Instructions

Four files changed. To revert all:
```bash
git checkout HEAD~1 -- \
  src/features/Challenges/SuggestedChallengesScreen.tsx \
  src/features/Challenges/WellnessTemplateGalleryScreen.tsx \
  src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx \
  src/features/Challenges/CreateChallengeWizard.tsx
```

---

## 9. Remaining Gaps

| Gap | Notes |
|---|---|
| `TemplateCard.tsx` (home carousel) | Used in horizontal scroll on HomeScreen; minimal engine info shown — a future pass could add the engine badge in that compact format |
| Admin `CreateChallengeScreen.tsx` (template form) | Admin template creation form doesn't show engine explanation; could add a callout similar to the wizard when `challengeType` is selected |
| Recommended group size | Not stored on `SuggestedChallengeTemplate`; would require a schema addition to display |
