import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { useFeedComments, useCommentReplies } from '../../hooks/useFeedComments';
import { formatSummaryRelativeTime } from '../../services/memberActivitySummaryService';
import { MAX_COMMENT_LENGTH } from '../../services/feedCommentService';
import type { FeedComment, FeedReply } from '../../services/feedCommentService';

function CommentAvatar({ photoURL, name, userId }: { photoURL?: string; name?: string; userId: string }) {
  if (photoURL) {
    return <img src={photoURL} alt={name ?? 'Member'} className="h-8 w-8 rounded-full object-cover flex-shrink-0" />;
  }
  const initials = ((name?.trim() || userId).slice(0, 2)).toUpperCase();
  return (
    <div className="h-8 w-8 rounded-full bg-[#fbe9d9] text-primary flex items-center justify-center text-[11px] font-black flex-shrink-0">
      {initials}
    </div>
  );
}

function CommentInput({
  placeholder,
  onSubmit,
  disabled,
}: {
  placeholder: string;
  onSubmit: (text: string) => void;
  disabled: boolean;
}) {
  const [text, setText] = useState('');
  const remaining = MAX_COMMENT_LENGTH - text.length;

  const submit = () => {
    const trimmed = text.trim();
    if (!trimmed || trimmed.length > MAX_COMMENT_LENGTH) return;
    onSubmit(trimmed);
    setText('');
  };

  return (
    <div className="flex items-end gap-2">
      <div className="flex-1">
        <textarea
          className="w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[13px] leading-[18px] text-slate-900 placeholder:text-[#9ca9bd] focus:border-primary focus:outline-none disabled:opacity-50"
          placeholder={placeholder}
          rows={1}
          maxLength={MAX_COMMENT_LENGTH}
          disabled={disabled}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {text.length > MAX_COMMENT_LENGTH - 50 && (
          <p className={`mt-0.5 text-right text-[11px] ${remaining < 0 ? 'text-red-500' : 'text-slate-400'}`}>
            {remaining}
          </p>
        )}
      </div>
      <button
        className="mb-0.5 h-9 rounded-full bg-primary px-4 text-[13px] font-bold text-white disabled:opacity-40 flex-shrink-0"
        disabled={disabled || !text.trim() || text.trim().length > MAX_COMMENT_LENGTH}
        onClick={submit}
      >
        Post
      </button>
    </div>
  );
}

function ReplyRow({
  reply,
  currentUserId,
  onDelete,
}: {
  reply: FeedReply;
  currentUserId?: string;
  onDelete: () => void;
}) {
  const isOwn = reply.userId === currentUserId;
  return (
    <div className="flex items-start gap-2 pl-10">
      <CommentAvatar photoURL={reply.authorPhotoURL} name={reply.authorName} userId={reply.userId} />
      <div className="flex-1 min-w-0">
        <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[12px] font-bold text-slate-900 truncate">{reply.authorName}</p>
            {isOwn && (
              <button onClick={onDelete} className="text-slate-400 hover:text-red-500 flex-shrink-0" aria-label="Delete reply">
                <Trash2 size={12} />
              </button>
            )}
          </div>
          <p className="mt-0.5 text-[13px] leading-[18px] text-slate-700 break-words">{reply.text}</p>
        </div>
        <p className="mt-1 text-[11px] text-[#9ca9bd] pl-3">{formatSummaryRelativeTime(reply.createdAt)}</p>
      </div>
    </div>
  );
}

function CommentRow({
  comment,
  feedItemId,
  groupId,
  currentUserId,
  canEngage,
  onDelete,
}: {
  comment: FeedComment;
  feedItemId: string;
  groupId: string;
  currentUserId?: string;
  canEngage: boolean;
  onDelete: () => void;
}) {
  const [showReplies, setShowReplies] = useState(false);
  const { repliesQuery, addReply, deleteReply } = useCommentReplies(feedItemId, comment.id, showReplies);
  const isOwn = comment.userId === currentUserId;
  const replies = repliesQuery.data ?? [];

  return (
    <div className="space-y-2">
      <div className="flex items-start gap-2">
        <CommentAvatar photoURL={comment.authorPhotoURL} name={comment.authorName} userId={comment.userId} />
        <div className="flex-1 min-w-0">
          <div className="rounded-2xl bg-slate-50 border border-slate-100 px-3 py-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold text-slate-900 truncate">{comment.authorName}</p>
              {isOwn && (
                <button onClick={onDelete} className="text-slate-400 hover:text-red-500 flex-shrink-0" aria-label="Delete comment">
                  <Trash2 size={12} />
                </button>
              )}
            </div>
            <p className="mt-0.5 text-[13px] leading-[18px] text-slate-700 break-words">{comment.text}</p>
          </div>
          <div className="mt-1 flex items-center gap-3 pl-3">
            <p className="text-[11px] text-[#9ca9bd]">{formatSummaryRelativeTime(comment.createdAt)}</p>
            <button
              className="text-[11px] font-semibold text-[#4c627e] hover:text-primary"
              onClick={() => setShowReplies((v) => !v)}
            >
              {showReplies ? 'Hide replies' : replies.length > 0 ? `${replies.length} repl${replies.length === 1 ? 'y' : 'ies'}` : 'Reply'}
            </button>
          </div>
        </div>
      </div>

      {showReplies && (
        <div className="space-y-2">
          {replies.map((reply) => (
            <ReplyRow
              key={reply.id}
              reply={reply}
              currentUserId={currentUserId}
              onDelete={() => deleteReply.mutate({ replyId: reply.id })}
            />
          ))}
          {canEngage && (
            <div className="pl-10">
              <CommentInput
                placeholder="Write a reply..."
                disabled={addReply.isPending}
                onSubmit={(text) => addReply.mutate({ groupId, text })}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface FeedCommentSectionProps {
  feedItemId: string;
  groupId: string;
  canEngage: boolean;
}

export function FeedCommentSection({ feedItemId, groupId, canEngage }: FeedCommentSectionProps) {
  const { user } = useAuth();
  const { commentsQuery, addComment, deleteComment } = useFeedComments(feedItemId);
  const comments = commentsQuery.data ?? [];

  return (
    <div className="border-t border-slate-100 px-4 pt-3 pb-4 space-y-3">
      {commentsQuery.isLoading && (
        <p className="text-[13px] text-[#9ca9bd]">Loading comments…</p>
      )}

      {comments.map((comment) => (
        <CommentRow
          key={comment.id}
          comment={comment}
          feedItemId={feedItemId}
          groupId={groupId}
          currentUserId={user?.uid}
          canEngage={canEngage}
          onDelete={() => deleteComment.mutate({ commentId: comment.id })}
        />
      ))}

      {comments.length === 0 && !commentsQuery.isLoading && (
        <p className="text-[13px] text-[#9ca9bd]">No comments yet. Be the first!</p>
      )}

      {canEngage && (
        <CommentInput
          placeholder="Add a comment…"
          disabled={addComment.isPending}
          onSubmit={(text) => addComment.mutate({ groupId, text })}
        />
      )}

      {!canEngage && (
        <p className="text-[12px] text-[#9ca9bd]">Join the group to comment.</p>
      )}
    </div>
  );
}
