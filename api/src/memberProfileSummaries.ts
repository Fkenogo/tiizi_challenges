/**
 * MC-2B-2 — member-owned Group and Challenge participation summaries.
 *
 * This module is a Profile *read* composition over existing authority. It
 * creates no Group, membership or participation truth:
 *
 * - Groups come from the canonical membership read (`listMembershipsForMember`,
 *   the same read behind GET /api/memberships/me). Only governed current
 *   memberships (`joined` / `active`) qualify; pending, rejected and left are
 *   excluded. Role and Group presentation fields stay untouched.
 * - Challenges come from actual `challenge_participations` episodes for the
 *   caller, joined to `challenges` only for title and lifecycle context.
 *   Visible/eligible-but-unjoined Challenges are never included.
 *
 * Classification is derived per episode and is never stored:
 *   active  = participation.status = 'active' AND challenges.finalized_at IS NULL
 *   history = participation.status IN ('withdrawn','removed')
 *             OR (participation.status = 'active' AND challenges.finalized_at IS NOT NULL)
 *
 * The schema permits exactly three participation statuses
 * (`active`, `withdrawn`, `removed`). Any other value is treated as an
 * internal inconsistency rather than silently classified as history.
 *
 * Pagination is keyset-based and deterministic:
 *   challenges: (joined_at DESC, participation_id DESC)
 *   groups:     (joined_at DESC, group_id DESC)
 * Counts are computed over the complete caller-scoped qualifying set, never
 * over the returned page.
 *
 * Cursor security: a cursor is a canonical base64url JSON continuation token,
 * NOT an authenticated or tamper-proof credential. The payload carries the
 * member scope, summary type, page size and ordering version; every value is
 * validated and the member/type/limit scopes are enforced against the current
 * request. The SQL predicate that selects rows is always
 * `WHERE member_id = <authenticated member>`; a modified cursor can at most
 * navigate within that member's own already-authorized rows. It cannot widen
 * authorization or expose another member's data. No cryptographic signing is
 * used because no such guarantee is claimed.
 *
 * Consistency between pages is deliberately documented as read-committed, not
 * snapshot-isolated across requests: `joined_at` and the episode/group
 * identity are immutable, so the continuation key of an existing row does not
 * move. However, rows inserted or removed between pages, and Challenge
 * finalization between pages (which can move an episode from `active` to
 * `history`), can change counts and bucket presentation. Callers should treat
 * each page response as a fresh governed read.
 */

import { Buffer } from 'node:buffer';
import { AuthError, type RequestMember } from './auth.js';
import type { Db } from './db.js';
import { listMembershipsForMember } from './memberships.js';

export const PROFILE_SUMMARY_PAGE_DEFAULT = 20;
export const PROFILE_SUMMARY_PAGE_MAX = 50;

export type ProfileSummaryType = 'groups' | 'challenges';
export type ChallengeSummaryBucket = 'active' | 'history';
export type ParticipationStatus = 'active' | 'withdrawn' | 'removed';

const ORDERINGS = {
  groups: 'joined_at_desc_group_id_desc',
  challenges: 'joined_at_desc_participation_id_desc',
} as const;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BASE64URL_RE = /^[A-Za-z0-9_-]+$/;
const CURSOR_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const MAX_CURSOR_LENGTH = 2048;
const PARTICIPATION_STATUSES: readonly string[] = ['active', 'withdrawn', 'removed'];

export class MemberProfileSummaryError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.name = 'MemberProfileSummaryError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export interface MemberGroupSummaryItem {
  groupId: string;
  name: string;
  role: string;
  status: string;
  joinedAt: string;
}

export interface MemberChallengeSummaryItem {
  challengeId: string;
  participationId: string;
  title: string;
  status: ParticipationStatus;
  bucket: ChallengeSummaryBucket;
  joinedAt: string;
  exitedAt: string | null;
}

export interface MemberGroupSummaryPage {
  count: number;
  items: MemberGroupSummaryItem[];
  nextCursor: string | null;
}

export interface MemberChallengeSummaryPage {
  activeCount: number;
  historyCount: number;
  totalCount: number;
  items: MemberChallengeSummaryItem[];
  nextCursor: string | null;
}

