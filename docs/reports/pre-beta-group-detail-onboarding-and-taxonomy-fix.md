# Pre-Beta Fix: Group Detail Metadata Visibility & Existing-User Onboarding Regression

Date: 2026-07-14
Branch: `fix/p0-pre-deploy-blockers`

## 1. Root cause — Group Detail metadata invisible on real groups

Two independent, compounding causes, both proven from real code and real Firestore data (not synthetic test groups):

1. **Silent metadata-drop bug in `groupService.createGroup()` (the primary cause).** `buildGroupDefaults()`'s `GroupDefaultsInput` type only declares the lifecycle-critical fields (`name`, `description`, `ownerId`, `coverImageUrl`, `isPrivate`, `requireAdminApproval`, `allowMemberChallenges`, `inviteCode`). `createGroup()` was passing `groupType`/`activityInterests`/`wellnessTopics`/`groupGoals`/`locationScope` into the same object literal via conditional spreads (`...(input.groupType && { groupType: ... })`), but because those properties aren't part of `GroupDefaultsInput`, TypeScript's excess-property checking doesn't catch it inside a conditional spread, and `buildGroupDefaults()`'s implementation returns a **fixed-shape object that never includes those fields at all**. Every one of the 5 metadata fields was silently discarded before `addDoc()` ever ran — confirmed live by instrumenting both `CreateGroupScreen.handleCreate` (state at submit: correct) and `groupService.createGroup` (payload just before `addDoc`: fields missing) and comparing the two.
2. **A second, now-fixed bug in `buildGroupDefaults()` itself** was blocking Create Group entirely for the common case (no cover image): it unconditionally assigned `coverImageUrl: input.coverImageUrl`, and Firestore's `addDoc()` rejects a field explicitly set to `undefined`. This threw `FirebaseError: ... Unsupported field value: undefined (found in field coverImageUrl ...)` on every group creation without a cover image, so **no real group had ever been created with metadata even attempted** until this was fixed.

The route/component chain itself (Part 1) was **not** at fault — `GroupDetailScreen`, `GroupFeedScreen`, and `GroupMembersScreen` all correctly render the same `GroupSharedHeader`/`GroupDetailsModal`, with no duplicate or stale components anywhere (confirmed via `App.tsx` route registration and per-file grep). The prior session's display-layer work (`groupOptionLabels.ts`, hero pills, Group Focus/Activities/Wellness/Goals sections) was correctly built and wired — it simply had no real data to render because no real group had ever successfully persisted any.

## 2. Root cause — existing users forced back into onboarding

`getOnboardingPath()` in `src/hooks/useProfileSetup.ts` checked `hasSeenIntro` (and other newer per-step marker fields) **before** checking `onboardingCompleted === true`. Any user who completed onboarding before a newer marker field existed — confirmed via real Firestore data: **30 of 43 real users (70%) lack `hasSeenIntro`, and 39 of 43 (91%) lack `wellnessInterestsCompleted`/`privacySettingsCompleted`**, despite having `onboardingCompleted: true` — was incorrectly redirected back into onboarding on every sign-in, hard refresh, or protected deep link.

## 3. Files changed

