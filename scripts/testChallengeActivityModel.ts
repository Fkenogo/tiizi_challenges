/**
 * scripts/testChallengeActivityModel.ts
 *
 * Phase 18I-6E guards: MVP challenge activity model (follow-up)
 *
 * Rules under test:
 * 1.  ChallengeActivitySection hides "Add Another Activity" for non-streak
 * 2.  CreateChallengeWizard normalizes activities to 1 when switching to non-streak
 * 3.  Admin CreateChallengeScreen has the same normalization
 * 4.  Admin EditChallengeTemplateScreen has the same normalization
 * 5.  Admin EditWellnessTemplateScreen has the same normalization
 * 6.  ChallengeEngineSettingsSection has NO groupCumulativeTarget input for collective
 * 7.  Wizard derives groupCumulativeTarget from finalActivities[0].targetValue
 * 8.  Admin CreateChallengeScreen derives groupCumulativeTarget from finalActivities[0].targetValue
 * 9.  Admin EditChallengeTemplateScreen derives groupCumulativeTarget from finalActivities[0].targetValue
 * 10. Admin EditWellnessTemplateScreen derives groupCumulativeTarget from finalActivities[0].targetValue
 * 11. Wizard caps non-streak to 1 activity in payload (finalActivities = slice(0,1))
 * 12. Admin CreateChallengeScreen caps non-streak to 1 in payload
 * 13. Admin EditChallengeTemplateScreen caps non-streak to 1 in payload
 * 14. Admin EditWellnessTemplateScreen caps non-streak to 1 in payload
 * 15. Wizard removes groupCumulativeTarget step-2 validation for collective
 * 16. Review screen shows activity unit and name with group target
 * 17. SelectChallengeActivityScreen has multi-streak checklist mode
 * 18. Checklist submit disabled until all values are > 0
 * 19. Streak engine idempotent for same-day logs
 * 20. SelectChallengeActivityScreen: normal (single/non-streak) Log button still present
 */

import * as fs from 'fs';
import * as path from 'path';

let passed = 0;
let failed = 0;

function assert(description: string, condition: boolean) {
  if (condition) {
    console.log(`  ✅ ${description}`);
    passed++;
  } else {
    console.error(`  ❌ ${description}`);
    failed++;
  }
}

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relPath), 'utf-8');
}

// ---------------------------------------------------------------------------
// Test 1: ChallengeActivitySection hides Add Another Activity for non-streak
// ---------------------------------------------------------------------------
console.log('\n--- Test 1: ChallengeActivitySection hides Add Another Activity for non-streak ---');
{
  const src = readSrc('src/features/Challenges/components/ChallengeActivitySection.tsx');
  assert(
    'Add Another Activity button is gated by challengeType === streak',
    src.includes("challengeType === 'streak'") && src.includes('Add Another Activity'),
  );
  assert(
    'Button is rendered only once and after the streak condition',
    (src.match(/Add Another Activity/g) ?? []).length === 1 &&
      src.indexOf("challengeType === 'streak'") < src.indexOf('Add Another Activity'),
  );
}

// ---------------------------------------------------------------------------
// Tests 2-5: Type-change normalization across all creation screens
// ---------------------------------------------------------------------------
console.log('\n--- Tests 2-5: Type-change normalization ---');
const normalizationFiles: [string, string][] = [
  ['src/features/Challenges/CreateChallengeWizard.tsx', 'wizard'],
  ['src/features/Admin/Challenges/CreateChallengeScreen.tsx', 'admin CreateChallengeScreen'],
  ['src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx', 'EditChallengeTemplateScreen'],
  ['src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx', 'EditWellnessTemplateScreen'],
];
for (const [filePath, label] of normalizationFiles) {
  const src = readSrc(filePath);
  assert(
    `${label}: handleTypeChange normalizes activities to first when switching to non-streak`,
    src.includes("newType !== 'streak' && activities.length > 1"),
  );
}

