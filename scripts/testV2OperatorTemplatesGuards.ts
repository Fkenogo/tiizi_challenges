/**
 * TIIZI-FER-P5T-2-S2 — read-only Operator Template Library guards
 * (run: npm run test:v2-operator-templates).
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ApiError } from '../src/api/apiError';
import {
  EMPTY_FILTERS,
  MAX_AUTO_EMPTY_PAGES,
  activitySettings,
  classifyLibraryError,
  flattenPages,
  hasActiveFilters,
  pageAdvice,
  templateListQuery,
  typeLabel,
} from '../src/v2/operator/templates/templateLibraryModel';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean) {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}`); }
}
function run(name: string, fn: () => void) {
  try { fn(); console.log(`  ok: ${name}`); } catch (error) { failures += 1; console.error(`  FAIL: ${name}\n    ${(error as Error).message}`); }
}

const library = read('src/v2/operator/templates/OperatorTemplateLibrary.tsx');
const client = read('src/api/operatorTemplatesApi.ts');
const pages = read('src/v2/operator/operatorPages.tsx');
const shell = read('src/v2/operator/OperatorShell.tsx');
const routes = read('src/v2/routes.tsx');
const strip = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

console.log('A. write boundary: draft create/save and server validation only (Slice 4); no publish/revise/retire');
check('API client has exactly the create, conditional-save and validate writes', [...strip(client).matchAll(/method:\s*'(POST|PUT|PATCH|DELETE)'/g)].map((m) => m[1]).sort().join() === 'POST,POST,PUT');
check('API client exports no publish/revise/retire/delete function', !/export (const|async function|function) (publish|revise|retire|delete|remove)/i.test(client));
check('the only validation function is the server call (no client validator export)', [...strip(client).matchAll(/export (?:const|async function|function) (\w*[Vv]alidat\w*)/g)].map((m) => m[1]).join() === 'validateTemplateDraft');
check('API client reaches only the P5T-1 Operator Template endpoints', [...strip(client).matchAll(/\$\{API_PREFIX\}([^`?]*)/g)].every((match) => /^\/operator\/templates(\/|$)/.test(match[1])));
check('the save sends the quoted If-Match revision token', /'If-Match':\s*`"\$\{revisionToken\}"`/.test(client));
check('no publish/revise/retire endpoint is referenced anywhere in the client', !/\/(publish|revisions|retire)\b/.test(strip(client)));
check('the validate endpoint is referenced exactly once', (strip(client).match(/\/validate\b/g) ?? []).length === 1);
check('Library offers no publish/revise/retire/validate controls', !/>\s*(Publish|Revise|Retire|Validate)\b/i.test(strip(library)));
check('Library authoring entry points are shown only to Template authors', /canAuthor \? <Link to="\/v2\/operator\/templates\/new"/.test(library) && /canAuthor && shown\?\.state === 'draft'/.test(library));
check('Library uses react-query reads only (no mutation hooks)', !/useMutation/.test(library));

console.log('B. permissions: authors and Console readers; no dependency on the Console overview');
check('Library does not call the Console overview or import the Console API', !/fetchOperatorOverview|operatorConsoleApi/.test(library + client));
check('Operator shell does not gate its Outlet on the overview request', !/overview\.(isError|isLoading|isPending|error|status)/.test(shell));
check('Templates section renders the Library', /function OperatorTemplates\(\) \{ return <OperatorTemplateLibrary \/>; \}/.test(pages));
check('the stale Firestore "deferred" placeholder is gone', !/challengeTemplates \/ wellnessTemplates/.test(pages));
check('the Library section route is unchanged; the editor and preview add exactly three routes', (routes.match(/path="templates"/g) ?? []).length === 1 && (routes.match(/path="templates\/(new|:templateId\/(edit|preview))"/g) ?? []).length === 3);
run('403 is reported as access denied, not as an empty Library', () => {
  assert.equal(classifyLibraryError(new ApiError(403, 'template_author_required', 'x')).kind, 'denied');
  assert.equal(classifyLibraryError(new ApiError(403, 'operator_console_access_required', 'x')).kind, 'denied');
});
run('401, 404, 503, 5xx and network failures stay distinct', () => {
  assert.equal(classifyLibraryError(new ApiError(401, 'missing_token', 'x')).kind, 'signin');
  assert.equal(classifyLibraryError(new ApiError(404, 'template_not_found', 'x')).kind, 'missing');
  assert.equal(classifyLibraryError(new ApiError(503, 'x', 'x')).kind, 'unavailable');
  assert.equal(classifyLibraryError(new ApiError(500, 'internal_error', 'x')).kind, 'failed');
  assert.equal(classifyLibraryError(new TypeError('Failed to fetch')).kind, 'unavailable');
});
check('a denied state offers no retry that could mask a missing grant', /failure\.kind !== 'denied'/.test(library));

console.log('C. search, filters and cursor pagination');
run('query carries every active filter and the cursor; empty filters are omitted', () => {
  const q = new URLSearchParams(templateListQuery({ q: ' sprint ', type: 'streak', lifecycle: 'published', activity: 'FIT-TST-001', tag: 'Strength' }, 'abc', 25));
  assert.deepEqual([...q.entries()].sort(), [['activity', 'FIT-TST-001'], ['cursor', 'abc'], ['lifecycle', 'published'], ['limit', '25'], ['q', 'sprint'], ['tag', 'Strength'], ['type', 'streak']]);
  const bare = new URLSearchParams(templateListQuery(EMPTY_FILTERS, null, 25));
  assert.deepEqual([...bare.keys()], ['limit']);
});
run('the same filters are re-sent with every page (cursor never replayed against another query)', () => {
  const filters = { ...EMPTY_FILTERS, q: 'run', type: 'competitive' as const };
  const first = new URLSearchParams(templateListQuery(filters, null));
  const next = new URLSearchParams(templateListQuery(filters, 'c2'));
  first.delete('cursor'); next.delete('cursor');
  assert.equal(first.toString(), next.toString());
});
run('filter state is detected', () => {
  assert.equal(hasActiveFilters(EMPTY_FILTERS), false);
  assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, tag: 'Strength' }), true);
  assert.equal(hasActiveFilters({ ...EMPTY_FILTERS, q: '   ' }), false);
});
const page = (n: number, cursor: string | null) => ({ items: Array.from({ length: n }, (_, i) => ({ id: `r${i}` })), nextCursor: cursor });
run('only a null cursor ends the list; there is no fixed catalogue limit', () => {
  assert.equal(pageAdvice([], false), 'done');
  assert.equal(pageAdvice([page(25, 'c1')], false), 'ask');
  assert.equal(pageAdvice([page(25, 'c1')], true), 'wait');
  assert.equal(pageAdvice([page(25, 'c1'), page(25, 'c2'), page(3, null)], false), 'done');
  assert.equal(pageAdvice(Array.from({ length: 500 }, (_, i) => page(25, `c${i}`)), false), 'ask');
});
run('an EMPTY page that carries a cursor is followed automatically, then handed to the reader (P5T-3 shape)', () => {
  assert.equal(pageAdvice([page(0, 'c1')], false), 'advance');
  assert.equal(pageAdvice([page(5, 'c1'), page(0, 'c2')], false), 'advance');
  const stuck = Array.from({ length: MAX_AUTO_EMPTY_PAGES }, (_, i) => page(0, `c${i}`));
  assert.equal(pageAdvice(stuck, false), 'ask');
  assert.equal(pageAdvice([...stuck, page(0, null)], false), 'done');
});
run('pages concatenate in order without duplicating a row across a page boundary', () => {
  const merged = flattenPages([{ items: [{ id: 'a' }, { id: 'b' }], nextCursor: 'x' }, { items: [{ id: 'b' }, { id: 'c' }], nextCursor: null }], (r) => r.id);
  assert.deepEqual(merged.map((r) => r.id), ['a', 'b', 'c']);
});
run('an expired or invalid cursor is a recoverable, distinct state', () => {
  const failure = classifyLibraryError(new ApiError(400, 'invalid_cursor', 'cursor is not valid'));
  assert.equal(failure.kind, 'cursor');
  assert.match(failure.message, /first page/);
});
check('Library resets to page one for an invalid cursor and has no total-count claim',
  /resetQueries/.test(library) && !/\btotal\b/i.test(strip(library).replace(/Template Library/gi, '')));
check('Library follows the cursor through useInfiniteQuery with the active filters in the query key',
  /useInfiniteQuery/.test(library) && /\['operator-templates', 'list', filters\]/.test(library) && /getNextPageParam: \(last\) => last\.nextCursor/.test(library));

check('free-text filters (search and Activity) are debounced', /setActivityInput/.test(library) && /setTimeout\(\(\) => setFilters/.test(library) && !/setFilter\('activity'/.test(library));
check('a paused/offline query cannot fall through to a crash or a blank page', /!detail\.data/.test(library) && /list\.isPending/.test(library) && !/detail\.data as /.test(library));
check('inline retry re-runs the failed request kind (refetch vs next page)', /isFetchNextPageError/.test(library));

run('Activity counting settings are surfaced so versions differing only there never look identical', () => {
  assert.deepEqual(activitySettings({}), []);
  assert.deepEqual(activitySettings({ durationMode: 'CONTINUOUS' }), ['Time counts: All at once']);
  assert.deepEqual(activitySettings({ durationMode: 'ACCUMULATED' }), ['Time counts: Added up across the day']);
  assert.deepEqual(activitySettings({ completionOccurrence: 'one session' }), ['Counts when: one session']);
  assert.deepEqual(activitySettings({ loadBasis: 'PER_SIDE', componentIds: ['A', 'B'] }), ['Weight reported as: Per side', 'Required parts: A, B']);
  assert.deepEqual(activitySettings({ activityVariant: 'incline' }), ['Variant: incline']);
  assert.notDeepEqual(activitySettings({ activityVariant: null }), activitySettings({ activityVariant: 'incline' }));
  // Load-basis wording equals the member Wizard's (real codes), not an invented humanization.
  assert.deepEqual(activitySettings({ loadBasis: 'TOTAL_LOADED_IMPLEMENT' }), ['Weight reported as: Total loaded weight']);
  assert.deepEqual(activitySettings({ loadBasis: 'MACHINE_DISPLAYED_LOAD' }), ['Weight reported as: As shown on the machine']);
  assert.notDeepEqual(activitySettings({ durationMode: 'CONTINUOUS' }), activitySettings({ durationMode: 'ACCUMULATED' }));
});
check('Library renders the Activity settings for every configured Activity', /activitySettings\(activity\)\.map/.test(library));

console.log('D. vocabulary and presentation');
const apiVocab = read('api/src/groupVocabulary.ts');
const apiLabels = [...apiVocab.slice(apiVocab.indexOf('GROUP_FOCUS_AREAS'), apiVocab.indexOf('GROUP_GOALS')).matchAll(/label: '([^']+)'/g)].map((m) => m[1]);
const uiVocab = read('src/v2/groups/groupFocusAreas.ts');
const uiLabels = [...uiVocab.slice(0, uiVocab.indexOf('GROUP_FOCUS_AREA_LABELS')).matchAll(/category: '([^']+)'/g)].map((m) => m[1]);
check('tag filter options equal the governed vocabulary the server validates', apiLabels.length === 12 && JSON.stringify(apiLabels) === JSON.stringify(uiLabels) && library.includes('GROUP_FOCUS_AREA_LABELS'));
check('type labels match the member vocabulary (Together / Race / Streak)', typeLabel('collective') === 'Together' && typeLabel('competitive') === 'Race' && typeLabel('streak') === 'Streak');
check('Operator Library changes touch no member Wizard or Template-member code',
  !/challenges\/|challenge-templates/.test(client + library));

if (failures > 0) { console.error(`\n${failures} operator-template guard failure(s)`); process.exit(1); }
console.log('\noperator-template guards: all passing');
