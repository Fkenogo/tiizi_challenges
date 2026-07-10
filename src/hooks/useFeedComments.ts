import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from './useAuth';
import { feedCommentService } from '../services/feedCommentService';

function commentsKey(feedItemId: string) {
  return ['feed-comments', feedItemId];
}

function repliesKey(feedItemId: string, commentId: string) {
  return ['comment-replies', feedItemId, commentId];
}

export function useFeedComments(feedItemId: string) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const commentsQuery = useQuery({
    queryKey: commentsKey(feedItemId),
    queryFn: () => feedCommentService.getComments(feedItemId),
    enabled: !!feedItemId && !!user,
    staleTime: 30 * 1000,
  });

  const addComment = useMutation({
    mutationFn: ({ groupId, text }: { groupId: string; text: string }) =>
      feedCommentService.addComment(
        feedItemId, groupId, text, user!.uid,
        profile?.displayName ?? user!.displayName ?? user!.email?.split('@')[0] ?? 'Member',
        user!.photoURL ?? undefined,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsKey(feedItemId) }),
  });

  const deleteComment = useMutation({
    mutationFn: ({ commentId }: { commentId: string }) =>
      feedCommentService.deleteOwnComment(feedItemId, commentId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: commentsKey(feedItemId) }),
  });

  return { commentsQuery, addComment, deleteComment };
}

export function useCommentReplies(feedItemId: string, commentId: string, enabled: boolean) {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const repliesQuery = useQuery({
    queryKey: repliesKey(feedItemId, commentId),
    queryFn: () => feedCommentService.getReplies(feedItemId, commentId),
    enabled: enabled && !!user,
    staleTime: 30 * 1000,
  });

  const addReply = useMutation({
    mutationFn: ({ groupId, text }: { groupId: string; text: string }) =>
      feedCommentService.addReply(
        feedItemId, commentId, groupId, text, user!.uid,
        profile?.displayName ?? user!.displayName ?? user!.email?.split('@')[0] ?? 'Member',
        user!.photoURL ?? undefined,
      ),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: repliesKey(feedItemId, commentId) }),
  });

  const deleteReply = useMutation({
    mutationFn: ({ replyId }: { replyId: string }) =>
      feedCommentService.deleteOwnReply(feedItemId, commentId, replyId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: repliesKey(feedItemId, commentId) }),
  });

  return { repliesQuery, addReply, deleteReply };
}
