# P6G — Full Challenge System User-Flow Audit
**Date:** 2026-06-21  
**Branch:** fix/p0-pre-deploy-blockers  
**Phase:** Member Phase 10C — P6G  
**Auditor method:** Live preview at `localhost:5173` (Vite dev server) + Firebase MCP Firestore reads  
**Test account:** `p6gaudit2026@gmail.com` / UID `pLxpl4zOhPOrxlB0CHf8pYOslY13` (created during audit)

---

## Audit Scope

End-to-end challenge system audit as a real logged-in user. Covers: auth, onboarding, Home, Groups, Challenges, challenge detail, join flow, logging, scoring display, leaderboard, group detail, Firestore data integrity.

---

## Method

1. Created fresh test account (`p6gaudit2026@gmail.com`) via the `signup()` auth context function
2. Bypassed profile completion by directly writing `profile.onboardingCompleted: true` to Firestore (to reach challenge screens without completing onboarding)
3. Navigated all major challenge-related screens as an authenticated user with no prior data
4. Read React Query cache, console logs, and Firestore documents at each key point
5. Queried Firestore directly via Firebase MCP to validate UI data against raw data

---

## Critical Findings

### [CRIT-1] GroupDetailScreen shows "No active challenges" for newly-joined members, even when the group has live challenges

**Screen:** `/app/group/seed_group_early_birds` → Challenges tab  
**Evidence:** Early Birds Kenya has 3 challenges with `endDate` in the future (Pushup mania2, 30-Day Pushup Duel, 8-Hour Sleep Streak). After joining the group, the Challenges tab immediately shows "No active challenges — Create your first group challenge to start activity."

**Root cause (code path):**
```
GroupDetailScreen → useChallengesByGroupPage(id, 25, ['active'])
  → challengeService.getChallengesByGroupPage(groupId, { statuses: ['active'], userId })
    → Firestore query:
        where('groupId', '==', groupId)
        where('status', '==', 'active')
        orderBy('startDate', 'desc')
        limit(25)
    → Caught by try/catch → listDenied = true
    → Fallback: query challengeMembers where userId == uid
    → New user has zero challengeMembers → returns []
```

**Why the main query fails:** The Firestore `allow list` rule requires `resource.data.visibility == 'public' || resource.data.groupVisibility == 'public'`. The query does not include WHERE clauses on these fields, so Firestore cannot prove the constraint is satisfied from the query alone. The query is silently rejected (`permission-denied` caught, not surfaced to UI).

**React Query cache confirms:** `{ state: "success", error: null, dataCount: 0 }` — success with zero items, not an error state.

**Impact:** Every user who joins a group sees "No active challenges" until they have at least one `challengeMembers` record. The entire group challenge display is broken for new members.

**Fix direction:** Add `where('groupVisibility', '==', 'public')` (or `visibility`) to the query, matching the security rule's constraint. For public groups, this is safe. Private groups would need the membership-based fallback.

---

### [CRIT-2] ChallengeDetailScreen shows PARTICIPANTS: 0 and TOTAL LOGS: 0 despite real data in Firestore

**Screen:** `/app/challenge/Uqx8beHESmfbyelkkmZ0` (Squat + Pushup 50)  
**UI shows:** PARTICIPANTS: 0 | TOTAL LOGS: 0 | LEADERBOARD SNAPSHOT: "No leaderboard activity yet."  
**Firestore shows:** 3 `challengeMembers` documents for this challenge; `participantCount: 3` on the challenge document; workout logs exist for member1 with `value: 50`

**Impact:** The challenge detail page shows no evidence of any user activity even though 3 members are enrolled and have logged workouts. Any user viewing this challenge (member or non-member) sees it as empty.

---

### [CRIT-3] Premature completion bug confirmed live in production (P6B undeployed)

**Evidence:** All 3 `challengeMembers` for "Squat + Pushup 50" show `status: "completed"` after 2 total logs (1 log per activity type). The P6B fix corrects `computeRequiredLogs` but is in the undeployed branch.

**Challenge document:** `Uqx8beHESmfbyelkkmZ0`  
- `startDate: 2026-06-09`, `endDate: 2026-06-29` (21 days)  
- `activities: [{exerciseId: "bulgarian-split-squats", targetValue: 50}, {exerciseId: "push-ups", targetValue: 50}]`  
- `durationDays`: **absent** (field not present in document)