export interface MemberProfileSummaries {
  memberId: string;
  groups: MemberGroupSummaryPage;
  challenges: MemberChallengeSummaryPage;
}

export interface ProfileSummaryPageOptions {
  limit?: unknown;
  cursor?: unknown;
}

export interface MemberProfileSummaryOptions {
  groups?: ProfileSummaryPageOptions;
  challenges?: ProfileSummaryPageOptions;
}

interface SummaryCursorPayload {
  v: 1;
  type: ProfileSummaryType;
  memberId: string;
  limit: number;
  ordering: string;
  joinedAt: string;
  id: string;
}

interface CursorScope {
  type: ProfileSummaryType;
  memberId: string;
  limit: number;
}

interface ChallengeSummaryRow {
  participation_id: string | null;
  challenge_id: string | null;
  status: string | null;
  challenge_title: string | null;
  joined_at: string | Date | null;
  joined_at_cursor: string | null;
  exited_at: string | Date | null;
  finalized_at: string | Date | null;
  bucket: string | null;
  active_count: number | string;
  history_count: number | string;
  total_count: number | string;
}

function invalidSummaryQuery(message: string): never {
  throw new MemberProfileSummaryError(400, 'invalid_summary_query', message);
}

function invalidCursor(): never {
  throw new MemberProfileSummaryError(400, 'invalid_cursor', 'Profile summary cursor is invalid');
}

function summaryUnavailable(): never {
  throw new MemberProfileSummaryError(
    500,
    'summary_unavailable',
    'Profile summary authority returned inconsistent data',
  );
}

function requireSelf(member: RequestMember | null): RequestMember {
  if (!member?.memberId) {
    throw new AuthError(401, 'missing_token', 'Authentication is required');
  }
  return member;
}

export function parseSummaryLimit(raw: unknown): number {
  if (raw === undefined) return PROFILE_SUMMARY_PAGE_DEFAULT;
  const value = typeof raw === 'number'
    ? raw
    : typeof raw === 'string' && /^\d+$/.test(raw)
      ? Number(raw)
      : Number.NaN;
  if (!Number.isInteger(value) || value < 1 || value > PROFILE_SUMMARY_PAGE_MAX) {
    throw new MemberProfileSummaryError(
      400,
      'invalid_limit',
      `limit must be an integer from 1 to ${PROFILE_SUMMARY_PAGE_MAX}`,
    );
  }
  return value;
}

function canonicalBase64Url(value: string): Buffer {
  if (!BASE64URL_RE.test(value)) invalidCursor();
  const decoded = Buffer.from(value, 'base64url');
  if (decoded.length === 0 || decoded.toString('base64url') !== value) invalidCursor();
  return decoded;
}

function encodeCursor(payload: SummaryCursorPayload): string {
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

function decodeCursor(raw: unknown, scope: CursorScope): SummaryCursorPayload | null {
  if (raw === undefined || raw === '') return null;
  if (typeof raw !== 'string' || raw.length > MAX_CURSOR_LENGTH) invalidCursor();

  let parsed: unknown;
  try {
    parsed = JSON.parse(canonicalBase64Url(raw).toString('utf8'));
  } catch {
    return invalidCursor();
  }
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) invalidCursor();

  const payload = parsed as Partial<SummaryCursorPayload>;
  if (payload.v !== 1 || payload.type !== scope.type || payload.memberId !== scope.memberId
      || payload.limit !== scope.limit || payload.ordering !== ORDERINGS[scope.type]
      || typeof payload.id !== 'string' || !UUID_RE.test(payload.id)) {
    invalidCursor();
  }
  if (!isCanonicalCursorTimestamp(payload.joinedAt)) invalidCursor();
  return payload as SummaryCursorPayload;
}

/**
 * Cursors carry the authority timestamp at the database's full microsecond
 * precision. Truncating to milliseconds would let a page boundary inside one
 * millisecond skip later episodes. Group timestamps are millisecond values
 * normalized to the same canonical shape.
 */
