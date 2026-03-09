import type {
  WellnessActivity,
  WellnessActivityType,
  WellnessCategory,
  WellnessDifficulty,
} from '../types/wellnessActivity';

type ActivitySeed = {
  name: string;
  shortName: string;
  difficulty: WellnessDifficulty;
  defaultTargetValue: number;
  defaultMetricUnit: string;
  suggestedFrequency?: number;
  description?: string;
  protocolSteps?: string[];
  benefits?: string[];
  guidelines?: string[];
  warnings?: string[];
  tags?: string[];
  medicalSupervisionRequired?: boolean;
};

const categoryMeta: Record<WellnessCategory, { icon: string; activityType: WellnessActivityType }> = {
  fasting: { icon: '🕐', activityType: 'fasting' },
  hydration: { icon: '💧', activityType: 'water' },
  sleep: { icon: '😴', activityType: 'sleep' },
  mindfulness: { icon: '🧘', activityType: 'meditation' },
  nutrition: { icon: '🥗', activityType: 'food' },
  habits: { icon: '✅', activityType: 'habit' },
  stress: { icon: '🌿', activityType: 'breathing' },
  social: { icon: '🤝', activityType: 'social' },
};

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function buildActivity(category: WellnessCategory, seed: ActivitySeed): WellnessActivity {
  const meta = categoryMeta[category];
  const id = `${category}-${slugify(seed.shortName || seed.name)}`;
  return {
    id,
    category,
    name: seed.name,
    shortName: seed.shortName,
    description: seed.description ?? `${seed.name} protocol for structured ${category} improvement.`,
    difficulty: seed.difficulty,
    icon: meta.icon,
    activityType: meta.activityType,
    defaultMetricUnit: seed.defaultMetricUnit,
    defaultTargetValue: seed.defaultTargetValue,
    suggestedFrequency: seed.suggestedFrequency ?? 1,
    protocolSteps: seed.protocolSteps ?? [
      `Start ${seed.shortName.toLowerCase()} using your preferred routine.`,
      'Track completion inside challenge logs daily.',
      'Keep consistency and adjust gradually if needed.',
    ],
    benefits: seed.benefits ?? [
      `Improves ${category} consistency.`,
      'Builds healthy routine discipline.',
      'Supports long-term wellness outcomes.',
    ],
    guidelines: seed.guidelines ?? [
      'Stay consistent with daily check-ins.',
      'Adjust intensity gradually.',
      'Stop and seek medical guidance if symptoms appear.',
    ],
    warnings: seed.warnings,
    defaultPoints: 10,
    bonusConditions: [
      { condition: '7-day consistency streak', points: 50 },
      { condition: 'Challenge completion', points: 150 },
    ],
    popular: seed.difficulty === 'beginner',
    medicalSupervisionRequired: Boolean(seed.medicalSupervisionRequired),
    tags: seed.tags ?? [category, seed.shortName.toLowerCase(), seed.difficulty],
  };
}

const fastingSeeds: ActivitySeed[] = [
  { name: '16-Hour Fast (16/8)', shortName: '16hr Fast', difficulty: 'beginner', defaultTargetValue: 16, defaultMetricUnit: 'hours' },
  { name: '18-Hour Fast (18/6)', shortName: '18hr Fast', difficulty: 'intermediate', defaultTargetValue: 18, defaultMetricUnit: 'hours' },
  { name: '20-Hour Fast (20/4)', shortName: '20hr Fast', difficulty: 'advanced', defaultTargetValue: 20, defaultMetricUnit: 'hours' },
  { name: '24-Hour Fast (OMAD)', shortName: '24hr Fast', difficulty: 'advanced', defaultTargetValue: 24, defaultMetricUnit: 'hours', suggestedFrequency: 3 },
  { name: '48-Hour Fast', shortName: '48hr Fast', difficulty: 'expert', defaultTargetValue: 48, defaultMetricUnit: 'hours', suggestedFrequency: 1, medicalSupervisionRequired: true },
  { name: '72-Hour Fast', shortName: '72hr Fast', difficulty: 'expert', defaultTargetValue: 72, defaultMetricUnit: 'hours', suggestedFrequency: 1, medicalSupervisionRequired: true },
  { name: 'Alternate Day Fasting', shortName: 'ADF', difficulty: 'expert', defaultTargetValue: 36, defaultMetricUnit: 'hours', suggestedFrequency: 4 },
  { name: '5:2 Protocol', shortName: '5:2 Fasting', difficulty: 'intermediate', defaultTargetValue: 2, defaultMetricUnit: 'days/week', suggestedFrequency: 1 },
];