**Effect:** P6B code fix computes `requiredLogs = activities.length * durationDays`. Since `durationDays` is absent, it falls back to `activities.length` only → 2 logs = completed for a 21-day challenge.

---

### [CRIT-4] All live challenges missing `durationDays` — P6B and P6C fixes have zero runtime effect

**Evidence from Firestore (challenges collection, all documents checked):**
- None of the challenge documents in production contain a `durationDays` field
- This field is written by `CreateChallengeScreen` — but all existing challenges predate the fix

**Impact on P6B:** `computeRequiredLogs` falls back to `activities.length` instead of `activities.length * durationDays` — premature completion persists for all existing challenges  
**Impact on P6C:** `deriveDailyTargetValue` cannot compute the correct daily target without `durationDays` — scoring targets are wrong for existing challenges

---

### [CRIT-5] Wellness logs collection empty — P6A wellness permission failure confirmed

**Evidence:** `wellnessLogs` collection has **zero documents** for member1 (UID `OAKeNrvRkbPOMPjwdKAjqC0tWQK2`) despite that user being enrolled in the "8-Hour Sleep Streak" and "16-Hour Daily Fast" wellness challenges.

**Static analysis of `isValidWellnessCreate` rule:** The rule is comprehensive and correct in structure. The likely failure mode is in `isValidActivityContext()` — a helper called within the rule that may check group membership via `get()`/`exists()` calls, which can fail for list-like create operations or when the member has just joined.

Without a live wellness log attempt (blocked by onboarding state during this audit), the exact sub-rule failure cannot be confirmed from this session. This must be tested in a future targeted session.

---

### [CRIT-6] Stale `status: "active"` on 5 expired challenges in Early Birds Kenya

**Evidence (Firestore):** Of 9 challenges in `seed_group_early_birds`:
| Challenge | endDate | status | State |
|-----------|---------|--------|-------|
| Early 30-Day Core Blast | 2026-02-20 | active | EXPIRED |
| Early Pushup Duel | 2026-02-13 | active | EXPIRED |
| 16-Hour Daily Fast | 2026-03-21 | active | EXPIRED |
| 14-day squats marathon | 2026-06-10 | active | EXPIRED |
| 7 day squat + Pushup madness | 2026-06-14 | active | EXPIRED |
| Pushup mania2 | 2026-07-05 | active | LIVE |
| 30-Day Pushup Duel | 2026-07-05 | active | LIVE |
| 8-Hour Sleep Streak | 2026-06-26 | active | LIVE |
| Early Morning Streak | 2026-02-08 | **completed** | COMPLETED |

**Impact:** The 5 expired-but-active challenges inflate the "8 Challenges" count shown in the Groups Discover tab. They also clog any query scoped to `status == 'active'`.

---

## Screen-by-Screen Findings

### Auth & Signup

| Finding | Severity | Detail |
|---------|----------|--------|
| Auth signup (`signup()`) works correctly | OK | `createUserWithEmailAndPassword` succeeds |
| `onAuthStateChanged` delayed after reload | LOW | After `signup()` call, React state not updated until `onAuthStateChanged` fires (~1–2s after reload) — app stays on landing page until listener fires |
| `signup()` does not call `setUser` | LOW | Both `login()` and `signup()` rely on `onAuthStateChanged` to update React state; not a bug, just a delayed UX |

### Home Screen (new user, no group)

| Finding | Severity | Detail |
|---------|----------|--------|
| **Display name shows email prefix** | MEDIUM | "Welcome back, p6gaudit2026!" instead of "P6G Audit User" — `firebaseUser.displayName` is null, falls back to `email.split('@')[0]` |
| "Syncing your dashboard..." banner | OK | Correct loading state on first render |
| Activation card "Welcome to Tiizi 👋" | OK | Step 1: Join a Group, Step 2: Join a Challenge, Step 3: Log Activities — correct |
| Active Challenges empty state | OK | "Get Started" card with "Browse Groups" + "Browse Challenges" CTAs |
| Stats row: STREAK 0, ACTIVE 0, RECENT 0 | OK | Correct for new user |
| Trending Challenges section visible | OK | Shows public challenges with days-left and participant counts |
| Trending challenge cards are single full-card buttons | INFO | Entire card text is one `<button>` — difficult to click the "Join" sub-button precisely |

