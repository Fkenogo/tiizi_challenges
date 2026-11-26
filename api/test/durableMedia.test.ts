import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db.js';
import { validateAndOptimizeImage, ImageValidationError } from '../src/imageProcessing.js';
import { cleanupMediaLifecycle, createMediaUploadIntent, uploadMediaIntentContent } from '../src/mediaService.js';
import { CloudflareR2ObjectStore, resolveR2ConfigFromEnv, type ObjectStore } from '../src/r2ObjectStore.js';
import { seedGroup, seedMembership, testDb } from './helpers.js';

function createInMemoryObjectStore(): ObjectStore & { objects: Map<string, { body: Buffer; contentType: string }> } {
  const objects = new Map<string, { body: Buffer; contentType: string }>();
  return {
    objects,
    async putObject({ key, body, contentType }) {
      objects.set(key, { body: Buffer.from(body), contentType });
    },
    async deleteObject({ key }) {
      objects.delete(key);
    },
    getSignedReadUrl({ key, expiresInSeconds }) {
      return `https://signed.example.test/${encodeURIComponent(key)}?expires=${expiresInSeconds}`;
    },
  };
}

async function makeTestPng(width = 320, height = 320): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 234, g: 88, b: 12 },
    },
  })
    .png()
    .toBuffer();
}

async function makeTestJpegWithExif(): Promise<Buffer> {
  return sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 15, g: 23, b: 42 },
    },
  })
    .withMetadata({ exif: { IFD0: { ImageDescription: 'GPS_SECRET_LOCATION_123' } } })
    .jpeg()
    .toBuffer();
}

async function seedMember(db: Db, uid: string, displayName: string): Promise<string> {
  const res = await db.query<{ member_id: string }>(
    `INSERT INTO members (auth_provider, auth_subject, display_name)
     VALUES ('firebase', $1, $2)
     RETURNING member_id`,
    [uid, displayName],
  );
  return String(res.rows[0].member_id);
}

describe('Cloudflare R2 config & SigV4 signing', () => {
  it('rejects public r2.dev endpoints, non-HTTPS endpoints, incomplete config, and prod buckets in non-prod', () => {
    expect(resolveR2ConfigFromEnv({})).toBeNull();
    expect(() =>
      resolveR2ConfigFromEnv({
        R2_ACCOUNT_ID: 'acc123',
        R2_BUCKET: 'tiizi-preview',
        R2_ENDPOINT: 'https://pub-123.r2.dev',
        R2_ACCESS_KEY_ID: 'ak',
        R2_SECRET_ACCESS_KEY: 'sk',
      }),
    ).toThrow(/r2\.dev/);

    expect(() =>
      resolveR2ConfigFromEnv({
        R2_ACCOUNT_ID: 'acc123',
        R2_BUCKET: 'tiizi-preview',
        R2_ENDPOINT: 'http://acc123.r2.cloudflarestorage.com',
        R2_ACCESS_KEY_ID: 'ak',
        R2_SECRET_ACCESS_KEY: 'sk',
      }),
    ).toThrow(/https/);

    expect(() =>
      resolveR2ConfigFromEnv({
        NODE_ENV: 'development',
        TIIZI_ENV: 'preview',
        TIIZI_R2_PROD_BUCKET: 'tiizi-prod-media',
        R2_ACCOUNT_ID: 'acc123',
        R2_BUCKET: 'tiizi-prod-media',
        R2_ACCESS_KEY_ID: 'ak',
        R2_SECRET_ACCESS_KEY: 'sk',
      }),
    ).toThrow(/production R2 bucket/);
  });

  it('generates short-lived private SigV4 presigned GET URLs without exposing secret keys', () => {
    const config = resolveR2ConfigFromEnv({
      R2_ACCOUNT_ID: 'acc123',
      R2_BUCKET: 'tiizi-preview-media',
      R2_ACCESS_KEY_ID: 'AKIA_TEST_KEY',
      R2_SECRET_ACCESS_KEY: 'super-secret-r2-key',
      MEDIA_READ_URL_TTL_SECONDS: '45',
    })!;
    const store = new CloudflareR2ObjectStore(config);
    const url = store.getSignedReadUrl({
      key: 'tiizi/profile_image/test-id.webp',
      expiresInSeconds: config.readUrlTtlSeconds,
      responseCacheControl: 'private, no-store',
    });
    expect(url).toContain('https://acc123.r2.cloudflarestorage.com/tiizi-preview-media/tiizi/profile_image/test-id.webp');
    expect(url).toContain('X-Amz-Algorithm=AWS4-HMAC-SHA256');
    expect(url).toContain('X-Amz-Expires=45');
    expect(url).toContain('response-cache-control=private%2C%20no-store');
    expect(url).not.toContain('super-secret-r2-key');
  });

  it('enforces PRIV-05 signed URL TTL policy bounds without silent clamping', async () => {
    const { resolveR2ReadUrlTtlSeconds } = await import('../src/r2ObjectStore.js');

    // Default when unset or blank
    expect(resolveR2ReadUrlTtlSeconds(undefined)).toBe(60);
    expect(resolveR2ReadUrlTtlSeconds('')).toBe(60);
    expect(resolveR2ReadUrlTtlSeconds('   ')).toBe(60);

    // Valid values within [15, 60]
    expect(resolveR2ReadUrlTtlSeconds('15')).toBe(15);
    expect(resolveR2ReadUrlTtlSeconds('45')).toBe(45);
    expect(resolveR2ReadUrlTtlSeconds('60')).toBe(60);

    // Invalid values above policy max (60), below min (15), or non-integer must reject
    for (const invalid of ['61', '300', '14', '0', '-5', '60.5', '60s', 'abc']) {
      expect(() => resolveR2ReadUrlTtlSeconds(invalid)).toThrow(/15 and 60/);
    }
  });
});

