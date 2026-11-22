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
 *   exact routine time, points or metadata leaves the ledger. The canonical
 *   Activity event ID is disclosed ONLY to the Share's owner (withdrawal
 *   reference); other viewers receive only the Feed item identity.
 * - Private by default: nothing here runs automatically from logging, and
 *   the canonical Activity write path has no publication dependency
 *   (CF-01 §8: a recorder separate from the Group Feed's
 *   `recordChallengePublication`).
 * - The Feed never expands visibility (CF-01 §3.5): every read re-checks
 *   current Group membership and Challenge visibility for every viewer,
 *   and denials are indistinguishable from not-found.
 * - Withdrawal hides the Share; it never deletes, rewrites or changes the
 *   canonical Activity, its evidence, score, progress or results. A
 *   withdrawal can never be silently undone: publication is keyed to the
 *   member's explicit choice (last_publish_key), so only a FRESH confirm
 *   re-publishes a withdrawn Share, and retries never reorder the Feed.
 * - Retention (CF-01 §5): the Feed is readable for the Challenge lifetime
 *   plus 90 days after it ends; expired Feeds return no items.
 * - Correction/reversal safety, unified with the owner's Personal Activity
 *   History presentation: the Share binds the accepted application event
 *   (the same stable identity History exposes), and every read resolves the
 *   CURRENT lineage head. A corrected Activity displays its current
 *   effective value (what the member previewed and may re-Share at any
 *   time); a REVERSED Activity is never publishable and disappears from
 *   the Feed. The lineage application check binds to the exact requested
 *   Challenge — an ancestor's application in another Challenge never
 *   authorizes anything here.
 *
 * NOT implemented here (unauthorized in this package): A1–A6 automatic
 * moments, S2 Streak milestones (qualifying schedule undecided), S3 Race
 * results, Kudos, announcements, external sharing, Group Feed changes.
 */
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
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
/** Microsecond-precision UTC instants (PostgreSQL never truncates these). */
const CURSOR_INSTANT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/;
const PUBLISH_KEY_RE = /^[A-Za-z0-9-]{16,64}$/;

export interface ChallengeFeedItem {
  feedItemId: string;
  kind: 'activity_share';
  /** Withdrawal reference, present ONLY on the viewer's own Share. */
  activityEventId?: string;
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
  /** The member's own withdrawal action (audit fact, never inferred). */
  withdrawn: boolean;
  /** Whether the Share is currently visible in the Feed, resolved at read
   * time from the same truth the Feed read applies. */
  visible: boolean;
  /** Why a hidden Share is hidden; null while visible. */
  hiddenReason: 'withdrawn' | 'suppressed' | 'reversed' | 'expired' | null;
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

interface FeedRow extends Record<string, unknown> {
  share_id: string;
  member_id: string;
  activity_event_id: string;
  published_at: string | Date;
  published_at_cursor: string;
  display_name: string | null;
  head_value: number;
  head_unit: string;
  head_canonical_key: string;
  head_knowledge_id: string | null;
  head_knowledge_version: number | null;
  activity_name: string | null;
}

interface ShareSourceRow extends Record<string, unknown> {
  record_id: string;
}

interface ExistingShareRow extends Record<string, unknown> {
  share_id: string;
  published_at: string | Date;
  withdrawn_at: string | Date | null;
  suppressed_at: string | Date | null;
  last_publish_key: string | null;
}

interface HeadRow extends Record<string, unknown> {
  correction_kind: 'correction' | 'reversal' | null;
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
        || !CURSOR_INSTANT_RE.test(parsed.lastScannedAt) || typeof parsed.lastScannedId !== 'string'
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

/** Read a bounded member page of currently-visible S1 Shares.
 *
 * Visibility is resolved at read time against the CURRENT lineage head of
 * each Share's Activity: corrected Activities display their current
 * effective value (the same value the owner's History shows), and reversed
 * Activities are never visible. The cursor boundary preserves PostgreSQL
 * microsecond precision — no page ever skips a Share. */
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