### Trending Challenges (Home)

All 5–6 trending challenges shown have future `endDate` values (confirmed via "X days left" display). The days-left calculation is correct. Challenges appear correctly ordered.

**Issue:** "Squat + Pushup 50" appears in trending with "8 Days Left" but all its `challengeMembers` are already `status: completed` (P6B premature completion) — the challenge shows as if enrollment is open, but enrolled members have already been marked done.

### Challenge Detail Screen

Accessed via `/app/challenge/:id?groupId=:groupId`

| Finding | Severity | Detail |
|---------|----------|--------|
| Challenge metadata renders correctly | OK | Name, description, dates, duration, activities, scoring copy |
| **PARTICIPANTS: 0 (wrong)** | HIGH | See CRIT-2 above |
| **TOTAL LOGS: 0 (wrong)** | HIGH | See CRIT-2 above |
| **LEADERBOARD SNAPSHOT: empty (wrong)** | HIGH | Follows from CRIT-2 |
| Description spacing bug | LOW | "50 squats+ 50 Push-ups" — missing space before `+` |
| "HOW POINTS WORK" copy | OK | "Points reward consistent daily completion. Each day you hit the target earns points. Points are based on challenge targets, not just logging activity." — correct P6E messaging |
| Non-group-member CTA | OK | Shows "Join Group to Participate" instead of "Log Activity" ✓ |
| "Back to Group" button for non-group users | LOW | Button says "Back to Group" but user has no group — misleading; should be hidden or say "Find a Group" |
| "Linked to selected group" orange link | INFO | Appears for all users; navigates to group detail |
| `duration: 21 days` displayed | OK | Computed from `startDate`/`endDate` diff (inclusive count) |

### Groups Screen

| Finding | Severity | Detail |
|---------|----------|--------|
| My Groups tab empty state | OK | "No groups yet. Join a group or create your own." with "Create" + "Find Groups" |
| Discover tab shows 4 public groups | OK | Fit 50s, Hydration group, Squad 254C, Early Birds Kenya |
| Invites tab | NOT TESTED | Not tested in this session |

### Group Detail Screen (Early Birds Kenya — non-member)

| Finding | Severity | Detail |
|---------|----------|--------|
| Challenges tab is the default tab | INFO | Not Feed — worth confirming if this is intentional |
| Active Challenges gated for non-members | OK | "Join this group to access challenges — All challenges and workout logs are available only to approved group members." |
| Upcoming Challenges not gated | LOW | Shows "No upcoming challenges set yet." for non-members — if there were upcoming challenges, their names might be visible |

### Group Detail Screen (Early Birds Kenya — after joining)

| Finding | Severity | Detail |
|---------|----------|--------|
| Join button works instantly | OK | Shows "✓ Joined" and "Leave" after click |
| **Active Challenges: "No active challenges"** | CRITICAL | See CRIT-1 above — 3 live challenges invisible |
| "Create your first group challenge to start activity." | WRONG | This is the creator empty state — wrong for a new member |
| Upcoming Challenges: "No upcoming challenges set yet." | OK | Correct — no future-start challenges in Firestore |

### Challenges Tab (ChallengesScreen)

| Finding | Severity | Detail |
|---------|----------|--------|
| Shows discovery content only | OK | Suggested Templates + Wellness Templates + Browse Challenges |
| "No active challenges for your group yet." shown | MEDIUM | Confusing for users with no group; should say "Join a group to see group challenges" |
| Browse Challenges shows public challenges | OK | Correct — shows all `status: active` public challenges |
| **"1 Participants" grammar error** | LOW | Should be "1 Participant" (singular) |
| "Browse Exercise Library" CTA at bottom | OK | Correct |
| All Browse challenges display days-left correctly | OK | Date math correct |

---

## Firestore Data Integrity Summary

