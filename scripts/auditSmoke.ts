import fs from 'node:fs';
import path from 'node:path';

type CheckResult = {
  name: string;
  ok: boolean;
  details?: string;
};

const root = process.cwd();

function read(filePath: string): string {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function exists(filePath: string): boolean {
  return fs.existsSync(path.join(root, filePath));
}

function check(name: string, test: () => boolean, details?: string): CheckResult {
  try {
    return { name, ok: test(), details };
  } catch (error) {
    return {
      name,
      ok: false,
      details: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

function summarize(results: CheckResult[]) {
  const passed = results.filter((item) => item.ok);
  const failed = results.filter((item) => !item.ok);

  console.log(`\nSmoke audit summary: ${passed.length}/${results.length} checks passed.\n`);
  for (const item of results) {
    const prefix = item.ok ? 'PASS' : 'FAIL';
    console.log(`- [${prefix}] ${item.name}${item.details ? ` — ${item.details}` : ''}`);
  }

  if (failed.length > 0) {
    process.exit(1);
  }
}

const appTsx = read('src/App.tsx');
const homeData = read('src/features/Home/useHomeScreen.ts');
const selectActivity = read('src/features/Workouts/SelectChallengeActivityScreen.tsx');
const quickActions = read('src/features/QuickActions/QuickActionsScreen.tsx');
const challengeService = read('src/services/challengeService.ts');

const results: CheckResult[] = [
  check(
    'Select Activity copy is activity-neutral',
    () => selectActivity.includes('Pick an activity to log your progress'),
  ),
  check(
    'Select Activity has time-based wellness metric handling',
    () => selectActivity.includes('Time-based activity') && selectActivity.includes("normalizedType === 'fasting'"),
  ),
  check(
    'Quick Actions uses "Log Activity"',
    () => quickActions.includes('Log Activity'),
  ),
  check(
    'Home data uses visibility-safe challenge query',
    () => homeData.includes('getVisibleChallengesForUser('),
  ),
  check(
    'ChallengeService exposes getVisibleChallengesForUser',
    () => challengeService.includes('async getVisibleChallengesForUser('),
  ),
  check(
    'Admin wellness activities route is registered',
    () =>
      appTsx.includes('/app/admin/wellness-activities')
      && appTsx.includes('AdminWellnessActivityListScreen'),
  ),
  check(
    'Admin wellness activities screens exist',
    () =>
      exists('src/features/Admin/Wellness/WellnessActivityListScreen.tsx')
      && exists('src/features/Admin/Wellness/AddWellnessActivityScreen.tsx')
      && exists('src/features/Admin/Wellness/EditWellnessActivityScreen.tsx'),
  ),
];

summarize(results);
