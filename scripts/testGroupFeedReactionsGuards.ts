/**
 * Phase 19A-4 — Feed Social Reactions guards.
 * Run: npx tsx scripts/testGroupFeedReactionsGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

// ── Files exist ────────────────────────────────────────────────────────────
assert.ok(existsSync(resolve(root, 'src/services/feedReactionService.ts')), 'feedReactionService.ts must exist');
assert.ok(existsSync(resolve(root, 'src/hooks/useFeedReactions.ts')), 'useFeedReactions.ts must exist');

const service = read('src/services/feedReactionService.ts');
const hook = read('src/hooks/useFeedReactions.ts');
const feedCard = read('src/features/Groups/FeedCard.tsx');
const feedScreen = read('src/features/Groups/GroupFeedScreen.tsx');
const firestoreRules = read('firestore.rules');

// ── Reaction types: like, applaud, inspired ────────────────────────────────
assert.match(service, /['"]like['"]/, "feedReactionService must define 'like' reaction type");
assert.match(service, /['"]applaud['"]/, "feedReactionService must define 'applaud' reaction type");
assert.match(service, /['"]inspired['"]/, "feedReactionService must define 'inspired' reaction type");

// ── One reaction per user: reactions subcollection keyed by userId ─────────
assert.match(service, /reactions.*userId|userId.*reactions/i, 'feedReactionService must key reaction docs by userId (one reaction per user per item)');

// ── Service reads from expected subcollection path ─────────────────────────
assert.match(service, /groupActivityFeed.*reactions|reactions.*groupActivityFeed/, 'feedReactionService must use groupActivityFeed/{id}/reactions subcollection');

// ── Service has set and clear mutation functions ───────────────────────────
assert.match(service, /setReaction/, 'feedReactionService must have setReaction function');
assert.match(service, /clearReaction/, 'feedReactionService must have clearReaction function');
assert.match(service, /getReactionSummaries|getReactionSummary/, 'feedReactionService must have getReactionSummaries function');

// ── No phantom Firestore write collections ────────────────────────────────
assert.doesNotMatch(service, /feedLikes|feedApplauds|feedComments|feedReplies/, 'feedReactionService must not use flat legacy collections');

// ── Hook uses React Query with mutation + invalidation ────────────────────
assert.match(hook, /useQuery/, 'useFeedReactions must use useQuery');
assert.match(hook, /useMutation/, 'useFeedReactions must use useMutation');
assert.match(hook, /invalidateQueries/, 'useFeedReactions must invalidate query on mutation success');

// ── FeedCard accepts reactionSummary + handlers ───────────────────────────
assert.match(feedCard, /reactionSummary/, 'FeedCard must accept reactionSummary prop');
assert.match(feedCard, /onSetReaction/, 'FeedCard must accept onSetReaction handler');
assert.match(feedCard, /onClearReaction/, 'FeedCard must accept onClearReaction handler');

// ── FeedCard renders all three reaction types ──────────────────────────────
assert.match(feedCard, /['"]like['"]/, "FeedCard must render 'like' reaction button");
assert.match(feedCard, /['"]applaud['"]/, "FeedCard must render 'applaud' reaction button");
assert.match(feedCard, /['"]inspired['"]/, "FeedCard must render 'inspired' reaction button");

// ── FeedCard highlights active reaction (aria-pressed or active class) ─────
assert.match(feedCard, /aria-pressed|active.*text-primary|text-primary.*active/i, 'FeedCard must visually highlight the current user reaction');

// ── Membership gate: canEngage gates reaction buttons ─────────────────────
assert.match(feedCard, /disabled.*!canEngage|!canEngage.*disabled/, 'FeedCard reaction buttons must be disabled when canEngage is false');

// ── Share via navigator.share / clipboard fallback ────────────────────────
assert.match(feedCard, /navigator.*share|navigator\.share/, 'FeedCard must use navigator.share');
assert.match(feedCard, /clipboard/, 'FeedCard must fall back to clipboard when navigator.share is unavailable');

// ── GroupFeedScreen wires reactions ───────────────────────────────────────
assert.match(feedScreen, /useFeedReactions/, 'GroupFeedScreen must call useFeedReactions');
assert.match(feedScreen, /onSetReaction/, 'GroupFeedScreen must pass onSetReaction to FeedCard');
assert.match(feedScreen, /onClearReaction/, 'GroupFeedScreen must pass onClearReaction to FeedCard');

// ── Firestore rules: reactions subcollection added ─────────────────────────
assert.match(firestoreRules, /reactions\/{reactionUserId}|reactions.*reactionUserId/, 'firestore.rules must match reactions subcollection keyed by reactionUserId');
assert.match(firestoreRules, /request\.auth\.uid == reactionUserId/, 'firestore.rules must enforce userId ownership on reactions');
assert.match(firestoreRules, /isGroupMember.*groupId|groupId.*isGroupMember/i, 'firestore.rules must require group membership to create/update reactions');

// ── No comments/replies collection added ──────────────────────────────────
assert.doesNotMatch(firestoreRules, /feedReplies|feedComments/, 'firestore.rules must not add comments/replies collection (Phase 19A-5)');
assert.doesNotMatch(service, /feedReplies|feedComments/, 'feedReactionService must not add comments/replies (Phase 19A-5)');

console.log('✅ All feed reactions guards passed.');
