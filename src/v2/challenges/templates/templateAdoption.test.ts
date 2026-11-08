import { describe, expect, it } from 'vitest';
import { templateToWizardState } from './templateAdoption';

describe('member Template prefill', () => {
  it('prefills the existing wizard while leaving its hosting Group unselected', () => {
    const template = {
      templateId: 'founder-push-up', version: 1, title: '30-Day Push-Up Together Challenge',
      summary: 'A shared Push-Up goal.', description: 'Add Push-Ups to the Group total.',
      challengeType: 'collective', durationDays: 30, durationPresetDays: [14, 30],
      coverId: 'challenge-5', focusTags: ['Strength'], publishedAt: null, adoptable: true, unavailableReason: null,
      composer: {
        draftKind: 'pf04-v1', mode: 'CHALLENGE', challengeType: 'collective',
        activities: [{ activity: '11111111-1111-4111-8111-111111111111', observedVersion: 1, kind: 'fitness', metric: 'repetitions', unit: 'reps', targetValue: 3000, position: 0 }],
      },
    } as any;
    const resolved = {
      '11111111-1111-4111-8111-111111111111': {
        item: { id: '11111111-1111-4111-8111-111111111111', activityCode: 'FIT-STR-001', name: 'Push-Up', kind: 'fitness', category: 'Strength', subcategory: 'Push', imageUrl: '' },
        options: { knowledgeId: '11111111-1111-4111-8111-111111111111', activityCode: 'FIT-STR-001', kind: 'fitness', currentVersion: 1, primaryMetrics: ['repetitions'], secondaryMetrics: [], compatibleUnits: ['reps'], components: [], supportedLoadBases: [], unitsByMetric: { repetitions: ['reps'] } },
      },
    } as any;
    const state = templateToWizardState(template, resolved, new Date('2026-11-08T12:00:00Z'));
    expect(state).toMatchObject({
      challengeType: 'collective', groupId: null, title: '30-Day Push-Up Together Challenge',
      description: 'Add Push-Ups to the Group total.', coverId: 'challenge-5', durationDays: 30,
      activities: [{ activityCode: 'FIT-STR-001', metric: 'repetitions', unit: 'reps', targetValue: '3000' }],
      templateRef: { templateId: 'founder-push-up', version: 1, title: '30-Day Push-Up Together Challenge' },
    });
  });
});
