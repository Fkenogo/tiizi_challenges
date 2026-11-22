/**
 * CF-2 / CF-3 — Challenge Feed S1 Activity Share publication and read.
 *
 * Product Truth: `docs/product-truth/TIIZI-CF-01-CHALLENGE-FEED-PRODUCT-TRUTH.md`
 * (v0.2, EFFECTIVE §3–§6) plus the AEC-005 2026-11-19 disposition (§5).
 *
 * Scope of this module (Founder CF-2/CF-3/S1 authorization):
 * - S1 ONLY: the authenticated member may explicitly Share their OWN
 *   accepted participant Activity into the Challenge-local Feed.
 * - Published fields are exactly the CF-01 §4.2 S1 allow-list: the sharer's
 *   display name, the Activity name, the member's own accepted value and
 *   its unit. The accepted prototype's Challenge title stays PREVIEW-ONLY
 *   (AEC-005 §5) and is never published. No raw evidence, notes, location,
 *   exact routine time, points or metadata leaves the ledger.
 * - Private by default: nothing here runs automatically from logging, and
 *   the canonical Activity write path has no publication dependency
 *   (CF-01 §8: a recorder separate from the Group Feed's
 *   `recordChallengePublication`).
 * - The Feed never expands visibility (CF-01 §3.5): every read re-checks
 *   current Group membership and Challenge visibility for every viewer,
 *   and denials are indistinguishable from not-found.
 * - Withdrawal hides the Share; it never deletes, rewrites or changes the
 *   canonical Activity, its evidence, score, progress or results.
 * - Retention (CF-01 §5): the Feed is readable for the Challenge lifetime
 *   plus 90 days after it ends; expired Feeds return no items.
 * - Correction/reversal safety: a Share is visible only while its source
 *   event is the current committed state of its lineage. A superseded
 *   (corrected or reversed) source hides the Share at read time; the
 *   member may explicitly re-Share the corrected Activity as a new source.
 *   A value the member never previewed is never silently published.
 *
 * NOT implemented here (unauthorized in this package): A1–A6 automatic
 * moments, S2 Streak milestones (qualifying schedule undecided), S3 Race
 * results, Kudos, announcements, external sharing, Group Feed changes.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { apiPath } from './apiPrefix.js';
import type { GroupMembershipAuthority } from './groupMembershipAuthority.js';
import { readChallengeForFeed, requireChallengeFeedVisible } from './challengeReads.js';

export const CHALLENGE_FEED_EVENT_FAMILIES = ['activity_share'] as const;
export type ChallengeFeedEventFamily = (typeof CHALLENGE_FEED_EVENT_FAMILIES)[number];

export const CHALLENGE_FEED_PAGE_DEFAULT = 20;
export const CHALLENGE_FEED_PAGE_MAX = 50;
export const CHALLENGE_FEED_CURSOR_TTL_MS = 24 * 60 * 60 * 1000;
export const CHALLENGE_FEED_CURSOR_SECRET_ENV = 'TIIZI_CHALLENGE_FEED_CURSOR_SECRET';
const RETENTION_MS = 90 * 24 * 60 * 60 * 1000;
const ORDERING = 'published_at_desc_share_id_desc';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;

export interface ChallengeFeedItem {
  feedItemId: string;
  kind: 'activity_share';
  activityEventId: string;
  sharerDisplayName: string | null;
  activityName: string;
  value: number;
  unit: string;
  publishedAt: string;
  ownShare: boolean;
}

export interface ChallengeFeedPage {
  challengeId: string;
  items: ChallengeFeedItem[];
  nextCursor: string | null;
}

export interface ActivityShareState {
  shareId: string;
  challengeId: string;
  activityEventId: string;
  publishedAt: string;
  withdrawn: boolean;
}

export class ChallengeFeedError extends Error {
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
  challengeId: string;
  ordering: typeof ORDERING;
  direction: 'desc';
  pageSize: number;
  lastScannedAt: string;
  lastScannedId: string;
  issuedAt: number;
  expiresAt: number;
}

interface ShareRow extends Record<string, unknown> {
  share_id: string;
  member_id: string;
  activity_event_id: string;
  published_at: string | Date;
  value: number;
  unit: string;
  canonical_key: string;
  knowledge_id: string | null;
  knowledge_version: number | null;
  display_name: string | null;
  activity_name: string | null;
}

function invalidCursor(): never {
  throw new ChallengeFeedError(400, 'invalid_cursor', 'Feed cursor is invalid');
}

function cursorSecret(raw = process.env[CHALLENGE_FEED_CURSOR_SECRET_ENV]): Buffer {
  if (!raw || Buffer.byteLength(raw, 'utf8') < 32) {
    throw new ChallengeFeedError(503, 'feed_unavailable', 'Feed read authority is unavailable');
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
  challengeId: string,
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
    if (parsed.v !== 1 || parsed.challengeId !== challengeId || parsed.ordering !== ORDERING
        || parsed.direction !== 'desc' || parsed.pageSize !== pageSize
        || typeof parsed.issuedAt !== 'number' || typeof parsed.expiresAt !== 'number'
        || parsed.expiresAt <= now.getTime() || parsed.expiresAt - parsed.issuedAt !== CHALLENGE_FEED_CURSOR_TTL_MS
        || parsed.issuedAt > now.getTime() || typeof parsed.lastScannedAt !== 'string'
        || Number.isNaN(Date.parse(parsed.lastScannedAt)) || typeof parsed.lastScannedId !== 'string'
        || !UUID_RE.test(parsed.lastScannedId)) return invalidCursor();
    return parsed as CursorPayload;
  } catch {
    return invalidCursor();
  }
}

function parseLimit(raw: unknown): number {
  if (raw === undefined) return CHALLENGE_FEED_PAGE_DEFAULT;
  const value = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && /^\d+$/.test(raw)
      ? Number(raw)
      : NaN;
  if (!Number.isInteger(value) || value < 1 || value > CHALLENGE_FEED_PAGE_MAX) {
    throw new ChallengeFeedError(400, 'invalid_limit', 'limit must be an integer between 1 and 50');
  }
  return value;
}

/** The CF-01 §5 audience predicate: current Group membership AND current
 * Challenge visibility, rechecked on EVERY read, denial indistinguishable
 * from not-found. Authority outages fail closed with 503. */
