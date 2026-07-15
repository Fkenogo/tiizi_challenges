# Group Create/Edit Final Hardening: Private Toggle, Cover Clearing, Rules Consolidation

Date: 2026-07-14
Branch: `fix/p0-pre-deploy-blockers`
Follows: [pre-beta-group-detail-onboarding-and-taxonomy-fix.md](pre-beta-group-detail-onboarding-and-taxonomy-fix.md), [pre-beta-group-detail-follow-up-hardening.md](pre-beta-group-detail-follow-up-hardening.md)

This is a targeted final pass addressing 3 specific gaps found in review of the prior hardening. No other area (onboarding routing, challenges, feed, membership/join, Firestore rules) was touched.

## 0. File-change timeline

This report's substantive content spans two separate passes on this branch. Neither pass has been committed — everything below still lives only in the working tree, so a plain `git diff` against the last real commit (`4cf5b1e`) shows the union of both passes, not either one in isolation. This section disambiguates which files each pass actually touched.

**Earlier three-gap hardening pass** (private-toggle UI, cover-image clearing contract, community-rule consolidation — §1–§9 below):
- `src/features/Groups/CreateGroupScreen.tsx`
- `src/features/Groups/EditGroupScreen.tsx`
- `src/services/groupService.ts`
- `src/features/Groups/groupRules.ts` (new)
- `scripts/testGroupDetailAndEdit.ts`
- `scripts/testGroupTaxonomyAndOnboardingRuntime.ts`

**Latest `handleCoverChange` robustness correction** (§10, and the follow-up preview-consistency fix in §10 as amended below):
- `src/features/Groups/EditGroupScreen.tsx`
- `scripts/testGroupDetailAndEdit.ts`
- `docs/reports/pre-beta-group-create-edit-final-hardening.md` (this file)

**Explicitly not changed in the latest narrow run** (reviewed/rerun as part of validation, but their content dates from the earlier pass only):
- `src/features/Groups/CreateGroupScreen.tsx`
- `src/services/groupService.ts`
- `src/features/Groups/groupRules.ts`
- `scripts/testGroupTaxonomyAndOnboardingRuntime.ts`

This was verified mechanically, not just asserted: `shasum` was captured for these 4 files immediately before the latest narrow edit began, and compared against the same 4 files' hashes after all work in this pass completed. The hashes were byte-identical — see §15 for the exact commands and output.

## 1. Create private-group approval UI — fixed to match Edit exactly

**Confirmed gap:** `CreateGroupScreen`'s "Private Group" toggle set `requireAdminApproval` to `true` as a side effect (`if (next) setRequireAdminApproval(true)`), but the separate "Require Admin Approval" `ToggleRow` remained fully interactive afterward — a user could flip it back to visually "off" while the private-group invariant (`groupService.joinGroup`'s `needsApproval = isPrivate || requireAdminApproval`) would still require approval on submit (`requireAdminApproval: isPrivate ? true : requireAdminApproval`). The UI could show a state the backend would never honor.

