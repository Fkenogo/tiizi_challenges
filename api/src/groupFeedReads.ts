import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { apiPath } from './apiPrefix.js';
import type { GroupMembershipAuthority } from './groupMembershipAuthority.js';

export const GROUP_FEED_PAGE_DEFAULT = 20;
export const GROUP_FEED_PAGE_MAX = 50;
export const GROUP_FEED_CURSOR_TTL_MS = 24 * 60 * 60 * 1000;
export const GROUP_FEED_CURSOR_SECRET_ENV = 'TIIZI_GROUP_FEED_CURSOR_SECRET';
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const ORDERING = 'source_transition_at_desc_feed_event_id_desc';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

// GF-01 v1.1: exactly four member-visible Group Feed families. Challenge
// finalization remains domain truth but is not a Group Feed event.
const TITLES = {
  challenge_established: 'A new Challenge is available',
  challenge_started: 'The Challenge has started',
  together_goal_achieved: 'The Group reached its Challenge goal',
  challenge_ended: 'The Challenge has ended',
} as const;

export type GroupFeedEventType = keyof typeof TITLES;

export interface GroupFeedEvent {
  feedEventId: string;
  eventType: GroupFeedEventType;
  challengeId: string;
  challengeTitle: string;
  presentationTitle: (typeof TITLES)[GroupFeedEventType];
  occurredAt: string;
  navigationTarget: { type: 'challenge'; challengeId: string };
}

export interface GroupFeedPage {
  groupId: string;
  events: GroupFeedEvent[];
  nextCursor: string | null;
}

export class GroupFeedReadError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

interface CursorPayload {
  v: 1;
  groupId: string;
  ordering: typeof ORDERING;
  direction: 'desc';
  pageSize: number;
  lastScannedAt: string;
  lastScannedId: string;
  issuedAt: number;
  expiresAt: number;
}

interface FeedRow {
  feed_event_id: string;
  event_type: GroupFeedEventType;
  challenge_id: string;
  challenge_title: string;
  source_transition_at: string | Date;
}

function invalidCursor(): never {
  throw new GroupFeedReadError(400, 'invalid_cursor', 'Feed cursor is invalid');
}

function cursorSecret(raw = process.env[GROUP_FEED_CURSOR_SECRET_ENV]): Buffer {
  if (!raw || Buffer.byteLength(raw, 'utf8') < 32) {
    throw new GroupFeedReadError(503, 'feed_unavailable', 'Feed read authority is unavailable');
  }
  return Buffer.from(raw, 'utf8');
}

function signature(payload: string, secret: Buffer): Buffer {
  return createHmac('sha256', secret).update(payload).digest();
}

function decodeCanonicalBase64Url(value: string): Buffer {
  if (!value || !BASE64URL_RE.test(value)) return invalidCursor();
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length === 0 || decoded.toString('base64url') !== value) return invalidCursor();
  return decoded;
}

function encodeCursor(payload: CursorPayload, secret: Buffer): string {
  const body = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  return `${body}.${signature(body, secret).toString('base64url')}`;
}

function decodeCursor(
  value: string,
  groupId: string,
  pageSize: number,
  now: Date,
  secret: Buffer,
): CursorPayload {
  try {
    const parts = value.split('.');
    if (parts.length !== 2 || !parts[0] || !parts[1]) return invalidCursor();
    const body = decodeCanonicalBase64Url(parts[0]);
    const supplied = decodeCanonicalBase64Url(parts[1]);
    const expected = signature(parts[0], secret);
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return invalidCursor();
    const parsed = JSON.parse(body.toString('utf8')) as Partial<CursorPayload>;
    if (parsed.v !== 1 || parsed.groupId !== groupId || parsed.ordering !== ORDERING
        || parsed.direction !== 'desc' || parsed.pageSize !== pageSize
        || typeof parsed.issuedAt !== 'number' || typeof parsed.expiresAt !== 'number'
        || parsed.expiresAt <= now.getTime() || parsed.expiresAt - parsed.issuedAt !== GROUP_FEED_CURSOR_TTL_MS
        || parsed.issuedAt > now.getTime() || typeof parsed.lastScannedAt !== 'string'
        || Number.isNaN(Date.parse(parsed.lastScannedAt)) || typeof parsed.lastScannedId !== 'string'
        || !UUID_RE.test(parsed.lastScannedId)) return invalidCursor();
    return parsed as CursorPayload;
  } catch {
    return invalidCursor();
  }
}

function parseLimit(raw: unknown): number {
  if (raw === undefined) return GROUP_FEED_PAGE_DEFAULT;
  const value = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && /^\d+$/.test(raw)
      ? Number(raw)
      : NaN;
  if (!Number.isInteger(value) || value < 1 || value > GROUP_FEED_PAGE_MAX) {
    throw new GroupFeedReadError(400, 'invalid_limit', 'limit must be an integer between 1 and 50');
  }
  return value;
}

async function requireCurrentMember(
  authority: GroupMembershipAuthority,
  groupId: string,
  memberId: string,
): Promise<void> {
  let membership;
  try {
    membership = await authority.resolveGroupMembershipAuthority(groupId, memberId);
  } catch {
    throw new GroupFeedReadError(503, 'feed_unavailable', 'Feed read authority is unavailable');
  }
  if (!membership || membership.eligible !== true) {
    throw new GroupFeedReadError(404, 'unknown_group', 'Group not found');
  }
}

