import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let failures = 0;
const check = (name, condition) => {
  if (condition) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}`); }
};

console.log('PF-05 Challenge Creation component preview guards');

const mode = read('src/api/v2ComponentPreviewMode.ts');
const app = read('src/App.tsx');
const preview = read('src/features/Challenges/V2/ChallengeCreationComponentPreview.tsx');
const wizard = read('src/features/Challenges/V2/V2CreateChallengeWizard.tsx');
const result = read('src/features/Challenges/V2ChallengeDetailScreen.tsx');
const login = read('src/features/Auth/LoginScreen.tsx');
const fixture = read('api/src/previewComponentGroup.ts');
const fixtureCli = read('api/src/previewComponentGroupFixtureCli.ts');
const apiApp = read('api/src/app.ts');
const apiIndex = read('api/src/index.ts');

check('preview route is explicitly development-only', mode.includes('env.DEV === true') && mode.includes('VITE_TIIZI_V2_COMPONENT_PREVIEW'));
check('preview routes are absent unless the local gate is enabled', app.includes('isV2ComponentPreviewEnabled()') && app.includes('/preview/v2/challenge-creation'));
check('component preview has no legacy BottomNav', !preview.includes('BottomNav'));
check('component preview reads verified context instead of Groups UI', preview.includes('/v1/preview/challenge-creation/context') && !preview.includes('GroupsScreen'));
check('verified Group context travels through the existing identity bridge', preview.includes('previewGroupId={context.data.legacyGroupId}'));
check('local login returns to a preview path only when the gate is enabled', login.includes('isV2ComponentPreviewEnabled()') && login.includes("raw.startsWith('/preview/')"));
check('Wizard consumes preview Group context and retains PF-04 source', wizard.includes('previewGroupId') && wizard.includes('createEmptyDraft()'));
check('Wizard retains PF-03 preview and V2 establishment', wizard.includes('previewV2Draft(draft)') && wizard.includes('establishV2Challenge('));
check('all PF-05 stages remain declared', wizard.includes("'TYPE'") && wizard.includes("'BASICS'") && wizard.includes("'ACTIVITIES'") && wizard.includes("'MEASUREMENT'") && wizard.includes("'REQUIREMENT'") && wizard.includes("'SCHEDULE'") && wizard.includes("'RULES'") && wizard.includes("'REVIEW'") && wizard.includes("'FINISH'"));
check('component result has no legacy BottomNav', result.includes('componentPreview') && result.includes('previewReturnPath'));
check('component result cannot render V1 participation or logging exits', result.includes('!componentPreview && activeParticipation') && result.includes('!componentPreview && !participation'));
check('fixture only accepts the isolated demo emulator runtime', fixture.includes('demo-tiizi-pf05-preview') && fixture.includes('Firestore emulator'));
check('fixture invokes governed Group authority and verifies live membership', fixture.includes('createGovernedGroup') && fixture.includes('assertLivePreviewOwnerMembership'));
check('fixture CLI is the only preview Group creation entrypoint', fixtureCli.includes('ensurePreviewComponentGroup'));
check('preview API route is composed only for local runtime', apiApp.includes('previewComponent') && apiIndex.includes('isLocalPreviewComponentRuntime()'));
check('preview context has no write side effect', preview.includes("method: 'GET'") && !preview.includes("method: 'POST'"));

if (failures > 0) {
  console.error(`\nPF-05 component preview guards: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nPF-05 component preview guards: all passing.');
}
