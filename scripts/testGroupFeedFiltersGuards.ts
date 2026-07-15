/**
 * Phase 19A-6 — Feed Filters + Empty States guards.
 * Run: npx tsx scripts/testGroupFeedFiltersGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const screen = read('src/features/Groups/GroupFeedScreen.tsx');
const firestoreRules = read('firestore.rules');

// ── Filter chips exist ─────────────────────────────────────────────────────
assert.match(screen, /FILTER_CHIPS|filter.*chips|filterChips/i, 'GroupFeedScreen must define filter chips');
assert.match(screen, /['"]all['"]/, "Filter chips must include 'all' filter");
assert.match(screen, /['"]collective['"]/, "Filter chips must include 'collective' filter");
assert.match(screen, /['"]competitive['"]/, "Filter chips must include 'competitive' filter");
assert.match(screen, /['"]streak['"]/, "Filter chips must include 'streak' filter");
assert.match(screen, /['"]workout['"]/, "Filter chips must include 'workout' filter");
assert.match(screen, /['"]wellness['"]/, "Filter chips must include 'wellness' filter");

// ── Filter state management ────────────────────────────────────────────────
assert.match(screen, /activeFilter|setActiveFilter/, 'GroupFeedScreen must have activeFilter state');
assert.match(screen, /useState.*FeedFilter|FeedFilter.*useState/, 'activeFilter must be typed as FeedFilter');

// ── Filter logic uses correct feed item fields ─────────────────────────────
assert.match(screen, /challengeType.*filter|filter.*challengeType/, 'filter logic must branch on challengeType');
assert.match(screen, /source.*filter|filter.*source|i\.source|item\.source/, 'filter logic must use source field for workout/wellness');

// ── applyFilter function ───────────────────────────────────────────────────
assert.match(screen, /applyFilter|filteredItems/, 'GroupFeedScreen must compute filteredItems');

// ── Filter chips render with role and aria ─────────────────────────────────
assert.match(screen, /role.*tab|tablist/, 'filter chips must have appropriate ARIA roles');
assert.match(screen, /aria-selected/, 'active filter chip must set aria-selected');

// ── Active chip visual distinction ────────────────────────────────────────
assert.match(screen, /bg-primary.*text-white|text-white.*bg-primary/, 'active filter chip must have primary background');

// ── Clear Filter action exists for filtered-empty state ───────────────────
assert.match(screen, /Clear Filter|clearFilter|setActiveFilter.*all/, "empty filter state must have a 'Clear Filter' action");

// ── Full-empty state differs from filtered-empty state ────────────────────
assert.match(screen, /feedItems\.length === 0.*activeFilter.*all|Nothing posted yet/, 'full-empty state must be distinct and only shown when all-filter is active');
assert.match(screen, /filteredItems\.length === 0|No.*match.*filter|No results/, 'filtered-empty state must be shown when filter yields no results');

// ── Full-empty state has useful CTAs ──────────────────────────────────────
assert.match(screen, /Browse Challenges|Log Activity/, 'full-empty state must have useful CTAs');

// ── Deferred filters not in FILTER_CHIPS array ────────────────────────────
// Check FILTER_CHIPS block only (not comments). Extract array literal and verify.
const filterChipsBlock = screen.match(/FILTER_CHIPS[^=]*=\s*\[([\s\S]*?)\];/)?.[0] ?? '';
assert.doesNotMatch(filterChipsBlock, /cause_support|engagement/, 'unsupported filters (cause_support, engagement) must not appear in FILTER_CHIPS array');

// ── Reactions and comments still wired ────────────────────────────────────
assert.match(screen, /useFeedReactions/, 'GroupFeedScreen must still call useFeedReactions');
assert.match(screen, /onSetReaction/, 'GroupFeedScreen must still pass onSetReaction to FeedCard');
assert.match(screen, /onClearReaction/, 'GroupFeedScreen must still pass onClearReaction to FeedCard');
assert.match(screen, /FeedCard/, 'GroupFeedScreen must still render FeedCard');

// ── Firestore rules not changed (no new match blocks) ─────────────────────
assert.doesNotMatch(firestoreRules, /feedFilters|feedFilter/, 'firestore.rules must not have any feed filter rules (client-side only)');

console.log('✅ All feed filter guards passed.');
