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

export interface ExerciseBreathing {
  inhale: string;
  exhale: string;
  pattern: string;
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
  breathing: ExerciseBreathing;
  formCues: string[];
  commonMistakes: string[];
  progressions: string[];
  advancedVariations: string[];
  safetyNotes: string[];
  recommendedVolume: RecommendedVolume;
  tags?: string[];
  movementType?: 'isometric' | 'isotonic';
  holdBased?: boolean;
  /**
   * P1-3 lifecycle. Missing (legacy records) is treated as 'published' —
   * see isPublishedLifecycle in src/utils/knowledgeLifecycle.ts.
   */
  lifecycleStatus?: 'draft' | 'published' | 'retired';
  /**
   * P1-4 knowledge version. Missing (legacy records) is treated as 1 —
   * see normalizeKnowledgeVersion in src/utils/knowledgeLifecycle.ts.
   */
  knowledgeVersion?: number;
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
  /** Operational availability. 'active' = fully open; 'inactive' = deactivated by admin. */
  status?: 'active' | 'inactive' | 'suspended' | 'deleted';
  /** Admin moderation record — audit/display only. Use `status` for gating logic. */
  moderationStatus?: 'active' | 'flagged' | 'deactivated';
  /** Derived from isPrivate; kept as a denormalized field for query convenience. */
  visibility?: 'public' | 'private';
  isFeatured?: boolean;
  isVerified?: boolean;
  reviewStatus?: 'pending' | 'verified' | 'flagged';
  countersUpdatedAt?: string;
  /** Group type/category for discovery */
  groupType?: 'fitness' | 'wellness' | 'mixed' | 'cause-based' | 'workplace' | 'school' | 'friends-family' | 'community';
  /** Activity interests — same ids as user exercise interests */
  activityInterests?: string[];
  /** Wellness topic interests — same ids as user wellness interests */
  wellnessTopics?: string[];
  /** Group goals/purpose */
  groupGoals?: string[];
  /** Geographic/scope context */
  locationScope?: 'local' | 'online' | 'workplace' | 'school' | 'private-circle';
  /** Community rules checklist */
  groupRules?: string[];
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
    frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
    pointsPerCompletion?: number;
    dailyFrequency?: number;
    targetType?: 'daily' | 'cumulative';
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
    /** ISO 4217 currency code for display, e.g. "RWF". Field name kept separate from targetAmountKes storage. */
    currency?: string;
  };
  startDate: string;
  endDate: string;
  createdBy: string;
  status: 'draft' | 'active' | 'completed' | 'expired';
  participantCount?: number;
  moderationStatus?: 'pending' | 'approved' | 'needs_changes';
  visibility?: 'public' | 'private';
  groupVisibility?: 'public' | 'private';
  durationDays?: number;
  // v2 engine fields
  engineVersion?: 'v2';
  // Collective v2
  groupCumulativeTarget?: number;
  autoCompleteOnGroupTarget?: boolean;
  groupCurrentTotal?: number;
  // Streak v2
  requiredConsecutiveDays?: number;
  streakResetOnMiss?: boolean;
}

export interface WellnessTemplate {
  id: string;
  category: 'fasting' | 'hydration' | 'sleep' | 'mindfulness' | 'nutrition' | 'habits' | 'stress' | 'social' | 'movement' | 'health-monitoring';
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
    targetType?: 'daily' | 'cumulative';
    frequency?: 'daily' | 'weekly' | '2x-week' | '3x-week' | '5x-week' | 'custom';
    dailyFrequency?: number;
    pointsPerCompletion?: number;
  }>;
  benefits?: string[];
  guidelines?: string[];
  warnings?: string[];
  isPublished?: boolean;
  // Engine-specific fields (v2 engines) — must match SuggestedChallengeTemplate
  groupCumulativeTarget?: number;
  autoCompleteOnGroupTarget?: boolean;
  requiredConsecutiveDays?: number;
  streakResetOnMiss?: boolean;
  // Lifecycle fields
  status?: 'draft' | 'published' | 'archived' | 'deleted';
  isFeatured?: boolean;
  featuredAt?: string;
  featuredBy?: string;
  version?: number;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  publishedAt?: string;
  archivedAt?: string;
  createdBy?: string;
  updatedBy?: string;
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
  currentStreak?: number;
  longestStreak?: number;
  lastLogDate?: string;
  /** Activity IDs logged on the current streak day (Streak v2 ALL-requirements). */
  dailyCompletedActivities?: string[];
  /** Date the dailyCompletedActivities set belongs to (YYYY-MM-DD). */
  dailyTargetDate?: string;
  cumulativeLoggedValue?: number;
  cumulativeValues?: Record<string, number>;
  engineVersion?: 'v2';
}