**Fix:** `CreateGroupScreen`'s local `ToggleRow` now accepts an optional `disabled` prop (identical to `EditGroupScreen`'s). The "Require Admin Approval" row now uses:
```tsx
<ToggleRow
  title="Require Admin Approval"
  subtitle={isPrivate ? 'Always on for private groups' : 'New members must be vetted before joining'}
  value={isPrivate ? true : requireAdminApproval}
  onToggle={() => setRequireAdminApproval((prev) => !prev)}
  disabled={isPrivate}
/>
```
When public again, the toggle re-enables and reflects whatever `requireAdminApproval` was last set to (matching Edit's behavior exactly). Submission still enforces the invariant at the data boundary (`requireAdminApproval: isPrivate ? true : requireAdminApproval`), unchanged.

**Live verification:** toggled Private on in Create; confirmed via DOM inspection the approval toggle became `disabled: true`, `bg-primary` (forced on), subtitle "Always on for private groups"; toggled Private back off; confirmed (after allowing the re-render to flush) the approval toggle became `disabled: false` again while retaining its last value.

## 2. Cover-image clearing — same `null → deleteField()` contract extended to `coverImageUrl`

**Confirmed gap:** `EditGroupScreen.handleSave` computed `resolvedCover` and only included `coverImageUrl` in the patch `...(resolvedCover !== undefined && { coverImageUrl: resolvedCover })`. If an owner cleared the field, `resolvedCover` became `undefined`, the key was omitted from the patch, and `groupService.updateGroup`'s `if (patch.coverImageUrl !== undefined) payload.coverImageUrl = patch.coverImageUrl` never touched it — the old cover survived. Exactly the same stale-field bug already fixed for the 6 metadata fields, just not yet applied to this field.

**Contract implemented** (identical shape to the 6 metadata fields):
- `UpdateGroupInput.coverImageUrl` is now `string | null` — `undefined`/omitted = not part of this patch; a valid string = set/replace; `null` = explicit clear.
- `groupService.updateGroup`: `payload.coverImageUrl = patch.coverImageUrl === null ? deleteField() : patch.coverImageUrl`.
- `EditGroupScreen` adds an explicit `coverRemoved` boolean state, set `true` only by a new, explicit "Remove cover image" button (rendered whenever a cover preview exists), and reset to `false` whenever the owner selects a new file. `handleSave`'s cover resolution:
  ```ts
  const resolvedCover: string | null | undefined = coverRemoved
    ? null
    : isPersistableImageSource(coverImageUrl) ? coverImageUrl
    : isValidImageUrl(coverImageUrl) && isLikelyDirectImageUrl(coverImageUrl) ? coverImageUrl
    : undefined;
  ```
  This means invalid/non-persistable image data typed into the field (without the owner explicitly clicking Remove) resolves to `undefined` — leaves the existing valid cover untouched, per the requirement that garbage input must never accidentally delete a good cover.

**Live verification** (real Firestore, disposable group `sZculkNBkXWRPEa6c0nM`, deleted after):
1. Seeded a group with `coverImageUrl` set to a real Unsplash URL.
2. Opened Edit, saved with no changes → Firestore still had the original `coverImageUrl`, unchanged.
3. Clicked "Remove cover image", saved → Firestore document no longer has a `coverImageUrl` key at all (confirmed via direct read).
4. Reloaded Edit on the same group → no stale cover reappeared (the removed field simply doesn't exist).
5. Selected a new file (synthetic 1×1 PNG via `DataTransfer`, since headless upload isn't available in this environment — `uploadImageFile` failed as expected without real network upload creds and fell back to the local data-URL path, which is exactly the screen's existing fallback behavior), saved → Firestore's `coverImageUrl` now holds the new data URL, confirmed via direct read.
6. Deleted the disposable group and its membership document via the admin script.

## 3. Community rules — consolidated into a canonical shared module

**Confirmed gap:** `CreateGroupScreen` and `EditGroupScreen` each defined their own, fully disjoint 6-item `DEFAULT_RULES` array (12 distinct strings total, zero overlap). A rule selected during Create (e.g. `"Log honestly"`) had no corresponding checkbox in Edit — it would persist in `groupRules` but be invisible and un-removable via Edit's UI (only addressable by deleting all rules via the `null → deleteField()` contract, losing everything).

**Fix — new module** [src/features/Groups/groupRules.ts](../../src/features/Groups/groupRules.ts):
- `DEFAULT_GROUP_RULES` — the straightforward **union** of both screens' original 12 strings, verbatim, no renaming and no semantic merging (unlike `groupGoals`, these were already plain literal text with no id layer to merge through — renaming one screen's wording to match the other would silently change text an owner may have already selected).
- `INITIAL_SELECTED_RULES` — Create's original "preselect the first 3" behavior, preserved as the first 3 entries of the new canonical list (`'Be respectful'`, `'No spam'`, `'Encourage others'`) rather than being silently reinterpreted against a now-12-item list.
- `getCustomGroupRules(existingRules)` — returns any persisted rule not in the canonical list (an owner-typed custom rule, from either screen, at any point in time).
- `isDuplicateGroupRule(candidate, existingRules)` — case-insensitive, trim-based duplicate policy (documented in the module: `"Be Kind"` and `"be kind "` are the same rule).

**Both screens updated:**
- `CreateGroupScreen`: imports `DEFAULT_GROUP_RULES`/`INITIAL_SELECTED_RULES`/`isDuplicateGroupRule`; local `DEFAULT_RULES` removed; the (single) custom-rule text field now checks `isDuplicateGroupRule` before appending at submit.
- `EditGroupScreen`: imports the same three plus `getCustomGroupRules`; local `DEFAULT_RULES` removed; checkbox list now renders all 12 canonical rules; a new "Existing custom rules" section renders `getCustomGroupRules(groupRules)` with a per-rule "Remove" button (`removeRule`); `addCustomRule` now uses `isDuplicateGroupRule` instead of a case-sensitive `.includes()`.

**Compatibility guaranteed:**
- No existing rule is ever renamed or silently dropped — canonical checkboxes now cover all 12 original defaults from both screens, and anything else (true custom text) surfaces in "Existing custom rules", removable but not auto-removed.
- Clearing all rules still goes through the existing `groupRules.length ? groupRules : null` → `deleteField()` contract (already correct from the prior hardening pass, unchanged here).
- Saving without touching rules preserves them exactly (no code path re-derives or filters `groupRules` except explicit toggle/add/remove actions).

## 4. Files changed (this pass)

- `src/features/Groups/CreateGroupScreen.tsx` — `ToggleRow` gains `disabled`; Require Admin Approval row forced-on/disabled when private; local `DEFAULT_RULES` removed in favor of `groupRules.ts`; duplicate-rule check on submit.
- `src/features/Groups/EditGroupScreen.tsx` — `coverRemoved` state + `handleRemoveCover`; cover resolution rewritten to the `null`/`undefined`/string tri-state; new "Remove cover image" button; local `DEFAULT_RULES` removed in favor of `groupRules.ts`; "Existing custom rules" section + `removeRule`; `addCustomRule` uses `isDuplicateGroupRule`.
- `src/services/groupService.ts` — `UpdateGroupInput.coverImageUrl` accepts `null`; `updateGroup()` translates it to `deleteField()`.
- **New:** `src/features/Groups/groupRules.ts`.
- `scripts/testGroupDetailAndEdit.ts` — ~16 new assertions covering all 3 fixes.
- `scripts/testGroupTaxonomyAndOnboardingRuntime.ts` — runtime tests for `groupRules.ts` (canonical union, custom-rule surfacing, duplicate policy).

Not touched: onboarding routing, challenge logic, feed logic, membership/join behavior, `firestore.rules` (no new security issue found), any unrelated profile files.

## 5. Cover-image clearing contract (recap)

| Value sent in patch | Meaning | Firestore result |
|---|---|---|
| omitted / `undefined` | Not part of this patch (e.g. invalid/unrecognized input without explicit Remove) | Existing `coverImageUrl` untouched |
| a valid string | Set/replace the cover | `coverImageUrl` set to that string |
| `null` | Owner explicitly clicked "Remove cover image" | `coverImageUrl` field deleted via `deleteField()` |

## 6. Before/after Firestore cover behavior

| Action | Before this fix | After this fix |
|---|---|---|
| Clear cover text/preview, save | `coverImageUrl` silently unchanged (bug) | Only changes if the owner used the explicit Remove control — see below |
| Click "Remove cover image", save | *(control didn't exist)* | `coverImageUrl` key completely removed from Firestore |
| Paste garbage/invalid text without clicking Remove, save | Would have silently kept old value anyway (accidentally "safe" by the bug, not by design) | Explicitly resolves to `undefined` (untouched) — same safe outcome, now by clear intent, not by accident |
| Upload a new valid image, save | Persisted correctly (unaffected by this bug) | Unchanged — still persists correctly |

## 7. Canonical community-rule list

```
Be respectful
No spam
Encourage others
Log honestly
Keep health information private
No unsafe advice
Be respectful and supportive
No spam or self-promotion
Keep activity logs honest
Support fellow members
Stay on topic
Have fun and stay consistent
```
(12 total — the exact union of Create's and Edit's original 6-item lists, no renaming.) Create's initial preselection remains the first 3: `Be respectful`, `No spam`, `Encourage others`.

## 8. Compatibility handling for old/custom rules

- Every rule either screen ever offered as a default is now a canonical checkbox in both screens — nothing that used to be selectable in one screen is now invisible in the other.
- A genuinely custom (owner-typed) rule not in the canonical 12 is surfaced in Edit's new "Existing custom rules" section, with its own Remove control — visible and removable, never silently dropped.
- Duplicate prevention is case-insensitive and whitespace-trimmed in both screens (documented in `groupRules.ts`), preventing `"Be Kind"` and `"be kind"` from coexisting as separate entries.
- Clearing every rule (canonical and custom alike) continues to use the existing `null → deleteField()` contract from the prior hardening pass.

## 9. Private/approval UI behavior (recap)

Both Create and Edit now: force `requireAdminApproval` to display as **on** and **disable** the toggle whenever `isPrivate` is true (subtitle explains why); the toggle re-enables and is independently controllable when the group is public; submission continues to enforce `requireAdminApproval: isPrivate ? true : requireAdminApproval` at the data boundary in both screens, unchanged from the prior hardening pass.

## 10. Final robustness correction: `EditGroupScreen.handleCoverChange` error handling

A follow-up review flagged that `handleCoverChange` awaited `readFileAsDataUrl(file)` **outside** any try/catch — if `FileReader` rejected (corrupt file, browser quirk), the handler would throw unhandled: no error toast, no file-input reset, and `coverRemoved`/`coverPreview` could be left in an ambiguous state.

**Fix:** the entire read → upload flow is now wrapped:
```ts
try {
  const dataUrl = await readFileAsDataUrl(file);
  setCoverRemoved(false);      // only after a successful read
  setCoverPreview(dataUrl);
  try {
    const uploadedUrl = await uploadImageFile(file, `groups/${Date.now()}_${file.name}`);
    setCoverImageUrl(uploadedUrl);
  } catch {
    if (isPersistableImageSource(dataUrl)) {
      setCoverImageUrl(dataUrl);
      showToast('Using local image preview.', 'info');
    } else {
      showToast('Image upload failed. Choose a smaller image or try again.', 'error');
    }
  }
} catch {
  showToast('Could not read selected image.', 'error');
} finally {
  e.target.value = '';
}
```
Specifically:
1. A failed `readFileAsDataUrl` now shows **"Could not read selected image."** and leaves `coverImageUrl`/`coverPreview`/`coverRemoved` untouched — the existing stored cover remains in effect (nothing was set to a broken value).
2. `coverRemoved` is only reset to `false` *after* a successful read — a failed read can never be misinterpreted as "the owner replaced the cover."
3. A failed Storage upload now only falls back to the local data URL when `isPersistableImageSource(dataUrl)` is true (Firestore document size limit); otherwise it shows **"Image upload failed. Choose a smaller image or try again."** and does not touch `coverImageUrl` at all — `handleSave`'s existing resolution logic then treats the field as untouched (`undefined`) and preserves whatever cover is already stored in Firestore, so a failed replacement can never silently delete or corrupt a valid existing cover.
4. The file input's value is reset to `''` in a `finally` block unconditionally, so selecting the exact same file again correctly re-fires `onChange` (browsers otherwise suppress the change event for an unchanged file input value).
5. The explicit "Remove cover image" button/`handleRemoveCover` path is completely unchanged — it still sets `coverRemoved = true`, independent of this handler.

**Guards added** (`scripts/testGroupDetailAndEdit.ts`): the try-wrapping of `readFileAsDataUrl`, the "Could not read selected image." toast, the `isPersistableImageSource` gate before the data-URL fallback, the "Image upload failed..." toast, `coverRemoved` only being cleared after a successful read, and the `finally` block resetting `e.target.value`.

**Live verification:** seeded a disposable group (`gusk2tVsd9fDaxFG9UPv`) with a real cover, opened Edit, selected a synthetic replacement file via `DataTransfer`, confirmed via DOM inspection the file input's `.value` was reset to `""` after the change handler ran (finally clause working) and the preview updated to the new image; saved; confirmed via direct Firestore read the new data-URL cover persisted. Deleted the disposable group and membership doc afterward. (A genuine `FileReader` failure is not practically triggerable from a real browser with a valid synthetic `File` object, so the failure-path toasts were verified by direct code/guard inspection rather than a live-triggered exception — this matches how the equivalent `CreateGroupScreen` failure paths were verified in earlier phases of this branch.)

### 10a. Follow-up correction: failed-replacement preview consistency

A second review pass on the §10 fix found a remaining gap: when upload failed **and** the local data URL was not persistable, the code correctly left `coverImageUrl` untouched (so `handleSave` would still preserve the real stored cover) — but `coverPreview` had already been optimistically set to the failed replacement's data URL earlier in the same handler, and was never rolled back. The result: the screen would keep showing the failed replacement image, while clicking Save would actually persist the *original* cover — a visible mismatch between what the owner sees and what gets saved.

**Fix:** `handleCoverChange` now snapshots `coverImageUrl`, `coverPreview`, and `coverRemoved` at the very start of the handler (before the optimistic `setCoverPreview`/`setCoverRemoved(false)` calls), and the non-persistable-upload-failure branch explicitly restores all three:
```ts
const previousCoverImageUrl = coverImageUrl;
const previousCoverPreview = coverPreview;
const previousCoverRemoved = coverRemoved;

try {
  const dataUrl = await readFileAsDataUrl(file);
  setCoverRemoved(false);
  setCoverPreview(dataUrl);
  try {
    const uploadedUrl = await uploadImageFile(file, `groups/${Date.now()}_${file.name}`);
    setCoverImageUrl(uploadedUrl);
  } catch {
    if (isPersistableImageSource(dataUrl)) {
      setCoverImageUrl(dataUrl);
      showToast('Using local image preview.', 'info');
    } else {
      setCoverImageUrl(previousCoverImageUrl);
      setCoverPreview(previousCoverPreview);
      setCoverRemoved(previousCoverRemoved);
      showToast('Image upload failed. Choose a smaller image or try again.', 'error');
    }
  }
} catch {
  showToast('Could not read selected image.', 'error');
} finally {
  e.target.value = '';
}
```
Behavior confirmed unchanged for every other path: successful upload still calls `setCoverImageUrl(uploadedUrl)` directly; the persistable-data-URL fallback still calls `setCoverImageUrl(dataUrl)` and shows "Using local image preview."; a failed *read* still leaves all three values untouched (nothing was set yet at that point, so there is nothing to roll back — the snapshot variables are simply unused in that branch); the `finally` block still unconditionally resets the file input; and `handleRemoveCover`/the explicit Remove button are untouched by this change.

**Guard added:** `scripts/testGroupDetailAndEdit.ts` now asserts (1) the three `previousCover*` snapshot declarations exist, (2) the non-persistable-failure branch calls all three setters back to the snapshotted values before showing the error toast, and (3) the snapshot is taken textually *before* the optimistic `setCoverRemoved(false); setCoverPreview(dataUrl);` calls (via string-index comparison), so a future edit that reorders this incorrectly would fail the guard.

## 11. Automated command outputs

```
npx tsc --noEmit                                              → clean, 0 errors
npm run build                                                  → succeeds (pre-existing >500kB chunk warning only)
npx tsx scripts/testGroupDetailAndEdit.ts                       → ✅ All Group Detail and Edit guards passed.
npx tsx scripts/testGroupTaxonomyAndOnboardingRuntime.ts        → ✅ All group taxonomy and onboarding runtime regression tests passed.
npx tsx scripts/testPilotUxPolishGuards.ts                      → pilot UX polish guards passed
git diff --check                                                → clean (no whitespace errors), exit 0
```

## 12. Full guard-suite totals

```
TOTAL: 54
PASSED: 54
FAILED: 0
```
No new failures; no pre-existing failures.

## 13. Manual Firestore test evidence

| # | Test | Result |
|---|---|---|
| 1 | Seed group with a real cover image | ✅ `sZculkNBkXWRPEa6c0nM` created with `coverImageUrl` set |
| 2 | Edit and save without changes | ✅ `coverImageUrl` unchanged in Firestore after save |
| 3 | Click "Remove cover image", save | ✅ `coverImageUrl` key completely absent from the document afterward |
| 4 | Reload Edit on the same group | ✅ no cover reappeared — field genuinely deleted, not client-cache-masked |
| 5 | Upload a replacement cover, save | ✅ new value persisted, confirmed via direct Firestore read |
| 6 | Delete disposable test data | ✅ group and its membership document deleted via admin script |
| 7 | Create: toggle Private on | ✅ Require Admin Approval shows forced-on, `disabled: true`, correct subtitle |
| 8 | Create: toggle Private back off | ✅ Require Admin Approval re-enables (`disabled: false`), retains its value |
| 9 | Replace cover after robustness fix (`gusk2tVsd9fDaxFG9UPv`) | ✅ file input reset to `""` after change handler; new cover persisted after save; test data deleted |

## 14. Unresolved risks

- Real file upload (`uploadImageFile`) could not be exercised end-to-end in this headless environment (no real network storage credentials available to the test harness) — the synthetic-file tests exercised the screen's existing local-data-URL fallback path instead, which is the same code path used whenever upload fails for any reason in production, so it is a faithful (if not 100%-identical) proof of the persistence contract.
- `groupRules.ts`'s duplicate policy (case-insensitive, trim-based) is a new explicit decision; no prior behavior existed to preserve (Create had no dedup at all; Edit's was case-sensitive `.includes()`), so this is a deliberate improvement, not a compatibility requirement — flagged for awareness in case the founder wants a different policy (e.g. exact-match only).
- The `readFileAsDataUrl` failure path (`"Could not read selected image."`) is guarded by regex/structural checks and could not be triggered with a real exception in this browser environment — genuinely corrupt-file `FileReader` failures are effectively impossible to synthesize via a normal `File`/`Blob` construction path.
- The preview-consistency rollback (§10a) restores state via three separate `setState` calls rather than one combined state object; React batches these in the same event-loop tick so no intermediate re-render is visible, but this is a structural note for future maintainers touching this handler.

## 15. Proof that unrelated files were not touched in this narrow run

Since nothing on this branch has been committed at any point across all three hardening passes, a plain `git diff` against the last real commit (`4cf5b1e`) necessarily shows the union of every pass, not this pass in isolation. To prove the 4 files explicitly called out as "not expected to change" were genuinely untouched during this narrow run (as opposed to merely "no different from an earlier pass by coincidence"), their SHA-1 hashes were captured immediately before this pass's first edit, and compared against the same 4 files after all work completed:

```
$ for f in src/features/Groups/CreateGroupScreen.tsx src/services/groupService.ts \
           src/features/Groups/groupRules.ts scripts/testGroupTaxonomyAndOnboardingRuntime.ts; do
    echo "$f: $(shasum "$f")"
  done > /tmp/pre_edit_hashes.txt
# ... (this pass's edits to EditGroupScreen.tsx and testGroupDetailAndEdit.ts happen here) ...
$ for f in src/features/Groups/CreateGroupScreen.tsx src/services/groupService.ts \
           src/features/Groups/groupRules.ts scripts/testGroupTaxonomyAndOnboardingRuntime.ts; do
    echo "$f: $(shasum "$f")"
  done > /tmp/post_edit_hashes.txt
$ diff /tmp/pre_edit_hashes.txt /tmp/post_edit_hashes.txt && echo "IDENTICAL"
IDENTICAL - no changes to these files during this narrow run
```

The two files this pass *did* intend to change (`src/features/Groups/EditGroupScreen.tsx`, `scripts/testGroupDetailAndEdit.ts`) were not hashed beforehand since they were the deliberate targets — their exact within-pass diff is the `previousCoverImageUrl`/`previousCoverPreview`/`previousCoverRemoved` snapshot-and-restore logic shown in §10a, plus the three corresponding new assertions in `testGroupDetailAndEdit.ts`. A plain `git diff` on either file shows additional, earlier-pass content (the taxonomy/validation/rules-consolidation work) because neither file has been committed since those earlier passes landed.

## Git status

```
git status --short
```
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
?? docs/reports/pre-beta-group-detail-follow-up-hardening.md
?? docs/reports/pre-beta-group-detail-onboarding-and-taxonomy-fix.md
?? docs/reports/pre-beta-onboarding-step-1-blocker-fix.md
?? scripts/testGroupTaxonomyAndOnboardingRuntime.ts
?? src/features/Groups/groupGoalNormalization.ts
?? src/features/Groups/groupMetadataCompleteness.ts
?? src/features/Groups/groupOptionLabels.ts
?? src/features/Groups/groupOptions.ts
?? src/features/Groups/groupRules.ts
?? src/features/Groups/groupValidation.ts
```

```
git diff --stat
```
```
 scripts/testGroupDetailAndEdit.ts                  | 243 +++++++++++++-
 scripts/testOnboardingGuards.ts                    | 368 +++++++++++++++++++++
 scripts/testPilotUxPolishGuards.ts                 |  14 +-
 src/features/Groups/CreateGroupScreen.tsx          | 123 ++-----
 src/features/Groups/EditGroupScreen.tsx            | 208 ++++++------
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
 src/services/groupService.ts                       |  54 ++-
 src/services/userProfileService.ts                 |  33 ++
 src/utils/groupLifecycle.ts                        |   5 +-
 22 files changed, 1033 insertions(+), 307 deletions(-)
```

`testPilotUxPolishGuards.ts` and the `src/features/Profile/*`/`OnboardingSlides.tsx`/`userProfileService.ts` diffs predate this session's group-hardening work (carried over from the earlier onboarding-regression fix) and were not touched here.

**Confirmation: nothing was committed or deployed.** `git log -1` still shows the same pre-existing commit as HEAD; all changes above remain in the working tree only.
