# TIIZI-S5a — Today Member Projection / Read Model 001

**Status:** COMPLETE / FOUNDER ACCEPTED / MERGED (TIIZI-S5A-FOUNDER-ACCEPTANCE-AND-CLOSURE-001). S5b is NOT STARTED.

**Authoritative base (reconciled):** post-V1-Exclusion-Pass-001 `origin/main` @ `5d556e129defcf174ff1060dced577b5ebfc1df3`. The original implementation base was `6866e325aeb64b12d17748b4638cd500028f86ee`.

**Implementation candidate commit:** `106579d854b98bba0b69c1590fa4f6f75c279a42` (includes the endpoint, type-specific Race progress, and final regression coverage).

**Implementation and test branch:** `impl/tiizi-s5a-today-member-projection-001`.

**Authority:** [TIIZI-S5-TODAY-EXPERIENCE-CHARTER-001.md](./TIIZI-S5-TODAY-EXPERIENCE-CHARTER-001.md), Master Programme v2.24 at this reconciled revision (v2.22 at the original implementation base), Stage F Product Truth, and current Challenge/Group engine authorities. Experience Reference `Fkenogo/tiizi-prototye` @ `cfa696fbd09180c6fdaeaf14d2e8784d8b05d6a6` remains presentation reference only.

## 1. Endpoint contract

`GET /api/today` is authenticated by the existing `/api/*` authentication hook. `authenticatedMember(request)` resolves the member from the verified identity. No query or body member selector is accepted. The handler is read-only and returns one server-composed response:

```text
{
  todayContext: { serverNow, activeChallengeCount, timezoneContexts },
  requiredToday: [{ challengeId, title, challengeType, group, lifecycleState,
                    governingToday, timezone, detailPath, requirements, streak }],
  joinedChallengeProgress: [{ challengeId, title, challengeType, group,
                              lifecycleState, governingToday, timezone,
                              startDate, endDate, detailPath, progress }],
  groupChallengeOpportunities: [{ challengeId, title, challengeType, group,
                                  lifecycle/window, activities, detailPath,
                                  joinability: "not_asserted" }],
  upcoming: [{ challengeId, title, kind: "starts" | "ends",
               lifecycleDate, timezone, detailPath }],
  finalizedResults: [{ challengeId, title, finalized: true, detailPath }],
  unsupportedSections: {
    invitations: { available: false, disposition: "deferred" },
    communityMoments: { available: false, disposition: "deferred" },
    notifications: { available: false, disposition: "deferred" }
  },
  projection: { authority: "existing_challenge_reads",
                countdown: "omitted_boundary_equivalence_unproven" }
}
```

`detailPath` uses the current V2 member Challenge Detail route `/v2/challenges/:challengeId`. It deliberately does **not** use the archived Product V1 shell route `/app/challenge/v2/:id`: the V1 exclusion boundary (`AGENTS.md` §1.3, enforced by `scripts/boundaryGuard/guard.mjs`) forbids a V2-issued navigation target from reaching `/app/*`. Empty supported arrays mean no matching records; explicit unsupported capability status is separate and contains no fake cards.

## 2. Authority and field provenance

| Projection field | Existing authority reused | Boundary |
| --- | --- | --- |
| Authenticated member identity | `api/src/auth.ts`: `/api/*` `requireAuth` and `authenticatedMember` | Identity comes from verified token → member mapping, never client input. |
| Challenge set, title/type/group, lifecycle, dates/timezone, governing day, finalized marker | `api/src/challengeReads.ts`: `listVisibleChallenges` / shared summary assembly; Challenge row plus immutable config integrity check | Visibility is own participation history or Group candidate plus current live Group Membership authority. `governingToday` comes from server `dayInTimezone(now, challenge.timezone)`. |
| Own participation progress and day states | `api/src/derivedTruth.ts` via `challenge_participation_derived`, projected by Challenge reads | Uses only the requesting member's own participation episodes. Accepted applications update this existing derived authority; Today writes nothing. |
| Streak requirements | `getChallengeDetail` in `api/src/challengeReads.ts` → `getGoverningVersion` in `api/src/challengeConfigs.ts` → immutable `challenge_config_versions.snapshot` cross-checked with `challenge_activity_configs` | Current configured activities are paired with the Challenge's server `governingToday`. |
| Per-requirement completed/pending | Requirement identity from immutable config matched against the current day's own `dayStates[governingToday].activities` | This is a deterministic Today projection from existing derived truth; no persisted/client `doneToday` and no synthetic missed-day flag. |
| Together shared total, target, goal state, own contribution | Existing Challenge summary's `challenge_derived_state` plus requesting member's participation-derived cumulative total | Units/Challenge configuration stay type-specific; no summing across activities or members in Today. |
| Race own progress/completion and final position | Own participation-derived per-Activity cumulative values and existing frozen participation final projection in `challengeReads.ts`; pinned Activity targets/units from immutable Challenge config | Progress is emitted per Activity so unlike units are never combined. No live ranking is calculated. Final position is returned only when the Challenge is finalized and existing Challenge reads expose it. |
| Group-contextual candidates | `listVisibleChallenges` candidate scoping plus `GroupMembershipAuthority.resolveGroupMembershipAuthority`; own participation and Challenge lifecycle/date fields | Existing live authority proves Group visibility. Active participation excludes a Challenge. `canJoin` is not asserted; actual Join stays on its existing endpoint and authority. |
| Upcoming boundaries | Existing Challenge `startDate`/`endDate`, lifecycle and `governingToday` | S7-local-calendar-day horizon after each Challenge-local `governingToday`; date-label arithmetic only, with no reminder/notification state. |
| Finalized result references | Existing Challenge finalization marker and member-visible Challenge detail route | Link only; no result, Recognition, or milestone is inferred or recalculated. |

