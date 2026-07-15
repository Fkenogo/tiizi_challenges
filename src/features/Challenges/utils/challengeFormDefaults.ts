export type ChallengeType = 'collective' | 'competitive' | 'streak';
export type TemplateMode = 'fitness' | 'wellness';

export const DEFAULT_CHALLENGE_TYPE: ChallengeType = 'collective';
export const DEFAULT_TEMPLATE_MODE: TemplateMode = 'fitness';
export const DEFAULT_AUTO_COMPLETE_ON_GROUP_TARGET = true;
export const DEFAULT_STREAK_RESET_ON_MISS = true;
export const DURATION_FALLBACK_DAYS = 30;
