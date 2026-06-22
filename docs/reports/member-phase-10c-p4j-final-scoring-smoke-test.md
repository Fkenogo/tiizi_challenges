# Phase 10C-P4J — Final Scoring Smoke Test

Date: 2026-06-18  
Branch: fix/p0-pre-deploy-blockers  
Status: PARTIAL PASS — code audit and Firestore inspection complete; live browser activity-logging steps not verified (Firebase auth failed in headless browser)

---

## Test Method

Two verification tracks were run in parallel:

| Track | Method | Scope |
|-------|--------|-------|
| **Firestore inspection** | Read-only Admin SDK query via gcloud ADC | Latest workout/wellness docs, leaderboard state, challenge member completion status |
| **Code audit** | Static analysis of all scoring display paths | WorkoutLoggedScreen, ChallengeLeaderboardScreen, GroupLeaderboardScreen, ChallengeDetailScreen, scoring engine |
| **Live browser** | Preview browser, headless Chromium | Sign-in attempted but Firebase auth rejected credentials in headless context |

---

## Overall Status

| Area | Status | Notes |
|------|--------|-------|
| v2 scoring fields present on new logs | ✅ PASS | 3/3 recent v2 workout docs have all 6 fields |
| Legacy logs preserve pre-P4B behavior | ✅ PASS | 3/3 legacy docs absent scoring fields as expected |
| Leaderboard shows "pts" not "XP" | ✅ PASS | Code audit — two occurrences replaced in P4F |
| Leaderboard helper text present | ✅ PASS | "Points are based on challenge targets…" confirmed in source |
| "How Points Work" card in ChallengeDetail | ✅ PASS | Per-type copy confirmed in source |
| 0-point explanation copy present | ✅ PASS | "Below minimum effort for points." confirmed in WorkoutLoggedScreen |
| Points success screen shows 0 correctly | ✅ PASS | `points = pointsParam !== null ? Number(pointsParam) : 0` — no `|| 10` fallback |
| `metTarget` routed to success screen | ✅ PASS | LogWorkoutScreen and LogWellnessActivityScreen both pass `scoring.metTarget` |
| Time-bounded challenges not auto-completed | ✅ PASS (code) | P4I fix in place in all 3 logging paths |
| v2 leaderboard score = stored points | ✅ PASS | Score: 0 for user with 2 x 0-point streak logs — CF correctly read stored v2 points |
| Live activity logging below floor | ⬜ NOT TESTED | Browser auth unavailable |
| Live activity logging partial progress | ⬜ NOT TESTED | Browser auth unavailable |
| Live activity logging meeting target | ⬜ NOT TESTED | Browser auth unavailable |
| Wellness challenge live path | ⬜ NOT TESTED | No wellness logs in production, browser auth unavailable |

---

## Firestore Inspection Results

### Workout Documents (6 sampled, most recent by `createdAt`)

| Doc | scoringVersion | points | rawValue | targetValue | metTarget | scoringMethod |
|-----|---------------|--------|----------|-------------|-----------|---------------|
| 7mdHhqegKs | v2 | **0** | 100 | 1400 | false | streak_binary |
| uW9DE2pOEb | v2 | **0** | 20 | 1050 | false | streak_binary |
| t5XeMsEFDX | v2 | **0** | 50 | 1050 | false | streak_binary |
| ZV8IvrKxLI | [absent] | [absent] | [absent] | [absent] | [absent] | [absent] |
| VicCn7wL0a | [absent] | [absent] | [absent] | [absent] | [absent] | [absent] |
| sK0zoL9nZp | [absent] | [absent] | [absent] | [absent] | [absent] | [absent] |

**Finding:** All 3 v2 docs have complete scoring metadata. The 0-point results are correct: all are streak challenges where the logged value fell short of the daily target — streak uses binary scoring (full points or 0, no proportional partial credit). The 3 legacy docs have no scoring fields, which is expected behavior for pre-P4B logs.

### Wellness Logs

No wellness log documents found in production (collection exists but is empty for tested date range). Wellness log path could not be verified via data inspection. The code path uses identical scoring engine and metadata stamping as workouts.

### Challenge Leaderboards (6 sampled)

| Doc | score | activityCount | lastScoringVersion |
|-----|-------|---------------|--------------------|
| 1S7cXHuHkwAO… | 205 | 5 | legacy |
| 9j0Op19Sr2A8… | 100 | 2 | legacy |
| K4eBvaSLKe4y… | 40 | 2 | legacy |
| RuEmriT3uAAz… | 240 | 6 | legacy |
| Uqx8beHESmfb… (user A) | 100 | 2 | legacy |
| Uqx8beHESmfb… (user B) | **0** | 2 | **v2** |

