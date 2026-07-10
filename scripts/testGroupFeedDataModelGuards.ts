/**
 * Phase 19A-1 — Group Feed Data Model guards.
 * Run: npx tsx scripts/testGroupFeedDataModelGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const types = read('src/types/index.ts');
const useGroupInsights = read('src/hooks/useGroupInsights.ts');
const memberService = read('src/services/memberActivitySummaryService.ts');
const cfFunction = read('functions/src/memberActivitySummaries.ts');
const indexes = read('firestore.indexes.json');
const feedScreen = read('src/features/Groups/GroupFeedScreen.tsx');

// ── GroupActivityFeedSummary has new fields ────────────────────────────────
assert.match(types, /GroupActivityFeedSummary[\s\S]{0,500}challengeType\?.*'collective'.*'competitive'.*'streak'/, 'GroupActivityFeedSummary must have challengeType as collective|competitive|streak union');
assert.match(types, /GroupActivityFeedSummary[\s\S]{0,500}challengeStartDate\?\s*:\s*string/, 'GroupActivityFeedSummary must have challengeStartDate?: string');
assert.match(types, /GroupActivityFeedSummary[\s\S]{0,500}challengeEndDate\?\s*:\s*string/, 'GroupActivityFeedSummary must have challengeEndDate?: string');
assert.match(types, /GroupActivityFeedSummary[\s\S]{0,500}userPhotoURL\?\s*:\s*string/, 'GroupActivityFeedSummary must have userPhotoURL?: string');
assert.match(types, /GroupActivityFeedSummary[\s\S]{0,500}challengeName\?\s*:\s*string/, 'GroupActivityFeedSummary must have challengeName?: string');

// ── useGroupFeed() uses memberActivitySummaryService, not groupInsightsService ──
assert.match(useGroupInsights, /memberActivitySummaryService/, 'useGroupInsights must import memberActivitySummaryService');
assert.match(useGroupInsights, /memberActivitySummaryService\.getGroupFeed/, 'useGroupFeed() must call memberActivitySummaryService.getGroupFeed()');
assert.doesNotMatch(useGroupInsights, /groupInsightsService\.getGroupFeed/, 'useGroupFeed() must NOT call groupInsightsService.getGroupFeed()');

// ── memberActivitySummaryService reads groupActivityFeed collection ─────────
assert.match(memberService, /groupActivityFeed/, 'memberActivitySummaryService must reference groupActivityFeed collection');
assert.match(memberService, /getGroupFeed/, 'memberActivitySummaryService must have getGroupFeed method');

// ── Cloud Function writes new fields to groupActivityFeed ──────────────────
assert.match(cfFunction, /challengeType/, 'Cloud Function must write challengeType to groupActivityFeed');
assert.match(cfFunction, /challengeStartDate/, 'Cloud Function must write challengeStartDate to groupActivityFeed');
assert.match(cfFunction, /challengeEndDate/, 'Cloud Function must write challengeEndDate to groupActivityFeed');
assert.match(cfFunction, /userPhotoURL/, 'Cloud Function must write userPhotoURL to groupActivityFeed');
assert.match(cfFunction, /challenge\?\.challengeType|challenge\.challengeType/, 'Cloud Function must read challengeType from challenge doc');
assert.match(cfFunction, /challenge\?\.startDate|challenge\.startDate/, 'Cloud Function must read startDate from challenge doc');
assert.match(cfFunction, /challenge\?\.endDate|challenge\.endDate/, 'Cloud Function must read endDate from challenge doc');
assert.match(cfFunction, /user\?\.photoURL|photoURL/, 'Cloud Function must read photoURL from user doc');

// ── Firestore indexes include groupActivityFeed (groupId, createdAt) ────────
assert.match(indexes, /groupActivityFeed[\s\S]{0,200}groupId[\s\S]{0,100}createdAt/, 'firestore.indexes.json must include groupActivityFeed (groupId, createdAt) index');

// ── Firestore indexes include wellnessLogs (groupId, loggedAt) ─────────────
assert.match(indexes, /wellnessLogs[\s\S]{0,200}groupId[\s\S]{0,100}loggedAt/, 'firestore.indexes.json must include wellnessLogs (groupId, loggedAt) index');

// ── GroupFeedScreen.tsx is NOT modified in this phase ─────────────────────
// (Verify it still uses the same hook name, not a new import path)
assert.match(feedScreen, /useGroupFeed/, 'GroupFeedScreen must still call useGroupFeed (hook interface unchanged)');
assert.doesNotMatch(feedScreen, /memberActivitySummaryService/, 'GroupFeedScreen must not directly import memberActivitySummaryService in this phase');

console.log('✅ All group feed data model guards passed.');