async function requireFeedAudience(
  db: Db,
  authority: GroupMembershipAuthority,
  challengeId: string,
  memberId: string,
): Promise<{ groupId: string; endedAt: Date | null }> {
  if (!UUID_RE.test(challengeId)) {
    throw new ChallengeFeedError(400, 'invalid_challenge_id', 'challengeId must be a Tiizi challenge UUID');
  }
  try {
    const challenge = await readChallengeForFeed(db, challengeId);
    let membership;
    try {
      membership = await authority.resolveGroupMembershipAuthority(challenge.group_id, memberId);
    } catch {
      throw new ChallengeFeedError(503, 'feed_unavailable', 'Feed read authority is unavailable');
    }
    if (!membership || membership.eligible !== true) {
      // Non-members see the same not-found as for an unknown Challenge.
      throw new ChallengeFeedError(404, 'unknown_challenge', 'Challenge not found');
    }
    await requireChallengeFeedVisible(db, challenge, memberId, authority);
    return { groupId: challenge.group_id, endedAt: challenge.ended_at ? new Date(challenge.ended_at) : null };
  } catch (error) {
    if (error instanceof ChallengeFeedError) throw error;
    // Preserve the Challenge read contract's own 4xx denials (not-found,
    // invalid id, authority-unavailable) instead of masking them.
    const candidate = error as { statusCode?: number; code?: string };
    if (typeof candidate.statusCode === 'number' && typeof candidate.code === 'string'
        && candidate.statusCode >= 400 && candidate.statusCode < 500) {
      throw new ChallengeFeedError(candidate.statusCode, candidate.code, (error as Error).message);
    }
    throw new ChallengeFeedError(503, 'feed_unavailable', 'Feed read authority is unavailable');
  }
}

function feedExpired(endedAt: Date | null, now: Date): boolean {
  return endedAt !== null && now.getTime() - endedAt.getTime() > RETENTION_MS;
}

