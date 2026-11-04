import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ui = read('src/v2/member/ActivityLibraryScreen.tsx');
const routes = read('src/v2/routes.tsx');
const nav = read('src/v2/member/MemberShell.tsx');
const profile = read('src/v2/profile/V2ProfileScreen.tsx');
const wizard = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');
const activitiesStep = read('src/v2/challenges/wizardSteps/ActivitiesStep.tsx');
const knowledgeApi = read('src/api/knowledgeApi.ts');
const api = read('api/src/knowledge.ts');
const resultComponent = ui.split('function ActivityCard(')[1]?.split('function displayText(')[0] ?? '';
const thumbnail = read('src/v2/components/ActivityThumbnail.tsx');
const checks = [
  ['member browse uses the authenticated Knowledge API', ui.includes('fetchPublishedActivities') && knowledgeApi.includes('apiFetch<KnowledgeListResponse>') && knowledgeApi.includes('API_PREFIX') && knowledgeApi.includes('${API_PREFIX}/knowledge?')],
  ['Library list uses the canonical-only filter', knowledgeApi.includes("canonicalOnly: 'true'") && api.includes('query.canonicalOnly === true')],
  ['search and governed category filtering are exposed', knowledgeApi.includes('query.set(\'search\'') && knowledgeApi.includes('query.set(\'category\'') && api.includes('subcategory ILIKE')],
  ['member detail renders only Published coded V2 identities', ui.includes("item.lifecycle === 'published'") && ui.includes('ACTIVITY_CODE.test(item.activityCode)')],
  ['optional detail sections are suppressed when empty', ui.includes('if (!show) return null')],
  ['Challenge action checks the composer-selectable server projection', ui.includes('fetchComposerSelectableKnowledge') && ui.includes('composerSelectable ?')],
  ['handoff supplies canonical UUID and immutable Activity Code', ui.includes('activityId: item.id, activityCode: item.activityCode') && activitiesStep.includes('candidate.activityCode === preselectedIdentity')],
  ['Composer options still flow through the existing PF-04/PF-03 wizard', wizard.includes('fetchActivityOptions(item.id)') && wizard.includes('previewChallengeDefinition(toComposerDraft(state))')],
  ['Library and detail are V2 member routes', routes.includes('path="guide" element={<V2ActivityLibraryScreen />') && routes.includes('path="guide/:activityId"')],
  ['Activity Guide remains reachable from the member Profile (Help & guide); the avatar opens Profile', profile.includes("navigate('/v2/guide')") && profile.includes('Activity Guide') && nav.includes("navigate('/v2/profile')")],
  ['Library UI has no direct Firestore or V1 catalogue dependency', !/firestore|features\/(Exercises|Wellness)/i.test(ui)],
  ['loading, error, and empty states are present', ui.includes('V2LoadingState') && ui.includes('V2ErrorState') && ui.includes('V2EmptyState')],
  ['catalogue uses a compact single-column result list', ui.includes('aria-label="Activity results"') && !/grid-cols-(?:2|3)/.test(ui.split('aria-label="Activity results"')[1] ?? '')],
  ['catalogue results omit authored guide prose', !resultComponent.includes('item.description') && !resultComponent.includes('View activity guide')],
  ['compact result shows governed identity context and optional image only', resultComponent.includes('item.kind') && resultComponent.includes('item.category') && resultComponent.includes('item.subcategory') && resultComponent.includes('ActivityThumbnail') && resultComponent.includes('item.id')],
  ['result image uses the optional Knowledge image reference and a neutral fallback', thumbnail.includes('imageUrl?: string | null') && thumbnail.includes('loading="lazy"') && thumbnail.includes('if (!imageUrl || failed)') && !/firebase.storage|imageUploadService/i.test(thumbnail)],
  ['Category (Fitness / Wellness) and Subcategory are compact dropdowns placed under search', ui.indexOf('Search activities') < ui.indexOf('id="category"') && ui.indexOf('id="category"') < ui.indexOf('id="subcategory"') && ui.includes("{ value: 'fitness', label: 'Fitness', tone: 'orange' }") && ui.includes("{ value: 'wellness', label: 'Wellness', tone: 'green' }") && ui.includes('V2FilterDropdown')],
  ['domain and category selection use the canonical kind and governed category, not new taxonomy', ui.includes('activityGuideFilters') && !/new (?:domain|category) taxonomy/i.test(ui)],
  ['the horizontally scrolling category rail is gone', !ui.includes('aria-label="Activity categories"') && !ui.includes('overflow-x-auto')],
  ['member canvas stays mobile-only (no widened Guide or desktop layout)', ui.includes('<V2Page wide>') && !/md:|lg:|xl:/.test(ui.split('function ActivityCard(')[0])],
];
let failed = false;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'ok' : 'FAIL'}: ${name}`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
