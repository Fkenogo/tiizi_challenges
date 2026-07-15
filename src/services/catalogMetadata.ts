import type { WellnessActivityType, WellnessCategory, WellnessDifficulty } from '../types/wellnessActivity';

export const EXERCISE_TIER_1_OPTIONS = ['Core', 'Upper Body', 'Lower Body', 'Full Body'] as const;
export const EXERCISE_TIER_2_OPTIONS = ['Strength', 'Cardio', 'Balance', 'Mobility', 'Power'] as const;
export const EXERCISE_DIFFICULTY_OPTIONS = ['Beginner', 'Intermediate', 'Advanced'] as const;

export const WELLNESS_CATEGORY_OPTIONS: WellnessCategory[] = [
  'movement',
  'hydration',
  'sleep',
  'mindfulness',
  'nutrition',
  'fasting',
  'habits',
  'stress',
  'social',
  'health-monitoring',
];

export const WELLNESS_DIFFICULTY_OPTIONS: WellnessDifficulty[] = ['beginner', 'intermediate', 'advanced', 'expert'];

export const WELLNESS_ACTIVITY_TYPE_OPTIONS: WellnessActivityType[] = [
  'steps',
  'walking',
  'yoga',
  'water',
  'sleep',
  'meditation',
  'breathing',
  'food',
  'fasting',
  'habit',
  'social',
  'monitoring',
];

export const TEMPLATE_CATEGORY_OPTIONS = ['fitness', 'wellness'] as const;
export const TEMPLATE_STATUS_OPTIONS = ['active', 'draft', 'archived'] as const;