The list/read layer is reused rather than reproducing visibility, lifecycle, config integrity, finalization, or derived-state logic in Today. Full detail reads are requested only for active Streaks that need governing requirements and active Race Challenges that need per-Activity target/unit terms; Together uses the existing list projection. Group authority failures remain fail-closed through the Challenge read service.

## 3. Governing day and countdown

The response carries `serverNow`, and each active Challenge context carries its authoritative IANA timezone and `governingToday`. The browser must not determine the Challenge day from its device clock.

Countdown is **omitted**. Existing engine authority converts an instant to a Challenge-local date through `dayInTimezone`; no shared engine primitive maps the next local date boundary back to an absolute instant. Although `Intl` can resolve ordinary IANA boundaries, equivalence for ambiguous/nonexistent local-midnight cases and engine behavior has not been established by an existing canonical resolver or test. Returning an end instant would therefore approximate an authority that the engine does not expose. No countdown or remaining-duration field is present.

## 4. Projection semantics

- **Required today:** active, non-finalized joined Challenges within their governed date window; only Streaks currently define daily required actions. Each configured requirement is completed iff its canonical activity identity appears in that member's derived day state for `governingToday`; all others are pending. The response preserves `currentStreak`, `bestStreak`, `daysCompleted`, `lastCompletedDay`, `completionStatus`, and the governed day state. No `missedYesterday` or restart message is fabricated.
- **Active Challenge progress:** only active joined Challenges within the governed date range. Together returns existing shared total/goal and own cumulative contribution. Race returns own per-Activity progress/target/unit, completion state, and frozen position only from finalized existing truth. Streak returns current/best streak, completed days, and completion status. No cross-unit sum, calculated ranking, or Recognition.
- **Group opportunities:** existing visible Challenge candidates from Groups where current live authority confirms this member; exclude current active participation and ended/finalized/expired Challenges. Establishment and active candidates may be contextualized while their existing participation window remains open. The projection says `joinability: "not_asserted"`; it never asserts `canJoin`, ranks, scores, or auto-enrols.
- **Upcoming:** only a joined Challenge or contextual opportunity with a start/end boundary between its own `governingToday` and the next seven Challenge-local calendar dates, inclusive. No scheduler or reminder semantics.
- **Finalized results:** only joined Challenges whose existing summary says finalized; return a compact reference to the canonical detail surface.
- **No-state members:** arrays are empty, count is zero, and the response gives no invented activity, Group moment, invitation, notification, payment, or Recognition.

## 5. Query and security boundary

The endpoint makes no client API fan-out: one authenticated request composes through the established `listVisibleChallenges` service and obtains requirement detail only for active Streaks. That service performs bounded Group candidate/visibility checks and existing Challenge database reads; the Today layer adds no persistence, migration, cache, or alternate query authority. A future high-volume profile should batch/refactor the shared Challenge list service itself so all consumers benefit, rather than adding a parallel Today-specific authority.

The member ID is server-derived. Participation projections are returned only for that member. Group candidates are drawn from their current PostgreSQL membership candidates and confirmed by the live Group membership authority. There is no Operator role, Founder exception, cross-member participation/activity result, or mutation. The global `/api/*` hook denies unauthenticated requests.

## 6. Deliberately absent

S5a does not implement S5b UI, Group Feed/community moments, invitations, notifications, recommendation scoring, Recognition issuance, payment/contribution execution, Cause approval tasks, S9 scheduler, or any Challenge/participation mutation. Group Feed remains deferred to its separate follow-up. No database migration or Cloudflare configuration change was required.

Upstream capabilities still absent include the invitation inbox/read/acceptance authority, Group Feed event/read authority, notification inbox, Recognition issuance/read authority, standalone milestone records, and a canonical local-day-boundary resolver if countdown presentation is later required.

## 7. Validation evidence

