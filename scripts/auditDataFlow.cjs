const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();

function read(filePath) {
  return fs.readFileSync(path.join(root, filePath), 'utf8');
}

function includes(filePath, pattern) {
  return read(filePath).includes(pattern);
}

function missing(filePath, pattern) {
  return !read(filePath).includes(pattern);
}

function collectMatches(pattern, folderPath = 'src') {
  const start = path.join(root, folderPath);
  const matches = [];

  function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      if (!/\.(ts|tsx|js|jsx|css|md)$/.test(entry.name)) continue;
      const text = fs.readFileSync(full, 'utf8');
      if (text.includes(pattern)) {
        matches.push(path.relative(root, full));
      }
    }
  }

  walk(start);
  return matches;
}

function runChecks() {
  const checks = [
    {
      name: 'Home uses visibility-safe challenge fetch',
      ok: includes('src/features/Home/useHomeScreen.ts', 'getVisibleChallengesForUser(uid'),
    },
    {
      name: 'Home fetch uses user identity fallback',
      ok: includes('src/features/Home/useHomeScreen.ts', 'getUserIdentity(uid)'),
    },
    {
      name: 'Challenges screen uses visibility-safe challenge fetch',
      ok: includes('src/features/Challenges/ChallengesScreen.tsx', 'getVisibleChallengesForUser(String(user?.uid)'),
    },
    {
      name: 'Browse screen uses visibility-safe challenge fetch',
      ok: includes('src/features/Challenges/BrowseChallengesScreen.tsx', 'getVisibleChallengesForUser(String(user?.uid)'),
    },
    {
      name: 'Select Activity copy is activity-neutral',
      ok: includes('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'Pick an activity to log your progress'),
    },
    {
      name: 'Legacy exercise-only select copy removed',
      ok: collectMatches('Pick an exercise to log your progress').length === 0,
    },
    {
      name: 'Legacy Distance/Time-based fallback removed from select activity',
      ok: missing('src/features/Workouts/SelectChallengeActivityScreen.tsx', 'Distance/Time-based'),
    },
    {
      name: 'Quick Actions uses Log Activity',
      ok: includes('src/features/QuickActions/QuickActionsScreen.tsx', '>Log Activity<'),
    },
    {
      name: 'Wellness log uses scroll/picker select control',
      ok: includes('src/features/Workouts/LogWellnessActivityScreen.tsx', 'aria-label="Wellness value picker"'),
    },
    {
      name: 'Ongoing challenge CTA supports wellness label',
      ok: includes('src/features/Challenges/ChallengesScreen.tsx', "item.isWellness ? 'Log Activity' : 'Log Workout'"),
    },
    {
      name: 'Admin wellness activities route is registered',
      ok: includes('src/App.tsx', '/app/admin/wellness-activities'),
    },
    {
      name: 'Admin sidebar has wellness activities entry',
      ok: includes('src/features/Admin/layout/AdminSidebar.tsx', 'Wellness Activities'),
    },
  ];

  const pass = checks.filter((item) => item.ok).length;
  console.log(`\nData-flow audit summary: ${pass}/${checks.length} checks passed.\n`);
  checks.forEach((item) => {
    console.log(`- [${item.ok ? 'PASS' : 'FAIL'}] ${item.name}`);
  });

  if (pass !== checks.length) {
    process.exit(1);
  }
}

runChecks();
