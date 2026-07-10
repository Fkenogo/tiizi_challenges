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
  targetType?: 'daily' | 'cumulative' | 'weekly' | 'monthly';
  activityType?: WellnessActivityType;
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
  movement: { icon: '🏃', activityType: 'steps' },
  hydration: { icon: '💧', activityType: 'water' },
  sleep: { icon: '😴', activityType: 'sleep' },
  mindfulness: { icon: '🧘', activityType: 'meditation' },
  nutrition: { icon: '🥗', activityType: 'food' },
  fasting: { icon: '🕐', activityType: 'fasting' },
  habits: { icon: '✅', activityType: 'habit' },
  stress: { icon: '🌿', activityType: 'breathing' },
  social: { icon: '🤝', activityType: 'social' },
  'health-monitoring': { icon: '🩺', activityType: 'monitoring' },
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
    activityType: seed.activityType ?? meta.activityType,
    defaultMetricUnit: seed.defaultMetricUnit,
    defaultTargetValue: seed.defaultTargetValue,
    targetType: seed.targetType ?? 'daily',
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

// ── Category 1: Movement & Steps ─────────────────────────────────────────────

const movementSeeds: ActivitySeed[] = [
  {
    name: 'Steps',
    shortName: 'Steps',
    difficulty: 'beginner',
    defaultTargetValue: 10000,
    defaultMetricUnit: 'steps',
    targetType: 'cumulative',
    activityType: 'steps',
    description: 'Daily step count tracked via phone or wearable.',
    benefits: ['Improves cardiovascular health.', 'Burns calories passively.', 'Boosts daily energy levels.'],
  },
  {
    name: 'Walking',
    shortName: 'Walking',
    difficulty: 'beginner',
    defaultTargetValue: 30,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    activityType: 'walking',
    description: 'Daily walking session for movement and mental clarity.',
  },
  {
    name: 'Walking Distance',
    shortName: 'Walking Dist',
    difficulty: 'beginner',
    defaultTargetValue: 5,
    defaultMetricUnit: 'km',
    targetType: 'cumulative',
    activityType: 'walking',
    description: 'Track distance walked each day.',
  },
  {
    name: 'Running / Jogging',
    shortName: 'Running',
    difficulty: 'intermediate',
    defaultTargetValue: 3,
    defaultMetricUnit: 'km',
    targetType: 'cumulative',
    activityType: 'walking',
    description: 'Daily running or jogging session.',
  },
  {
    name: 'Cycling',
    shortName: 'Cycling',
    difficulty: 'intermediate',
    defaultTargetValue: 10,
    defaultMetricUnit: 'km',
    targetType: 'cumulative',
    activityType: 'walking',
    description: 'Daily cycling session for cardio and leg strength.',
  },
  {
    name: 'Stretching',
    shortName: 'Stretching',
    difficulty: 'beginner',
    defaultTargetValue: 10,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    activityType: 'walking',
    description: 'Daily stretching routine for flexibility and recovery.',
  },
  {
    name: 'Mobility Routine',
    shortName: 'Mobility',
    difficulty: 'beginner',
    defaultTargetValue: 15,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    activityType: 'walking',
    description: 'Targeted mobility exercises to improve range of motion.',
  },
  {
    name: 'Yoga',
    shortName: 'Yoga',
    difficulty: 'beginner',
    defaultTargetValue: 20,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    activityType: 'yoga',
    description: 'Daily yoga practice combining movement, breath, and mindfulness.',
    benefits: ['Improves flexibility and balance.', 'Reduces stress and anxiety.', 'Builds mind-body connection.'],
  },
];

// ── Category 2: Hydration ─────────────────────────────────────────────────────
// Retained IDs (shortName preserved): 2L Daily, 3L Daily, Morning 500ml, No Sugar Drinks
// Retired: 4L Daily, Pre-meal 250ml, Workout Hydration, Hydration Streak

