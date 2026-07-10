# CRIT-3 Step 3B — ChallengeDetailScreen Visual Redesign
**Branch:** `fix/p0-pre-deploy-blockers`
**Date:** 2026-06-25
**Status:** Complete — all static checks pass

---

## 1. What Changed

Full visual redesign of `src/features/Challenges/ChallengeDetailScreen.tsx`. All scoring logic, Firestore rules, logging services, and hook logic from Step 3A are unchanged. The file is now a complete rewrite of the render layer built on the same data and derived values.

---

## 2. Design Sections Implemented

### 2.1 Sticky Top Bar
- Back arrow in a circular white/border button.
- "CHALLENGE DETAIL" `st-section-label` text.
- `sticky top-0 z-20 bg-slate-50` — stays visible while scrolling the card below.

### 2.2 Orange Hero Card (`mx-4 rounded-[24px] bg-primary`)
- **Radial glow overlay** (`opacity-20 pointer-events-none`) for depth without affecting tap targets.
- **Type chip** — rounded-full, `bg-white/25`, uppercase tracking-widest (COLLECTIVE / COMPETITIVE / STREAK).
- **Mode chip** — rounded-full, `bg-white/15 border border-white/30` (FITNESS / WELLNESS).
- **Title** — `text-[22px] font-black text-white tracking-tight`.
- **Description** — `text-[13px] text-white/80`, conditional on `resolvedChallenge.description`.
- **Day progress row** — shown only while the challenge is `now >= startMs && now <= endMs`:
  - "Day N of D" label left, "N% Complete" label right (only if member is active).
  - White/20 track bar with white fill, width = `(currentDay / durationDays) * 100%`.
- **Dates row** — two `<Calendar size={12}>` + label pairs for start/end dates.
- **Status label** — derived `statusLabel` from `summary` useMemo (unchanged from Step 3A).
- **Pending approval notice** — conditional orange-tinted box when `requiresApproval`.

### 2.3 Stats Row (3 cards, `grid-cols-3 gap-2`)
- MY LOGS / TOTAL LOGS / PARTICIPANTS
- Each: `rounded-2xl bg-white border border-slate-200 shadow-sm`.
- Label: `text-[10px] uppercase font-bold text-slate-500 tracking-wider`.
- Value: `text-[20px] font-black text-slate-900`.
- Participants uses `uniqueParticipants || resolvedChallenge.participantCount || 0` (guard from `testHomeChallengeFeeds` preserved).

### 2.4 Group link
- Small orange dot + group name in primary color — shown when `normalizedGroupId` is set.

### 2.5 Daily Targets Card
- Zap icon + `st-section-label` header.
- Divider-separated rows: activity name (left, `font-semibold`) + `targetValue unit freqLabel` (right, `font-bold text-primary`).
- `freqLabel` derived from `activity.frequency` via lookup map (e.g. `daily → /day`, `2x-week → 2×/wk`).
- Empty state: "No activities configured yet."

### 2.6 How Points Work Card
- Trophy icon + header.
- Updated body copy per spec:
  > Each activity can earn up to **100 points** per log. Hitting the daily target earns 100 points. Log part of the target and earn proportional points. Example: daily target is 100 reps, you log 50 — you earn 50 points.
- Conditional multi-activity addendum: "For multi-activity challenges, each activity is scored separately." — shown when `isMultiActivity` (activities.length > 1).

### 2.7 Fitness + Cause Section (conditional)
- Shown when `resolvedChallenge.donation?.enabled`.
- Amber border/background, displays cause name, description, KES target, window dates, phone number, disclaimer.
- Contribute / Skip buttons preserved from prior implementation.

### 2.8 Leaderboard Snapshot
- Trophy icon + "LEADERBOARD" label + "View All →" button (navigates to `/app/challenges/leaderboard?challengeId=X&groupId=Y`).
- `useQuery` reads `challengeMembers.totalPoints`, sorts descending, slices top 5.
- Rank badge: orange (`bg-primary text-white`) for #1, slate for #2, amber-100/orange-700 for #3, slate-100/slate-500 for 4+.
- Each row: rank badge, avatar placeholder, truncated userId prefix, score with "pts" unit label.
- Empty state: "No activity logged yet. Be the first!"