// ---------------------------------------------------------------------------
// Test 6: ChallengeEngineSettingsSection has no groupCumulativeTarget input for collective
// ---------------------------------------------------------------------------
console.log('\n--- Test 6: No groupCumulativeTarget input in collective settings ---');
{
  const src = readSrc('src/features/Challenges/components/ChallengeEngineSettingsSection.tsx');
  assert(
    'collective section has no number input for groupCumulativeTarget',
    !/<input[^>]*groupCumulativeTarget/.test(src) &&
      !src.includes('onGroupCumulativeTargetChange(e.target.value)'),
  );
  assert(
    'collective section explains group target is derived automatically',
    src.includes('derived automatically') || src.includes('derived from the activity'),
  );
}

// ---------------------------------------------------------------------------
// Tests 7-10: groupCumulativeTarget derived from finalActivities[0].targetValue
// ---------------------------------------------------------------------------
console.log('\n--- Tests 7-10: groupCumulativeTarget derived from activity target ---');
const derivedFiles: [string, string][] = [
  ['src/features/Challenges/CreateChallengeWizard.tsx', 'wizard'],
  ['src/features/Admin/Challenges/CreateChallengeScreen.tsx', 'admin CreateChallengeScreen'],
  ['src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx', 'EditChallengeTemplateScreen'],
  ['src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx', 'EditWellnessTemplateScreen'],
];
for (const [filePath, label] of derivedFiles) {
  const src = readSrc(filePath);
  assert(
    `${label}: groupCumulativeTarget derived from first activity targetValue`,
    src.includes('finalActivities[0]?.targetValue') ||
      src.includes('finalActivities[0].targetValue'),
  );
  assert(
    `${label}: no longer uses raw groupCumulativeTarget state as the payload value`,
    !src.includes('groupCumulativeTarget: Number(groupCumulativeTarget),'),
  );
}

// ---------------------------------------------------------------------------
// Tests 11-14: Non-streak capped to 1 activity in payload
// ---------------------------------------------------------------------------
console.log('\n--- Tests 11-14: Non-streak payload capped to 1 activity ---');
const capFiles: [string, string][] = [
  ['src/features/Challenges/CreateChallengeWizard.tsx', 'wizard (finalActivities)'],
  ['src/features/Admin/Challenges/CreateChallengeScreen.tsx', 'admin CreateChallengeScreen (finalActivities)'],
  ['src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx', 'EditChallengeTemplateScreen (finalActivities)'],
  ['src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx', 'EditWellnessTemplateScreen (finalActivities)'],
];
for (const [filePath, label] of capFiles) {
  const src = readSrc(filePath);
  assert(
    `${label}: caps non-streak activities to first entry`,
    src.includes("challengeType !== 'streak'") && src.includes('slice(0, 1)'),
  );
}

// ---------------------------------------------------------------------------
// Test 15: Wizard removes groupCumulativeTarget step-2 validation for collective
// ---------------------------------------------------------------------------
console.log('\n--- Test 15: Wizard step-2 no longer validates groupCumulativeTarget for collective ---');
{
  const src = readSrc('src/features/Challenges/CreateChallengeWizard.tsx');
  assert(
    'groupCumulativeTarget step-2 validation removed from wizard',
    !src.includes("'collective' && (!groupCumulativeTarget"),
  );
}

// ---------------------------------------------------------------------------
// Test 16: Review screen shows unit and activity name with group target
// ---------------------------------------------------------------------------
console.log('\n--- Test 16: Review screen shows activity unit and name with group target ---');
{
  const src = readSrc('src/features/Challenges/CreateChallengeWizard.tsx');
  assert(
    'Review screen shows activities[0]?.unit alongside group target',
    src.includes('activities[0]?.unit'),
  );
  assert(
    'Review screen shows activities[0]?.query for activity name',
    src.includes('activities[0]?.query'),
  );
}

