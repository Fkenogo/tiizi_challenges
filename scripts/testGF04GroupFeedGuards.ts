import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { formatGroupFeedTime } from '../src/v2/groups/groupFeedTime';
import { challengeReturnPath } from '../src/v2/challenges/challengeReturnPath';

const read = (path: string) => readFile(new URL(path, import.meta.url), 'utf8');

const [home, preview, screen, event, routes, challenge, hook, api] = await Promise.all([
  read('../src/v2/groups/V2GroupHomeScreen.tsx'),
  read('../src/v2/groups/V2GroupFeedPreview.tsx'),
  read('../src/v2/groups/V2GroupFeedScreen.tsx'),
  read('../src/v2/groups/V2GroupFeedEvent.tsx'),
  read('../src/v2/routes.tsx'),
  read('../src/v2/challenges/V2CreatedChallengeScreen.tsx'),
  read('../src/v2/groups/useV2GroupFeed.ts'),
  read('../src/api/groupFeedApi.ts'),
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
assert.match(routes, /groups\/\:groupId\/feed/);
assert.match(screen, /Load more activity/);
assert.match(screen, /resetQueries\(\{ queryKey, exact: true \}\)/);
assert.match(screen, /removeV2GroupFeed\(queryClient, groupId/);
assert.match(hook, /staleTime: 0/);
assert.match(hook, /getNextPageParam: \(lastPage\) => lastPage\.nextCursor/);
assert.match(hook, /page\.groupId !== groupId/);
assert.match(api, /API_PREFIX\}\/groups\/\$\{encodeURIComponent\(groupId\)\}\/feed/);
assert.match(event, /event\.presentationTitle/);
assert.match(event, /event\.challengeTitle/);
assert.match(event, /event\.occurredAt/);
assert.match(event, /dateTime=\{event\.occurredAt\}/);
assert.match(event, /gf04FeedOriginGroupId: groupId/);
assert.match(challenge, /challengeReturnPath\(location\.state, challenge\.groupId\)/);
const returnGroup = 'a1000000-0000-4000-8000-000000000001';
assert.equal(challengeReturnPath({ gf04FeedOriginGroupId: returnGroup }, returnGroup), `/v2/groups/${returnGroup}/feed`);
assert.equal(challengeReturnPath({ gf04FeedOriginGroupId: returnGroup }, 'a2000000-0000-4000-8000-000000000002'), '/v2/challenges');
assert.equal(challengeReturnPath({ gf04FeedOriginGroupId: 'https://evil.example' }, returnGroup), '/v2/challenges');
assert.equal(challengeReturnPath({ returnTo: '/v2/groups/x/feed' }, returnGroup), '/v2/challenges');
assert.doesNotMatch(`${preview}\n${screen}\n${event}`, /Kudos|Share|comment|reaction|avatar|participant count|score|rank/i);
assert.doesNotMatch(`${home}\n${preview}\n${screen}\n${event}\n${hook}\n${api}`, /from ['"].*features\/Groups|\/app\//);

const now = new Date('2026-10-05T12:00:00.000Z');
assert.equal(formatGroupFeedTime('2026-10-05T11:58:00.000Z', now).text, '2 min ago');
assert.equal(formatGroupFeedTime('2026-10-05T09:00:00.000Z', now).text, '3 hr ago');
assert.equal(formatGroupFeedTime('2026-10-04T12:00:00.000Z', now).text, 'Yesterday');
assert.notEqual(formatGroupFeedTime('2026-10-03T11:59:00.000Z', now).text, 'Yesterday');
console.log('GF-04 Group Feed guards passed.');