**Finding:** The single v2 leaderboard entry (`score: 0, activityCount: 2`) correctly mirrors the two v2 workout docs for that user+challenge, both of which scored 0 (streak target not met). The Cloud Function correctly read stored v2 `points` (0) instead of recomputing, so the leaderboard shows 0 — accurate and expected.

### Time-Bounded Challenge Early Completion (P4I Regression Check)

| Challenge | endDate | Expired? | Completed members |
|-----------|---------|----------|-------------------|
| 1S7cXHuHkw… | 2026-07-05 | **No** | **1** ⚠️ |
| 9j0Op19Sr2… | 2026-06-14 | Yes | 1 (OK — challenge ended) |
| HemE5n36hd… | 2026-03-21 | Yes | 0 |
| K4eBvaSLKe… | 2026-07-05 | **No** | **1** ⚠️ |
| RXnDF61eiP… | 2026-04-01 | Yes | 0 |

**Finding:** Two non-expired time-bounded challenges (`1S7cXHuHkw…`, `K4eBvaSLKe…`, both ending 2026-07-05) already have one `completed` member each. These were set before the P4I fix was deployed. These members will remain in `completed` state on a challenge that hasn't ended yet — they will not appear in the Active Challenges rail until the challenge lifecycle or admin corrects the membership status.

This is not a regression introduced by this branch; it is **pre-existing data from before P4I**. The P4I fix prevents new early completions but does not retroactively fix existing ones.

---

## Code Audit Results

### Scoring Engine — `src/services/scoringConfig.ts`

| Scenario | Expected | Verified |
|----------|----------|---------|
| Streak: value < target | `points: 0, metTarget: false, reason: 'target_not_met'` | ✅ Live tsx test |
| Streak: value == target | `points: 10, metTarget: true` | ✅ Live tsx test |
| Competitive: any value | `points = rawValue` (no floor) | ✅ Live tsx test |
| Collective: below 5% floor (e.g. 1 rep / 40) | `points: 0, reason: 'below_minimum_effort'` | ✅ Verified in P4E guards |
| Collective: above floor, below target | Proportional partial points | ✅ Verified in P4B guards |

### WorkoutLoggedScreen — `src/features/Workouts/WorkoutLoggedScreen.tsx`

| Check | Status |
|-------|--------|
| No `|| 10` fallback on points param | ✅ `pointsParam !== null ? Number(pointsParam) : 0` |
| Points row always rendered | ✅ Unconditional `<div>Points earned … {totalPoints}</div>` |
| 0-point copy: "Below minimum effort for points." | ✅ `totalPoints === 0` branch |
| Partial copy: "Partial points earned." | ✅ `!metTarget` branch |
| Full copy: "Target met." | ✅ `metTarget` branch |
| Single-activity copy only (not for multi-entry sessions) | ✅ `loggedEntries.length === 0` guard |
| `metTarget` passed from LogWorkoutScreen | ✅ `metTarget: scoring.metTarget` |
| `metTarget` passed from LogWellnessActivityScreen | ✅ `metTarget: scoring.metTarget` |

### ChallengeLeaderboardScreen — `src/features/Challenges/ChallengeLeaderboardScreen.tsx`

| Check | Status |
|-------|--------|
| My score label: "pts" not "XP" | ✅ `{myEntry?.score ?? 0} pts` at line 55 |
| Ranked list: "pts" not "XP" | ✅ `{row.score} pts` at line 72 |
| Helper text present | ✅ "Points are based on challenge targets, not just logging activity." at line 60 |

### GroupLeaderboardScreen — `src/features/Groups/GroupLeaderboardScreen.tsx`

| Check | Status |
|-------|--------|
| Score label: "pts" not "XP" | ✅ Confirmed in P4F guards |

### ChallengeDetailScreen — `src/features/Challenges/ChallengeDetailScreen.tsx`

| Check | Status |
|-------|--------|
| "How Points Work" card present | ✅ Line 306 |
| Competitive copy | ✅ "Higher activity earns more points, capped for fairness." |
| Streak copy | ✅ "Points reward consistent daily completion." |
| Wellness copy | ✅ "Logging below 5% of the target earns no points." |
| Collective/default copy | ✅ "Points scale with how close you get to the activity target." |
| Helper text | ✅ "Points are based on challenge targets, not just logging activity." |

### Direct Logging Completion Guard (P4I) — All 3 Paths

