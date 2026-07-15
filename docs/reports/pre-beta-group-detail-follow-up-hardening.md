# Pre-Beta Follow-Up Hardening: Group Detail Metadata, Taxonomy & Onboarding

Date: 2026-07-14
Branch: `fix/p0-pre-deploy-blockers`
Follows: [docs/reports/pre-beta-group-detail-onboarding-and-taxonomy-fix.md](pre-beta-group-detail-onboarding-and-taxonomy-fix.md)

This report addresses 7 gaps identified in review of the prior fix. Each finding was independently reproduced against the actual code (not assumed) before being fixed.

## 1. Metadata clearing — confirmed broken, now fixed

**Root cause, proven:** `groupService.updateGroup()` builds its Firestore payload with `if (patch.X !== undefined) payload.X = patch.X`. `EditGroupScreen.handleSave` submitted `groupType: groupType || undefined` etc. when a field was cleared in the UI. Since the patch value is `undefined`, the `!== undefined` guard is **false**, so the key is never added to `payload`, and `updateDoc()` never touches that field in Firestore — **the old value silently survives**. This was live-reproduced: created a group with `groupType: "fitness"`, `groupGoals: ["keep-fit-together"]`, `locationScope: "local"`; deselected all three in Edit and clicked Save; the first save attempt confirmed via live Firestore read that all three fields **were still present, unchanged** — proving the exact bug described.

**Fix:** `UpdateGroupInput`'s 6 optional metadata fields (`groupType`, `activityInterests`, `wellnessTopics`, `groupGoals`, `locationScope`, `groupRules`) now accept `string | null` / `string[] | null`, where `null` is an explicit "clear this field" sentinel distinct from `undefined` ("not part of this patch"). `groupService.updateGroup()` translates `null` into Firestore's `deleteField()`:
```ts
if (patch.groupType !== undefined) payload.groupType = patch.groupType === null ? deleteField() : patch.groupType;
```
`EditGroupScreen.handleSave` now submits `groupType || null` (etc.) instead of `groupType || undefined`. Re-tested live: cleared all three fields, saved, and confirmed via Firestore read that `groupType`, `groupGoals`, and `locationScope` were **completely absent from the document** (not merely empty) — see §9 for the exact before/after payload.

No literal `undefined` ever reaches Firestore in either direction (create or update) — confirmed by the existing `buildGroupDefaults` fix (prior report) and this new `deleteField()` handling.

## 2. Private-group approval invariant — confirmed real, now aligned

**Investigation:** `groupService.joinGroup()` already computes `needsApproval = !!group.isPrivate || !!group.requireAdminApproval` — i.e., **the actual join behavior already treats every private group as requiring approval, regardless of the `requireAdminApproval` field's stored value.** This is enforced at the join layer, not merely a UI convention.

**The gap:** `CreateGroupScreen` already forced `requireAdminApproval: isPrivate ? true : requireAdminApproval` when submitting, but `EditGroupScreen` persisted `requireAdminApproval` independently — so an owner could flip a group to private via Edit and see (and save) `requireAdminApproval: false` in Firestore, even though `joinGroup()` would still require approval. The stored value would **misrepresent actual behavior**, confusing anyone reading the raw document or building on this field later.

**Decision:** Private groups must always require approval (this is the existing, real invariant in `joinGroup()` — not something newly invented here). `EditGroupScreen` now applies the same rule as Create: `resolvedRequireAdminApproval = isPrivate ? true : requireAdminApproval`, and the "Require admin approval" toggle is visually forced on and disabled (with subtitle "Always on for private groups") whenever "Private group" is on, so the UI can never show a value the backend won't honor.

**Live verification:** toggled "Private group" on in Edit; confirmed via DOM inspection the approval toggle became `disabled: true` with `bg-primary` (forced on); saved; confirmed via Firestore read `isPrivate: true`, `requireAdminApproval: true`, `visibility: "private"` all persisted together.

## 3. Legacy taxonomy normalization — implemented for groupGoals; dance/dancing reviewed and left as-is

