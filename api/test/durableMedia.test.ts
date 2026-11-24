import { randomUUID } from 'node:crypto';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';
import type { Db } from '../src/db.js';
import { validateAndOptimizeImage, ImageValidationError } from '../src/imageProcessing.js';
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
});