/** Read a bounded member page from current, retained GF-02 projections only. */
export async function getGroupFeedPage(
  db: Db,
  authority: GroupMembershipAuthority,
  memberId: string,
  groupId: string,
  options: { limit?: unknown; cursor?: unknown; now?: Date; secret?: string } = {},
): Promise<GroupFeedPage> {
  if (!UUID_RE.test(groupId)) throw new GroupFeedReadError(400, 'invalid_group', 'groupId must be a Tiizi Group UUID');
  const limit = parseLimit(options.limit);
  const now = options.now ?? new Date();
  const secret = cursorSecret(options.secret);
  const cursor = options.cursor === undefined
    ? null
    : typeof options.cursor === 'string' && options.cursor.length <= 2048
      ? decodeCursor(options.cursor, groupId, limit, now, secret)
      : invalidCursor();

  await requireCurrentMember(authority, groupId, memberId);

  const retentionCutoff = new Date(now.getTime() - RETENTION_MS);
  // GF-01 v1.1: no finalized Group Feed event exists, so no
  // ended/finalized presentation consolidation applies. Ended events remain
  // visible under the normal retention/visibility/suppression rules below.
  const result = await db.query<FeedRow>(
    `SELECT p.feed_event_id, p.event_type, p.source_id AS challenge_id,
            c.title AS challenge_title, p.source_transition_at
     FROM group_feed_projection p
     JOIN groups g ON g.group_id = p.group_id AND g.status = 'active'
     JOIN challenges c ON c.challenge_id = p.source_id AND c.group_id = p.group_id
     WHERE p.group_id = $1
       AND p.source_type = 'challenge'
       AND p.event_type IN (
         'challenge_established', 'challenge_started',
         'together_goal_achieved', 'challenge_ended'
       )
       AND p.suppressed_at IS NULL
       AND p.source_transition_at >= $2
       AND ($3::timestamptz IS NULL OR (p.source_transition_at, p.feed_event_id) < ($3::timestamptz, $4::uuid))
     ORDER BY p.source_transition_at DESC, p.feed_event_id DESC
     LIMIT $5`,
    [groupId, retentionCutoff.toISOString(), cursor?.lastScannedAt ?? null, cursor?.lastScannedId ?? null, limit + 1],
  );

  const hasMore = result.rows.length > limit;
  const pageRows = result.rows.slice(0, limit);
  const events = pageRows.map((row): GroupFeedEvent => ({
    feedEventId: String(row.feed_event_id),
    eventType: row.event_type,
    challengeId: String(row.challenge_id),
    challengeTitle: String(row.challenge_title),
    presentationTitle: TITLES[row.event_type],
    occurredAt: new Date(row.source_transition_at).toISOString(),
    navigationTarget: { type: 'challenge', challengeId: String(row.challenge_id) },
  }));
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last
    ? encodeCursor({
      v: 1,
      groupId,
      ordering: ORDERING,
      direction: 'desc',
      pageSize: limit,
      lastScannedAt: new Date(last.source_transition_at).toISOString(),
      lastScannedId: String(last.feed_event_id),
      issuedAt: now.getTime(),
      expiresAt: now.getTime() + GROUP_FEED_CURSOR_TTL_MS,
    }, secret)
    : null;
  return { groupId, events, nextCursor };
}

export interface GroupFeedRouteDeps {
  groupMembershipAuthority?: GroupMembershipAuthority;
  now?: () => Date;
  cursorSecret?: () => string | undefined;
}

export function registerGroupFeedRoutes(app: FastifyInstance, db: Db, deps: GroupFeedRouteDeps = {}): void {
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.routeOptions.url === apiPath('/groups/:groupId/feed')) {
      reply.header('Cache-Control', 'private, no-store');
    }
    return payload;
  });
  app.get(apiPath('/groups/:groupId/feed'), {
    schema: {
      params: {
        type: 'object', required: ['groupId'],
        properties: { groupId: { type: 'string', format: 'uuid' } },
      },
      querystring: {
        type: 'object', additionalProperties: false,
        properties: {
          limit: { type: 'string', pattern: '^\\d+$' },
          cursor: { type: 'string', maxLength: 2048 },
        },
      },
      response: {
        200: {
          type: 'object', required: ['groupId', 'events', 'nextCursor'], additionalProperties: false,
          properties: {
            groupId: { type: 'string', format: 'uuid' },
            events: { type: 'array', items: {
              type: 'object', additionalProperties: false,
              required: ['feedEventId', 'eventType', 'challengeId', 'challengeTitle', 'presentationTitle', 'occurredAt', 'navigationTarget'],
              properties: {
                feedEventId: { type: 'string', format: 'uuid' },
                eventType: { type: 'string', enum: Object.keys(TITLES) },
                challengeId: { type: 'string', format: 'uuid' },
                challengeTitle: { type: 'string' },
                presentationTitle: { type: 'string' },
                occurredAt: { type: 'string', format: 'date-time' },
                navigationTarget: {
                  type: 'object', additionalProperties: false, required: ['type', 'challengeId'],
                  properties: { type: { const: 'challenge' }, challengeId: { type: 'string', format: 'uuid' } },
                },
              },
            } },
            nextCursor: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
        },
      },
    },
  }, async (request) => {
    const member = authenticatedMember(request);
    const params = request.params as { groupId: string };
    const query = request.query as { limit?: string; cursor?: string };
    const authority = deps.groupMembershipAuthority;
    if (!authority) throw new GroupFeedReadError(503, 'feed_unavailable', 'Feed read authority is unavailable');
    try {
      return await getGroupFeedPage(db, authority, member.memberId, params.groupId, {
        limit: query.limit,
        cursor: query.cursor,
        now: deps.now?.(),
        secret: deps.cursorSecret?.(),
      });
    } catch (error) {
      if (error instanceof GroupFeedReadError) throw error;
      throw new GroupFeedReadError(503, 'feed_unavailable', 'Feed read authority is unavailable');
    }
  });
}
