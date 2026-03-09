import type { AdminWellnessActivityInput } from '../../../services/adminWellnessActivityService';
import type { WellnessActivityType, WellnessCategory, WellnessDifficulty } from '../../../types/wellnessActivity';

export const wellnessCategoryOptions: WellnessCategory[] = [
  'fasting',
  'hydration',
  'sleep',
  'mindfulness',
  'nutrition',
  'habits',
  'stress',
  'social',
];

export const wellnessDifficultyOptions: WellnessDifficulty[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
];

export const wellnessActivityTypeOptions: WellnessActivityType[] = [
  'fasting',
  'water',
  'sleep',
  'meditation',
  'food',
  'habit',
  'breathing',
  'social',
];

export function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
}

export function arrayToLines(value: string[]): string {
  return value.join('\n');
}

export const defaultWellnessActivityInput: AdminWellnessActivityInput = {
  category: 'habits',
  name: '',
  shortName: '',
  description: '',
  difficulty: 'beginner',
  icon: '✨',
  coverImage: '',
  activityType: 'habit',
  defaultMetricUnit: 'count',
  defaultTargetValue: 1,
  suggestedFrequency: 1,
  protocolSteps: [],
  benefits: [],
  guidelines: [],
  warnings: [],
  contraindications: [],
  defaultPoints: 10,
  bonusConditions: [],
  popular: false,
  medicalSupervisionRequired: false,
  prerequisite: '',
  tags: [],
};
