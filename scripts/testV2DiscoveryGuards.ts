/**
 * TIIZI-FER-P2-001 — preference-based discovery guards
 * (run: npm run test:v2-discovery). Ranking/authorization behaviour is proven
 * against PostgreSQL in api/test/p2PreferenceDiscovery.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { InfiniteQueryObserver, QueryClient } from '@tanstack/react-query';
import { createRefreshTracker, discoveryCaption, discoveryWindowNote, effectiveRelationship, flattenDiscoveryPages, hasRelevance, relevanceBadges } from '../src/v2/challenges/discoveryRelevance';
import { parseChallengeIntent } from '../src/v2/challenges/challengeIntent';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}

console.log('A. honest ordering captions (no recommendation claim unless ranking matched)');
const match = { relevance: { interests: ['Strength'], goals: [] } };
const none = { relevance: { interests: [], goals: [] } };
check('matched only when applied AND something matched', discoveryCaption('relevance', true, [match, none], 'Groups').kind === 'matched');
check('applied but nothing matched is not claimed as relevant', discoveryCaption('relevance', true, [none], 'Groups').kind === 'unmatched');
check('no saved preferences is not claimed as relevant', discoveryCaption('relevance', false, [match], 'Challenges').kind === 'no-preferences');
check('general browsing is labelled as default order', discoveryCaption('general', true, [match], 'Groups').kind === 'general');
check('captions never promise eligibility', !/only|eligible|recommended for you/i.test(
  ['relevance', 'general'].flatMap((o) => [true, false].map((a) => discoveryCaption(o as 'relevance' | 'general', a, [match], 'Groups').text)).join(' '),
));
check('badges list only matched labels', relevanceBadges({ interests: ['Strength'], goals: ['Build strength'] }).join('|') === 'Your interests: Strength|Your goals: Build strength');
check('domain-only match gets a softer badge', relevanceBadges({ interests: [], goals: [], domains: ['wellness'] })[0] === 'Matches your Wellness interests');
check('empty relevance has no badge', relevanceBadges({ interests: [], goals: [] }).length === 0 && !hasRelevance(undefined));

console.log('B. return context is context only');
const uuid = '11111111-1111-4111-8111-111111111111';
check('valid intent parses', parseChallengeIntent(JSON.stringify({ challengeId: uuid, groupId: uuid, title: 'T', groupName: 'G' }))?.challengeId === uuid);
check('malformed or non-UUID intents are rejected', parseChallengeIntent('{"challengeId":"../x","groupId":"y","title":"t","groupName":"g"}') === null && parseChallengeIntent('nope') === null && parseChallengeIntent(null) === null);
const intentSrc = read('src/v2/challenges/challengeIntent.ts');
check('intent is stored per member and best-effort', /KEY_PREFIX\}\$\{uid\}/.test(intentSrc) && (intentSrc.match(/catch/g) ?? []).length >= 3);

console.log('C. the Challenge -> Group -> Challenge journey keeps its explicit steps');
const explore = read('src/v2/challenges/V2ExploreChallenges.tsx');
check('Explore uses the existing Group join mutation', /useJoinGroup\(/.test(explore));
check('Explore never joins a Challenge', !/joinChallengeV2|\/join`|useJoinChallenge/.test(explore));
check('approval Groups show a pending state, not Challenge access', /Request sent — waiting for/.test(explore) && /requiresApproval/.test(explore));
check('copy states that Group join does not enroll in the Challenge', /does not enroll you in the Challenge/.test(explore));
const banner = read('src/v2/challenges/V2ChallengeIntentBanner.tsx');
check('return is offered only when the server lists the Challenge in the member\'s own list', /ownChallenges\.find/.test(banner) && /if \(!available\) return null/.test(banner));
check('return navigates to the Challenge detail and does not join', /navigate\(`\/v2\/challenges\//.test(banner) && !/joinChallenge/.test(banner));
const list = read('src/v2/challenges/V2ChallengeListScreen.tsx');
check('Challenges screen composes banner + Explore', /<V2ChallengeIntentBanner/.test(list) && /<V2ExploreChallenges \/>/.test(list));

console.log('D. ordering never filters, gates or touches Challenge engines');
const groupPanel = read('src/v2/groups/V2GroupDiscoveryPanel.tsx');
check('Group discovery offers an accessible general-browsing option', /Browse all/.test(groupPanel) && /aria-label="Order Groups"/.test(groupPanel));
check('Explore offers an accessible general-browsing option', /Browse all/.test(explore) && /aria-label="Order Challenges"/.test(explore));
for (const file of ['api/src/challengeDiscovery.ts', 'api/src/groupDiscovery.ts']) {
  const src = read(file);
  check(`${file} imports no Challenge engine, scoring or participation module (types aside)`, !/^import (?!type)[^;]*from '\.\/(engine|challengeFinalization|challengeParticipations|challengeActivityApplication|derivedTruth|challengeConfigs)/m.test(src));
  check(`${file} never writes`, !/\b(INSERT|UPDATE|DELETE)\b/.test(src.replace(/--.*$/gm, '')));
}
check('ranking only reads preference IDs through the P1b contract', /getMemberPreferenceIds/.test(read('api/src/challengeDiscovery.ts')) && /getMemberPreferenceIds/.test(read('api/src/groupReads.ts')));
check('preference failures fail open (general ordering)', (read('api/src/challengeDiscovery.ts').match(/\.catch\(\(\) => null\)/g) ?? []).length >= 1 && /\.catch\(\(\) => null\)/.test(read('api/src/groupReads.ts')));
check('no new preference or recommendation store', !/CREATE TABLE/i.test(read('api/src/challengeDiscovery.ts')));
check('preference save re-reads both discovery lists', /invalidateV2DiscoveryReads/.test(read('src/v2/preferences/usePreferences.ts')));

console.log('E. corrections: canonical prefix, stale pending state, bounded pagination');
const discoverySrc = read('api/src/challengeDiscovery.ts');
check('discovery route registers through apiPath, never a literal /api', /apiPath\('\/challenges\/discover'\)/.test(discoverySrc) && !/'\/api\//.test(discoverySrc));
check('ranking orders BEFORE the window (no LIMIT on an unranked set)', /ORDER BY relevance_score DESC, created_at DESC, challenge_id DESC\s+LIMIT \$8/.test(discoverySrc));
check('response order is the SQL order (no JS re-sort that desynchronises cursors)', !/scored\.sort|\.sort\(/.test(discoverySrc));
const clientApi = read('src/api/challengeDiscoveryApi.ts');
check('client composes the path through apiPath and carries the cursor', /apiPath\(/.test(clientApi) && /params\.set\('cursor'/.test(clientApi));
check('client does not depend on URLSearchParams.size (older Safari/Chrome would drop the cursor)', !/params\.size/.test(clientApi));
check('Explore pages with a cursor and offers Load more', /Load more Challenges/.test(explore) && /fetchNextPage/.test(explore) && /useInfiniteQuery/.test(read('src/v2/challenges/useChallengeDiscovery.ts')));
check('Explore uses the refreshed server relationship, not a permanent mutation override', /effectiveRelationship\(/.test(explore) && !/join\.isSuccess \? \(join\.data\.status/.test(explore));
const pend = { status: 'success', submittedAt: 1000, resultStatus: 'pending' };
check('before any refresh, the join response stands in (pending)', effectiveRelationship('none', pend, 900) === 'pending');
check('before any refresh, an immediate join shows member', effectiveRelationship('none', { status: 'success', submittedAt: 1000, resultStatus: 'active' }, 900) === 'member');
check('a newer read saying pending stays pending', effectiveRelationship('pending', pend, 1500) === 'pending');
check('REJECTED: a newer read saying none supersedes the earlier pending response', effectiveRelationship('none', pend, 1500) === 'none');
check('approved: a newer read saying member is member', effectiveRelationship('member', pend, 1500) === 'member');
check('a failed or idle mutation never overrides the server', effectiveRelationship('none', { status: 'error', submittedAt: 1000 }, 0) === 'none' && effectiveRelationship('pending', null, 0) === 'pending');
const p1 = { challenges: [{ challengeId: 'a' }, { challengeId: 'b' }] };
const p2 = { challenges: [{ challengeId: 'b' }, { challengeId: 'c' }] };
check('pages flatten in order without repeating an id', flattenDiscoveryPages([p1, p2]).map((x) => x.challengeId).join('') === 'abc' && flattenDiscoveryPages(undefined).length === 0);
check('window note appears only when more remain and names the real count', discoveryWindowNote(20, true, 'Challenges') === 'Showing the first 20 Challenges. Load more to see the rest.' && discoveryWindowNote(20, false, 'Challenges') === null);

console.log('F. join -> failed refetch -> Load more -> rejection -> recovery (real React Query semantics)');
{
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
  type EdgePage = { challenges: Array<{ challengeId: string; rel?: 'none' | 'pending' }>; nextCursor: string | null };
  let serverRel: 'none' | 'pending' = 'none';
  let failRefetch = false;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: Infinity } } });
  const observer = new InfiniteQueryObserver(client, {
    queryKey: ['p2-edge'],
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }: { pageParam: string | undefined }): Promise<EdgePage> => {
      if (failRefetch) throw new Error('discovery unavailable');
      return pageParam
        ? { challenges: [{ challengeId: 'p2' }], nextCursor: null }
        : { challenges: [{ challengeId: 'p1', rel: serverRel }], nextCursor: 'c2' };
    },
    getNextPageParam: (last: EdgePage) => last.nextCursor ?? undefined,
  });
  const tracker = createRefreshTracker();
  const unsubscribe = observer.subscribe((r) => { tracker.observe(r.dataUpdatedAt, r.isFetchingNextPage); });
  const view = (mutation: { status: string; submittedAt: number; resultStatus?: string } | null) => {
    const r = observer.getCurrentResult();
    const row = r.data?.pages[0].challenges[0].rel ?? 'none';
    return { fixed: effectiveRelationship(row, mutation, tracker.observe(r.dataUpdatedAt, r.isFetchingNextPage)), naive: effectiveRelationship(row, mutation, r.dataUpdatedAt) };
  };
  await observer.refetch();
  await sleep(5);
  const submittedAt = Date.now(); // member requests admission; response says pending
  const joined = { status: 'success', submittedAt, resultStatus: 'pending' };
  serverRel = 'pending';
  await sleep(5);
  failRefetch = true; await observer.refetch(); // the post-join refetch FAILS; row data is still the old 'none'
  check('failed refetch keeps pending provisionally', view(joined).fixed === 'pending');
  failRefetch = false; await sleep(5);
  await observer.fetchNextPage(); // Load more succeeds and advances dataUpdatedAt
  const afterMore = view(joined);
  check('Load more does not revert the row to an actionable Join', afterMore.fixed === 'pending');
  check('(the dataUpdatedAt-only check WOULD have reverted it — the defect this guards)', afterMore.naive === 'none');
  await sleep(5);
  serverRel = 'none'; // steward rejects
  await observer.refetch();
  check('a real refresh after rejection supersedes the provisional pending', view(joined).fixed === 'none');
  await sleep(5);
  const again = { status: 'success', submittedAt: Date.now(), resultStatus: 'pending' };
  check('member can request again: the new response is provisional until the next refresh', view(again).fixed === 'pending');
  serverRel = 'pending'; await sleep(5); await observer.refetch();
  check('and a later refresh saying pending keeps it pending', view(again).fixed === 'pending');
  unsubscribe(); client.clear();
}

if (failures > 0) { console.error(`\nP2 discovery guards: ${failures} failing.`); process.exit(1); }
console.log('\nP2 discovery guards: all passing.');