- [src/services/groupService.ts](src/services/groupService.ts) — `createGroup()` now spreads the 5 optional metadata fields onto the payload **after** `buildGroupDefaults()` returns, instead of passing them into a function whose input/return type doesn't know about them.
- [src/utils/groupLifecycle.ts](src/utils/groupLifecycle.ts) — `buildGroupDefaults()` omits `coverImageUrl` entirely when not provided, instead of setting it to literal `undefined`.
- [src/hooks/useProfileSetup.ts](src/hooks/useProfileSetup.ts) — `getOnboardingPath()` now checks `onboardingCompleted === true` as the very first condition, before `hasSeenIntro` or any other per-step marker.
- [src/features/Groups/groupOptions.ts](src/features/Groups/groupOptions.ts) — **new**: canonical `GROUP_TYPES`/`LOCATION_SCOPES`/`ACTIVITY_OPTIONS`/`WELLNESS_OPTIONS`/`GROUP_GOALS` arrays, the single source of truth for both selection UIs and display labels.
- [src/features/Groups/groupOptionLabels.ts](src/features/Groups/groupOptionLabels.ts) — display-label lookup maps are now derived from `groupOptions.ts` (`Object.fromEntries(...)`) instead of maintaining a separate, parallel copy of the same data.
- [src/features/Groups/CreateGroupScreen.tsx](src/features/Groups/CreateGroupScreen.tsx) — imports all 5 option arrays from `groupOptions.ts` instead of defining its own; `groupGoals` now persists the canonical `id` (e.g. `keep-fit-together`) instead of the literal label string.
- [src/features/Groups/EditGroupScreen.tsx](src/features/Groups/EditGroupScreen.tsx) — imports all 5 option arrays from `groupOptions.ts` instead of defining its own (previously-diverged) copy.
- [src/features/Groups/components/GroupDetailsModal.tsx](src/features/Groups/components/GroupDetailsModal.tsx) — added an owner-only, non-blocking incomplete-metadata prompt.
- [src/features/Groups/components/GroupSharedHeader.tsx](src/features/Groups/components/GroupSharedHeader.tsx) — passes `isOwner={group.ownerId === user?.uid}` to the modal.
- [scripts/testGroupDetailAndEdit.ts](scripts/testGroupDetailAndEdit.ts) — updated the Create/Edit-agreement assertion to check both screens import from the shared `groupOptions.ts` module (rather than regex-matching now-removed inline arrays); added assertions for the owner-only prompt and canonical-id persistence.
- [scripts/testOnboardingGuards.ts](scripts/testOnboardingGuards.ts) — added an order-sensitive regression guard confirming `onboardingCompleted` is checked before `hasSeenIntro` in the function body (not just that both strings exist).
- [scripts/testGroupTaxonomyAndOnboardingRuntime.ts](scripts/testGroupTaxonomyAndOnboardingRuntime.ts) — **new**: runtime (not source-regex) tests for `buildGroupDefaults` and the canonical taxonomy label helpers.

Not changed: `firestore.rules`, membership/join/leave logic, challenge/feed code, `App.tsx` routes.

## 4. Actual real-group data findings

All 12 pre-existing real (non-test) groups — spanning December 2025 seed data through July 2026 — had **zero** of the 5 metadata fields (`groupType`, `locationScope`, `activityInterests`, `wellnessTopics`, `groupGoals`) set, entirely consistent with root cause #1: no group had ever successfully persisted them. No legacy field-name variants, no ID-vs-label ambiguity was found in real data, because there was no real data to be ambiguous about. No migration was performed or required — the existing UI already omits empty sections gracefully (verified in the prior session's manual tests and re-confirmed live in this session).

## 5. Canonical taxonomy implemented

