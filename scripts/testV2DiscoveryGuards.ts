/**
 * TIIZI-FER-P2-001 — preference-based discovery guards
 * (run: npm run test:v2-discovery). Ranking/authorization behaviour is proven
 * against PostgreSQL in api/test/p2PreferenceDiscovery.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { discoveryCaption, hasRelevance, relevanceBadges } from '../src/v2/challenges/discoveryRelevance';
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

if (failures > 0) { console.error(`\nP2 discovery guards: ${failures} failing.`); process.exit(1); }
console.log('\nP2 discovery guards: all passing.');
