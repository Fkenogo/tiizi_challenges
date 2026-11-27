import { createHash } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { API_PREFIX } from './apiPrefix.js';
import { assertValidTimezone } from './challengeConfigs.js';
import type { RecentActivityRevisionState } from './memberRecentActivity.js';

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;
const MAX_CURSOR_LENGTH = 2048;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CURSOR_KEY_RE = /^[0-9a-f]{64}$/;
const CURSOR_TIMESTAMP_RE = /^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const CURSOR_VERSION = 1;

export const PERSONAL_TIMELINE_EVENT_TYPES = [
  'group_created',
  'group_joined',
  'group_left',
  'challenge_created',
  'challenge_joined',
  'challenge_exited',
  'activity_logged',
  'challenge_finalized',
] as const;

export type PersonalTimelineEventType = (typeof PERSONAL_TIMELINE_EVENT_TYPES)[number];
export type PersonalTimelineCategory = 'group' | 'challenge' | 'activity' | 'result';

const EVENT_TYPE_SET = new Set<string>(PERSONAL_TIMELINE_EVENT_TYPES);

const EVENT_TYPE_RANK: Record<PersonalTimelineEventType, number> = {
  challenge_finalized: 8,
  activity_logged: 7,
  challenge_exited: 6,
  challenge_joined: 5,
  challenge_created: 4,
  group_left: 3,
  group_joined: 2,
  group_created: 1,
};

const VALID_EVENT_RANKS = new Set<number>(Object.values(EVENT_TYPE_RANK));

export interface PersonalTimelineNavigation {
  kind: 'group' | 'challenge' | 'none';
  path: string | null;
  accessible: boolean;
}

export interface PersonalTimelineGroupContext {
  id: string | null;
  name: string | null;
  isPrivate: boolean;
  accessible: boolean;
}

export interface PersonalTimelineChallengeContext {
  id: string | null;
  title: string | null;
  challengeType: 'collective' | 'competitive' | 'streak' | null;
  accessible: boolean;
}

export interface PersonalTimelineActivityPayload {
  activityId: string;
  activityName: string | null;
  value: number | null;
  unit: string | null;
  acceptedAt: string;
  revisionState: RecentActivityRevisionState;
}

export interface PersonalTimelineExitPayload {
  participationId: string;
  exitReason: 'withdrawn' | 'removed';
}

export interface PersonalTimelineResultPayload {
  participationId: string;
  completed: boolean | null;
  completedAt: string | null;
  finalPosition: number | null;
  daysCompleted: number | null;
  bestStreak: number | null;
  finalStreak: number | null;
  collectiveTotal: number | null;
  collectiveGoalReached: boolean | null;
  goalValue: number | null;
  goalUnit: string | null;
}

export interface PersonalTimelineItem {
  timelineEventId: string;
  eventType: PersonalTimelineEventType;
  category: PersonalTimelineCategory;
  label: string;
  recordedAt: string;
  performedAt: string | null;
  displayTimezone: string | null;
  navigation: PersonalTimelineNavigation;
  group?: PersonalTimelineGroupContext;
  challenge?: PersonalTimelineChallengeContext;
  activity?: PersonalTimelineActivityPayload;
  exit?: PersonalTimelineExitPayload;
  result?: PersonalTimelineResultPayload;
}

export interface PersonalTimelinePage {
  items: PersonalTimelineItem[];
  nextCursor: string | null;
}

export interface PersonalTimelineQuery {
  limit?: number;
  cursor?: string;
  types?: string;
  challengeId?: string;
}

interface PersonalTimelineCursor {
  version: number;
  memberBinding: string;
  recordedAt: string;
  cursorKey: string;
  eventTypeRank: number;
  typesFilter: string | null;
  challengeId: string | null;
}