### 2.9 CTA Area (Step 3A logic fully preserved)
CTA decision table — unchanged from Step 3A:

| `membership.status` | `challengeIsOver` | `hasStarted` | CTA |
|---|---|---|---|
| `'completed'` | any | any | 🎉 Challenge Completed banner |
| any | `true` | any | "This challenge has ended." |
| none / `'left'` / other | `false` | any | Join Challenge |
| `'active'` | `false` | `false` | Remind Me |
| `'active'` | `false` | `true` | Log Workout / Log Activity |

- Leave button: visible only when `status === 'active'` AND `!challengeIsOver` AND `myLogs === 0`.
- Secondary nav row: "← Challenges" + "← Group" (when normalizedGroupId set).

### 2.10 Loading & Access-Denied States
- Skeleton loader with `animate-pulse` placeholders for hero card and stat cards.
- Access-denied: Go to Group + Back to Challenges buttons.
- Challenge-not-found: EmptyState with Trophy icon.

---

## 3. Files Modified

| File | Change |
|---|---|
| `src/features/Challenges/ChallengeDetailScreen.tsx` | Full visual redesign — render layer only |

---

## 4. Commands Executed

```
npx tsc -b --pretty false      → 0 errors (exit 0)
npm run build                  → ✓ built in 3.51s
npm run test:scoring-guards    → scoring guards passed
npm run test:home-challenge-feeds → all guards passed
```

---

## 5. Design Tokens Used

| Token | Value | Usage |
|---|---|---|
| `var(--primary)` / `bg-primary` | `#ff6b00` | Hero card, chip accent, target values, CTA buttons |
| `rounded-[24px]` | 24px | Hero card outer radius |
| `rounded-2xl` | 16px | Stat cards, daily targets card, CTA buttons |
| `st-section-label` | CSS utility | Section headers (sticky bar, cards) |
| `text-white/80` | | Hero card description |
| `bg-white/25`, `bg-white/15` | | Semi-transparent chips on orange background |
| Lexend | body font | Inherited from `index.css` |

---

## 6. Preserved Invariants from Step 3A

- `myLogs` sourced from `membership.activitiesCompleted` — never exceeds `totalLogs`.
- `challengeIsOver` checked before join branch — covers all non-completed memberships.
- Leave button hidden when `myLogs > 0`.
- Leaderboard query uses `challengeMembers.totalPoints`.
- All CTA branches and their guard order are byte-for-byte equivalent to Step 3A logic.

---

## 7. Browser Verification

Browser verification requires user sign-in (not performable programmatically). Recommended manual checks:

| Check | Expected |
|---|---|
| Active collective challenge | Orange hero card, COLLECTIVE + FITNESS chips, progress bar at current day |
| Active wellness challenge | WELLNESS chip, "Log Activity" CTA button |
| Completed membership | 🎉 Challenge Completed banner, green background |
| Ended challenge (non-completed member) | "This challenge has ended." slate banner |
| Non-member, public group | "Join Challenge" button |
| Challenge with no leaderboard data | "No activity logged yet. Be the first!" |
| Leaderboard rank #1 | Orange filled badge |

---

## 8. Risks

**Low.** Changes are render-only.
- Leaderboard snapshot `useQuery` (new in Step 3B) fetches `challengeMembers` filtered by `challengeId`. Same collection, same rule path as `useChallengeProgress`. No new Firestore reads beyond what Step 3A already does — in practice both queries run concurrently and the challengeMembers data is cached.
- The hero progress bar width is derived from `currentDay / durationDays` (calendar time), not `completionPct`. These are intentionally different: the bar shows "how far through the calendar period we are", while the "N% Complete" label shows membership completion rate. This matches the design reference.

---

## 9. Rollback Instructions

```bash
git checkout HEAD -- src/features/Challenges/ChallengeDetailScreen.tsx
```

All other files (hooks, services, rules, test scripts) are unchanged from Step 3A.
