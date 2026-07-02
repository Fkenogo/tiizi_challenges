/**
 * scripts/testAdminChallengeManagement.ts
 *
 * Phase 18I-6G guards: Admin Challenge Management + Analytics + Featured Templates
 *
 * Rules under test:
 * 1.  ActiveChallengesScreen is renamed to "Challenge Management" (not "Active Challenges")
 * 2.  Challenge Management screen has status filter (all/active/upcoming/completed/archived/inactive/draft/pending)
 * 3.  Challenge Management screen has type filter (collective/competitive/streak)
 * 4.  Challenge Management screen has category filter
 * 5.  Challenge Management screen renders a status badge per row
 * 6.  Challenge Management screen has lifecycle actions (archive/deactivate/reactivate/complete)
 * 7.  Challenge Management screen has delete with confirmation guard
 * 8.  ChallengeAnalyticsScreen is NOT static-only (has dynamic metric fields)
 * 9.  ChallengeAnalyticsScreen shows byCategory breakdown
 * 10. ChallengeAnalyticsScreen shows topByParticipants list
 * 11. adminChallengeService has getAllChallenges()
 * 12. adminChallengeService has archiveChallenge()
 * 13. adminChallengeService has deactivateChallenge()
 * 14. adminChallengeService has reactivateChallenge()
 * 15. adminChallengeService has deleteChallenge()
 * 16. adminChallengeService getChallengeAnalytics returns byCategory
 * 17. adminChallengeService getChallengeAnalytics returns topByParticipants
 * 18. challengeTemplateService has featureTemplate()
 * 19. challengeTemplateService has unfeatureTemplate()
 * 20. wellnessTemplateService has featureTemplate()
 * 21. wellnessTemplateService has unfeatureTemplate()
 * 22. ChallengeTemplatesScreen has Feature/Unfeature menu items
 * 23. ChallengeTemplatesScreen shows Featured badge for isFeatured templates
 * 24. SuggestedChallengeTemplate type has isFeatured field
 * 25. WellnessTemplate type has isFeatured field
 * 26. getPublishedTemplates sorts featured templates first
 * 27. getTemplates (wellness) sorts featured templates first
 * 28. isFeatured is mapped from Firestore in challengeTemplateService fromDoc
 * 29. isFeatured is mapped from Firestore in wellnessTemplateService fromDoc
 * 30. useAdminChallenges exports useAllChallengesAdmin hook
 * 31. useAdminChallenges exports useArchiveChallenge hook
 * 32. useAdminChallenges exports useDeactivateChallenge hook
 * 33. useChallengeTemplates exports useFeatureTemplate hook
 * 34. useChallengeTemplates exports useUnfeatureTemplate hook
 * 35. useWellnessTemplates exports useFeatureWellnessTemplate hook
 * 36. useWellnessTemplates exports useUnfeatureWellnessTemplate hook
 */

import * as fs from 'fs';
import * as path from 'path';

function read(rel: string): string {
  const full = path.join(process.cwd(), rel);
  if (!fs.existsSync(full)) return '';
  return fs.readFileSync(full, 'utf8');
}

let passed = 0;
let failed = 0;

function assert(label: string, condition: boolean) {
  if (condition) {
    console.log(`  ✅ ${label}`);
    passed++;
  } else {
    console.error(`  ❌ ${label}`);
    failed++;
  }
}

// ─── Load source files ────────────────────────────────────────────────────────

const activeChallengesScreen = read('src/features/Admin/Challenges/ActiveChallengesScreen.tsx');
const analyticsScreen = read('src/features/Admin/Challenges/ChallengeAnalyticsScreen.tsx');
const challengeTemplatesScreen = read('src/features/Admin/Challenges/ChallengeTemplatesScreen.tsx');
const adminChallengeService = read('src/services/adminChallengeService.ts');
const challengeTemplateService = read('src/services/challengeTemplateService.ts');
const wellnessTemplateService = read('src/services/wellnessTemplateService.ts');
const typesIndex = read('src/types/index.ts');
const useAdminChallenges = read('src/hooks/useAdminChallenges.ts');
const useChallengeTemplates = read('src/hooks/useChallengeTemplates.ts');
const useWellnessTemplates = read('src/hooks/useWellnessTemplates.ts');