interface TimelineRow {
  event_type: PersonalTimelineEventType;
  event_type_rank: number;
  source_id: string;
  cursor_key: string;
  recorded_at: string | Date;
  recorded_at_cursor: string;
  performed_at: string | Date | null;
  display_timezone: string | null;
  entity_accessible: boolean;
  group_id: string | null;
  group_name: string | null;
  group_is_private: boolean | null;
  challenge_id: string | null;
  challenge_title: string | null;
  challenge_type: 'collective' | 'competitive' | 'streak' | null;
  activity_name: string | null;
  activity_value: number | string | null;
  activity_unit: string | null;
  accepted_at: string | Date | null;
  revision_state: RecentActivityRevisionState | null;
  application_count: number | string | null;
  exit_reason: 'withdrawn' | 'removed' | null;
  result_completed: boolean | null;
  result_completed_at: string | Date | null;
  result_final_position: number | string | null;
  result_days_completed: number | string | null;
  result_best_streak: number | string | null;
  result_final_streak: number | string | null;
  result_collective_total: number | string | null;
  result_collective_goal_reached: boolean | null;
  result_goal_value: number | string | null;
  result_goal_unit: string | null;
}

class InvalidPersonalTimelineCursorError extends Error {
  readonly statusCode = 400;
  readonly code = 'invalid_cursor';

  constructor() {
    super('Timeline cursor is invalid for this account or request');
    this.name = 'InvalidPersonalTimelineCursorError';
  }
}

class InvalidPersonalTimelineQueryError extends Error {
  readonly statusCode = 400;
  readonly code = 'invalid_timeline_query';

  constructor(message: string) {
    super(message);
    this.name = 'InvalidPersonalTimelineQueryError';
  }
}

function memberBinding(memberId: string): string {
  return createHash('sha256').update(memberId).digest('base64url');
}

function opaqueEventToken(memberId: string, eventType: PersonalTimelineEventType, sourceId: string): string {
  return createHash('sha256').update(`${memberId}:${eventType}:${sourceId}`).digest('base64url').slice(0, 22);
}

function parseTypesFilter(rawTypes: string | undefined): {
  types: PersonalTimelineEventType[] | null;
  canonical: string | null;
} {
  if (rawTypes === undefined) {
    return { types: null, canonical: null };
  }
  const parts = rawTypes.split(',').map((part) => part.trim());
  if (parts.length === 0 || parts.some((part) => part.length === 0 || !EVENT_TYPE_SET.has(part))) {
    throw new InvalidPersonalTimelineQueryError('Timeline types filter contains an unsupported event type');
  }
  const uniqueSorted = Array.from(new Set(parts)).sort() as PersonalTimelineEventType[];
  return {
    types: uniqueSorted,
    canonical: uniqueSorted.join(','),
  };
}

function decodeCursor(
  cursor: string,
  memberId: string,
  typesFilter: string | null,
  challengeId: string | null,
): PersonalTimelineCursor {
  try {
    if (cursor.length === 0 || cursor.length > MAX_CURSOR_LENGTH) {
      throw new Error('cursor length out of bounds');
    }
    const json = Buffer.from(cursor, 'base64url').toString('utf8');
    if (Buffer.from(json, 'utf8').toString('base64url') !== cursor) {
      throw new Error('non-canonical cursor');
    }
    const value = JSON.parse(json) as Partial<PersonalTimelineCursor> | null;
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      throw new Error('cursor must be an object');
    }
    const cursorTypesFilter = value.typesFilter ?? null;
    const cursorChallengeId = value.challengeId ?? null;
    if (
      value.version !== CURSOR_VERSION
      || value.memberBinding !== memberBinding(memberId)
      || typeof value.recordedAt !== 'string'
      || !CURSOR_TIMESTAMP_RE.test(value.recordedAt)
      || !Number.isFinite(Date.parse(value.recordedAt))
      || typeof value.cursorKey !== 'string'
      || !CURSOR_KEY_RE.test(value.cursorKey)
      || typeof value.eventTypeRank !== 'number'
      || !Number.isInteger(value.eventTypeRank)
      || !VALID_EVENT_RANKS.has(value.eventTypeRank)
      || (cursorTypesFilter !== null && typeof cursorTypesFilter !== 'string')
      || cursorTypesFilter !== typesFilter
      || (cursorChallengeId !== null && (typeof cursorChallengeId !== 'string' || !UUID_RE.test(cursorChallengeId)))
      || cursorChallengeId !== challengeId
    ) {
      throw new Error('invalid cursor payload');
    }
    return {
      version: CURSOR_VERSION,
      memberBinding: value.memberBinding,
      recordedAt: value.recordedAt,
      cursorKey: value.cursorKey,
      eventTypeRank: value.eventTypeRank,
      typesFilter: cursorTypesFilter,
      challengeId: cursorChallengeId,
    };
  } catch {
    throw new InvalidPersonalTimelineCursorError();
  }
}

