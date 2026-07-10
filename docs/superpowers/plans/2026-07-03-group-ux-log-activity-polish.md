# Phase 18I-6J: Group UX and Log Activity Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 6 issues in group navigation and challenge logging: remove the group leaderboard tab, standardize tab headers with a shared cover-photo hero, add a clickable member detail modal, fix competitive challenge progress to use the canonical resolver, and fix the join-group first-click bug.

**Architecture:** All changes are client-only React + TanStack Query. No new Firestore collections, no Cloud Function changes. New shared component `GroupHeroHeader` is extracted from `GroupFeedScreen`'s existing hero pattern and reused in `GroupDetailScreen` and `GroupMembersScreen`. The competitive progress fix replaces `membership?.cumulativeValues` reads with the already-computed `resolveChallengeProgress` output that correctly uses `membership.cumulativeLoggedValue`. Join bug fix adds `retry: 1` (300 ms delay) to `useJoinGroup` and invalidates `home-screen-data` on success.

**Tech Stack:** React, TypeScript, TanStack React Query v5, React Router v6, Tailwind CSS, Firestore (read-only from client), Lucide React icons.

## Global Constraints

- Do NOT deploy. Do NOT run production writes.
- Do NOT bundle unrelated changes.
- Work in phases. Stop after each phase.
- Branch: `fix/p0-pre-deploy-blockers` — commit all changes here.
- No new Firestore collections, no Cloud Function changes.
- No new npm packages.
- Do NOT remove `GroupLeaderboardScreen.tsx` file — the route stays, but the tab is removed and the screen content is replaced with a redirect message.
- Challenge-level leaderboards (`ChallengeLeaderboardScreen`) are unchanged.
- Member detail modal shows ONLY: display name, role, joined date, streak. No email, phone, or private profile fields.
- Test script file pattern: `scripts/testGroupUxPolish.ts`, uses `node:assert/strict` + `readFileSync` only (no Firestore calls). Add `"test:group-ux-polish": "tsx scripts/testGroupUxPolish.ts"` to `package.json`.
- Validation suite to run after completion: `tsc --noEmit`, `npm run build`, `npm run test:group-ux-polish`, `npm run test:group-lifecycle`, `npm run test:pilot-ux-polish-guards`.

---

## File Map

| File | Action | Notes |
|------|--------|-------|
| `src/features/Groups/components/GroupDetailTabs.tsx` | Modify | Remove `leaderboard` tab; update `active` type to 3-way union |
| `src/features/Groups/GroupLeaderboardScreen.tsx` | Modify | Replace content with redirect message + link to challenges tab |
| `src/features/Groups/components/GroupHeroHeader.tsx` | Create | Shared hero extracted from GroupFeedScreen's inline hero |
| `src/features/Groups/GroupDetailScreen.tsx` | Modify | Remove sticky header + 96px avatar section; add GroupHeroHeader + compact action bar |
| `src/features/Groups/GroupMembersScreen.tsx` | Modify | Remove sticky header; add GroupHeroHeader; make member rows clickable; add MemberDetailModal |
| `src/features/Groups/GroupFeedScreen.tsx` | No change | Already has correct hero |
| `src/features/Workouts/SelectChallengeActivityScreen.tsx` | Modify | Remove `competitiveActivities` useMemo; replace "My Progress" card with resolver output |
| `src/hooks/useGroups.ts` | Modify | Add `retry: 1` + `retryDelay: 300` to `useJoinGroup`; throw on null result; invalidate `home-screen-data` on success |
| `scripts/testGroupUxPolish.ts` | Create | 13 static analysis guards |
| `package.json` | Modify | Add `test:group-ux-polish` script |

---

## Task 1: Fix competitive progress source in SelectChallengeActivityScreen

**Files:**
- Modify: `src/features/Workouts/SelectChallengeActivityScreen.tsx`

**Context:**
The "My Progress" card for competitive challenges reads `membership?.cumulativeValues?.[key]` — a per-activity map field that is often not written to Firestore, causing the card to always show 0. The file already imports and uses `resolveChallengeProgress` (via `_rp`), which returns `_rp.userTotal` (= `membership.cumulativeLoggedValue`, reliably written on every log). Fix: delete the `competitiveActivities` useMemo, replace the "My Progress" card with `_rp.progressPercent` + `_rp.primaryLabel`, and remove the per-activity inline labels under each activity row.

**Interfaces:**
- `_rp` is already computed on line ~148: `const _rp = resolveChallengeProgress({ challenge: challenge ?? null, membership: membership ?? null });`
- `_rp.progressPercent` — 0-100 integer, correct for all challenge types
- `_rp.primaryLabel` — human-readable string, e.g. `"100 / 500 minutes"`
- `_rp.userTotal` — raw number (membership.cumulativeLoggedValue)

- [ ] **Step 1: Add guard to test file first (TDD)**

Create `scripts/testGroupUxPolish.ts` with a single guard that will fail until the fix lands:

```ts
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const selectScreen = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');

assert.doesNotMatch(
  selectScreen,
  /cumulativeValues/,
  'SelectChallengeActivityScreen must not read membership.cumulativeValues — use resolveChallengeProgress output instead',
);

console.log('✅ testGroupUxPolish — 1/1 passed (competitive progress source)');
```

- [ ] **Step 2: Run the guard — confirm it fails**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: `AssertionError: SelectChallengeActivityScreen must not read membership.cumulativeValues`

- [ ] **Step 3: Delete `competitiveActivities` useMemo in SelectChallengeActivityScreen**

Find and remove lines 158–167 (the `competitiveActivities` useMemo):

```ts
// DELETE this entire block:
const competitiveActivities = useMemo(() => {
  if (!challenge?.activities) return [];
  return challenge.activities.map((activity) => {
    const key = resolveActivityKey(activity);
    const cumulative = membership?.cumulativeValues?.[key] ?? 0;
    const target = activity.targetValue ?? 0;
    const pct = target > 0 ? Math.min(100, Math.round((cumulative / target) * 100)) : 0;
    return { name: activity.exerciseName || key, cumulative, target, unit: activity.unit, pct };
  });
}, [challenge?.activities, membership?.cumulativeValues]);
```

- [ ] **Step 4: Replace the competitive "My Progress" card**

Find the block starting with `{challengeType === 'competitive' && competitiveActivities.length > 0 && (` (around line 315) and replace it:

```tsx
{/* Competitive overall progress */}
{challengeType === 'competitive' && (
  <div className="st-card p-4">
    <div className="flex items-center gap-2 mb-3">
      <Trophy size={16} className="text-primary" />
      <p className="text-[13px] leading-[16px] font-bold text-primary uppercase tracking-[0.08em]">My Progress</p>
    </div>
    <div className="h-2.5 rounded-full bg-[#e8edf5] overflow-hidden">
      <div className="h-full rounded-full bg-primary" style={{ width: `${_rp.progressPercent}%` }} />
    </div>
    <div className="mt-2 flex items-center justify-between">
      <p className="text-[13px] leading-[16px] text-slate-700">{_rp.primaryLabel}</p>
      <p className="text-[15px] font-black text-primary">{_rp.progressPercent}%</p>
    </div>
  </div>
)}
```

- [ ] **Step 5: Remove per-activity inline competitive labels under each activity row**

Find lines ~466–473 (inside the activity card):

```tsx
{isV2 && challengeType === 'competitive' && (() => {
  const found = competitiveActivities.find((a) => a.name === (match?.name || activity.exerciseName));
  return found && found.target > 0 ? (
    <p className="mt-0.5 text-[12px] text-primary font-semibold">
      {found.cumulative.toLocaleString()} / {found.target.toLocaleString()} {found.unit}
    </p>
  ) : null;
})()}
```

Delete this entire block (it now has no data source). The progress card above already shows the total.

- [ ] **Step 6: Clean up unused imports**

If `resolveActivityKey` is now only used inside `handleLog` (not in the deleted useMemo), check if it's still used. Keep it if any other code uses it. Remove `membership?.cumulativeValues` from any TypeScript type expectations if present.

Run TypeScript check: `npx tsc --noEmit 2>&1 | head -20`
Expected: no errors related to `competitiveActivities` or `cumulativeValues`.

- [ ] **Step 7: Run the guard — confirm it passes**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: `✅ testGroupUxPolish — 1/1 passed (competitive progress source)`

- [ ] **Step 8: Commit**

```bash
git add src/features/Workouts/SelectChallengeActivityScreen.tsx scripts/testGroupUxPolish.ts
git commit -m "fix(p18i-6j-a): replace cumulativeValues with resolver output for competitive progress"
```

---

## Task 2: Remove Group Leaderboard tab + redirect screen

**Files:**
- Modify: `src/features/Groups/components/GroupDetailTabs.tsx`
- Modify: `src/features/Groups/GroupLeaderboardScreen.tsx`