export interface SupportDonation {
  id: string;
  userId: string;
  amountKes: number;
  /** ISO 4217 currency code the user selected (e.g. "KES", "RWF", "UGX"). */
  currency?: string;
  frequency: 'one_time' | 'occasional' | 'monthly' | 'annual';
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
  preferredFrequency: 'one_time' | 'occasional' | 'monthly' | 'annual';
  preferredTrigger: 'challenge_completion' | 'streak_milestone' | 'manual';
  updatedAt: string;
}

export interface ChallengeContributionPledge {
  id: string;
  challengeId: string;
  groupId: string;
  userId: string;
  /** The amount the user pledged in the chosen currency. */
  pledgedAmount: number;
  /** Kept for backwards compatibility. Equal to pledgedAmount. */
  amountKes: number;
  /** ISO 4217 currency code (e.g. "KES", "RWF", "UGX"). */
  currency?: string;
  causeName?: string;
  timingStartDate?: string;
  timingEndDate?: string;
  paymentPhoneNumber?: string;
  status: 'pledged' | 'confirmed' | 'skipped';
  createdAt: string;
  updatedAt?: string;
  confirmedAt?: string;
}

export interface ChallengeActivitySummary {
  id: string;
  challengeId?: string;
  groupId?: string;
  participantCount?: number;
  totalLogs?: number;
  uniqueParticipantCount?: number;
  lastActivityAt?: unknown;
  [key: string]: unknown;
}

export interface FeedProgressSnapshot {
  challengeType: string;
  unit?: string;
  loggedValue?: number;
  userCumulativeValue?: number;
  teamCumulativeValue?: number;
  targetValue?: number;
  remainingValue?: number;
  percentComplete?: number;
  daysRemaining?: number;
  streakDay?: number;
  dailyTarget?: number;
  leaderName?: string;
  leaderValue?: number;
  leaderDelta?: number;
  leadingBy?: number;
  isLeading?: boolean;
  label: string;
}

export type FeedItemType = 'activity_log' | 'milestone' | 'achievement';

export type MilestoneType =
  | 'first_log'
  | 'collective_25'
  | 'collective_50'
  | 'collective_75'
  | 'collective_complete'
  | 'streak_3'
  | 'streak_7'
  | 'streak_14'
  | 'competitive_leader'
  | 'challenge_complete';

export interface GroupActivityFeedSummary {
  id: string;
  groupId: string;
  challengeId?: string;
  userId: string;
  source?: string;
  value?: number;
  score?: number;
  createdAt?: unknown;
  authorName?: string;
  text?: string;
  challengeName?: string;
  challengeCoverImageUrl?: string;
  challengeType?: 'collective' | 'competitive' | 'streak';
  challengeStartDate?: string;
  challengeEndDate?: string;
  userPhotoURL?: string;
  activityLabel?: string;
  valueLabel?: string;
  feedItemType?: FeedItemType;
  milestoneType?: MilestoneType;
  story?: string;
  feedProgressSnapshot?: FeedProgressSnapshot;
}

export interface ChallengeLeaderboardSummary {
  id: string;
  challengeId: string;
  groupId: string;
  userId: string;
  score: number;
  rank?: number;
  displayName?: string;
}

export interface GroupLeaderboardSummary {
  id: string;
  groupId: string;
  userId: string;
  score: number;
  rank?: number;
  displayName?: string;
}

export interface GroupMemberStatSummary {
  id: string;
  groupId: string;
  userId: string;
  score: number;
  totalLogs?: number;
  challengesCompleted?: number;
  displayName?: string;
}

export interface SupportDonationSettings {
  active: boolean;
  title: string;
  subtitle: string;
  ctaLabel: string;
  goalAmountKes: number;
  suggestedAmountsKes: number[];
  mobileMoneyNumber?: string;
  mobileMoneyUssdCode?: string;
  cardPaymentUrl?: string;
  manualPaymentNote: string;
  thankYouMessage: string;
  showPublicGoal: boolean;
  reminderCadence?: 'none' | 'monthly' | 'quarterly';
  /** ISO 4217 default currency for display, e.g. "KES". */
  currency?: string;
  /** Preferred default currency for the Support Tiizi screen. */
  defaultCurrency?: string;
  /** Currencies users may select on the Support Tiizi screen. */
  supportedCurrencies?: string[];
  /** Whether card payment UI is enabled. False during pilot. */
  cardPaymentEnabled?: boolean;
}