  const result = await db.query<FeedRow>(
    `SELECT s.share_id, s.member_id, s.activity_event_id, s.published_at,
            to_char(s.published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS published_at_cursor,
            m.display_name,
            head.value AS head_value, head.unit AS head_unit, head.canonical_key AS head_canonical_key,
            head.knowledge_id AS head_knowledge_id, head.knowledge_version AS head_knowledge_version,
            COALESCE(kv.name, k.name, head.canonical_key) AS activity_name
       FROM challenge_feed_shares s
       JOIN members m ON m.member_id = s.member_id
       CROSS JOIN LATERAL (
         WITH RECURSIVE chain AS (
           SELECT event_id, correction_kind, value, unit, canonical_key,
                  knowledge_id, knowledge_version, supersedes_event_id, 0 AS depth
             FROM member_activity_events
            WHERE event_id = s.activity_event_id
           UNION ALL
           SELECT c.event_id, c.correction_kind, c.value, c.unit, c.canonical_key,
                  c.knowledge_id, c.knowledge_version, c.supersedes_event_id, chain.depth + 1
             FROM chain
             JOIN member_activity_events c ON c.supersedes_event_id = chain.event_id
         )
         SELECT * FROM chain ORDER BY depth DESC LIMIT 1
       ) head
       LEFT JOIN knowledge_item_versions kv
         ON kv.item_id = head.knowledge_id AND kv.version = head.knowledge_version
       LEFT JOIN knowledge_items k ON k.knowledge_id = head.knowledge_id
      WHERE s.challenge_id = $1
        AND s.event_family = 'activity_share'
        AND s.withdrawn_at IS NULL
        AND s.suppressed_at IS NULL
        AND head.correction_kind IS DISTINCT FROM 'reversal'
        AND ($2::text IS NULL OR (s.published_at, s.share_id) < ($2::timestamptz, $3::uuid))
      ORDER BY s.published_at DESC, s.share_id DESC
      LIMIT $4`,
    [challengeId, cursor?.lastScannedAt ?? null, cursor?.lastScannedId ?? null, limit + 1],
  );