/** Read a bounded member page of currently-visible S1 Shares. */
export async function getChallengeFeedPage(
  db: Db,
  authority: GroupMembershipAuthority,
  memberId: string,
  challengeId: string,
  options: { limit?: unknown; cursor?: unknown; now?: Date; secret?: string } = {},
): Promise<ChallengeFeedPage> {
  const limit = parseLimit(options.limit);
  const now = options.now ?? new Date();
  const secret = cursorSecret(options.secret);
  const cursor = options.cursor === undefined
    ? null
    : typeof options.cursor === 'string' && options.cursor.length <= 2048
      ? decodeCursor(options.cursor, challengeId, limit, now, secret)
      : invalidCursor();

  const { endedAt } = await requireFeedAudience(db, authority, challengeId, memberId);
  if (feedExpired(endedAt, now)) return { challengeId, items: [], nextCursor: null };

  const result = await db.query<ShareRow>(
    `SELECT s.share_id, s.member_id, s.activity_event_id, s.published_at,
            e.value, e.unit, e.canonical_key, e.knowledge_id, e.knowledge_version,
            m.display_name,
            COALESCE(kv.name, k.name, e.canonical_key) AS activity_name
       FROM challenge_feed_shares s
       JOIN member_activity_events e
         ON e.event_id = s.activity_event_id AND e.status = 'committed'
       JOIN members m ON m.member_id = s.member_id
       LEFT JOIN knowledge_item_versions kv
         ON kv.item_id = e.knowledge_id AND kv.version = e.knowledge_version
       LEFT JOIN knowledge_items k ON k.knowledge_id = e.knowledge_id
      WHERE s.challenge_id = $1
        AND s.event_family = 'activity_share'
        AND s.withdrawn_at IS NULL
        AND s.suppressed_at IS NULL
        AND ($2::timestamptz IS NULL OR (s.published_at, s.share_id) < ($2::timestamptz, $3::uuid))
      ORDER BY s.published_at DESC, s.share_id DESC
      LIMIT $4`,
    [challengeId, cursor?.lastScannedAt ?? null, cursor?.lastScannedId ?? null, limit + 1],
  );

  const hasMore = result.rows.length > limit;
  const pageRows = result.rows.slice(0, limit);
  const items = pageRows.map((row): ChallengeFeedItem => ({
    feedItemId: String(row.share_id),
    kind: 'activity_share',
    activityEventId: String(row.activity_event_id),
    sharerDisplayName: row.display_name === null ? null : String(row.display_name),
    activityName: String(row.activity_name),
    value: Number(row.value),
    unit: String(row.unit),
    publishedAt: new Date(row.published_at).toISOString(),
    ownShare: String(row.member_id) === memberId,
  }));
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last
    ? encodeCursor({
      v: 1,
      challengeId,
      ordering: ORDERING,
      direction: 'desc',
      pageSize: limit,
      lastScannedAt: new Date(last.published_at).toISOString(),
      lastScannedId: String(last.share_id),
      issuedAt: now.getTime(),
      expiresAt: now.getTime() + CHALLENGE_FEED_CURSOR_TTL_MS,
    }, secret)
    : null;
  return { challengeId, items, nextCursor };
}

interface ShareSourceRow extends Record<string, unknown> {
  record_id: string;
  event_status: 'committed' | 'superseded';
  value: number;
  unit: string;
}

/** Publish (or idempotently return / revive) the member's own accepted
 * Activity Share. One ACTIVE Share per member per source Activity; repeat
 * requests converge on the same row and never duplicate. */
