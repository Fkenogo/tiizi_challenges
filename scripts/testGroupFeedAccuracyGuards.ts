/**
 * Phase 19A-8D — Feed Accuracy + Activity Logging Alignment guards.
 * Run: npx tsx scripts/testGroupFeedAccuracyGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const cf        = read('functions/src/memberActivitySummaries.ts');
const feedCard  = read('src/features/Groups/FeedCard.tsx');
const types     = read('src/types/index.ts');

// ── Competitive: uses post-log cumulativeLoggedValue from challengeMembers ────
assert.match(cf, /challengeMembers[\s\S]{0,200}cumulativeLoggedValue/, 'CF competitive branch must read cumulativeLoggedValue from challengeMembers (post-log — not recalculate from log value)');
assert.match(cf, /newCumulative/, 'CF competitive branch must define newCumulative');
// Must not recompute cumulative by adding input.value to a prev value from leaderboard
assert.doesNotMatch(cf, /prevCumulative\s*\+\s*input\.value/, 'CF must not recompute cumulative as prevCumulative + input.value (client already wrote the correct post-log value)');

// ── Competitive: "0 behind" bug must not occur via score-proxy ────────────────
// The fix is: leaderDelta is only set when leaderValue (cumulativeLoggedValue) is explicitly available.
// We verify the CF does NOT use leaderScore as a proxy for leaderValue.
assert.doesNotMatch(cf, /effectiveLeaderVal.*leaderScore|leaderScore.*effectiveLeaderVal/, 'CF must not use leaderScore as proxy for leaderValue (causes 0-behind bug due to unit mismatch)');
// leaderDelta must only be set when leaderValue is explicitly defined
assert.match(cf, /leaderValue !== undefined[\s\S]{0,100}leaderDelta|leaderDelta[\s\S]{0,200}leaderValue !== undefined/, 'CF must guard leaderDelta behind leaderValue !== undefined check');

// ── Competitive: isLeading / leadingBy only when cumulativeLoggedValue available ─
assert.match(cf, /leadingBy/, 'CF must set leadingBy for competitive leading state');
assert.match(cf, /isLeading.*true|true.*isLeading/, 'CF must set isLeading: true when poster is leading');

// ── Competitive: tied state produces correct label ────────────────────────────
// When leaderDelta === 0, label should say "Tied for the lead" not "0 X behind"
assert.match(cf, /Tied for the lead/, 'CF must produce "Tied for the lead" label when delta === 0');

// ── Competitive: leading label shows "Leading by" or "is leading with" ────────
assert.match(cf, /Leading by|is leading with/, 'CF must produce "Leading by" or "is leading with" label when poster is ahead');

// ── Collective: new user total not double-counted ────────────────────────────
// CF reads prevTotal from challengeActivitySummaries (pre-log) and adds input.value
assert.match(cf, /prevTotal.*\+.*input\.value|input\.value.*prevTotal/, 'CF must compute newTotal = prevTotal + input.value for collective');
// challengeActivitySummaries totalValue is incremented by CF (CF owns it)
assert.match(cf, /totalValue.*FieldValue\.increment|FieldValue\.increment[\s\S]{0,50}totalValue/, 'CF must increment totalValue on challengeActivitySummaries');

// ── Streak: reads currentStreak from challengeMembers (no recompute) ──────────
assert.match(cf, /memberData\.currentStreak/, 'CF streak branch must read currentStreak from memberData (challengeMembers)');
// Must not recompute streak from lastLogDate (streakEngine already did it)
assert.doesNotMatch(cf, /newStreak/, 'CF must not recompute newStreak (streakEngine wrote the correct value before CF trigger)');

// ── CF does NOT write to challengeMembers (client engines own it) ─────────────
// This is the core fix for the double-counting bug.
// The CF must not write cumulativeLoggedValue, currentStreak, or lastLogDate to challengeMembers.
assert.doesNotMatch(cf, /challengeMembers[\s\S]{0,100}batch\.set[\s\S]{0,200}cumulativeLoggedValue.*FieldValue/, 'CF must NOT write cumulativeLoggedValue to challengeMembers via batch.set (client engine owns it)');
assert.doesNotMatch(cf, /batch\.set[\s\S]{0,30}challengeMembers/, 'CF must NOT batch.set on challengeMembers at all (client engines own the document)');

// ── Days remaining: rendered only once per feed card ─────────────────────────
// SnapshotProgress renders snap.daysRemaining; the outer days block is gated on !feedProgressSnapshot
assert.match(feedCard, /snap\.daysRemaining/, 'SnapshotProgress must render snap.daysRemaining inside the snapshot component');
assert.match(feedCard, /!item\.feedProgressSnapshot/, 'FeedCard outer days block must be gated on !feedProgressSnapshot');
// Verify the days block and !feedProgressSnapshot appear together (not separated by entire screen)
assert.match(feedCard, /days !== null[\s\S]{0,50}!item\.feedProgressSnapshot|!item\.feedProgressSnapshot[\s\S]{0,50}days !== null/, 'FeedCard must combine the days !== null and !feedProgressSnapshot guards on the same element');

// ── Competitive snapshot includes userCumulativeValue in FeedCard ─────────────
assert.match(feedCard, /snap\.userCumulativeValue/, 'SnapshotProgress must render snap.userCumulativeValue for competitive progress line');

// ── FeedProgressSnapshot type has leadingBy field ────────────────────────────
assert.match(types, /leadingBy\?/, 'FeedProgressSnapshot must have leadingBy?: number');

console.log('✅ All feed accuracy guards passed.');
