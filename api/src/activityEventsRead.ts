import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import { listEffectiveEvents } from './activityEvents.js';
import type { Db } from './db.js';

/**
 * Phase C1 ledger read seam (shadow validation only).
 *
 * GET /v1/activity-events/me lists the caller's own committed ledger events.
 * PostgreSQL-only: needs no Firestore access, so it stays inside the current
 * auth/identity boundary (Firebase token -> internal member UUID).
 * No progress endpoint in C1: challenge metadata (types, targets) has no
 * PostgreSQL authority yet, so progress stays a C2 concern.
 */

export interface ApiActivityEvent {
  eventId: string;
  eventType: 'workout' | 'wellness';
  canonicalKey: string;
  knowledgeId: string | null;
  knowledgeVersion: number | null;
  occurredAt: string;
  occurredDay: string;
  value: number;
  unit: string;
  points: number;
  legacyChallengeId: string | null;
  logType: string | null;
}

export interface MyActivityEventsResponse {
  memberId: string;
  events: ApiActivityEvent[];
}

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export function resolveEventsLimit(raw: unknown): number {
  const n = typeof raw === 'string' ? Number(raw) : NaN;
  if (!Number.isInteger(n) || n < 1) return DEFAULT_LIMIT;
  return Math.min(n, MAX_LIMIT);
}

export async function listMyActivityEvents(
  db: Db,
  memberId: string,
  limit: number,
): Promise<ApiActivityEvent[]> {
  const rows = await listEffectiveEvents(db, { member_id: memberId });
  return rows
    .slice()
    .sort((a, b) => (a.occurred_at < b.occurred_at ? 1 : a.occurred_at > b.occurred_at ? -1 : 0))
    .slice(0, limit)
    .map((row) => ({
      eventId: row.event_id,
      eventType: row.event_type,
      canonicalKey: row.canonical_key,
      knowledgeId: row.knowledge_id,
      knowledgeVersion: row.knowledge_version,
      occurredAt: row.occurred_at,
      occurredDay: row.occurred_day,
      value: row.value,
      unit: row.unit,
      points: row.points,
      legacyChallengeId: row.legacy_challenge_id,
      logType: row.log_type,
    }));
}

export function registerActivityEventRoutes(app: FastifyInstance, db: Db): void {
  app.get(
    '/v1/activity-events/me',
    {
      schema: {
        response: {
          200: {
            type: 'object',
            required: ['memberId', 'events'],
            properties: {
              memberId: { type: 'string', format: 'uuid' },
              events: {
                type: 'array',
                items: {
                  type: 'object',
                  required: ['eventId', 'eventType', 'occurredAt', 'value', 'unit'],
                  properties: {
                    eventId: { type: 'string', format: 'uuid' },
                    eventType: { type: 'string' },
                    canonicalKey: { type: 'string' },
                    knowledgeId: { type: ['string', 'null'] },
                    knowledgeVersion: { type: ['number', 'null'] },
                    occurredAt: { type: 'string' },
                    occurredDay: { type: 'string' },
                    value: { type: 'number' },
                    unit: { type: 'string' },
                    points: { type: 'number' },
                    legacyChallengeId: { type: ['string', 'null'] },
                    logType: { type: ['string', 'null'] },
                  },
                },
              },
            },
          },
        },
      },
    },
    async (request): Promise<MyActivityEventsResponse> => {
      const member = authenticatedMember(request);
      const query = request.query as { limit?: unknown };
      const limit = resolveEventsLimit(query.limit);
      return {
        memberId: member.memberId,
        events: await listMyActivityEvents(db, member.memberId, limit),
      };
    },
  );
}