  const hasMore = result.rows.length > limit;
  const pageRows = result.rows.slice(0, limit);
  const items = pageRows.map((row): ChallengeFeedItem => {
    const ownShare = String(row.member_id) === memberId;
    const base: ChallengeFeedItem = {
      feedItemId: String(row.share_id),
      kind: 'activity_share',
      sharerDisplayName: row.display_name === null ? null : String(row.display_name),
      activityName: String(row.activity_name),
      value: Number(row.head_value),
      unit: String(row.head_unit),
      publishedAt: new Date(row.published_at).toISOString(),
      ownShare,
    };
    // The canonical event ID is the owner's withdrawal reference; other
    // viewers never receive it (CF-01 §3.6 minimum disclosure).
    return ownShare ? { ...base, activityEventId: String(row.activity_event_id) } : base;
  });
  const last = pageRows.at(-1);
  const nextCursor = hasMore && last
    ? encodeCursor({
      v: 1,
      challengeId,
      ordering: ORDERING,
      direction: 'desc',
      pageSize: limit,
      lastScannedAt: String(last.published_at_cursor),
      lastScannedId: String(last.share_id),
      issuedAt: now.getTime(),
      expiresAt: now.getTime() + CHALLENGE_FEED_CURSOR_TTL_MS,
    }, secret)
    : null;
  return { challengeId, items, nextCursor };
}

/** The owner's exact current Share state for one source Activity. The
 * visibility verdict applies the same truth the Feed read applies — a
 * reversed source or an expired Feed is honestly reported hidden, never
 * presented as an active Share. */
export async function readActivityShareState(
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
  const { endedAt } = await requireFeedAudience(db, authority, challengeId, memberId);
  const found = await db.query<ExistingShareRow>(
    `SELECT share_id, published_at, withdrawn_at, suppressed_at, last_publish_key
       FROM challenge_feed_shares
      WHERE member_id = $1 AND challenge_id = $2 AND activity_event_id = $3`,
    [memberId, challengeId, activityEventId],
  );
  const share = found.rows[0];
  if (!share) {
    throw new ChallengeFeedError(404, 'unknown_activity', 'Activity not found');
  }
  let hiddenReason: ActivityShareState['hiddenReason'] = null;
  if (feedExpired(endedAt, now)) hiddenReason = 'expired';
  if (hiddenReason === null && share.suppressed_at !== null) hiddenReason = 'suppressed';
  if (hiddenReason === null && share.withdrawn_at !== null) hiddenReason = 'withdrawn';
  if (hiddenReason === null) {
    const head = await currentHead(db, activityEventId);
    if (head.correction_kind === 'reversal') hiddenReason = 'reversed';
  }
  return {
    shareId: String(share.share_id),
    challengeId,
    activityEventId,
    publishedAt: new Date(share.published_at).toISOString(),
    withdrawn: share.withdrawn_at !== null,
    visible: hiddenReason === null,
    hiddenReason,
  };
}

interface ResolvedHead extends HeadRow {
  event_id: string;
  status: string;
  value: number;
  unit: string;
}

/** Resolve the current lineage head of an Activity (single chain: the ledger
 * forbids superseding an already-superseded event). */
async function currentHead(db: Db, eventId: string): Promise<ResolvedHead> {
  const result = await db.query<ResolvedHead>(
    `WITH RECURSIVE chain AS (
       SELECT event_id, correction_kind, status, value, unit, supersedes_event_id, 0 AS depth
         FROM member_activity_events
        WHERE event_id = $1
       UNION ALL
       SELECT c.event_id, c.correction_kind, c.status, c.value, c.unit, c.supersedes_event_id, chain.depth + 1
         FROM chain
         JOIN member_activity_events c ON c.supersedes_event_id = chain.event_id
     )
     SELECT event_id, correction_kind, status, value, unit FROM chain ORDER BY depth DESC LIMIT 1`,
    [eventId],
  );
  const head = result.rows[0];
  if (!head) throw new ChallengeFeedError(404, 'unknown_activity', 'Activity not found');
  return head;
}

/** Record an acknowledged publication request key for one Share row. */
async function recordChoice(tx: Db, shareId: string, clientKey: string): Promise<void> {
  await tx.query(
    `INSERT INTO challenge_feed_share_choices (share_id, client_key)
     VALUES ($1, $2)
     ON CONFLICT (share_id, client_key) DO NOTHING`,
    [shareId, clientKey],
  );
}

/** Whether this request key was EVER acknowledged for the Share row. */
async function choiceWasAcknowledged(tx: Db, shareId: string, clientKey: string): Promise<boolean> {
  const found = await tx.query<{ present: boolean }>(
    `SELECT TRUE AS present FROM challenge_feed_share_choices
      WHERE share_id = $1 AND client_key = $2`,
    [shareId, clientKey],
  );
  return found.rows.length > 0;
}

/**
 * Lock the lineage HEAD row FOR SHARE. The ledger's correction trigger must
 * UPDATE the superseded parent row when any new correction/reversal commits,
 * so holding this lock keeps the resolved head stable through the caller's
 * transaction — including heads reached through earlier corrections.
 */
async function lockHead(db: Db, headEventId: string): Promise<ResolvedHead> {
  const result = await db.query<ResolvedHead>(
    `SELECT event_id, correction_kind, status, value, unit
       FROM member_activity_events
      WHERE event_id = $1
      FOR SHARE`,
    [headEventId],
  );
  const head = result.rows[0];
  if (!head) throw new ChallengeFeedError(404, 'unknown_activity', 'Activity not found');
  return head;
}

/** Publish (or idempotently confirm) the member's own accepted Activity
 * Share. Publication is keyed to the member's explicit choice
 * (`clientKey`): retries of one choice converge without reordering or
 * undoing a withdrawal, and only a fresh confirm re-publishes a withdrawn
 * Share. One active Share per member per source Activity, ever. */
export async function publishActivityShare(
  db: Db,
  authority: GroupMembershipAuthority,
  memberId: string,
  challengeId: string,
  activityEventId: string,
  input: { clientKey: string; previewedValue: number; previewedUnit: string },
  options: { now?: Date } = {},
): Promise<ActivityShareState> {
  const { clientKey, previewedValue, previewedUnit } = input;
  const now = options.now ?? new Date();
  if (!UUID_RE.test(challengeId)) {
    throw new ChallengeFeedError(400, 'invalid_challenge_id', 'challengeId must be a Tiizi challenge UUID');
  }
  if (!UUID_RE.test(activityEventId)) {
    throw new ChallengeFeedError(400, 'invalid_activity_id', 'activityEventId must be a Tiizi Activity UUID');
  }
  if (!PUBLISH_KEY_RE.test(clientKey)) {
    throw new ChallengeFeedError(400, 'invalid_client_key', 'clientKey must be a request-scoped key');
  }

  // CF-01 §5 audience: the sharer must still be an authorized viewer.
  const { endedAt } = await requireFeedAudience(db, authority, challengeId, memberId);
  if (feedExpired(endedAt, now)) {
    throw new ChallengeFeedError(409, 'feed_expired', 'This Challenge Feed has expired');
  }

  // State-explicit publication inside one transaction: the source event row
  // is locked FOR SHARE so a correction/reversal committed concurrently
  // cannot slip between validation and the write.
  return db.transaction(async (tx) => {
    // S1 source authority: the caller's own DIRECT application of this exact
    // event to this exact Challenge (self-only by construction; a foreign or
    // unapplied event id — in ANY Challenge — is indistinguishable from
    // not-found). An ancestor's application in another Challenge never
    // authorizes anything here.
    const source = await tx.query<ShareSourceRow>(
      `SELECT r.record_id
         FROM challenge_activity_records r
         JOIN challenge_participations p ON p.participation_id = r.participation_id
         JOIN member_activity_events e ON e.event_id = r.event_id
        WHERE r.challenge_id = $1
          AND p.member_id = $2
          AND r.event_id = $3
          AND r.accepted_at IS NOT NULL
        FOR SHARE OF e`,
      [challengeId, memberId, activityEventId],
    );
    const row = source.rows[0];
    if (!row) {
      throw new ChallengeFeedError(404, 'unknown_activity', 'Activity not found');
    }

    let head = await currentHead(tx, activityEventId);
    // Hold the head row so a correction/reversal committed concurrently
    // (whose ledger trigger must update this row) cannot slip between
    // validation and the Share write — for the accepted event AND for any
    // head reached through earlier corrections.
    const locked = await lockHead(tx, head.event_id);
    head = locked;
    if (head.correction_kind === 'reversal') {
      throw new ChallengeFeedError(
        409,
        'source_reversed',
        'This Activity was reversed and cannot be shared',
      );
    }
    // The member confirmed exactly what the preview showed. If a correction
    // changed the effective value after the preview opened, refuse: no
    // value the member never previewed is ever published.
    if (Number(head.value) !== previewedValue || String(head.unit) !== previewedUnit) {
      throw new ChallengeFeedError(
        409,
        'source_changed',
        'This Activity changed since you previewed it; preview the current version and confirm again',
      );
    }

    const inserted = await tx.query<ExistingShareRow>(
      `INSERT INTO challenge_feed_shares
         (challenge_id, member_id, activity_event_id, activity_record_id, event_family, last_publish_key)
       VALUES ($1, $2, $3, $4, 'activity_share', $5)
       ON CONFLICT (member_id, activity_event_id) DO NOTHING
       RETURNING share_id, published_at, withdrawn_at, suppressed_at, last_publish_key`,
      [challengeId, memberId, activityEventId, String(row.record_id), clientKey],
    );
    const fresh = inserted.rows[0];
    if (fresh) {
      await recordChoice(tx, String(fresh.share_id), clientKey);
      return {
        shareId: String(fresh.share_id),
        challengeId,
        activityEventId,
        publishedAt: new Date(fresh.published_at).toISOString(),
        withdrawn: false,
        visible: true,
        hiddenReason: null,
      };
    }

    const existing = await tx.query<ExistingShareRow>(
      `SELECT share_id, published_at, withdrawn_at, suppressed_at, last_publish_key
         FROM challenge_feed_shares
        WHERE member_id = $1 AND activity_event_id = $2
        FOR UPDATE`,
      [memberId, activityEventId],
    );
    const share = existing.rows[0];
    if (!share) {
      throw new ChallengeFeedError(503, 'feed_unavailable', 'Share publication is unavailable');
    }
    const active = share.withdrawn_at === null && share.suppressed_at === null;
    if (share.suppressed_at !== null) {
      // Operator suppression is projection-only; republishing needs review.
      throw new ChallengeFeedError(409, 'share_suppressed', 'This Share was removed and cannot be republished');
    }
    if (active) {
      // Already shared: idempotent for both a retry and a repeat deliberate
      // choice — the existing Share is returned unchanged, never reordered.
      // EVERY acknowledged key is recorded so a DELAYED REPLAY of any
      // acknowledged request, arriving after a later withdrawal, is refused
      // as stale instead of silently re-publishing.
      await recordChoice(tx, String(share.share_id), clientKey);
      if (share.last_publish_key !== clientKey) {
        await tx.query(
          `UPDATE challenge_feed_shares SET last_publish_key = $2 WHERE share_id = $1`,
          [String(share.share_id), clientKey],
        );
      }
      return {
        shareId: String(share.share_id),
        challengeId,
        activityEventId,
        publishedAt: new Date(share.published_at).toISOString(),
        withdrawn: false,
        visible: true,
        hiddenReason: null,
      };
    }
    if (await choiceWasAcknowledged(tx, String(share.share_id), clientKey)) {
      // A delayed retry of ANY choice the member has since withdrawn can
      // never silently undo that withdrawal.
      throw new ChallengeFeedError(409, 'share_withdrawn', 'This Share was withdrawn; confirm to share it again');
    }
    // A FRESH explicit choice revives the same auditable row.
    const revived = await tx.query<ExistingShareRow>(
      `UPDATE challenge_feed_shares
          SET withdrawn_at = NULL, published_at = now(), last_publish_key = $4
        WHERE member_id = $1 AND activity_event_id = $2 AND challenge_id = $3
        RETURNING share_id, published_at, withdrawn_at, suppressed_at, last_publish_key`,
      [memberId, activityEventId, challengeId, clientKey],
    );
    const back = revived.rows[0];
    if (!back) {
      throw new ChallengeFeedError(503, 'feed_unavailable', 'Share publication is unavailable');
    }
    await recordChoice(tx, String(back.share_id), clientKey);
    return {
      shareId: String(back.share_id),
      challengeId,
      activityEventId,
      publishedAt: new Date(back.published_at).toISOString(),
      withdrawn: false,
      visible: true,
      hiddenReason: null,
    };
  });
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
    visible: false,
    hiddenReason: 'withdrawn',
  };
}

