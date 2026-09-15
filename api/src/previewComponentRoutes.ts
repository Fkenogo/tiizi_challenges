/** Read-only local preview context route; registration is runtime-gated by app composition. */
import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import type { GroupMutationStore } from './groupMutations.js';
import { findPreviewComponentGroup } from './previewComponentGroup.js';

export interface PreviewComponentRouteDeps {
  store: GroupMutationStore;
  firebaseUidForMember(memberId: string): Promise<string | null>;
}

export function registerPreviewComponentRoutes(
  app: FastifyInstance,
  db: Db,
  deps: PreviewComponentRouteDeps,
): void {
  app.get('/v1/preview/challenge-creation/context', async (request, reply) => {
    const member = authenticatedMember(request);
    const firebaseUid = await deps.firebaseUidForMember(member.memberId);
    if (!firebaseUid) {
      return reply.status(403).send({
        error: { code: 'preview_context_unavailable', message: 'Preview Member has no Firebase identity.' },
      });
    }
    try {
      const group = await findPreviewComponentGroup(
        db,
        deps.store,
        { memberId: member.memberId, firebaseUid },
      );
      if (!group) {
        return reply.status(404).send({
          error: { code: 'preview_context_unavailable', message: 'Run the governed preview Group fixture first.' },
        });
      }
      return {
        groupId: group.id,
        legacyGroupId: group.legacyId,
        groupName: group.name,
      };
    } catch {
      return reply.status(403).send({
        error: { code: 'preview_context_unavailable', message: 'Live preview Group membership is required.' },
      });
    }
  });
}
