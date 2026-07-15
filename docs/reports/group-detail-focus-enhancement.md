# Group Detail Focus Enhancement

Date: 2026-07-12
Branch: `fix/p0-pre-deploy-blockers`

## 1. Root cause / existing limitation

`GroupDetailsModal.tsx` already contained a "Focus Areas" section (Activities/Wellness/Goals chips) and
`GroupSharedHeader.tsx` already had a `groupType` pill in the hero — these were built in an earlier phase. Two
real gaps remained:

1. **Scope was never surfaced anywhere** — not in the hero, and only as a raw `locationScope.replace(/-/g, ' ')`
   row buried inside the modal's About section.
2. **Labels were not human-readable, shared, or canonical.** `groupType`/`locationScope` were dash-stripped and
   left lowercase (e.g. `"cause based"` instead of `"Cause-based"`); `activityInterests`/`wellnessTopics`/
   `groupGoals` chips rendered the raw persisted value with a CSS `capitalize` class as the only formatting
   (e.g. `"gym-weightlifting"` → `"Gym weightlifting"`, not the canonical `"Gym / Weightlifting"`). No shared
   label-mapping module existed; `CreateGroupScreen.tsx` and `EditGroupScreen.tsx` each defined their own
   `GROUP_TYPES`/`ACTIVITY_OPTIONS`/`WELLNESS_OPTIONS`/`GROUP_GOALS`/`LOCATION_SCOPES` arrays independently.

## 2. Files inspected

`GroupDetailScreen.tsx`, `GroupSharedHeader.tsx`, `GroupDetailsModal.tsx`, `GroupHeroHeader.tsx`,
`CreateGroupScreen.tsx`, `EditGroupScreen.tsx`, `groupService.ts` (full `createGroup`/`updateGroup`/`getGroupById`/
`getGroupsByIds`/`getGroupsByOwner`), `useGroups.ts` (`useGroup`, `useGroupMemberCount`,
`useGroupMembershipStatus`, `useJoinGroup`, `useLeaveGroup`), `src/types/index.ts` (`Group` interface),
`scripts/testGroupDetailAndEdit.ts`, `scripts/testMobileLayoutGuards.ts`, `firestore.rules` (`groups` collection
read rule), `GroupsScreen.tsx` (discovery filter chips, to confirm no duplicate label logic there needed
touching).

## 3. Files changed

- **New:** `src/features/Groups/groupOptionLabels.ts` — shared value→label lookup module.
- `src/features/Groups/components/GroupSharedHeader.tsx` — hero now shows Group Type *and* Scope pills, both via
  the shared helpers; sticky-header/close-button and other behavior untouched.
- `src/features/Groups/components/GroupDetailsModal.tsx` — new "Group Focus" section (Type/Scope), renamed
  "Focus Areas" into three independently-gated sections ("Activities", "Wellness Topics", "Group Goals"), all
  chip labels now resolved through the shared helpers, added a11y attributes (`role="dialog"`, `aria-modal`,
  `aria-labelledby`, `aria-label` on the close button, `aria-hidden` on the decorative icon), Escape-to-close,
  and restructured the scroll container so the header/close button stay visible while content scrolls (see §7).
- `scripts/testGroupDetailAndEdit.ts` — expanded with ~40 new assertions covering the 14 guard requirements.

Not changed (deliberately — see §6): `CreateGroupScreen.tsx`, `EditGroupScreen.tsx`, `groupService.ts`,
`useGroups.ts`, `src/types/index.ts`, `firestore.rules`, membership/join/leave/challenge/feed/invite logic.

## 4. Confirmed Firestore field names and data shapes

All five fields already exist on the `Group` type (`src/types/index.ts:90-98`) and are written unchanged by
`groupService.createGroup`/`updateGroup` (spread directly, no stripping) and read back unchanged by
`getGroupById`/`getGroupsByIds`/`getGroupsByOwner` (`{ id, ...snap.data() }`, no field-level mapping):

