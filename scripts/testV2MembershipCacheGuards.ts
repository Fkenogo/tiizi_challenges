/**
 * V2 membership cache lifecycle regression test (run: npm run test:v2-membership-cache).
 *
 * TIIZI-S2B-S2G-CORR-001: the S2b host read and the S2-G Groups read used
 * different query-key families, so the S2-G post-creation invalidation never
 * reached S2b and a newly created Group stayed invisible in Step 2 for up to
 * 60 seconds. Both journeys now share the canonical key family from
 * `src/v2/memberships/membershipQueryKeys.ts`.
 *
 * This is a BEHAVIOURAL test over a real TanStack QueryClient — not string
 * assertions. It replays the exact ITR P1 lifecycle with the production
 * staleTime (60s), the real canonical key factory, and the real S2-G
 * success-boundary invalidator:
 *
 *   A. membership query initially resolves to [];
 *   B. that [] is still fresh inside the normal stale window (a second read
 *      reuses it with no refetch — the trap the defect hid behind);
 *   C. governed Group creation succeeds (S2-G success boundary);
 *   D. S2-G success invalidates the SAME canonical query S2b consumes;
 *   E. the subsequent S2b host read refetches instead of retaining [];
 *   F. the new governed Group is selectable as host immediately — no
 *      60s wait, no reload, no refocus, no manual retry, no client
 *      insertion (exactly one refetch happens);
 *   G. per-user isolation: another signed-in user's cache entry is never
 *      served, merged, or replaced by this lifecycle.
 *
 * No emulator, database, or network access: the "server" is a counting
 * queryFn standing in for GET /v1/memberships/me.
 */
import { QueryClient } from '@tanstack/react-query';
import {
  invalidateV2Memberships,
  v2MembershipsKey,
} from '../src/v2/memberships/membershipQueryKeys.js';
import {
  assessVisibleStep,
  createInitialWizardState,
} from '../src/v2/challenges/challengeCreationDraft.js';
import type {
  ApiMembership,
  MyMembershipsResponse,
} from '../src/api/membershipsApi.js';

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

const STALE_WINDOW_MS = 60 * 1000; // mirrors useV2Memberships staleTime
const UID_A = 'founder-uid-a';
const UID_B = 'founder-uid-b';
const NEW_GROUP_ID = '44444444-4444-4444-8444-444444444444';

function membership(groupId: string, name: string): ApiMembership {
  return {
    groupId,
    role: 'owner',
    status: 'active',
    joinedAt: '2026-09-17T00:00:00.000Z',
    group: { id: groupId, name, description: '', isPrivate: false },
  };
}

function response(memberId: string, memberships: ApiMembership[]): MyMembershipsResponse {
  return { memberId, memberships };
}

