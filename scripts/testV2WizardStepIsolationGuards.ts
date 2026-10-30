/**
 * TIIZI-FER-P5T-2-S1 — extracted Wizard steps stay reusable and member-only
 * concerns stay in the member Wizard (run: npm run test:v2-wizard-steps).
 */
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean) {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}`); }
}

const dir = 'src/v2/challenges/wizardSteps';
const files = readdirSync(join(root, dir)).filter((file) => /\.(ts|tsx)$/.test(file));
const sources = files.map((file) => ({ file, text: read(`${dir}/${file}`) }));
// Code only: doc comments may name the member-only fields they exclude.
const stripComments = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
const all = sources.map((entry) => stripComments(entry.text)).join('\n');
const wizard = read('src/v2/challenges/V2ChallengeCreationWizard.tsx');

console.log('A. member-only concerns are absent from the reusable steps');
const memberOnly: Array<[string, RegExp]> = [
  ['hosting Group (groupId/groupName/memberships)', /groupId|groupName|useV2Memberships|ApiMembership|allowMemberChallenges/],
  ['scheduling (dates, duration, timezone, schedule mode)', /startDate|endDate|scheduleMode|durationDays|DURATION_OPTIONS|timezoneLabel|deriveEndDate/],
  ['Social Cause', /socialCause|Support a Cause|Cause title/],
  ['Support Tiizi', /supportTiizi|Support Tiizi/],
  ['creator participation', /creatorJoins|CreatorParticipation/],
  ['establishment and preview authority', /toEstablishmentBody|previewChallengeDefinition|useEstablishChallenge|establishChallenge|createEstablishmentKey|toComposerDraft/],
  ['draft session / Guide round-trip storage', /challengeDraftSession|saveChallengeDraft|markChallengeGuideJourney|createChallengeWizardRouteState/],
  ['member-flow copy', /Templates are not available yet|Choose the Group that will host/],
];
for (const [label, pattern] of memberOnly) check(`reusable steps carry no ${label}`, !pattern.test(all));
check('reusable steps contain no network calls of their own', !/\bfetch\(|apiFetch|useMutation/.test(all));

console.log('B. narrow state contracts');
const states = read(`${dir}/stepStates.ts`);
check("NameAppearanceState = Pick<'title'|'description'|'coverId'>", /NameAppearanceState = Pick<WizardState, 'title' \| 'description' \| 'coverId'>/.test(states));
check("ActivitiesStepState = Pick<'challengeType'|'activities'>", /ActivitiesStepState = Pick<WizardState, 'challengeType' \| 'activities'>/.test(states));
check("WhatCountsStepState = Pick<'challengeType'|'activities'>", /WhatCountsStepState = Pick<WizardState, 'challengeType' \| 'activities'>/.test(states));
const stepSources = sources.filter((entry) => /Step\.tsx$|Fields\.tsx$/.test(entry.file));
check('no reusable step takes the whole WizardState', stepSources.every((entry) => !/state: WizardState\b/.test(entry.text)));

console.log('C. the member Wizard stays the composition authority');
check('member Wizard composes every extracted step',
  ['ChallengeTypeStep', 'NameAppearanceFields', 'ActivitiesStep', 'WhatCountsStep', 'ReviewCard', 'PreviewStatus', 'WhatCountsExplanation']
    .every((name) => wizard.includes(`<${name}`) ));
check("member-only steps stay in the member Wizard",
  ['function StepHosting', 'function StepSchedule', 'function CreatorParticipation', 'function StepReview', 'Support a Cause', 'Support Tiizi', 'socialCauseEnabled']
    .every((needle) => wizard.includes(needle)));
check('the Guide round-trip state is still built by the member wrapper',
  wizard.includes('guideLinkState={createChallengeWizardRouteState(state, stepIndex, { fromChallengeDraft: true })}'));
check('establishment and preview still run only from the member Wizard',
  wizard.includes('toEstablishmentBody(') && wizard.includes('previewChallengeDefinition('));
check('one validation authority: reusable steps never call the preview seam', !/previewChallengeDefinition|validateChallengeDefinition/.test(all));

if (failures > 0) { console.error(`\n${failures} wizard-step guard failure(s)`); process.exit(1); }
console.log('\nwizard-step guards: all passing');
