export type ChallengePreset = {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'upcoming' | 'completed';
};

export const challengePresets: ChallengePreset[] = [
  {
    id: 'core-blast',
    name: '30-Day Core Blast',
    description: 'The ultimate journey to functional core strength and definition.',
    status: 'active',
  },
  {
    id: 'yoga-streak',
    name: 'Morning Yoga Streak',
    description: 'Start your day with clarity through a daily 15-minute flow.',
    status: 'active',
  },
  {
    id: 'pushup-daily',
    name: '100 Push-up Daily',
    description: 'Build consistency and strength with daily push-up milestones.',
    status: 'active',
  },
];