// ---------------------------------------------------------------------------
// Tests 17-18: SelectChallengeActivityScreen multi-streak checklist
// ---------------------------------------------------------------------------
console.log('\n--- Tests 17-18: SelectChallengeActivityScreen multi-streak checklist ---');
{
  const src = readSrc('src/features/Workouts/SelectChallengeActivityScreen.tsx');
  assert(
    'isMultiStreakMode detects streak + activities.length > 1',
    src.includes("challengeType === 'streak' && activities.length > 1"),
  );
  assert(
    'handleChecklistSubmit is defined for batch submission',
    src.includes('handleChecklistSubmit'),
  );
  assert(
    'allChecklistValuesValid requires every value > 0',
    src.includes('allChecklistValuesValid') && src.includes('every(') && src.includes('> 0'),
  );
  assert(
    'Log Day button is disabled until all values valid',
    src.includes('disabled={!allChecklistValuesValid'),
  );
  assert(
    'Checklist submit calls both logWellness and logWorkout services',
    src.includes('logWellness.mutateAsync') && src.includes('logWorkout.mutateAsync'),
  );
}

// ---------------------------------------------------------------------------
// Test 19: Streak engine idempotent for same-day logs
// ---------------------------------------------------------------------------
console.log('\n--- Test 19: Streak engine idempotent for same-day logs ---');
{
  const src = readSrc('src/services/challengeEngine/streakEngine.ts');
  assert(
    "streakEngine guards prevLastLogDate === today (no double increment)",
    src.includes('prevLastLogDate === today'),
  );
  assert(
    'When same-day, newStreak stays at prevStreak',
    /prevLastLogDate === today[\s\S]{0,80}newStreak = prevStreak/.test(src),
  );
}

// ---------------------------------------------------------------------------
// Test 20: Normal Log button preserved for single-activity / non-streak
// ---------------------------------------------------------------------------
console.log('\n--- Test 20: Normal Log button preserved for non-checklist mode ---');
{
  const src = readSrc('src/features/Workouts/SelectChallengeActivityScreen.tsx');
  assert(
    'Log button still rendered in normal mode (isOptional || !isChallengeActiveNow check present)',
    src.includes('isOptional || !isChallengeActiveNow'),
  );
  assert(
    'handleLog function still exists for single-activity navigation',
    src.includes('handleLog'),
  );
}

// ---------------------------------------------------------------------------
// Test 21: Checklist partial-failure — no navigation on error, error toast shown
// ---------------------------------------------------------------------------
console.log('\n--- Test 21: Checklist partial-failure behavior ---');
{
  const src = readSrc('src/features/Workouts/SelectChallengeActivityScreen.tsx');
  assert(
    'handleChecklistSubmit does NOT call navigate inside the catch block',
    (() => {
      const catchIdx = src.indexOf('} catch (error)');
      const finallyIdx = src.indexOf('} finally {');
      if (catchIdx === -1 || finallyIdx === -1) return false;
      const catchBlock = src.slice(catchIdx, finallyIdx);
      return !catchBlock.includes('navigate(');
    })(),
  );
  assert(
    'handleChecklistSubmit shows error toast in catch block',
    (() => {
      const catchIdx = src.indexOf('} catch (error)');
      const finallyIdx = src.indexOf('} finally {');
      if (catchIdx === -1 || finallyIdx === -1) return false;
      const catchBlock = src.slice(catchIdx, finallyIdx);
      return catchBlock.includes('showToast');
    })(),
  );
  assert(
    'MVP partial-failure limitation is documented in a comment',
    src.includes('MVP limitation') || src.includes('partially written'),
  );
}

// ---------------------------------------------------------------------------
// Phase 18I-6H: Fix Collective challenge creation (stale groupCumulativeTarget validation)
// ---------------------------------------------------------------------------
console.log('\n--- Phase 18I-6H: Collective challenge validation fixes ---');
{
  const validationSrc = readSrc('src/features/Challenges/utils/challengeFormValidation.ts');
  assert(
    'validateChallengeForm interface no longer has groupCumulativeTarget field',
    !validationSrc.includes('groupCumulativeTarget: string'),
  );
  assert(
    'Stale "Set a group cumulative target greater than zero" error is removed from validation',
    !validationSrc.includes('Set a group cumulative target greater than zero'),
  );
  assert(
    'validateChallengeForm still validates unit consistency for collective',
    validationSrc.includes("'Collective challenges require all activities to share the same unit.'"),
  );
}