Focused Today tests cover unauthenticated denial, zero-state response, no unsupported fake sections, member isolation, Streak requirements pending/completed from accepted derived truth, current day/timezone/streak projection, Group-contextual discovery with active participation excluded and no `canJoin`, simultaneous Together/Race own-progress composition with no live rank, and the inclusive seven-local-day upcoming horizon.

Validation on the final implementation source: API typecheck passed; API build passed; focused Today suite passed (5/5); relevant Challenge read/live progress/participation/activity/Streak/final-results suites passed (105/105); full API suite passed (58 files, 750 tests passed, 8 skipped, 1 file skipped because the Firestore emulator was not enabled); `git diff --check` passed. No deployment, production access, production migration, or S5b work is part of this record.

## 8. Post-V1-Exclusion reconciliation

V1 Exclusion Pass 001 (merged as `5d556e12`) replaced the retired `/v1` API prefix with the
product-neutral `/api` namespace, added the repository-root `AGENTS.md` V1 exclusion boundary, and
added the `boundary` CI gate. S5a predated that correction, so it was reconciled onto
post-Pass-001 `main` without reopening its Product Truth or broadening its scope. No projection
field, authority, boundary, or non-goal changed.

Reconciliation changes, all bounded:

1. **Canonical endpoint.** The route is registered as `GET /api/today`, composed through the
   canonical `API_PREFIX` constant (`api/src/apiPrefix.ts`) introduced by Pass 001. No hardcoded
   competing prefix architecture, and no `/v1` alias, redirect, compatibility route, proxy, or
   fallback. `GET /v1/today` does not exist and returns 404.
2. **V1 exclusion boundary applied.** `detailPath` previously emitted the archived Product V1
   shell route `/app/challenge/v2/:id`. It now emits the current V2 route
   `/v2/challenges/:challengeId`. This was a genuine architectural defect exposed by the new
   structural guard, not a missing feature: a V2-issued navigation target must not reach `/app/*`.
   The guard was not weakened.
3. **Programme record.** The programme version is v2.24; v2.23 is retained as the V1 Exclusion
   Pass 001 record and was neither overwritten nor duplicated.
4. **Namespace/API contract coverage** extended so the contract suite asserts authenticated
   `GET /api/today`, unauthenticated `GET /api/today` rejection, and `GET /v1/today` 404.

The bounded S5a contract remains exactly as recorded in sections 1–6: authenticated member
scoping; server-authoritative `governingToday`; authoritative Streak state; Together shared totals
with own contribution; Race own progress only; no invented live ranking; no recommendation
scoring; `joinability: "not_asserted"` where authority does not establish it; countdown omitted
while boundary equivalence remains unproven; no Feed, invitations, notifications, Recognition
inference, payment execution, Cause task, scheduler authority, or Today UI.

## 9. Founder acceptance and closure

**Founder disposition: S5a Today Member Projection is APPROVED.** The reconciled implementation was accepted
and merged.

| Item | Value |
| --- | --- |
| Reviewed head | `eb803bce90e823dcc613e66c491e4e8bed36f4fc` |
| Pre-merge `main` | `5d556e129defcf174ff1060dced577b5ebfc1df3` |
| Merge commit | `12ab7654632d8ce45c3a95fcf7e21b3e5afed6d2` (normal merge commit) |
| Merge path | normal merge — no squash, no rebase-merge, no force, no protection bypass |
| Ancestry | reviewed head verified ancestor of resulting `main` |
| Repository CI (reviewed head) | api, api contract (/api namespace), api image, boundary (V1 exclusion + API namespace), functions, web — **all green** |
| External check | Cloudflare Workers Builds — fail, **non-gating under FD-S3-005** |
| Deployment | none |

Accepted on merge, unchanged from the reconciled candidate:

- `GET /api/today` is the canonical Today member projection, registered through the canonical `API_PREFIX`
  namespace introduced by V1 Exclusion Pass 001.
- There is no `/v1` Today endpoint and no `/v1` compatibility alias, redirect, proxy or fallback.
- The permanent V1 exclusion boundary is preserved and enforced in CI.
- The Challenge detail path is the current V2 route `/v2/challenges/:id`.
- Existing Product Truth authorities are preserved: authenticated member scoping; server-authoritative
  `governingToday`; authoritative Streak state; Together shared totals with own contribution; Race own progress
  only; no invented live ranking; no recommendation scoring; `joinability: "not_asserted"` where authority does
  not establish it.
- Countdown remains omitted while governing-day boundary equivalence remains unproven.
- No Feed, invitation, notification, Recognition, payment, Cause or scheduler authority, and no Today UI.

Explicitly not started or not implemented: **S5b — Today Experience Assembly (NOT STARTED)**;
**S5c — Founder Preview (NOT STARTED)**; **Group Feed (NOT IMPLEMENTED — deferred to its separate follow-up)**;
**V1 Pass 002 (NOT STARTED)**.
