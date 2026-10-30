/**
 * TIIZI-FER-P5T-2-S1 — the reusable steps must work from their NARROW state
 * contracts alone (what a later TEMPLATE_AUTHORING composition will hold), and
 * must render exactly what the member Wizard renders for the same fields.
 */
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { StepChallengeDetails, StepHowItWorks, StepWhatCounts } from '../src/v2/challenges/V2ChallengeCreationWizard';
import {
  ChallengeTypeStep,
  NameAppearanceFields,
  PreviewStatus,
  WhatCountsExplanation,
  WhatCountsStep,
  type ActivitiesStepState,
  type NameAppearanceState,
  type WhatCountsStepState,
} from '../src/v2/challenges/wizardSteps';
import { STATES } from './wizardStepSnapshots';

const NOOP = () => undefined;
const html = (element: ReactElement) => renderToStaticMarkup(
  <MemoryRouter><QueryClientProvider client={new QueryClient()}>{element}</QueryClientProvider></MemoryRouter>,
);

// Compile-time proof (checked by tsc over scripts/): the narrow contracts carry NO
// hosting, schedule, Social Cause, Support or creatorJoins field.
const templateShapedNames: NameAppearanceState = { title: 'T', description: '', coverId: null };
const templateShapedActivities: ActivitiesStepState = { challengeType: 'streak', activities: [] };
const templateShapedCounts: WhatCountsStepState = { challengeType: 'competitive', activities: STATES.race.activities };
// @ts-expect-error member-only fields are not part of the narrow contract
const leak: NameAppearanceState = { title: '', description: '', coverId: null, groupId: 'x' };
void [templateShapedNames, templateShapedActivities, leak];

export function narrowChecks(): string[] {
  const failures: string[] = [];
  const expect = (name: string, ok: boolean) => { if (!ok) failures.push(name); };

  for (const name of ['together', 'race', 'streak'] as const) {
    const state = STATES[name];
    const narrow: WhatCountsStepState = { challengeType: state.challengeType, activities: state.activities };
    expect(`${name}: WhatCountsStep(narrow) === member StepWhatCounts`,
      html(<WhatCountsStep state={narrow} onUpdateActivity={NOOP} onRemove={NOOP} />)
      === html(<StepWhatCounts state={state} onUpdateActivity={NOOP} onRemove={NOOP} />));

    const names: NameAppearanceState = { title: state.title, description: state.description, coverId: state.coverId };
    const member = html(<StepChallengeDetails state={state} onUpdate={NOOP} />);
    const fields = html(<div className="space-y-4"><NameAppearanceFields state={names} onUpdate={NOOP} intro={<p className="text-sm leading-6 text-slate-600">Give the Challenge a clear name and a short description for your Group.</p>} /></div>);
    expect(`${name}: NameAppearanceFields markup is the prefix of the member details step`,
      member.startsWith(fields.replace(/<\/div>$/, '')));
    expect(`${name}: NameAppearanceFields carries no support or Cause controls`,
      !/Support a Cause|Support Tiizi|Cause title/.test(fields));
  }

  const footerless = html(<ChallengeTypeStep selected="streak" onSelect={NOOP} />);
  expect('ChallengeTypeStep carries no composition copy of its own', !footerless.includes('Templates are not available yet'));
  expect('member type step = reusable step + member footer',
    html(<StepHowItWorks selected="streak" onSelect={NOOP} />)
    === footerless.replace(/<\/div>$/, '<p class="text-xs text-slate-500">Templates are not available yet — you are setting this Challenge up from scratch.</p></div>'));

  expect('WhatCountsExplanation renders the type-specific lines',
    html(<WhatCountsExplanation challengeType="collective" />) !== html(<WhatCountsExplanation challengeType="streak" />));
  const generic = html(<PreviewStatus<'A' | 'B'> state="invalid" issues={[{ code: 'x', friendly: 'Fix it', step: 'B' }]} onEditStep={NOOP} />);
  expect('PreviewStatus works with a non-member step vocabulary', generic.includes('Fix it') && generic.includes('Go to step'));
  return failures;
}