const hydrationSeeds: ActivitySeed[] = [
  { name: 'Daily Hydration 2L', shortName: '2L Daily', difficulty: 'beginner', defaultTargetValue: 2000, defaultMetricUnit: 'ml' },
  { name: 'Enhanced Hydration 3L', shortName: '3L Daily', difficulty: 'intermediate', defaultTargetValue: 3000, defaultMetricUnit: 'ml' },
  { name: 'Athlete Hydration 4L', shortName: '4L Daily', difficulty: 'advanced', defaultTargetValue: 4000, defaultMetricUnit: 'ml' },
  { name: 'Morning Hydration', shortName: 'Morning 500ml', difficulty: 'beginner', defaultTargetValue: 500, defaultMetricUnit: 'ml' },
  { name: 'Pre-Meal Water', shortName: 'Pre-meal 250ml', difficulty: 'beginner', defaultTargetValue: 250, defaultMetricUnit: 'ml', suggestedFrequency: 3 },
  { name: 'Workout Hydration', shortName: 'Workout Hydration', difficulty: 'intermediate', defaultTargetValue: 1500, defaultMetricUnit: 'ml' },
  { name: 'No Sugary Drinks', shortName: 'No Sugar Drinks', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: 'Hydration Streak', shortName: 'Hydration Streak', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'day' },
];

const sleepSeeds: ActivitySeed[] = [
  { name: '8-Hour Sleep Streak', shortName: '8hr Sleep', difficulty: 'beginner', defaultTargetValue: 8, defaultMetricUnit: 'hours' },
  { name: 'Sleep Consistency', shortName: 'Sleep Consistency', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: 'Early Bedtime', shortName: 'Bed by 10PM', difficulty: 'intermediate', defaultTargetValue: 22, defaultMetricUnit: 'hour' },
  { name: 'Screen-Free Hour', shortName: 'No Screen 1hr', difficulty: 'beginner', defaultTargetValue: 60, defaultMetricUnit: 'minutes' },
  { name: 'Sleep Optimization', shortName: 'Sleep Optimize', difficulty: 'advanced', defaultTargetValue: 8, defaultMetricUnit: 'hours' },
  { name: 'Power Nap Master', shortName: 'Power Nap', difficulty: 'intermediate', defaultTargetValue: 20, defaultMetricUnit: 'minutes' },
  { name: 'Weekend Sleep Recovery', shortName: 'Sleep Recovery', difficulty: 'beginner', defaultTargetValue: 8, defaultMetricUnit: 'hours' },
];

const mindfulnessSeeds: ActivitySeed[] = [
  { name: '5-Min Meditation', shortName: '5min Meditation', difficulty: 'beginner', defaultTargetValue: 5, defaultMetricUnit: 'minutes' },
  { name: '10-Min Mindfulness', shortName: '10min Mindfulness', difficulty: 'intermediate', defaultTargetValue: 10, defaultMetricUnit: 'minutes' },
  { name: '20-Min Deep Practice', shortName: '20min Meditation', difficulty: 'advanced', defaultTargetValue: 20, defaultMetricUnit: 'minutes' },
  { name: 'Gratitude Journaling', shortName: 'Gratitude Journal', difficulty: 'beginner', defaultTargetValue: 3, defaultMetricUnit: 'entries' },
  { name: 'Breathing Exercises', shortName: 'Breathing 3x', difficulty: 'beginner', defaultTargetValue: 3, defaultMetricUnit: 'sessions' },
  { name: 'Mindful Eating', shortName: 'Mindful Eating', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'meal' },
  { name: 'Digital Detox', shortName: 'Digital Detox', difficulty: 'intermediate', defaultTargetValue: 2, defaultMetricUnit: 'hours' },
  { name: 'Body Scan Practice', shortName: 'Body Scan', difficulty: 'intermediate', defaultTargetValue: 10, defaultMetricUnit: 'minutes' },
];

