/**
 * Phase 19A-10K — Regression guards for step/value cap in Group Feed.
 *
 * Root cause: ACTIVITY_SUMMARY_LIMITS.maxActivityValue was 10_000 in the Cloud Function,
 * causing all wellness/workout logs above 10,000 to be silently truncated before writing
 * valueLabel and groupActivityFeed.value, and before incrementing challengeActivitySummaries.totalValue.
 *
 * These guards assert:
 *   1. maxActivityValue is raised above 10,000 (cap removed for display/aggregation)
 *   2. maxActivityScore remains at 1,000 (scoring cap is separate and intentional)
 *   3. Both summarizeWellnessLogCreated and summarizeWorkoutCreated use ACTIVITY_SUMMARY_LIMITS.maxActivityValue
 *      (not a hardcoded 10000) when clamping the value field
 *   4. valueLabel is built from input.value (the uncapped value) not from a separate capped field
 *   5. The value increment to challengeActivitySummaries uses input.value (same path as valueLabel)
 *
 * Run: npx tsx scripts/testGroupFeedStepCapGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const cf = read('functions/src/memberActivitySummaries.ts');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: maxActivityValue must be > 10,000 so step logs above 10k are preserved
// ─────────────────────────────────────────────────────────────────────────────
const capMatch = cf.match(/maxActivityValue:\s*(\d[\d_]*)/);
assert.ok(capMatch, '10K: ACTIVITY_SUMMARY_LIMITS must define maxActivityValue');
const capValue = Number(capMatch![1].replace(/_/g, ''));
assert.ok(
  capValue > 10_000,
  `10K: maxActivityValue must be > 10,000 so logs of 16,700+ steps are not capped — got ${capValue}`,
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: maxActivityScore must remain at 1,000 (scoring cap is intentional)
// ─────────────────────────────────────────────────────────────────────────────
const scoreMatch = cf.match(/maxActivityScore:\s*(\d[\d_]*)/);
assert.ok(scoreMatch, '10K: ACTIVITY_SUMMARY_LIMITS must define maxActivityScore');
const scoreValue = Number(scoreMatch![1].replace(/_/g, ''));
assert.strictEqual(scoreValue, 1000, '10K: maxActivityScore must remain 1,000 — scoring cap is separate from value cap');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: clampNumber calls for value use ACTIVITY_SUMMARY_LIMITS.maxActivityValue (not literal 10000)
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  cf,
  /clampNumber\([\s\S]{0,60},\s*0,\s*10000\s*\)/,
  '10K: value clamp must not use hardcoded 10000 — use ACTIVITY_SUMMARY_LIMITS.maxActivityValue',
);
assert.match(
  cf,
  /clampNumber\([\s\S]{0,60},\s*0,\s*ACTIVITY_SUMMARY_LIMITS\.maxActivityValue\)/,
  '10K: value clamp must reference ACTIVITY_SUMMARY_LIMITS.maxActivityValue',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: valueLabel is formatted from input.value (not a separately capped variable)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  cf,
  /const valueLabel = formatValue\(input\.value,/,
  '10K: valueLabel must be formatted from input.value (the value that reached queueActivitySummaryWrites)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: challengeActivitySummaries.totalValue increment uses input.value (same path)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  cf,
  /totalValue:\s*FieldValue\.increment\(Math\.max\(0,\s*input\.value\)\)/,
  '10K: challengeActivitySummaries.totalValue must increment by input.value (uncapped display value)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: both summarize functions extract value via clampNumber with maxActivityValue
// ─────────────────────────────────────────────────────────────────────────────
const clampValueMatches = [...cf.matchAll(/clampNumber\(numberValue\(data,\s*'value'\)[^)]*,\s*0,\s*ACTIVITY_SUMMARY_LIMITS\.maxActivityValue\)/g)];
assert.ok(
  clampValueMatches.length >= 2,
  `10K: both summarizeWorkoutCreated and summarizeWellnessLogCreated must clamp value via ACTIVITY_SUMMARY_LIMITS.maxActivityValue — found ${clampValueMatches.length} occurrence(s)`,
);

console.log('✅ All Phase 19A-10K Group Feed step value cap guards passed.');
