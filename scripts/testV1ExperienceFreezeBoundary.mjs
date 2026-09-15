import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const fromRoot = (path) => new URL(path, root);
const read = (path) => readFileSync(fromRoot(path), 'utf8');
const exists = (path) => existsSync(fromRoot(path));

let failures = 0;
const check = (name, condition) => {
  if (condition) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}`); }
};

const walk = (directory) => readdirSync(fromRoot(directory), { withFileTypes: true }).flatMap((entry) => {
  const path = join(directory, entry.name);
  return entry.isDirectory() ? walk(path) : [path];
});

const v2ExperienceFiles = walk('src/features').filter((path) => (
  /\.(ts|tsx)$/.test(path)
  && !/\.(test|runtime\.test)\.(ts|tsx)$/.test(path)
  && (path.includes('/V2/') || /\/V2[^/]*\.tsx$/.test(path))
));

// The freeze is intentionally a compact manifest, not a directory migration.
// These are product-experience imports V2 experience code may not add.
const FROZEN_V1_EXPERIENCE_IMPORTS = [
  { path: 'src/components/Layout', named: 'BottomNav' },
  { path: 'src/features/Home' },
  { path: 'src/features/Groups' },
  { path: 'src/features/Exercises' },
  { path: 'src/features/Wellness' },
  { path: 'src/features/Workouts' },
  { path: 'src/features/Profile' },
  { path: 'src/features/Onboarding' },
  { path: 'src/features/QuickActions' },
  { path: 'src/features/Challenges/CreateChallengeWizard' },
  { path: 'src/features/Challenges/WellnessTemplate' },
  { path: 'src/features/Challenges/BrowseChallenges' },
  { path: 'src/features/Challenges/SuggestedChallenges' },
  { path: 'src/features/Challenges/ChallengePreview' },
  { path: 'src/features/Challenges/CompetitiveChallenge' },
  { path: 'src/features/Challenges/CollectiveChallenge' },
  { path: 'src/features/Challenges/StreakChallenge' },
  { path: 'src/features/Challenges/ChallengeLeaderboard' },
  { path: 'src/features/Challenges/ChallengeCompleted' },
  { path: 'src/features/Challenges/CompletedChallenges' },
  { path: 'src/features/Challenges/ChallengeDetailScreen' },
];

// Pre-freeze contamination is recorded, never silently grandfathered. A new
// frozen import or a changed baseline fails this guard until explicitly
// reconciled by an authorized V2 experience-assembly task.
const RECORDED_MIXED_BASELINE = new Set([
  'src/features/Challenges/V2/V2CreateChallengeWizard.tsx::src/components/Layout::BottomNav',
  'src/features/Challenges/V2ChallengeDetailScreen.tsx::src/components/Layout::BottomNav',
  'src/features/Challenges/V2ChallengesScreen.tsx::src/components/Layout::BottomNav',
]);

function frozenImportsFor(path) {
  const source = read(path);
  const imports = [...source.matchAll(/import\s+(?:type\s+)?([\s\S]*?)\s+from\s+['\"]([^'\"]+)['\"]/g)];
  return imports.flatMap((match) => {
    const bindings = match[1];
    const importSource = match[2];
    const resolvedSource = importSource.startsWith('.')
      ? relative(rootPath, resolve(rootPath, dirname(path), importSource)).replaceAll('\\', '/')
      : importSource;
    return FROZEN_V1_EXPERIENCE_IMPORTS.flatMap((frozen) => {
      if (!(resolvedSource === frozen.path || resolvedSource.startsWith(`${frozen.path}/`))) return [];
      if (!frozen.named) return [`${path}::${frozen.path}::*`];
      return new RegExp(`\\b${frozen.named}\\b`).test(bindings)
        ? [`${path}::${frozen.path}::${frozen.named}`]
        : [];
    });
  });
}

console.log('V1 Product Experience freeze boundary');

check('freeze declaration exists', exists('docs/architecture/TIIZI-V1-PRODUCT-EXPERIENCE-FREEZE.md'));
if (exists('docs/architecture/TIIZI-V1-PRODUCT-EXPERIENCE-FREEZE.md')) {
  const freeze = read('docs/architecture/TIIZI-V1-PRODUCT-EXPERIENCE-FREEZE.md');
  check('freeze declaration is reference-only', freeze.includes('FROZEN — REFERENCE ONLY'));
  check('freeze declaration preserves governed Product Truth', freeze.includes('V1 product semantics may never override governed V2 Product Truth'));
  check('Experience Reference is acknowledged but not adopted', freeze.includes('IN DEVELOPMENT / NOT YET ADOPTED'));
}

check('V1 routes remain present and untouched', [
  '/app/home', '/app/groups', '/app/create-group', '/app/create-challenge', '/app/profile',
].every((route) => read('src/App.tsx').includes(`path=\"${route}\"`)));

check('neutral Screen primitive remains usable by V2 component preview', read('src/features/Challenges/V2/ChallengeCreationComponentPreview.tsx').includes("from '../../../components/Layout'"));
check('governed V2 API and Composer imports remain usable by Wizard', [
  "from '../../../api/v2ChallengeCreationApi'",
  "from './composerDraft'",
].every((needle) => read('src/features/Challenges/V2/V2CreateChallengeWizard.tsx').includes(needle)));

const actualFrozenImports = new Set(v2ExperienceFiles.flatMap(frozenImportsFor));
const newViolations = [...actualFrozenImports].filter((entry) => !RECORDED_MIXED_BASELINE.has(entry));
const staleBaseline = [...RECORDED_MIXED_BASELINE].filter((entry) => !actualFrozenImports.has(entry));
check('V2 experience imports contain no new frozen V1 dependencies', newViolations.length === 0);
check('recorded mixed baseline is explicit and current', staleBaseline.length === 0);

if (actualFrozenImports.size > 0) {
  console.log('  recorded mixed baseline:');
  [...actualFrozenImports].sort().forEach((entry) => console.log(`    - ${entry}`));
}

if (failures > 0) {
  console.error(`\nV1 Product Experience freeze boundary: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nV1 Product Experience freeze boundary: all passing.');
}