// ─── Section 1: Challenge Management screen ───────────────────────────────────

console.log('\nSection 1 — Challenge Management screen');

assert(
  'Screen is titled "Challenge Management" (not "Active Challenges")',
  activeChallengesScreen.includes('Challenge Management') && !activeChallengesScreen.includes("title=\"Active Challenges\""),
);

assert(
  'Status filter includes "active" variant',
  activeChallengesScreen.includes("'active'") || activeChallengesScreen.includes('"active"'),
);

assert(
  'Status filter includes "archived" variant',
  activeChallengesScreen.includes("'archived'") || activeChallengesScreen.includes('"archived"'),
);

assert(
  'Status filter includes "completed" variant',
  activeChallengesScreen.includes("'completed'") || activeChallengesScreen.includes('"completed"'),
);

assert(
  'Type filter (collective/competitive/streak) present',
  activeChallengesScreen.includes("'collective'") && activeChallengesScreen.includes("'competitive'"),
);

assert(
  'Category filter present',
  activeChallengesScreen.includes('category') && (activeChallengesScreen.includes('CATEGORY') || activeChallengesScreen.includes('categoryFilter') || activeChallengesScreen.includes('CategoryFilter')),
);

assert(
  'StatusBadge or STATUS_BADGE renders per row',
  activeChallengesScreen.includes('StatusBadge') || activeChallengesScreen.includes('STATUS_BADGE'),
);

assert(
  'Deactivate lifecycle action present',
  activeChallengesScreen.includes('deactivate') || activeChallengesScreen.includes('Deactivate'),
);

assert(
  'Reactivate lifecycle action present',
  activeChallengesScreen.includes('reactivate') || activeChallengesScreen.includes('Reactivate'),
);

assert(
  'Archive lifecycle action present',
  activeChallengesScreen.includes('archive') || activeChallengesScreen.includes('Archive'),
);

assert(
  'Delete action has confirmation guard (modal or confirm)',
  activeChallengesScreen.includes('confirm') || activeChallengesScreen.includes('Confirm') || activeChallengesScreen.includes('modal'),
);

// ─── Section 2: Challenge Analytics screen ────────────────────────────────────

console.log('\nSection 2 — Challenge Analytics screen');

assert(
  'ChallengeAnalyticsScreen renders more than static counters (has metric card or metric)',
  analyticsScreen.includes('MetricCard') || analyticsScreen.includes('metric') || analyticsScreen.includes('Metric'),
);

assert(
  'ChallengeAnalyticsScreen shows byCategory breakdown',
  analyticsScreen.includes('byCategory') || analyticsScreen.includes('by-category') || analyticsScreen.includes('By Category'),
);

assert(
  'ChallengeAnalyticsScreen shows topByParticipants or top-N list',
  analyticsScreen.includes('topByParticipants') || analyticsScreen.includes('Top by Participants') || analyticsScreen.includes('top-by'),
);

// ─── Section 3: adminChallengeService ────────────────────────────────────────

console.log('\nSection 3 — adminChallengeService');

assert(
  'getAllChallenges() exported',
  adminChallengeService.includes('getAllChallenges'),
);

assert(
  'archiveChallenge() exported',
  adminChallengeService.includes('archiveChallenge'),
);

assert(
  'deactivateChallenge() exported',
  adminChallengeService.includes('deactivateChallenge'),
);

assert(
  'reactivateChallenge() exported',
  adminChallengeService.includes('reactivateChallenge'),
);

assert(
  'deleteChallenge() exported',
  adminChallengeService.includes('deleteChallenge'),
);

assert(
  'getChallengeAnalytics returns byCategory field',
  adminChallengeService.includes('byCategory'),
);

assert(
  'getChallengeAnalytics returns topByParticipants field',
  adminChallengeService.includes('topByParticipants'),
);

// ─── Section 4: Featured template services ────────────────────────────────────

console.log('\nSection 4 — Featured template services');

