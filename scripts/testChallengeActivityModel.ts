/**
 * scripts/testChallengeActivityModel.ts
 *
 * Phase 18I-6E guards: MVP challenge activity model
 *
 * Rules under test:
 * 1. ChallengeActivitySection hides "Add Another Activity" for non-streak
 * 2. CreateChallengeWizard normalizes activities to 1 when switching from streak
 * 3. Admin CreateChallengeScreen has the same normalization
 * 4. Admin EditChallengeTemplateScreen has the same normalization
 * 5. Admin EditWellnessTemplateScreen has the same normalization
 * 6. Streak engine already prevents double-streak-increment for same day
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
// Test 1: ChallengeActivitySection hides "Add Another Activity" for non-streak
// ---------------------------------------------------------------------------
console.log('\n--- Test 1: ChallengeActivitySection hides Add Another Activity for non-streak ---');
{
  const src = readSrc('src/features/Challenges/components/ChallengeActivitySection.tsx');
  assert(
    'Add Another Activity button is gated by challengeType === streak',
    src.includes("challengeType === 'streak'") && src.includes('Add Another Activity'),
  );
  assert(
    'Button is inside the streak condition (not unconditionally rendered)',
    // The button text appears only once and is wrapped in the streak condition
    (src.match(/Add Another Activity/g) ?? []).length === 1 &&
      src.indexOf("challengeType === 'streak'") < src.indexOf('Add Another Activity'),
  );
}

// ---------------------------------------------------------------------------
// Test 2: CreateChallengeWizard normalizes activities on type switch
// ---------------------------------------------------------------------------
console.log('\n--- Test 2: CreateChallengeWizard normalizes activities on type switch ---');
{
  const src = readSrc('src/features/Challenges/CreateChallengeWizard.tsx');
  assert(
    'handleTypeChange function is defined in wizard',
    src.includes('handleTypeChange'),
  );
  assert(
    'handleTypeChange normalizes activities to first element when switching to non-streak',
    src.includes("newType !== 'streak' && activities.length > 1"),
  );
  assert(
    'handleTypeChange is passed to onTypeChange (not raw setChallengeType)',
    src.includes('onTypeChange={handleTypeChange}') && !src.includes('onTypeChange={setChallengeType}'),
  );
  assert(
    'Review step shows activity unit and name with group target',
    src.includes('activities[0]?.unit') && src.includes('activities[0]?.query'),
  );
}

// ---------------------------------------------------------------------------
// Test 3: Admin CreateChallengeScreen normalizes on type switch
// ---------------------------------------------------------------------------
console.log('\n--- Test 3: Admin CreateChallengeScreen normalizes on type switch ---');
{
  const src = readSrc('src/features/Admin/Challenges/CreateChallengeScreen.tsx');
  assert(
    'handleTypeChange defined in admin CreateChallengeScreen',
    src.includes('handleTypeChange'),
  );
  assert(
    'handleTypeChange normalizes to first activity',
    src.includes("newType !== 'streak' && activities.length > 1"),
  );
  assert(
    'Admin CreateChallengeScreen uses handleTypeChange not raw setChallengeType for onTypeChange',
    src.includes('onTypeChange={handleTypeChange}'),
  );
}

// ---------------------------------------------------------------------------
// Test 4: Admin EditChallengeTemplateScreen normalizes on type switch
// ---------------------------------------------------------------------------
console.log('\n--- Test 4: Admin EditChallengeTemplateScreen normalizes on type switch ---');
{
  const src = readSrc('src/features/Admin/Challenges/EditChallengeTemplateScreen.tsx');
  assert(
    'handleTypeChange defined in EditChallengeTemplateScreen',
    src.includes('handleTypeChange'),
  );
  assert(
    'Type buttons use handleTypeChange not raw setChallengeType',
    src.includes('handleTypeChange(option.id)') && !src.includes('setChallengeType(option.id)'),
  );
}

// ---------------------------------------------------------------------------
// Test 5: Admin EditWellnessTemplateScreen normalizes on type switch
// ---------------------------------------------------------------------------
console.log('\n--- Test 5: Admin EditWellnessTemplateScreen normalizes on type switch ---');
{
  const src = readSrc('src/features/Admin/Challenges/EditWellnessTemplateScreen.tsx');
  assert(
    'handleTypeChange defined in EditWellnessTemplateScreen',
    src.includes('handleTypeChange'),
  );
  assert(
    'EditWellnessTemplateScreen passes handleTypeChange to onTypeChange',
    src.includes('onTypeChange={handleTypeChange}'),
  );
}

// ---------------------------------------------------------------------------
// Test 6: Streak engine already idempotent for same-day re-logs
// ---------------------------------------------------------------------------
console.log('\n--- Test 6: Streak engine is idempotent for same-day logs ---');
{
  const src = readSrc('src/services/challengeEngine/streakEngine.ts');
  assert(
    "streakEngine has 'prevLastLogDate === today' guard (no double increment)",
    src.includes('prevLastLogDate === today'),
  );
  assert(
    'When prevLastLogDate === today, newStreak = prevStreak (not incremented)',
    /prevLastLogDate === today[\s\S]{0,80}newStreak = prevStreak/.test(src),
  );
}

// ---------------------------------------------------------------------------
// Results
// ---------------------------------------------------------------------------
console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