**Context:**
`GroupDetailTabs` renders 4 tabs including Leaderboard. The Leaderboard tab routes to `GroupLeaderboardScreen`. Remove the tab from navigation. Keep the route (don't delete the screen file or route) but replace `GroupLeaderboardScreen` content with a redirect message: "Group leaderboard has moved. Challenge leaderboards are available inside each challenge." + a button to navigate back to the Challenges tab.

**Verify challenge-level leaderboards are unchanged:** `ChallengeLeaderboardScreen.tsx` is NOT modified in this task. Grep to confirm: `grep -l "ChallengeLeaderboardScreen" src/` should show it exists and untouched.

- [ ] **Step 1: Write guard for tab removal (add to testGroupUxPolish.ts)**

Append to `scripts/testGroupUxPolish.ts`:

```ts
const groupDetailTabs = readFileSync('src/features/Groups/components/GroupDetailTabs.tsx', 'utf8');

assert.doesNotMatch(
  groupDetailTabs,
  /leaderboard/,
  'GroupDetailTabs must not contain a leaderboard tab entry',
);

assert.doesNotMatch(
  groupDetailTabs,
  /'feed' \| 'challenges' \| 'members' \| 'leaderboard'/,
  "GroupDetailTabs active prop type must be 3-way union (no 'leaderboard')",
);

assert.match(
  groupDetailTabs,
  /grid-cols-3/,
  'GroupDetailTabs must use grid-cols-3 after removing the leaderboard tab',
);
```

- [ ] **Step 2: Run guard — confirm it fails**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: assertion failures about leaderboard.

- [ ] **Step 3: Update GroupDetailTabs.tsx**

Replace the entire file with:

```tsx
import { useNavigate } from 'react-router-dom';

type Props = {
  groupId: string;
  active: 'feed' | 'challenges' | 'members';
};

const tabs: Array<{ key: Props['active']; label: string; path: (groupId: string) => string }> = [
  { key: 'feed', label: 'Feed', path: (groupId) => `/app/group/${groupId}/feed` },
  { key: 'challenges', label: 'Challenges', path: (groupId) => `/app/group/${groupId}` },
  { key: 'members', label: 'Members', path: (groupId) => `/app/group/${groupId}/members` },
];

export function GroupDetailTabs({ groupId, active }: Props) {
  const navigate = useNavigate();

  return (
    <div className="border-y border-slate-200 bg-white px-4">
      <div className="mx-auto max-w-mobile">
        <div className="grid grid-cols-3 items-stretch">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`h-14 w-full min-w-0 border-b-[3px] px-1 text-center text-[12px] leading-[16px] font-semibold whitespace-nowrap ${
                active === tab.key ? 'text-primary border-primary' : 'text-slate-500 border-transparent'
              }`}
              onClick={() => navigate(tab.path(groupId))}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Fix the TypeScript error in GroupLeaderboardScreen**

`GroupLeaderboardScreen` passes `active="leaderboard"` to `GroupDetailTabs`. Since `'leaderboard'` is no longer a valid value, remove the `GroupDetailTabs` usage from `GroupLeaderboardScreen` (the screen is now a redirect page, so it doesn't need group tabs at all).

Replace `GroupLeaderboardScreen.tsx` entirely:

```tsx
import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup } from '../../hooks/useGroups';
import { GroupBottomNav } from './components/GroupBottomNav';

function GroupLeaderboardScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: group } = useGroup(id);

  useEffect(() => {
    if (id) setActiveGroupId(id);
  }, [id]);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 px-4 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              className="h-10 w-10 flex items-center justify-center text-slate-900"
              onClick={() => navigate(id ? `/app/group/${id}` : '/app/groups')}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[20px] leading-[24px] font-black text-slate-900">
              {group?.name ?? 'Group'}
            </h1>
          </div>
        </header>

        <main className="px-4 pt-8">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-[20px] leading-[26px] font-black text-slate-900">Group leaderboard has moved</p>
            <p className="mt-3 text-[15px] leading-[22px] text-[#61758f]">
              Challenge leaderboards are now available inside each challenge. Open any active challenge to see rankings.
            </p>
            <button
              className="mt-5 h-12 w-full rounded-xl bg-primary text-white text-[15px] font-bold"
              onClick={() => navigate(id ? `/app/group/${id}` : '/app/groups')}
            >
              View Group Challenges
            </button>
          </div>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupLeaderboardScreen;
```

- [ ] **Step 5: Run TypeScript — confirm clean**

```bash
cd /Users/theo/tiizi_revamp && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors (no callers pass `active="leaderboard"` after this change; GroupLeaderboardScreen no longer imports GroupDetailTabs).

- [ ] **Step 6: Run guards — confirm pass**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: all guards pass.

- [ ] **Step 7: Commit**

```bash
git add src/features/Groups/components/GroupDetailTabs.tsx src/features/Groups/GroupLeaderboardScreen.tsx scripts/testGroupUxPolish.ts
git commit -m "fix(p18i-6j-b): remove group leaderboard tab; replace screen with redirect message"
```

---

## Task 3: Shared GroupHeroHeader + standardize Challenges and Members tab headers

**Files:**
- Create: `src/features/Groups/components/GroupHeroHeader.tsx`
- Modify: `src/features/Groups/GroupDetailScreen.tsx`
- Modify: `src/features/Groups/GroupMembersScreen.tsx`

**Context:**
`GroupFeedScreen` has a full-bleed 270px cover photo hero with gradient, back button, group name, and tag badges. `GroupDetailScreen` (Challenges tab) has a compact sticky navbar + a small 96×96 avatar section. `GroupMembersScreen` has a compact sticky navbar with no image. Extract the hero pattern into `GroupHeroHeader`, apply it to both Challenges and Members tabs. GroupFeedScreen keeps its existing inline hero (no change needed there).