const hydrationSeeds: ActivitySeed[] = [
  {
    name: 'Water Intake',
    shortName: '2L Daily',
    difficulty: 'beginner',
    defaultTargetValue: 2000,
    defaultMetricUnit: 'ml',
    targetType: 'daily',
    description: 'Daily water intake target.',
  },
  {
    name: 'Enhanced Hydration',
    shortName: '3L Daily',
    difficulty: 'intermediate',
    defaultTargetValue: 3000,
    defaultMetricUnit: 'ml',
    targetType: 'daily',
    description: 'Higher daily water intake for active individuals.',
  },
  {
    name: 'Morning Water',
    shortName: 'Morning 500ml',
    difficulty: 'beginner',
    defaultTargetValue: 500,
    defaultMetricUnit: 'ml',
    targetType: 'daily',
    description: 'Drink water first thing in the morning to kick-start hydration.',
  },
  {
    name: 'No Sugary Drinks',
    shortName: 'No Sugar Drinks',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'day',
    targetType: 'daily',
    description: 'Avoid all sugary beverages for the day.',
  },
  {
    name: 'Electrolyte Hydration',
    shortName: 'Electrolyte',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'serving',
    targetType: 'daily',
    description: 'Consume electrolytes to support hydration and mineral balance.',
  },
];

// ── Category 3: Sleep & Recovery ──────────────────────────────────────────────
// Retained IDs: 8hr Sleep, Bed by 10PM, No Screen 1hr, Power Nap, Sleep Consistency
// Retired: Sleep Optimize, Sleep Recovery

const sleepSeeds: ActivitySeed[] = [
  {
    name: 'Sleep',
    shortName: '8hr Sleep',
    difficulty: 'beginner',
    defaultTargetValue: 8,
    defaultMetricUnit: 'hours',
    targetType: 'daily',
    description: 'Log your nightly sleep duration.',
  },
  {
    name: 'Early Bedtime',
    shortName: 'Bed by 10PM',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'night',
    targetType: 'daily',
    description: 'Commit to an early bedtime to improve sleep quality.',
  },
  {
    name: 'Screen-Free Hour',
    shortName: 'No Screen 1hr',
    difficulty: 'beginner',
    defaultTargetValue: 60,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Avoid all screens for one hour before bed.',
  },
  {
    name: 'Nap / Rest',
    shortName: 'Power Nap',
    difficulty: 'beginner',
    defaultTargetValue: 20,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Take a short restorative nap or rest period.',
  },
  {
    name: 'Bedtime Routine',
    shortName: 'Sleep Consistency',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'session',
    targetType: 'daily',
    description: 'Follow a consistent wind-down routine before sleep.',
  },
  {
    name: 'Wake Up On Time',
    shortName: 'Wake Time',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'day',
    targetType: 'daily',
    description: 'Wake up at your target time without snoozing.',
  },
];

// ── Category 4: Mindfulness & Mental Wellness ─────────────────────────────────
// Retained IDs: 5min Meditation, 10min Mindfulness, 20min Meditation, Gratitude Journal,
//   Breathing 3x, Digital Detox, Body Scan
// Retired: Mindful Eating

const mindfulnessSeeds: ActivitySeed[] = [
  {
    name: 'Meditation',
    shortName: '5min Meditation',
    difficulty: 'beginner',
    defaultTargetValue: 10,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Daily meditation practice for mental clarity and calm.',
    benefits: ['Reduces stress and anxiety.', 'Improves focus and attention.', 'Builds emotional regulation.'],
  },
  {
    name: 'Mindfulness',
    shortName: '10min Mindfulness',
    difficulty: 'intermediate',
    defaultTargetValue: 10,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Practice present-moment awareness through mindfulness.',
  },
  {
    name: 'Deep Meditation',
    shortName: '20min Meditation',
    difficulty: 'advanced',
    defaultTargetValue: 20,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Extended meditation session for deep mental stillness.',
  },
  {
    name: 'Gratitude Practice',
    shortName: 'Gratitude Journal',
    difficulty: 'beginner',
    defaultTargetValue: 3,
    defaultMetricUnit: 'entries',
    targetType: 'daily',
    description: 'Write three things you are grateful for each day.',
  },
  {
    name: 'Breathing Exercise',
    shortName: 'Breathing 3x',
    difficulty: 'beginner',
    defaultTargetValue: 5,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    activityType: 'breathing',
    description: 'Structured breathing exercise for calm and focus.',
  },
  {
    name: 'Digital Detox',
    shortName: 'Digital Detox',
    difficulty: 'intermediate',
    defaultTargetValue: 60,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Disconnect from digital devices to restore mental clarity.',
  },
  {
    name: 'Mindfulness Body Scan',
    shortName: 'Body Scan',
    difficulty: 'intermediate',
    defaultTargetValue: 10,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Slow, mindful scan of body sensations from head to toe.',
  },
  {
    name: 'Prayer / Reflection',
    shortName: 'Prayer',
    difficulty: 'beginner',
    defaultTargetValue: 10,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Daily prayer or quiet personal reflection.',
  },
  {
    name: 'Journaling',
    shortName: 'Journaling',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'entry',
    targetType: 'daily',
    description: 'Write a daily journal entry to process thoughts and emotions.',
  },
];