function encodeCursor(
  row: TimelineRow,
  memberId: string,
  typesFilter: string | null,
  challengeId: string | null,
): string {
  const payload: PersonalTimelineCursor = {
    version: CURSOR_VERSION,
    memberBinding: memberBinding(memberId),
    recordedAt: row.recorded_at_cursor,
    cursorKey: row.cursor_key,
    eventTypeRank: Number(row.event_type_rank),
    typesFilter,
    challengeId,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function toIsoTimestamp(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new Error('Personal Timeline contains an invalid timestamp');
  }
  return date.toISOString();
}

function categoryForEventType(eventType: PersonalTimelineEventType): PersonalTimelineCategory {
  if (eventType === 'group_created' || eventType === 'group_joined' || eventType === 'group_left') {
    return 'group';
  }
  if (eventType === 'activity_logged') return 'activity';
  if (eventType === 'challenge_finalized') return 'result';
  return 'challenge';
}

function labelForEvent(row: TimelineRow): string {
  const accessible = Boolean(row.entity_accessible);
  switch (row.event_type) {
    case 'group_created':
      return accessible ? 'Created Group' : 'Created a Group';
    case 'group_joined':
      return accessible ? 'Joined Group' : 'Joined a Group';
    case 'group_left':
      return accessible ? 'Left Group' : 'Left a Group';
    case 'challenge_created':
      return accessible ? 'Created Challenge' : 'Created a Challenge';
    case 'challenge_joined':
      return accessible ? 'Joined Challenge' : 'Joined a Challenge';
    case 'challenge_exited':
      if (!accessible) return 'Exited a Challenge';
      return row.exit_reason === 'removed' ? 'Removed from Challenge' : 'Withdrew from Challenge';
    case 'activity_logged':
      return accessible ? 'Logged activity' : 'Logged an activity';
    case 'challenge_finalized':
      return 'Challenge result recorded';
  }
}

function mapTimelineRow(row: TimelineRow, memberId: string): PersonalTimelineItem {
  const accessible = Boolean(row.entity_accessible);
  const category = categoryForEventType(row.event_type);
  const recordedAt = toIsoTimestamp(row.recorded_at);

  if (row.event_type === 'activity_logged' && Number(row.application_count) !== 1) {
    throw new Error('Personal Timeline activity lineage has multiple accepted applications');
  }

  // Inaccessible historic private/inactive entities expose only contract-authorized
  // generic metadata: non-reversible opaque timelineEventId, eventType, category,
  // generic label, recordedAt, and disabled navigation. No source UUIDs, private
  // names/titles, timezones, performedAt/acceptedAt, revisionState, exit reasons,
  // activity values, or result outcomes are emitted.
  if (!accessible) {
    return {
      timelineEventId: `redacted:${row.event_type}:${opaqueEventToken(memberId, row.event_type, row.source_id)}`,
      eventType: row.event_type,
      category,
      label: labelForEvent(row),
      recordedAt,
      performedAt: null,
      displayTimezone: null,
      navigation: { kind: 'none', path: null, accessible: false },
    };
  }

  const performedAt = row.performed_at ? toIsoTimestamp(row.performed_at) : null;
  const displayTimezone = row.display_timezone ? assertValidTimezone(row.display_timezone) : null;

  const base: PersonalTimelineItem = {
    timelineEventId: `${row.event_type}:${row.source_id}`,
    eventType: row.event_type,
    category,
    label: labelForEvent(row),
    recordedAt,
    performedAt,
    displayTimezone,
    navigation: { kind: 'none', path: null, accessible: false },
  };

  if (category === 'group' && row.group_id) {
    base.navigation = {
      kind: 'group',
      path: `/v2/groups/${row.group_id}`,
      accessible: true,
    };
    base.group = {
      id: row.group_id,
      name: row.group_name,
      isPrivate: Boolean(row.group_is_private),
      accessible: true,
    };
    return base;
  }

  if (row.challenge_id) {
    base.navigation = {
      kind: 'challenge',
      path: `/v2/challenges/${row.challenge_id}`,
      accessible: true,
    };
    base.challenge = {
      id: row.challenge_id,
      title: row.challenge_title,
      challengeType: row.challenge_type,
      accessible: true,
    };
  }

  if (row.event_type === 'activity_logged') {
    base.activity = {
      activityId: row.source_id,
      activityName: row.activity_name,
      value: row.activity_value !== null ? Number(row.activity_value) : null,
      unit: row.activity_unit,
      acceptedAt: toIsoTimestamp(row.accepted_at!),
      revisionState: row.revision_state!,
    };
  } else if (row.event_type === 'challenge_exited') {
    base.exit = {
      participationId: row.source_id,
      exitReason: row.exit_reason!,
    };
  } else if (row.event_type === 'challenge_finalized') {
    base.result = {
      participationId: row.source_id,
      completed: Boolean(row.result_completed),
      completedAt: row.result_completed_at ? toIsoTimestamp(row.result_completed_at) : null,
      finalPosition: row.result_final_position !== null ? Number(row.result_final_position) : null,
      daysCompleted: row.result_days_completed !== null ? Number(row.result_days_completed) : null,
      bestStreak: row.result_best_streak !== null ? Number(row.result_best_streak) : null,
      finalStreak: row.result_final_streak !== null ? Number(row.result_final_streak) : null,
      collectiveTotal: row.result_collective_total !== null ? Number(row.result_collective_total) : null,
      collectiveGoalReached: row.result_collective_goal_reached,
      goalValue: row.result_goal_value !== null ? Number(row.result_goal_value) : null,
      goalUnit: row.result_goal_unit,
    };
  }

  return base;
}

/**
 * Reads the authenticated member's unified private personal timeline across
 * Group establishment/membership, Challenge establishment/participation,
 * accepted Activity (with correction/reversal lineage), and immutable
 * Challenge finalizations.
 *
 * Read-only over existing authoritative PostgreSQL tables. Never reads or
 * writes public Feed tables (`group_feed_outbox`, `group_feed_projection`,
 * `challenge_feed_shares`).
 *
 * Pagination uses read-committed keyset traversal over
 * `(recorded_at DESC, cursor_key DESC, event_type_rank DESC)`, where
 * `cursor_key` is `sha256(member_id || ':' || source_id)` (non-reversible,
 * preventing raw source UUID leakage in opaque base64url cursors while
 * preserving deterministic total ordering). While source rows and filters are
 * unchanged, traversal has no duplicates or omissions. Concurrent mutations
 * (rejoins, Activity corrections/reversals, or finalizations) between requests
 * are not snapshot-isolated across pages.
 */
export async function listMemberTimeline(
  db: Db,
  memberId: string,
  query: PersonalTimelineQuery = {},
): Promise<PersonalTimelinePage> {
  const limit = query.limit ?? DEFAULT_PAGE_SIZE;
  const challengeId = query.challengeId ?? null;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
    throw new InvalidPersonalTimelineQueryError('Timeline page size must be an integer between 1 and 50');
  }
  if (challengeId !== null && !UUID_RE.test(challengeId)) {
    throw new InvalidPersonalTimelineQueryError('Timeline Challenge filter must be a valid UUID');
  }
  const { types, canonical: canonicalTypesFilter } = parseTypesFilter(query.types);
  const cursor = query.cursor
    ? decodeCursor(query.cursor, memberId, canonicalTypesFilter, challengeId)
    : null;

  const result = await db.query<TimelineRow>(
    `WITH RECURSIVE active_group_memberships AS (
       SELECT group_id
         FROM group_memberships
        WHERE member_id = $1
          AND status IN ('active', 'joined')
     ),
     current_events AS (
       SELECT event_id, member_id, activity_kind, canonical_key, activity_variant,
              knowledge_id, knowledge_version, occurred_at, occurred_tz,
              recorded_at, value, unit, supersedes_event_id, correction_kind
         FROM member_activity_events
        WHERE member_id = $1 AND status = 'committed'
     ),
     lineage AS (
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
     ),
     applications AS (
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
     ),
     unified_events AS (
       -- 1. group_created
       SELECT 'group_created'::text AS event_type,
              ${EVENT_TYPE_RANK.group_created}::integer AS event_type_rank,
              g.group_id AS source_id,
              g.created_at AS recorded_at,
              NULL::timestamptz AS performed_at,
              NULL::text AS display_timezone,
              (g.status = 'active' AND (NOT g.is_private OR agm.group_id IS NOT NULL)) AS entity_accessible,
              g.group_id AS group_id,
              g.name AS group_name,
              g.is_private AS group_is_private,
              NULL::uuid AS challenge_id,
              NULL::text AS challenge_title,
              NULL::text AS challenge_type,
              NULL::text AS activity_name,
              NULL::double precision AS activity_value,
              NULL::text AS activity_unit,
              NULL::timestamptz AS accepted_at,
              NULL::text AS revision_state,
              NULL::bigint AS application_count,
              NULL::text AS exit_reason,
              NULL::boolean AS result_completed,
              NULL::timestamptz AS result_completed_at,
              NULL::integer AS result_final_position,
              NULL::integer AS result_days_completed,
              NULL::integer AS result_best_streak,
              NULL::integer AS result_final_streak,
              NULL::double precision AS result_collective_total,
              NULL::boolean AS result_collective_goal_reached,
              NULL::double precision AS result_goal_value,
              NULL::text AS result_goal_unit
         FROM groups g
         LEFT JOIN active_group_memberships agm ON agm.group_id = g.group_id
        WHERE g.original_creator_member_id = $1

       UNION ALL

       -- 2. group_joined (suppress founding owner duplicate and pending/rejected requests)
       SELECT 'group_joined'::text AS event_type,
              ${EVENT_TYPE_RANK.group_joined}::integer AS event_type_rank,
              gm.group_id AS source_id,
              gm.joined_at AS recorded_at,
              NULL::timestamptz AS performed_at,
              NULL::text AS display_timezone,
              (g.status = 'active' AND (NOT g.is_private OR agm.group_id IS NOT NULL)) AS entity_accessible,
              g.group_id AS group_id,
              g.name AS group_name,
              g.is_private AS group_is_private,
              NULL::uuid AS challenge_id,
              NULL::text AS challenge_title,
              NULL::text AS challenge_type,
              NULL::text AS activity_name,
              NULL::double precision AS activity_value,
              NULL::text AS activity_unit,
              NULL::timestamptz AS accepted_at,
              NULL::text AS revision_state,
              NULL::bigint AS application_count,
              NULL::text AS exit_reason,
              NULL::boolean AS result_completed,
              NULL::timestamptz AS result_completed_at,
              NULL::integer AS result_final_position,
              NULL::integer AS result_days_completed,
              NULL::integer AS result_best_streak,
              NULL::integer AS result_final_streak,
              NULL::double precision AS result_collective_total,
              NULL::boolean AS result_collective_goal_reached,
              NULL::double precision AS result_goal_value,
              NULL::text AS result_goal_unit
         FROM group_memberships gm
         JOIN groups g ON g.group_id = gm.group_id
         LEFT JOIN active_group_memberships agm ON agm.group_id = g.group_id
        WHERE gm.member_id = $1
          AND gm.status IN ('active', 'joined', 'left')
          AND NOT COALESCE(
            g.original_creator_member_id = $1
            AND gm.role = 'owner'
            AND gm.joined_at = g.created_at,
            FALSE
          )

       UNION ALL

       -- 3. group_left
       SELECT 'group_left'::text AS event_type,
              ${EVENT_TYPE_RANK.group_left}::integer AS event_type_rank,
              gm.group_id AS source_id,
              COALESCE(gm.left_at, gm.updated_at) AS recorded_at,
              NULL::timestamptz AS performed_at,
              NULL::text AS display_timezone,
              (g.status = 'active' AND (NOT g.is_private OR agm.group_id IS NOT NULL)) AS entity_accessible,
              g.group_id AS group_id,
              g.name AS group_name,
              g.is_private AS group_is_private,
              NULL::uuid AS challenge_id,
              NULL::text AS challenge_title,
              NULL::text AS challenge_type,
              NULL::text AS activity_name,
              NULL::double precision AS activity_value,
              NULL::text AS activity_unit,
              NULL::timestamptz AS accepted_at,
              NULL::text AS revision_state,
              NULL::bigint AS application_count,
              NULL::text AS exit_reason,
              NULL::boolean AS result_completed,
              NULL::timestamptz AS result_completed_at,
              NULL::integer AS result_final_position,
              NULL::integer AS result_days_completed,
              NULL::integer AS result_best_streak,
              NULL::integer AS result_final_streak,
              NULL::double precision AS result_collective_total,
              NULL::boolean AS result_collective_goal_reached,
              NULL::double precision AS result_goal_value,
              NULL::text AS result_goal_unit
         FROM group_memberships gm
         JOIN groups g ON g.group_id = gm.group_id
         LEFT JOIN active_group_memberships agm ON agm.group_id = g.group_id
        WHERE gm.member_id = $1
          AND gm.status = 'left'

       UNION ALL

       -- 4. challenge_created
       SELECT 'challenge_created'::text AS event_type,
              ${EVENT_TYPE_RANK.challenge_created}::integer AS event_type_rank,
              c.challenge_id AS source_id,
              c.created_at AS recorded_at,
              NULL::timestamptz AS performed_at,
              c.timezone AS display_timezone,
              (g.status = 'active' AND (NOT g.is_private OR agm.group_id IS NOT NULL)) AS entity_accessible,
              NULL::uuid AS group_id,
              NULL::text AS group_name,
              NULL::boolean AS group_is_private,
              c.challenge_id AS challenge_id,
              c.title AS challenge_title,
              c.challenge_type AS challenge_type,
              NULL::text AS activity_name,
              NULL::double precision AS activity_value,
              NULL::text AS activity_unit,
              NULL::timestamptz AS accepted_at,
              NULL::text AS revision_state,
              NULL::bigint AS application_count,
              NULL::text AS exit_reason,
              NULL::boolean AS result_completed,
              NULL::timestamptz AS result_completed_at,
              NULL::integer AS result_final_position,
              NULL::integer AS result_days_completed,
              NULL::integer AS result_best_streak,
              NULL::integer AS result_final_streak,
              NULL::double precision AS result_collective_total,
              NULL::boolean AS result_collective_goal_reached,
              NULL::double precision AS result_goal_value,
              NULL::text AS result_goal_unit
         FROM challenges c
         JOIN groups g ON g.group_id = c.group_id
         LEFT JOIN active_group_memberships agm ON agm.group_id = g.group_id
        WHERE c.created_by_member_id = $1

       UNION ALL

       -- 5. challenge_joined
       SELECT 'challenge_joined'::text AS event_type,
              ${EVENT_TYPE_RANK.challenge_joined}::integer AS event_type_rank,
              cp.participation_id AS source_id,
              cp.joined_at AS recorded_at,
              NULL::timestamptz AS performed_at,
              c.timezone AS display_timezone,
              (g.status = 'active' AND (NOT g.is_private OR agm.group_id IS NOT NULL)) AS entity_accessible,
              NULL::uuid AS group_id,
              NULL::text AS group_name,
              NULL::boolean AS group_is_private,
              c.challenge_id AS challenge_id,
              c.title AS challenge_title,
              c.challenge_type AS challenge_type,
              NULL::text AS activity_name,
              NULL::double precision AS activity_value,
              NULL::text AS activity_unit,
              NULL::timestamptz AS accepted_at,
              NULL::text AS revision_state,
              NULL::bigint AS application_count,
              NULL::text AS exit_reason,
              NULL::boolean AS result_completed,
              NULL::timestamptz AS result_completed_at,
              NULL::integer AS result_final_position,
              NULL::integer AS result_days_completed,
              NULL::integer AS result_best_streak,
              NULL::integer AS result_final_streak,
              NULL::double precision AS result_collective_total,
              NULL::boolean AS result_collective_goal_reached,
              NULL::double precision AS result_goal_value,
              NULL::text AS result_goal_unit
         FROM challenge_participations cp
         JOIN challenges c ON c.challenge_id = cp.challenge_id
         JOIN groups g ON g.group_id = c.group_id
         LEFT JOIN active_group_memberships agm ON agm.group_id = g.group_id
        WHERE cp.member_id = $1

       UNION ALL

       -- 6. challenge_exited
       SELECT 'challenge_exited'::text AS event_type,
              ${EVENT_TYPE_RANK.challenge_exited}::integer AS event_type_rank,
              cp.participation_id AS source_id,
              cp.exited_at AS recorded_at,
              NULL::timestamptz AS performed_at,
              c.timezone AS display_timezone,
              (g.status = 'active' AND (NOT g.is_private OR agm.group_id IS NOT NULL)) AS entity_accessible,
              NULL::uuid AS group_id,
              NULL::text AS group_name,
              NULL::boolean AS group_is_private,
              c.challenge_id AS challenge_id,
              c.title AS challenge_title,
              c.challenge_type AS challenge_type,
              NULL::text AS activity_name,
              NULL::double precision AS activity_value,
              NULL::text AS activity_unit,
              NULL::timestamptz AS accepted_at,
              NULL::text AS revision_state,
              NULL::bigint AS application_count,
              cp.exit_reason AS exit_reason,
              NULL::boolean AS result_completed,
              NULL::timestamptz AS result_completed_at,
              NULL::integer AS result_final_position,
              NULL::integer AS result_days_completed,
              NULL::integer AS result_best_streak,
              NULL::integer AS result_final_streak,
              NULL::double precision AS result_collective_total,
              NULL::boolean AS result_collective_goal_reached,
              NULL::double precision AS result_goal_value,
              NULL::text AS result_goal_unit
         FROM challenge_participations cp
         JOIN challenges c ON c.challenge_id = cp.challenge_id
         JOIN groups g ON g.group_id = c.group_id
         LEFT JOIN active_group_memberships agm ON agm.group_id = g.group_id
        WHERE cp.member_id = $1
          AND cp.status IN ('withdrawn', 'removed')
          AND cp.exited_at IS NOT NULL

       UNION ALL

       -- 7. activity_logged
       SELECT 'activity_logged'::text AS event_type,
              ${EVENT_TYPE_RANK.activity_logged}::integer AS event_type_rank,
              accepted.event_id AS source_id,
              effective.recorded_at AS recorded_at,
              display.occurred_at AS performed_at,
              COALESCE(display.occurred_tz, config.snapshot->>'timezone', 'UTC') AS display_timezone,
              (g.status = 'active' AND (NOT g.is_private OR agm.group_id IS NOT NULL)) AS entity_accessible,
              NULL::uuid AS group_id,
              NULL::text AS group_name,
              NULL::boolean AS group_is_private,
              challenge.challenge_id AS challenge_id,
              challenge.title AS challenge_title,
              challenge.challenge_type AS challenge_type,
              COALESCE(activity_version.name, activity.name, display.canonical_key) AS activity_name,
              display.value AS activity_value,
              display.unit AS activity_unit,
              application.accepted_at AS accepted_at,
              CASE effective.correction_kind
                WHEN 'correction' THEN 'updated'
                WHEN 'reversal' THEN 'reversed'
                ELSE 'current'
              END AS revision_state,
              application.application_count AS application_count,
              NULL::text AS exit_reason,
              NULL::boolean AS result_completed,
              NULL::timestamptz AS result_completed_at,
              NULL::integer AS result_final_position,
              NULL::integer AS result_days_completed,
              NULL::integer AS result_best_streak,
              NULL::integer AS result_final_streak,
              NULL::double precision AS result_collective_total,
              NULL::boolean AS result_collective_goal_reached,
              NULL::double precision AS result_goal_value,
              NULL::text AS result_goal_unit
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
         JOIN groups g ON g.group_id = challenge.group_id
         LEFT JOIN active_group_memberships agm ON agm.group_id = g.group_id
         JOIN challenge_config_versions config
           ON config.challenge_id = application.challenge_id
          AND config.version = application.config_version
         LEFT JOIN knowledge_item_versions activity_version
           ON activity_version.item_id = display.knowledge_id
          AND activity_version.version = display.knowledge_version
         LEFT JOIN knowledge_items activity ON activity.knowledge_id = display.knowledge_id

       UNION ALL

       -- 8. challenge_finalized
       SELECT 'challenge_finalized'::text AS event_type,
              ${EVENT_TYPE_RANK.challenge_finalized}::integer AS event_type_rank,
              cpf.participation_id AS source_id,
              cpf.finalized_at AS recorded_at,
              NULL::timestamptz AS performed_at,
              cf.timezone AS display_timezone,
              (g.status = 'active' AND (NOT g.is_private OR agm.group_id IS NOT NULL)) AS entity_accessible,
              NULL::uuid AS group_id,
              NULL::text AS group_name,
              NULL::boolean AS group_is_private,
              c.challenge_id AS challenge_id,
              c.title AS challenge_title,
              cf.challenge_type AS challenge_type,
              NULL::text AS activity_name,
              NULL::double precision AS activity_value,
              NULL::text AS activity_unit,
              NULL::timestamptz AS accepted_at,
              NULL::text AS revision_state,
              NULL::bigint AS application_count,
              NULL::text AS exit_reason,
              cpf.completed AS result_completed,
              cpf.completed_at AS result_completed_at,
              cpf.final_position AS result_final_position,
              cpf.days_completed AS result_days_completed,
              cpf.best_streak AS result_best_streak,
              cpf.final_streak AS result_final_streak,
              NULLIF(cf.result->>'collective_total', '')::double precision AS result_collective_total,
              CASE
                WHEN cf.result ? 'collective_goal_reached'
                  THEN (cf.result->>'collective_goal_reached')::boolean
                ELSE NULL
              END AS result_collective_goal_reached,
              c.goal_value AS result_goal_value,
              c.goal_unit AS result_goal_unit
         FROM challenge_participation_finals cpf
         JOIN challenge_finalizations cf ON cf.challenge_id = cpf.challenge_id
         JOIN challenges c ON c.challenge_id = cpf.challenge_id
         JOIN groups g ON g.group_id = c.group_id
         LEFT JOIN active_group_memberships agm ON agm.group_id = g.group_id
        WHERE cpf.member_id = $1
     )
     SELECT event_type,
            event_type_rank,
            source_id::text AS source_id,
            cursor_key,
            recorded_at,
            to_char(recorded_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS recorded_at_cursor,
            performed_at,
            display_timezone,
            entity_accessible,
            group_id::text AS group_id,
            group_name,
            group_is_private,
            challenge_id::text AS challenge_id,
            challenge_title,
            challenge_type,
            activity_name,
            activity_value,
            activity_unit,
            accepted_at,
            revision_state,
            application_count,
            exit_reason,
            result_completed,
            result_completed_at,
            result_final_position,
            result_days_completed,
            result_best_streak,
            result_final_streak,
            result_collective_total,
            result_collective_goal_reached,
            result_goal_value,
            result_goal_unit
       FROM (
         SELECT *,
                encode(sha256(convert_to($1::text || ':' || source_id::text, 'UTF8')), 'hex') AS cursor_key
           FROM unified_events
       ) keyed_events
      WHERE ($2::timestamptz IS NULL OR
             (recorded_at, cursor_key, event_type_rank) <
             ($2::timestamptz, $3::text, $4::integer))
        AND ($5::uuid IS NULL OR challenge_id = $5::uuid)
        AND ($6::text[] IS NULL OR event_type = ANY($6::text[]))
      ORDER BY recorded_at DESC, cursor_key DESC, event_type_rank DESC
      LIMIT $7`,
    [
      memberId,
      cursor?.recordedAt ?? null,
      cursor?.cursorKey ?? null,
      cursor?.eventTypeRank ?? null,
      challengeId,
      types,
      limit + 1,
    ],
  );

  const hasMore = result.rows.length > limit;
  const rows = hasMore ? result.rows.slice(0, limit) : result.rows;
  const items = rows.map((row) => mapTimelineRow(row, memberId));

  return {
    items,
    nextCursor: hasMore
      ? encodeCursor(rows[rows.length - 1], memberId, canonicalTypesFilter, challengeId)
      : null,
  };
}

export function registerMemberTimelineRoutes(app: FastifyInstance, db: Db): void {
  app.get<{ Querystring: PersonalTimelineQuery }>(
    `${API_PREFIX}/me/timeline`,
    {
      schema: {
        querystring: {
          type: 'object',
          additionalProperties: false,
          properties: {
            limit: { type: 'integer', minimum: 1, maximum: MAX_PAGE_SIZE },
            cursor: { type: 'string', maxLength: MAX_CURSOR_LENGTH },
            types: { type: 'string', maxLength: 512 },
            challengeId: { type: 'string', pattern: UUID_RE.source },
          },
        },
      },
    },
    async (request) => {
      const { memberId } = authenticatedMember(request);
      return listMemberTimeline(db, memberId, request.query);
    },
  );
}
