import type { QueryClient } from '@tanstack/react-query';

export const V2_GROUP_FEED_SCOPE = 'v2-group-feed';

export function v2GroupFeedKey(groupId: string | undefined, uid: string | undefined) {
  return [V2_GROUP_FEED_SCOPE, groupId, uid] as const;
}

export async function removeV2GroupFeed(queryClient: QueryClient, groupId?: string, uid?: string) {
  const queryKey = groupId === undefined
    ? [V2_GROUP_FEED_SCOPE]
    : uid === undefined
      ? [V2_GROUP_FEED_SCOPE, groupId]
      : v2GroupFeedKey(groupId, uid);
  await queryClient.removeQueries({ queryKey });
}
