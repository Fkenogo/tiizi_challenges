export interface ExerciseMetric {
  type: string;
  unit: string;
  allowCustomUnit: boolean;
}

export interface RecommendedVolume {
  beginner: string;
  intermediate: string;
  advanced: string;
}

export interface CatalogExercise {
  id: string;
  name: string;
  tier_1: string;
  tier_2: string;
  difficulty: string;
  musclesTargeted: string[];
  equipment: string[];
  trainingGoals: string[];
  metric: ExerciseMetric;
  description: string;
  setup: string[];
  execution: string[];
  breathing: string[];
  formCues: string[];
  commonMistakes: string[];
  progressions: string[];
  advancedVariations: string[];
  safetyNotes: string[];
  recommendedVolume: RecommendedVolume;
}

export interface User {
  id: string;
  email: string;
  displayName: string;
  photoURL?: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  memberCount: number;
  createdAt: string;
  coverImageUrl?: string;
  isPrivate?: boolean;
  requireAdminApproval?: boolean;
  allowMemberChallenges?: boolean;
  inviteCode?: string;
  activeChallenges?: number;
}

export interface Challenge {
  id: string;
  name: string;
  description: string;
  groupId?: string;
  exerciseIds: string[];
  challengeType?: 'collective' | 'competitive' | 'streak';
  coverImageUrl?: string;
  activities?: Array<{
    exerciseId: string;
    exerciseName?: string;
    targetValue: number;
    unit: string;
  }>;
  donation?: {
    enabled: boolean;
    causeDescription?: string;
    targetAmount?: number;
  };
  startDate: string;
  endDate: string;
  createdBy: string;
  status: 'draft' | 'active' | 'completed';
}

export interface Workout {
  id: string;
  userId: string;
  challengeId: string;
  exerciseId: string;
  value: number;
  unit: string;
  notes?: string;
  groupId?: string;
  completedAt: string;
}
