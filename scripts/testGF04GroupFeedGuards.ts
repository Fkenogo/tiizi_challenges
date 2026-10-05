import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatGroupFeedTime } from '../src/v2/groups/groupFeedTime';
import { challengeReturnPath } from '../src/v2/challenges/challengeReturnPath';
import { QueryClient } from '@tanstack/react-query';
import { groupFeedPagePath } from '../src/api/groupFeedRequest';
import { composeGroupFeedPages, cursorRecoveryOnFreshPageSuccess, cursorRecoveryOnPageError, cursorRecoveryOnRefresh } from '../src/v2/groups/groupFeedClientPolicy';
import { handleV2GroupFeedDenied, removeV2GroupFeed, v2GroupFeedKey } from '../src/v2/groups/groupFeedQueryKeys';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

const [home, preview, screen, event, routes, challenge, hook, api, apiRequest] = await Promise.all([
  read('../src/v2/groups/V2GroupHomeScreen.tsx'),
  read('../src/v2/groups/V2GroupFeedPreview.tsx'),
  read('../src/v2/groups/V2GroupFeedScreen.tsx'),
  read('../src/v2/groups/V2GroupFeedEvent.tsx'),
  read('../src/v2/routes.tsx'),
  read('../src/v2/challenges/V2CreatedChallengeScreen.tsx'),
  read('../src/v2/groups/useV2GroupFeed.ts'),
  read('../src/api/groupFeedApi.ts'),
  read('../src/api/groupFeedRequest.ts'),
]);