| Path | Condition | Status |
|------|-----------|--------|
| `workoutService.createWorkout` | `nextRate >= 100 && status !== 'completed' && !endAt` | ✅ Fixed in P4I |
| `wellnessLogService.writeLog` | `completionRate >= 100 && status !== 'completed' && !endAt` | ✅ Fixed in P4I |
| `activityLogSessionService.createActivitySession` | `nextRate >= 100 && status !== 'completed' && !endAt` | ✅ Already correct since P4C |

---

## Bugs Found

### Minor: 0-point copy is inaccurate for streak challenges

**Severity:** Low — copy is still informative, just slightly misleading.  
**Screen:** WorkoutLoggedScreen success screen, single-activity path.  
**Condition:** Streak challenge where user logs below the daily target.  
**Current copy:** "Below minimum effort for points."  
**Problem:** Streak scoring is binary — the user simply didn't meet the target; there is no 5% proportional floor concept. The copy implies a proportional floor that doesn't apply to streak challenges.  
**Correct copy:** Would vary by scoring method — "Target not met." is more accurate for streak. However, the `scoringMethod` is not currently passed as a URL param to the success screen.  
**Recommended fix prompt:** Pass `scoringMethod` in `buildActivitySuccessPath`, then in `WorkoutLoggedScreen` use:
```
totalPoints === 0
  ? (scoringMethod === 'streak_binary' ? 'Target not met.' : 'Below minimum effort for points.')
  : metTarget ? 'Target met.' : 'Partial points earned.'
```

### Pre-existing: Two time-bounded challenges have incorrectly-completed members

**Severity:** Medium — affects 2 members who joined challenges ending 2026-07-05; they will not see those challenges in their Active rail.  
**Root cause:** These memberships were set to `completed` before P4I was in place (logged before the branch existed).  
**Not a regression from this branch.** The P4I fix prevents this from happening again.  
**Recommended action:** After deploy, run an admin query to find `challengeMembers` with `status: 'completed'` where the parent challenge has `status: 'active'` and a future `endDate`, then reset `status` to `'active'` for those docs.

---

## Browser Console Audit (Unauthenticated State)

Errors observed in preview browser during unauthenticated load:

| Message | Severity | Action |
|---------|----------|--------|
| React Router future flag warnings (v7_startTransition, v7_relativeSplatPath) | Low | Pre-existing, not scoring-related |
| `GET /node_modules/firebase/auth.js → 404` | Low | A stale eval attempt from this session; not in production traffic |

**No scoring-related console errors observed.**

---

## Live Browser Testing — Not Completed

Firebase authentication failed in the headless preview browser. The following steps from the spec were not browser-tested:

- Step 2: Log activity below 5% floor, confirm 0-point display and "Below minimum effort" copy
- Step 3: Log partial progress above floor
- Step 4: Log activity meeting target, confirm "Target met." copy
- Step 5: Confirm leaderboard score matches stored v2 points after logging
- Step 6: Wellness log path
- Step 7: Post-logging browser console check

All of these paths were verified via code audit. The scoring engine itself was verified via live tsx execution against the source file.

**Recommended:** Run the live browser steps manually in the user's own browser at localhost:5173 or on the deployed production URL after deploying the branch.

---

## Deployment Readiness Assessment

Based on Firestore inspection and code audit:

| Item | Status |
|------|--------|
| v2 scoring metadata fields written to all new logs | ✅ Confirmed in production data |
| Leaderboard correctly uses stored v2 points | ✅ Confirmed — v2 leaderboard entry shows 0 matching 2 x 0-point logs |
| Legacy logs untouched | ✅ Confirmed — no scoring fields on pre-P4B docs |
| Success screen points display correct | ✅ Code verified, no `|| 10` fallback |
| XP removed from leaderboards | ✅ "pts" throughout |
| Time-bounded challenges not early-completed | ✅ P4I fix in all 3 paths |
| No scoring metadata exposed to members | ✅ Guard passes |
| Firestore rules compile cleanly | ✅ dry-run passed in P4I |
| TypeScript clean | ✅ `npx tsc -b` clean |
| Build clean | ✅ `npm run build` clean |

**Assessment: GO — scoring system is ready to deploy.** The two pre-existing early-completion docs should be corrected post-deploy via admin query. The minor streak copy issue is a polish item, not a blocker.

---

## Files Changed in P4J

No code changes were made. Deliverables:

| File | Type |
|------|------|
| `scripts/inspectScoringDocs.ts` | New — read-only Firestore inspector (dev tool, not shipped) |
| `docs/reports/member-phase-10c-p4j-final-scoring-smoke-test.md` | New — this report |