After this change, all three tabs (Feed, Challenges, Members) display the cover photo hero when you first land. Scrolling down reveals the tabs which remain in the natural scroll flow (not sticky — matching GroupFeedScreen's existing behavior).

**Interfaces:**
```ts
// GroupHeroHeader props
type GroupHeroHeaderProps = {
  groupName: string;
  coverImageUrl?: string;
  memberCount: number;
  isPrivate: boolean;
  onBack: () => void;
};
```

- [ ] **Step 1: Write guards (add to testGroupUxPolish.ts)**

```ts
const groupHeroHeader = readFileSync('src/features/Groups/components/GroupHeroHeader.tsx', 'utf8');
const groupMembersScreen = readFileSync('src/features/Groups/GroupMembersScreen.tsx', 'utf8');
const groupDetailScreen = readFileSync('src/features/Groups/GroupDetailScreen.tsx', 'utf8');

assert.match(
  groupHeroHeader,
  /GroupHeroHeader/,
  'GroupHeroHeader component must exist',
);

assert.match(
  groupMembersScreen,
  /GroupHeroHeader/,
  'GroupMembersScreen must use GroupHeroHeader',
);

assert.doesNotMatch(
  groupMembersScreen,
  /sticky top-0.*h-10.*ArrowLeft|ArrowLeft.*sticky top-0/s,
  'GroupMembersScreen must not have old sticky header with ArrowLeft outside the hero',
);

assert.match(
  groupDetailScreen,
  /GroupHeroHeader/,
  'GroupDetailScreen must use GroupHeroHeader',
);
```

- [ ] **Step 2: Run guards — confirm they fail**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: assertions about GroupHeroHeader fail.

- [ ] **Step 3: Create GroupHeroHeader.tsx**

```tsx
// src/features/Groups/components/GroupHeroHeader.tsx
import { ArrowLeft } from 'lucide-react';

const heroFallback = 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80';

type GroupHeroHeaderProps = {
  groupName: string;
  coverImageUrl?: string;
  memberCount: number;
  isPrivate: boolean;
  onBack: () => void;
};

export function GroupHeroHeader({ groupName, coverImageUrl, memberCount, isPrivate, onBack }: GroupHeroHeaderProps) {
  return (
    <section className="relative h-[270px]">
      <img src={coverImageUrl || heroFallback} alt={groupName} className="h-full w-full object-cover" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/20 to-black/70" />

      <div className="absolute left-4 right-4 top-5 flex items-center justify-between">
        <button
          className="h-11 w-11 rounded-full bg-white/25 backdrop-blur text-white flex items-center justify-center"
          onClick={onBack}
        >
          <ArrowLeft size={22} />
        </button>
      </div>

      <div className="absolute left-4 right-4 bottom-4">
        <h1 className="text-[20px] leading-[24px] font-black text-white">{groupName}</h1>
        <div className="mt-2 flex gap-2">
          <span className="rounded-full border border-white/60 bg-black/35 px-3 py-1 text-[12px] leading-[14px] font-bold uppercase tracking-[0.08em] text-white">
            {isPrivate ? 'Private Group' : 'Public Group'}
          </span>
          <span className="rounded-full border border-white/60 bg-black/35 px-3 py-1 text-[12px] leading-[14px] font-bold uppercase tracking-[0.08em] text-white">
            {memberCount.toLocaleString()} Members
          </span>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Update GroupDetailScreen.tsx**

In `GroupDetailScreen`, make two changes:

**4a. Remove the sticky `<header>` block** (lines 183–208 approx, the entire `<header className="sticky top-0 z-20 ...">` element including its `</header>` closing tag).

**4b. Replace the `<section className="px-4 pt-4 pb-5 bg-white border-b border-slate-200">` block** (the 96×96 avatar + join/leave section, lines 210–251 approx) with:

```tsx
<GroupHeroHeader
  groupName={group?.name ?? ''}
  coverImageUrl={group?.coverImageUrl}
  memberCount={memberCount}
  isPrivate={group?.isPrivate ?? false}
  onBack={() => navigate('/app/groups')}
/>

{/* Compact action bar below hero */}
{membershipStatus === 'joined' && (
  <div className="px-4 py-3 bg-white border-b border-slate-200 flex items-center gap-2">
    <button className="h-10 px-5 rounded-xl bg-[#e9eff8] text-slate-900 text-[15px] font-semibold">✓ Joined</button>
    <button
      className="h-10 px-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-[14px] font-semibold disabled:opacity-60"
      disabled={leaveGroup.isPending}
      onClick={async () => {
        if (!id) return;
        try {
          await leaveGroup.mutateAsync(id);
          showToast('You left this group.', 'success');
          navigate('/app/groups');
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Could not leave group.';
          showToast(message, 'error');
        }
      }}
    >
      {leaveGroup.isPending ? 'Leaving...' : 'Leave'}
    </button>
  </div>
)}
{membershipStatus === 'pending' && (
  <div className="px-4 py-3 bg-white border-b border-slate-200">
    <button className="h-10 px-5 rounded-xl bg-[#fff1e7] text-primary text-[15px] font-semibold">Pending Approval</button>
  </div>
)}
{membershipStatus === 'none' && !isDeactivated && (
  <div className="px-4 py-3 bg-white border-b border-slate-200">
    <button
      className="h-10 px-5 rounded-xl bg-primary text-white text-[15px] font-semibold disabled:opacity-60"
      onClick={handleJoin}
      disabled={joinGroup.isPending}
    >
      {joinGroup.isPending ? 'Joining...' : 'Join Group'}
    </button>
  </div>
)}
```

**4c. Add GroupHeroHeader to the import** at the top of GroupDetailScreen:

```tsx
import { GroupHeroHeader } from './components/GroupHeroHeader';
```

**4d. Remove unused imports** — `ShieldCheck` from lucide-react is no longer needed (was used in the 96px avatar section). Remove it from the import.

- [ ] **Step 5: Update GroupMembersScreen.tsx**

**5a. Remove the entire `<header className="sticky top-0 z-20 ...">` block** (lines 77–86 approx, the sticky navbar with ArrowLeft, group name, MoreHorizontal, member count, and "Community Group" badge).

**5b. Add GroupHeroHeader right before `<GroupDetailTabs .../>` in the return**:

```tsx
<GroupHeroHeader
  groupName={group.name}
  coverImageUrl={group.coverImageUrl}
  memberCount={memberCount}
  isPrivate={group.isPrivate ?? false}
  onBack={() => navigate(`/app/group/${id}`)}
/>
```

**5c. Add GroupHeroHeader to imports**:

```tsx
import { GroupHeroHeader } from './components/GroupHeroHeader';
```

**5d. Remove now-unused imports** — `ArrowLeft`, `MoreHorizontal` from lucide-react are no longer needed in GroupMembersScreen.

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/theo/tiizi_revamp && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Run guards — confirm pass**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: all guards pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/Groups/components/GroupHeroHeader.tsx src/features/Groups/GroupDetailScreen.tsx src/features/Groups/GroupMembersScreen.tsx scripts/testGroupUxPolish.ts
git commit -m "feat(p18i-6j-e): extract GroupHeroHeader; standardize Challenges and Members tab headers"
```

---

## Task 4: Clickable member rows + member detail modal

**Files:**
- Modify: `src/features/Groups/GroupMembersScreen.tsx`

**Context:**
Member rows in `GroupMembersScreen` have a `›` chevron indicating they should be interactive, but they're plain `<article>` tags with no click handler. Add an `onClick` that opens a bottom sheet modal displaying: name, role badge, joined date, streak string — all already present in `GroupMemberItem`. Modal uses a state variable `selectedMember: GroupMemberItem | null`. Close on backdrop tap or explicit close button.

`GroupMemberItem` type (from `src/services/groupInsightsService.ts`):
```ts
type GroupMemberItem = {
  id: string;
  name: string;
  role: 'Coach' | 'Member';
  streak: string;
  joinedAt?: string;
};
```

- [ ] **Step 1: Write guard (add to testGroupUxPolish.ts)**

```ts
const groupMembersScreenV2 = readFileSync('src/features/Groups/GroupMembersScreen.tsx', 'utf8');

assert.match(
  groupMembersScreenV2,
  /selectedMember/,
  'GroupMembersScreen must have selectedMember state for member detail modal',
);

assert.match(
  groupMembersScreenV2,
  /onClick.*setSelectedMember|setSelectedMember.*onClick/s,
  'GroupMembersScreen community member rows must call setSelectedMember on click',
);
```

- [ ] **Step 2: Run guard — confirm it fails**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: selectedMember assertion fails.

- [ ] **Step 3: Add `selectedMember` state**

At the top of `GroupMembersScreen` (after existing `useState` imports), add:

```tsx
import type { GroupMemberItem } from '../../services/groupInsightsService';
// ...
const [selectedMember, setSelectedMember] = useState<GroupMemberItem | null>(null);
```

- [ ] **Step 4: Make community member rows clickable**

Find the `others.map((member) => ...)` block. Change the `<article>` to add an `onClick`:

```tsx
<article
  key={member.id}
  className="rounded-[20px] border border-slate-200 bg-white px-4 py-4 flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] cursor-pointer active:bg-slate-50"
  onClick={() => setSelectedMember(member)}
>
```

Also make organizer (admin) rows clickable the same way:

```tsx
<article
  key={member.id}
  className="rounded-[22px] border border-[#f8d6bd] bg-white p-4 flex items-center justify-between gap-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] cursor-pointer active:bg-slate-50"
  onClick={() => setSelectedMember(member)}
>
```

- [ ] **Step 5: Add MemberDetailModal inside GroupMembersScreen's return**

Add this just before `<GroupBottomNav active="groups" />` in the return:

```tsx
{/* Member detail modal */}
{selectedMember && (
  <div
    className="fixed inset-0 z-50 flex items-end justify-center"
    onClick={() => setSelectedMember(null)}
  >
    <div className="absolute inset-0 bg-black/40" />
    <div
      className="relative w-full max-w-mobile rounded-t-[28px] bg-white px-6 pt-6 pb-10 shadow-xl"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Handle */}
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-slate-200" />

      {/* Name + role */}
      <div className="flex items-center justify-between gap-3">
        <p className="text-[22px] leading-[28px] font-black text-slate-900">{selectedMember.name}</p>
        {selectedMember.role === 'Coach' ? (
          <span className="rounded-full bg-[#fff1e7] px-3 py-1 text-[12px] leading-[14px] font-bold text-primary">LEAD</span>
        ) : (
          <span className="rounded-full bg-slate-100 px-3 py-1 text-[12px] leading-[14px] font-semibold text-slate-600">Member</span>
        )}
      </div>

      {/* Stats */}
      <div className="mt-5 space-y-3">
        <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
          <p className="text-[14px] leading-[18px] font-semibold text-slate-500">Joined</p>
          <p className="text-[14px] leading-[18px] font-bold text-slate-900">{formatJoined(selectedMember.joinedAt)}</p>
        </div>
        {selectedMember.streak && (
          <div className="flex items-center justify-between rounded-xl bg-slate-50 px-4 py-3">
            <p className="text-[14px] leading-[18px] font-semibold text-slate-500">Streak</p>
            <p className="text-[14px] leading-[18px] font-bold text-slate-900">{selectedMember.streak}</p>
          </div>
        )}
      </div>

      <button
        className="mt-6 w-full h-12 rounded-xl bg-slate-100 text-[15px] font-bold text-slate-700"
        onClick={() => setSelectedMember(null)}
      >
        Close
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 6: TypeScript check**

```bash
cd /Users/theo/tiizi_revamp && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 7: Run guards**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: all guards pass.

- [ ] **Step 8: Commit**

```bash
git add src/features/Groups/GroupMembersScreen.tsx scripts/testGroupUxPolish.ts
git commit -m "feat(p18i-6j-d): clickable member rows with detail modal in GroupMembersScreen"
```

---

## Task 5: Fix join group first-click bug

**Files:**
- Modify: `src/hooks/useGroups.ts`
- Modify: `src/features/Groups/GroupDetailScreen.tsx`

**Context:**
`useJoinGroup` does not retry on failure and returns `null` (rather than throwing) when `groupService.joinGroup` returns null. The first-click sometimes fails because the Firestore auth token hasn't finished initializing; the second click works. Fix:
1. In `useJoinGroup`: throw when result is null (so TanStack Query's `retry` can catch it); add `retry: 1`, `retryDelay: 300`.
2. In `useJoinGroup.onSuccess`: add `queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] })` so the Home screen reflects the new membership.
3. In `GroupDetailScreen.handleJoin`: remove the `if (!result)` branch (mutation now throws instead of returning null).

- [ ] **Step 1: Write guards (add to testGroupUxPolish.ts)**

```ts
const useGroupsHook = readFileSync('src/hooks/useGroups.ts', 'utf8');

assert.match(
  useGroupsHook,
  /retry.*1|retryDelay/,
  'useJoinGroup must have retry: 1 to handle first-click auth token race',
);

assert.match(
  useGroupsHook,
  /home-screen-data/,
  'useJoinGroup onSuccess must invalidate home-screen-data so Home feed reflects membership',
);
```

- [ ] **Step 2: Run guards — confirm they fail**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: retry and home-screen-data assertions fail.

- [ ] **Step 3: Update `useJoinGroup` in src/hooks/useGroups.ts**

Replace the `useJoinGroup` function (lines 102–124) with:

```ts
export function useJoinGroup() {
  const queryClient = useQueryClient();
  const { user } = useAuth();

  return useMutation({
    mutationFn: async ({ groupId, inviteCode }: { groupId?: string; inviteCode?: string }) => {
      if (!user?.uid) throw new Error('User required');
      let result;
      if (groupId) result = await groupService.joinGroup(groupId, user.uid);
      else if (inviteCode) result = await groupService.joinGroupByInviteCode(inviteCode, user.uid);
      else throw new Error('Group identifier required');
      if (!result) throw new Error('Group not found or not active');
      return result;
    },
    retry: 1,
    retryDelay: 300,
    onSuccess: (result, variables) => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
      queryClient.invalidateQueries({ queryKey: ['my-groups'] });
      queryClient.invalidateQueries({ queryKey: ['home-screen-data', user?.uid] });
      const resolvedGroupId = result?.group?.id ?? variables.groupId;
      if (resolvedGroupId) {
        queryClient.invalidateQueries({ queryKey: ['group-member-count', resolvedGroupId] });
        queryClient.invalidateQueries({ queryKey: ['group-membership', resolvedGroupId, user?.uid] });
        queryClient.invalidateQueries({ queryKey: ['group', resolvedGroupId, user?.uid] });
      }
    },
  });
}
```

- [ ] **Step 4: Update `handleJoin` in GroupDetailScreen.tsx**

Remove the `if (!result)` branch since the mutation now throws instead of returning null. Replace:

```ts
const handleJoin = async () => {
  if (!id) return;
  try {
    const result = await joinGroup.mutateAsync({ groupId: id });
    if (!result) {
      showToast('Could not join group.', 'error');
      return;
    }
    if (result.status === 'pending') {
      showToast('Join request sent for approval.', 'success');
      return;
    }
    showToast('Joined group.', 'success');
  } catch {
    showToast('Could not join group.', 'error');
  }
};
```

With:

```ts
const handleJoin = async () => {
  if (!id) return;
  try {
    const result = await joinGroup.mutateAsync({ groupId: id });
    if (result.status === 'pending') {
      showToast('Join request sent for approval.', 'success');
      return;
    }
    showToast('Joined group.', 'success');
  } catch {
    showToast('Could not join group.', 'error');
  }
};
```

- [ ] **Step 5: TypeScript check**

```bash
cd /Users/theo/tiizi_revamp && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors.

- [ ] **Step 6: Run guards**

```bash
cd /Users/theo/tiizi_revamp && npx tsx scripts/testGroupUxPolish.ts
```

Expected: all guards pass.

- [ ] **Step 7: Commit**

```bash
git add src/hooks/useGroups.ts src/features/Groups/GroupDetailScreen.tsx scripts/testGroupUxPolish.ts
git commit -m "fix(p18i-6j-f): retry join group on first-click failure; invalidate home-screen-data on join"
```

---

## Task 6: Complete test suite + add to package.json

**Files:**
- Modify: `scripts/testGroupUxPolish.ts` (finalize header + total count log)
- Modify: `package.json`

**Context:**
Add the script entry to `package.json` and finalize the test file with a complete summary log. Run all relevant validation suites and confirm all pass.

- [ ] **Step 1: Finalize testGroupUxPolish.ts**

Ensure the file begins with a comment header and ends with a count log. The final file should look like:

```ts
/**
 * Phase 18I-6J — Group UX and Log Activity Polish guards
 *
 * Uses readFileSync-only pattern (no Firestore calls).
 * Run: npm run test:group-ux-polish
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// ── Issue A: competitive progress uses resolver, not cumulativeValues ─────────

const selectScreen = readFileSync('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'utf8');

assert.doesNotMatch(
  selectScreen,
  /cumulativeValues/,
  'SelectChallengeActivityScreen must not read membership.cumulativeValues — use resolveChallengeProgress output instead',
);

// ── Issue B: group leaderboard tab removed ────────────────────────────────────

const groupDetailTabs = readFileSync('src/features/Groups/components/GroupDetailTabs.tsx', 'utf8');

assert.doesNotMatch(
  groupDetailTabs,
  /leaderboard/,
  'GroupDetailTabs must not contain a leaderboard tab entry',
);

assert.doesNotMatch(
  groupDetailTabs,
  /'feed' \| 'challenges' \| 'members' \| 'leaderboard'/,
  "GroupDetailTabs active prop type must be 3-way union (no 'leaderboard')",
);

assert.match(
  groupDetailTabs,
  /grid-cols-3/,
  'GroupDetailTabs must use grid-cols-3 after removing the leaderboard tab',
);

// ── Issue B: redirect message in GroupLeaderboardScreen ──────────────────────

const groupLeaderboardScreen = readFileSync('src/features/Groups/GroupLeaderboardScreen.tsx', 'utf8');

assert.match(
  groupLeaderboardScreen,
  /Group leaderboard has moved/,
  'GroupLeaderboardScreen must show redirect message "Group leaderboard has moved"',
);

assert.doesNotMatch(
  groupLeaderboardScreen,
  /GroupDetailTabs/,
  'GroupLeaderboardScreen must not render GroupDetailTabs (it is a redirect page)',
);

// ── Issue E: shared GroupHeroHeader ──────────────────────────────────────────

const groupHeroHeader = readFileSync('src/features/Groups/components/GroupHeroHeader.tsx', 'utf8');

assert.match(
  groupHeroHeader,
  /GroupHeroHeader/,
  'GroupHeroHeader component must exist and export GroupHeroHeader',
);

const groupMembersScreen = readFileSync('src/features/Groups/GroupMembersScreen.tsx', 'utf8');

assert.match(
  groupMembersScreen,
  /GroupHeroHeader/,
  'GroupMembersScreen must use GroupHeroHeader',
);

const groupDetailScreen = readFileSync('src/features/Groups/GroupDetailScreen.tsx', 'utf8');

assert.match(
  groupDetailScreen,
  /GroupHeroHeader/,
  'GroupDetailScreen must use GroupHeroHeader',
);

// ── Issue D: clickable member rows + detail modal ─────────────────────────────

const groupMembersScreenV2 = readFileSync('src/features/Groups/GroupMembersScreen.tsx', 'utf8');

assert.match(
  groupMembersScreenV2,
  /selectedMember/,
  'GroupMembersScreen must have selectedMember state for member detail modal',
);

assert.match(
  groupMembersScreenV2,
  /setSelectedMember/,
  'GroupMembersScreen community member rows must call setSelectedMember on click',
);

// ── Issue F: join group retry + home-screen-data invalidation ─────────────────

const useGroupsHook = readFileSync('src/hooks/useGroups.ts', 'utf8');

assert.match(
  useGroupsHook,
  /retry.*1|retryDelay/,
  'useJoinGroup must have retry: 1 to handle first-click auth token race',
);

assert.match(
  useGroupsHook,
  /home-screen-data/,
  'useJoinGroup onSuccess must invalidate home-screen-data so Home feed reflects membership',
);

console.log('✅ testGroupUxPolish — 13/13 passed');
```

- [ ] **Step 2: Add script to package.json**

In `package.json`, in the `"scripts"` block, add after `"test:group-lifecycle"`:

```json
"test:group-ux-polish": "tsx scripts/testGroupUxPolish.ts",
```

- [ ] **Step 3: Run full validation suite**

```bash
cd /Users/theo/tiizi_revamp && npm run test:group-ux-polish
```
Expected: `✅ testGroupUxPolish — 13/13 passed`

```bash
cd /Users/theo/tiizi_revamp && npm run test:group-lifecycle
```
Expected: all passed

```bash
cd /Users/theo/tiizi_revamp && npm run test:pilot-ux-polish-guards
```
Expected: all passed

```bash
cd /Users/theo/tiizi_revamp && npx tsc --noEmit
```
Expected: clean

```bash
cd /Users/theo/tiizi_revamp && npm run build 2>&1 | tail -5
```
Expected: build succeeds, no errors

- [ ] **Step 4: Commit**

```bash
git add scripts/testGroupUxPolish.ts package.json
git commit -m "test(p18i-6j): add test:group-ux-polish suite (13/13 guards)"
```

---

## Task 7: CHANGELOG + implementation report

**Files:**
- Modify: `docs/reports/member-phase-10c-change-log.md`
- Create: `docs/superpowers/reports/phase-18I-6J-group-ux-log-activity-polish.md`

- [ ] **Step 1: Add CHANGELOG entry**

Append to `docs/reports/member-phase-10c-change-log.md`:

```markdown
## Phase 18I-6J — Group UX and Log Activity Polish (2026-07-03)

**Branch:** fix/p0-pre-deploy-blockers

### Fixed
- **Issue A:** Competitive challenge "My Progress" card in SelectChallengeActivityScreen now uses `resolveChallengeProgress` output (`membership.cumulativeLoggedValue`) instead of `membership.cumulativeValues` (per-activity map that was often 0). Progress now matches Challenge Detail.
- **Issue B:** Removed Group Leaderboard tab from `GroupDetailTabs`. Tab bar is now 3 tabs: Feed / Challenges / Members. Leaderboard route preserved; screen replaced with redirect message pointing to challenge-level leaderboards.
- **Issue C:** Challenge-level leaderboards (`ChallengeLeaderboardScreen`) unchanged and fully functional.
- **Issue E:** Created shared `GroupHeroHeader` component. All group tabs now show the full-bleed cover photo hero on entry. `GroupDetailScreen` and `GroupMembersScreen` updated; `GroupFeedScreen` unchanged (already had hero).
- **Issue D:** Member rows in `GroupMembersScreen` are now clickable. Tapping a row opens a bottom-sheet modal with name, role, joined date, and streak.
- **Issue F:** `useJoinGroup` now throws on null result (enabling TanStack retry), adds `retry: 1` (300 ms delay), and invalidates `home-screen-data` on success. `handleJoin` in `GroupDetailScreen` simplified accordingly.

### Tests
- 13/13 new guards in `scripts/testGroupUxPolish.ts` (`npm run test:group-ux-polish`)
- All existing suites remain green: `test:group-lifecycle`, `test:pilot-ux-polish-guards`, `tsc --noEmit`, `npm run build`
```

- [ ] **Step 2: Write implementation report**

Create `docs/superpowers/reports/phase-18I-6J-group-ux-log-activity-polish.md` with a summary of all 6 issues, root causes, and fixes (modeled after `phase-18I-6H-collective-challenge-validation-fix.md`).

Include the validation suite results table:
```
tsc --noEmit                     clean ✅
npm run build                    clean ✅
test:group-ux-polish             13/13 ✅
test:group-lifecycle             all passed ✅
test:pilot-ux-polish-guards      all passed ✅
```

- [ ] **Step 3: Commit**

```bash
git add docs/reports/member-phase-10c-change-log.md docs/superpowers/reports/phase-18I-6J-group-ux-log-activity-polish.md
git commit -m "docs(p18i-6j): implementation report and CHANGELOG entry"
```
