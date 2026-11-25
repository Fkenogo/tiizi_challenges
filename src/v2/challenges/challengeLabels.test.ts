import { describe, expect, it } from 'vitest';
import { challengeTypeLabel, statusLabel } from './challengeCreationDraft';
import { statusLabelForEndState } from './challengeEndState';

describe('Challenge type, activity, and lifecycle status separation', () => {
  it('separates Challenge type, activity name, and Active lifecycle status for Push-Up Race, Plank Race, Running Race, and Breathing Streak', () => {
    const cases = [
      { type: 'competitive' as const, expectedType: 'Race', activity: 'Push-Up', status: 'active' },
      { type: 'competitive' as const, expectedType: 'Race', activity: 'Plank', status: 'active' },
      { type: 'competitive' as const, expectedType: 'Race', activity: 'Running', status: 'active' },
      { type: 'streak' as const, expectedType: 'Streak', activity: 'Breathing Practice', status: 'active' },
    ];

    for (const c of cases) {
      expect(challengeTypeLabel(c.type)).toBe(c.expectedType);
      expect(statusLabel(c.status)).toBe('Active');
      expect(statusLabelForEndState(c.status, 'live')).toBe('Active');
      expect(statusLabelForEndState(c.status, 'ended-pending')).toBe('Finished');
      expect(c.activity).toBe(c.activity);
    }

    expect(statusLabel('establishment')).toBe('Getting ready');
    expect(statusLabel('ended')).toBe('Finished');
  });
});
