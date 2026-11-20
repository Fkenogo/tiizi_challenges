import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { API_PREFIX } from './apiPrefix.js';
import { assertValidTimezone } from './challengeConfigs.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_VERSION = 1;

export type RecentActivityRevisionState = 'current' | 'updated' | 'reversed';

export interface RecentActivityItem {
  /** Stable identity of the originally accepted Activity application. */
  activityId: string;
  activityName: string;
  value: number;
  unit: string;
  occurredAt: string;
  recordedAt: string;
  acceptedAt: string;
  displayTimezone: string;
  revisionState: RecentActivityRevisionState;
  challenge: { id: string; title: string };
}

export interface RecentActivityPage {
  items: RecentActivityItem[];
  nextCursor: string | null;
}

export interface RecentActivityQuery {
  limit?: number;
  cursor?: string;
}

interface PageCursor {
  version: number;
  memberBinding: string;
  occurredAt: string;
  recordedAt: string;
  activityId: string;
}

interface RecentActivityRow {
  activity_id: string;
  activity_name: string;
  value: number | string;
  unit: string;
  occurred_at: string | Date;
  recorded_at: string | Date;
  accepted_at: string | Date;
  occurred_at_cursor: string;
  recorded_at_cursor: string;
  display_timezone: string;
  revision_state: RecentActivityRevisionState;
  challenge_id: string;
  challenge_title: string;
  application_count: number | string;
}

class InvalidRecentActivityCursorError extends Error {
  readonly statusCode = 400;
  readonly code = 'invalid_cursor';

  constructor() {
    super('Recent Activity cursor is invalid for this account or request');
    this.name = 'InvalidRecentActivityCursorError';
  }
}

function memberBinding(memberId: string): string {
  return createHash('sha256').update(memberId).digest('base64url');
}

function decodeCursor(cursor: string, memberId: string): PageCursor {
  try {
    if (cursor.length > 2048) throw new Error('cursor too long');
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    if (Buffer.from(json, 'utf8').toString('base64url') !== cursor) throw new Error('non-canonical cursor');
    const value = JSON.parse(json) as Partial<PageCursor>;
    if (
      value.version !== CURSOR_VERSION
      || value.memberBinding !== memberBinding(memberId)
      || typeof value.occurredAt !== 'string'
      || !Number.isFinite(Date.parse(value.occurredAt))
      || typeof value.recordedAt !== 'string'
      || !Number.isFinite(Date.parse(value.recordedAt))
      || typeof value.activityId !== 'string'
      || !UUID_RE.test(value.activityId)
    ) {
      throw new Error('invalid cursor payload');
    }
    return value as PageCursor;
  } catch {
    throw new InvalidRecentActivityCursorError();
  }
}

function encodeCursor(row: RecentActivityRow, memberId: string): string {
  const value: PageCursor = {
    version: CURSOR_VERSION,
    memberBinding: memberBinding(memberId),
    occurredAt: row.occurred_at_cursor,
    recordedAt: row.recorded_at_cursor,
    activityId: row.activity_id,
  };
  return Buffer.from(JSON.stringify(value), 'utf8').toString('base64url');
}

function toIsoTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error('Recent Activity contains an invalid timestamp');
  return date.toISOString();
}

/**
 * Reads accepted Challenge Activity applications for the authenticated owner.
 * The owner ID is supplied only by the server-authentication boundary. The
 * recursive walk joins corrections back to the one accepted application;
 * reversals display that accepted event's historical value while their
 * effective ledger timestamp remains Recorded At. No Feed projection is read
 * or written, and this projection never recomputes Challenge progress.
 */
