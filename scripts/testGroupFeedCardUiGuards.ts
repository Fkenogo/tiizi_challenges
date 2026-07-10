/**
 * Phase 19A-2 — Group Feed Card UI guards.
 * Run: npx tsx scripts/testGroupFeedCardUiGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

// ── FeedCard.tsx exists ───────────────────────────────────────────────────
assert.ok(existsSync(resolve(root, 'src/features/Groups/FeedCard.tsx')), 'FeedCard.tsx must exist at src/features/Groups/FeedCard.tsx');

const feedCard = read('src/features/Groups/FeedCard.tsx');
const feedScreen = read('src/features/Groups/GroupFeedScreen.tsx');
const firestoreRules = read('firestore.rules');

// ── GroupFeedScreen imports and uses FeedCard ──────────────────────────────
assert.match(feedScreen, /import.*FeedCard.*from.*FeedCard/, 'GroupFeedScreen must import FeedCard from FeedCard');
assert.match(feedScreen, /<FeedCard/, 'GroupFeedScreen must render <FeedCard>');

// ── No large full-width challenge cover image in card rendering ───────────
// The old code had: h-[220px] w-full rounded-xl object-cover on item.imageUrl
assert.doesNotMatch(feedCard, /h-\[220px\].*w-full|w-full.*h-\[220px\]/, 'FeedCard must not render a large full-width h-[220px] cover image');
assert.doesNotMatch(feedCard, /item\.imageUrl.*h-\[220px\]|h-\[220px\].*item\.imageUrl/s, 'FeedCard must not use item.imageUrl as a dominant full-width image');

// ── Branches on challengeType ──────────────────────────────────────────────
assert.match(feedCard, /challengeType/, 'FeedCard must reference challengeType');
assert.match(feedCard, /collective/, 'FeedCard must handle collective challenge type');
assert.match(feedCard, /competitive/, 'FeedCard must handle competitive challenge type');
assert.match(feedCard, /streak/, 'FeedCard must handle streak challenge type');

// ── Fallback for null/undefined challengeType ──────────────────────────────
assert.match(feedCard, /item\.text|fallback|null|undefined/i, 'FeedCard must have a fallback for null/undefined challengeType');

// ── Uses userPhotoURL for avatar ───────────────────────────────────────────
assert.match(feedCard, /userPhotoURL/, 'FeedCard must use userPhotoURL for avatar');

// ── Includes fallback avatar logic ────────────────────────────────────────
assert.match(feedCard, /initials|slice\(0.*2\)|toUpperCase|fallback/i, 'FeedCard must include initials/fallback avatar logic');

// ── Includes social actions (Phase 19A-4: like/applaud/inspired replace placeholder Reply) ──
assert.match(feedCard, /Applaud|ThumbsUp|applaud/, 'FeedCard must include Applaud social action');
assert.match(feedCard, /Share|Share2/, 'FeedCard must include Share social action');
// Note: Reply is Phase 19A-5 — not required in 19A-2/19A-4 baseline.

// ── No Firestore social writes ────────────────────────────────────────────
assert.doesNotMatch(feedCard, /setDoc|addDoc|updateDoc|collection.*feedReplies|collection.*feedLikes|collection.*reactions/, 'FeedCard must not write to any Firestore social collections');

// ── firestore.rules not modified (spot-check: no feedReplies/feedLikes rule) ─
assert.doesNotMatch(firestoreRules, /feedReplies|feedLikes|feedReactions/, 'firestore.rules must not have social collection rules in this phase');

// ── Days remaining shown when challengeEndDate present ────────────────────
assert.match(feedCard, /challengeEndDate|daysRemaining|days.*left|left/i, 'FeedCard must show days remaining when challengeEndDate is available');

// ── Type badge present ────────────────────────────────────────────────────
assert.match(feedCard, /TypeBadge|type.*badge|badge/i, 'FeedCard must render a challenge type badge');

console.log('✅ All group feed card UI guards passed.');