export async function publishActivityShare(
  db: Db,
  authority: GroupMembershipAuthority,
  memberId: string,
  challengeId: string,
  activityEventId: string,
  options: { now?: Date } = {},
): Promise<ActivityShareState> {
  const now = options.now ?? new Date();
  if (!UUID_RE.test(challengeId)) {
    throw new ChallengeFeedError(400, 'invalid_challenge_id', 'challengeId must be a Tiizi challenge UUID');
  }
  if (!UUID_RE.test(activityEventId)) {
    throw new ChallengeFeedError(400, 'invalid_activity_id', 'activityEventId must be a Tiizi Activity UUID');
  }

  // CF-01 §5 audience: the sharer must still be an authorized viewer.
  const { endedAt } = await requireFeedAudience(db, authority, challengeId, memberId);
  if (feedExpired(endedAt, now)) {
    throw new ChallengeFeedError(409, 'feed_expired', 'This Challenge Feed has expired');
  }

  // S1 source authority: the caller's own accepted application of this
  // exact event — or, for a corrected Activity, of an event in its
  // supersede lineage — to this exact Challenge. Self-only by
  // construction; a foreign or unapplied event id is indistinguishable
  // from not-found. This mirrors the lineage join the owner's Personal
  // Activity History uses, so the Share source identity and the History
  // identity agree for corrected Activities.
  const source = await db.query<ShareSourceRow>(
    `WITH RECURSIVE lineage AS (
       SELECT event_id, supersedes_event_id
         FROM member_activity_events
        WHERE event_id = $3 AND member_id = $2
       UNION ALL
       SELECT parent.event_id, parent.supersedes_event_id
         FROM lineage
         JOIN member_activity_events parent ON parent.event_id = lineage.supersedes_event_id
     )
     SELECT r.record_id, e.status AS event_status, e.value, e.unit
       FROM member_activity_events e
       JOIN challenge_activity_records r
         ON r.event_id IN (SELECT event_id FROM lineage)
        AND r.accepted_at IS NOT NULL
       JOIN challenge_participations p ON p.participation_id = r.participation_id
      WHERE e.event_id = $3
        AND e.member_id = $2
        AND r.challenge_id = $1
        AND p.member_id = $2
      LIMIT 1`,
    [challengeId, memberId, activityEventId],
  );
  const row = source.rows[0];
  if (!row) {
    throw new ChallengeFeedError(404, 'unknown_activity', 'Activity not found');
  }
  if (row.event_status !== 'committed') {
    // Corrected or reversed: the previewed value is no longer the current
    // effective state; the member shares the corrected Activity instead.
    throw new ChallengeFeedError(
      409,
      'source_not_current',
      'This Activity was corrected or reversed; share the current version instead',
    );
  }

  // Idempotent by source identity: one row per (member, event), revived in
  // place after withdrawal (CF-01 §6.1: one active Share, no duplicates).
  const upsert = await db.query<{ share_id: string; published_at: string | Date }>(
    `INSERT INTO challenge_feed_shares
       (challenge_id, member_id, activity_event_id, activity_record_id, event_family)
     VALUES ($1, $2, $3, $4, 'activity_share')
     ON CONFLICT (member_id, activity_event_id) DO UPDATE
       SET withdrawn_at = NULL, published_at = now()
     RETURNING share_id, published_at`,
    [challengeId, memberId, activityEventId, String(row.record_id)],
  );
  const share = upsert.rows[0];
  if (!share) {
    throw new ChallengeFeedError(503, 'feed_unavailable', 'Share publication is unavailable');
  }
  return {
    shareId: String(share.share_id),
    challengeId,
    activityEventId,
    publishedAt: new Date(share.published_at).toISOString(),
    withdrawn: false,
  };
}

/** Withdraw the sharer's own Share: hides the Feed item, never deletes or
 * rewrites the canonical Activity. Idempotent. */
export async function withdrawActivityShare(
  db: Db,
  authority: GroupMembershipAuthority,
  memberId: string,
  challengeId: string,
  activityEventId: string,
): Promise<ActivityShareState> {
  if (!UUID_RE.test(challengeId)) {
    throw new ChallengeFeedError(400, 'invalid_challenge_id', 'challengeId must be a Tiizi challenge UUID');
  }
  if (!UUID_RE.test(activityEventId)) {
    throw new ChallengeFeedError(400, 'invalid_activity_id', 'activityEventId must be a Tiizi Activity UUID');
  }
  await requireFeedAudience(db, authority, challengeId, memberId);

  const updated = await db.query<{ share_id: string; published_at: string | Date; withdrawn_at: string | Date | null }>(
    `UPDATE challenge_feed_shares
        SET withdrawn_at = COALESCE(withdrawn_at, now())
      WHERE member_id = $1 AND activity_event_id = $2 AND challenge_id = $3
      RETURNING share_id, published_at, withdrawn_at`,
    [memberId, activityEventId, challengeId],
  );
  const share = updated.rows[0];
  if (!share) {
    // The caller's own Share (or none) is indistinguishable from not-found.
    throw new ChallengeFeedError(404, 'unknown_activity', 'Activity not found');
  }
  return {
    shareId: String(share.share_id),
    challengeId,
    activityEventId,
    publishedAt: new Date(share.published_at).toISOString(),
    withdrawn: true,
  };
}

export interface ChallengeFeedRouteDeps {
  groupMembershipAuthority?: GroupMembershipAuthority;
  now?: () => Date;
  cursorSecret?: () => string | undefined;
}

