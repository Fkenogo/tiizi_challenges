# TIIZI-S5b — Today Experience Assembly 001

**Status:** IMPLEMENTED CANDIDATE / AWAITING FOUNDER REVIEW. S5c is NOT STARTED.

**Authoritative base:** `origin/main` @ `44a32d2d26f09ab68f6f548d52db9b24e26dd287`
(post S5a closure, Master Programme v2.25).

**Scope:** replace the `/v2/today` placeholder with the real member Today experience.
Presentation-only assembly over the existing server projection; no API, schema, migration,
or domain-authority change.

**Authority:** [TIIZI-S5-TODAY-EXPERIENCE-CHARTER-001.md](./TIIZI-S5-TODAY-EXPERIENCE-CHARTER-001.md),
[TIIZI-S5A-TODAY-MEMBER-PROJECTION-001.md](./TIIZI-S5A-TODAY-MEMBER-PROJECTION-001.md) (the read model
consumed), Stage F Product Truth, and current Challenge/Group engine authorities. Experience Reference
`Fkenogo/tiizi-prototye` @ `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6` remains presentation reference only.
The namespace and V1 exclusion rules in [`AGENTS.md`](../../AGENTS.md) apply unchanged.

## 1. What Today is

Today is the member's action-oriented home, assembled from the single server-composed
`GET /api/today` projection (S5a). It answers, in order:

1. **What do I need to do today?**
2. **How am I doing in my active Challenges?**
3. **What else can I take part in?**

Every value is rendered as served. Today derives no domain truth: it does not compute the governing
Challenge day, streak state, progress, ranking, or joinability, and it never reads the device clock to
decide a Challenge day.

## 2. Sections assembled

| # | Section | Source fields consumed |
| --- | --- | --- |
| 1 | Today header — contextual greeting, governing day context, active Challenge count | `todayContext.serverNow`, `todayContext.activeChallengeCount`, `todayContext.timezoneContexts[]`, and the governing day from the first timezone context |
| 2 | Do today — Streak requirements for the governing day | `requiredToday[]`: `title`, `group.name`, `challengeType`, `requirements[]` (`label`, `targetValue`, `unit`, `state`), `streak.currentStreak/bestStreak/daysCompleted`, `detailPath` |
| 3 | Your Challenges — active joined progress | `joinedChallengeProgress[]`: `challengeType`, `title`, `group.name`, `startDate`, `endDate`, `detailPath`, and the type-specific `progress` |
| 4 | In your Groups — Group-contextual opportunities | `groupChallengeOpportunities[]`: `title`, `group.name`, `challengeType`, `startDate`, `endDate`, `activities[].name`, `detailPath`, `joinability` |
| 5 | Coming up — authoritative lifecycle boundaries | `upcoming[]`: `title`, `kind`, `lifecycleDate`, `detailPath` |
| 6 | Recent results — finalized references only | `finalizedResults[]`: `title`, `detailPath` |

Type-specific progress presentation:

- **Together** — shared total against the shared goal, goal-reached state, member's own contribution
  (`groupTotal`, `target`, `unit`, `goalReached`, `memberContribution`). Progress-bar width clamps at
  100%; the displayed values stay exact.
- **Race** — own per-Activity progress against its own target (`activities[].memberProgress`,
  `targetValue`, `unit`). No live ranking, order, or position is computed. A frozen `finalPosition` is
  shown only when the server supplies one.
- **Streak** — Today's requirements stay in the higher-priority Do today section; the Challenge card
  carries compact streak context only.

Two presentation defects were found and fixed in the Founder preview: the pending-requirement marker
previously rendered a colour-hidden tick, and the preview identity had no display name.

## 3. Prototype decisions applied

The Experience Reference dispositions recorded in the S5 charter §3 are applied exactly:

| Prototype element | Disposition | Applied |
| --- | --- | --- |
| Today greeting and action-home hierarchy | **ADOPT** | Contextual greeting, server-governed day context, active-Challenge count, action-first order, compact cards, mobile-first layout |
| Streak — action required today | **ADAPT** | Authoritative Challenge/governing-day/streak/requirement state rendered as served; direct Log action; no second Streak engine, no client `doneToday` |
| "Time remaining today" | **ADAPT (omitted)** | `projection.countdown` is `omitted_boundary_equivalence_unproven`; no countdown is invented. The authoritative governing date is shown instead |
| Active Challenge Progress | **ADOPT / ADAPT** | Compact cards linking to Challenge Detail; no ranking or result derivation |
| Challenges in Your Groups You Can Join | **ADAPT** | Contextual opportunities from current Group membership; exclusion of active participation is the server's; no inferred-interest ordering; discovery affordance only (see §4) |
| Explicit invitations | **DEFER** | Not rendered; `unsupportedSections.invitations` is not surfaced as product UI |
| Upcoming events / Challenges | **ADAPT** | Authoritative `kind` + `lifecycleDate` within the S5a seven-local-day horizon |
| Results and milestones | **ADAPT** | Compact link to an existing finalized result when the projection returns one; nothing inferred |
| Community Accountability Feed / moments | **DEFER** | Not rendered |
| Support / Social Cause | **OMIT** | No payment or support affordance |
| Prototype notification bell/badge | **DEFER** | No unread state is fabricated |
| Prototype sample fixture CTAs | **OMIT** | Not rendered |
| Reference chrome, persona switchers, simulators | **OMIT** | Not rendered |

