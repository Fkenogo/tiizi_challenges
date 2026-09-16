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
 *       Adds a purely derived `unitsByMetric` presentation grouping (the
 *       SAME governed Unit→Metric vocabulary the validator enforces — no
 *       second compatibility opinion; the client never re-derives it).
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
import { metricForUnit } from './measurementVocabulary.js';

/**
 * Derived presentation grouping ONLY: buckets the Activity's governed
 * compatible Units by the Metric each Unit expresses, using the single
 * governed measurement vocabulary (metricForUnit). This invents no
 * compatibility — it restates the authority's own mapping so the Wizard
 * can offer a Metric first and then only the Units that express it. The
 * server still validates the exact (Activity, Metric, Unit) tuple.
 */
function unitsByMetric(units: readonly string[]): Record<string, string[]> {
  const grouped: Record<string, string[]> = {};
  for (const unit of units) {
    const metric = metricForUnit(unit);
    if (!metric) continue;
    const bucket = grouped[metric] ?? (grouped[metric] = []);
    if (!bucket.includes(unit)) bucket.push(unit);
  }
  for (const key of Object.keys(grouped)) grouped[key].sort();
  return grouped;
}

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
      const options = await describeComposerActivityOptions(db, id);
      return { ...options, unitsByMetric: unitsByMetric(options.compatibleUnits) };
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