export async function listMemberRecentActivity(
  db: Db,
  memberId: string,
  query: RecentActivityQuery = {},
): Promise<RecentActivityPage> {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new Error('Recent Activity page size is outside the supported range');
  }
  const cursor = query.cursor ? decodeCursor(query.cursor, memberId) : null;
  const result = await db.query<RecentActivityRow>(
    `WITH RECURSIVE current_events AS (
       SELECT event_id, member_id, activity_kind, canonical_key, activity_variant,
              knowledge_id, knowledge_version, occurred_at, occurred_tz,
              recorded_at, value, unit, supersedes_event_id, correction_kind
         FROM member_activity_events
        WHERE member_id = $1 AND status = 'committed'
     ), lineage AS (
       SELECT effective.event_id AS current_event_id,
              effective.event_id AS ancestor_event_id,
              effective.supersedes_event_id,
              0 AS depth
         FROM current_events effective
       UNION ALL
       SELECT lineage.current_event_id,
              parent.event_id,
              parent.supersedes_event_id,
              lineage.depth + 1
         FROM lineage
         JOIN member_activity_events parent
           ON parent.event_id = lineage.supersedes_event_id
          AND parent.member_id = $1
     ), applications AS (
       SELECT lineage.current_event_id,
              record.event_id AS activity_id,
              record.challenge_id,
              record.participation_id,
              record.config_version,
              record.accepted_at,
              COUNT(*) OVER (PARTITION BY lineage.current_event_id) AS application_count,
              ROW_NUMBER() OVER (
                PARTITION BY lineage.current_event_id
                ORDER BY lineage.depth DESC
              ) AS application_rank
         FROM lineage
         JOIN challenge_activity_records record
           ON record.event_id = lineage.ancestor_event_id
         JOIN challenge_participations participation
           ON participation.participation_id = record.participation_id
          AND participation.challenge_id = record.challenge_id
          AND participation.member_id = $1
     )
     SELECT accepted.event_id::text AS activity_id,
            COALESCE(activity_version.name, activity.name, display.canonical_key) AS activity_name,
            display.value,
            display.unit,
            display.occurred_at,
            effective.recorded_at,
            application.accepted_at,
            to_char(display.occurred_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS occurred_at_cursor,
            to_char(effective.recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recorded_at_cursor,
            COALESCE(display.occurred_tz, config.snapshot->>'timezone', 'UTC') AS display_timezone,
            CASE effective.correction_kind
              WHEN 'correction' THEN 'updated'
              WHEN 'reversal' THEN 'reversed'
              ELSE 'current'
            END AS revision_state,
            challenge.challenge_id::text AS challenge_id,
            challenge.title AS challenge_title,
            application.application_count
       FROM current_events effective
       JOIN applications application
         ON application.current_event_id = effective.event_id
        AND application.application_rank = 1
       JOIN member_activity_events accepted
         ON accepted.event_id = application.activity_id
       JOIN member_activity_events display
         ON display.event_id = CASE
           WHEN effective.correction_kind = 'reversal' THEN accepted.event_id
           ELSE effective.event_id
         END
       JOIN challenges challenge ON challenge.challenge_id = application.challenge_id
       JOIN challenge_config_versions config
         ON config.challenge_id = application.challenge_id
        AND config.version = application.config_version
       LEFT JOIN knowledge_item_versions activity_version
         ON activity_version.item_id = display.knowledge_id
        AND activity_version.version = display.knowledge_version
       LEFT JOIN knowledge_items activity ON activity.knowledge_id = display.knowledge_id
      WHERE ($2::timestamptz IS NULL OR
             (display.occurred_at, effective.recorded_at, accepted.event_id) <
             ($2::timestamptz, $3::timestamptz, $4::uuid))
      ORDER BY display.occurred_at DESC, effective.recorded_at DESC, accepted.event_id DESC
      LIMIT $5`,
    [
      memberId,
      cursor?.occurredAt ?? null,
      cursor?.recordedAt ?? null,
      cursor?.activityId ?? null,
      limit + 1,
    ],
  );

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const items = rows.map((row): RecentActivityItem => {
    if (Number(row.application_count) !== 1) {
      throw new Error('Recent Activity lineage has multiple accepted applications');
    }
    return {
      activityId: row.activity_id,
      activityName: row.activity_name,
      value: Number(row.value),
      unit: row.unit,
      occurredAt: toIsoTimestamp(row.occurred_at),
      recordedAt: toIsoTimestamp(row.recorded_at),
      acceptedAt: toIsoTimestamp(row.accepted_at),
      displayTimezone: assertValidTimezone(row.display_timezone),
      revisionState: row.revision_state,
      challenge: { id: row.challenge_id, title: row.challenge_title },
    };
  });

  return {
    items,
    nextCursor: hasMore ? encodeCursor(rows[rows.length - 1], memberId) : null,
  };
}

export function registerMemberRecentActivityRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Querystring: RecentActivityQuery }>(
    `${API_PREFIX}/me/activity`,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE },
            cursor: { type: 'string', maxLength: 2048 },
          },
        },
      },
    },
    async (request) => {
      const { memberId } = authenticatedMember(request);
      return listMemberRecentActivity(db, memberId, request.query);
    },
  );
}
