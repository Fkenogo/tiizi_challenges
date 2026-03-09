export type WellnessCategory =
  | 'fasting'
  | 'hydration'
  | 'sleep'
  | 'mindfulness'
  | 'nutrition'
  | 'habits'
  | 'stress'
  | 'social';

export type WellnessDifficulty = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export type WellnessActivityType =
  | 'fasting'
  | 'water'
  | 'sleep'
  | 'meditation'
  | 'food'
  | 'habit'
  | 'breathing'
  | 'social';

export interface WellnessActivity {
  id: string;
  category: WellnessCategory;
  name: string;
  shortName: string;
  description: string;
  difficulty: WellnessDifficulty;
  icon: string;
  coverImage?: string;
  activityType: WellnessActivityType;
  defaultMetricUnit: string;
  defaultTargetValue: number;
  suggestedFrequency: number;
  protocolSteps?: string[];
  fastingProtocol?: {
    fastingHours: number;
    eatingHours: number;
    startTime?: string;
    endTime?: string;
  };
  hydrationProtocol?: {
    dailyTarget: number;
    containerSize: number;
    timing?: string[];
  };
  sleepProtocol?: {
    targetHours: number;
    bedtimeWindow?: string;
    wakeWindow?: string;
    consistency: boolean;
  };
  benefits: string[];
  benefitsTimeline?: {
    week1: string[];
    week2: string[];
    week3plus: string[];
  };
  guidelines: string[];
  warnings?: string[];
  contraindications?: string[];
  bodyResponse?: {
    timeRange: string;
    title: string;
    description: string;
    effects: string[];
  }[];
  defaultPoints: number;
  bonusConditions?: {
    condition: string;
    points: number;
  }[];
  popular: boolean;
  medicalSupervisionRequired: boolean;
  prerequisite?: string;
  tags: string[];
  createdAt?: string;
  updatedAt?: string;
}

