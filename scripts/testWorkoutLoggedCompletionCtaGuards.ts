/**
 * Phase 19A-10L (revised) — Guard tests for WorkoutLoggedScreen "View Completion" CTA.
 *
 * Root cause: showCompletion was gated by resolved.isUserCompleted — which is false
 * until the challenge is 100% done. So the secondary CTA never appeared during
 * in-progress challenge logs.
 *
 * Fix: showCompletion = !!challengeId
 *   - Renders when a challengeId exists (any log into a challenge)
 *   - Hidden when no challengeId (standalone workout outside a challenge)
 *   - Never gated by completion percentage or resolver state
 *   - The destination (/app/challenges/completed?challengeId=...) is a progress
 *     recap screen; it is valid and useful at any progress level.
 *
 * Run: npx tsx scripts/testWorkoutLoggedCompletionCtaGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const screen = read('src/features/Workouts/WorkoutLoggedScreen.tsx');

// ─────────────────────────────────────────────────────────────────────────────
// RULE: showCompletion is driven only by challengeId presence
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /showCompletion\s*=\s*!!challengeId/,
  '10L-2: showCompletion must equal !!challengeId — always show CTA when a challengeId exists',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Must NOT be gated by resolved.isUserCompleted
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  screen,
  /showCompletion[\s\S]{0,60}resolved\.isUserCompleted/,
  '10L-2: showCompletion must NOT gate on resolved.isUserCompleted — CTA must appear before 100% completion',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Must NOT use >= 80 threshold
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  screen,
  /showCompletion[\s\S]{0,100}>=\s*80/,
  '10L-2: showCompletion must NOT use a percentage threshold',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Must NOT gate on overallCompetitivePct
// ─────────────────────────────────────────────────────────────────────────────
assert.doesNotMatch(
  screen,
  /showCompletion[\s\S]{0,100}overallCompetitivePct/,
  '10L-2: showCompletion must NOT reference overallCompetitivePct',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: "View Completion" button is gated on showCompletion
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /showCompletion[\s\S]{0,300}View Completion/,
  '10L-2: "View Completion" button must be gated by showCompletion',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Navigation URL includes challengeId
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /toCompletionPath[\s\S]{0,30}challengeId/,
  '10L-2: View Completion navigation URL must include challengeId',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Navigation URL preserves groupId when present
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /toCompletionPath[\s\S]{0,100}groupId/,
  '10L-2: View Completion navigation URL must include groupId when present',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: canonical resolver is still used for progress display
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /resolveChallengeProgress/,
  '10L-2: WorkoutLoggedScreen must still use resolveChallengeProgress for progress display',
);
assert.match(
  screen,
  /activitySummaryTotal.*challengeSummary/,
  '10L-2: WorkoutLoggedScreen must still pass activitySummaryTotal from challengeSummary (10J continuity)',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: "View Completion" uses proper secondary CTA styling (not floating/broken)
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /View Completion[\s\S]{0,20}|[\s\S]{0,300}View Completion/,
  'UI: View Completion button must be rendered',
);
assert.doesNotMatch(
  screen,
  /st-btn-secondary[\s\S]{0,30}View Completion|View Completion[\s\S]{0,30}st-btn-secondary/s,
  'UI: View Completion must NOT use st-btn-secondary (broken oversized class) — must use inline secondary styles',
);
assert.match(
  screen,
  /w-full[\s\S]{0,200}View Completion|View Completion[\s\S]{0,5}<\/button>/s,
  'UI: View Completion button must be full-width to match primary CTA width',
);
assert.match(
  screen,
  /border[\s\S]{0,200}View Completion|View Completion[\s\S]{0,5}<\/button>/s,
  'UI: View Completion button must have a visible border',
);
assert.match(
  screen,
  /bg-white[\s\S]{0,200}View Completion|View Completion[\s\S]{0,5}<\/button>/s,
  'UI: View Completion button must have white background',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Breadcrumb / back control present with "Challenge Detail" label
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /Challenge Detail/,
  'UI: Breadcrumb must render "Challenge Detail" label',
);
assert.match(
  screen,
  /ArrowLeft/,
  'UI: Breadcrumb must render an ArrowLeft icon',
);
assert.match(
  screen,
  /handleBack/,
  'UI: Back button must call handleBack handler',
);

// ─────────────────────────────────────────────────────────────────────────────
// RULE: Breadcrumb fallback uses challengeId-based route
// ─────────────────────────────────────────────────────────────────────────────
assert.match(
  screen,
  /challengeDetailPath[\s\S]{0,50}challengeId/,
  'UI: Fallback back-navigation must use /app/challenge/:challengeId route',
);
assert.match(
  screen,
  /\/app\/challenge\/\$\{challengeId\}/,
  'UI: challengeDetailPath must route to /app/challenge/${challengeId}',
);

console.log('✅ All Phase 19A-10L WorkoutLoggedScreen completion CTA guards passed (revised).');
