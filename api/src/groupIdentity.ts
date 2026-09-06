import type { FastifyInstance } from 'fastify';
import type { Db } from './db.js';

export interface GroupIdentityMapping {
  /**
   * Transitional Firestore document id. Lookup key only — never a domain id.
   * Present solely so strangler-migration callers can translate the legacy
   * identity they already hold into the authoritative Tiizi UUID.
   */
  legacyId: string;
  /** Authoritative Tiizi group UUID (`groups.group_id`). */
  id: string;
}

export interface GroupIdentityQuery {
  legacyIds: string[];
  uuids: string[];
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Upper bound per request so the seam cannot be used to dump the table. */
const MAX_IDS_PER_REQUEST = 200;

function cleanIds(values: unknown): string[] {
  const raw = Array.isArray(values) ? values : values === undefined ? [] : [values];
  const seen = new Set<string>();
  for (const value of raw) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    if (seen.size >= MAX_IDS_PER_REQUEST) break;
  }
  return [...seen];
}

export function parseGroupIdentityQuery(query: unknown): GroupIdentityQuery {
  const params = (query ?? {}) as Record<string, unknown>;
  return {
    legacyIds: cleanIds(params.legacyId ?? params.legacyIds),
    uuids: cleanIds(params.id ?? params.ids).filter((id) => UUID_RE.test(id)),
  };
}

interface IdentityRow {
  group_id: string;
  legacy_firestore_id: string | null;
}

/**
 * Bidirectional transitional lookup between Tiizi group UUIDs and legacy
 * Firestore group document ids. Read-only: resolving never creates UUIDs —
 * UUIDs are minted only by the shadow importer on first sight of a legacy
 * entity, so repeated resolution is inherently stable.
 */
export async function resolveGroupIdentity(
  db: Db,
  query: GroupIdentityQuery,
): Promise<GroupIdentityMapping[]> {
  const mappings = new Map<string, GroupIdentityMapping>();
  if (query.legacyIds.length > 0) {
    const rows = await db.query<IdentityRow>(
      `SELECT group_id, legacy_firestore_id FROM groups
       WHERE legacy_firestore_id = ANY($1)`,
      [query.legacyIds],
    );
    for (const row of rows.rows) {
      if (!row.legacy_firestore_id) continue;
      mappings.set(row.legacy_firestore_id, {
        legacyId: row.legacy_firestore_id,
        id: String(row.group_id),
      });
    }
  }
  if (query.uuids.length > 0) {
    const rows = await db.query<IdentityRow>(
      `SELECT group_id, legacy_firestore_id FROM groups
       WHERE group_id = ANY($1::uuid[])`,
      [query.uuids],
    );
    for (const row of rows.rows) {
      if (!row.legacy_firestore_id) continue;
      mappings.set(row.legacy_firestore_id, {
        legacyId: row.legacy_firestore_id,
        id: String(row.group_id),
      });
    }
  }
  return [...mappings.values()].sort((a, b) =>
    a.legacyId < b.legacyId ? -1 : a.legacyId > b.legacyId ? 1 : 0,
  );
}

const idArraySchema = {
  anyOf: [
    { type: 'string' },
    { type: 'array', items: { type: 'string' }, maxItems: MAX_IDS_PER_REQUEST },
  ],
};

export function registerGroupIdentityRoutes(app: FastifyInstance, db: Db): void {
  app.get(
    // TRANSITIONAL seam (strangler migration only). Domain objects keep using
    // the Tiizi UUID as `id`; this endpoint exists so legacy Firestore paths
    // can translate identities without provider ids leaking into the domain.
    // Remove once no caller holds Firestore group ids (target: Phase B+).
    '/v1/compat/group-ids',
    {
      schema: {
        querystring: {
          type: 'object',
          properties: {
            legacyId: idArraySchema,
            legacyIds: idArraySchema,
            id: idArraySchema,
            ids: idArraySchema,
          },
        },
        response: {
          200: {
            type: 'object',
            required: ['mappings'],
            properties: {
              mappings: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['legacyId', 'id'],
                  properties: {
                    legacyId: { type: 'string' },
                    id: { type: 'string', format: 'uuid' },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request): Promise<{ mappings: GroupIdentityMapping[] }> => {
      const query = parseGroupIdentityQuery(request.query);
      return { mappings: await resolveGroupIdentity(db, query) };
    },
  );
}
