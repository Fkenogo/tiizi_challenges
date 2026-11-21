export const V2_RECENT_ACTIVITY_SCOPE = 'v2-member-recent-activity';
export const V2_RECENT_ACTIVITY_PREVIEW_SIZE = 2;
export const V2_RECENT_ACTIVITY_PAGE_SIZE = 20;

export function v2RecentActivityKey(uid: string | undefined, limit: number) {
  return [V2_RECENT_ACTIVITY_SCOPE, uid, limit] as const;
}

export function v2ChallengeRecentActivityKey(uid: string | undefined, challengeId: string) {
  return [V2_RECENT_ACTIVITY_SCOPE, uid, 'challenge', challengeId] as const;
}
