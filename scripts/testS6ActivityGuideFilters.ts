/**
 * S6 Activity Guide Founder Correction 001 — Fitness / Wellness first-level filter.
 * Behavioural guards over the governed 118-Activity catalogue (the same canonical
 * `kind` + category the member API returns). The server applies search/category/kind
 * as an intersection; `intersect` below states that contract so composition is asserted.
 */
import { readFileSync } from 'node:fs';
import { guideCategories, nextGuideSelection, resolveGuideCategory, type GuideDomain } from '../src/v2/member/activityGuideFilters';

const candidate = JSON.parse(readFileSync(new URL('../docs/programme/working/s6-content/tiizi-118-activity-reconciled-content.json', import.meta.url), 'utf8')) as {
  records: Array<{ activityCode: string; name: string; domain: string; category: string; classification: string | null }>;
};
const items = candidate.records.map((r) => ({
  activityCode: r.activityCode,
  name: r.name,
  kind: (r.domain === 'Wellness' ? 'wellness' : 'fitness') as 'fitness' | 'wellness',
  category: r.category,
  subcategory: r.classification ?? '',
}));

const intersect = (state: { domain: GuideDomain; category: string; search: string }) => items.filter((item) =>
  (!state.domain || item.kind === state.domain)
  && (!state.category || item.category === state.category)
  && (!state.search || `${item.name} ${item.category} ${item.subcategory}`.toLowerCase().includes(state.search.toLowerCase())));

let failed = false;
const check = (name: string, ok: boolean) => { console.log(`${ok ? 'ok' : 'FAIL'}: ${name}`); if (!ok) failed = true; };

const all = guideCategories(items, '');
const fitnessCats = guideCategories(items, 'fitness');
const wellnessCats = guideCategories(items, 'wellness');

check('default exposes the full 118-Activity catalogue and every category', intersect({ domain: '', category: '', search: '' }).length === 118 && all.length === 12);
check('Fitness excludes every Wellness Activity (84)', intersect({ domain: 'fitness', category: '', search: '' }).length === 84 && intersect({ domain: 'fitness', category: '', search: '' }).every((i) => i.kind === 'fitness'));
check('Wellness excludes every Fitness Activity (34)', intersect({ domain: 'wellness', category: '', search: '' }).length === 34 && intersect({ domain: 'wellness', category: '', search: '' }).every((i) => i.kind === 'wellness'));
check('category options narrow to the selected domain', fitnessCats.length < all.length && wellnessCats.length < all.length
  && fitnessCats.every((c) => items.some((i) => i.kind === 'fitness' && i.category === c))
  && wellnessCats.every((c) => items.some((i) => i.kind === 'wellness' && i.category === c))
  && !fitnessCats.includes('Nutrition & Hydration') && !wellnessCats.includes('Strength'));
check('every category belongs to exactly the domain(s) that contain it (union equals all)', [...new Set([...fitnessCats, ...wellnessCats])].sort().join('|') === all.join('|'));

const stale = nextGuideSelection(items, { domain: '', category: 'Strength' }, 'wellness');
check('stale category resets to All categories when switching domain', stale.domain === 'wellness' && stale.category === '');
const kept = nextGuideSelection(items, { domain: '', category: 'Strength' }, 'fitness');
check('a category still valid in the new domain is kept', kept.domain === 'fitness' && kept.category === 'Strength');
const cleared = nextGuideSelection(items, { domain: 'fitness', category: 'Strength' }, 'fitness');
check('pressing the active domain clears it and returns to the full catalogue', cleared.domain === '' && cleared.category === 'Strength');
check('resolveGuideCategory never leaves a category the domain does not offer', resolveGuideCategory('Strength', wellnessCats) === '' && resolveGuideCategory('Sleep & Rest', wellnessCats) === 'Sleep & Rest');
check('a switched domain never yields an empty state from a stale category', intersect({ ...stale, search: '' }).length === 34);

check('search + domain composes (Wellness + "fasting")', intersect({ domain: 'wellness', category: '', search: 'fasting' }).map((i) => i.activityCode).join() === 'WEL-NUT-009');
check('search under the wrong domain finds nothing (Fitness + "fasting")', intersect({ domain: 'fitness', category: '', search: 'fasting' }).length === 0);
check('search + domain + category composes (Wellness + Nutrition & Hydration + "fasting")', intersect({ domain: 'wellness', category: 'Nutrition & Hydration', search: 'fasting' }).map((i) => i.activityCode).join() === 'WEL-NUT-009');
const push = intersect({ domain: 'fitness', category: 'Strength', search: 'push' });
check('Push-Up remains discoverable under Fitness + Strength', push.some((i) => i.activityCode === 'FIT-STR-001') && push.every((i) => i.kind === 'fitness' && i.category === 'Strength'));
check('no-domain search is unchanged (same set as the union of both domains)', intersect({ domain: '', category: '', search: 'fasting' }).length === 1);

// Source-level contract: the screen wires the helper, passes the domain to the existing query,
// and the Knowledge API seam only adds the already-supported `kind` parameter.
const ui = readFileSync(new URL('../src/v2/member/ActivityLibraryScreen.tsx', import.meta.url), 'utf8');
const api = readFileSync(new URL('../src/api/knowledgeApi.ts', import.meta.url), 'utf8');
check('screen results query is keyed and filtered by domain', ui.includes("activeCategory, domain]") && ui.includes('fetchPublishedActivities(search, activeCategory || undefined, domain || undefined)'));
check('API seam adds only the supported kind parameter and keeps canonicalOnly', api.includes("if (kind) query.set('kind', kind)") && api.includes("canonicalOnly: 'true'"));

if (failed) process.exit(1);
