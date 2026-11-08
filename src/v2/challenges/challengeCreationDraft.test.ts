import { describe, expect, it } from 'vitest';
import { assessVisibleStep, createInitialWizardState, toEstablishmentBody } from './challengeCreationDraft';

describe('optional Challenge cover photo', () => {
  it('allows the Name & Appearance step to continue without a catalogue cover', () => {
    const state = { ...createInitialWizardState(), title: 'A local preview Challenge', coverId: null };

    expect(assessVisibleStep(state, 'CHALLENGE_DETAILS')).toMatchObject({ complete: true, missing: [] });
  });

  it('omits an absent catalogue cover from the establishment body', () => {
    const state = {
      ...createInitialWizardState(),
      challengeType: 'streak' as const,
      groupId: 'fictional-group',
      title: 'A local preview Challenge',
      coverId: null,
    };

    expect(toEstablishmentBody(state, { activate: false, joinCreator: false })).not.toHaveProperty('cover_id');
  });
});
