/**
 * S3a participation cache-coherence regression guard
 * (run: npm run test:s3a-participation-cache).
 *
 * TIIZI-S3A-PARTICIPATION-ACCESS-001: join/withdraw mutations must never
 * invalidate only one V2 Challenge cache family. Before the S3a contract
 * the S2b screens read `v2-challenge-list` / `v2-challenge-detail` while
 * the mutations invalidated the legacy `v2-challenges` / `v2-challenge`
 * family (and vice versa) — the same parallel-family shape as the
 * S2-G/S2b membership defect, leaving a pre-join/pre-withdraw
 * `myParticipation` snapshot served as fresh for up to its staleTime.
 *
 * Behavioural test over a real TanStack QueryClient (no emulator, DB, or
 * network):
 *
 *   A. canonical list + detail and legacy list + detail resolve and are
 *      fresh inside their stale windows (the trap the defect hid behind);
 *   B. a governed join/withdraw success boundary runs
 *      `invalidateV2ChallengeReads` (the ONLY invalidation path the S3a
 *      and legacy hooks use);
 *   C. all four families are stale afterwards, so the next read refetches
 *      authoritative `myParticipation` instead of retaining the snapshot;
 *   D. per-user isolation: another member's list entry is never marked
 *      stale by this member's action;
 *   E. static contract: no V2 challenge hook invalidates a `v2-*` family
 *      with a repeated array literal — post-join/post-withdraw
 *      invalidation runs only through `invalidateV2ChallengeReads`
 *      (query definitions keep their existing keys; the success boundary
 *      is what must never diverge again).
 */
import { readFileSync } from 'node:fs';
import { QueryClient } from '@tanstack/react-query';
import {
  V2_CHALLENGE_DETAIL_SCOPE,
  V2_CHALLENGE_LIST_SCOPE,
  V2_LEGACY_CHALLENGE_LIST_SCOPE,
  V2_LEGACY_CHALLENGE_SCOPE,
  invalidateV2ChallengeReads,
  v2ChallengeDetailKey,
  v2ChallengeListKey,
} from '../src/v2/challenges/challengeQueryKeys.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const UID_A = 'member-uid-a';
const UID_B = 'member-uid-b';
const CHALLENGE_ID = '11111111-1111-4111-8111-111111111111';

async function main(): Promise<void> {
  const client = new QueryClient();
  let refetches = 0;
  const server = async () => {
    refetches += 1;
    return { ok: true };
  };

  // ─── Key contract ──────────────────────────────────────────────────
  console.log('canonical key contract');
  check(
    'list key shape',
    JSON.stringify(v2ChallengeListKey(UID_A)) === JSON.stringify([V2_CHALLENGE_LIST_SCOPE, UID_A]),
  );
  check(
    'detail key shape',
    JSON.stringify(v2ChallengeDetailKey(CHALLENGE_ID, UID_A))
      === JSON.stringify([V2_CHALLENGE_DETAIL_SCOPE, CHALLENGE_ID, UID_A]),
  );
  check('uid segment isolates members', v2ChallengeListKey(UID_A)[1] !== v2ChallengeListKey(UID_B)[1]);

  // ─── Seed all four families as fresh ───────────────────────────────
  await client.prefetchQuery({
    queryKey: v2ChallengeListKey(UID_A),
    queryFn: server,
    staleTime: 30 * 1000,
  });
  await client.prefetchQuery({
    queryKey: v2ChallengeDetailKey(CHALLENGE_ID, UID_A),
    queryFn: server,
    staleTime: 10 * 1000,
  });
  await client.prefetchQuery({
    queryKey: [V2_LEGACY_CHALLENGE_LIST_SCOPE, UID_A],
    queryFn: server,
    staleTime: 60 * 1000,
  });
  await client.prefetchQuery({
    queryKey: [V2_LEGACY_CHALLENGE_SCOPE, CHALLENGE_ID, UID_A],
    queryFn: server,
    staleTime: 30 * 1000,
  });
  // Another member's list entry — must survive this member's action.
  await client.prefetchQuery({
    queryKey: v2ChallengeListKey(UID_B),
    queryFn: server,
    staleTime: 30 * 1000,
  });
  const seededFetches = refetches;

  console.log('pre-mutation freshness (the defect trap)');
  check('canonical list fresh', client.getQueryState(v2ChallengeListKey(UID_A))?.isInvalidated !== true
    && (client.getQueryState(v2ChallengeListKey(UID_A))?.dataUpdatedAt ?? 0) > 0);
  check('canonical detail fresh', (client.getQueryState(v2ChallengeDetailKey(CHALLENGE_ID, UID_A))?.dataUpdatedAt ?? 0) > 0);
  check('legacy list fresh', (client.getQueryState([V2_LEGACY_CHALLENGE_LIST_SCOPE, UID_A])?.dataUpdatedAt ?? 0) > 0);
  check('legacy detail fresh', (client.getQueryState([V2_LEGACY_CHALLENGE_SCOPE, CHALLENGE_ID, UID_A])?.dataUpdatedAt ?? 0) > 0);

  // ─── Governed join/withdraw success boundary ───────────────────────
  console.log('post-mutation invalidation');
  await invalidateV2ChallengeReads(client, UID_A, CHALLENGE_ID);

  check('canonical list stale', client.getQueryState(v2ChallengeListKey(UID_A))?.isInvalidated === true);
  check(
    'canonical detail stale',
    client.getQueryState(v2ChallengeDetailKey(CHALLENGE_ID, UID_A))?.isInvalidated === true,
  );
  check(
    'legacy list stale',
    client.getQueryState([V2_LEGACY_CHALLENGE_LIST_SCOPE, UID_A])?.isInvalidated === true,
  );
  check(
    'legacy detail stale',
    client.getQueryState([V2_LEGACY_CHALLENGE_SCOPE, CHALLENGE_ID, UID_A])?.isInvalidated === true,
  );
  check(
    'other member list untouched',
    client.getQueryState(v2ChallengeListKey(UID_B))?.isInvalidated !== true,
  );

  // The next read of each family refetches (no client-inserted truth).
  await client.refetchQueries({ queryKey: v2ChallengeListKey(UID_A) });
  await client.refetchQueries({ queryKey: v2ChallengeDetailKey(CHALLENGE_ID, UID_A) });
  check('refetch re-proves truth (no silent reuse)', refetches > seededFetches);

  // ─── Static contract: invalidations run only via the contract ──────
  console.log('static key contract');
  const hookSources = [
    'src/v2/challenges/useChallengeCreation.ts',
    'src/hooks/useV2Challenges.ts',
  ];
  const invalidateLiteralRe = /invalidateQueries\(\{\s*queryKey:\s*\['v2-challenge/;
  for (const file of hookSources) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    check(`${file} invalidates only via the contract`, !invalidateLiteralRe.test(source));
  }
  const contract = readFileSync(
    new URL('../src/v2/challenges/challengeQueryKeys.ts', import.meta.url),
    'utf8',
  );
  check('contract owns every family scope', ['v2-challenge-list', 'v2-challenge-detail', 'v2-challenges', 'v2-challenge']
    .every((scope) => contract.includes(`'${scope}'`)));

  if (failures > 0) {
    console.error(`\nS3a participation cache guard: ${failures} failure(s)`);
    process.exit(1);
  }
  console.log('\nS3a participation cache guard: PASS');
}

void main().catch((error) => {
  console.error('S3a participation cache guard crashed:', error);
  process.exit(1);
});
