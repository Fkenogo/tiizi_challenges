import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { feedReactionService, type ReactionType } from '../services/feedReactionService';
import type { GroupActivityFeedSummary } from '../types';

function reactionsKey(feedItemIds: string[]) {
  return ['feed-reactions', feedItemIds.join(',')];
}

export function useFeedReactions(items: GroupActivityFeedSummary[]) {
  const { user } = useAuth();
  const feedItemIds = items.map((i) => i.id);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: reactionsKey(feedItemIds),
    queryFn: () =>
      feedReactionService.getReactionSummaries(feedItemIds, user!.uid),
    enabled: feedItemIds.length > 0 && !!user,
    staleTime: 30 * 1000,
  });

  const setReaction = useMutation({
    mutationFn: ({ feedItemId, groupId, reactionType }: { feedItemId: string; groupId: string; reactionType: ReactionType }) =>
      feedReactionService.setReaction(feedItemId, groupId, user!.uid, reactionType),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reactionsKey(feedItemIds) }),
  });

  const clearReaction = useMutation({
    mutationFn: ({ feedItemId }: { feedItemId: string }) =>
      feedReactionService.clearReaction(feedItemId, user!.uid),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: reactionsKey(feedItemIds) }),
  });

  return { query, setReaction, clearReaction };
}