function isCanonicalCursorTimestamp(value: unknown): value is string {
  if (typeof value !== 'string' || !CURSOR_TIMESTAMP_RE.test(value)) return false;
  const millisecondIso = `${value.slice(0, 23)}Z`;
  return new Date(millisecondIso).toISOString() === millisecondIso;
}

function toCursorTimestamp(value: string | Date): string {
  return `${toIso(value).slice(0, 23)}000Z`;
}

function classifyOrFail(
  status: unknown,
  challengeFinalized: boolean,
): ChallengeSummaryBucket {
  if (typeof status !== 'string' || !PARTICIPATION_STATUSES.includes(status)) {
    summaryUnavailable();
  }
  return classifyChallengeParticipation(status as ParticipationStatus, challengeFinalized);
}

/**
 * Exhaustive, derived classification. Unsupported values throw rather than
 * falling through to `history`; the database CHECK currently permits only the
 * three governed statuses.
 */
export function classifyChallengeParticipation(
  status: ParticipationStatus,
  challengeFinalized: boolean,
): ChallengeSummaryBucket {
  switch (status) {
    case 'active':
      return challengeFinalized ? 'history' : 'active';
    case 'withdrawn':
    case 'removed':
      return 'history';
    default:
      return summaryUnavailable();
  }
}

function toIso(value: string | Date): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

function nextGroupCursor(
  joinedAt: string,
  groupId: string,
  scope: CursorScope,
): string {
  return encodeCursor({
    v: 1,
    type: scope.type,
    memberId: scope.memberId,
    limit: scope.limit,
    ordering: ORDERINGS[scope.type],
    joinedAt: toCursorTimestamp(joinedAt),
    id: groupId,
  });
}

function nextChallengeCursor(
  joinedAt: string,
  participationId: string,
  scope: CursorScope,
): string {
  return encodeCursor({
    v: 1,
    type: scope.type,
    memberId: scope.memberId,
    limit: scope.limit,
    ordering: ORDERINGS[scope.type],
    joinedAt,
    id: participationId,
  });
}

function isAfterGroupCursor(
  item: { joinedAt: string; groupId: string },
  cursor: SummaryCursorPayload,
): boolean {
  const itemMs = Date.parse(item.joinedAt);
  const cursorMs = Date.parse(cursor.joinedAt);
  if (itemMs !== cursorMs) return itemMs < cursorMs;
  return item.groupId < cursor.id;
}

function compareGroups(
  a: { joinedAt: string; groupId: string },
  b: { joinedAt: string; groupId: string },
): number {
  const diff = Date.parse(b.joinedAt) - Date.parse(a.joinedAt);
  if (diff !== 0) return diff;
  if (a.groupId === b.groupId) return 0;
  return a.groupId < b.groupId ? 1 : -1;
}

export async function listMemberGroupSummaries(
  db: Db,
  member: RequestMember | null,
  options: ProfileSummaryPageOptions = {},
): Promise<MemberGroupSummaryPage> {
  const self = requireSelf(member);
  const limit = parseSummaryLimit(options.limit);
  const scope: CursorScope = { type: 'groups', memberId: self.memberId, limit };
  const cursor = decodeCursor(options.cursor, scope);

  // Reuse the canonical membership read rather than duplicating its predicate.
  // Role, Group presentation and private-Group visibility stay authoritative.
  const memberships = await listMembershipsForMember(db, self.memberId);
  const all = memberships
    .map((membership) => ({
      groupId: membership.groupId,
      name: membership.group.name,
      role: membership.role,
      status: membership.status,
      joinedAt: membership.joinedAt,
    }))
    .sort(compareGroups);

  const remaining = cursor ? all.filter((item) => isAfterGroupCursor(item, cursor)) : all;
  const items = remaining.slice(0, limit);
  const nextCursor = remaining.length > items.length && items.length > 0
    ? nextGroupCursor(items[items.length - 1].joinedAt, items[items.length - 1].groupId, scope)
    : null;

  return { count: all.length, items, nextCursor };
}

