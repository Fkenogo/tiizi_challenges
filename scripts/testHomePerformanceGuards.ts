import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeHook = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');

const forbiddenPatterns = [
  { pattern: /from ['"]firebase\/firestore['"]/, label: 'Home data hook must not import Firestore query helpers directly' },
  { pattern: /groupService/, label: 'Home data hook must not read live groups for dashboard counts' },
  { pattern: /userProfileService/, label: 'Home data hook must not read profile docs for dashboard header' },
  { pattern: /memberActivitySummaryService/, label: 'Home data hook must not read activity summaries as a live fallback' },
  { pattern: /getDocs\s*\(/, label: 'Home data hook must not run collection reads' },
  { pattern: /collection\s*\(/, label: 'Home data hook must not run collection queries directly' },
  { pattern: /documentId\s*\(/, label: 'Home data hook must not backfill missing challenge docs by ID query' },
];

for (const { pattern, label } of forbiddenPatterns) {
  assert.equal(pattern.test(homeHook), false, label);
}

assert.match(homeHook, /memberMetricsService/, 'Home data hook should read memberHome/userMetrics summaries');
assert.match(homeHook, /getChallengesPage/, 'Home trending should use a bounded challenge page query');
assert.match(homeHook, /getActiveChallengesForUser/, 'Home active challenge rail should use a bounded user-scoped service query');

console.log('home performance guards passed');
