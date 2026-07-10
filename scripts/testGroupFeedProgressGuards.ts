/**
 * Phase 19A-8B — Feed Progress Alignment guards.
 * Run: npx tsx scripts/testGroupFeedProgressGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const feedCard    = read('src/features/Groups/FeedCard.tsx');
const statsService = read('src/services/feedLiveStatsService.ts');
const feedScreen  = read('src/features/Groups/GroupFeedScreen.tsx');

// ── FeedLiveStats type additions ─────────────────────────────────────────
assert.match(statsService, /unit\?.*string/, 'FeedLiveStats must have unit?: string');
assert.match(statsService, /posterCumulativeValue\?/, 'FeedLiveStats must have posterCumulativeValue?');
assert.match(statsService, /perPersonTarget\?/, 'FeedLiveStats must have perPersonTarget?');
assert.match(statsService, /streakDailyTarget\?/, 'FeedLiveStats must have streakDailyTarget?');

// ── Collective renders progress / target / remaining ─────────────────────
assert.match(feedCard, /CollectiveStats/, 'FeedCard must define CollectiveStats component');
// "Progress:" text label exists and teamTotal is read in CollectiveStats
assert.match(feedCard, /Progress:/, 'CollectiveStats must render "Progress:" label');
assert.match(feedCard, /stats\?\.teamTotal|teamTotal/, 'CollectiveStats must read teamTotal from stats');
assert.match(feedCard, /remaining/, 'CollectiveStats must show remaining progress');

// ── Collective reads unit from challenge ──────────────────────────────────
assert.match(statsService, /firstActivityUnit|activities.*unit|unit.*activities/, 'fetchCollective must read unit from challenge activities');

// ── Competitive renders progress / target / leader ────────────────────────
assert.match(feedCard, /CompetitiveStats/, 'FeedCard must define CompetitiveStats component');
assert.match(feedCard, /posterCumulativeValue|progressValue/, 'CompetitiveStats must use posterCumulativeValue or progressValue for progress display');
assert.match(feedCard, /perPersonTarget/, 'CompetitiveStats must use perPersonTarget for the denominator');
assert.match(feedCard, /Leading!|leaderName/, 'CompetitiveStats must show leader comparison');

// ── Competitive reads cumulative value and target from service ────────────
// Both must appear in the service (multiline — use two separate checks)
assert.match(statsService, /challengeMembers/, 'feedLiveStatsService must read from challengeMembers collection');
assert.match(statsService, /cumulativeLoggedValue/, 'feedLiveStatsService must read cumulativeLoggedValue from challengeMembers');
assert.match(statsService, /firstActivityTarget|activities.*targetValue|perPersonTarget/, 'fetchCompetitive must read perPersonTarget from challenge activities');

// ── Streak renders streak day and daily target ────────────────────────────
assert.match(feedCard, /StreakStats/, 'FeedCard must define StreakStats component');
assert.match(feedCard, /Day.*currentStreak|currentStreak.*streak/, 'StreakStats must render "Day X streak"');
assert.match(feedCard, /streakDailyTarget.*Daily target|Daily target.*streakDailyTarget/, 'StreakStats must render daily target when available');

// ── Fallback renders safely when stats are missing ───────────────────────
assert.match(feedCard, /StatsFallback|Progress updates as the challenge moves/, 'FeedCard must have fallback for when live stats are absent');
assert.match(feedCard, /total === undefined|StatsFallback/, 'CollectiveStats must show StatsFallback when teamTotal is absent');

// ── Empty-object truthy bug fixed — no `stats ?` gate on stats components ─
// The render block must NOT have `stats ? <CollectiveStats` pattern (old bug)
assert.doesNotMatch(feedCard, /stats\s*\?\s*<CollectiveStats/, 'FeedCard must not gate CollectiveStats behind stats truthiness (empty {} bug)');
assert.doesNotMatch(feedCard, /stats\s*\?\s*<CompetitiveStats/, 'FeedCard must not gate CompetitiveStats behind stats truthiness');
assert.doesNotMatch(feedCard, /stats\s*\?\s*<StreakStats/, 'FeedCard must not gate StreakStats behind stats truthiness');

// ── No large challenge cover image reintroduced ───────────────────────────
assert.doesNotMatch(feedCard, /challengeCoverImageUrl.*img|img.*challengeCoverImageUrl/, 'FeedCard must not render large challenge cover image');

// ── Story block still present ─────────────────────────────────────────────
assert.match(feedCard, /StoryBlock/, 'FeedCard must still render StoryBlock for activity stories');
assert.match(feedCard, /story\?\.trim\(\)|story&&/, 'FeedCard must still guard StoryBlock on story existence');

// ── Reactions and comments still present ─────────────────────────────────
assert.match(feedCard, /REACTION_CONFIG/, 'FeedCard must still render reaction buttons');
assert.match(feedCard, /FeedCommentSection/, 'FeedCard must still render FeedCommentSection');

// ── GroupFeedScreen still uses precomputed feed path ─────────────────────
assert.match(feedScreen, /useGroupFeed|useGroupInsights|groupActivityFeed/, 'GroupFeedScreen must still use precomputed feed path');
assert.doesNotMatch(feedScreen, /collection\(db.*workouts\)|getDocs.*wellnessLogs/, 'GroupFeedScreen must not query raw collections');

console.log('✅ All feed progress alignment guards passed.');
