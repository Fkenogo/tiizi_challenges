import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatGroupFeedTime } from '../src/v2/groups/groupFeedTime';
import { challengeReturnPath } from '../src/v2/challenges/challengeReturnPath';
import { QueryClient } from '@tanstack/react-query';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router-dom/server';
import { GROUP_FEED_EVENT_TYPES, GROUP_FEED_PRESENTATION_TITLES, type GroupFeedEventType } from '../src/api/groupFeedContract';
import { V2GroupFeedEvent } from '../src/v2/groups/V2GroupFeedEvent';
import { GROUP_FEED_EVENT_TYPES as SERVER_EVENT_TYPES } from '../api/src/groupFeedPublication';
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
  presentationTitle: 'The Challenge has started' as const,
  occurredAt: '2026-10-05T12:00:00.000Z',
  navigationTarget: { type: 'challenge' as const, challengeId },
});
const composed = composeGroupFeedPages([
  { groupId: groupA, events: [makeEvent('A', 'challenge-1'), makeEvent('B', 'challenge-1')], nextCursor: 'cursor-2' },
  { groupId: groupA, events: [makeEvent('C', 'challenge-2'), makeEvent('D', 'challenge-2')], nextCursor: null },
]);
assert.deepEqual(composed.map((item) => item.feedEventId), ['A', 'B', 'C', 'D'], 'server page/event order is preserved without challenge dedupe');
assert.deepEqual(composeGroupFeedPages(undefined), [], 'no pages composes to an empty list');

// ---------------------------------------------------------------------------
// GF-04 reconciliation 001 — GF-01 v1.1 four-event contract, mobile-only shell, cache scoping.
// ---------------------------------------------------------------------------
const FINALIZED = ['challenge', 'finalized'].join('_');
const FOUR = ['challenge_established', 'challenge_started', 'together_goal_achieved', 'challenge_ended'];
const TITLES: Record<GroupFeedEventType, string> = {
  challenge_established: 'A new Challenge is available',
  challenge_started: 'The Challenge has started',
  together_goal_achieved: 'The Group reached its Challenge goal',
  challenge_ended: 'The Challenge has ended',
};
assert.deepEqual([...GROUP_FEED_EVENT_TYPES], FOUR, 'client contract is exactly the four GF-01 v1.1 families');
assert.equal(GROUP_FEED_EVENT_TYPES.length, 4);
assert.ok(!(GROUP_FEED_EVENT_TYPES as readonly string[]).includes(FINALIZED), 'finalization is not a Group Feed family');
assert.deepEqual([...GROUP_FEED_EVENT_TYPES], [...SERVER_EVENT_TYPES], 'client tuple cannot drift from the server publication authority');
assert.deepEqual({ ...GROUP_FEED_PRESENTATION_TITLES }, TITLES, 'exact four presentation titles');
const readsSrc = await read('../api/src/groupFeedReads.ts');
for (const [type, title] of Object.entries(TITLES)) {
  assert.ok(readsSrc.includes(`${type}: '${title}'`), `server GF-03 title for ${type} matches the client record`);
}
// No finalization residue anywhere in GF-04 runtime, UI or test fixtures (this file builds the literal at runtime).
const gf04Files = [
  '../src/api/groupFeedApi.ts', '../src/api/groupFeedContract.ts', '../src/api/groupFeedRequest.ts', '../src/v2/groups/V2GroupFeedEvent.tsx',
  '../src/v2/groups/V2GroupFeedPreview.tsx', '../src/v2/groups/V2GroupFeedScreen.tsx', '../src/v2/groups/groupFeedClientPolicy.ts',
  '../src/v2/groups/groupFeedQueryKeys.ts', '../src/v2/groups/groupFeedTime.ts', '../src/v2/groups/useV2GroupFeed.ts',
  '../src/v2/challenges/challengeReturnPath.ts', '../scripts/testGF04GroupFeedGuards.ts',
];
const gf04Src: Record<string, string> = Object.fromEntries(await Promise.all(gf04Files.map(async (file): Promise<[string, string]> => [file, await read(file)])));
for (const [file, text] of Object.entries(gf04Src)) {
  assert.ok(!text.includes(FINALIZED), `no finalization family in ${file}`);
  if (!file.endsWith('testGF04GroupFeedGuards.ts')) assert.doesNotMatch(text, /results? (?:are|is) ready|result[- ]ready|\bfive\b[^\n]{0,24}(?:event|famil)/i, `no result-ready / five-family wording in ${file}`);
}

