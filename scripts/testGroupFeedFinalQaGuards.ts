/**
 * Phase 19A-8 — Final QA + Performance Cleanup guards.
 * Run: npx tsx scripts/testGroupFeedFinalQaGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const feedScreen   = read('src/features/Groups/GroupFeedScreen.tsx');
const cf           = read('functions/src/memberActivitySummaries.ts');
const feedCard     = read('src/features/Groups/FeedCard.tsx');
const indexes      = read('firestore.indexes.json');
const rules        = read('firestore.rules');

// ── Performance: GroupFeedScreen reads from precomputed feed only ─────────
assert.match(feedScreen, /groupActivityFeed|memberActivitySummaryService|useMemberActivity|useGroupFeed|useGroupInsights/, 'GroupFeedScreen must read from precomputed groupActivityFeed (via useGroupFeed or equivalent)');
assert.doesNotMatch(feedScreen, /collection\(db.*workouts\)|getDocs.*workouts/, 'GroupFeedScreen must not query raw workouts collection');
assert.doesNotMatch(feedScreen, /collection\(db.*wellnessLogs\)|getDocs.*wellnessLogs/, 'GroupFeedScreen must not query raw wellnessLogs collection');
assert.doesNotMatch(feedScreen, /collection\(db.*exercises\)|getDocs.*exercises/, 'GroupFeedScreen must not query raw exercises collection');

// ── Story: server-side 280-char cap enforced in CF ────────────────────────
assert.match(cf, /\.slice\(0,\s*280\)/, 'CF must enforce server-side 280-char story cap via .slice(0, 280)');

// ── Story: blank story never written ─────────────────────────────────────
assert.match(cf, /\.trim\(\)\.slice\(0,\s*280\)\s*\|\|\s*undefined|\.trim\(\).*slice.*undefined/, 'CF must not write blank story (trim + slice + || undefined guard)');

// ── Story: story field conditionally written (not always present) ─────────
assert.match(cf, /if\s*\(input\.story\)\s*feedDoc\.story/, 'CF must only write story field when input.story is truthy');

// ── Reactions path present ────────────────────────────────────────────────
assert.match(rules, /match \/reactions\/\{reactionUserId\}/, 'firestore.rules must have reactions subcollection rule');

// ── Comments/replies paths REMOVED (P0-3: V2 social toolkit is View + Kudo/React + Share) ──
// firestore.rules must NOT contain comment/reply rule paths.
assert.doesNotMatch(rules, /match \/comments\/\{commentId\}/, 'firestore.rules must NOT have comments subcollection rule (P0-3 removed)');
assert.doesNotMatch(rules, /match \/replies\/\{replyId\}/, 'firestore.rules must NOT have replies subcollection rule (P0-3 removed)');

// ── Required Firestore indexes exist ─────────────────────────────────────
assert.match(indexes, /"groupActivityFeed"/, 'firestore.indexes.json must include groupActivityFeed indexes');
// Index JSON has newlines between fields — check each field name appears in the groupActivityFeed index block
const feedIndexBlock = indexes.match(/"groupActivityFeed"[\s\S]{0,500}?"createdAt"/)?.[0] ?? '';
assert.ok(feedIndexBlock.includes('"groupId"') || feedIndexBlock.includes('"challengeId"'),
  'groupActivityFeed indexes must include groupId or challengeId paired with createdAt');
assert.match(indexes, /"groupActivityFeed"/, 'groupActivityFeed indexes block must exist in firestore.indexes.json');
assert.match(indexes, /"challengeLeaderboards"/, 'firestore.indexes.json must include challengeLeaderboards index');

// ── Filters include achievements ──────────────────────────────────────────
assert.match(feedScreen, /achievements/, "GroupFeedScreen must include 'achievements' filter");
assert.match(feedScreen, /feedItemType.*milestone|milestone.*feedItemType/, "achievements filter must match on feedItemType");

// ── Milestones unaffected by story ────────────────────────────────────────
assert.match(feedCard, /feedItemType.*!==.*milestone.*story|milestone.*story/, 'FeedCard must not render StoryBlock on milestone cards');
assert.match(feedCard, /MilestoneBadge/, 'FeedCard milestone badge must still be present');

// ── No old raw feed assembly path ────────────────────────────────────────
// GroupFeedScreen must not manually join workout/wellness data into feed objects
assert.doesNotMatch(feedScreen, /challengeName.*workout|authorName.*userId.*workoutId/, 'GroupFeedScreen must not manually assemble feed items from raw collections');

// ── staleTime set on reactions ────────────────────────────────────────────
const reactionsHook = read('src/hooks/useFeedReactions.ts');
assert.match(reactionsHook, /staleTime/, 'useFeedReactions must set staleTime to prevent excessive re-fetches');

// ── staleTime set on live stats ───────────────────────────────────────────
const liveStatsHook = read('src/hooks/useFeedLiveStats.ts');
assert.match(liveStatsHook, /staleTime/, 'useFeedLiveStats must set staleTime to prevent excessive re-fetches');

console.log('✅ All final QA guards passed.');