async function main(): Promise<void> {
  const client = new QueryClient();

  // ─── Canonical key contract ────────────────────────────────────────────
  console.log('canonical key contract');
  check('one shared family for both journeys',
    JSON.stringify(v2MembershipsKey(UID_A)) === JSON.stringify(['v2-memberships', UID_A]));
  check('uid segment isolates users', v2MembershipsKey(UID_A)[1] !== v2MembershipsKey(UID_B)[1]);

  // ─── A. initial read resolves [] ───────────────────────────────────────
  console.log('empty → create → immediate host availability');
  let serverA: ApiMembership[] = [];
  let callsA = 0;
  const queryFnA = async (): Promise<MyMembershipsResponse> => {
    callsA += 1;
    return response('member-a', [...serverA]);
  };
  const first = await client.fetchQuery({
    queryKey: v2MembershipsKey(UID_A),
    queryFn: queryFnA,
    staleTime: STALE_WINDOW_MS,
  });
  check('A: membership query initially resolves to []',
    first.memberships.length === 0 && callsA === 1);

  // ─── B. [] is still fresh inside the stale window ──────────────────────
  // (TanStack stores no isStale flag on query state; freshness is proven
  // behaviourally: a second read reuses the cache with no refetch.)
  const freshState = client.getQueryState(v2MembershipsKey(UID_A));
  check('B: empty result is not invalidated inside the normal stale window',
    freshState?.isInvalidated === false);
  const second = await client.fetchQuery({
    queryKey: v2MembershipsKey(UID_A),
    queryFn: queryFnA,
    staleTime: STALE_WINDOW_MS,
  });
  check('B: fresh [] is reused with no refetch (the trap)',
    second.memberships.length === 0 && callsA === 1);

  // ─── G (setup). second user's cache primed before the lifecycle ────────
  console.log('per-user isolation');
  const serverB: ApiMembership[] = [membership('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Other Group')];
  let callsB = 0;
  const queryFnB = async (): Promise<MyMembershipsResponse> => {
    callsB += 1;
    return response('member-b', [...serverB]);
  };
  await client.fetchQuery({
    queryKey: v2MembershipsKey(UID_B),
    queryFn: queryFnB,
    staleTime: STALE_WINDOW_MS,
  });
  const bUpdatedAt = client.getQueryState(v2MembershipsKey(UID_B))?.dataUpdatedAt ?? 0;
  check('G: second user cache primed', callsB === 1);

  // ─── G (part 1). uid-scoped invalidation isolates users ────────────────
  await invalidateV2Memberships(client, UID_A);
  const bScoped = client.getQueryState(v2MembershipsKey(UID_B));
  check('G: uid-scoped invalidation leaves the other user fresh',
    bScoped?.isInvalidated !== true && (bScoped?.dataUpdatedAt ?? -1) === bUpdatedAt);

  // ─── C + D. governed creation succeeds; S2-G boundary invalidates ─────
  // The server now holds the governed Group (POST /v1/groups succeeded).
  serverA = [membership(NEW_GROUP_ID, 'Tiizi Founders Fitness Group')];
  // This is the exact S2-G useCreateGroup onSuccess body.
  await invalidateV2Memberships(client);
  const staleState = client.getQueryState(v2MembershipsKey(UID_A));
  check('D: S2-G success invalidates the canonical S2b query',
    staleState?.isInvalidated === true);

  // ─── E. S2b host read refetches ────────────────────────────────────────
  const third = await client.fetchQuery({
    queryKey: v2MembershipsKey(UID_A),
    queryFn: queryFnA,
    staleTime: STALE_WINDOW_MS,
  });
  check('E: host read refetches instead of retaining []', callsA === 2);

  // ─── F. new Group selectable immediately, no extras ────────────────────
  check('F: new governed Group returned by the refetch',
    third.memberships.length === 1 && third.memberships[0].groupId === NEW_GROUP_ID);
  const hosted = {
    ...createInitialWizardState(new Date(2026, 5, 1)),
    challengeType: 'competitive' as const,
    groupId: third.memberships[0].groupId,
    groupName: third.memberships[0].group.name,
    title: 'June Race',
  };
  check('F: new Group selectable as Challenge host without reload/retry',
    assessVisibleStep(hosted, 'WHO_IS_HOSTING').complete === true && callsA === 2);

  // ─── G (part 2). family prefix marks stale but never merges data ──────
  const bCached = client.getQueryData<MyMembershipsResponse>(v2MembershipsKey(UID_B));
  check('G: invalidation never merges data across users',
    (bCached?.memberships.length ?? -1) === 1
    && bCached?.memberships[0].groupId === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
  const bRefetch = await client.fetchQuery({
    queryKey: v2MembershipsKey(UID_B),
    queryFn: queryFnB,
    staleTime: STALE_WINDOW_MS,
  });
  check('G: other user refetch still serves only their own memberships',
    callsB === 2 && bRefetch.memberships[0].groupId === 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

  await client.clear();
  if (failures > 0) {
    console.error(`\nV2 membership cache guards: ${failures} failure(s).`);
    process.exit(1);
  }
  console.log('\nV2 membership cache guards: all passing.');
}

void main().catch((error: unknown) => {
  console.error(`V2 membership cache guards crashed: ${(error as Error).message}`);
  process.exit(1);
});
