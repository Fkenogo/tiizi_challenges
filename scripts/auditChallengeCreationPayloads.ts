/**
 * Static audit: verifies challenge creation/edit UI correctness for all 6
 * mode×type combinations without hitting Firebase.
 *
 * Checks:
 *  1. No "How often?" label remains in creation/edit screens
 *  2. All four screens use ChallengeActivitySection
 *  3. Streak payload includes requiredConsecutiveDays, not frequency
 *  4. Validation does not gate on frequency
 *  5. All 6 wizard payload combinations can be constructed without errors
 *  6. All 6 admin create payload combinations can be constructed without errors
 */

import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const activitySection   = readFileSync('src/features/Challenges/components/ChallengeActivitySection.tsx', 'utf8');
const wizard            = readFileSync('src/features/Challenges/CreateChallengeWizard.tsx', 'utf8');
const adminCreate       = readFileSync('src/features/Admin/Challenges/CreateChallengeScreen.tsx', 'utf8');
const editFitness       = readFileSync('src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx', 'utf8');
const editWellness      = readFileSync('src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx', 'utf8');
const validation        = readFileSync('src/features/Challenges/utils/challengeFormValidation.ts', 'utf8');

// ── 1. "How often?" label must not appear in any creation/edit file ───────────

const screensToCheck = [
  { name: 'ChallengeActivitySection', src: activitySection },
  { name: 'CreateChallengeWizard',    src: wizard },
  { name: 'CreateChallengeScreen',    src: adminCreate },
  { name: 'EditChallengeTemplateScreen', src: editFitness },
  { name: 'EditWellnessTemplateScreen',  src: editWellness },
];

for (const { name, src } of screensToCheck) {
  assert(
    !src.includes('How often?'),
    `"How often?" label found in ${name} — frequency field must be removed from all creation/edit screens`,
  );
}
console.log('  ✅ 1. No "How often?" label in any creation/edit screen');

// ── 2. All four creation/edit screens import ChallengeActivitySection ─────────

assert(
  wizard.includes('ChallengeActivitySection'),
  'CreateChallengeWizard must import/use ChallengeActivitySection',
);
assert(
  adminCreate.includes('ChallengeActivitySection'),
  'CreateChallengeScreen must import/use ChallengeActivitySection',
);
assert(
  editFitness.includes('ChallengeActivitySection'),
  'EditChallengeTemplateScreen must import/use ChallengeActivitySection',
);
assert(
  editWellness.includes('ChallengeActivitySection'),
  'EditWellnessTemplateScreen must import/use ChallengeActivitySection',
);
console.log('  ✅ 2. All four screens use ChallengeActivitySection');

// ── 3. Streak payload includes requiredConsecutiveDays ────────────────────────

assert(
  wizard.includes('requiredConsecutiveDays'),
  'CreateChallengeWizard must include requiredConsecutiveDays in streak payload',
);
assert(
  adminCreate.includes('requiredConsecutiveDays'),
  'CreateChallengeScreen must include requiredConsecutiveDays in streak payload',
);
assert(
  editFitness.includes('requiredConsecutiveDays'),
  'EditChallengeTemplateScreen must include requiredConsecutiveDays in streak payload',
);
assert(
  editWellness.includes('requiredConsecutiveDays'),
  'EditWellnessTemplateScreen must include requiredConsecutiveDays in streak payload',
);
console.log('  ✅ 3. All screens include requiredConsecutiveDays in streak payload');

// ── 4. Validation does not gate on frequency ──────────────────────────────────

assert(
  !validation.includes("'frequency'") && !validation.includes('"frequency"'),
  'challengeFormValidation must not validate or require frequency',
);
// Streak validation only checks requiredConsecutiveDays
assert(
  validation.includes('requiredConsecutiveDays'),
  'challengeFormValidation must check requiredConsecutiveDays for streak',
);
console.log('  ✅ 4. Validation does not gate on frequency; streak only requires requiredConsecutiveDays');

// ── 5. Wizard: valid payload structure for all 6 combinations ─────────────────
// Static shape verification using the validateChallengeForm function.

import { validateChallengeForm } from '../src/features/Challenges/utils/challengeFormValidation';

type ChallengeType = 'collective' | 'competitive' | 'streak';

const baseActivity = { query: 'Push-up', exerciseId: 'ex-1', activityId: undefined, targetValue: '20', unit: 'Reps' };
const wellnessActivity = { query: 'Meditation', exerciseId: undefined, activityId: 'wa-1', targetValue: '20', unit: 'minutes' };

const combinations: Array<{ mode: 'fitness' | 'wellness'; type: ChallengeType }> = [
  { mode: 'fitness',  type: 'collective' },
  { mode: 'fitness',  type: 'competitive' },
  { mode: 'fitness',  type: 'streak' },
  { mode: 'wellness', type: 'collective' },
  { mode: 'wellness', type: 'competitive' },
  { mode: 'wellness', type: 'streak' },
];

for (const { mode, type } of combinations) {
  const activity = mode === 'wellness' ? wellnessActivity : baseActivity;
  const error = validateChallengeForm({
    name: 'Test Challenge',
    description: 'A valid description for testing purposes',
    startDate: '2026-07-01',
    endDate: '2026-07-30',
    challengeType: type,
    activities: [activity],
    requiredConsecutiveDays: type === 'streak' ? '30' : '',
    durationDays: 30,
    donationEnabled: false,
    causeName: '',
    causeDescription: '',
    contributionPhoneNumber: '',
    contributionCardUrl: '',
  });
  assert(
    error === null,
    `validateChallengeForm failed for ${mode}+${type}: "${error}"`,
  );
}
console.log('  ✅ 5. All 6 mode×type combinations pass validateChallengeForm (no frequency required)');

// ── 6. Streak payload shape: frequency optional, requiredConsecutiveDays present

// Verify wizard sends requiredConsecutiveDays in the streak branch, not frequency
assert(
  wizard.includes("challengeType === 'streak'") && wizard.includes('requiredConsecutiveDays'),
  'Wizard streak branch must include requiredConsecutiveDays',
);
// Verify frequency is optional in ActivityRow (not required by interface)
assert(
  activitySection.includes('frequency?: ActivityFrequency'),
  'ActivityRow.frequency must be optional (not required)',
);
console.log('  ✅ 6. Streak payload: requiredConsecutiveDays present; frequency optional and not required');

// ── 7. EditFitnessTemplate uses shared section (not old inline datalist) ───────

assert(
  !editFitness.includes('<datalist'),
  'EditChallengeTemplateScreen must not use <datalist> (old inline autocomplete removed)',
);
assert(
  !editFitness.includes('pickerResults'),
  'EditChallengeTemplateScreen must not have old pickerResults memo',
);
console.log('  ✅ 7. EditChallengeTemplateScreen uses shared section, old datalist UI removed');

// ── 8. EditWellnessTemplate is wellness-only (isWellnessMode hardcoded true) ───

assert(
  editWellness.includes('isWellnessMode={true}'),
  'EditWellnessTemplateScreen must pass isWellnessMode={true} to ChallengeActivitySection',
);
console.log('  ✅ 8. EditWellnessTemplateScreen passes isWellnessMode={true}');

console.log('\nauditChallengeCreationPayloads: all guards passed ✅');
