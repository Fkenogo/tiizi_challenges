# UX-6 — Challenge Creation Wizard Polish
**Branch:** `fix/p0-pre-deploy-blockers`  
**Date:** 2026-06-25  
**Status:** Complete — all validation commands passed

---

## 1. Objective

Transform the Challenge Creation Wizard from a single long-scroll form into a guided 4-step wizard with engine-aware step labels, per-step validation, a live preview banner, and a launch readiness checklist. Presentation / UX only — no engine logic, scoring, Firestore writes, or schema were modified.

---

## 2. Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/CreateChallengeWizard.tsx` | Multi-step wizard UX (state, helpers, step rendering, readiness checklist) |

**Files confirmed NOT modified:**
- All engine files, scoring services, Firestore rules, logging paths, schema, types

---

## 3. Validation

```
npx tsc -b --pretty false          → 0 errors
npm run build                      → ✓ built in 2.78s
npm run test:scoring-guards        → scoring guards passed
npm run test:home-challenge-feeds  → all guards passed
```

---

## 4. Changes in Detail

### 4.1 New State Variables

```typescript
const [wizardStep, setWizardStep] = useState<1 | 2 | 3 | 4>(1);
const [stepError, setStepError] = useState('');
```

### 4.2 Step Labels (engine-aware)

```typescript
const stepLabels: string[] = [
  'Type',
  challengeType === 'collective' ? 'Group Goal'
    : challengeType === 'streak' ? 'Frequency'
    : 'Configure',
  'Activities',
  'Review',
];
```

The second step label adapts to the selected challenge type:
- Collective → "Group Goal"
- Streak → "Frequency"
- Competitive → "Configure"

### 4.3 `advanceStep()` — Per-step Validation

| Step | Validation |
|---|---|
| 1 → 2 | name, description ≥ 8 chars, group selected |
| 2 → 3 | dates set and valid; Collective: groupCumulativeTarget > 0; Streak: requiredConsecutiveDays > 0 |
| 3 → 4 | at least one activity with exerciseId or activityId |

Errors display inline (red banner below step content) and block advancement.

### 4.4 `goBack()` — Smart Back Navigation

On step 1, navigates to `/app/challenges` (or with groupId). On steps 2-4, decrements `wizardStep` and clears any step error.

The header `<ArrowLeft>` button now calls `goBack` instead of navigating directly.

### 4.5 Step Progress Indicator

Four-segment progress bar always visible below the template banners:
- Filled segments (`bg-primary`) for completed and current steps
- Active step label in `text-primary`; completed labels in `text-slate-400`; future labels in `text-slate-300`

### 4.6 Step Content Segmentation

| Step | Content |
|---|---|
| 1 (Type) | Cover image · Group · Name · Description · Challenge type selector · Engine explanation callout |
| 2 (Configure) | Live preview banner · Engine-specific settings (Collective: group target + auto-complete; Streak: consecutive days + reset; Competitive: explanation) · Timeline (start/end dates + duration display) |
| 3 (Activities) | Live preview banner with duration · Activities card (all existing logic unchanged) · Fitness + Cause donation toggle |
| 4 (Review) | Review cards from UX-5 (header, engine model, type-specific settings) · Launch readiness checklist · Launch button |

### 4.7 Live Preview Banners (Steps 2 & 3)

Compact banner at top of each step showing:
- Challenge name (truncated)
- Engine type badge (Collective / Competitive / Streak in matching colours)
- Step 3 also shows duration in days (when set)

### 4.8 Launch Readiness Checklist (Step 4)

Rendered above the launch button. Items check:
- Challenge name set
- Group selected
- Dates configured (both set, end ≥ start)
- At least one activity
- Group target set (Collective only)
- Streak days set (Streak only)

Each item shows ✓ in green when satisfied, ○ in slate when not.

### 4.9 Navigation Buttons

Steps 1-3: "Next: {stepLabels[wizardStep]}" button (no disabled state; validation runs on click).  
Step 4: "Launch Challenge" button (unchanged logic — `handleLaunch`, disabled when no group or pending).

---

## 5. Existing Logic Preserved (Unchanged)

- `handleLaunch` — full validation sequence, payload construction, `createChallenge.mutateAsync`, navigation
- All `useEffect` template pre-fills (fitness template, wellness template, URL params)
- Exercise picker bottom sheet modal (`pickerRowIndex !== null`)
- Wellness activity picker bottom sheet modal (`wellnessPickerOpen === true`)
- `challengeDurationDays` computed value
- `isWellnessMode` flag and all wellness-specific rendering paths
- `donationEnabled` toggle and donation fields
- Activity rows: search, suggestions, target/unit, wellness fields
- Scoring guard string: "Points are based on challenge targets"

---

## 6. Regression Audit

| Area | Checked | Result |
|---|---|---|
| Template pre-fill (templateId) | useEffect unchanged | ✅ Unchanged |
| Wellness template pre-fill | useEffect unchanged | ✅ Unchanged |
| Exercise picker modal | Rendered outside step conditionals | ✅ Unchanged |
| Wellness picker modal | Rendered outside step conditionals | ✅ Unchanged |
| handleLaunch | Full validation + payload unchanged | ✅ Unchanged |
| Engine-specific settings (Collective/Streak/Competitive) | Moved to step 2, identical JSX | ✅ Unchanged |
| Activities card | Moved to step 3, identical JSX | ✅ Unchanged |
| Review section (UX-5) | Moved to step 4, identical JSX | ✅ Unchanged |
| Scoring guards | `npm run test:scoring-guards` | ✅ Passed |
| Home challenge feeds | `npm run test:home-challenge-feeds` | ✅ Passed |
| TypeScript | `npx tsc -b --pretty false` | ✅ 0 errors |
| Build | `npm run build` | ✅ 2.78s |

---

## 7. Risks

| Risk | Mitigation |
|---|---|
| Template pre-fill sets fields after step 1 (e.g. dates) | Fields are set in state regardless of step — user sees them when they reach step 2 |
| User on step 3 changes type back on step 1 (via back) | State persists across steps; engine settings on step 2 remain consistent |
| `advanceStep` validation may block users who set activities via URL params | URL-param pre-fills on activities still set `exerciseId` — validation correctly passes |

---

## 8. Rollback Instructions

One file changed. To revert:
```bash
git checkout HEAD -- src/features/Challenges/CreateChallengeWizard.tsx
```
