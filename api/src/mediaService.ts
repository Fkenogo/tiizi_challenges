import { randomUUID } from 'node:crypto';
import type { Db } from './db.js';
import {
  ImageValidationError,
  validateAndOptimizeImage,
  type MediaPurpose,
} from './imageProcessing.js';
import type { ObjectStore } from './r2ObjectStore.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const IDEMPOTENCY_KEY_RE = /^[A-Za-z0-9_-]{8,64}$/;
const INTENT_TTL_HOURS = 24;
const MAX_INTENTS_PER_24H = 30;

export type MediaImageProjection =
  | { status: 'not_configured' }
  | { status: 'none' }
  | {
      status: 'ready';
      assetId: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
    };

export class MediaServiceError extends Error {
  constructor(
    readonly statusCode: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface MediaAssetRow {
  asset_id: string;
  object_key: string;
  content_type: string;
  width: number;
  height: number;
  status: string;
  suppressed_at: string | Date | null;
}

export function projectMediaAsset(
  asset: MediaAssetRow | null | undefined,
  store: ObjectStore | null,
  readUrlTtlSeconds: number,
): MediaImageProjection {
  if (!store) {
    return { status: 'not_configured' };
  }
  if (!asset || asset.status !== 'ready' || asset.suppressed_at !== null) {
    return { status: 'none' };
  }
  return {
    status: 'ready',
    assetId: asset.asset_id,
    url: store.getSignedReadUrl({
      key: asset.object_key,
      expiresInSeconds: readUrlTtlSeconds,
      responseCacheControl: 'private, no-store',
    }),
    contentType: asset.content_type,
    width: asset.width,
    height: asset.height,
  };
}

export async function resolveReadyMediaAssetsByIds(
  db: Db,
  assetIds: readonly (string | null | undefined)[],
): Promise<Map<string, MediaAssetRow>> {
  const uniqueIds = Array.from(
    new Set(assetIds.filter((id): id is string => typeof id === 'string' && UUID_RE.test(id))),
  );
  const map = new Map<string, MediaAssetRow>();
  if (uniqueIds.length === 0) return map;

  const result = await db.query<MediaAssetRow>(
    `SELECT asset_id, object_key, content_type, width, height, status, suppressed_at
       FROM media_assets
      WHERE asset_id = ANY($1::uuid[])
        AND status = 'ready'
        AND suppressed_at IS NULL`,
    [uniqueIds],
  );
  for (const row of result.rows) {
    map.set(row.asset_id, row);
  }
  return map;
}

function ownerScopeForPurpose(purpose: MediaPurpose): 'member' | 'group' | 'challenge' {
  if (purpose === 'profile_image') return 'member';
  if (purpose === 'group_cover') return 'group';
  return 'challenge';
}

export async function createMediaUploadIntent(
  db: Db,
  params: {
    actorMemberId: string;
    purpose: unknown;
    targetScopeId?: unknown;
    idempotencyKey: unknown;
  },
): Promise<{ intentId: string; status: string; expiresAt: string }> {
  if (
    params.purpose !== 'profile_image' &&
    params.purpose !== 'group_cover' &&
    params.purpose !== 'challenge_cover'
  ) {
    throw new MediaServiceError(400, 'invalid_purpose', 'Media purpose is invalid');
  }
  const purpose = params.purpose;

  if (typeof params.idempotencyKey !== 'string' || !IDEMPOTENCY_KEY_RE.test(params.idempotencyKey.trim())) {
    throw new MediaServiceError(400, 'invalid_idempotency_key', 'idempotencyKey must be 8-64 safe characters');
  }
  const idempotencyKey = params.idempotencyKey.trim();

  let targetScopeId: string | null = null;
  if (params.targetScopeId !== undefined && params.targetScopeId !== null && params.targetScopeId !== '') {
    if (typeof params.targetScopeId !== 'string' || !UUID_RE.test(params.targetScopeId)) {
      throw new MediaServiceError(400, 'invalid_target_scope', 'targetScopeId must be a valid UUID');
    }
    targetScopeId = params.targetScopeId;
  }

  if (purpose === 'profile_image') {
    if (targetScopeId && targetScopeId !== params.actorMemberId) {
      throw new MediaServiceError(403, 'forbidden', 'Cannot create a profile image intent for another member');
    }
    targetScopeId = params.actorMemberId;
  } else {
    if (!targetScopeId) {
      throw new MediaServiceError(400, 'invalid_target_scope', 'targetScopeId is required for Group and Challenge covers');
    }
    if (purpose === 'group_cover') {
      const roleCheck = await db.query<{ allowed: boolean }>(
        `SELECT (g.status = 'active' AND g.steward_member_id = $2) AS allowed
           FROM groups g
          WHERE g.group_id = $1`,
        [targetScopeId, params.actorMemberId],
      );
      if (roleCheck.rows[0]?.allowed !== true) {
        throw new MediaServiceError(403, 'forbidden', 'Only the Group Steward can upload a Group cover');
      }
    } else if (purpose === 'challenge_cover') {
      const groupOrChallenge = await db.query<{ allowed: boolean }>(
        `SELECT (
           EXISTS (
             SELECT 1 FROM groups g
              WHERE g.group_id = $1 AND g.status = 'active' AND g.steward_member_id = $2
           )
           OR EXISTS (
             SELECT 1 FROM groups g
             LEFT JOIN group_memberships gm
               ON gm.group_id = g.group_id AND gm.member_id = $2
              WHERE g.group_id = $1 AND g.status = 'active'
                AND gm.status IN ('active', 'joined')
                AND (g.steward_member_id = $2 OR g.allow_member_challenges = true)
           )
           OR EXISTS (
             SELECT 1 FROM challenges c
             JOIN groups g ON g.group_id = c.group_id
              WHERE c.challenge_id = $1 AND g.status = 'active' AND g.steward_member_id = $2
           )
         ) AS allowed`,
        [targetScopeId, params.actorMemberId],
      );
      if (!groupOrChallenge.rows[0]?.allowed) {
        throw new MediaServiceError(403, 'forbidden', 'Not authorized to upload a cover for this scope');
      }
    }
  }

  const recentCount = await db.query<{ count: string }>(
    `SELECT count(*)::text AS count
       FROM media_upload_intents
      WHERE actor_member_id = $1
        AND created_at > now() - interval '24 hours'`,
    [params.actorMemberId],
  );
  if (Number.parseInt(recentCount.rows[0]?.count ?? '0', 10) >= MAX_INTENTS_PER_24H) {
    throw new MediaServiceError(429, 'media_quota_exceeded', 'Too many media upload intents in 24 hours');
  }

  const expiresAt = new Date(Date.now() + INTENT_TTL_HOURS * 60 * 60 * 1000).toISOString();
  await db.query(
    `INSERT INTO media_upload_intents (
       actor_member_id, purpose, target_scope_id, idempotency_key, status, expires_at
     ) VALUES ($1, $2, $3, $4, 'open', $5::timestamptz)
     ON CONFLICT (actor_member_id, purpose, idempotency_key) DO NOTHING`,
    [params.actorMemberId, purpose, targetScopeId, idempotencyKey, expiresAt],
  );

  const row = await db.query<{ intent_id: string; status: string; expires_at: Date | string }>(
    `SELECT intent_id, status, expires_at
       FROM media_upload_intents
      WHERE actor_member_id = $1 AND purpose = $2 AND idempotency_key = $3`,
    [params.actorMemberId, purpose, idempotencyKey],
  );
  const intent = row.rows[0];
  return {
    intentId: intent.intent_id,
    status: intent.status,
    expiresAt: intent.expires_at instanceof Date ? intent.expires_at.toISOString() : String(intent.expires_at),
  };
}

export async function uploadMediaIntentContent(
  db: Db,
  store: ObjectStore | null,
  params: {
    intentId: string;
    actorMemberId: string;
    rawBytes: Buffer;
  },
): Promise<{ intentId: string; assetId: string; status: 'uploaded'; width: number; height: number; byteSize: number }> {
  if (!store) {
    throw new MediaServiceError(503, 'media_unavailable', 'Media storage is not configured');
  }
  if (!UUID_RE.test(params.intentId)) {
    throw new MediaServiceError(400, 'invalid_intent', 'intentId must be a valid UUID');
  }

  const check = await db.query<{
    intent_id: string;
    actor_member_id: string;
    purpose: MediaPurpose;
    status: string;
    expires_at: Date | string;
    asset_id: string | null;
  }>(
    `SELECT intent_id, actor_member_id, purpose, status, expires_at, asset_id
       FROM media_upload_intents
      WHERE intent_id = $1`,
    [params.intentId],
  );
  const intent = check.rows[0];
  if (!intent || intent.actor_member_id !== params.actorMemberId) {
    throw new MediaServiceError(404, 'intent_not_found', 'Upload intent not found');
  }
  if (intent.status !== 'open') {
    throw new MediaServiceError(409, 'intent_not_open', `Upload intent is already ${intent.status}`);
  }
  const expiresMs = new Date(intent.expires_at).getTime();
  if (!Number.isFinite(expiresMs) || expiresMs <= Date.now()) {
    throw new MediaServiceError(410, 'intent_expired', 'Upload intent has expired');
  }

  let processed;
  try {
    processed = await validateAndOptimizeImage(params.rawBytes, intent.purpose);
  } catch (err) {
    if (err instanceof ImageValidationError) {
      throw new MediaServiceError(err.statusCode, err.code, err.message);
    }
    throw err;
  }

  const assetId = randomUUID();
  const objectKey = `tiizi/${intent.purpose}/${assetId}.webp`;
  await store.putObject({
    key: objectKey,
    body: processed.buffer,
    contentType: processed.contentType,
  });

  try {
    await db.transaction(async (tx) => {
      const lockRes = await tx.query<{ status: string }>(
        `SELECT status FROM media_upload_intents WHERE intent_id = $1 FOR UPDATE`,
        [intent.intent_id],
      );
      if (lockRes.rows[0]?.status !== 'open') {
        throw new MediaServiceError(409, 'intent_not_open', 'Upload intent is no longer open');
      }
      await tx.query(
        `INSERT INTO media_assets (
           asset_id, owner_scope, owner_id, purpose, status, object_key,
           content_type, byte_size, width, height, uploaded_by_member_id
         ) VALUES ($1, $2, NULL, $3, 'pending', $4, $5, $6, $7, $8, $9)`,
        [
          assetId,
          ownerScopeForPurpose(intent.purpose),
          intent.purpose,
          objectKey,
          processed.contentType,
          processed.byteSize,
          processed.width,
          processed.height,
          params.actorMemberId,
        ],
      );
      await tx.query(
        `UPDATE media_upload_intents
            SET status = 'uploaded', asset_id = $2
          WHERE intent_id = $1`,
        [intent.intent_id, assetId],
      );
    });
  } catch (err) {
    await store.deleteObject({ key: objectKey }).catch(() => {});
    throw err;
  }

  return {
    intentId: intent.intent_id,
    assetId,
    status: 'uploaded',
    width: processed.width,
    height: processed.height,
    byteSize: processed.byteSize,
  };
}

export async function bindIntentInTransaction(
  tx: Db,
  params: {
    intentId: string;
    actorMemberId: string;
    expectedPurpose: MediaPurpose;
    expectedTargetScopeId: string;
    ownerScope: 'member' | 'group' | 'challenge';
    ownerId: string;
  },
): Promise<{ assetId: string }> {
  if (!UUID_RE.test(params.intentId)) {
    throw new MediaServiceError(400, 'invalid_intent', 'intentId must be a valid UUID');
  }
  const res = await tx.query<{
    intent_id: string;
    actor_member_id: string;
    purpose: string;
    status: string;
    asset_id: string | null;
    target_scope_id: string | null;
    expires_at: Date | string;
  }>(
    `SELECT intent_id, actor_member_id, purpose, status, asset_id, target_scope_id, expires_at
       FROM media_upload_intents
      WHERE intent_id = $1
      FOR UPDATE`,
    [params.intentId],
  );
  const intent = res.rows[0];
  if (!intent || intent.actor_member_id !== params.actorMemberId) {
    throw new MediaServiceError(404, 'intent_not_found', 'Upload intent not found');
  }
  if (intent.purpose !== params.expectedPurpose) {
    throw new MediaServiceError(400, 'intent_purpose_mismatch', 'Upload intent purpose does not match');
  }
  if (intent.target_scope_id !== params.expectedTargetScopeId) {
    throw new MediaServiceError(403, 'intent_scope_mismatch', 'Upload intent does not belong to this scope');
  }
  if (intent.status !== 'uploaded' || !intent.asset_id) {
    throw new MediaServiceError(409, 'intent_not_uploaded', 'Upload intent has no uploaded image ready');
  }
  if (new Date(intent.expires_at).getTime() <= Date.now()) {
    throw new MediaServiceError(410, 'intent_expired', 'Upload intent has expired');
  }

  const assetUpdate = await tx.query<{ asset_id: string }>(
    `UPDATE media_assets
        SET status = 'ready', owner_scope = $2, owner_id = $3
      WHERE asset_id = $1 AND status = 'pending'
      RETURNING asset_id`,
    [intent.asset_id, params.ownerScope, params.ownerId],
  );
  if (assetUpdate.rows.length === 0) {
    throw new MediaServiceError(409, 'asset_not_bindable', 'Media asset is no longer bindable');
  }

  await tx.query(
    `UPDATE media_upload_intents SET status = 'bound' WHERE intent_id = $1`,
    [intent.intent_id],
  );

  return { assetId: intent.asset_id };
}

export async function suppressAndDeleteOldAsset(
  db: Db,
  store: ObjectStore | null,
  oldAssetId: string | null | undefined,
): Promise<void> {
  if (!oldAssetId || !UUID_RE.test(oldAssetId)) return;
  const res = await db.query<{ object_key: string }>(
    `UPDATE media_assets
        SET status = 'delete_pending',
            suppressed_at = COALESCE(suppressed_at, now()),
            delete_after = COALESCE(delete_after, now())
      WHERE asset_id = $1
      RETURNING object_key`,
    [oldAssetId],
  );
  const key = res.rows[0]?.object_key;
  if (key && store) {
    try {
      await store.deleteObject({ key });
      await db.query(
        `UPDATE media_assets SET status = 'deleted', deleted_at = now() WHERE asset_id = $1`,
        [oldAssetId],
      );
    } catch {
      // Leave as delete_pending for retry cleanup
    }
  }
}

export async function setOwnProfileImage(
  db: Db,
  store: ObjectStore | null,
  params: { memberId: string; intentId: string },
  readUrlTtlSeconds: number,
): Promise<MediaImageProjection> {
  if (!store) {
    throw new MediaServiceError(503, 'media_unavailable', 'Media storage is not configured');
  }

  const { newAssetId, oldAssetId } = await db.transaction(async (tx) => {
    const memberRes = await tx.query<{ profile_image_asset_id: string | null }>(
      `SELECT profile_image_asset_id FROM members WHERE member_id = $1 FOR UPDATE`,
      [params.memberId],
    );
    if (memberRes.rows.length === 0) {
      throw new MediaServiceError(404, 'member_not_found', 'Member not found');
    }
    const previousId = memberRes.rows[0].profile_image_asset_id;
    const { assetId } = await bindIntentInTransaction(tx, {
      intentId: params.intentId,
      actorMemberId: params.memberId,
      expectedPurpose: 'profile_image',
      expectedTargetScopeId: params.memberId,
      ownerScope: 'member',
      ownerId: params.memberId,
    });
    await tx.query(
      `UPDATE members SET profile_image_asset_id = $2, updated_at = now() WHERE member_id = $1`,
      [params.memberId, assetId],
    );
    if (previousId && previousId !== assetId) {
      await tx.query(
        `UPDATE media_assets
            SET status = 'replaced', suppressed_at = now(), delete_after = now()
          WHERE asset_id = $1`,
        [previousId],
      );
    }
    return { newAssetId: assetId, oldAssetId: previousId };
  });

  if (oldAssetId && oldAssetId !== newAssetId) {
    await suppressAndDeleteOldAsset(db, store, oldAssetId);
  }

  const assets = await resolveReadyMediaAssetsByIds(db, [newAssetId]);
  return projectMediaAsset(assets.get(newAssetId), store, readUrlTtlSeconds);
}

export async function removeOwnProfileImage(
  db: Db,
  store: ObjectStore | null,
  params: { memberId: string },
): Promise<MediaImageProjection> {
  const oldAssetId = await db.transaction(async (tx) => {
    const memberRes = await tx.query<{ profile_image_asset_id: string | null }>(
      `SELECT profile_image_asset_id FROM members WHERE member_id = $1 FOR UPDATE`,
      [params.memberId],
    );
    if (memberRes.rows.length === 0) {
      throw new MediaServiceError(404, 'member_not_found', 'Member not found');
    }
    const previousId = memberRes.rows[0].profile_image_asset_id;
    if (!previousId) return null;
    await tx.query(
      `UPDATE members SET profile_image_asset_id = NULL, updated_at = now() WHERE member_id = $1`,
      [params.memberId],
    );
    await tx.query(
      `UPDATE media_assets
          SET status = 'delete_pending', suppressed_at = now(), delete_after = now()
        WHERE asset_id = $1`,
      [previousId],
    );
    return previousId;
  });

  if (oldAssetId) {
    await suppressAndDeleteOldAsset(db, store, oldAssetId);
  }

  return store ? { status: 'none' } : { status: 'not_configured' };
}

export async function setGroupCoverImage(
  db: Db,
  store: ObjectStore | null,
  params: { groupId: string; actorMemberId: string; intentId: string },
  readUrlTtlSeconds: number,
): Promise<MediaImageProjection> {
  if (!store) {
    throw new MediaServiceError(503, 'media_unavailable', 'Media storage is not configured');
  }
  if (!UUID_RE.test(params.groupId)) {
    throw new MediaServiceError(400, 'invalid_group', 'groupId must be a valid UUID');
  }

  const { newAssetId, oldAssetId } = await db.transaction(async (tx) => {
    const authRes = await tx.query<{ is_steward: boolean; cover_asset_id: string | null }>(
      `SELECT (g.status = 'active' AND g.steward_member_id = $2) AS is_steward,
         g.cover_asset_id
         FROM groups g
        WHERE g.group_id = $1
        FOR UPDATE OF g`,
      [params.groupId, params.actorMemberId],
    );
    if (authRes.rows.length === 0) {
      throw new MediaServiceError(404, 'group_not_found', 'Group not found');
    }
    if (authRes.rows[0].is_steward !== true) {
      throw new MediaServiceError(403, 'forbidden', 'Only the Group Steward can update the Group cover');
    }
    const previousId = authRes.rows[0].cover_asset_id;
    const { assetId } = await bindIntentInTransaction(tx, {
      intentId: params.intentId,
      actorMemberId: params.actorMemberId,
      expectedPurpose: 'group_cover',
      expectedTargetScopeId: params.groupId,
      ownerScope: 'group',
      ownerId: params.groupId,
    });
    await tx.query(
      `UPDATE groups SET cover_asset_id = $2, updated_at = now() WHERE group_id = $1`,
      [params.groupId, assetId],
    );
    if (previousId && previousId !== assetId) {
      await tx.query(
        `UPDATE media_assets
            SET status = 'replaced', suppressed_at = now(), delete_after = now()
          WHERE asset_id = $1`,
        [previousId],
      );
    }
    return { newAssetId: assetId, oldAssetId: previousId };
  });

  if (oldAssetId && oldAssetId !== newAssetId) {
    await suppressAndDeleteOldAsset(db, store, oldAssetId);
  }

  const assets = await resolveReadyMediaAssetsByIds(db, [newAssetId]);
  return projectMediaAsset(assets.get(newAssetId), store, readUrlTtlSeconds);
}

export async function removeGroupCoverImage(
  db: Db,
  store: ObjectStore | null,
  params: { groupId: string; actorMemberId: string },
): Promise<MediaImageProjection> {
  if (!UUID_RE.test(params.groupId)) {
    throw new MediaServiceError(400, 'invalid_group', 'groupId must be a valid UUID');
  }
  const oldAssetId = await db.transaction(async (tx) => {
    const authRes = await tx.query<{ is_steward: boolean; cover_asset_id: string | null }>(
      `SELECT (g.status = 'active' AND g.steward_member_id = $2) AS is_steward,
         g.cover_asset_id
         FROM groups g
        WHERE g.group_id = $1
        FOR UPDATE OF g`,
      [params.groupId, params.actorMemberId],
    );
    if (authRes.rows.length === 0) {
      throw new MediaServiceError(404, 'group_not_found', 'Group not found');
    }
    if (authRes.rows[0].is_steward !== true) {
      throw new MediaServiceError(403, 'forbidden', 'Only the Group Steward can remove the Group cover');
    }
    const previousId = authRes.rows[0].cover_asset_id;
    if (!previousId) return null;
    await tx.query(
      `UPDATE groups SET cover_asset_id = NULL, updated_at = now() WHERE group_id = $1`,
      [params.groupId],
    );
    await tx.query(
      `UPDATE media_assets
          SET status = 'delete_pending', suppressed_at = now(), delete_after = now()
        WHERE asset_id = $1`,
      [previousId],
    );
    return previousId;
  });

  if (oldAssetId) {
    await suppressAndDeleteOldAsset(db, store, oldAssetId);
  }
  return store ? { status: 'none' } : { status: 'not_configured' };
}

interface ChallengeCoverAuthorityRow {
  groupId: string;
  createdByMemberId: string;
  coverAssetId: string | null;
  isSteward: boolean;
  allowMemberChallenges: boolean;
  membershipStatus: string | null;
}

/** Lock Group → membership → Challenge in the canonical mutation order. */
async function lockChallengeCoverAuthority(
  tx: Db,
  challengeId: string,
  actorMemberId: string,
): Promise<ChallengeCoverAuthorityRow> {
  const scope = await tx.query<{ group_id: string }>(
    `SELECT group_id FROM challenges WHERE challenge_id = $1`,
    [challengeId],
  );
  if (scope.rows.length === 0) {
    throw new MediaServiceError(404, 'challenge_not_found', 'Challenge not found');
  }
  const groupId = scope.rows[0].group_id;
  const group = await tx.query<{ status: string; steward_member_id: string | null; allow_member_challenges: boolean }>(
    `SELECT status, steward_member_id, allow_member_challenges
       FROM groups WHERE group_id = $1 FOR UPDATE`,
    [groupId],
  );
  if (!group.rows[0] || group.rows[0].status !== 'active') {
    throw new MediaServiceError(404, 'challenge_not_found', 'Challenge not found');
  }
  const membership = await tx.query<{ status: string }>(
    `SELECT status FROM group_memberships
      WHERE group_id = $1 AND member_id = $2 FOR SHARE`,
    [groupId, actorMemberId],
  );
  const challenge = await tx.query<{ group_id: string; created_by_member_id: string; cover_asset_id: string | null }>(
    `SELECT group_id, created_by_member_id, cover_asset_id
       FROM challenges WHERE challenge_id = $1 FOR UPDATE`,
    [challengeId],
  );
  if (!challenge.rows[0] || challenge.rows[0].group_id !== groupId) {
    throw new MediaServiceError(404, 'challenge_not_found', 'Challenge not found');
  }
  return {
    groupId,
    createdByMemberId: challenge.rows[0].created_by_member_id,
    coverAssetId: challenge.rows[0].cover_asset_id,
    isSteward: group.rows[0].steward_member_id === actorMemberId,
    allowMemberChallenges: group.rows[0].allow_member_challenges,
    membershipStatus: membership.rows[0]?.status ?? null,
  };
}

export async function setChallengeCoverImage(
  db: Db,
  store: ObjectStore | null,
  params: { challengeId: string; actorMemberId: string; intentId: string; allowCreatorInitialBind?: boolean; groupId?: string },
  readUrlTtlSeconds: number,
): Promise<MediaImageProjection> {
  if (!store) {
    throw new MediaServiceError(503, 'media_unavailable', 'Media storage is not configured');
  }
  if (!UUID_RE.test(params.challengeId)) {
    throw new MediaServiceError(400, 'invalid_challenge', 'challengeId must be a valid UUID');
  }

  const { newAssetId, oldAssetId } = await db.transaction(async (tx) => {
    const row = await lockChallengeCoverAuthority(tx, params.challengeId, params.actorMemberId);
    const isSteward = row.isSteward;
    const intentForRetry = await tx.query<{
      actor_member_id: string;
      purpose: string;
      status: string;
      asset_id: string | null;
      target_scope_id: string | null;
    }>(
      `SELECT actor_member_id, purpose, status, asset_id, target_scope_id
         FROM media_upload_intents WHERE intent_id = $1 FOR UPDATE`,
      [params.intentId],
    );
    const retryIntent = intentForRetry.rows[0];
    const sameInitialIntentApplied =
      params.allowCreatorInitialBind === true &&
      Boolean(params.groupId) &&
      params.groupId === row.groupId &&
      row.createdByMemberId === params.actorMemberId &&
      retryIntent?.actor_member_id === params.actorMemberId &&
      retryIntent?.purpose === 'challenge_cover' &&
      retryIntent?.status === 'bound' &&
      Boolean(retryIntent.asset_id) &&
      retryIntent.asset_id === row.coverAssetId &&
      retryIntent.target_scope_id === row.groupId;
    const priorCreatorCover = sameInitialIntentApplied ? false : (await tx.query<{ intent_id: string }>(
      `SELECT i.intent_id
         FROM media_upload_intents i
         JOIN media_assets a ON a.asset_id = i.asset_id
        WHERE a.owner_scope = 'challenge' AND a.owner_id = $1
          AND i.actor_member_id = $2 AND i.purpose = 'challenge_cover' AND i.status = 'bound'
          AND i.intent_id <> $3
        LIMIT 1`,
      [params.challengeId, params.actorMemberId, params.intentId],
    )).rows.length > 0;
    const isEligibleCreatorOnInitialBind =
      params.allowCreatorInitialBind === true &&
      Boolean(params.groupId) &&
      params.groupId === row.groupId &&
      row.createdByMemberId === params.actorMemberId &&
      (row.membershipStatus === 'active' || row.membershipStatus === 'joined') &&
      (isSteward || row.allowMemberChallenges) &&
      (row.coverAssetId === null || sameInitialIntentApplied) &&
      !priorCreatorCover;
    if (!isSteward && !isEligibleCreatorOnInitialBind && !sameInitialIntentApplied) {
      throw new MediaServiceError(403, 'forbidden', 'Only an authorized Group Steward can update the Challenge cover');
    }
    const previousId = row.coverAssetId;
    if (sameInitialIntentApplied) {
      return { newAssetId: retryIntent.asset_id!, oldAssetId: previousId };
    }
    const { assetId } = await bindIntentInTransaction(tx, {
      intentId: params.intentId,
      actorMemberId: params.actorMemberId,
      expectedPurpose: 'challenge_cover',
      expectedTargetScopeId: isEligibleCreatorOnInitialBind ? params.groupId! : params.challengeId,
      ownerScope: 'challenge',
      ownerId: params.challengeId,
    });
    await tx.query(
      `UPDATE challenges SET cover_asset_id = $2, updated_at = now() WHERE challenge_id = $1`,
      [params.challengeId, assetId],
    );
    if (previousId && previousId !== assetId) {
      await tx.query(
        `UPDATE media_assets
            SET status = 'replaced', suppressed_at = now(), delete_after = now()
          WHERE asset_id = $1`,
        [previousId],
      );
    }
    return { newAssetId: assetId, oldAssetId: previousId };
  });

  if (oldAssetId && oldAssetId !== newAssetId) {
    await suppressAndDeleteOldAsset(db, store, oldAssetId);
  }

  const assets = await resolveReadyMediaAssetsByIds(db, [newAssetId]);
  return projectMediaAsset(assets.get(newAssetId), store, readUrlTtlSeconds);
}

export async function removeChallengeCoverImage(
  db: Db,
  store: ObjectStore | null,
  params: { challengeId: string; actorMemberId: string },
): Promise<MediaImageProjection> {
  if (!UUID_RE.test(params.challengeId)) {
    throw new MediaServiceError(400, 'invalid_challenge', 'challengeId must be a valid UUID');
  }
  const oldAssetId = await db.transaction(async (tx) => {
    const row = await lockChallengeCoverAuthority(tx, params.challengeId, params.actorMemberId);
    if (!row.isSteward) {
      throw new MediaServiceError(403, 'forbidden', 'Only the Group Steward can remove the Challenge cover');
    }
    const previousId = row.coverAssetId;
    if (!previousId) return null;
    await tx.query(
      `UPDATE challenges SET cover_asset_id = NULL, updated_at = now() WHERE challenge_id = $1`,
      [params.challengeId],
    );
    await tx.query(
      `UPDATE media_assets
          SET status = 'delete_pending', suppressed_at = now(), delete_after = now()
        WHERE asset_id = $1`,
      [previousId],
    );
    return previousId;
  });

  if (oldAssetId) {
    await suppressAndDeleteOldAsset(db, store, oldAssetId);
  }
  return store ? { status: 'none' } : { status: 'not_configured' };
}

export interface MediaCleanupReport {
  expiredOpenIntents: number;
  expiredUploadedIntents: number;
  deletedObjects: number;
  failedDeletes: number;
}

/**
 * Bounded, idempotent lifecycle cleanup for expired upload intents, unbound
 * pending assets, and replaced/delete-pending R2 objects whose grace window
 * has elapsed. Safe to re-run; verifies zero live DB references before delete.
 */
export async function cleanupMediaLifecycle(
  db: Db,
  store: ObjectStore | null,
  options: { now?: Date; batchLimit?: number } = {},
): Promise<MediaCleanupReport> {
  const nowIso = (options.now ?? new Date()).toISOString();
  const limit = Math.max(1, Math.min(500, options.batchLimit ?? 100));

  const expiredOpenRes = await db.query<{ intent_id: string }>(
    `UPDATE media_upload_intents
        SET status = 'expired'
      WHERE status = 'open' AND expires_at <= $1::timestamptz
      RETURNING intent_id`,
    [nowIso],
  );

  const expiredUploadedRes = await db.query<{ intent_id: string; asset_id: string | null }>(
    `UPDATE media_upload_intents
        SET status = 'expired'
      WHERE status = 'uploaded' AND expires_at <= $1::timestamptz
      RETURNING intent_id, asset_id`,
    [nowIso],
  );

  const unboundAssetIds = expiredUploadedRes.rows
    .map((r) => r.asset_id)
    .filter((id): id is string => typeof id === 'string');

  if (unboundAssetIds.length > 0) {
    await db.query(
      `UPDATE media_assets
          SET status = 'delete_pending',
              suppressed_at = COALESCE(suppressed_at, $2::timestamptz),
              delete_after = COALESCE(delete_after, $2::timestamptz)
        WHERE asset_id = ANY($1::uuid[]) AND status = 'pending'`,
      [unboundAssetIds, nowIso],
    );
  }

  let deletedObjects = 0;
  let failedDeletes = 0;

  if (store) {
    const candidates = await db.query<{ asset_id: string; object_key: string }>(
      `SELECT ma.asset_id, ma.object_key
         FROM media_assets ma
        WHERE ma.status IN ('replaced', 'delete_pending')
          AND ma.delete_after IS NOT NULL
          AND ma.delete_after <= $1::timestamptz
          AND NOT EXISTS (SELECT 1 FROM members m WHERE m.profile_image_asset_id = ma.asset_id)
          AND NOT EXISTS (SELECT 1 FROM groups g WHERE g.cover_asset_id = ma.asset_id)
          AND NOT EXISTS (SELECT 1 FROM challenges c WHERE c.cover_asset_id = ma.asset_id)
        ORDER BY ma.delete_after ASC
        LIMIT $2`,
      [nowIso, limit],
    );

    for (const row of candidates.rows) {
      try {
        await store.deleteObject({ key: row.object_key });
        await db.query(
          `UPDATE media_assets
              SET status = 'deleted', deleted_at = $2::timestamptz
            WHERE asset_id = $1`,
          [row.asset_id, nowIso],
        );
        deletedObjects += 1;
      } catch {
        failedDeletes += 1;
      }
    }
  }

  return {
    expiredOpenIntents: expiredOpenRes.rows.length,
    expiredUploadedIntents: expiredUploadedRes.rows.length,
    deletedObjects,
    failedDeletes,
  };
}
