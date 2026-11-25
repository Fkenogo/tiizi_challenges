import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import { apiPath } from './apiPrefix.js';
import type { Db } from './db.js';
import { MEDIA_UPLOAD_MAX_BYTES } from './imageProcessing.js';
import {
  MediaServiceError,
  createMediaUploadIntent,
  removeChallengeCoverImage,
  removeGroupCoverImage,
  removeOwnProfileImage,
  setChallengeCoverImage,
  setGroupCoverImage,
  setOwnProfileImage,
  uploadMediaIntentContent,
} from './mediaService.js';
import type { ObjectStore } from './r2ObjectStore.js';

export interface MediaRouteDeps {
  objectStore: ObjectStore | null;
  readUrlTtlSeconds: number;
}

export function registerMediaRoutes(
  app: FastifyInstance,
  db: Db,
  mediaDeps: MediaRouteDeps,
): void {
  // Support raw binary image uploads for PUT /api/media/intents/:intentId/content
  for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'application/octet-stream']) {
    if (!app.hasContentTypeParser(mime)) {
      app.addContentTypeParser(
        mime,
        { parseAs: 'buffer', bodyLimit: MEDIA_UPLOAD_MAX_BYTES },
        (_request, body, done) => {
          done(null, body);
        },
      );
    }
  }

  app.post(apiPath('/media/intents'), async (request, reply) => {
    const member = authenticatedMember(request);
    const body = (request.body ?? {}) as {
      purpose?: unknown;
      targetScopeId?: unknown;
      idempotencyKey?: unknown;
    };
    try {
      const result = await createMediaUploadIntent(db, {
        actorMemberId: member.memberId,
        purpose: body.purpose,
        targetScopeId: body.targetScopeId,
        idempotencyKey: body.idempotencyKey,
      });
      return reply.status(201).send(result);
    } catch (err) {
      if (err instanceof MediaServiceError) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  app.put(apiPath('/media/intents/:intentId/content'), async (request, reply) => {
    const member = authenticatedMember(request);
    const { intentId } = request.params as { intentId: string };
    const rawBytes = Buffer.isBuffer(request.body)
      ? request.body
      : Buffer.alloc(0);

    try {
      const result = await uploadMediaIntentContent(db, mediaDeps.objectStore, {
        intentId,
        actorMemberId: member.memberId,
        rawBytes,
      });
      return reply.status(200).send(result);
    } catch (err) {
      if (err instanceof MediaServiceError) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  app.put(apiPath('/me/profile-image'), async (request, reply) => {
    const member = authenticatedMember(request);
    const body = (request.body ?? {}) as { intentId?: unknown };
    if (typeof body.intentId !== 'string') {
      return reply.status(400).send({ error: { code: 'invalid_intent', message: 'intentId is required' } });
    }
    try {
      const profileImage = await setOwnProfileImage(
        db,
        mediaDeps.objectStore,
        { memberId: member.memberId, intentId: body.intentId },
        mediaDeps.readUrlTtlSeconds,
      );
      return reply.status(200).send({ profileImage });
    } catch (err) {
      if (err instanceof MediaServiceError) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  app.delete(apiPath('/me/profile-image'), async (request, reply) => {
    const member = authenticatedMember(request);
    try {
      const profileImage = await removeOwnProfileImage(db, mediaDeps.objectStore, {
        memberId: member.memberId,
      });
      return reply.status(200).send({ profileImage });
    } catch (err) {
      if (err instanceof MediaServiceError) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  app.put(apiPath('/groups/:groupId/cover-image'), async (request, reply) => {
    const member = authenticatedMember(request);
    const { groupId } = request.params as { groupId: string };
    const body = (request.body ?? {}) as { intentId?: unknown };
    if (typeof body.intentId !== 'string') {
      return reply.status(400).send({ error: { code: 'invalid_intent', message: 'intentId is required' } });
    }
    try {
      const coverImage = await setGroupCoverImage(
        db,
        mediaDeps.objectStore,
        { groupId, actorMemberId: member.memberId, intentId: body.intentId },
        mediaDeps.readUrlTtlSeconds,
      );
      return reply.status(200).send({ coverImage });
    } catch (err) {
      if (err instanceof MediaServiceError) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  app.delete(apiPath('/groups/:groupId/cover-image'), async (request, reply) => {
    const member = authenticatedMember(request);
    const { groupId } = request.params as { groupId: string };
    try {
      const coverImage = await removeGroupCoverImage(db, mediaDeps.objectStore, {
        groupId,
        actorMemberId: member.memberId,
      });
      return reply.status(200).send({ coverImage });
    } catch (err) {
      if (err instanceof MediaServiceError) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  app.put(apiPath('/challenges/:challengeId/cover-image'), async (request, reply) => {
    const member = authenticatedMember(request);
    const { challengeId } = request.params as { challengeId: string };
    const body = (request.body ?? {}) as { intentId?: unknown; initialBind?: unknown; groupId?: unknown };
    if (typeof body.intentId !== 'string') {
      return reply.status(400).send({ error: { code: 'invalid_intent', message: 'intentId is required' } });
    }
    try {
      const coverImage = await setChallengeCoverImage(
        db,
        mediaDeps.objectStore,
        {
          challengeId,
          actorMemberId: member.memberId,
          intentId: body.intentId,
          allowCreatorInitialBind: body.initialBind === true,
          groupId: typeof body.groupId === 'string' ? body.groupId : undefined,
        },
        mediaDeps.readUrlTtlSeconds,
      );
      return reply.status(200).send({ coverImage });
    } catch (err) {
      if (err instanceof MediaServiceError) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });

  app.delete(apiPath('/challenges/:challengeId/cover-image'), async (request, reply) => {
    const member = authenticatedMember(request);
    const { challengeId } = request.params as { challengeId: string };
    try {
      const coverImage = await removeChallengeCoverImage(db, mediaDeps.objectStore, {
        challengeId,
        actorMemberId: member.memberId,
      });
      return reply.status(200).send({ coverImage });
    } catch (err) {
      if (err instanceof MediaServiceError) {
        return reply.status(err.statusCode).send({ error: { code: err.code, message: err.message } });
      }
      throw err;
    }
  });
}
