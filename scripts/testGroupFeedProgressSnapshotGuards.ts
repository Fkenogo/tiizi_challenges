/**
 * Phase 19A-8C / 8D — Feed Progress Snapshot guards.
 * Run: npx tsx scripts/testGroupFeedProgressSnapshotGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const cf       = read('functions/src/memberActivitySummaries.ts');
const feedCard = read('src/features/Groups/FeedCard.tsx');
const types    = read('src/types/index.ts');

// ── FeedProgressSnapshot type exists ─────────────────────────────────────────
assert.match(types, /FeedProgressSnapshot/, 'src/types/index.ts must export FeedProgressSnapshot');
assert.match(types, /teamCumulativeValue\?/, 'FeedProgressSnapshot must have teamCumulativeValue');
assert.match(types, /userCumulativeValue\?/, 'FeedProgressSnapshot must have userCumulativeValue');
assert.match(types, /remainingValue\?/, 'FeedProgressSnapshot must have remainingValue');
assert.match(types, /percentComplete\?/, 'FeedProgressSnapshot must have percentComplete');
assert.match(types, /leaderName\?/, 'FeedProgressSnapshot must have leaderName');
assert.match(types, /leaderDelta\?/, 'FeedProgressSnapshot must have leaderDelta');
assert.match(types, /leadingBy\?/, 'FeedProgressSnapshot must have leadingBy');
assert.match(types, /isLeading\?/, 'FeedProgressSnapshot must have isLeading');
assert.match(types, /streakDay\?/, 'FeedProgressSnapshot must have streakDay');
assert.match(types, /dailyTarget\?/, 'FeedProgressSnapshot must have dailyTarget');
assert.match(types, /label:\s*string/, 'FeedProgressSnapshot must have label: string (required)');

// ── GroupActivityFeedSummary includes feedProgressSnapshot ────────────────────
assert.match(types, /feedProgressSnapshot\?\s*:\s*FeedProgressSnapshot/, 'GroupActivityFeedSummary must have feedProgressSnapshot?: FeedProgressSnapshot');

// ── CF writes feedProgressSnapshot to groupActivityFeed doc ──────────────────
assert.match(cf, /feedProgressSnapshot/, 'CF must write feedProgressSnapshot field to groupActivityFeed doc');
assert.match(cf, /if \(feedProgressSnapshot\)[\s\S]{0,50}feedDoc\.feedProgressSnapshot/, 'CF must conditionally set feedProgressSnapshot on feedDoc');

// ── CF defines buildFeedProgressSnapshot function ─────────────────────────────
assert.match(cf, /buildFeedProgressSnapshot/, 'CF must define buildFeedProgressSnapshot function');
assert.match(cf, /snapshotResult.*await buildFeedProgressSnapshot|await buildFeedProgressSnapshot/, 'CF must await buildFeedProgressSnapshot before creating batch');

// ── Collective snapshot reads challengeActivitySummaries ──────────────────────
assert.match(cf, /challengeActivitySummaries/, 'CF must read challengeActivitySummaries for collective snapshot');
assert.match(cf, /prevTotal.*totalValue|totalValue.*prevTotal/, 'CF must read totalValue from challengeActivitySummaries for prevTotal');
assert.match(cf, /newTotal.*prevTotal.*input\.value|prevTotal.*newTotal.*input\.value/, 'CF must compute newTotal = prevTotal + input.value');
assert.match(cf, /teamCumulativeValue.*newTotal|newTotal.*teamCumulativeValue/, 'CF must set teamCumulativeValue to newTotal in collective snapshot');
assert.match(cf, /remainingValue/, 'CF must compute remainingValue for collective snapshot');
assert.match(cf, /percentComplete/, 'CF must compute percentComplete for collective snapshot');

// ── Competitive snapshot reads challengeMembers (post-log) ────────────────────
assert.match(cf, /challengeLeaderboards[\s\S]{0,200}limit\(2\)|limit\(2\)/, 'CF must query leaderboard with limit(2) for competitive leader');
// Post-log cumulative is read from challengeMembers, not recomputed from leaderboard
assert.match(cf, /challengeMembers[\s\S]{0,100}cumulativeLoggedValue|cumulativeLoggedValue[\s\S]{0,100}challengeMembers/, 'CF competitive branch must read cumulativeLoggedValue from challengeMembers (post-log)');
assert.match(cf, /newCumulative/, 'CF must compute newCumulative for competitive snapshot');
assert.match(cf, /isLeading/, 'CF must compute isLeading for competitive snapshot');
assert.match(cf, /leaderDelta/, 'CF must compute leaderDelta for competitive snapshot');
assert.match(cf, /leadingBy/, 'CF must compute leadingBy for competitive snapshot');

// ── challengeLeaderboards does NOT track cumulativeLoggedValue (10B) ─────────
// Removed in phase 10B to prevent double-counting. challengeLeaderboards is ranking-only.
assert.doesNotMatch(cf, /challengeLeaderboardPayload[\s\S]{0,300}cumulativeLoggedValue/, 'CF challengeLeaderboardPayload must NOT write cumulativeLoggedValue (10B removed it)');

// ── CF does NOT write cumulativeLoggedValue to challengeMembers (client owns it) ─
// The challengeMembers write was removed in 8D to prevent double-counting.
assert.doesNotMatch(cf, /challengeMembers[\s\S]{0,200}cumulativeLoggedValue.*FieldValue\.increment[\s\S]{0,50}batch\.set/, 'CF must NOT increment cumulativeLoggedValue on challengeMembers (client engine owns it)');

// ── Streak snapshot reads currentStreak directly from challengeMembers ────────
assert.match(cf, /streak[\s\S]{0,200}challengeMembers[\s\S]{0,200}currentStreak|currentStreak[\s\S]{0,50}memberData/, 'CF streak branch must read currentStreak from challengeMembers (post-log)');
assert.match(cf, /streakDay/, 'CF must set streakDay in streak snapshot');
assert.match(cf, /lastLogDate/, 'CF must reference lastLogDate');
// No memberUpdate returned: streak recomputation was removed in 8D
assert.doesNotMatch(cf, /memberUpdate.*currentStreak|currentStreak.*memberUpdate/, 'CF must not use memberUpdate for streak (removed in 8D — reads post-log value directly)');

// ── FeedCard prefers feedProgressSnapshot ────────────────────────────────────
assert.match(feedCard, /SnapshotProgress/, 'FeedCard must define SnapshotProgress component');
assert.match(feedCard, /item\.feedProgressSnapshot[\s\S]{0,30}SnapshotProgress|feedProgressSnapshot.*snap/, 'FeedCard must render SnapshotProgress when feedProgressSnapshot is present');
assert.match(feedCard, /feedProgressSnapshot\s*\?[\s\S]{0,100}SnapshotProgress/, 'FeedCard must gate SnapshotProgress on feedProgressSnapshot presence');

// ── Days remaining: no duplicate when snapshot present ───────────────────────
assert.match(feedCard, /!item\.feedProgressSnapshot/, 'FeedCard bottom days block must be gated on !feedProgressSnapshot to avoid duplicates');

// ── SnapshotProgress: competitive shows progress line + leader context ────────
assert.match(feedCard, /snap\.userCumulativeValue/, 'SnapshotProgress must render userCumulativeValue for competitive');
assert.match(feedCard, /snap\.isLeading/, 'SnapshotProgress must use isLeading for competitive style');

// ── Live stats fallback still present for old docs ───────────────────────────
assert.match(feedCard, /CollectiveStats/, 'FeedCard must retain CollectiveStats fallback for old feed docs');
assert.match(feedCard, /CompetitiveStats/, 'FeedCard must retain CompetitiveStats fallback for old feed docs');
assert.match(feedCard, /StreakStats/, 'FeedCard must retain StreakStats fallback for old feed docs');

// ── Milestone cards unaffected ────────────────────────────────────────────────
assert.match(feedCard, /feedItemType.*!==.*milestone.*story|milestone.*story/, 'FeedCard must not render StoryBlock on milestone cards');
assert.match(feedCard, /MilestoneBadge/, 'FeedCard must still render MilestoneBadge for milestone feed items');
assert.doesNotMatch(feedCard, /feedProgressSnapshot[\s\S]{0,50}milestone/, 'SnapshotProgress must not appear in milestone card branch');

// ── Story block unaffected ────────────────────────────────────────────────────
assert.match(feedCard, /StoryBlock/, 'FeedCard must still render StoryBlock for activity stories');

// ── SnapshotProgress renders collective detail ────────────────────────────────
assert.match(feedCard, /snap\.percentComplete/, 'SnapshotProgress must render percentComplete progress bar');
assert.match(feedCard, /snap\.remainingValue/, 'SnapshotProgress must render remainingValue');

// ── SnapshotProgress renders streak daily target ──────────────────────────────
assert.match(feedCard, /snap\.dailyTarget/, 'SnapshotProgress must render dailyTarget for streak');

// ── SnapshotProgress renders days left ───────────────────────────────────────
assert.match(feedCard, /snap\.daysRemaining/, 'SnapshotProgress must render daysRemaining');

console.log('✅ All feed progress snapshot guards passed.');