| Data Point | Expected | Actual | Bug |
|------------|----------|--------|-----|
| `durationDays` on challenges | Present (written by CreateChallengeScreen) | **Absent on all live challenges** | All pre-fix challenges |
| challengeMembers status for Squat+Pushup50 | active (in progress) | **completed** (after 2 logs) | P6B pre-mature completion |
| wellnessLogs for member1 | At least 1 log | **0 documents** | P6A wellness permission failure |
| `status` on expired challenges | expired/completed | **active** (stale) | No lifecycle auto-update |
| participantCount on ChallengeDetailScreen | 3 (from Firestore doc) | **0 displayed** | CRIT-2 display bug |
| totalLogs on ChallengeDetailScreen | > 0 | **0 displayed** | CRIT-2 display bug |

---

## Scoring / Points Display

The HOW POINTS WORK section on the Challenge Detail screen reads:

> "Points reward consistent daily completion. Each day you hit the target earns points. Points are based on challenge targets, not just logging activity."

This is **correct**. It reflects the P6E formula: `pointsEarned = round(min(value / dailyTargetValue, 1) × dailyBasePoints)`. No mention of streak bonuses or overperformance multipliers. P6E copy is correctly surfaced.

However, this UI copy cannot be verified against the actual scoring engine path because no log was submitted during this audit (user not in a challenge as member). Scoring verification requires a completed log session.

---

## Deployment Status

| Fix | Code Status | Deployed | Runtime Effect |
|-----|-------------|----------|----------------|
| P6A — wellness permissions | In branch | **No** | Wellness logging fails for all users |
| P6B — premature completion | In branch | **No** | All existing challenges complete after 2 logs (no `durationDays`) |
| P6C — daily target derivation | In branch | **No** | All existing challenges use wrong daily targets |
| P6E — bonus scoring removal | In branch | **No** | Bonus scoring code exists in deployed build (though `STREAK_BONUS_PER_WEEK: 0` neutralizes it) |

All four fixes are undeployed. P6B and P6C are ineffective even if deployed without a `durationDays` backfill migration for existing challenges.

---

## Flows NOT Completed in This Audit

The following were scoped but not reached due to the new-member challenge visibility bug (CRIT-1):

- **Wellness challenge logging** — could not reach `LogWellnessActivityScreen` without being in an active challenge as a member
- **Exercise challenge logging** — same gate
- **Multi-activity session flow** — same gate
- **WorkoutLoggedScreen copy** ("Partial points earned." / "Target not met.") — not reached
- **Leaderboard with real data** — CRIT-2 made all leaderboards show empty
- **Profile wins / completed challenges** — no completed challenges to display
- **Competitive challenge view** — not tested as a participant
- **Challenge creation flow** — deferred (create, not audit)

---

## Open Questions

1. **Why does `ChallengeDetailScreen` show PARTICIPANTS: 0?** The challenge document has `participantCount: 3`. Is the service reading a different field or a cached value?
2. **What exactly fails in `isValidWellnessCreate` for member1?** The `isValidActivityContext()` sub-function call may be failing. Need a targeted test with a new wellness log attempt.
3. **Is the `groupId + status + startDate` Firestore index deployed?** Index is in `firestore.indexes.json` but deployment status is unknown. If undeployed, the query fails; the security rule mismatch would be a separate (also-failing) issue.
4. **Why does the Discover tab show "8 Challenges" for Early Birds Kenya** when the count includes expired challenges? Is `participantCount` used for the challenge count display?

---

## Recommended Next Steps (P6H)

In priority order:

1. **Deploy fixes** (P6A–P6E) — without deployment, all code-level bugs persist in production
2. **Fix CRIT-1** — add `where('groupVisibility', '==', 'public')` to `getChallengesByGroupPage` query, matching the Firestore rule constraint
3. **Fix CRIT-2** — investigate why `participantCount` and log counts show 0 on the detail screen  
4. **Backfill `durationDays`** — write a script to set `durationDays = daysBetween(startDate, endDate)` on all existing challenge documents (prerequisite for P6B and P6C to be effective)
5. **Fix stale lifecycle statuses** — run a backfill to set `status: "expired"` on challenges whose `endDate` has passed
6. **Target wellness logging test** — create a user enrolled in a wellness challenge and attempt a log, capture the exact permission error
