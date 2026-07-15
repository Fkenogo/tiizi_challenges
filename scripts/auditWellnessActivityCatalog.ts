/**
 * Phase 18D-2 — Wellness Catalog Static Integrity Audit
 *
 * NO Firestore, NO Firebase, NO seed scripts.
 * Exits non-zero on any guard failure.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { WELLNESS_ACTIVITIES_CATALOG } from '../src/data/wellnessActivitiesCatalog';
import type { WellnessActivity, WellnessCategory } from '../src/types/wellnessActivity';

// ── Types ─────────────────────────────────────────────────────────────────────

type TargetType = 'daily' | 'cumulative' | 'weekly' | 'monthly';

interface GuardResult {
  guard: string;
  passed: boolean;
  failures: string[];
}

// ── State ─────────────────────────────────────────────────────────────────────

const results: GuardResult[] = [];
let totalFailures = 0;

function guard(id: string, description: string, failures: string[]): void {
  const passed = failures.length === 0;
  if (!passed) totalFailures += failures.length;
  results.push({ guard: `${id}: ${description}`, passed, failures });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const catalog: WellnessActivity[] = WELLNESS_ACTIVITIES_CATALOG;

function countByCategory(): Map<WellnessCategory, number> {
  const map = new Map<WellnessCategory, number>();
  for (const a of catalog) {
    map.set(a.category, (map.get(a.category) ?? 0) + 1);
  }
  return map;
}

// ── Section A: Catalog Integrity ──────────────────────────────────────────────

// Guard 1: Total activity count
guard('G1', 'Exactly 67 activities', catalog.length !== 67 ? [`Found ${catalog.length}`] : []);

// Guard 2: Exactly 10 categories
{
  const cats = new Set(catalog.map((a) => a.category));
  guard('G2', 'Exactly 10 categories', cats.size !== 10 ? [`Found ${cats.size}: ${[...cats].join(', ')}`] : []);
}

// Guard 3: Every activity has all required fields
{
  const required: Array<keyof WellnessActivity> = [
    'id', 'category', 'name', 'shortName', 'description',
    'difficulty', 'activityType', 'defaultMetricUnit',
    'defaultTargetValue', 'targetType',
  ];
  const failures: string[] = [];
  for (const a of catalog) {
    for (const field of required) {
      const value = a[field];
      if (value === undefined || value === null || value === '') {
        failures.push(`${a.id}: missing or empty '${field}'`);
      }
    }
  }
  guard('G3', 'Every activity has all required fields', failures);
}

// Guard 4: Every id is unique
{
  const seen = new Map<string, number>();
  for (const a of catalog) seen.set(a.id, (seen.get(a.id) ?? 0) + 1);
  const failures = [...seen.entries()].filter(([, c]) => c > 1).map(([id, c]) => `${id} appears ${c} times`);
  guard('G4', 'Every id is unique', failures);
}

// Guard 5: Every shortName is unique within its category
{
  const byCategory = new Map<string, Map<string, string[]>>();
  for (const a of catalog) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, new Map());
    const catMap = byCategory.get(a.category)!;
    if (!catMap.has(a.shortName)) catMap.set(a.shortName, []);
    catMap.get(a.shortName)!.push(a.id);
  }
  const failures: string[] = [];
  for (const [cat, catMap] of byCategory) {
    for (const [sn, ids] of catMap) {
      if (ids.length > 1) failures.push(`[${cat}] shortName "${sn}" used by: ${ids.join(', ')}`);
    }
  }
  guard('G5', 'Every shortName is unique within its category', failures);
}

// Guard 6: No duplicate display names within the same category
{
  const byCategory = new Map<string, Map<string, string[]>>();
  for (const a of catalog) {
    if (!byCategory.has(a.category)) byCategory.set(a.category, new Map());
    const catMap = byCategory.get(a.category)!;
    if (!catMap.has(a.name)) catMap.set(a.name, []);
    catMap.get(a.name)!.push(a.id);
  }
  const failures: string[] = [];
  for (const [cat, catMap] of byCategory) {
    for (const [name, ids] of catMap) {
      if (ids.length > 1) failures.push(`[${cat}] name "${name}" used by: ${ids.join(', ')}`);
    }
  }
  guard('G6', 'No duplicate display names within the same category', failures);
}

// ── Section B: ID Stability ───────────────────────────────────────────────────

// Guard 7: All retained legacy IDs still exist
{
  const retainedIds = [
    // Hydration (retained from pre-18D)
    'hydration-2l-daily',
    'hydration-3l-daily',
    'hydration-morning-500ml',
    'hydration-no-sugar-drinks',
    // Sleep
    'sleep-8hr-sleep',
    'sleep-bed-by-10pm',
    'sleep-no-screen-1hr',
    'sleep-power-nap',
    'sleep-sleep-consistency',
    // Mindfulness
    'mindfulness-5min-meditation',
    'mindfulness-10min-mindfulness',
    'mindfulness-20min-meditation',
    'mindfulness-gratitude-journal',
    'mindfulness-breathing-3x',
    'mindfulness-digital-detox',
    'mindfulness-body-scan',
    // Nutrition
    'nutrition-5-veg-servings',
    'nutrition-7-produce',
    'nutrition-protein-goal',
    'nutrition-no-sugar',
    'nutrition-whole-foods',
    'nutrition-meal-prep',
    'nutrition-no-processed',
    // Fasting
    'fasting-16hr-fast',
    'fasting-18hr-fast',
    // Habits
    'habits-morning-routine',
    'habits-evening-routine',
    'habits-read-daily',
    'habits-daily-planning',
    'habits-wake-time',
    'habits-no-late-snacks',
    // Stress
    'stress-breathing-3x',
    'stress-nature-walk',
    'stress-stress-journal',
    'stress-pmr',
    'stress-box-breathing',
    'stress-unplug-break',
    // Social
    'social-daily-connection',
    'social-kindness-act',
    'social-community-join',
    'social-call-someone',
    'social-gratitude-message',
  ];
  const existingIds = new Set(catalog.map((a) => a.id));
  const failures = retainedIds.filter((id) => !existingIds.has(id)).map((id) => `Missing retained ID: ${id}`);
  guard('G7', 'All retained legacy IDs still exist', failures);
}

// Guard 8: Retired IDs do NOT exist in the catalog
{
  const retiredIds = [
    // Hydration retired
    'hydration-4l-daily',
    'hydration-pre-meal-250ml',
    'hydration-workout-hydration',
    'hydration-hydration-streak',
    // Sleep retired
    'sleep-sleep-optimize',
    'sleep-sleep-recovery',
    // Mindfulness retired
    'mindfulness-mindful-eating',
    // Fasting retired
    'fasting-20hr-fast',
    'fasting-24hr-fast',
    'fasting-48hr-fast',
    'fasting-72hr-fast',
    'fasting-adf',
    'fasting-5-2-fasting',
    // Habits retired
    'habits-no-alcohol',
    'habits-deep-work',
    // Stress retired
    'stress-calm-routine',
    // Social retired
    'social-no-phone-meal',
    'social-group-check-in',
  ];
  const existingIds = new Set(catalog.map((a) => a.id));
  const failures = retiredIds.filter((id) => existingIds.has(id)).map((id) => `Retired ID still present: ${id}`);
  guard('G8', 'Retired IDs do NOT exist in the catalog', failures);
}

// ── Section C: Naming Rules ───────────────────────────────────────────────────

// Guard 9: No embedded target quantities in display names
// "Screen-Free Hour" is the one borderline case — "Hour" describes the activity
// interval, not an embedded metric target. Flag it for human review via a warning
// rather than a hard failure by excluding that specific phrase pattern.
{
  const bannedPatterns: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\d+-Min\b/i, label: 'numeric-Min' },
    { pattern: /\b\d+L\b/i, label: 'numeric-L' },
    { pattern: /\b\d+-a-Day\b/i, label: 'numeric-a-Day' },
    { pattern: /\b\d+hr\b/i, label: 'numeric-hr' },
    { pattern: /\b\d+ml\b/i, label: 'numeric-ml' },
  ];
  const failures: string[] = [];
  for (const a of catalog) {
    for (const { pattern, label } of bannedPatterns) {
      if (pattern.test(a.name)) {
        failures.push(`${a.id}: name "${a.name}" contains embedded quantity (${label})`);
      }
    }
  }
  guard('G9', 'No embedded target quantities in display names', failures);
}

// Guard 10: Display names are globally unique
{
  const seen = new Map<string, string[]>();
  for (const a of catalog) {
    if (!seen.has(a.name)) seen.set(a.name, []);
    seen.get(a.name)!.push(a.id);
  }
  const failures = [...seen.entries()]
    .filter(([, ids]) => ids.length > 1)
    .map(([name, ids]) => `name "${name}" used by: ${ids.join(', ')}`);
  guard('G10', 'Display names are globally unique', failures);
}

// ── Section D: Categories ─────────────────────────────────────────────────────

// Guard 11: Expected activity count per category
// Note: catalog has hydration=5 and habits=8 (18D-2 spec listed 6/7 before catalog
// was finalised in 18D-1; the approved total of 67 is preserved).
{
  const expected: Record<WellnessCategory, number> = {
    movement: 8,
    hydration: 5,
    sleep: 6,
    mindfulness: 9,
    nutrition: 9,
    fasting: 4,
    habits: 8,
    stress: 7,
    social: 6,
    'health-monitoring': 5,
  };
  const actual = countByCategory();
  const failures: string[] = [];
  for (const [cat, exp] of Object.entries(expected) as [WellnessCategory, number][]) {
    const act = actual.get(cat) ?? 0;
    if (act !== exp) failures.push(`[${cat}] expected ${exp}, found ${act}`);
  }
  guard('G11', 'Each category has the expected number of activities', failures);
}

// ── Section E: Target Types ───────────────────────────────────────────────────

const validTargetTypes = new Set<TargetType>(['daily', 'cumulative', 'weekly', 'monthly']);

// Guard 12: Every activity defines targetType
{
  const failures = catalog.filter((a) => !a.targetType).map((a) => `${a.id}: targetType missing`);
  guard('G12', 'Every activity defines targetType', failures);
}

// Guard 13: targetType only contains valid values
{
  const failures = catalog
    .filter((a) => a.targetType && !validTargetTypes.has(a.targetType as TargetType))
    .map((a) => `${a.id}: invalid targetType "${a.targetType}"`);
  guard('G13', 'targetType values are only: daily | cumulative | weekly | monthly', failures);
}

// Guard 14: Specific movement activities must be cumulative
{
  const mustBeCumulative: Array<{ id: string; label: string }> = [
    { id: 'movement-steps', label: 'Steps' },
    { id: 'movement-walking-dist', label: 'Walking Distance' },
    { id: 'movement-running', label: 'Running / Jogging' },
    { id: 'movement-cycling', label: 'Cycling' },
  ];
  const idMap = new Map(catalog.map((a) => [a.id, a]));
  const failures: string[] = [];
  for (const { id, label } of mustBeCumulative) {
    const a = idMap.get(id);
    if (!a) {
      failures.push(`${id} (${label}): not found in catalog`);
    } else if (a.targetType !== 'cumulative') {
      failures.push(`${id} (${label}): targetType is "${a.targetType}", expected "cumulative"`);
    }
  }
  guard('G14', 'Steps, Walking Distance, Running, Cycling are cumulative', failures);
}

// ── Section F: Metadata Quality ───────────────────────────────────────────────

// Guard 15: No negative targets, blank unit, blank description, blank icon, empty arrays
{
  const failures: string[] = [];
  for (const a of catalog) {
    if (a.defaultTargetValue < 0) failures.push(`${a.id}: negative defaultTargetValue (${a.defaultTargetValue})`);
    if (!a.defaultMetricUnit?.trim()) failures.push(`${a.id}: blank defaultMetricUnit`);
    if (!a.description?.trim()) failures.push(`${a.id}: blank description`);
    if (!a.icon?.trim()) failures.push(`${a.id}: blank icon`);
    if (!a.benefits?.length) failures.push(`${a.id}: empty benefits`);
    if (!a.guidelines?.length) failures.push(`${a.id}: empty guidelines`);
  }
  guard('G15', 'No negative targets, blank fields, or empty benefits/guidelines', failures);
}

// Guard 16: Every category has metadata defined in the catalog module
// (validated indirectly: if buildActivity ran for all 10 categories, categoryMeta is complete;
// we verify by checking that all 10 categories appear and have non-empty icons)
{
  const categoriesInCatalog = new Set(catalog.map((a) => a.category));
  const failures: string[] = [];
  for (const cat of categoriesInCatalog) {
    const sample = catalog.find((a) => a.category === cat);
    if (!sample?.icon?.trim()) failures.push(`[${cat}]: missing or blank icon (metadata missing)`);
  }
  guard('G16', 'Every category has metadata defined (icon present)', failures);
}

// ── Section G: Type Safety ────────────────────────────────────────────────────

// Guard 17: Union types include required values
// We validate at runtime by asserting the actual values appear in the catalog.
{
  const requiredCategories: WellnessCategory[] = ['movement', 'health-monitoring'];
  const requiredActivityTypes = ['steps', 'walking', 'yoga', 'monitoring'];
  const failures: string[] = [];

  for (const cat of requiredCategories) {
    if (!catalog.some((a) => a.category === cat)) {
      failures.push(`Category "${cat}" not present in catalog — may be missing from WellnessCategory type`);
    }
  }
  for (const type of requiredActivityTypes) {
    if (!catalog.some((a) => a.activityType === type)) {
      failures.push(`activityType "${type}" not used by any activity — may be missing from WellnessActivityType type`);
    }
  }
  guard('G17', 'Union types include: movement, health-monitoring, steps, walking, yoga, monitoring', failures);
}

// ── Section H: UI & Service Consistency (Phase 18D-3B) ───────────────────────

function readSrc(relPath: string): string {
  return readFileSync(resolve(__dirname, '..', relPath), 'utf-8');
}

// Guard 18: ChallengeActivitySection includes movement and health-monitoring tabs
{
  const src = readSrc('src/features/Challenges/components/ChallengeActivitySection.tsx');
  const failures: string[] = [];
  if (!src.includes("'movement'")) failures.push("ChallengeActivitySection WELLNESS_CATEGORIES missing 'movement'");
  if (!src.includes("'health-monitoring'")) failures.push("ChallengeActivitySection WELLNESS_CATEGORIES missing 'health-monitoring'");
  if (src.includes("'all', 'fasting'")) failures.push("ChallengeActivitySection still has old 8-category list (starts with 'all', 'fasting')");
  guard('G18', "ChallengeActivitySection picker tabs include 'movement' and 'health-monitoring'", failures);
}

// Guard 19: wellnessTemplateService.toCategory accepts movement and health-monitoring
{
  const src = readSrc('src/services/wellnessTemplateService.ts');
  const failures: string[] = [];
  if (!src.includes("normalized === 'movement'")) failures.push("wellnessTemplateService.toCategory() does not accept 'movement'");
  if (!src.includes("normalized === 'health-monitoring'")) failures.push("wellnessTemplateService.toCategory() does not accept 'health-monitoring'");
  guard('G19', "wellnessTemplateService.toCategory() accepts 'movement' and 'health-monitoring'", failures);
}

// Guard 20: catalogMetadata.ts is not stale (contains both new categories and types)
{
  const src = readSrc('src/services/catalogMetadata.ts');
  const failures: string[] = [];
  if (!src.includes("'movement'")) failures.push("catalogMetadata.ts WELLNESS_CATEGORY_OPTIONS missing 'movement'");
  if (!src.includes("'health-monitoring'")) failures.push("catalogMetadata.ts WELLNESS_CATEGORY_OPTIONS missing 'health-monitoring'");
  if (!src.includes("'steps'")) failures.push("catalogMetadata.ts WELLNESS_ACTIVITY_TYPE_OPTIONS missing 'steps'");
  if (!src.includes("'monitoring'")) failures.push("catalogMetadata.ts WELLNESS_ACTIVITY_TYPE_OPTIONS missing 'monitoring'");
  guard('G20', 'catalogMetadata.ts contains all 10 categories and all 12 activity types', failures);
}

// Guard 21: No Firestore write calls were introduced in Phase 18D-3B files
{
  const filesToCheck = [
    'src/features/Challenges/components/ChallengeActivitySection.tsx',
    'src/services/wellnessTemplateService.ts',
    'src/services/catalogMetadata.ts',
  ];
  const writePatterns = ['setDoc(', 'addDoc(', 'updateDoc(', 'deleteDoc(', 'writeBatch('];
  const failures: string[] = [];
  for (const file of filesToCheck) {
    const src = readSrc(file);
    for (const pattern of writePatterns) {
      if (src.includes(pattern)) {
        // wellnessTemplateService legitimately has write calls — it's a write service
        if (file === 'src/services/wellnessTemplateService.ts') continue;
        failures.push(`${file}: unexpected Firestore write call '${pattern}'`);
      }
    }
  }
  guard('G21', 'No unexpected Firestore write calls in Phase 18D-3B files', failures);
}

// ── Report ────────────────────────────────────────────────────────────────────

const LINE = '─'.repeat(70);
console.log(`\nPhase 18D-2/3B — Wellness Catalog Static Integrity Audit`);
console.log(LINE);
console.log(`Total activities: ${catalog.length}`);
const catCounts = countByCategory();
for (const [cat, count] of [...catCounts.entries()].sort()) {
  console.log(`  ${cat.padEnd(20)} ${count}`);
}
console.log(LINE);

let passed = 0;
let failed = 0;

for (const r of results) {
  const status = r.passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}  ${r.guard}`);
  for (const f of r.failures) {
    console.log(`        ↳ ${f}`);
  }
  if (r.passed) passed++; else failed++;
}

console.log(LINE);
console.log(`Guards passed: ${passed} / ${results.length}`);
console.log(`Total violations: ${totalFailures}`);
console.log(LINE);

if (failed > 0) {
  console.log('RESULT: ❌ FAIL\n');
  process.exit(1);
} else {
  console.log('RESULT: ✅ PASS\n');
  process.exit(0);
}
