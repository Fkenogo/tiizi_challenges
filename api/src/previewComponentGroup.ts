/**
 * Local-only Group context for the PF-05 Challenge Creation component preview.
 *
 * The fixture is deliberately not a shortcut around Group authority. It uses
 * the same governed mutation domain as the API route, writes Firestore first,
 * then retains PG only as a shadow/identity anchor. A shadow row is never
 * enough to return preview context: live Group and owner Membership must both
 * be present and active.
 */
import type { Db } from './db.js';
import {
  createGovernedGroup,
  type GroupMutationActor,
  type GroupMutationStore,
} from './groupMutations.js';

export const PREVIEW_COMPONENT_GROUP_NAME = 'Tiizi PF-05 Challenge Creation Preview';

export interface PreviewComponentGroup {
  id: string;
  legacyId: string;
  name: typeof PREVIEW_COMPONENT_GROUP_NAME;
  status: 'created' | 'existing';
}

type PreviewEnvironment = Record<string, string | undefined>;

function assertLoopbackHost(rawHost: string | undefined, port: string, label: string): void {
  if (!rawHost?.trim()) throw new Error(`preview component requires ${label}`);
  let parsed: URL;
  try {
    parsed = new URL(`http://${rawHost}`);
  } catch {
    throw new Error(`preview component requires a valid ${label}`);
  }
  const loopback = parsed.hostname === '127.0.0.1'
    || parsed.hostname === 'localhost'
    || parsed.hostname === '::1';
  if (!loopback || parsed.port !== port || parsed.pathname !== '/') {
    throw new Error(`preview component refuses a non-local ${label}`);
  }
}

/** Refuses production and every non-emulator target before fixture work begins. */
export function assertLocalPreviewComponentRuntime(env: PreviewEnvironment = process.env): void {
  if (env.FIREBASE_PROJECT_ID !== 'demo-tiizi-pf05-preview') {
    throw new Error('preview component requires the demo-tiizi-pf05-preview Firebase project');
  }
  assertLoopbackHost(env.FIREBASE_AUTH_EMULATOR_HOST, '9099', 'Auth emulator');
  assertLoopbackHost(env.FIRESTORE_EMULATOR_HOST, '8080', 'Firestore emulator');
}

export function isLocalPreviewComponentRuntime(env: PreviewEnvironment = process.env): boolean {
  try {
    assertLocalPreviewComponentRuntime(env);
    return true;
  } catch {
    return false;
  }
}

interface PreviewShadowRow {
  group_id: string;
  legacy_firestore_id: string | null;
}

async function findPreviewShadow(
  db: Db,
  actor: GroupMutationActor,
): Promise<PreviewShadowRow | null> {
  const result = await db.query<PreviewShadowRow>(
    `SELECT g.group_id, g.legacy_firestore_id
       FROM groups g
       JOIN group_memberships gm ON gm.group_id = g.group_id
      WHERE gm.member_id = $1
        AND gm.role = 'owner'
        AND g.name = $2
      ORDER BY g.created_at ASC
      LIMIT 1`,
    [actor.memberId, PREVIEW_COMPONENT_GROUP_NAME],
  );
  return result.rows[0] ?? null;
}

async function assertLivePreviewOwnerMembership(
  store: GroupMutationStore,
  legacyId: string,
  firebaseUid: string,
): Promise<void> {
  const group = await store.getGroup(legacyId);
  const membership = await store.getMembership(legacyId, firebaseUid);
  if (
    !group
    || group.name !== PREVIEW_COMPONENT_GROUP_NAME
    || group.status !== 'active'
    || !membership
    || membership.userId !== firebaseUid
    || membership.role !== 'owner'
    || membership.status !== 'active'
  ) {
    throw new Error('preview component shadow has no live owner membership under Firestore authority');
  }
}

/**
 * Returns one deterministic Group per preview Founder. PG finds a possible
 * existing fixture but Firestore validates it; only a missing fixture invokes
 * the existing governed create operation.
 */
export async function ensurePreviewComponentGroup(
  db: Db,
  store: GroupMutationStore,
  actor: GroupMutationActor,
): Promise<PreviewComponentGroup> {
  const existing = await findPreviewComponentGroup(db, store, actor);
  if (existing) return { ...existing, status: 'existing' };

  const created = await createGovernedGroup(db, store, actor, {
    name: PREVIEW_COMPONENT_GROUP_NAME,
    description: 'Local-only governed context for PF-05 Challenge Creation component review.',
    isPrivate: true,
    requireAdminApproval: true,
    allowMemberChallenges: true,
  });
  return {
    id: created.id,
    legacyId: created.legacyId,
    name: PREVIEW_COMPONENT_GROUP_NAME,
    status: 'created',
  };
}

/** Reads fixture context without creating it; a browser route has no write side effect. */
export async function findPreviewComponentGroup(
  db: Db,
  store: GroupMutationStore,
  actor: GroupMutationActor,
): Promise<Omit<PreviewComponentGroup, 'status'> | null> {
  const existing = await findPreviewShadow(db, actor);
  if (!existing?.legacy_firestore_id) return null;
  await assertLivePreviewOwnerMembership(store, existing.legacy_firestore_id, actor.firebaseUid);
  return {
    id: existing.group_id,
    legacyId: existing.legacy_firestore_id,
    name: PREVIEW_COMPONENT_GROUP_NAME,
  };
}
