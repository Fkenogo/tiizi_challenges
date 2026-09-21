/**
 * CORR-002 §13 — permanent finalized-query lifecycle regression.
 *
 * Run: npm run test:s3c-finalized-query
 *
 * Proves the actual competitive hook/query lifecycle around finalization:
 *   finalized competitive Challenge:
 *     getCompetitiveLeaderboardV2 transport calls = 0
 *   active/unfinalized competitive Challenge:
 *     getCompetitiveLeaderboardV2 transport calls = 1
 *
 * The lifecycle is driven through a real `QueryClient` using the hook's
 * real query key (`v2ChallengeLeaderboardKey`) and the hook's real
 * enablement predicate (`competitiveLeaderboardEnabledForS3c`, the exact
 * expression `useCompetitiveLeaderboardV2` gates its `enabled` flag on).
 * The counted queryFn stands in for the leaderboard transport: what this
 * regression owns is WHETHER the transport runs, which is precisely the
 * finalized-gating risk (frozen final authority must never be fetched as
 * S3c live state). Server behaviour behind the transport is proven by the
 * real-seam api suites.
 *
 * Source-string coupling keeps the regression bound to the actual hook:
 * if the hook stops gating on `competitiveLeaderboardEnabledForS3c`, stops
 * calling `getCompetitiveLeaderboardV2`, or the live surface stops
 * unmounting once finalized, this script fails.
 */
import { readFileSync } from 'node:fs';
import { QueryClient } from '@tanstack/react-query';
import { v2ChallengeLeaderboardKey } from '../src/v2/challenges/challengeQueryKeys.js';
import { competitiveLeaderboardEnabledForS3c } from '../src/v2/challenges/progressView.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const read = (path: string): string =>
  readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const CHALLENGE_ID = '22222222-2222-4222-8222-222222222222';
const UID = 'member-uid-finalized-lifecycle';

/**
 * Mirrors the `enabled` expression of `useCompetitiveLeaderboardV2`
 * (uid + configured transport + challenge id + S3c enablement), then runs
 * the leaderboard query through a real QueryClient exactly once when
 * enabled. Returns the number of transport calls made.
 */
async function transportCallsFor(opts: {
  challengeType: string | undefined;
  finalized: boolean;
}): Promise<number> {
  let transportCalls = 0;
  const client = new QueryClient();
  const enabled =
    !!UID &&
    !!CHALLENGE_ID &&
    competitiveLeaderboardEnabledForS3c(opts.challengeType, opts.finalized === true);
  if (enabled) {
    await client.fetchQuery({
      queryKey: v2ChallengeLeaderboardKey(CHALLENGE_ID, UID),
      queryFn: async () => {
        transportCalls += 1;
        return { challengeId: CHALLENGE_ID, challengeType: 'competitive', entries: [] };
      },
      staleTime: 10 * 1000,
    });
  }
  return transportCalls;
}

console.log('finalized-query lifecycle');
const finalizedCalls = await transportCallsFor({ challengeType: 'competitive', finalized: true });
check(
  'finalized competitive Challenge: getCompetitiveLeaderboardV2 transport calls = 0',
  finalizedCalls === 0,
  `observed ${finalizedCalls}`,
);
const activeCalls = await transportCallsFor({ challengeType: 'competitive', finalized: false });
check(
  'active/unfinalized competitive Challenge: getCompetitiveLeaderboardV2 transport calls = 1',
  activeCalls === 1,
  `observed ${activeCalls}`,
);
check(
  'non-competitive Challenges never enable the leaderboard query',
  competitiveLeaderboardEnabledForS3c('collective', false) === false
    && competitiveLeaderboardEnabledForS3c('streak', false) === false
    && competitiveLeaderboardEnabledForS3c(undefined, false) === false,
);

console.log('hook coupling (the regression stays bound to the actual hook)');
const hookSrc = read('src/v2/challenges/useChallengeCreation.ts');
const competitiveSrc = read('src/v2/challenges/V2CompetitiveProgress.tsx');
check(
  'leaderboard hook gates on the S3c enablement with finalized',
  hookSrc.includes('competitiveLeaderboardEnabledForS3c') && hookSrc.includes('finalized'),
);
check(
  'leaderboard hook transport is getCompetitiveLeaderboardV2',
  hookSrc.includes('queryFn: () => getCompetitiveLeaderboardV2(challengeId as string)'),
);
check(
  'finalized competitive unmounts the S3c live surface (no final-as-live)',
  competitiveSrc.includes('if (detail.finalized) return null'),
);

if (failures > 0) {
  console.error(`\n${failures} finalized-query lifecycle check(s) FAILED`);
  process.exit(1);
}
console.log('\nfinalized-query lifecycle: all checks passed');
