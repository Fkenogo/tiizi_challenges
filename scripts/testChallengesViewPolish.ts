/**
 * Phase 18I-6L / 18I-6L-followup / 18I-6M — Challenges View, Wellness Activities Library guards
 *
 * Uses readFileSync-only pattern (no Firestore calls).
 * Run: npm run test:challenges-view-polish
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const challengesScreen = readFileSync('src/features/Challenges/ChallengesScreen.tsx', 'utf8');

// ── A: Section title renamed ──────────────────────────────────────────────────

assert.match(
  challengesScreen,
  /Fitness Challenges/,
  'ChallengesScreen must use "Fitness Challenges" section title (not "Suggested Templates")',
);

assert.doesNotMatch(
  challengesScreen,
  /Suggested Templates/,
  'ChallengesScreen must not render legacy "Suggested Templates" label',
);

// ── B: Wellness cards use coverImage when available ───────────────────────────

assert.match(
  challengesScreen,
  /isValidHttpImage\(item\.coverImage\)/,
  'Wellness template cards must check isValidHttpImage(item.coverImage) before rendering cover photo',
);

// ── C: Browse empty state no longer shows false "no challenges" message ───────

assert.doesNotMatch(
  challengesScreen,
  /No public challenges available to browse yet\./,
  'ChallengesScreen must not show misleading "No public challenges available to browse yet."',
);

// ── D: Browse Activities Library — correct routes ─────────────────────────────
// (updated Phase 1 guard triage: section heading shortened to "Activities Library"
// as part of the visual-polish copy pass; routing/behavior unchanged)

assert.match(
  challengesScreen,
  /Activities Library/,
  'ChallengesScreen must have an "Activities Library" section heading',
);

assert.match(
  challengesScreen,
  /\/app\/exercises/,
  'Exercise Library CTA must navigate to /app/exercises',
);

assert.match(
  challengesScreen,
  /\/app\/wellness-activities/,
  'Wellness Library CTA must navigate to /app/wellness-activities',
);

assert.doesNotMatch(
  challengesScreen,
  /navigate\(['"`]\/app\/challenges\/wellness['"`]\)/,
  'Wellness Library CTA must not navigate to /app/challenges/wellness (templates gallery)',
);

// ── E: WellnessActivitiesLibraryScreen — clickable rows ──────────────────────

const wellnessLibrary = readFileSync('src/features/Wellness/WellnessActivitiesLibraryScreen.tsx', 'utf8');

assert.match(
  wellnessLibrary,
  /\/app\/wellness-activities\/\$\{item\.id\}/,
  'WellnessActivitiesLibraryScreen rows must navigate to /app/wellness-activities/:id',
);

assert.doesNotMatch(
  wellnessLibrary,
  /Edit|Delete|Add Wellness Activity/,
  'WellnessActivitiesLibraryScreen must not expose admin actions',
);

assert.match(
  wellnessLibrary,
  /useWellnessActivities/,
  'WellnessActivitiesLibraryScreen must use useWellnessActivities hook',
);

// ── F: WellnessActivityDetailScreen exists and is read-only ──────────────────

const wellnessDetail = readFileSync('src/features/Wellness/WellnessActivityDetailScreen.tsx', 'utf8');

assert.match(
  wellnessDetail,
  /WellnessActivityDetailScreen/,
  'WellnessActivityDetailScreen must exist and export the component',
);

assert.match(
  wellnessDetail,
  /description|guidelines|benefits/,
  'WellnessActivityDetailScreen must render description, guidelines, or benefits',
);

assert.doesNotMatch(
  wellnessDetail,
  /Edit|Delete|admin/i,
  'WellnessActivityDetailScreen must not expose admin actions',
);

assert.match(
  wellnessDetail,
  /Add to Challenge/,
  'WellnessActivityDetailScreen must have an "Add to Challenge" CTA',
);

assert.match(
  wellnessDetail,
  /\/app\/create-challenge/,
  'Add to Challenge CTA must navigate to /app/create-challenge',
);

assert.match(
  wellnessDetail,
  /wellnessActivityId/,
  'Add to Challenge CTA must pass wellnessActivityId param to prefill the wizard',
);

// ── G: Wizard handles wellnessActivityId prefill ─────────────────────────────

const wizard = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');

assert.match(
  wizard,
  /wellnessActivityId/,
  'CreateChallengeWizard must handle wellnessActivityId URL param for activity prefill',
);

assert.match(
  wizard,
  /setChallengeCategory.*match\.category|match\.category.*setChallengeCategory/,
  'Wizard wellnessActivityId prefill must set challengeCategory to activity category',
);

// Routes registered in App.tsx
const appTsx = readFileSync('src/App.tsx', 'utf8');

assert.match(
  appTsx,
  /\/app\/wellness-activities\/:id/,
  'App.tsx must register /app/wellness-activities/:id route for WellnessActivityDetailScreen',
);

assert.match(
  appTsx,
  /WellnessActivityDetailScreen/,
  'App.tsx must import WellnessActivityDetailScreen',
);

console.log('✅ testChallengesViewPolish — 20/20 passed');