function requireAuthority(deps: ChallengeFeedRouteDeps): GroupMembershipAuthority {
  const authority = deps.groupMembershipAuthority;
  if (!authority) throw new ChallengeFeedError(503, 'feed_unavailable', 'Feed read authority is unavailable');
  return authority;
}

async function feedRoute<T>(run: () => Promise<T>, fallback: string): Promise<T> {
  try {
    return await run();
  } catch (error) {
    if (error instanceof ChallengeFeedError) throw error;
    const candidate = error as { statusCode?: number; code?: string };
    if (typeof candidate.statusCode === 'number' && typeof candidate.code === 'string'
        && candidate.statusCode >= 400 && candidate.statusCode < 500) {
      throw new ChallengeFeedError(candidate.statusCode, candidate.code, (error as Error).message);
    }
    throw new ChallengeFeedError(503, 'feed_unavailable', fallback);
  }
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

  const paramsSchema = {
    type: 'object', required: ['challengeId'],
    properties: { challengeId: { type: 'string', format: 'uuid' } },
  };
  const activityShareBodySchema = {
    type: 'object',
    required: ['activityEventId', 'clientKey', 'previewedValue', 'previewedUnit'],
    additionalProperties: false,
    properties: {
      activityEventId: { type: 'string', format: 'uuid' },
      /** Request-scoped choice key (UI-minted UUID): retries converge. */
      clientKey: { type: 'string', minLength: 16, maxLength: 64 },
      /** The value/unit exactly as shown in the member's preview; the
       * server refuses to publish a value the member never previewed. */
      previewedValue: { type: 'number', minimum: 0 },
      previewedUnit: { type: 'string', minLength: 1, maxLength: 40 },
    },
  };
  const shareStateResponseSchema = {
    type: 'object',
    required: ['shareId', 'challengeId', 'activityEventId', 'publishedAt', 'withdrawn', 'visible', 'hiddenReason'],
    additionalProperties: false,
    properties: {
      shareId: { type: 'string', format: 'uuid' },
      challengeId: { type: 'string', format: 'uuid' },
      activityEventId: { type: 'string', format: 'uuid' },
      publishedAt: { type: 'string', format: 'date-time' },
      withdrawn: { type: 'boolean' },
      visible: { type: 'boolean' },
      hiddenReason: { anyOf: [{ type: 'string', enum: ['withdrawn', 'suppressed', 'reversed', 'expired'] }, { type: 'null' }] },
    },
  };

  app.get(apiPath('/challenges/:challengeId/feed'), {
    schema: {
      params: paramsSchema,
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
                required: ['feedItemId', 'kind', 'sharerDisplayName', 'activityName', 'value', 'unit', 'publishedAt', 'ownShare'],
                properties: {
                  feedItemId: { type: 'string', format: 'uuid' },
                  kind: { const: 'activity_share' },
                  /** Present only on the viewer's own Share. */
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
    const authority = requireAuthority(deps);
    return feedRoute(() => getChallengeFeedPage(db, authority, member.memberId, params.challengeId, {
      limit: query.limit,
      cursor: query.cursor,
      now: deps.now?.(),
      secret: deps.cursorSecret?.(),
    }), 'Feed read authority is unavailable');
  });

  app.get(apiPath('/challenges/:challengeId/feed/activity-shares/:activityEventId'), {
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
    const authority = requireAuthority(deps);
    return feedRoute(() => readActivityShareState(
      db, authority, member.memberId, params.challengeId, params.activityEventId,
      { now: deps.now?.() },
    ), 'Share state authority is unavailable');
  });

  app.post(apiPath('/challenges/:challengeId/feed/activity-shares'), {
    schema: {
      params: paramsSchema,
      body: activityShareBodySchema,
      response: { 200: shareStateResponseSchema },
    },
  }, async (request) => {
    const member = authenticatedMember(request);
    const params = request.params as { challengeId: string };
    const body = request.body as { activityEventId: string; clientKey: string; previewedValue: number; previewedUnit: string };
    const authority = requireAuthority(deps);
    return feedRoute(() => publishActivityShare(
      db, authority, member.memberId, params.challengeId, body.activityEventId,
      { clientKey: body.clientKey, previewedValue: body.previewedValue, previewedUnit: body.previewedUnit },
      { now: deps.now?.() },
    ), 'Share publication is unavailable');
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
    const authority = requireAuthority(deps);
    return feedRoute(() => withdrawActivityShare(
      db, authority, member.memberId, params.challengeId, params.activityEventId,
    ), 'Share withdrawal is unavailable');
  });
}

/** Server-side fallback key generator for internal callers (routes always
 * require the client key explicitly). */
export function newPublishKey(): string {
  return randomUUID();
}