// ── Category 5: Nutrition ─────────────────────────────────────────────────────
// All 7 existing retained (names updated); 2 new added
// Retired: none from existing 7

const nutritionSeeds: ActivitySeed[] = [
  {
    name: 'Vegetable Intake',
    shortName: '5 Veg Servings',
    difficulty: 'beginner',
    defaultTargetValue: 3,
    defaultMetricUnit: 'servings',
    targetType: 'daily',
    description: 'Eat the target number of vegetable servings daily.',
  },
  {
    name: 'Fruit Intake',
    shortName: '7 Produce',
    difficulty: 'beginner',
    defaultTargetValue: 2,
    defaultMetricUnit: 'servings',
    targetType: 'daily',
    description: 'Eat the target number of fruit servings daily.',
  },
  {
    name: 'Protein Intake',
    shortName: 'Protein Goal',
    difficulty: 'intermediate',
    defaultTargetValue: 100,
    defaultMetricUnit: 'grams',
    targetType: 'daily',
    description: 'Hit your daily protein target to support muscle and recovery.',
  },
  {
    name: 'No Added Sugar',
    shortName: 'No Sugar',
    difficulty: 'advanced',
    defaultTargetValue: 1,
    defaultMetricUnit: 'day',
    targetType: 'daily',
    description: 'Avoid all added sugar for the day.',
  },
  {
    name: 'Balanced Meals',
    shortName: 'Whole Foods',
    difficulty: 'intermediate',
    defaultTargetValue: 2,
    defaultMetricUnit: 'meals',
    targetType: 'daily',
    description: 'Eat nutritionally balanced, whole-food meals.',
  },
  {
    name: 'Meal Planning',
    shortName: 'Meal Prep',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'plan',
    targetType: 'weekly',
    description: 'Plan and prepare meals ahead of time to support healthy eating.',
  },
  {
    name: 'No Junk Food',
    shortName: 'No Processed',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'day',
    targetType: 'daily',
    description: 'Avoid ultra-processed and junk food for the day.',
  },
  {
    name: 'Healthy Breakfast',
    shortName: 'Breakfast',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'meal',
    targetType: 'daily',
    description: 'Start the day with a nutritious breakfast.',
  },
  {
    name: 'Home-Cooked Meal',
    shortName: 'Home Cooked',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'meal',
    targetType: 'daily',
    description: 'Cook at least one meal at home each day.',
  },
];

// ── Category 6: Fasting ───────────────────────────────────────────────────────
// Retained IDs: 16hr Fast, 18hr Fast
// Retired: 20hr Fast, 24hr Fast, 48hr Fast, 72hr Fast, ADF, 5:2 Fasting

const fastingSeeds: ActivitySeed[] = [
  {
    name: 'Intermittent Fasting',
    shortName: '16hr Fast',
    difficulty: 'intermediate',
    defaultTargetValue: 16,
    defaultMetricUnit: 'hours',
    targetType: 'daily',
    description: 'Daily 16-hour fasting window with an 8-hour eating window.',
  },
  {
    name: 'Extended Fasting',
    shortName: '18hr Fast',
    difficulty: 'intermediate',
    defaultTargetValue: 18,
    defaultMetricUnit: 'hours',
    targetType: 'daily',
    description: 'Daily 18-hour fasting window for deeper metabolic benefits.',
  },
  {
    name: 'Time-Restricted Eating',
    shortName: 'Time Restricted',
    difficulty: 'beginner',
    defaultTargetValue: 12,
    defaultMetricUnit: 'hours',
    targetType: 'daily',
    description: 'Restrict eating to a defined daily window.',
  },
  {
    name: 'No Late Eating',
    shortName: 'No Late Eating',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'night',
    targetType: 'daily',
    description: 'Stop eating after a set evening cut-off time.',
  },
];