| Field | Type | Written by |
|---|---|---|
| `groupType` | `'fitness' \| 'wellness' \| 'mixed' \| 'cause-based' \| 'workplace' \| 'school' \| 'friends-family' \| 'community'` | Create, Edit (identical option list) |
| `locationScope` | `'local' \| 'online' \| 'workplace' \| 'school' \| 'private-circle'` | Create, Edit (identical ids, different label wording) |
| `activityInterests` | `string[]` (ids) | Create, Edit (**diverged id sets** — see §6) |
| `wellnessTopics` | `string[]` (ids) | Create, Edit (**diverged id sets** — see §6) |
| `groupGoals` | `string[]` | Create (literal label strings), Edit (**opaque ids**, structurally different — see §6) |

`useGroup(groupId)` → `groupService.getGroupById(id)` was confirmed to return the full document with no
additional Firestore reads required — the Group Detail query already returns all five fields; no data-plumbing
change was needed.

## 5. UI changes made

**Hero (Section A):** `GroupSharedHeader.tsx` now renders a Group Type pill and a Scope pill (with a `MapPin`
icon) in the existing metadata row, each only when a label resolves (never "undefined" or blank). Both use
`max-w-full truncate` so a long label can't cause page overflow.

**Group Details modal (Section B):** reordered to lead with purpose/interests before privacy details, per the
task's mobile-hierarchy guidance:
1. **Group Focus** (Type, Scope) — MetaRow style, matches existing About/Rules row styling.
2. **Activities** — chips.
3. **Wellness Topics** — chips.
4. **Group Goals** — chips.
5. **About** (Description, Privacy, Founded, Admin) — unchanged content, Type/Scope moved out to Group Focus.
6. **Rules & Privacy** (community rules, Visibility, Approval, Challenges) — untouched.

Each of the 6 sections is independently gated and omitted (not blanked) when empty.

## 6. Shared definitions/helpers introduced or reused — and a flagged pre-existing gap

**Audit finding (not fixed, out of scope):** `CreateGroupScreen.tsx` and `EditGroupScreen.tsx` define their own
`ACTIVITY_OPTIONS`/`WELLNESS_OPTIONS`/`GROUP_GOALS` arrays, and these have **genuinely diverged** — different id
namespaces for activities/wellness (e.g. Create has `hiit-circuit`/`dancing`/`martial-arts`, Edit has
`crossfit`/`dance`/different `martial-arts` label), and `groupGoals` is **structurally incompatible**: Create
persists the literal label string (e.g. `"Keep Fit Together"`), Edit persists an opaque id (e.g. `"consistency"`).
`GROUP_TYPES` is identical between the two screens; `LOCATION_SCOPES` has identical ids with only cosmetic label
wording differences.

Per the stop-condition guidance, I did not treat this as a hard blocker for the *display* task: the divergence is
resolvable without guessing, because every possible persisted value is unambiguously identifiable (id-based
fields: build a union lookup from both screens' lists, since no id collides with a conflicting meaning between
the two; the goals field: try an id lookup against Edit's list first, else the value is already Create's literal
label). I built `groupOptionLabels.ts` as exactly that — a small, read-only, additive lookup module (not a large
abstraction) — and deliberately did **not** touch `CreateGroupScreen.tsx`'s or `EditGroupScreen.tsx`'s own
selection option arrays or persisted-value behavior, since reconciling those taxonomies is a separate,
higher-risk product decision this task did not ask for and explicitly told me to preserve ("Do not run a
migration unless genuinely required", "preserve group edit behavior"). **This divergence should be flagged to
the founder as a follow-up product decision** (should Create and Edit offer the same activity/wellness/goal
options?) — not something resolved here.

`groupOptionLabels.ts` exports: `GROUP_TYPE_LABELS`, `LOCATION_SCOPE_LABELS`, `ACTIVITY_LABELS`,
`WELLNESS_LABELS`, `GROUP_GOAL_ID_LABELS` (all `Record<string,string>`), and helper functions
`getGroupTypeLabel`/`getLocationScopeLabel`/`getActivityLabel`/`getWellnessLabel`/`getGroupGoalLabel`, each with
a graceful `humanize()` fallback for any value not in the lookup (dashes→spaces, title-case) — never
"undefined". `GroupSharedHeader.tsx` and `GroupDetailsModal.tsx` both import from this single module.

## 7. Legacy and empty-state handling

Verified live (see §9) against a Firestore-legacy-style group with none of the 5 fields set: hero shows no
Type/Scope pills at all; modal skips straight from the handle bar to the About/Rules & Privacy sections with no
blank headings, no empty containers, no raw `[]` output. The modal's overall empty-state message ("No additional
details for this group.") only appears when *every* section (Group Focus, Activities, Wellness, Goals, About,
Rules) is empty.

