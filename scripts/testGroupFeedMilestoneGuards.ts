/**
 * Phase 19A-7 — Milestone/Achievement Feed Posts guards.
 * Run: npx tsx scripts/testGroupFeedMilestoneGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const types       = read('src/types/index.ts');
const cf          = read('functions/src/memberActivitySummaries.ts');
const feedCard    = read('src/features/Groups/FeedCard.tsx');
const feedScreen  = read('src/features/Groups/GroupFeedScreen.tsx');

// ── Types ──────────────────────────────────────────────────────────────────
assert.match(types, /FeedItemType/, 'FeedItemType must be exported from src/types/index.ts');
assert.match(types, /'activity_log'.*'milestone'|'milestone'.*'activity_log'/, "FeedItemType must include 'activity_log' and 'milestone'");
assert.match(types, /MilestoneType/, 'MilestoneType must be exported from src/types/index.ts');
assert.match(types, /'first_log'/, "MilestoneType must include 'first_log'");
assert.match(types, /'collective_25'/, "MilestoneType must include 'collective_25'");
assert.match(types, /'collective_complete'/, "MilestoneType must include 'collective_complete'");
assert.match(types, /feedItemType\?.*FeedItemType|FeedItemType.*feedItemType\?/, 'GroupActivityFeedSummary must have feedItemType? field');
assert.match(types, /milestoneType\?.*MilestoneType|MilestoneType.*milestoneType\?/, 'GroupActivityFeedSummary must have milestoneType? field');

// ── CF: feedItemType stamped on regular activity_log docs ─────────────────
assert.match(cf, /feedItemType.*activity_log|activity_log.*feedItemType/, "CF must stamp feedItemType: 'activity_log' on regular feed docs");

// ── CF: checkAndQueueMilestones exists ────────────────────────────────────
assert.match(cf, /checkAndQueueMilestones/, 'CF must define checkAndQueueMilestones function');

// ── CF: deterministic milestone doc IDs ───────────────────────────────────
assert.match(cf, /`milestone_\$\{.*\}_first_log`|milestone_.*first_log/, 'CF must use deterministic doc ID for first_log milestone');
assert.match(cf, /'collective_25'/, "CF must reference 'collective_25' milestone type");

// ── CF: duplicate prevention ──────────────────────────────────────────────
assert.match(cf, /milestoneSnap\.exists|milestoneRef.*\.get\(\)/, 'CF must check milestone doc existence before writing (duplicate prevention)');

// ── CF: wired into both summarize functions ───────────────────────────────
const workoutBlock = cf.match(/summarizeWorkoutCreated[\s\S]*?(?=\nexport async function)/)?.[0] ?? '';
const wellnessBlock = cf.match(/summarizeWellnessLogCreated[\s\S]*?(?=\nexport async function)/)?.[0] ?? '';
assert.match(workoutBlock, /checkAndQueueMilestones/, 'checkAndQueueMilestones must be called inside summarizeWorkoutCreated');
assert.match(wellnessBlock, /checkAndQueueMilestones/, 'checkAndQueueMilestones must be called inside summarizeWellnessLogCreated');

// ── CF: called after queueActivitySummaryWrites but before batch.commit ───
const workoutOrder = workoutBlock.indexOf('queueActivitySummaryWrites');
const workoutMilestone = workoutBlock.indexOf('checkAndQueueMilestones');
const workoutCommit = workoutBlock.indexOf('batch.commit');
assert.ok(workoutOrder < workoutMilestone && workoutMilestone < workoutCommit,
  'In summarizeWorkoutCreated: queueActivitySummaryWrites → checkAndQueueMilestones → batch.commit');

const wellnessOrder = wellnessBlock.indexOf('queueActivitySummaryWrites');
const wellnessMilestone = wellnessBlock.indexOf('checkAndQueueMilestones');
const wellnessCommit = wellnessBlock.indexOf('batch.commit');
assert.ok(wellnessOrder < wellnessMilestone && wellnessMilestone < wellnessCommit,
  'In summarizeWellnessLogCreated: queueActivitySummaryWrites → checkAndQueueMilestones → batch.commit');

// ── CF: no hardcoded fake milestone data ──────────────────────────────────
assert.doesNotMatch(cf, /teamTotal.*fake|fake.*milestone|hardcoded.*progress/i, 'CF must not contain hardcoded fake milestone data');

// ── FeedCard: MilestoneBadge exists ───────────────────────────────────────
assert.match(feedCard, /MilestoneBadge/, 'FeedCard must define MilestoneBadge component');

// ── FeedCard: branches on feedItemType for milestone rendering ────────────
assert.match(feedCard, /feedItemType.*milestone|milestone.*feedItemType/, 'FeedCard must branch on feedItemType === milestone');

// ── FeedCard: reactions still wired on milestone cards ───────────────────
assert.match(feedCard, /REACTION_CONFIG/, 'FeedCard must still render REACTION_CONFIG (reactions work on milestone cards)');
assert.match(feedCard, /onSetReaction|onClearReaction/, 'FeedCard must still wire reactions');

// ── FeedCard: comments still wired on milestone cards ────────────────────
assert.match(feedCard, /FeedCommentSection/, 'FeedCard must still render FeedCommentSection (comments work on milestone cards)');

// ── FeedCard: Trophy or Star icon imported ────────────────────────────────
assert.match(feedCard, /Trophy|Star/, 'FeedCard must import Trophy or Star icon for milestone badge');

// ── GroupFeedScreen: achievements filter ─────────────────────────────────
assert.match(feedScreen, /achievements/, "GroupFeedScreen must include 'achievements' in FeedFilter");

const filterChipsBlock = feedScreen.match(/FILTER_CHIPS[^=]*=\s*\[([\s\S]*?)\];/)?.[0] ?? '';
assert.match(filterChipsBlock, /achievements/, "FILTER_CHIPS must include achievements chip");

// ── GroupFeedScreen: achievements filter uses feedItemType ────────────────
assert.match(feedScreen, /feedItemType.*milestone|milestone.*feedItemType/, "achievements filter must branch on feedItemType");

// ── Old activity_log docs not broken ─────────────────────────────────────
// applyFilter must still handle all|workout|wellness|collective|competitive|streak
assert.match(feedScreen, /filter.*workout.*wellness|source.*filter/, 'workout/wellness filters must remain intact');
assert.match(feedScreen, /challengeType.*filter|filter.*challengeType/, 'collective/competitive/streak filters must remain intact');

console.log('✅ All milestone/achievement feed guards passed.');