const nutritionSeeds: ActivitySeed[] = [
  { name: '5-a-Day Vegetables', shortName: '5 Veg Servings', difficulty: 'beginner', defaultTargetValue: 5, defaultMetricUnit: 'servings' },
  { name: '7-a-Day Produce', shortName: '7 Produce', difficulty: 'intermediate', defaultTargetValue: 7, defaultMetricUnit: 'servings' },
  { name: 'Daily Protein Target', shortName: 'Protein Goal', difficulty: 'intermediate', defaultTargetValue: 100, defaultMetricUnit: 'grams' },
  { name: '30-Day No Sugar', shortName: 'No Sugar', difficulty: 'advanced', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: 'Whole Foods Only', shortName: 'Whole Foods', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: 'Meal Prep Mastery', shortName: 'Meal Prep', difficulty: 'intermediate', defaultTargetValue: 3, defaultMetricUnit: 'meals' },
  { name: 'No Processed Foods', shortName: 'No Processed', difficulty: 'advanced', defaultTargetValue: 1, defaultMetricUnit: 'day' },
];

const habitsSeeds: ActivitySeed[] = [
  { name: 'Morning Routine Builder', shortName: 'Morning Routine', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: 'Evening Wind-Down Routine', shortName: 'Evening Routine', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: 'No Alcohol Challenge', shortName: 'No Alcohol', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: 'Read 20 Minutes Daily', shortName: 'Read Daily', difficulty: 'beginner', defaultTargetValue: 20, defaultMetricUnit: 'minutes' },
  { name: 'Track Daily Planning', shortName: 'Daily Planning', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'entry' },
  { name: 'Consistent Wake-Up Time', shortName: 'Wake Time', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: 'No Late-Night Snacking', shortName: 'No Late Snacks', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'day' },
  { name: '30-Min Deep Work Block', shortName: 'Deep Work', difficulty: 'advanced', defaultTargetValue: 30, defaultMetricUnit: 'minutes' },
];

const stressSeeds: ActivitySeed[] = [
  { name: 'Deep Breathing 3x Daily', shortName: 'Breathing 3x', difficulty: 'beginner', defaultTargetValue: 3, defaultMetricUnit: 'sessions' },
  { name: 'Nature Walk Reset', shortName: 'Nature Walk', difficulty: 'beginner', defaultTargetValue: 20, defaultMetricUnit: 'minutes' },
  { name: 'Stress Journaling', shortName: 'Stress Journal', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'entry' },
  { name: 'Progressive Muscle Relaxation', shortName: 'PMR', difficulty: 'intermediate', defaultTargetValue: 15, defaultMetricUnit: 'minutes' },
  { name: 'Box Breathing Protocol', shortName: 'Box Breathing', difficulty: 'intermediate', defaultTargetValue: 5, defaultMetricUnit: 'minutes' },
  { name: 'Midday Unplug Break', shortName: 'Unplug Break', difficulty: 'beginner', defaultTargetValue: 15, defaultMetricUnit: 'minutes' },
  { name: 'Evening Calm Routine', shortName: 'Calm Routine', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'day' },
];

const socialSeeds: ActivitySeed[] = [
  { name: 'Daily Meaningful Connection', shortName: 'Daily Connection', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'connection' },
  { name: 'Acts of Kindness', shortName: 'Kindness Act', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'act' },
  { name: 'Community Participation', shortName: 'Community Join', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'event/week' },
  { name: 'Call Family/Friend', shortName: 'Call Someone', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'call' },
  { name: 'No-Phone Meals', shortName: 'No-Phone Meal', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'meal' },
  { name: 'Gratitude Message', shortName: 'Gratitude Message', difficulty: 'beginner', defaultTargetValue: 1, defaultMetricUnit: 'message' },
  { name: 'Weekly Group Check-In', shortName: 'Group Check-In', difficulty: 'intermediate', defaultTargetValue: 1, defaultMetricUnit: 'check-in/week' },
];

export const WELLNESS_ACTIVITIES_CATALOG: WellnessActivity[] = [
  ...fastingSeeds.map((seed) => buildActivity('fasting', seed)),
  ...hydrationSeeds.map((seed) => buildActivity('hydration', seed)),
  ...sleepSeeds.map((seed) => buildActivity('sleep', seed)),
  ...mindfulnessSeeds.map((seed) => buildActivity('mindfulness', seed)),
  ...nutritionSeeds.map((seed) => buildActivity('nutrition', seed)),
  ...habitsSeeds.map((seed) => buildActivity('habits', seed)),
  ...stressSeeds.map((seed) => buildActivity('stress', seed)),
  ...socialSeeds.map((seed) => buildActivity('social', seed)),
];

export const WELLNESS_ACTIVITY_COUNT = WELLNESS_ACTIVITIES_CATALOG.length;