**Bonus fix (Section F requirement):** while testing Case 4 (many selections), discovered the close button was
scrolling out of view because the entire modal — handle bar, header, and content — was one scroll container.
Restructured to a flex column: the handle bar + header (with the close button) is now `shrink-0` and stays
pinned, while only the content area (`overflow-y-auto`) scrolls beneath it. Verified fixed live at 360px width
with a long-content group.

## 8. Automated verification results

```
npx tsc --noEmit                              → clean, 0 errors
npm run build                                  → succeeds (pre-existing >500kB chunk warning only)
npx tsx scripts/testGroupDetailAndEdit.ts      → PASS (all ~40 new assertions + all pre-existing ones)
npx tsx scripts/testMobileLayoutGuards.ts      → PASS (54/54)

Full guard suite (scripts/test*.ts, 53 scripts):
PASSED: 53
FAILED: 0
```

No new failures. No pre-existing failures either — the full suite is fully green.

## 9. Manual test results

Created 5 real Firestore group documents (`gd-test-case1-full` … `gd-test-case5-private`) via an authenticated
admin script, owned by a real test account, viewed live in the Browser pane, then deleted after testing.

| Case | Result |
|---|---|
| 1 — Fully configured public group | ✅ Hero shows "FITNESS"/"LOCAL"; modal shows Group Focus, Activities (Running, Yoga, CrossFit / HIIT), Wellness Topics (Sleep & Recovery, Mindfulness), Group Goals (Keep Fit Together, Build Consistency — confirms both Create-literal and Edit-id representations resolve correctly, including cross-taxonomy ids like `crossfit`/`mindfulness`); About and Rules & Privacy intact. Escape key closes the modal. |
| 2 — Only some optional fields | ✅ Hero shows only "WELLNESS" (no Scope pill). Modal shows Group Focus with only Type row (no Scope row), Activities with only "Hiking", no Wellness Topics or Group Goals sections at all. |
| 3 — Legacy group, no new fields | ✅ Hero shows no Type/Scope pills. Modal renders straight from header to About/Rules & Privacy — no Group Focus/Activities/Wellness/Goals sections, no blank containers, no "undefined". |
| 4 — Long values, many selections | ✅ 10 activities / 8 wellness topics / 8 goals all wrap naturally across multiple lines; confirmed `document.body.scrollWidth === document.body.clientWidth` (no horizontal overflow) at both desktop and 360px widths; found and fixed the close-button-scrolls-away issue (§7); close button confirmed clickable after the fix. |
| 5 — Private group | ✅ Hero shows "PRIVATE GROUP" badge (pre-existing, unchanged) alongside the new "WORKPLACE" Type and "WORKPLACE" Scope pills with no conflict. Modal: About → Privacy "Private group"; Rules & Privacy → Visibility "Private — invite or approval required", Approval "Admin must approve new members", Challenges "Only admins can create challenges" — all accurate and unaffected by the new sections. |

Join/Leave/Create Challenge controls, tab navigation, and Edit Group button were visually confirmed unchanged
throughout all 5 cases (same buttons, same positions, same underlying mutation calls per the guard's assertions).

## 10. Unresolved gaps or decisions

- **Create/Edit taxonomy divergence** (§6) — flagged for founder/product decision, intentionally not fixed here.
- Native `<dialog>`/focus-trap was not introduced (task said "Add Escape handling only if it can be done safely
  without introducing a new modal framework" — a `keydown` listener was sufficient and lower-risk).
- The `LOCATION_SCOPE_LABELS` wording was standardized to Create's shorter style (e.g. "Local" vs Edit's "Local
  community") since that fits both the compact hero pill and the modal's MetaRow — this is a display-only choice
  and doesn't touch either screen's own copy.
