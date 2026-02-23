import { AdminExerciseInput } from '../../../services/adminExerciseService';

export const tier1Options = ['Core', 'Upper Body', 'Lower Body', 'Full Body'];
export const tier2Options = ['Strength', 'Cardio', 'Balance', 'Mobility', 'Power'];
export const difficultyOptions = ['Beginner', 'Intermediate', 'Advanced'];
export const metricTypeOptions = ['reps', 'time', 'distance', 'weight'];

export const defaultExerciseInput: AdminExerciseInput = {
  name: '',
  tier_1: 'Core',
  tier_2: 'Strength',
  difficulty: 'Beginner',
  musclesTargeted: [],
  equipment: [],
  trainingGoals: [],
  metric: {
    type: 'reps',
    unit: 'reps',
    allowCustomUnit: true,
  },
  description: '',
  setup: [],
  execution: [],
  breathing: [],
  formCues: [],
  commonMistakes: [],
  progressions: [],
  advancedVariations: [],
  safetyNotes: [],
  recommendedVolume: {
    beginner: '',
    intermediate: '',
    advanced: '',
  },
};

export function csvToArray(value: string): string[] {
  return value
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function linesToArray(value: string): string[] {
  return value
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

export function arrayToLines(arr: string[] | undefined): string {
  return (arr ?? []).join('\n');
}

export function arrayToCsv(arr: string[] | undefined): string {
  return (arr ?? []).join(', ');
}

