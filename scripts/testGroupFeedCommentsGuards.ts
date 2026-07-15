/**
 * Phase 19A-5 — Feed Comments + Replies guards.
 * Run: npx tsx scripts/testGroupFeedCommentsGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

// ── Files exist ────────────────────────────────────────────────────────────
assert.ok(existsSync(resolve(root, 'src/services/feedCommentService.ts')), 'feedCommentService.ts must exist');
assert.ok(existsSync(resolve(root, 'src/hooks/useFeedComments.ts')), 'useFeedComments.ts must exist');
assert.ok(existsSync(resolve(root, 'src/features/Groups/FeedCommentSection.tsx')), 'FeedCommentSection.tsx must exist');

const service = read('src/services/feedCommentService.ts');
const hook = read('src/hooks/useFeedComments.ts');
const commentSection = read('src/features/Groups/FeedCommentSection.tsx');
const feedCard = read('src/features/Groups/FeedCard.tsx');
const firestoreRules = read('firestore.rules');

// ── Service: correct subcollection paths ──────────────────────────────────
assert.match(service, /groupActivityFeed.*comments|comments.*groupActivityFeed/, 'service must use groupActivityFeed/{id}/comments path');
assert.match(service, /comments.*replies|replies.*comments/, 'service must use comments/{id}/replies path for replies');

// ── Service: required functions ───────────────────────────────────────────
assert.match(service, /getComments/, 'service must have getComments');
assert.match(service, /addComment/, 'service must have addComment');
assert.match(service, /deleteOwnComment/, 'service must have deleteOwnComment');
assert.match(service, /getReplies/, 'service must have getReplies');
assert.match(service, /addReply/, 'service must have addReply');
assert.match(service, /deleteOwnReply/, 'service must have deleteOwnReply');

// ── Max length constant defined and enforced ──────────────────────────────
assert.match(service, /MAX_COMMENT_LENGTH|maxLength|500/, 'service must define max comment length (500)');
assert.match(service, /length > MAX_COMMENT_LENGTH|\.length > 500|\.size\(\) <= 500/, 'service must enforce max comment length');

// ── Empty text rejected ────────────────────────────────────────────────────
assert.match(service, /\.trim\(\)|!trimmed|text\.trim/, 'service must reject empty/whitespace-only comments');

// ── Hook: React Query with mutations ──────────────────────────────────────
assert.match(hook, /useQuery/, 'useFeedComments must use useQuery');
assert.match(hook, /useMutation/, 'useFeedComments must use useMutation');
assert.match(hook, /invalidateQueries/, 'useFeedComments must invalidate query on mutation success');
assert.match(hook, /useCommentReplies|function useCommentReplies/, 'hook file must export useCommentReplies for lazy reply loading');

// ── FeedCard imports FeedCommentSection and MessageSquare ─────────────────
assert.match(feedCard, /FeedCommentSection/, 'FeedCard must import and use FeedCommentSection');
assert.match(feedCard, /MessageSquare/, 'FeedCard must include MessageSquare icon for Reply button');
assert.match(feedCard, /showComments|setShowComments/, 'FeedCard must have showComments toggle state');

// ── CommentSection renders correctly ──────────────────────────────────────
assert.match(commentSection, /MAX_COMMENT_LENGTH/, 'FeedCommentSection must enforce MAX_COMMENT_LENGTH');
assert.match(commentSection, /text\.trim\(\)|trimmed/, 'FeedCommentSection must guard against empty submission');
assert.match(commentSection, /disabled.*!text\.trim|!text\.trim.*disabled|disabled.*isPending/, 'FeedCommentSection Post button must be disabled when text is empty or pending');
assert.match(commentSection, /Trash2|delete.*comment|deleteComment/, 'FeedCommentSection must allow owner to delete comment');

// ── Firestore rules: comments collection under groupActivityFeed ───────────
assert.match(firestoreRules, /match \/comments\/{commentId}/, 'firestore.rules must match comments/{commentId}');
assert.match(firestoreRules, /match \/replies\/{replyId}/, 'firestore.rules must match replies/{replyId}');

// ── Rules: only group members can create ──────────────────────────────────
assert.match(firestoreRules, /isGroupMember.*request\.resource\.data\.groupId|request\.resource\.data\.groupId.*isGroupMember/, 'firestore.rules must require isGroupMember for comment/reply create');

// ── Rules: only owner can delete ──────────────────────────────────────────
assert.match(firestoreRules, /resource\.data\.userId == request\.auth\.uid/, 'firestore.rules must restrict comment/reply delete to owner');

// ── Rules: text size validated ────────────────────────────────────────────
assert.match(firestoreRules, /\.size\(\) <= 500/, 'firestore.rules must enforce 500-char text limit on comments/replies');

// ── Phase 19A-4 reaction reads tightened ──────────────────────────────────
assert.doesNotMatch(
  firestoreRules,
  /reactions\/\{reactionUserId\}[\s\S]{0,400}allow read: if isAuthenticated\(\);/,
  'reaction reads must no longer allow any isAuthenticated() — must use canReadFeedItem()',
);
assert.match(firestoreRules, /canReadFeedItem/, 'firestore.rules must define and use canReadFeedItem helper');

// ── No broad authenticated read on feed subcollections ────────────────────
// reactions, comments, replies reads must all gate on canReadFeedItem, not bare isAuthenticated()
assert.match(firestoreRules, /canReadFeedItem\(feedItemId\)/, 'firestore.rules must use canReadFeedItem(feedItemId) to gate subcollection reads');

console.log('✅ All feed comments guards passed.');