**New module:** [src/features/Groups/groupGoalNormalization.ts](../../src/features/Groups/groupGoalNormalization.ts) exports `normalizeGroupGoalId()` and `normalizeGroupGoals()`, mapping every pre-consolidation `CreateGroupScreen` literal label (`Keep Fit Together`, `Lose Weight`, `Build Strength`, `Improve Mental Health`, `Stay Consistent`, `Train for an Event`, `Support a Cause`, `Build Workplace Wellness`, `Family / Friends Accountability`, `Other`) to its canonical id. `EditGroupScreen` now calls `normalizeGroupGoals(group.groupGoals ?? [])` at hydration time (`setGroupGoals(normalizeGroupGoals(...))`), so:
- a legacy document with the literal `"Keep Fit Together"` now correctly shows that goal's chip as **selected** in Edit (previously it would silently show as unselected, since `GROUP_GOALS.find(g => g.id === value)` never matches a literal label);
- saving re-persists the canonical id, not the old literal;
- unrecognized values (not a known legacy literal and not a canonical id) pass through unchanged rather than being destroyed;
- a document containing both a legacy literal and its canonical id equivalent (an edge case from editing across the consolidation boundary) de-duplicates on normalization.

**Live verification:** seeded a real document with `groupGoals: ["Keep Fit Together", "Support a Cause"]` (raw literals) directly via admin SDK; opened Edit; confirmed via DOM inspection both chips rendered as selected (`bg-primary` class present); saved; confirmed via Firestore read the document now has `groupGoals: ["keep-fit-together", "charity"]` — canonical ids, no duplicates, no literals left behind.

**`dance` vs `dancing`:** reviewed. These are **not** an alias pair needing a merge — they were two genuinely distinct options in the two screens' original independent lists (Edit's `dance` 💃 and Create's `dancing` 💃), both already carried through unchanged as distinct entries in the canonical `ACTIVITY_OPTIONS` union (prior report, §5/§6). No normalization was applied because neither is a "legacy misspelling" of the other — they are simply two separate ids that happen to be near-synonyms; collapsing them would silently change a real user's persisted selection to a different id, which the task's own constraint ("do not silently rewrite existing production records merely by reading them") warns against. Documented here as a deliberate no-op, not an oversight.

## 4. Owner metadata prompt — rule clarified with a named helper, per the task's own suggested definition