## 4. Joinability boundary

The projection reports `joinability: 'not_asserted'`, because the server does not establish that the
member may currently join. Today therefore renders **discovery**, never an unconditional Join CTA:
each opportunity card links to the governed Challenge surface, where membership and the Challenge
window are re-proven. `opportunityAction()` fails closed if the projection ever starts asserting
joinability without this UI being reconsidered, and the S5b guards assert the rule.

## 5. Boundary compliance

- **API namespace** — one client call, `GET /api/today`, composed through the canonical `API_PREFIX`
  constant. No `/v1` request target exists.
- **V1 exclusion** — no `/app/*` target is produced or navigated to; no archived V1 module is imported;
  Challenge links use the projection's `/v2/challenges/:id` `detailPath` verbatim.
- **Routing** — every navigation target is a current `/v2/*` route.
- **Zero state** — a member with no authoritative content sees a product empty state ("Nothing needs you
  today") with a real next step; no engineering copy, and the former `V2TodayPlaceholder` / "Next: Today
  read models (S5)" text is removed.
- **Absent capability** — Feed, invitations, notifications, Recognition, milestones, payment, Cause
  tasks, scheduler controls, and fake analytics are omitted, never simulated.

## 6. Development preview seed

`npm run preview:s5b:seed` (`scripts/previewS5bSeed.ts`) populates a LOCAL Development database with
governed data. It refuses any non-development `NODE_ENV` and any non-loopback PostgreSQL or Auth
emulator target, and it never prints a secret.

Every fixture is established through the production governed path (`createChallenge` with the real
Knowledge identity/eligibility gates, `activateChallenge`, `applyChallengeActivity`), so the Today
projection is composed by the real server from real derived truth. The seed is idempotent: it reuses
its own Group and Challenges (Challenges are immutable historical records and cannot be deleted) and
identifies its activity applications by Challenge day.

Scenarios produced:

| Scenario | Fixture |
| --- | --- |
| A. Active Streak with two requirements today, one completed and one pending | `Morning Momentum` — Push-Up completed, Breathing Practice pending |
| B. Active Together with member contribution | `Summit Steps Together` — 240 of 1,000 reps, own contribution 240 |
| C. Active Race with own progress | `Reps Race` — 45 of 100 reps |
| D. Group-contextual opportunity | `Sunrise Reset` — member is not a participant |
| E. Upcoming boundary in the authoritative horizon | `Sunrise Reset` starts within seven Challenge-local days |

Not seeded, because no authority exists: Feed / community moments, invitations, notifications,
Recognition, and finalized results. Streak history is not back-filled — EBC-03 closes a governed day
when it ends and correctly refuses late logging — so the preview shows a Day 1 streak state rather
than a synthetic history.

## 7. Validation

- Frontend typecheck + production build — pass.
- S5b Today guards (`npm run test:s5b-today`, 32 checks) — pass.
- V2 experience boundary, V2 runtime boundary, V2 frontend guards — pass.
- V1 exclusion boundary guard + regression fixture — pass.
- API typecheck + build, S5a Today projection suite (5/5), `/api` namespace contract suite (59/59) — pass.
- `git diff --check` — clean.
- Founder preview at `http://127.0.0.1:5174/v2/today` against a dedicated Development database:
  all sections backed by available authoritative Development data rendered (Today header, Do today,
  Your Challenges, In your Groups, Coming up), with zero `/app/*` links and correct
  completed/pending requirement state. Recent Results was correctly omitted because the Development
  projection returned `finalizedResults = 0`: no finalized result was fabricated merely for preview
  coverage. The Recent Results rendering path exists and is covered at the code/guard level, but it was
  NOT visually demonstrated by the Development fixture. Static responsive-layout/source audit: PASS.
  Live authenticated API/Today preview: PASS. Actual Founder visual verification across
  mobile/tablet/desktop widths (including ruling out horizontal overflow or visual layout defects at
  those widths): PENDING FOUNDER REVIEW.

## 8. Deliberately absent

No Group Feed, community moments, invitation inbox, notification badge/count, recommendation engine,
personalized ranking, Recognition, donation/payment CTA, Social Cause task, scheduler control, fake
analytics, prototype review fixture, Reference Mode chrome, hardcoded countdown, V1 route, or `/app/*`
link. No API, schema, migration, or domain-authority change. No deployment.