// ── Category 7: Habits & Discipline ──────────────────────────────────────────
// Retained IDs: Morning Routine, Evening Routine, Read Daily, Daily Planning,
//   Wake Time, No Late Snacks
// Retired: No Alcohol, Deep Work

const habitsSeeds: ActivitySeed[] = [
  {
    name: 'Morning Routine',
    shortName: 'Morning Routine',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'session',
    targetType: 'daily',
    description: 'Complete your morning routine before starting the day.',
  },
  {
    name: 'Evening Routine',
    shortName: 'Evening Routine',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'session',
    targetType: 'daily',
    description: 'Complete your evening wind-down routine before bed.',
  },
  {
    name: 'Reading',
    shortName: 'Read Daily',
    difficulty: 'beginner',
    defaultTargetValue: 20,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Read a book or learning material each day.',
  },
  {
    name: 'Habit Check-In',
    shortName: 'Daily Planning',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'check-in',
    targetType: 'daily',
    description: 'Review and log your daily habits each day.',
  },
  {
    name: 'Consistent Wake-Up',
    shortName: 'Wake Time',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'day',
    targetType: 'daily',
    description: 'Wake up at the same time every day to anchor your circadian rhythm.',
  },
  {
    name: 'No Late-Night Snacking',
    shortName: 'No Late Snacks',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'day',
    targetType: 'daily',
    description: 'Avoid eating after your cut-off time each evening.',
  },
  {
    name: 'Learning',
    shortName: 'Learning',
    difficulty: 'beginner',
    defaultTargetValue: 30,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Dedicate daily time to learning a new skill or subject.',
  },
  {
    name: 'Decluttering',
    shortName: 'Declutter',
    difficulty: 'beginner',
    defaultTargetValue: 10,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Spend a few minutes each day tidying and decluttering your space.',
  },
];

// ── Category 8: Stress Management ────────────────────────────────────────────
// Retained IDs: Breathing 3x, Nature Walk, Stress Journal, PMR, Box Breathing, Unplug Break
// Retired: Calm Routine

const stressSeeds: ActivitySeed[] = [
  {
    name: 'Deep Breathing',
    shortName: 'Breathing 3x',
    difficulty: 'beginner',
    defaultTargetValue: 5,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    activityType: 'breathing',
    description: 'Daily deep breathing sessions to activate the parasympathetic nervous system.',
  },
  {
    name: 'Nature Time',
    shortName: 'Nature Walk',
    difficulty: 'beginner',
    defaultTargetValue: 20,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    activityType: 'walking',
    description: 'Spend time outdoors in nature each day.',
  },
  {
    name: 'Stress Check-In',
    shortName: 'Stress Journal',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'check-in',
    targetType: 'daily',
    description: 'Write a brief daily note on your stress levels and triggers.',
  },
  {
    name: 'Relaxation Session',
    shortName: 'PMR',
    difficulty: 'intermediate',
    defaultTargetValue: 15,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Progressive muscle relaxation or similar body-based stress release.',
  },
  {
    name: 'Breathing Protocol',
    shortName: 'Box Breathing',
    difficulty: 'intermediate',
    defaultTargetValue: 5,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    activityType: 'breathing',
    description: 'Structured breathing technique (e.g. box breathing) for acute stress relief.',
  },
  {
    name: 'Unplug Break',
    shortName: 'Unplug Break',
    difficulty: 'beginner',
    defaultTargetValue: 15,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Step away from work and devices for a deliberate mid-day break.',
  },
  {
    name: 'Music / Calm Time',
    shortName: 'Music Calm',
    difficulty: 'beginner',
    defaultTargetValue: 15,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Listen to calming music or ambient sound to reduce stress.',
  },
];

