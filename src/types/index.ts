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
  imageUrl?: string;
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
  lastActive?: string;
  status?: 'active' | 'suspended' | 'deleted';
  emailVerified?: boolean;
  stats?: {
    level?: number;
    totalPoints?: number;
    totalWorkouts?: number;
    totalChallenges?: number;
    challengesCompleted?: number;
    totalGroups?: number;
  };
  lastWorkoutAt?: string;
  lastChallengeJoinedAt?: string;
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
  category?: 'fitness' | 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social' | 'wellness';
  name: string;
  description: string;
  groupId: string;
  exerciseIds: string[];
  challengeType?: 'collective' | 'competitive' | 'streak';
  coverImageUrl?: string;
  activities?: Array<{
    exerciseId?: string;
    activityId?: string;
    activityType?: string;
    exerciseName?: string;
    description?: string;
    category?: string;
    difficulty?: string;
    icon?: string;
    targetValue: number;
    unit: string;
    instructions?: string[];
    protocolSteps?: string[];
    benefits?: string[];
    guidelines?: string[];
    warnings?: string[];
    frequency?: 'daily' | 'weekly' | '3x-week' | 'custom';
    pointsPerCompletion?: number;
    dailyFrequency?: number;
  }>;
  donation?: {
    enabled: boolean;
    causeName?: string;
    causeDescription?: string;
    targetAmountKes?: number;
    contributionStartDate?: string;
    contributionEndDate?: string;
    contributionPhoneNumber?: string;
    contributionCardUrl?: string;
    disclaimer?: string;
    approvalStatus?: 'pending' | 'approved' | 'rejected';
    approvalRequired?: boolean;
  };
  startDate: string;
  endDate: string;
  createdBy: string;
  status: 'draft' | 'active' | 'completed';
  participantCount?: number;
  moderationStatus?: 'pending' | 'approved' | 'needs_changes';
}

export interface WellnessTemplate {
  id: string;
  category: 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social';
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced' | 'expert';
  type: 'collective' | 'competitive' | 'streak';
  duration: number;
  coverImage?: string;
  icon?: string;
  color?: string;
  activities: Array<{
    activityId: string;
    order: number;
    activityType: string;
    name: string;
    description?: string;
    category?: string;
    difficulty?: string;
    icon?: string;
    instructions?: string[];
    protocolSteps?: string[];
    benefits?: string[];
    guidelines?: string[];
    warnings?: string[];
    metricUnit: string;
    targetValue: number;
    frequency?: 'daily' | 'weekly' | '3x-week' | 'custom';
    dailyFrequency?: number;
    pointsPerCompletion?: number;
  }>;
  benefits?: string[];
  guidelines?: string[];
  warnings?: string[];
  isPublished?: boolean;
}

export interface WellnessLog {
  id: string;
  userId: string;
  groupId: string;
  challengeId: string;
  activityId: string;
  logType: 'fasting' | 'hydration' | 'sleep' | 'meditation';
  value: number;
  unit: string;
  points: number;
  notes?: string;
  date: string;
  loggedAt: string;
  metadata?: Record<string, unknown>;
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
  date?: string;
  completedAt: string;
}

export interface ChallengeMember {
  challengeId: string;
  userId: string;
  groupId: string;
  joinedAt: unknown;
  status: 'active' | 'completed' | 'abandoned';
  activitiesCompleted: number;
  totalActivities: number;
  totalPoints: number;
  lastActivityAt?: unknown;
  completedAt?: unknown;
  completionRate: number;
}

export interface SupportDonation {
  id: string;
  userId: string;
  amountKes: number;
  frequency: 'monthly' | 'annual' | 'goal_triggered' | 'one_time';
  trigger: 'manual' | 'challenge_completion' | 'streak_milestone';
  paymentMethod: 'mobile_money' | 'card';
  paymentDestination: {
    mobileNumber?: string;
    cardUrl?: string;
  };
  ussdCode?: string;
  challengeId?: string;
  status: 'intent' | 'confirmed';
  transactionId?: string;
  confirmedAt?: string;
  createdAt: string;
}

export interface SupportDonationPreference {
  userId: string;
  preferredFrequency: 'monthly' | 'annual' | 'goal_triggered';
  preferredTrigger: 'challenge_completion' | 'streak_milestone' | 'manual';
  updatedAt: string;
}

export interface ChallengeContributionPledge {
  id: string;
  challengeId: string;
  groupId: string;
  userId: string;
  amountKes: number;
  timingStartDate?: string;
  timingEndDate?: string;
  paymentPhoneNumber?: string;
  status: 'pledged' | 'skipped';
  createdAt: string;
}
