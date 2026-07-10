/**
 * Phase 19A-3 — Feed Live Stats layer guards.
 * Run: npx tsx scripts/testGroupFeedLiveStatsGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

// ── Files exist ────────────────────────────────────────────────────────────
assert.ok(existsSync(resolve(root, 'src/services/feedLiveStatsService.ts')), 'feedLiveStatsService.ts must exist');
assert.ok(existsSync(resolve(root, 'src/hooks/useFeedLiveStats.ts')), 'useFeedLiveStats.ts must exist');

const service = read('src/services/feedLiveStatsService.ts');
const hook = read('src/hooks/useFeedLiveStats.ts');
const feedCard = read('src/features/Groups/FeedCard.tsx');
const feedScreen = read('src/features/Groups/GroupFeedScreen.tsx');
const firestoreRules = read('firestore.rules');
const indexes = read('firestore.indexes.json');

// ── No Firestore writes in service or hook ─────────────────────────────────
assert.doesNotMatch(service, /setDoc|addDoc|updateDoc|writeBatch.*commit/, 'feedLiveStatsService must not write to Firestore');
assert.doesNotMatch(hook, /setDoc|addDoc|updateDoc/, 'useFeedLiveStats must not write to Firestore');

// ── No new social collection rules added ──────────────────────────────────
assert.doesNotMatch(firestoreRules, /feedReplies|feedLikes|feedReactions/, 'firestore.rules must not have new social collection rules in this phase');

// ── Service reads expected collections ────────────────────────────────────
assert.match(service, /challengeActivitySummaries/, 'service must read challengeActivitySummaries for collective');
assert.match(service, /challengeLeaderboards/, 'service must read challengeLeaderboards for competitive');
assert.match(service, /challengeMembers/, 'service must read challengeMembers for streak');

// ── Service returns a Map keyed by feed item id ────────────────────────────
assert.match(service, /Map<string/, 'service must return a Map keyed by string');
assert.match(service, /getStatsMap/, 'service must expose getStatsMap method');

// ── No hardcoded fake values ───────────────────────────────────────────────
assert.doesNotMatch(service, /return 42|return 100|fakeScore|fakeStreak|mockScore/, 'service must not hardcode fake stats');

// ── Hook uses React Query ──────────────────────────────────────────────────
assert.match(hook, /useQuery/, 'useFeedLiveStats must use useQuery');
assert.match(hook, /staleTime/, 'useFeedLiveStats must set staleTime to avoid over-fetching');

// ── FeedCard accepts stats prop ────────────────────────────────────────────
assert.match(feedCard, /stats\?.*FeedLiveStats|FeedLiveStats.*stats\?/, 'FeedCard must accept optional stats prop typed as FeedLiveStats');

// ── Collective stats block guarded by real data ────────────────────────────
assert.match(feedCard, /teamTotal|team.*total/i, 'FeedCard must render collective team total from real data');
assert.match(feedCard, /teamTarget|team.*target/i, 'FeedCard must render collective team target from real data');
assert.match(feedCard, /progress.*bar|width.*pct|width.*%|w-full.*rounded-full/i, 'FeedCard must render a collective progress bar');

// ── Competitive stats block guarded by real data ───────────────────────────
assert.match(feedCard, /posterScore|poster.*score/i, 'FeedCard must render competitive poster score from real data');
assert.match(feedCard, /leaderScore|leader.*score/i, 'FeedCard must render competitive leader score from real data');

// ── Streak stats block guarded by real data ────────────────────────────────
assert.match(feedCard, /currentStreak|current.*streak/i, 'FeedCard must render streak from real data');

// ── Fallback component present (replaced contextLine() in Phase 19A-8B) ──────
assert.match(feedCard, /StatsFallback|Progress updates as the challenge moves/, 'FeedCard must have a fallback for cards with no live stats data');

// ── Null/undefined challengeType safe path present ────────────────────────
assert.match(feedCard, /item\.text/, 'FeedCard must retain item.text fallback for null challengeType');

// ── GroupFeedScreen passes stats to FeedCard ──────────────────────────────
assert.match(feedScreen, /useFeedLiveStats/, 'GroupFeedScreen must call useFeedLiveStats');
assert.match(feedScreen, /statsMap.*get\(item\.id\)|statsMap\?\.get/, 'GroupFeedScreen must look up stats by item.id from statsMap');

// ── Leaderboard index present ─────────────────────────────────────────────
assert.match(indexes, /challengeLeaderboards/, 'firestore.indexes.json must include challengeLeaderboards index');
assert.match(indexes, /"score"/, 'challengeLeaderboards index must have score field');

console.log('✅ All feed live stats guards passed.');