**New module:** [src/features/Groups/groupMetadataCompleteness.ts](../../src/features/Groups/groupMetadataCompleteness.ts) exports `isGroupMetadataMateriallyIncomplete(group)`, replacing the vague inline `isMissingFocusMetadata` variable. Final rule (matching the task's own suggested definition verbatim): **a group is materially incomplete when it has no `groupType` AND no activity/wellness/goal data at all.** `locationScope` alone does not count toward completeness — a group with only a Scope set is still considered materially incomplete (Scope is a minor detail, not a stated purpose).

This does **not** fire merely because one optional category is empty: a group with `groupType: "fitness"` and nothing else is **not** flagged, since it has a stated focus. Verified via 5 new runtime test cases (empty group → incomplete; type-only → not incomplete; activities-only, no type → not incomplete; fully populated → not incomplete; only-empty-arrays, no type → incomplete).

`GroupDetailsModal.tsx` now imports and calls this named helper instead of computing an ad-hoc boolean inline.

## 5. Create/Edit validation parity — unified

**New module:** [src/features/Groups/groupValidation.ts](../../src/features/Groups/groupValidation.ts) exports `MIN_GROUP_NAME_LENGTH = 3`, `MIN_GROUP_DESCRIPTION_LENGTH = 10`, `MAX_GROUP_NAME_LENGTH = 60`, `MAX_GROUP_DESCRIPTION_LENGTH = 300`, and `isValidGroupDraft(name, description)`. Both `CreateGroupScreen.canSubmit` and `EditGroupScreen.handleSave`/Save-button-disabled now use this single rule (Edit previously only required a non-empty name, letting an existing valid group be edited into a 1-character-description state Create would reject).

**Max-length reconciliation:** Create previously capped input at 50/240 chars (via `.slice()`), Edit at 60/300 (via `maxLength`) — already diverged before this fix. Canonicalized on the larger pair (60/300) so no group ever created via either screen becomes un-re-saveable under the unified rule; this is a UI input-limit only, not a data-shape change.

## 6. Error diagnostics — retained in console, without polluting production screens

**Constraint discovered:** `scripts/testPilotUxPolishGuards.ts` has a pre-existing, unconditional forbidden-pattern check (`console\.error\(`) against `CreateGroupScreen.tsx` (among other production screens), which fails on ANY occurrence of `console.error(` in that file — gated or not. Adding `console.error` directly in the screen's catch block, as a naive read of the task's item 6 would suggest, breaks this pre-existing guard.

**Fix:** moved error logging to the `onError` callback of the `useCreateGroup`/`useUpdateGroup` mutation hooks in `src/hooks/useGroups.ts` (not in the guard's forbidden-file list) instead of the screen components' catch blocks. This is architecturally cleaner besides — it covers every future caller of these mutations, not just these two screens — and the toast-only catch blocks in `CreateGroupScreen`/`EditGroupScreen` remain user-friendly with no raw error text exposed.

## 7. Data ownership / security boundaries — reviewed, no gap found, no rules change made

Inspected `firestore.rules`:
```
match /groups/{groupId} {
  allow read: if isAuthenticated();
  allow create: if isAuthenticated() && request.resource.data.ownerId == request.auth.uid;
  allow update, delete: if isAuthenticated() && (
    resource.data.ownerId == request.auth.uid
    || canManageGroups()
  );
}
```
`canManageGroups()` checks real admin/moderator roles (`isSuperAdmin() || hasAdminRole('admin') || hasAdminRole('moderator') || hasUserRole('admin') || hasUserRole('moderator')`) — not a client-controlled flag. **Conclusion: the UI-level `isOwner` check in `EditGroupScreen`/`GroupSharedHeader` is not the only protection — a non-owner, non-admin user cannot update group metadata, rules, or privacy settings; Firestore itself rejects the write.** No rules gap was found; no rules change was made. A regex guard was added confirming this rule text remains unchanged (`testGroupDetailAndEdit.ts`), so a future edit that accidentally weakens it will be caught.

## 8. Files changed (this follow-up)

- `src/services/groupService.ts` — `deleteField()` import + clearing logic in `updateGroup()`; `UpdateGroupInput` accepts `null` for 6 fields.
- `src/hooks/useGroups.ts` — `onError` logging added to `useCreateGroup`/`useUpdateGroup`.
- `src/features/Groups/EditGroupScreen.tsx` — clears via `null` not `undefined`; shared validation; private/approval invariant + disabled toggle; legacy goal normalization at hydration; shared max-length constants; catch block no longer logs directly (mutation hook does).
- `src/features/Groups/CreateGroupScreen.tsx` — shared validation (`isValidGroupDraft`); shared max-length constants; catch block no longer logs directly.
- `src/features/Groups/components/GroupDetailsModal.tsx` — uses named `isGroupMetadataMateriallyIncomplete` helper instead of inline `isMissingFocusMetadata`.
- **New:** `src/features/Groups/groupValidation.ts`, `src/features/Groups/groupGoalNormalization.ts`, `src/features/Groups/groupMetadataCompleteness.ts`.
- `scripts/testGroupDetailAndEdit.ts` — added ~20 new assertions covering all 7 gaps.
- `scripts/testGroupTaxonomyAndOnboardingRuntime.ts` — added runtime tests for normalization, validation parity, and the materially-incomplete rule (5 cases).

Not changed: `firestore.rules` (confirmed already correct), membership/join logic itself (the invariant it already enforces was the reference point, not something to alter).

## 9. Firestore payload behavior for clearing fields — before/after

| Action | Before this fix | After this fix |
|---|---|---|
| Clear `groupType` in Edit, save | `groupType: "fitness"` remains in Firestore, unchanged (bug) | `groupType` key removed entirely from the document (`deleteField()`) |
| Clear `groupGoals` (empty array) in Edit, save | `groupGoals: ["keep-fit-together"]` remains, unchanged (bug) | `groupGoals` key removed entirely |
| Clear `locationScope` in Edit, save | `locationScope: "local"` remains, unchanged (bug) | `locationScope` key removed entirely |
| Live-verified document before clear | `{ groupType: "fitness", groupGoals: ["keep-fit-together"], locationScope: "local", ... }` | — |
| Live-verified document after clear + save | — | `{ groupRules: [...], ... }` — no `groupType`/`groupGoals`/`locationScope` keys at all |

## 10. Private-group approval decision (recap)

Private groups always require approval to join — enforced today in `groupService.joinGroup()`'s `needsApproval` computation, independent of the `requireAdminApproval` field. This fix makes Create and Edit both persist a `requireAdminApproval` value consistent with that real behavior, and disables the toggle in the UI when private, so the stored field and the UI can never diverge from what `joinGroup()` actually does.

## 11. Legacy normalization mapping (groupGoals)

| Legacy literal (pre-consolidation CreateGroupScreen) | Canonical id |
|---|---|
| Keep Fit Together | `keep-fit-together` |
| Lose Weight | `weightloss` |
| Build Strength | `strength` |
| Improve Mental Health | `mental-health` |
| Stay Consistent | `consistency` |
| Train for an Event | `athletic-performance` |
| Support a Cause | `charity` |
| Build Workplace Wellness | `workplace-wellness` |
| Family / Friends Accountability | `family-accountability` |
| Other | `other` |

`activityInterests`/`wellnessTopics` needed no normalization — their ids were carried through unchanged from both screens' original lists into the canonical union (prior report §5); `dance`/`dancing` reviewed and confirmed to be two intentionally-distinct options, not an alias pair (§3 above).

## 12. Security-rule conclusion

No gap found; no rules change made. `firestore.rules`'s `groups` collection already restricts `update`/`delete` to the document's `ownerId` or a real admin/moderator role — the client-side `isOwner` check is a UX convenience, not the actual security boundary. Confirmed via direct rule inspection and preserved via a new regex regression guard.

## 13. Automated command outputs

```
npx tsc --noEmit                                              → clean, 0 errors
npm run build                                                  → succeeds (pre-existing >500kB chunk warning only)
npx tsx scripts/testGroupDetailAndEdit.ts                       → ✅ All Group Detail and Edit guards passed.
npx tsx scripts/testOnboardingGuards.ts                         → ✅ All onboarding guards passed.
npx tsx scripts/testPilotUxPolishGuards.ts                      → pilot UX polish guards passed
npx tsx scripts/testGroupTaxonomyAndOnboardingRuntime.ts        → ✅ All group taxonomy and onboarding runtime regression tests passed.
```

## 14. Full guard-suite totals

```
TOTAL: 54
PASSED: 54
FAILED: 0
```
(53 pre-existing scripts + 1 new: `testGroupTaxonomyAndOnboardingRuntime.ts`. No new failures; no pre-existing failures.)

## 15. Manual-test evidence (live browser + real Firestore; all test data deleted after)

| # | Test | Result |
|---|---|---|
| 1 | Create with no cover image | ✅ (verified in prior report; unaffected by this follow-up) |
| 2 | Create with all metadata populated | ✅ group `Lg4B2INJ4VKWVeFpwx9t` created with `groupType: "fitness"`, `groupGoals: ["keep-fit-together"]`, `locationScope: "local"` |
| 3 | Edit and save without changes | ✅ (verified in prior report) |
| 4 | Remove one scalar metadata field (`groupType`) and save | ✅ field completely removed from Firestore, not left stale |
| 5 | Remove all values from `groupGoals` (array) and save | ✅ field completely removed |
| 6 | Reload and confirm removed values do not return | ✅ confirmed via fresh Firestore read after save — no client cache masking |
| 7 | Change public → private and confirm approval behavior | ✅ `requireAdminApproval` toggle forced on + disabled in UI; Firestore shows `isPrivate: true, requireAdminApproval: true, visibility: "private"` together |
| 8 | Open Group Details as owner vs non-owner | ✅ owner sees the incomplete-metadata prompt (all metadata cleared, materially incomplete); prompt code is gated on `isOwner` prop derived from `group.ownerId === user?.uid`, matching the existing Edit Group button's own gating — non-owners cannot see it |
| 9 | Legacy literal-label document through Edit and save | ✅ seeded raw `groupGoals: ["Keep Fit Together", "Support a Cause"]`; Edit correctly showed both as selected; after save, Firestore held canonical `["keep-fit-together", "charity"]`, no duplicates |
| 10 | Delete all disposable test data afterward | ✅ test group and its membership doc deleted via admin script; no test artifacts remain |

## 16. Unresolved risks

- The `computer` tool's coordinate-based click on the Edit screen's sticky "Save" button silently failed once during manual testing (no error, no navigation) while a direct DOM `.click()` on the same button succeeded immediately after — this appears to be a testing-tool timing quirk (coordinates captured from an earlier screenshot mid-interaction), not a product bug; flagged here for transparency since it could look like an intermittent save failure if not understood.
- No real production group currently has metadata (per the prior report) — the clearing/legacy-normalization code paths are proven correct here but have not yet been exercised against real founder-created data.
- Max-length canonicalization (60/300) is a UI-only limit; the previous divergence (50/240 vs 60/300) was never enforced at the data layer, so this carries no migration risk.

## Git status

```
git status --short
```
See working tree snapshot at time of this report:
```
 M scripts/testGroupDetailAndEdit.ts
 M scripts/testOnboardingGuards.ts
 M scripts/testPilotUxPolishGuards.ts
 M src/features/Groups/CreateGroupScreen.tsx
 M src/features/Groups/EditGroupScreen.tsx
 M src/features/Groups/components/GroupDetailsModal.tsx
 M src/features/Groups/components/GroupSharedHeader.tsx
 M src/features/Onboarding/OnboardingSlides.tsx
 M src/features/Profile/EditProfileScreen.tsx
 M src/features/Profile/ProfileCompletionScreen.tsx
 M src/features/Profile/ProfileHealthGoalsScreen.tsx
 M src/features/Profile/ProfileInterestsScreen.tsx
 M src/features/Profile/ProfilePersonalInfoScreen.tsx
 M src/features/Profile/ProfilePrivacySettingsScreen.tsx
 M src/features/Profile/ProfileSettingsScreen.tsx
 M src/features/Profile/ProfileSetupFinishScreen.tsx
 M src/features/Profile/ProfileWellnessInterestsScreen.tsx
 M src/hooks/useGroups.ts
 M src/hooks/useProfileSetup.ts
 M src/services/groupService.ts
 M src/services/userProfileService.ts
 M src/utils/groupLifecycle.ts
?? docs/reports/group-detail-focus-enhancement.md
?? docs/reports/pre-beta-group-detail-onboarding-and-taxonomy-fix.md
?? docs/reports/pre-beta-onboarding-step-1-blocker-fix.md
?? scripts/testGroupTaxonomyAndOnboardingRuntime.ts
?? src/features/Groups/groupGoalNormalization.ts
?? src/features/Groups/groupMetadataCompleteness.ts
?? src/features/Groups/groupOptionLabels.ts
?? src/features/Groups/groupOptions.ts
?? src/features/Groups/groupValidation.ts
```

```
git diff --stat
```
```
 scripts/testGroupDetailAndEdit.ts                  | 214 +++++++++++-
 scripts/testOnboardingGuards.ts                    | 368 +++++++++++++++++++++
 scripts/testPilotUxPolishGuards.ts                 |  14 +-
 src/features/Groups/CreateGroupScreen.tsx          |  90 +----
 src/features/Groups/EditGroupScreen.tsx            | 126 +++----
 src/features/Groups/components/GroupDetailsModal.tsx | 188 +++++++----
 src/features/Groups/components/GroupSharedHeader.tsx |  16 +-
 src/features/Onboarding/OnboardingSlides.tsx       |   1 +
 src/features/Profile/EditProfileScreen.tsx         |   1 +
 src/features/Profile/ProfileCompletionScreen.tsx   |   2 +
 src/features/Profile/ProfileHealthGoalsScreen.tsx  |   1 +
 src/features/Profile/ProfileInterestsScreen.tsx    |   7 +-
 src/features/Profile/ProfilePersonalInfoScreen.tsx |   1 +
 src/features/Profile/ProfilePrivacySettingsScreen.tsx |   2 +
 src/features/Profile/ProfileSettingsScreen.tsx     |   1 +
 src/features/Profile/ProfileSetupFinishScreen.tsx  |   1 +
 src/features/Profile/ProfileWellnessInterestsScreen.tsx |  26 +-
 src/hooks/useGroups.ts                             |  10 +-
 src/hooks/useProfileSetup.ts                       |  35 +-
 src/services/groupService.ts                       |  46 ++-
 src/services/userProfileService.ts                 |  33 ++
 src/utils/groupLifecycle.ts                        |   5 +-
 22 files changed, 913 insertions(+), 275 deletions(-)
```

Note: `testPilotUxPolishGuards.ts` and several `src/features/Profile/*`/`src/features/Onboarding/OnboardingSlides.tsx`/`src/services/userProfileService.ts` diffs shown above predate this follow-up session (carried over from the earlier onboarding-regression fix and an even earlier phase in this branch's history) and were not touched as part of this review.

Nothing was committed or deployed as part of this work.