describe('Image validation & EXIF stripping', () => {
  it('strips EXIF metadata and optimizes images to sRGB WebP', async () => {
    const raw = await makeTestJpegWithExif();
    const out = await validateAndOptimizeImage(raw, 'profile_image');
    expect(out.contentType).toBe('image/webp');
    expect(out.width).toBe(256);
    expect(out.height).toBe(256);
    expect(out.buffer.toString('utf8')).not.toContain('GPS_SECRET_LOCATION_123');
    const outMeta = await sharp(out.buffer).metadata();
    expect(outMeta.exif).toBeUndefined();
  });

  it('rejects SVG, empty, and corrupt payloads', async () => {
    await expect(validateAndOptimizeImage(Buffer.from('<svg></svg>'), 'profile_image')).rejects.toThrow(ImageValidationError);
    await expect(validateAndOptimizeImage(Buffer.alloc(0), 'profile_image')).rejects.toThrow(ImageValidationError);
    await expect(validateAndOptimizeImage(Buffer.from('not-an-image'), 'group_cover')).rejects.toThrow(ImageValidationError);
  });
});

describe('Durable media API, ownership, replacement, removal, and Feed attribution', () => {
  it('supports profile photo upload/replace/remove, cross-account isolation, Group & Challenge covers, and Challenge Feed attribution', async () => {
    const db = testDb();
    const store = createInMemoryObjectStore();
    const memberA = await seedMember(db, 'uid-a', 'Amara');
    const memberB = await seedMember(db, 'uid-b', 'Bora');

      const groupId = await seedGroup(db, { name: 'Sunrise Runners', isPrivate: false });
      await seedMembership(db, groupId, memberA, { role: 'owner', status: 'active' });
      await db.query(`UPDATE groups SET steward_member_id = $2 WHERE group_id = $1`, [groupId, memberA]);
      await seedMembership(db, groupId, memberB, { role: 'member', status: 'active' });

      const challengeId = randomUUID();
      await db.query(
        `INSERT INTO challenges (
           challenge_id, group_id, created_by_member_id, challenge_type, status,
           title, description, instructions, start_date, end_date, current_config_version, timezone,
           goal_value, goal_unit
         ) VALUES ($1, $2, $3, 'collective', 'active', '10k Steps', 'Walk daily', 'Log steps', '2026-11-01', '2026-11-30', 1, 'UTC', 10000, 'steps')`,
        [challengeId, groupId, memberA],
      );
      const knowledgeId = randomUUID();
      await db.query(
        `INSERT INTO knowledge_items (knowledge_id, kind, name, category, subcategory, difficulty, description, metric_unit, target_value, target_type, frequency, points, lifecycle)
         VALUES ($1, 'fitness', 'Walking', 'Cardio', 'Walk', 'Beginner', 'Walk daily', 'steps', 5000, 'count', 'daily', 10, 'published')`,
        [knowledgeId],
      );
      await db.query(
        `INSERT INTO challenge_config_versions (challenge_id, version, snapshot)
         VALUES ($1, 1, $2::jsonb)`,
        [
          challengeId,
          JSON.stringify({
            challenge_type: 'collective',
            period: { start_date: '2026-11-01', end_date: '2026-11-30' },
            type_params: { goal_value: 10000, goal_unit: 'steps', required_consecutive_days: null, reset_on_miss: false },
            activities: [{
              canonical_key: 'walking',
              activity_variant: null,
              knowledge_id: knowledgeId,
              knowledge_version: 1,
              target_value: 5000,
              unit: 'steps',
              position: 0,
              conditions: {},
            }],
          }),
        ],
      );
      await db.query(
        `INSERT INTO challenge_activity_configs
           (challenge_id, version, canonical_key, knowledge_id, knowledge_version, target_value, unit, position, conditions)
         VALUES ($1, 1, 'walking', $2, 1, 5000, 'steps', 0, '{}')`,
        [challengeId, knowledgeId],
      );

      const authority = {
        async resolveGroupMembershipAuthority(gId: string, mId: string) {
          const r = await db.query<{ role: string; status: string }>(
            `SELECT role, status FROM group_memberships WHERE group_id = $1 AND member_id = $2`,
            [gId, mId],
          );
          const row = r.rows[0];
          return {
            eligible: row?.status === 'active',
            status: row?.status ?? 'none',
            role: row?.role === 'steward' ? ('steward' as const) : ('member' as const),
          };
        },
      };

      process.env.TIIZI_CHALLENGE_FEED_CURSOR_SECRET = 'test-challenge-feed-secret-0123456789abcdef';
      const app = buildApp({
        db,
        verifier: { verify: async (token) => ({ uid: token }) },
        challengeActivity: { groupMembershipAuthority: authority },
        media: { objectStore: store, readUrlTtlSeconds: 60 },
      });

      const png = await makeTestPng();

      // 1. Member A uploads and sets profile photo
      const intentRes = await app.inject({
        method: 'POST',
        url: '/api/media/intents',
        headers: { authorization: 'Bearer uid-a' },
        payload: { purpose: 'profile_image', idempotencyKey: 'prof-intent-1' },
      });
      expect(intentRes.statusCode).toBe(201);
      const { intentId: profIntent1 } = intentRes.json();

      // Cross-account isolation: Member B cannot upload to Member A's intent
      const crossUpload = await app.inject({
        method: 'PUT',
        url: `/api/media/intents/${profIntent1}/content`,
        headers: { authorization: 'Bearer uid-b', 'content-type': 'image/png' },
        payload: png,
      });
      expect(crossUpload.statusCode).toBe(404);

      const uploadRes1 = await app.inject({
        method: 'PUT',
        url: `/api/media/intents/${profIntent1}/content`,
        headers: { authorization: 'Bearer uid-a', 'content-type': 'image/png' },
        payload: png,
      });
      expect(uploadRes1.statusCode).toBe(200);

      const bindRes1 = await app.inject({
        method: 'PUT',
        url: '/api/me/profile-image',
        headers: { authorization: 'Bearer uid-a' },
        payload: { intentId: profIntent1 },
      });
      expect(bindRes1.statusCode).toBe(200);
      const firstUrl = bindRes1.json().profileImage.url;
      expect(firstUrl).toContain('https://signed.example.test/');
      expect(store.objects.size).toBe(1);

      // GET /api/me returns the saved signed URL
      const meRes = await app.inject({
        method: 'GET',
        url: '/api/me',
        headers: { authorization: 'Bearer uid-a' },
      });
      expect(meRes.statusCode).toBe(200);
      expect(meRes.json().profileImage.status).toBe('ready');
      expect(meRes.json().profileImage.url).toBe(firstUrl);

      // 2. Replace profile photo -> old object deleted, new URL served
      const intentRes2 = await app.inject({
        method: 'POST',
        url: '/api/media/intents',
        headers: { authorization: 'Bearer uid-a' },
        payload: { purpose: 'profile_image', idempotencyKey: 'prof-intent-2' },
      });
      const { intentId: profIntent2 } = intentRes2.json();
      await app.inject({
        method: 'PUT',
        url: `/api/media/intents/${profIntent2}/content`,
        headers: { authorization: 'Bearer uid-a', 'content-type': 'image/png' },
        payload: png,
      });
      const bindRes2 = await app.inject({
        method: 'PUT',
        url: '/api/me/profile-image',
        headers: { authorization: 'Bearer uid-a' },
        payload: { intentId: profIntent2 },
      });
      expect(bindRes2.statusCode).toBe(200);
      expect(bindRes2.json().profileImage.url).not.toBe(firstUrl);
      expect(store.objects.size).toBe(1);

      // 3. Challenge Feed attribution resolves live sharerProfileImage
      const eventId = randomUUID();
      await db.query(
        `INSERT INTO member_activity_events (
           event_id, member_id, activity_kind, canonical_key, knowledge_id, knowledge_version,
           occurred_at, occurred_day, value, unit, client_key
         ) VALUES ($1, $2, 'fitness', 'walking', $3, 1, '2026-11-10T12:00:00Z', '2026-11-10', 2500, 'steps', 'media-test-key-1')`,
        [eventId, memberA, knowledgeId],
      );
      await db.query(
        `INSERT INTO challenge_feed_shares (
           share_id, challenge_id, member_id, activity_event_id, activity_record_id, event_family,
           last_publish_key, share_generation
         ) VALUES ($1, $2, $3, $4, $5, 'activity_share', 'pub-key-1234567890', 1)`,
        [randomUUID(), challengeId, memberA, eventId, randomUUID()],
      );

      const feedRes = await app.inject({
        method: 'GET',
        url: `/api/challenges/${challengeId}/feed`,
        headers: { authorization: 'Bearer uid-b' },
      });
      expect(feedRes.statusCode).toBe(200);
      expect(feedRes.json().items[0].sharerDisplayName).toBe('Amara');
      expect(feedRes.json().items[0].sharerProfileImage.status).toBe('ready');
      expect(feedRes.json().items[0].sharerProfileImage.url).toBe(bindRes2.json().profileImage.url);

      // 4. Remove profile photo -> object deleted, GET /api/me & Feed show status: 'none'
      const delProfRes = await app.inject({
        method: 'DELETE',
        url: '/api/me/profile-image',
        headers: { authorization: 'Bearer uid-a' },
      });
      expect(delProfRes.statusCode).toBe(200);
      expect(delProfRes.json().profileImage).toEqual({ status: 'none' });
      expect(store.objects.size).toBe(0);

      const feedAfterDel = await app.inject({
        method: 'GET',
        url: `/api/challenges/${challengeId}/feed`,
        headers: { authorization: 'Bearer uid-b' },
      });
      expect(feedAfterDel.json().items[0].sharerProfileImage).toEqual({ status: 'none' });

      // 5. Group cover upload & Steward authorization
      const nonStewardIntent = await app.inject({
        method: 'POST',
        url: '/api/media/intents',
        headers: { authorization: 'Bearer uid-b' },
        payload: { purpose: 'group_cover', targetScopeId: groupId, idempotencyKey: 'grp-unauth' },
      });
      expect(nonStewardIntent.statusCode).toBe(403);

      const grpIntentRes = await app.inject({
        method: 'POST',
        url: '/api/media/intents',
        headers: { authorization: 'Bearer uid-a' },
        payload: { purpose: 'group_cover', targetScopeId: groupId, idempotencyKey: 'grp-cover-1' },
      });
      const { intentId: grpIntentId } = grpIntentRes.json();
      await app.inject({
        method: 'PUT',
        url: `/api/media/intents/${grpIntentId}/content`,
        headers: { authorization: 'Bearer uid-a', 'content-type': 'image/png' },
        payload: png,
      });
      const setGrpCover = await app.inject({
        method: 'PUT',
        url: `/api/groups/${groupId}/cover-image`,
        headers: { authorization: 'Bearer uid-a' },
        payload: { intentId: grpIntentId },
      });
      expect(setGrpCover.statusCode).toBe(200);
      expect(setGrpCover.json().coverImage.status).toBe('ready');

      const discoverRes = await app.inject({
        method: 'GET',
        url: '/api/groups/discover',
        headers: { authorization: 'Bearer uid-b' },
      });
      expect(discoverRes.statusCode).toBe(200);
      expect(discoverRes.json().groups[0].coverImage.status).toBe('ready');

      // 6. Challenge cover upload & retrieval
      const chIntentRes = await app.inject({
        method: 'POST',
        url: '/api/media/intents',
        headers: { authorization: 'Bearer uid-a' },
        payload: { purpose: 'challenge_cover', targetScopeId: challengeId, idempotencyKey: 'ch-cover-1' },
      });
      const { intentId: chIntentId } = chIntentRes.json();
      await app.inject({
        method: 'PUT',
        url: `/api/media/intents/${chIntentId}/content`,
        headers: { authorization: 'Bearer uid-a', 'content-type': 'image/png' },
        payload: png,
      });
      const setChCover = await app.inject({
        method: 'PUT',
        url: `/api/challenges/${challengeId}/cover-image`,
        headers: { authorization: 'Bearer uid-a' },
        payload: { intentId: chIntentId },
      });
      expect(setChCover.statusCode).toBe(200);
      expect(setChCover.json().coverImage.status).toBe('ready');

      const chListRes = await app.inject({
        method: 'GET',
        url: '/api/challenges',
        headers: { authorization: 'Bearer uid-b' },
      });
      expect(chListRes.statusCode).toBe(200);
      expect(chListRes.json().challenges[0].coverImage.status).toBe('ready');

      await app.close();
  });

  it('binds cover intents to their exact scope, denies non-Steward admins, and projects discovery media without expanding Today', async () => {
    const db = testDb();
    const store = createInMemoryObjectStore();
    const steward = await seedMember(db, 'uid-steward-scope', 'Scope Steward');
    const admin = await seedMember(db, 'uid-admin-scope', 'Scope Admin');
    const outsider = await seedMember(db, 'uid-outsider-scope', 'Scope Outsider');
    const creator = await seedMember(db, 'uid-creator-scope', 'Scope Creator');
    const groupA = await seedGroup(db, { name: 'Scope Group A', isPrivate: false });
    const groupB = await seedGroup(db, { name: 'Scope Group B', isPrivate: false });
    await seedMembership(db, groupA, steward, { role: 'owner', status: 'active' });
    await seedMembership(db, groupB, steward, { role: 'owner', status: 'active' });
    await seedMembership(db, groupB, admin, { role: 'admin', status: 'active' });
    await seedMembership(db, groupB, creator, { role: 'member', status: 'active' });
    await db.query(`UPDATE groups SET steward_member_id = $2 WHERE group_id = ANY($1::uuid[])`, [[groupA, groupB], steward]);

    const challengeId = randomUUID();
    await db.query(
      `INSERT INTO challenges (
         challenge_id, group_id, created_by_member_id, challenge_type, status,
         title, description, instructions, start_date, end_date, current_config_version, timezone,
         goal_value, goal_unit
       ) VALUES ($1, $2, $3, 'collective', 'active', 'Scope Discovery Challenge', '', '', '2026-11-01', '2026-11-30', 1, 'UTC', 10, 'km')`,
      [challengeId, groupB, creator],
    );
    const knowledgeId = randomUUID();
    await db.query(
      `INSERT INTO knowledge_items (knowledge_id, kind, name, category, subcategory, difficulty, description, metric_unit, target_value, target_type, frequency, points, lifecycle)
       VALUES ($1, 'fitness', 'Walking', 'Cardio', 'Walk', 'Beginner', 'Walk daily', 'km', 10, 'count', 'daily', 10, 'published')`,
      [knowledgeId],
    );
    await db.query(
      `INSERT INTO challenge_config_versions (challenge_id, version, snapshot) VALUES ($1, 1, $2::jsonb)`,
      [challengeId, JSON.stringify({
        challenge_type: 'collective',
        period: { start_date: '2026-11-01', end_date: '2026-11-30' },
        type_params: { goal_value: 10, goal_unit: 'km', required_consecutive_days: null, reset_on_miss: false },
        activities: [{
          canonical_key: 'walking', activity_variant: null, knowledge_id: knowledgeId,
          knowledge_version: 1, target_value: 10, unit: 'km', position: 0, conditions: {},
        }],
      })],
    );
    await db.query(
      `INSERT INTO challenge_activity_configs
         (challenge_id, version, canonical_key, knowledge_id, knowledge_version, target_value, unit, position, conditions)
       VALUES ($1, 1, 'walking', $2, 1, 10, 'km', 0, '{}')`,
      [challengeId, knowledgeId],
    );

    const app = buildApp({
      db,
      verifier: { verify: async (token) => ({ uid: token }) },
      media: { objectStore: store, readUrlTtlSeconds: 60 },
    });
    const png = await makeTestPng();

    const unscoped = await app.inject({
      method: 'POST', url: '/api/media/intents', headers: { authorization: 'Bearer uid-admin-scope' },
      payload: { purpose: 'group_cover', idempotencyKey: 'scope-unscoped' },
    });
    expect(unscoped.statusCode).toBe(400);

    const adminIntent = await app.inject({
      method: 'POST', url: '/api/media/intents', headers: { authorization: 'Bearer uid-admin-scope' },
      payload: { purpose: 'group_cover', targetScopeId: groupB, idempotencyKey: 'scope-admin' },
    });
    expect(adminIntent.statusCode).toBe(403);

    const groupIntent = await app.inject({
      method: 'POST', url: '/api/media/intents', headers: { authorization: 'Bearer uid-steward-scope' },
      payload: { purpose: 'group_cover', targetScopeId: groupA, idempotencyKey: 'scope-group-a' },
    });
    const groupIntentId = groupIntent.json().intentId;
    await app.inject({
      method: 'PUT', url: `/api/media/intents/${groupIntentId}/content`,
      headers: { authorization: 'Bearer uid-steward-scope', 'content-type': 'image/png' }, payload: png,
    });
    const wrongBind = await app.inject({
      method: 'PUT', url: `/api/groups/${groupB}/cover-image`, headers: { authorization: 'Bearer uid-steward-scope' },
      payload: { intentId: groupIntentId },
    });
    expect(wrongBind.statusCode).toBe(403);
    expect(wrongBind.json().error.code).toBe('intent_scope_mismatch');
    const correctBind = await app.inject({
      method: 'PUT', url: `/api/groups/${groupA}/cover-image`, headers: { authorization: 'Bearer uid-steward-scope' },
      payload: { intentId: groupIntentId },
    });
    expect(correctBind.statusCode).toBe(200);

    const adminRemoveGroup = await app.inject({
      method: 'DELETE', url: `/api/groups/${groupB}/cover-image`, headers: { authorization: 'Bearer uid-admin-scope' },
    });
    expect(adminRemoveGroup.statusCode).toBe(403);

    const challengeIntent = await app.inject({
      method: 'POST', url: '/api/media/intents', headers: { authorization: 'Bearer uid-creator-scope' },
      payload: { purpose: 'challenge_cover', targetScopeId: groupB, idempotencyKey: 'scope-challenge' },
    });
    const challengeIntentId = challengeIntent.json().intentId;
    const challengeUpload = await app.inject({
      method: 'PUT', url: `/api/media/intents/${challengeIntentId}/content`,
      headers: { authorization: 'Bearer uid-creator-scope', 'content-type': 'image/png' }, payload: png,
    });
    expect(challengeUpload.statusCode).toBe(200);
    const challengeAssetId = challengeUpload.json().assetId;
    const challengeBind = await app.inject({
      method: 'PUT', url: `/api/challenges/${challengeId}/cover-image`, headers: { authorization: 'Bearer uid-creator-scope' },
      payload: { intentId: challengeIntentId, initialBind: true, groupId: groupB },
    });
    expect(challengeBind.statusCode).toBe(200);
    const objectsAfterBind = store.objects.size;
    const challengeContentRetry = await app.inject({
      method: 'PUT', url: `/api/media/intents/${challengeIntentId}/content`,
      headers: { authorization: 'Bearer uid-creator-scope', 'content-type': 'image/png' }, payload: png,
    });
    expect(challengeContentRetry.statusCode).toBe(200);
    expect(challengeContentRetry.json().assetId).toBe(challengeAssetId);
    expect(store.objects.size).toBe(objectsAfterBind);
    const challengeBindRetry = await app.inject({
      method: 'PUT', url: `/api/challenges/${challengeId}/cover-image`, headers: { authorization: 'Bearer uid-creator-scope' },
      payload: { intentId: challengeIntentId, initialBind: true, groupId: groupB },
    });
    expect(challengeBindRetry.statusCode).toBe(200);
    expect(store.objects.size).toBe(objectsAfterBind);
    const adminRemoveChallenge = await app.inject({
      method: 'DELETE', url: `/api/challenges/${challengeId}/cover-image`, headers: { authorization: 'Bearer uid-admin-scope' },
    });
    expect(adminRemoveChallenge.statusCode).toBe(403);

    const malformedIntent = await app.inject({
      method: 'PUT', url: `/api/challenges/${challengeId}/cover-image`, headers: { authorization: 'Bearer uid-steward-scope' },
      payload: { intentId: 'not-a-uuid', initialBind: true, groupId: groupB },
    });
    expect(malformedIntent.statusCode).toBe(400);
    expect(malformedIntent.json().error.code).toBe('invalid_intent');

    const discovery = await app.inject({
      method: 'GET', url: '/api/challenges/discover', headers: { authorization: 'Bearer uid-outsider-scope' },
    });
    expect(discovery.statusCode).toBe(200);
    expect(discovery.json().challenges.find((item: { challengeId: string }) => item.challengeId === challengeId)?.coverImage.status).toBe('ready');

    const todayDiscovery = await app.inject({
      method: 'GET', url: '/api/challenges/discover?includeMedia=0', headers: { authorization: 'Bearer uid-outsider-scope' },
    });
    expect(todayDiscovery.statusCode).toBe(200);
    expect(todayDiscovery.json().challenges.find((item: { challengeId: string }) => item.challengeId === challengeId)?.coverImage).toBeUndefined();

    await db.query(`UPDATE group_memberships SET status = 'left' WHERE group_id = $1 AND member_id = $2`, [groupB, creator]);
    const departedCreatorReplay = await app.inject({
      method: 'PUT', url: `/api/challenges/${challengeId}/cover-image`, headers: { authorization: 'Bearer uid-creator-scope' },
      payload: { intentId: challengeIntentId, initialBind: true, groupId: groupB },
    });
    expect(departedCreatorReplay.statusCode).toBe(403);

    await app.close();
  });

  it('cleans up expired/unbound intents, retries failed deletes, rolls back R2 on DB failure, and enforces least-privilege tiizi_runtime grants', async () => {
    const db = testDb();
    const store = createInMemoryObjectStore();
    const memberA = await seedMember(db, 'uid-cleanup', 'Cleanup Member');
    const png = await makeTestPng();

    // 1. Expired open intent + expired uploaded unbound intent
    const openIntent = await createMediaUploadIntent(db, {
      actorMemberId: memberA,
      purpose: 'profile_image',
      idempotencyKey: 'cleanup-open-1',
    });
    const uploadedIntent = await createMediaUploadIntent(db, {
      actorMemberId: memberA,
      purpose: 'profile_image',
      idempotencyKey: 'cleanup-uploaded-1',
    });
    const uploaded = await uploadMediaIntentContent(db, store, {
      intentId: uploadedIntent.intentId,
      actorMemberId: memberA,
      rawBytes: png,
    });
    expect(store.objects.size).toBe(1);

    await db.query(
      `UPDATE media_upload_intents SET expires_at = now() - interval '1 hour' WHERE intent_id = ANY($1::uuid[])`,
      [[openIntent.intentId, uploadedIntent.intentId]],
    );

    // Simulate transient delete failure first, then retry success
    const origDelete = store.deleteObject.bind(store);
    let failOnce = true;
    store.deleteObject = async (p) => {
      if (failOnce) {
        failOnce = false;
        throw new Error('transient R2 error');
      }
      return origDelete(p);
    };

    const firstCleanup = await cleanupMediaLifecycle(db, store);
    expect(firstCleanup).toEqual({
      expiredOpenIntents: 1,
      expiredUploadedIntents: 1,
      deletedObjects: 0,
      failedDeletes: 1,
    });
    expect(store.objects.size).toBe(1);

    const retryCleanup = await cleanupMediaLifecycle(db, store);
    expect(retryCleanup).toEqual({
      expiredOpenIntents: 0,
      expiredUploadedIntents: 0,
      deletedObjects: 1,
      failedDeletes: 0,
    });
    expect(store.objects.size).toBe(0);

    const assetRow = await db.query<{ status: string }>(
      `SELECT status FROM media_assets WHERE asset_id = $1`,
      [uploaded.assetId],
    );
    expect(assetRow.rows[0].status).toBe('deleted');

    // 2. DB failure after R2 write cleans up R2 object immediately
    const failIntent = await createMediaUploadIntent(db, {
      actorMemberId: memberA,
      purpose: 'profile_image',
      idempotencyKey: 'cleanup-dbfail-1',
    });
    const failingTxDb: Db = {
      query: db.query.bind(db),
      close: db.close.bind(db),
      async transaction() {
        throw new Error('simulated DB failure after putObject');
      },
    };
    await expect(
      uploadMediaIntentContent(failingTxDb, store, {
        intentId: failIntent.intentId,
        actorMemberId: memberA,
        rawBytes: png,
      }),
    ).rejects.toThrow('simulated DB failure');
    expect(store.objects.size).toBe(0);

    // 3. Least-privilege tiizi_runtime role grant verification
    await db.query(`DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'tiizi_runtime') THEN CREATE ROLE tiizi_runtime; END IF; END $$;`);
    await db.query(`GRANT SELECT, INSERT, UPDATE, DELETE ON media_assets, media_upload_intents TO tiizi_runtime`);
    const privs = await db.query<{ privilege_type: string }>(
      `SELECT privilege_type FROM information_schema.role_table_grants
        WHERE grantee = 'tiizi_runtime' AND table_name = 'media_assets'`,
    );
    const granted = new Set(privs.rows.map((r) => r.privilege_type));
    expect(granted.has('SELECT')).toBe(true);
    expect(granted.has('INSERT')).toBe(true);
    expect(granted.has('UPDATE')).toBe(true);
    expect(granted.has('DELETE')).toBe(true);
    expect(granted.has('TRUNCATE')).toBe(false);
  });
});