// Every one of the four families renders with its exact server-supplied title, challenge link and only the allowed fields.
const feedGroup = 'a1000000-0000-4000-8000-000000000001';
const challengeId = 'c1000000-0000-4000-8000-000000000001';
for (const eventType of FOUR as GroupFeedEventType[]) {
  const rendered = renderToStaticMarkup(createElement(StaticRouter, { location: '/' }, createElement(V2GroupFeedEvent, {
    groupId: feedGroup,
    event: {
      feedEventId: `e-${eventType}`, eventType, challengeId, challengeTitle: 'Morning Streak',
      presentationTitle: GROUP_FEED_PRESENTATION_TITLES[eventType], occurredAt: '2026-10-05T12:00:00.000Z',
      navigationTarget: { type: 'challenge', challengeId },
    },
  })));
  assert.ok(rendered.includes(TITLES[eventType]), `${eventType} shows its exact title`);
  assert.ok(rendered.includes('Morning Streak'), `${eventType} shows the Challenge title`);
  assert.ok(rendered.includes(`/v2/challenges/${challengeId}`), `${eventType} links only to its Challenge`);
  assert.doesNotMatch(rendered, /score|rank|evidence|Kudos|Share|avatar|participant/i, `${eventType} renders no actor/score/value/evidence`);
}

// Mobile-only member shell: Group Feed surfaces add no widening, no desktop variants, no fixed/top navigation.
const surfaces = `${preview}\n${screen}\n${event}`;
assert.doesNotMatch(surfaces, /\b(?:sm|md|lg|xl|2xl):|max-w-(?:lg|xl|2xl|3xl|4xl|5xl|6xl|7xl|screen|full)\b|\bfixed\b|\bsticky\b|\bw-screen\b|\bwide\b/, 'GF-04 surfaces add no responsive/desktop widening or fixed chrome');
assert.match(screen, /<V2Page>/);
assert.doesNotMatch(screen, /<V2Page wide>/);
const feedRoute = routes.indexOf('path="groups/:groupId/feed"');
assert.ok(routes.indexOf('<Route element={<V2MemberShell />}>') < feedRoute && feedRoute < routes.indexOf('path="operator"'), 'Feed route lives inside the mobile member shell, not Operator');
const shell = await read('../src/v2/member/MemberShell.tsx');
assert.match(shell, /max-w-md/);
assert.doesNotMatch(shell, /\b(?:md|lg|xl):(?:flex|hidden|block)/, 'member shell has no desktop navigation variant');

// Group-specific cache scoping and cleanup wiring.
assert.match(routes, /previousUid\.current !== user\?\.uid\) void removeV2GroupFeed\(queryClient\)/, 'identity change clears the whole Feed query family');
const groups = await read('../src/v2/groups/useV2Groups.ts');
assert.match(groups, /onSuccess: async \(\) => \{\s*await removeV2GroupFeed\(queryClient, groupId \?\? undefined, user\?\.uid\)/, 'successful leave clears that Group Feed cache');
assert.match(screen, /v2GroupFeedKey\(groupId \?\? undefined, user\?\.uid\)/, 'full Feed query key is built by the shared Group + UID scoped builder');
assert.match(hook, /\.\.\.v2GroupFeedKey\(groupId \?\? undefined, user\?\.uid\)/);
assert.deepEqual(v2GroupFeedKey(groupA, uid1), ['v2-group-feed', groupA, uid1]);
assert.notDeepEqual(v2GroupFeedKey(groupA, uid1), v2GroupFeedKey(groupB, uid1));
assert.notDeepEqual(v2GroupFeedKey(groupA, uid1), v2GroupFeedKey(groupA, uid2));

// Pagination: default page, Load More, opaque cursor, server order; no client sorting or speculative prefetch.
assert.doesNotMatch(`${screen}\n${hook}\n${preview}`, /\.sort\(|\.reverse\(|prefetch|atob\(|btoa\(|JSON\.parse\(/, 'no client sorting, prefetch or cursor decoding');
assert.match(hook, /\.\.\.\(pageParam \? \{ cursor: pageParam \} : \{\}\)/);
assert.match(preview, /limit|useV2GroupFeed\(groupId, true, true\)/);
assert.match(hook, /const limit = preview \? 3 : undefined/);
assert.match(screen, /isFetchNextPageError/);
assert.match(screen, /V2EmptyState/); assert.match(screen, /V2ErrorState/); assert.match(screen, /V2LoadingState/);
assert.match(preview, /role="status"/); assert.match(preview, /role="alert"/);

queryClient.clear();
deniedClient.clear();
console.log('GF-04 Group Feed guards passed.');