export function registerChallengeFeedRoutes(app: FastifyInstance, db: Db, deps: ChallengeFeedRouteDeps = {}): void {
  app.addHook('onSend', async (request, reply, payload) => {
    if (request.routeOptions.url === apiPath('/challenges/:challengeId/feed')) {
      reply.header('Cache-Control', 'private, no-store');
    }
    return payload;
  });

  const activityShareBodySchema = {
    type: 'object',
    required: ['activityEventId'],
    additionalProperties: false,
    properties: { activityEventId: { type: 'string', format: 'uuid' } },
  };

  const shareStateResponseSchema = {
    type: 'object',
    required: ['shareId', 'challengeId', 'activityEventId', 'publishedAt', 'withdrawn'],
    additionalProperties: false,
    properties: {
      shareId: { type: 'string', format: 'uuid' },
      challengeId: { type: 'string', format: 'uuid' },
      activityEventId: { type: 'string', format: 'uuid' },
      publishedAt: { type: 'string', format: 'date-time' },
      withdrawn: { type: 'boolean' },
    },
  };

  app.get(apiPath('/challenges/:challengeId/feed'), {
    schema: {
      params: {
        type: 'object', required: ['challengeId'],
        properties: { challengeId: { type: 'string', format: 'uuid' } },
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
          type: 'object', required: ['challengeId', 'items', 'nextCursor'], additionalProperties: false,
          properties: {
            challengeId: { type: 'string', format: 'uuid' },
            items: {
              type: 'array', items: {
                type: 'object', additionalProperties: false,
                required: ['feedItemId', 'kind', 'activityEventId', 'sharerDisplayName', 'activityName', 'value', 'unit', 'publishedAt', 'ownShare'],
                properties: {
                  feedItemId: { type: 'string', format: 'uuid' },
                  kind: { const: 'activity_share' },
                  activityEventId: { type: 'string', format: 'uuid' },
                  sharerDisplayName: { anyOf: [{ type: 'string' }, { type: 'null' }] },
                  activityName: { type: 'string' },
                  value: { type: 'number' },
                  unit: { type: 'string' },
                  publishedAt: { type: 'string', format: 'date-time' },
                  ownShare: { type: 'boolean' },
                },
              },
            },
            nextCursor: { anyOf: [{ type: 'string' }, { type: 'null' }] },
          },
        },
      },
    },
  }, async (request) => {
    const member = authenticatedMember(request);
    const params = request.params as { challengeId: string };
    const query = request.query as { limit?: string; cursor?: string };
    const authority = deps.groupMembershipAuthority;
    if (!authority) throw new ChallengeFeedError(503, 'feed_unavailable', 'Feed read authority is unavailable');
    try {
      return await getChallengeFeedPage(db, authority, member.memberId, params.challengeId, {
        limit: query.limit,
        cursor: query.cursor,
        now: deps.now?.(),
        secret: deps.cursorSecret?.(),
      });
    } catch (error) {
      if (error instanceof ChallengeFeedError) throw error;
      throw new ChallengeFeedError(503, 'feed_unavailable', 'Feed read authority is unavailable');
    }
  });

  app.post(apiPath('/challenges/:challengeId/feed/activity-shares'), {
    schema: {
      params: {
        type: 'object', required: ['challengeId'],
        properties: { challengeId: { type: 'string', format: 'uuid' } },
      },
      body: activityShareBodySchema,
      response: { 200: shareStateResponseSchema },
    },
  }, async (request) => {
    const member = authenticatedMember(request);
    const params = request.params as { challengeId: string };
    const body = request.body as { activityEventId: string };
    const authority = deps.groupMembershipAuthority;
    if (!authority) throw new ChallengeFeedError(503, 'feed_unavailable', 'Feed read authority is unavailable');
    try {
      return await publishActivityShare(db, authority, member.memberId, params.challengeId, body.activityEventId, {
        now: deps.now?.(),
      });
    } catch (error) {
      if (error instanceof ChallengeFeedError) throw error;
      throw new ChallengeFeedError(503, 'feed_unavailable', 'Share publication is unavailable');
    }
  });

  app.delete(apiPath('/challenges/:challengeId/feed/activity-shares/:activityEventId'), {
    schema: {
      params: {
        type: 'object', required: ['challengeId', 'activityEventId'],
        properties: {
          challengeId: { type: 'string', format: 'uuid' },
          activityEventId: { type: 'string', format: 'uuid' },
        },
      },
      response: { 200: shareStateResponseSchema },
    },
  }, async (request) => {
    const member = authenticatedMember(request);
    const params = request.params as { challengeId: string; activityEventId: string };
    const authority = deps.groupMembershipAuthority;
    if (!authority) throw new ChallengeFeedError(503, 'feed_unavailable', 'Feed read authority is unavailable');
    try {
      return await withdrawActivityShare(db, authority, member.memberId, params.challengeId, params.activityEventId);
    } catch (error) {
      if (error instanceof ChallengeFeedError) throw error;
      throw new ChallengeFeedError(503, 'feed_unavailable', 'Share withdrawal is unavailable');
    }
  });
}