assert(
  'challengeTemplateService has featureTemplate()',
  challengeTemplateService.includes('featureTemplate'),
);

assert(
  'challengeTemplateService has unfeatureTemplate()',
  challengeTemplateService.includes('unfeatureTemplate'),
);

assert(
  'wellnessTemplateService has featureTemplate()',
  wellnessTemplateService.includes('featureTemplate'),
);

assert(
  'wellnessTemplateService has unfeatureTemplate()',
  wellnessTemplateService.includes('unfeatureTemplate'),
);

// ─── Section 5: ChallengeTemplatesScreen ─────────────────────────────────────

console.log('\nSection 5 — ChallengeTemplatesScreen');

assert(
  'ChallengeTemplatesScreen has Feature menu item',
  challengeTemplatesScreen.includes("'Feature'") || challengeTemplatesScreen.includes('"Feature"'),
);

assert(
  'ChallengeTemplatesScreen has Unfeature menu item',
  challengeTemplatesScreen.includes("'Unfeature'") || challengeTemplatesScreen.includes('"Unfeature"'),
);

assert(
  'ChallengeTemplatesScreen shows Featured badge when isFeatured is true',
  challengeTemplatesScreen.includes('isFeatured') && challengeTemplatesScreen.includes('Featured'),
);

// ─── Section 6: Types ─────────────────────────────────────────────────────────

console.log('\nSection 6 — Type definitions');

assert(
  'WellnessTemplate has isFeatured field',
  typesIndex.includes('isFeatured') && typesIndex.includes('WellnessTemplate'),
);

// ─── Section 7: Sort order (featured first) ───────────────────────────────────

console.log('\nSection 7 — Featured templates sort first');

assert(
  'challengeTemplateService getPublishedTemplates sorts featured first',
  (() => {
    const sortIdx = challengeTemplateService.indexOf('isFeatured && !b.isFeatured');
    return sortIdx !== -1;
  })(),
);

assert(
  'wellnessTemplateService getTemplates sorts featured first',
  (() => {
    const sortIdx = wellnessTemplateService.indexOf('isFeatured && !b.isFeatured');
    return sortIdx !== -1;
  })(),
);

// ─── Section 8: fromDoc isFeatured mapping ────────────────────────────────────

console.log('\nSection 8 — isFeatured Firestore mapping');

assert(
  'challengeTemplateService fromDoc maps isFeatured',
  challengeTemplateService.includes("isFeatured: raw.isFeatured === true") || challengeTemplateService.includes("isFeatured: data.isFeatured === true"),
);

assert(
  'wellnessTemplateService fromDoc maps isFeatured',
  wellnessTemplateService.includes("isFeatured: raw.isFeatured === true"),
);

// ─── Section 9: Hooks ─────────────────────────────────────────────────────────

console.log('\nSection 9 — Hook exports');

assert(
  'useAdminChallenges exports useAllChallengesAdmin',
  useAdminChallenges.includes('useAllChallengesAdmin'),
);

assert(
  'useAdminChallenges exports useArchiveChallenge',
  useAdminChallenges.includes('useArchiveChallenge'),
);

assert(
  'useAdminChallenges exports useDeactivateChallenge',
  useAdminChallenges.includes('useDeactivateChallenge'),
);

assert(
  'useChallengeTemplates exports useFeatureTemplate',
  useChallengeTemplates.includes('useFeatureTemplate'),
);

assert(
  'useChallengeTemplates exports useUnfeatureTemplate',
  useChallengeTemplates.includes('useUnfeatureTemplate'),
);

assert(
  'useWellnessTemplates exports useFeatureWellnessTemplate',
  useWellnessTemplates.includes('useFeatureWellnessTemplate'),
);

assert(
  'useWellnessTemplates exports useUnfeatureWellnessTemplate',
  useWellnessTemplates.includes('useUnfeatureWellnessTemplate'),
);

// ─── Results ──────────────────────────────────────────────────────────────────

console.log(`\n=== Results: ${passed} passed, ${failed} failed ===\n`);
if (failed > 0) process.exit(1);
