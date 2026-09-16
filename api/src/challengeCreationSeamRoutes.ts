/**
 * S2a — Challenge creation API seam (transport only).
 *
 * Exposes already-merged, governed domain capability over the HTTP boundary
 * for the future V2 challenge-creation experience. This module is a thin
 * adapter: it owns no semantics of its own and creates no second authority.
 *
 * - GET  /v1/knowledge/:id/options
 *     → describeComposerActivityOptions (PF-04 Composer — valid Metric /
 *       Unit / Component / Load-basis choices for one canonical Activity).
 * - POST /v1/challenge-definitions/preview
 *     → previewChallengeComposer (PF-04)
 *       → validateChallengeDefinition (PF-03 semantic validation).
 *
 * Both endpoints are read-only: neither persists a challenge, a
 * participation nor any other domain state.
 *
 * Domain authority is unchanged: Composer remains semantic composition
 * authority, the PF-03 validator remains semantic validation authority,
 * challenge establishment remains persistence authority and
 * ChallengeCreationAuthority remains creation-authorisation authority.
 */

import type { FastifyInstance } from 'fastify';
import {
  describeComposerActivityOptions,
  previewChallengeComposer,
  type ChallengeComposerDraft,
} from './challengeComposer.js';
import type { Db } from './db.js';

export function registerChallengeCreationSeamRoutes(app: FastifyInstance, db: Db): void {
  /**
   * Governed Composer configuration options for one canonical Activity.
   * Identity is a Knowledge UUID or the immutable Activity Code; display
   * names are never identity. Unknown, unpublished or malformed identities
   * are 404 — options are never invented. Read-only.
   */
  app.get('/v1/knowledge/:id/options', async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await describeComposerActivityOptions(db, id);
    } catch (error) {
      return reply.status(404).send({
        error: {
          code: 'knowledge_not_found',
          message: (error as Error).message,
        },
      });
    }
  });

  /**
   * Composer draft → PF-04 preview → PF-03 validation → governed preview
   * response. The same validator used by establishment stays the authority;
   * there is no second validator here. Persists nothing.
   */
  app.post('/v1/challenge-definitions/preview', async (request, reply) => {
    const draft = request.body;
    if (typeof draft !== 'object' || draft === null || Array.isArray(draft)) {
      return reply.status(400).send({
        error: {
          code: 'invalid_composer_draft',
          message: 'Preview body must be a Composer draft object',
        },
      });
    }
    const preview = await previewChallengeComposer(db, draft as ChallengeComposerDraft);
    if (!preview.ok) {
      return reply.status(422).send({ ok: false, issues: preview.issues });
    }
    return { ok: true, definition: preview.definition };
  });
}
