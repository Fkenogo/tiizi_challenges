/**
 * Phase 19A-7B — Personal Activity Stories guards.
 * Run: npx tsx scripts/testGroupFeedStoriesGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const types        = read('src/types/index.ts');
const cf           = read('functions/src/memberActivitySummaries.ts');
const feedCard     = read('src/features/Groups/FeedCard.tsx');
const logWorkout   = read('src/features/Workouts/LogWorkoutScreen.tsx');
const logWellness  = read('src/features/Workouts/LogWellnessActivityScreen.tsx');

// ── Types ──────────────────────────────────────────────────────────────────
assert.match(types, /story\?.*string|story\?:\s*string/, 'GroupActivityFeedSummary must have story?: string field');

// ── Cloud Function: story field written to feed doc ───────────────────────
assert.match(cf, /story.*input\.story|input\.story.*story/, 'CF must write story field to feed doc from input.story');
assert.match(cf, /ActivitySummaryInput[\s\S]{0,300}story\?/, 'ActivitySummaryInput must declare story? field');

// ── CF: reads notes from Firestore data ───────────────────────────────────
assert.match(cf, /stringValue\(data,\s*['"]notes['"]\)/, "CF must read 'notes' field from activity data for story");

// ── CF: blank story not written ───────────────────────────────────────────
assert.match(cf, /story.*notes.*trim\(\)|notes.*trim\(\).*story/, 'CF must trim notes before writing story (blank story guard)');

// ── Log screens: field renamed ────────────────────────────────────────────
assert.match(logWorkout, /How are you feeling\?/, 'LogWorkoutScreen must label the field "How are you feeling?"');
assert.match(logWellness, /How are you feeling\?/, 'LogWellnessActivityScreen must label the field "How are you feeling?"');

// ── Log screens: old "Notes" label gone ───────────────────────────────────
// Only check the JSX section title — not comments or variable names
const workoutTitleBlock = logWorkout.match(/st-section-title['"]\s*>[^<]*/g)?.[0] ?? '';
assert.doesNotMatch(workoutTitleBlock, /^Notes$/, 'LogWorkoutScreen section title must not be "Notes"');

// ── Log screens: helper text ──────────────────────────────────────────────
assert.match(logWorkout, /Share your progress.*celebrate.*encourage|encourage.*teammates/, 'LogWorkoutScreen must have helper text about sharing progress');
assert.match(logWellness, /Share your progress.*celebrate.*encourage|encourage.*teammates/, 'LogWellnessActivityScreen must have helper text about sharing progress');

// ── Log screens: max 280 characters ──────────────────────────────────────
assert.match(logWorkout, /maxLength=\{280\}|maxLength="280"/, 'LogWorkoutScreen must set maxLength 280');
assert.match(logWellness, /maxLength=\{280\}|maxLength="280"/, 'LogWellnessActivityScreen must set maxLength 280');

// ── Log screens: char counter shown ──────────────────────────────────────
assert.match(logWorkout, /notes\.length.*280|280.*notes\.length/, 'LogWorkoutScreen must show character counter toward 280');
assert.match(logWellness, /notes\.length.*280|280.*notes\.length/, 'LogWellnessActivityScreen must show character counter toward 280');

// ── FeedCard: StoryBlock exists ───────────────────────────────────────────
assert.match(feedCard, /StoryBlock/, 'FeedCard must define StoryBlock component');

// ── FeedCard: story only rendered when non-empty ──────────────────────────
assert.match(feedCard, /story\?\.trim\(\)|story&&|story\.trim\(\).*&&/, 'FeedCard must guard StoryBlock render on story existence / non-empty');

// ── FeedCard: story not rendered on milestone cards ───────────────────────
assert.match(feedCard, /feedItemType.*!==.*milestone.*story|milestone.*story/, 'FeedCard must not render StoryBlock on milestone cards');

// ── FeedCard: Read more collapse ──────────────────────────────────────────
assert.match(feedCard, /Read more|Show less|expanded/, 'FeedCard StoryBlock must have expand/collapse Read more behaviour');

// ── FeedCard: left accent styling ────────────────────────────────────────
assert.match(feedCard, /border-l-|border-primary|pl-3/, 'StoryBlock must have left border accent styling');

// ── FeedCard: reactions/comments/share unaffected ────────────────────────
assert.match(feedCard, /REACTION_CONFIG/, 'FeedCard must still render reaction buttons');
assert.match(feedCard, /FeedCommentSection/, 'FeedCard must still render FeedCommentSection');
assert.match(feedCard, /Share2/, 'FeedCard must still render Share button');

// ── Milestone cards unaffected ────────────────────────────────────────────
assert.match(feedCard, /MilestoneBadge/, 'FeedCard must still render MilestoneBadge for milestones');

// ── Backwards compatibility: story is optional ────────────────────────────
assert.match(types, /story\?/, 'story must be optional on GroupActivityFeedSummary (backwards compat)');

console.log('✅ All activity stories guards passed.');