// ── Category 9: Social & Relationships ───────────────────────────────────────
// Retained IDs: Daily Connection, Kindness Act, Community Join, Call Someone, Gratitude Message
// Retired: No-Phone Meal, Group Check-In

const socialSeeds: ActivitySeed[] = [
  {
    name: 'Social Connection',
    shortName: 'Daily Connection',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'interaction',
    targetType: 'daily',
    description: 'Have at least one meaningful social interaction each day.',
  },
  {
    name: 'Acts of Kindness',
    shortName: 'Kindness Act',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'act',
    targetType: 'daily',
    description: 'Do one deliberate act of kindness or service each day.',
  },
  {
    name: 'Community Participation',
    shortName: 'Community Join',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'activity',
    targetType: 'weekly',
    description: 'Participate in a community event or group activity each week.',
  },
  {
    name: 'Check In With Someone',
    shortName: 'Call Someone',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'person',
    targetType: 'daily',
    description: 'Reach out and check in with a friend or family member each day.',
  },
  {
    name: 'Gratitude Message',
    shortName: 'Gratitude Message',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'message',
    targetType: 'daily',
    description: 'Send a message of appreciation or gratitude to someone.',
  },
  {
    name: 'Family Time',
    shortName: 'Family Time',
    difficulty: 'beginner',
    defaultTargetValue: 30,
    defaultMetricUnit: 'minutes',
    targetType: 'daily',
    description: 'Spend dedicated, device-free time with family each day.',
  },
];

// ── Category 10: Health Monitoring ───────────────────────────────────────────

const healthMonitoringSeeds: ActivitySeed[] = [
  {
    name: 'Weight Check',
    shortName: 'Weight Check',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'check-in',
    targetType: 'weekly',
    description: 'Record your weight at the same time each week.',
  },
  {
    name: 'Blood Pressure Check',
    shortName: 'BP Check',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'check',
    targetType: 'weekly',
    description: 'Measure and log your blood pressure readings.',
    guidelines: ['Use a validated blood pressure monitor.', 'Measure at the same time of day.', 'Consult your doctor if readings are consistently high.'],
  },
  {
    name: 'Blood Sugar Check',
    shortName: 'Blood Sugar',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'check',
    targetType: 'daily',
    description: 'Monitor and log daily blood glucose levels.',
    warnings: ['For diabetics or pre-diabetics only unless directed by a doctor.'],
    medicalSupervisionRequired: true,
  },
  {
    name: 'Medication Adherence',
    shortName: 'Medication',
    difficulty: 'beginner',
    defaultTargetValue: 1,
    defaultMetricUnit: 'dose',
    targetType: 'daily',
    description: 'Take prescribed medication on schedule each day.',
    guidelines: ['Always follow your doctor\'s prescription.', 'Set a daily reminder to take medication.'],
  },
  {
    name: 'Health Appointment',
    shortName: 'Appointment',
    difficulty: 'intermediate',
    defaultTargetValue: 1,
    defaultMetricUnit: 'appointment',
    targetType: 'monthly',
    description: 'Attend a scheduled health check-up or medical appointment.',
  },
];

export const WELLNESS_ACTIVITIES_CATALOG: WellnessActivity[] = [
  ...movementSeeds.map((seed) => buildActivity('movement', seed)),
  ...hydrationSeeds.map((seed) => buildActivity('hydration', seed)),
  ...sleepSeeds.map((seed) => buildActivity('sleep', seed)),
  ...mindfulnessSeeds.map((seed) => buildActivity('mindfulness', seed)),
  ...nutritionSeeds.map((seed) => buildActivity('nutrition', seed)),
  ...fastingSeeds.map((seed) => buildActivity('fasting', seed)),
  ...habitsSeeds.map((seed) => buildActivity('habits', seed)),
  ...stressSeeds.map((seed) => buildActivity('stress', seed)),
  ...socialSeeds.map((seed) => buildActivity('social', seed)),
  ...healthMonitoringSeeds.map((seed) => buildActivity('health-monitoring', seed)),
];

export const WELLNESS_ACTIVITY_COUNT = WELLNESS_ACTIVITIES_CATALOG.length;
