import type { QueryClient } from '@tanstack/react-query';
import { v2GroupDetailKey } from './groupQueryKeys';

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

/** Remove this Group's Feed state and return the fixed Group Home destination after denial. */
export async function handleV2GroupFeedDenied(queryClient: QueryClient, groupId: string, uid?: string) {
  await removeV2GroupFeed(queryClient, groupId, uid);
  await queryClient.invalidateQueries({ queryKey: v2GroupDetailKey(groupId, uid), exact: true });
  return `/v2/groups/${encodeURIComponent(groupId)}`;
}