`src/features/Groups/groupOptions.ts` is the single source for `GROUP_TYPES` (8, unchanged/already identical), `LOCATION_SCOPES` (5, unchanged ids), `ACTIVITY_OPTIONS` (23, union of both screens' previously-diverged id sets, including both `dance` and `dancing` as distinct legacy-safe entries), `WELLNESS_OPTIONS` (21, union), and `GROUP_GOALS` (14, union — see mapping table below). Both `CreateGroupScreen.tsx` and `EditGroupScreen.tsx` import all five arrays from this module; neither defines its own copy anymore. `groupOptionLabels.ts`'s display-label `Record`s are derived from the same arrays via `Object.fromEntries`, so Header/Modal display and Create/Edit selection can never drift again.

## 6. Legacy/compatibility mapping table (groupGoals)

| Canonical id | Canonical label | Origin |
|---|---|---|
| `keep-fit-together` | Keep Fit Together | Create-only (new id) |
| `weightloss` | Lose Weight | Merged (Create literal "Lose Weight" + Edit id `weightloss`) |
| `strength` | Build Strength | Merged (identical in both) |
| `mental-health` | Improve Mental Health | Create-only (new id) |
| `consistency` | Stay Consistent | Merged (Create literal "Stay Consistent" + Edit id `consistency`, canonical label changed from Edit's old "Build Consistency" to match Create's wording) |
| `athletic-performance` | Train for an Event | Merged (Create literal "Train for an Event" + Edit id `athletic-performance`) |
| `charity` | Support a Cause | Merged (Create literal "Support a Cause" + Edit id `charity`, canonical label changed from Edit's old "Charity / Fundraising") |
| `workplace-wellness` | Build Workplace Wellness | Merged (Create literal + Edit id, canonical label changed from Edit's old "Workplace Wellness") |
| `family-accountability` | Family / Friends Accountability | Create-only (new id) |
| `mindfulness` | Mindfulness | Edit-only (unchanged) |
| `social` | Social Connection | Edit-only (unchanged) |
| `healthy-lifestyle` | Healthy Lifestyle | Edit-only (unchanged) |
| `accountability` | Accountability | Edit-only (unchanged) |
| `other` | Other | Create-only (new id) |

Every canonical label above was chosen to be **byte-identical to CreateGroupScreen's original literal string** wherever a Create goal existed, so any legacy document that already has the old literal-label string persisted (from before this fix) displays identically via `getGroupGoalLabel()`'s fallback-to-raw-value behavior — no rewrite of existing documents was performed or required. `activityInterests`/`wellnessTopics`/`groupType`/`locationScope` needed no id renames — their pre-existing ids were carried through unchanged into the canonical union.

## 7. Completion rule implemented

```ts
if (profileSetup?.onboardingCompleted === true) return HOME_PATH; // NOW FIRST
if (!profileSetup?.hasSeenIntro) return '/app/onboarding/intro';
// ...rest of per-step checks, unchanged
```

No new "legacy evidence" inference heuristic was added — `onboardingCompleted === true` is trusted directly and exclusively, per the task's explicit caution against inventing a broad completion-bypass rule. All 8 real non-completed users were independently confirmed to be genuinely incomplete (missing `exerciseInterests`, `birthday`, or `goals`).

## 8. Async loading / precedence behavior

`ProtectedRoute` (auth) already gates on `isReady` before rendering children, and `RequireProfileSetup` blocks the completed/onboarding redirect decision while `isLoading || isFetching` with no cached data — both pre-existing and structurally correct; the only bug was the ordering inside `getOnboardingPath` itself, and that's now fixed. No changes were needed to either guard component.

## 9. Automated test results

```
npx tsc --noEmit                                              → clean, 0 errors
npm run build                                                  → succeeds (pre-existing >500kB chunk warning only)
npx tsx scripts/testGroupDetailAndEdit.ts                       → PASS
npx tsx scripts/testOnboardingGuards.ts                         → PASS (incl. new order-sensitive regression guard)
npx tsx scripts/testPilotUxPolishGuards.ts                      → PASS
npx tsx scripts/testGroupTaxonomyAndOnboardingRuntime.ts (new)  → PASS

Full guard suite (scripts/test*.ts, 54 scripts):
PASSED: 54
FAILED: 0
```

No new failures; no pre-existing failures.

## 10. Manual test results (live browser + real Firestore, test groups deleted after each check)

| Test | Result |
|---|---|
| Create Group with Fitness type + Keep Fit Together goal + Local scope | ✅ Previously failed silently (Error: undefined coverImageUrl). After fix: navigates to the new group; Firestore doc has `groupType: "fitness"`, `groupGoals: ["Keep Fit Together"]` (pre-consolidation run), `locationScope: "local"` all present. |
| Create Group, single field only (groupType=Fitness) | ✅ Previously silently dropped even this one field (root cause #1). After fix: persists correctly in isolation. |
| Edit Group → Save with no changes | ✅ `groupType`, `groupGoals` (now `["keep-fit-together"]`, canonical id), `locationScope` all still present after save; no fields dropped or renamed. |
| Group Details modal after Edit save | ✅ Shows "Fitness" / "Local" / "Keep Fit Together" chip — no raw ids, resolved correctly from canonical id via `getGroupGoalLabel`. |
| Legacy-completion account ("Phase 7D Fail Test", `onboardingCompleted: true`, missing `hasSeenIntro`) | ✅ Lands directly on Home, no onboarding redirect (confirmed both before writing the fix — where it incorrectly redirected — and after). |

## 11. Files/commands to run next

```
git status --short
git diff --stat
```

Nothing has been committed in this session — all changes remain in the working tree, awaiting an explicit commit instruction (not requested as part of this task; "do not deploy" was honored — no deploy or hosting command was run).

## 12. Unresolved risks / follow-ups

- No real production group has metadata populated yet, since this is the first working code path that can persist it — the founder should create/edit a few real groups post-merge to seed real usage, and the owner-only "Add group type, activities..." prompt in the modal will now correctly nudge existing group owners to do so.
- `EditGroupScreen`'s `LOCATION_SCOPES` labels changed cosmetically (e.g. "Online — anyone can join" → "Online") as part of consolidation — purely a display-text change, no id/data impact.
- `GROUP_GOALS` canonical labels for 3 merged ids (`consistency`, `charity`, `workplace-wellness`) now show Create's wording instead of Edit's old wording — again cosmetic only, ids unchanged, and no real Edit-authored group existed yet to be affected (per §4).
- The PWA/deployment verification (original Part 6) is moot for this fix: no deploy has occurred, and the underlying bugs were server/logic bugs (not caching), so once this branch is deployed and the PWA cache is refreshed via a normal deploy + hard refresh, the fixed behavior will be live — no special cache-busting or service-worker change is required.