export async function listMemberChallengeSummaries(
  db: Db,
  member: RequestMember | null,
  options: ProfileSummaryPageOptions = {},
): Promise<MemberChallengeSummaryPage> {
  const self = requireSelf(member);
  const limit = parseSummaryLimit(options.limit);
  const scope: CursorScope = { type: 'challenges', memberId: self.memberId, limit };
  const cursor = decodeCursor(options.cursor, scope);

  const result = await db.query<ChallengeSummaryRow>(
    `WITH qualifying AS (
       SELECT p.participation_id, p.challenge_id, p.status, p.joined_at, p.exited_at,
              to_char(p.joined_at AT TIME ZONE 'UTC',
                      'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS joined_at_cursor,
              c.title AS challenge_title, c.finalized_at,
              CASE
                WHEN p.status = 'active' AND c.finalized_at IS NULL THEN 'active'
                WHEN p.status = 'active' AND c.finalized_at IS NOT NULL THEN 'history'
                WHEN p.status IN ('withdrawn', 'removed') THEN 'history'
                ELSE NULL
              END AS bucket
       FROM challenge_participations p
       JOIN challenges c ON c.challenge_id = p.challenge_id
       WHERE p.member_id = $1
     ),
     counts AS (
       SELECT count(*) FILTER (WHERE bucket = 'active')::int AS active_count,
              count(*) FILTER (WHERE bucket = 'history')::int AS history_count,
              count(*)::int AS total_count
       FROM qualifying
     ),
     page AS (
       SELECT q.*
       FROM qualifying q
       WHERE ($2::timestamptz IS NULL
              OR (q.joined_at, q.participation_id) < ($2::timestamptz, $3::uuid))
       ORDER BY q.joined_at DESC, q.participation_id DESC
       LIMIT $4
     )
     SELECT counts.active_count, counts.history_count, counts.total_count, page.*
     FROM counts
     LEFT JOIN page ON TRUE
     ORDER BY page.joined_at DESC NULLS LAST, page.participation_id DESC NULLS LAST`,
    [self.memberId, cursor?.joinedAt ?? null, cursor?.id ?? null, limit + 1],
  );

  const counts = result.rows[0];
  const activeCount = Number(counts?.active_count ?? 0);
  const historyCount = Number(counts?.history_count ?? 0);
  const totalCount = Number(counts?.total_count ?? 0);
  if (![activeCount, historyCount, totalCount].every(Number.isInteger)
      || activeCount < 0 || historyCount < 0 || totalCount < 0
      || activeCount + historyCount !== totalCount) {
    return summaryUnavailable();
  }

  const rows = result.rows.filter((row) => row.participation_id !== null);
  const prepared = rows.map((row): { item: MemberChallengeSummaryItem; cursorJoinedAt: string } => {
    const finalized = row.finalized_at != null;
    const bucket = classifyOrFail(row.status, finalized);
    if (row.bucket !== bucket) return summaryUnavailable();
    if (row.challenge_id === null || row.challenge_title === null
        || row.joined_at === null || row.participation_id === null) {
      return summaryUnavailable();
    }
    if (!isCanonicalCursorTimestamp(row.joined_at_cursor)) return summaryUnavailable();
    return {
      cursorJoinedAt: row.joined_at_cursor,
      item: {
        challengeId: String(row.challenge_id),
        participationId: String(row.participation_id),
        title: String(row.challenge_title),
        status: row.status as ParticipationStatus,
        bucket,
        joinedAt: toIso(row.joined_at),
        exitedAt: row.exited_at == null ? null : toIso(row.exited_at),
      },
    };
  });

  const items = prepared.slice(0, limit).map((entry) => entry.item);
  const last = prepared[items.length - 1];
  const nextCursor = prepared.length > limit && last
    ? nextChallengeCursor(last.cursorJoinedAt, last.item.participationId, scope)
    : null;

  return { activeCount, historyCount, totalCount, items, nextCursor };
}

export async function getMemberProfileSummaries(
  db: Db,
  member: RequestMember | null,
  options: MemberProfileSummaryOptions = {},
): Promise<MemberProfileSummaries> {
  const self = requireSelf(member);
  const groups = await listMemberGroupSummaries(db, self, options.groups ?? {});
  const challenges = await listMemberChallengeSummaries(db, self, options.challenges ?? {});
  return { memberId: self.memberId, groups, challenges };
}
