# TIIZI-S5b — Today Experience Assembly 001

**Status:** S5b COMPLETE / FOUNDER ACCEPTED / MERGED (PR #70). S5c remains OPEN pending Founder desktop visual verification required by S5 charter §6; S5 is not closed. This record preserves S5b acceptance and evidence; see [`TIIZI-S5C-FOUNDER-PREVIEW-ACCEPTANCE-001.md`](./TIIZI-S5C-FOUNDER-PREVIEW-ACCEPTANCE-001.md).

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
| 3 | Your Challenges — active joined progress, deduplicated against Do today | `joinedChallengeProgress[]`: `challengeType`, `title`, `group.name`, `startDate`, `endDate`, `detailPath`, and the type-specific `progress`. Presentation rule: a Challenge already represented in Do today is not immediately repeated here; the remaining items keep exact server order and the limit of 2 applies after deduplication |
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

Two presentation defects were found and fixed in the Development preview: the pending-requirement marker
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
- **Zero state** — a member with no authoritative content sees a product empty state ("Ready to get
  moving?") with a real next step; no engineering copy, and the former `V2TodayPlaceholder` / "Next: Today
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
- Initial S5b Today guard run (`npm run test:s5b-today`, 49 checks at the original candidate) — pass; the current Correction 001C suite contains 63 checks.
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
  Live authenticated API/Today preview: PASS.

### Acceptance target

The ordinary Tiizi member application is MOBILE-FIRST. Phone/mobile is the primary Founder
acceptance target for the member Today experience; wider layouts remain technically responsive,
and desktop visual verification is not an S5b acceptance gate. (Desktop is primarily relevant to
the Platform Operator Console, whose requirements are unchanged.)

## 8. Deliberately absent

No Group Feed, community moments, invitation inbox, notification badge/count, recommendation engine,
personalized ranking, Recognition, donation/payment CTA, Social Cause task, scheduler control, fake
analytics, prototype review fixture, Reference Mode chrome, hardcoded countdown, V1 route, or `/app/*`
link. No API, schema, migration, or domain-authority change. No deployment.

## 9. Founder review correction 001 (bounded, presentation-only)

The Founder performed a first visual/product review of the candidate and returned four bounded
findings. No Product Truth, API contract, schema, migration, engine, authority, or namespace change
resulted. `GET /api/today` is untouched.

**Founder-observed functional evidence (recorded, not overstated):** the Founder manually verified
Today → Challenge → Log Activity → governed activity application → return/refresh of Today → the
previously pending requirement displayed as completed. This is evidence that the governed logging
path works end to end from Today; it is NOT acceptance of all S5b.

1. **Concise Today (progressive disclosure).** Today must stay an action-oriented home, not a
   catalogue. `Your Challenges`, `In your Groups`, and `Coming up` now initially present the first
   two served items in exact server order behind an accessible View more / Show less toggle
   (`visibleSectionItems()` in `todayView.ts`; expansion is local presentation state only; no API
   pagination, no reordering, no recomputed counts). `Do today` is deliberately never limited —
   required actions are never hidden to shorten the screen.
2. **New-member zero state.** Verified against the live server: a legitimate member with no
   participation returns `requiredToday = 0, joined = 0, opportunities = 0, upcoming = 0,
   finalized = 0`, and Today renders the product zero state ("Nothing needs you today"). The
   primary CTA remains Find a Challenge (`/v2/challenges`, the governed Challenge browse surface);
   a secondary Find a Group action leads to `/v2/groups`, which exposes the governed My Groups /
   Discover browse modes. No route was invented. A repeatable local method reviews the empty state
   without disturbing the populated scenario: `npm run preview:s5b:empty` ensures the
   `newmember@tiizi.local` identity (Auth emulator + member row only; zero fixtures), while
   `npm run preview:s5b:seed` keeps the populated `amara@tiizi.local` scenario.
3. **Activity logging phone layout.** Functional path PASS (see evidence above); the logging sheet
   was not phone-optimised. Root cause: the shared `V2Sheet` panel had no height containment or
   scroll (`max-w-3xl`, fixed padding, no safe-area handling), and the logging form had no
   long-name wrapping or viewport guards. Correction is presentation-only in the existing
   components: the sheet panel is now height-contained (`max-h-[92dvh]`) with internal scroll,
   phone-first padding plus safe-area inset (wider-layout padding unchanged), and the logging
   fields wrap long names with in-viewport inputs and a full-width phone submit. The governed
   application authority (`buildS3bActivityPayload`, idempotency, server-derived day) is unchanged;
   no second logging path, no new fields, no schema/migration change.
4. **Acceptance target.** Phone/mobile is the primary Founder acceptance target; desktop
   verification is not an S5b acceptance gate (see §7).

## 10. Founder Review Correction 001A — presentation deduplication (bounded, presentation-only)

The Founder observed that a Streak Challenge with governing-day requirements (Morning Momentum)
appeared twice on the same screen: in Do today and immediately again in Your Challenges. The
Experience Reference hierarchy does not require this duplication, so Today now composes the two
sections without immediate repeats.

Rule: for presentation of Your Challenges only, a `joinedChallengeProgress` item whose
`challengeId` is already represented in `requiredToday` is excluded. Exact relative server order
of every remaining item is preserved; nothing is sorted; the projection is not mutated;
`GET /api/today` is untouched. The existing limit of 2 applies AFTER this deduplication
(e.g. requiredToday A with joined A,B,C,D renders Do today A, Your Challenges B,C initially,
D behind View more). A joined Streak absent from `requiredToday` remains eligible in Your
Challenges. If deduplication leaves zero items, Your Challenges is omitted entirely. Do today
remains unlimited. Implementation: `presentedJoinedChallenges()` in `todayView.ts`; guards J1–J6.
This is UI composition only — not an API, Product Truth, engine, filtering, or schema change.

## 11. Founder Review Correction 001B — first-visit copy, empty header, and member logging geometry

This bounded presentation correction responds to the Founder's follow-up review. It does not change
`GET /api/today`, Product Truth, schemas, migrations, Challenge engines, or activity-application
authority.

1. **New-member copy.** The previous headline, “Nothing needs you today,” was rejected because it
   could make a new member feel unwanted. The empty state now says **“Ready to get moving?”** and
   **“Join a Challenge to start tracking activities and progress here.”** The existing Find a
   Challenge (`/v2/challenges`) and Find a Group (`/v2/groups`) actions remain. No fixture, suggested
   activity, recommendation, or progress is introduced.
2. **Empty header.** The separator was rendered unconditionally even when `governingDayFor()` returned
   `null`, producing “• 0 active Challenges.” An empty member projection has no Challenge timezone
   context or governing day; its authoritative `serverNow` supports the greeting only, not a
   Challenge-governed display date. The date and separator now render together only when a governed
   date exists. For the genuine empty projection, the header shows **“0 active Challenges.”** No
   device-clock date is substituted and the empty projection remains unchanged.
3. **V2Sheet consumer audit and geometry root cause.** `V2Sheet` is rendered as a fixed viewport
   overlay from the React component tree; it is not mounted inside or clipped by the member shell.
   `V2MemberShell` contains routed content in a centered `max-w-6xl` main, but the sheet panel is
   fixed to the viewport. The panel's default `max-w-3xl` therefore allowed Log activity to grow to
   desktop-dialog width in a wide browser, despite its responsive fields. The correction adds an
   explicit `variant="member"` with a `max-w-md` panel and opts in only the logging dialog. Default
   sheet geometry is unchanged for other consumers.

   | Consumer | Purpose / context | Geometry impact |
   | --- | --- | --- |
   | `src/v2/member/MemberShell.tsx` | Member account actions | Keeps default width; short list content. |
   | `src/v2/challenges/V2ChallengeHero.tsx` | Challenge description in member detail | Keeps default width for readable long-form text. |
   | `src/v2/challenges/V2ParticipationSection.tsx` | Leave confirmation in member detail | Keeps default width for confirmation copy and actions. |
   | `src/v2/challenges/V2LoggingSection.tsx` | Activity form and accepted Recorded result in member detail | Uses member width; form and success content share the same V2Sheet wrapper. |
   | `src/v2/groups/V2HostedChallengeCard.tsx` (two instances) | Join confirmation in member Group surfaces | Keeps default width for confirmation copy and actions. |
   | `src/v2/groups/V2GroupHomeScreen.tsx` | About this Group in member Group detail | Keeps default width for longer Group information. |

   There are seven rendered V2Sheet instances across six consumer files; all are member-facing, and
   none is an Operator Console surface. The change preserves height containment (`max-h-[92dvh]`),
   internal vertical scrolling, bottom safe-area padding, existing phone-first padding, and the
   logging form's wrapped activity names, shrinkable fields, and full-width phone action. The
   Recorded/success state uses the same constrained parent panel as the form. At phone widths the
   sheet remains full-width within the viewport; on a wide localhost preview the member logging
   panel caps at `max-w-md` (28rem) rather than expanding toward `max-w-3xl`.
4. **Logging authority.** `buildS3bActivityPayload`, `deriveSubmitKey`, `useLogActivityV2`, the
   server-derived governing day, idempotency, API schema, and Challenge Activity authority are
   unchanged. No second submission path was added.
5. **Validation and preview.** Correction 001B guards cover the approved copy, omitted empty-date
   separator, explicit member sheet variant, shared form/Recorded geometry, containment, and
   unchanged logging authority. The suite contained 56 checks after Correction 001B (49 at the initial candidate); Correction 001C brings the current suite to 63 checks.

### Correction 001B verification record

**Observed verification (2026-10-03):** `origin/main` at start was
`44a32d2d26f09ab68f6f548d52db9b24e26dd287`; PR #70's Founder-supplied verified starting head was
`867f8e6da34876aa73d9dd9addb402a5551bb4a4`. Work was performed in the clean existing
`impl/tiizi-s5b-today-experience-assembly-001` worktree.

- **Amara / populated Today:** `/v2/today` showed Morning Momentum once under Do today, with Reps
  Race and Summit Steps Together under Your Challenges. With only two challenges, no View more was
  shown. The governed activity form accepted a 20-rep Push-Up entry and returned **Recorded**, 100
  points, Challenge day `2026-10-03`; returning to Today refreshed Push-Up to Done and showed 1/2
  requirements complete. The outstanding Breathing Practice remained pending.
- **Logging geometry:** in a wide localhost browser the member app stayed centered and the logging
  sheet remained capped by the `max-w-md` member variant. At a phone-like 390 × 844 viewport, the
  form fit the viewport with the selector, amount and datetime fields, Close, and full-width Log
  activity action visible; the panel retained vertical scrolling. The Recorded state used the same
  width and remained contained with Close, Log another, and Done accessible. No horizontal overflow
  was visible. Safe-area padding remains in the shared panel.
- **Empty projection and new-member preview:** the S5a Today projection API suite passed 5/5,
  including the empty-member contract: active count zero and all five content arrays empty. No API
  or projection code changed. The supplied handover records the genuine `newmember@tiizi.local`
  projection as zero participation and zero content. This session did not reopen that identity in
  the browser because `TIIZI_S5B_EMPTY_PREVIEW_PASSWORD` is unset in the shell and local env files;
  the empty-preview script requires that existing local credential, and it was not reset or replaced.
  The new copy, routes, and orphan-separator behavior are covered by S5b guards. Thus the current
  browser rendering of the new-member page remains **not re-verified in this pass**.
- **Checks:** S5b Today guards 56/56; V1 boundary and regression guards; V2 experience/runtime and
  frontend guards; S3b activity-logging and S3b CORR-001 guards; frontend TypeScript check and
  production build; S5a Today projection tests 5/5; `git diff --check` — all pass. The standard
  `tsx` launcher initially hit a sandbox IPC `EPERM`; the TypeScript guard files passed when run via
  `node --import tsx`. GitHub Actions for implementation commit `6734126` passed across API,
  API contract, API image, boundary, functions, and web. The separate Cloudflare Workers Build
  check failed; it remains non-gating under the recorded FD-S3-005 treatment.

At this point in the historical candidate record, S5b remained **IMPLEMENTED CANDIDATE / FOUNDER
REVIEW CORRECTIONS APPLIED / AWAITING FINAL FOUNDER RE-REVIEW**. Its later Founder disposition and
merge are recorded below. S5c remains NOT STARTED; Group Feed remains NOT IMPLEMENTED (separate
follow-up); V1 Pass 002 remains NOT STARTED. No deployment occurred.

### Correction 001C — focused mobile activity logging

**Founder disposition:** populated Today behavior and the new-member state are accepted. This
includes Morning Momentum once under Do today; Reps Race and Summit Steps Together under Your
Challenges without an unnecessary View more; and the empty state “Ready to get moving?” with its
approved supporting copy, Find a Challenge / Find a Group links, and the `0 active Challenges`
header without an orphan separator. These accepted states are unchanged by this correction.

The remaining Founder finding concerned visual focus: Challenge details competed with the activity
task behind the constrained logger. The logging consumer now explicitly opts into V2Sheet's focused
presentation: a dark, blurred viewport backdrop, modal interaction isolation, focus containment and
restoration, Escape dismissal, a scroll-locked background, a fixed Close header, and an independently
scrollable mobile-bounded panel. The Recorded result stays inside that same presentation. Other
V2Sheet consumers retain their prior variant and geometry; the shared primitive gained an opt-in
capability only.

Activity Product Truth is unchanged: the existing S3b payload, submit key, hook, API, server-derived
governing day, timezone authority, idempotency, scoring, and acceptance path remain the sole
submission path. The final phone-sized Amara preview showed the dimmed/blurred Challenge page behind
both the form and Recorded state. At the time of this correction record, the activity-logging visual
review remained pending; the later acceptance is recorded below.

Correction 001C validation: S5b Today guard suite **63 checks**; boundary guard and regression; V2
experience, runtime, and frontend boundaries; S3b logging and correction guards; frontend TypeScript
typecheck and production build; S5a projection tests 5/5; `git diff --check` — all pass. The S5b
candidate was awaiting final activity-logging visual review at this point in the Correction 001C
record; see §12 for the later acceptance and merge. S5c NOT STARTED; Group Feed NOT IMPLEMENTED
(follow-up); V1 Pass 002 NOT STARTED.

## 12. Founder acceptance and merge closure

**Founder disposition (2026-10-03): ACCEPTED.** The Founder reviewed and accepted the final focused
mobile activity-logging presentation, including task focus, obscured Challenge background,
mobile-bounded geometry, accessible Close and primary action, contained vertical scrolling, and the
Recorded state within the same presentation. The Founder also accepted the previously reviewed
Today composition, deduplication, two-item progressive disclosure, Today refresh after logging,
new-member zero state, and existing Product Truth / governed activity authority.

Accepted Today behavior includes Morning Momentum appearing once in Do today; Your Challenges
showing Reps Race and Summit Steps Together without repeating Morning Momentum; and no unnecessary
View more when only those two challenges remain. Logging refreshes Today. The accepted new-member
state reads “Ready to get moving?” and “Join a Challenge to start tracking activities and progress
here.”, offers Find a Challenge and Find a Group, and shows truthful “0 active Challenges” without
an orphan separator.

**Implementation merge:** PR #70, reviewed head
`9e20cff8c86aa7d460b2bdb79dc5eb72cb119898`; pre-merge `origin/main`
`44a32d2d26f09ab68f6f548d52db9b24e26dd287`; normal merge commit
`2827aa8b2d35421a0b654032c3e750682ed54d86`; merged `2026-10-03T11:22:11Z`. The reviewed head is
an ancestor of post-merge `origin/main` at that merge commit.

On the exact reviewed head, all six repository CI jobs passed: API, API contract, API image,
boundary, functions, and web. The separate Cloudflare Workers Build failed and remains distinct
under FD-S3-005. S5b guards passed **63/63**; S5a projection passed **5/5**; boundary and regression,
V2 experience/runtime/frontend, S3b activity logging, and S3b logging correction guards passed.

Activity Product Truth remains unchanged: logging still uses the sole governed S3b path, with its
existing API, server-derived governing day, timezone authority, idempotency, and scoring. No API,
schema, migration, engine, deployment, or Cloudflare change was introduced by Correction 001C.

**Final programme status (at this entry):** S5b TODAY EXPERIENCE ASSEMBLY — COMPLETE / FOUNDER ACCEPTED / MERGED;
At the time of this historical S5b closure, S5c was NOT STARTED. Subsequent evidence reconciliation found the charter-required desktop review unproven; S5c remains OPEN pending Founder desktop visual verification. Group Feed NOT IMPLEMENTED — FOLLOW-UP REQUIRED. V1 Pass 002 NOT STARTED.

S5c was subsequently entered as an evidence gap in Master Programme v2.29; desktop visual verification remains outstanding and S5 is not closed. See
[`TIIZI-S5C-FOUNDER-PREVIEW-ACCEPTANCE-001.md`](./TIIZI-S5C-FOUNDER-PREVIEW-ACCEPTANCE-001.md). This entry's status is preserved as the historical record at the time of the S5b closure.


**Desktop evidence clarification (2026-10-03):** the wide-browser logging-sheet geometry observation in §11 is implementation verification, not an attributable Founder review of the assembled Today experience. The charter §6 desktop review requirement remains open; this historical S5b record does not waive it.