{
  const wizardSrc = readSrc('src/features/Challenges/CreateChallengeWizard.tsx');
  assert(
    'Wizard validateChallengeForm call does not pass groupCumulativeTarget',
    !wizardSrc.includes('groupCumulativeTarget,\n      requiredConsecutiveDays'),
  );
  assert(
    'Wizard "Ready to launch?" collective item checks activity targetValue, not state',
    wizardSrc.includes("activities.some((a) => Number(a.targetValue) > 0)"),
  );
}

{
  const adminCreateSrc = readSrc('src/features/Admin/Challenges/CreateChallengeScreen.tsx');
  assert(
    'Admin CreateChallengeScreen validateChallengeForm call does not pass groupCumulativeTarget',
    !adminCreateSrc.includes('groupCumulativeTarget,\n      requiredConsecutiveDays'),
  );
}

{
  const editWellnessSrc = readSrc('src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx');
  assert(
    'EditWellnessTemplateScreen validationInput does not include groupCumulativeTarget field',
    !editWellnessSrc.includes('groupCumulativeTarget,\n    requiredConsecutiveDays'),
  );
  assert(
    'EditWellnessTemplateScreen useMemo deps no longer includes groupCumulativeTarget',
    !editWellnessSrc.includes('groupCumulativeTarget, requiredConsecutiveDays, duration'),
  );
}

{
  const auditSrc = readSrc('scripts/auditChallengeCreationPayloads.ts');
  assert(
    'auditChallengeCreationPayloads no longer passes groupCumulativeTarget to validateChallengeForm',
    !auditSrc.includes("groupCumulativeTarget: type === 'collective'"),
  );
}

// ---------------------------------------------------------------------------
// Phase 18I-6K guards: SelectChallengeActivityScreen uses shared leaderboard queryKeys
// ---------------------------------------------------------------------------
{
  console.log('\n--- Phase 18I-6K: SelectChallengeActivityScreen leaderboard data source ---');
  const selectSrc = readSrc('src/features/Workouts/SelectChallengeActivityScreen.tsx');
  const detailSrc = readSrc('src/features/Challenges/ChallengeDetailScreen.tsx');

  assert(
    'SelectChallengeActivityScreen uses challenge-leaderboard-snapshot queryKey',
    selectSrc.includes("'challenge-leaderboard-snapshot'"),
  );

  assert(
    'SelectChallengeActivityScreen uses challenge-participant-names queryKey',
    selectSrc.includes("'challenge-participant-names'"),
  );

  assert(
    'ChallengeDetailScreen also uses challenge-leaderboard-snapshot (shared cache baseline)',
    detailSrc.includes("'challenge-leaderboard-snapshot'"),
  );

  assert(
    'ChallengeDetailScreen also uses challenge-participant-names (shared cache baseline)',
    detailSrc.includes("'challenge-participant-names'"),
  );

  assert(
    'SelectChallengeActivityScreen passes memberSumContribution to resolveChallengeProgress',
    selectSrc.includes('memberSumContribution') && selectSrc.includes('resolveChallengeProgress'),
  );

  assert(
    'SelectChallengeActivityScreen passes currentUserId to resolveChallengeProgress',
    selectSrc.includes('currentUserId') && selectSrc.includes('resolveChallengeProgress'),
  );

  assert(
    'SelectChallengeActivityScreen passes leaderboard to resolveChallengeProgress',
    /resolveChallengeProgress\(\{[\s\S]{0,400}leaderboard/.test(selectSrc),
  );

  assert(
    'SelectChallengeActivityScreen renders empty state "No activity logged yet. Be the first!"',
    selectSrc.includes('No activity logged yet. Be the first!'),
  );

  assert(
    'SelectChallengeActivityScreen renders _rp.secondaryLabel',
    selectSrc.includes('_rp.secondaryLabel'),
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
