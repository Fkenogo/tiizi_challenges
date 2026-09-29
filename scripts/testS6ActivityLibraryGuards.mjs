import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const ui = read('src/v2/member/ActivityLibraryScreen.tsx');
const routes = read('src/v2/routes.tsx');
const nav = read('src/v2/member/MemberShell.tsx');
const wizard = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');
const knowledgeApi = read('src/api/knowledgeApi.ts');
const api = read('api/src/knowledge.ts');
const checks = [
  ['member browse uses the authenticated Knowledge API', ui.includes('fetchPublishedActivities') && knowledgeApi.includes('apiFetch<KnowledgeListResponse>') && knowledgeApi.includes('/v1/knowledge?')],
  ['Library list uses the canonical-only filter', knowledgeApi.includes("canonicalOnly: 'true'") && api.includes('query.canonicalOnly === true')],
  ['search and governed category filtering are exposed', knowledgeApi.includes('query.set(\'search\'') && knowledgeApi.includes('query.set(\'category\'') && api.includes('subcategory ILIKE')],
  ['member detail renders only Published coded V2 identities', ui.includes("item.lifecycle === 'published'") && ui.includes('ACTIVITY_CODE.test(item.activityCode)')],
  ['optional detail sections are suppressed when empty', ui.includes('if (!show) return null')],
  ['Challenge action checks the composer-selectable server projection', ui.includes('fetchComposerSelectableKnowledge') && ui.includes('composerSelectable ?')],
  ['handoff supplies canonical UUID and immutable Activity Code', ui.includes('activityId: item.id, activityCode: item.activityCode') && wizard.includes('candidate.activityCode === preselectedIdentity')],
  ['Composer options still flow through the existing PF-04/PF-03 wizard', wizard.includes('fetchActivityOptions(item.id)') && wizard.includes('previewChallengeDefinition(toComposerDraft(state))')],
  ['Library and detail are V2 member routes', routes.includes('path="guide" element={<V2ActivityLibraryScreen />') && routes.includes('path="guide/:activityId"')],
  ['Activity Guide remains in secondary mobile navigation', nav.includes("{ to: '/v2/guide', key: 'guide'") && nav.includes('grid-cols-3')],
  ['Library UI has no direct Firestore or V1 catalogue dependency', !/firestore|features\/(Exercises|Wellness)/i.test(ui)],
  ['loading, error, and empty states are present', ui.includes('V2LoadingState') && ui.includes('V2ErrorState') && ui.includes('V2EmptyState')],
];
let failed = false;
for (const [name, passed] of checks) {
  console.log(`${passed ? 'ok' : 'FAIL'}: ${name}`);
  if (!passed) failed = true;
}
if (failed) process.exit(1);