const hostedEnd = home.indexOf('</section>}', home.indexOf('Hosted Challenges'));
const feedPlacement = home.indexOf('<V2GroupFeedPreview');
const membersPlacement = home.indexOf('<section aria-label="Members"');
assert.ok(hostedEnd >= 0 && hostedEnd < feedPlacement && feedPlacement < membersPlacement, 'preview is between Hosted Challenges and Members');
assert.match(home, /viewerIsGroupMember && <V2GroupFeedPreview/);
assert.match(preview, /useV2GroupFeed\(groupId, true, true\)/);
assert.match(preview, /slice\(0, 3\)/);
assert.match(preview, /Group activity will appear here as Challenges progress\./);
assert.match(preview, /View all activity/);
assert.match(preview, /feed\.error\.status !== 404/);
assert.match(preview, /v2-group-detail/);
assert.match(routes, /groups\/\:groupId\/feed/);
assert.match(screen, /Load more activity/);
assert.match(screen, /resetQueries\(\{ queryKey, exact: true \}\)/);
assert.match(screen, /handleV2GroupFeedDenied\(queryClient, groupId/);
assert.match(hook, /staleTime: 0/);
assert.match(hook, /getNextPageParam: \(lastPage\) => lastPage\.nextCursor/);
assert.match(hook, /page\.groupId !== groupId/);
assert.match(api, /groupFeedPagePath\(API_PREFIX, groupId, options\)/);
assert.match(apiRequest, /\$\{apiPrefix\}\/groups\/\$\{encodeURIComponent\(groupId\)\}\/feed/);
assert.match(event, /event\.presentationTitle/);
assert.match(event, /event\.challengeTitle/);
assert.match(event, /event\.occurredAt/);
assert.match(event, /dateTime=\{event\.occurredAt\}/);
assert.match(event, /gf04FeedOriginGroupId: groupId/);
assert.match(challenge, /challengeReturnPath\(location\.state, challenge\.groupId\)/);
const returnGroup = 'a1000000-0000-4000-8000-000000000001';
assert.equal(challengeReturnPath({ gf04FeedOriginGroupId: returnGroup }, returnGroup), `/v2/groups/${returnGroup}/feed`);
assert.equal(challengeReturnPath({ gf04FeedOriginGroupId: returnGroup }, 'a2000000-0000-4000-8000-000000000002'), '/v2/challenges');
assert.equal(challengeReturnPath({ gf04FeedOriginGroupId: 'not-a-uuid' }, returnGroup), '/v2/challenges');
assert.equal(challengeReturnPath({ gf04FeedOriginGroupId: 'https://evil.example' }, returnGroup), '/v2/challenges');
assert.equal(challengeReturnPath({ returnTo: '/v2/groups/x/feed' }, returnGroup), '/v2/challenges');
assert.equal(challengeReturnPath({ gf04FeedOriginGroupId: returnGroup, returnTo: 'https://evil.example' }, returnGroup), `/v2/groups/${returnGroup}/feed`);
assert.equal(challengeReturnPath(null, returnGroup), '/v2/challenges');
assert.doesNotMatch(`${preview}\n${screen}\n${event}`, /Kudos|Share|comment|reaction|avatar|participant count|score|rank/i);
assert.doesNotMatch(`${home}\n${preview}\n${screen}\n${event}\n${hook}\n${api}`, /from ['"].*features\/Groups|\/app\//);

const now = new Date('2026-10-05T12:00:00.000Z');
assert.equal(formatGroupFeedTime('2026-10-05T11:58:00.000Z', now).text, '2 min ago');
assert.equal(formatGroupFeedTime('2026-10-05T09:00:00.000Z', now).text, '3 hr ago');
assert.equal(formatGroupFeedTime('2026-10-04T12:00:00.000Z', now).text, 'Yesterday');
assert.notEqual(formatGroupFeedTime('2026-10-03T11:59:00.000Z', now).text, 'Yesterday');

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const groupA = 'a1000000-0000-4000-8000-000000000001';
const groupB = 'a2000000-0000-4000-8000-000000000002';
const uid1 = 'user-1';
const uid2 = 'user-2';
const q = (groupId: string, uid: string, surface: 'preview' | 'full') => [...v2GroupFeedKey(groupId, uid), surface] as const;
const payload = (label: string) => ({ pages: [{ events: [label] }], pageParams: [undefined] });
queryClient.setQueryData(q(groupA, uid1, 'preview'), payload('a1-preview'));
queryClient.setQueryData(q(groupA, uid1, 'full'), payload('a1-full'));
queryClient.setQueryData(q(groupA, uid2, 'full'), payload('a2-full'));
queryClient.setQueryData(q(groupB, uid1, 'full'), payload('b1-full'));
queryClient.setQueryData(['unrelated', 'preserved'], { value: true });
await removeV2GroupFeed(queryClient, groupA, uid1);
assert.equal(queryClient.getQueryData(q(groupA, uid1, 'preview')), undefined, 'Group+UID removal clears preview');
assert.equal(queryClient.getQueryData(q(groupA, uid1, 'full')), undefined, 'Group+UID removal clears full Feed');
assert.deepEqual(queryClient.getQueryData(q(groupA, uid2, 'full')), payload('a2-full'), 'other user remains isolated');
assert.deepEqual(queryClient.getQueryData(q(groupB, uid1, 'full')), payload('b1-full'), 'other Group remains isolated');
await removeV2GroupFeed(queryClient);
assert.equal(queryClient.getQueryCache().findAll({ queryKey: ['v2-group-feed'] }).length, 0, 'identity/logout cleanup removes all Feed keys');
assert.deepEqual(queryClient.getQueryData(['unrelated', 'preserved']), { value: true }, 'Feed-family cleanup preserves unrelated cache');

let recovery = { attempted: false };
let decision = cursorRecoveryOnPageError(recovery, 'network_error', true);
assert.equal(decision.resetToFirstPage, false, 'ordinary network error does not reset cursor');
decision = cursorRecoveryOnPageError(recovery, 'invalid_cursor', false);
assert.equal(decision.resetToFirstPage, false, 'invalid cursor on a non-load-more request does not enter recovery');
decision = cursorRecoveryOnPageError(recovery, 'invalid_cursor', true);
assert.equal(decision.resetToFirstPage, true, 'first invalid cursor during Load More resets to page one');
recovery = decision.state;
decision = cursorRecoveryOnPageError(recovery, 'invalid_cursor', true);
assert.equal(decision.resetToFirstPage, false, 'second invalid cursor in same recovery cycle does not loop');
recovery = cursorRecoveryOnFreshPageSuccess();
assert.equal(recovery.attempted, false, 'successful fresh first page completes recovery cycle');
assert.equal(cursorRecoveryOnPageError(recovery, 'invalid_cursor', true).resetToFirstPage, true, 'later independent cursor recovery is allowed');
assert.equal(cursorRecoveryOnRefresh().attempted, false, 'user refresh begins a clean page-one cycle');

const deniedClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
deniedClient.setQueryData(q(groupA, uid1, 'preview'), payload('preview-stale'));
deniedClient.setQueryData(q(groupA, uid1, 'full'), payload('page-1-and-page-2-stale'));
deniedClient.setQueryData(['v2-group-detail', groupA, uid1], { groupId: groupA });
deniedClient.setQueryData(q(groupB, uid1, 'full'), payload('other-group'));
const denialDestination = await handleV2GroupFeedDenied(deniedClient, groupA, uid1);
assert.equal(denialDestination, `/v2/groups/${groupA}`, '404 destination is fixed to Group Home');
assert.equal(deniedClient.getQueryData(q(groupA, uid1, 'preview')), undefined, '404 clears preview cache');
assert.equal(deniedClient.getQueryData(q(groupA, uid1, 'full')), undefined, '404 clears accumulated full Feed pages');
assert.equal(deniedClient.getQueryState(['v2-group-detail', groupA, uid1])?.isInvalidated, true, '404 invalidates Group detail');
assert.deepEqual(deniedClient.getQueryData(q(groupB, uid1, 'full')), payload('other-group'), '404 cleanup preserves another Group');

const opaqueCursor = 'opaque.cursor_VALUE-123';
const transportUrl = new URL(groupFeedPagePath('/api', groupA, { cursor: opaqueCursor }), 'https://tiizi.test');
assert.equal(transportUrl.searchParams.get('cursor'), opaqueCursor, 'opaque cursor survives request URL encoding unchanged');

const makeEvent = (feedEventId: string, challengeId: string) => ({
  feedEventId,
  eventType: 'challenge_started' as const,
  challengeId,
  challengeTitle: `Title ${challengeId}`,
  presentationTitle: 'The Challenge has started',
  occurredAt: '2026-10-05T12:00:00.000Z',
  navigationTarget: { type: 'challenge' as const, challengeId },
});
const composed = composeGroupFeedPages([
  { groupId: groupA, events: [makeEvent('A', 'challenge-1'), makeEvent('B', 'challenge-1')], nextCursor: 'cursor-2' },
  { groupId: groupA, events: [makeEvent('C', 'challenge-2'), makeEvent('D', 'challenge-2')], nextCursor: null },
]);
assert.deepEqual(composed.map((item) => item.feedEventId), ['A', 'B', 'C', 'D'], 'server page/event order is preserved without challenge dedupe');
assert.deepEqual(composeGroupFeedPages(undefined), [], 'no pages composes to an empty list');
queryClient.clear();
deniedClient.clear();
console.log('GF-04 Group Feed guards passed.');
