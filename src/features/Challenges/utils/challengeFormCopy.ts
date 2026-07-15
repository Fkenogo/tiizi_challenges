import type { ChallengeType, TemplateMode } from './challengeFormDefaults';

export const CHALLENGE_TYPE_DESCRIPTIONS: Record<ChallengeType, string> = {
  collective:
    'Everyone contributes to a shared group target. The challenge completes when the group reaches the total.',
  competitive:
    'Members compete individually. Each person tracks their own cumulative progress toward a personal target.',
  streak:
    'Members must log activity on consecutive days. Completing the required streak wins the challenge.',
};

export const MODE_DESCRIPTIONS: Record<TemplateMode, string> = {
  fitness: 'Track workouts and physical activities — strength, cardio, sports, and more.',
  wellness: 'Track wellness habits — mindfulness, nutrition, sleep, hydration, and more.',
};

// Stored in the challenge/template donation payload (no "require review" suffix).
export const DONATION_PAYLOAD_DISCLAIMER =
  'Tiizi does not hold or manage funds. Contributions are coordinated by the group.';

// Displayed in the donation form UI (includes review requirement note).
export const DONATION_FULL_DISCLAIMER =
  'Tiizi does not hold or manage funds. Contributions are coordinated by the group. Donation-enabled challenges require platform review before going active.';
