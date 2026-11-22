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
  /** Aggregate Kudos count, visible to every Feed viewer (CF-01 §6.2). */
  kudosCount: number;
  /** Whether the VIEWER's own Kudos is active on this entry. */
  viewerKudos: boolean;
}

export interface KudosState {
  feedItemId: string;
  kudosCount: number;
  viewerKudos: boolean;
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
  kudos_count: string | number;
  viewer_kudos: boolean;
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
            COALESCE(kv.name, k.name, head.canonical_key) AS activity_name,
            kudos.count AS kudos_count,
            (viewer.kudos_id IS NOT NULL) AS viewer_kudos
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
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count FROM challenge_feed_kudos kk WHERE kk.share_id = s.share_id
       ) kudos ON TRUE
       LEFT JOIN challenge_feed_kudos viewer
         ON viewer.share_id = s.share_id AND viewer.member_id = $5
      WHERE s.challenge_id = $1
        AND s.event_family = 'activity_share'
        AND s.withdrawn_at IS NULL
        AND s.suppressed_at IS NULL
        AND head.correction_kind IS DISTINCT FROM 'reversal'
        AND ($2::text IS NULL OR (s.published_at, s.share_id) < ($2::timestamptz, $3::uuid))
      ORDER BY s.published_at DESC, s.share_id DESC
      LIMIT $4`,
    [challengeId, cursor?.lastScannedAt ?? null, cursor?.lastScannedId ?? null, limit + 1, memberId],
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
      kudosCount: Number(row.kudos_count ?? 0),
      viewerKudos: Boolean(row.viewer_kudos),
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
  // Precedence: expiry > suppression > REVERSAL > withdrawal. A reversed
  // source is more actionable than the member's own earlier withdrawal (the
  // panel must offer no Share action for it), so reversal outranks it.
  let hiddenReason: ActivityShareState['hiddenReason'] = null;
  if (feedExpired(endedAt, now)) hiddenReason = 'expired';
  if (hiddenReason === null && share.suppressed_at !== null) hiddenReason = 'suppressed';
  if (hiddenReason === null) {
    const head = await currentHead(db, activityEventId);
    if (head.correction_kind === 'reversal') hiddenReason = 'reversed';
  }
  if (hiddenReason === null && share.withdrawn_at !== null) hiddenReason = 'withdrawn';
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

/** Bound the acknowledged-key history per Share by TIME, not count: keys
 * acknowledged within the last 24 hours are kept; older keys are pruned.
 * The replay-protection horizon is therefore 24 hours — far beyond any
 * genuine delayed retry (seconds to minutes) — while storage stays bounded
 * by the member's own confirmation rate over one day. A key older than the
 * horizon is treated as a new member action; the UI mints a fresh key per
 * confirm click, and the owner's panel always reports the live Share
 * state, so even that vanishing edge cannot hide a revival. */
const CHOICE_HISTORY_HOURS = 24;

/** Record an acknowledged publication request key for one Share row. A
 * RETRY of an already-recorded key refreshes its acknowledged timestamp, so
 * a successful retry never prunes its own replay protection. */
async function recordChoice(tx: Db, shareId: string, clientKey: string): Promise<void> {
  await tx.query(
    `INSERT INTO challenge_feed_share_choices (share_id, client_key)
     VALUES ($1, $2)
     ON CONFLICT (share_id, client_key) DO UPDATE SET acknowledged_at = now()`,
    [shareId, clientKey],
  );
  await tx.query(
    `DELETE FROM challenge_feed_share_choices
      WHERE share_id = $1
        AND acknowledged_at < now() - ($2 || ' hours')::interval`,
    [shareId, String(CHOICE_HISTORY_HOURS)],
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

  // State-explicit publication inside one transaction. The source event row
  // is locked FOR SHARE and the lineage HEAD is resolved, LOCKED and
  // re-verified, so no correction/reversal can slip between validation and
  // the write. Share-row state is settled BEFORE the measurement checks, so
  // the error contract is exact: a suppressed Share answers share_suppressed,
  // an acknowledged-key replay after withdrawal answers share_withdrawn, and
  // only a genuinely fresh choice reaches the reversal / changed-source
  // checks.
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

    // Bounded convergence loop: a concurrent FIRST publication can commit
    // between our row read and our insert; the losing request re-settles
    // the winner's state instead of failing, so both requests converge on
    // the same Share (Read Committed gives each iteration a fresh snapshot
    // after the insert conflict wait). A request that has LOST such a race
    // has been in flight across a concurrent state change: it may only
    // converge idempotently or be refused — it can never revive a Share
    // the member has since withdrawn (the member's latest action must win).
    let lostRace = false;
    for (let attempt = 0; attempt < 3; attempt += 1) {
    // Settle the existing Share-row state first (serialized against
    // withdrawal and concurrent publication by FOR UPDATE).
    const existing = await tx.query<ExistingShareRow>(
      `SELECT share_id, published_at, withdrawn_at, suppressed_at, last_publish_key
         FROM challenge_feed_shares
        WHERE member_id = $1 AND activity_event_id = $2
        FOR UPDATE`,
      [memberId, activityEventId],
    );
    const share = existing.rows[0];
    if (share && share.suppressed_at !== null) {
      // Operator suppression is projection-only; republishing needs review.
      throw new ChallengeFeedError(409, 'share_suppressed', 'This Share was removed and cannot be republished');
    }
    if (share && share.withdrawn_at !== null
        && (await choiceWasAcknowledged(tx, String(share.share_id), clientKey))) {
      // A delayed retry of ANY choice the member has since WITHDRAWN can
      // never silently undo that withdrawal — this precedence is exact and
      // never masked by a later measurement change. (An acknowledged key
      // retried while the Share is still active is an ordinary idempotent
      // retry and converges below.)
      throw new ChallengeFeedError(409, 'share_withdrawn', 'This Share was withdrawn; confirm to share it again');
    }

    // Resolve the current lineage head, LOCK it, and VERIFY the lock still
    // holds the committed head. The ledger's supersede trigger flips the
    // parent's status at commit, so a correction/reversal that won the race
    // between resolution and lock acquisition leaves the locked row
    // superseded — re-resolve (bounded) instead of ever validating against
    // a stale head. Once a COMMITTED head is locked, no further child can
    // commit through this transaction: its trigger update blocks here.
    let head: ResolvedHead | null = null;
    for (let attempt = 0; attempt < 5 && head === null; attempt += 1) {
      const resolved = await currentHead(tx, activityEventId);
      const locked = await lockHead(tx, resolved.event_id);
      if (locked.status === 'committed') head = locked;
    }
    if (!head) {
      throw new ChallengeFeedError(
        409,
        'source_changed',
        'This Activity is changing continuously; preview the current version and confirm again',
      );
    }
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

    if (share && share.withdrawn_at === null) {
      // Already shared: idempotent for both a retry and a repeat deliberate
      // choice — the existing Share is returned unchanged, never reordered.
      // (The reversal / changed-source checks above still refuse an active
      // Share whose source was corrected or reversed since, so the returned
      // visible:true is always read-truth.) EVERY acknowledged key is
      // recorded so a DELAYED REPLAY of any acknowledged request, arriving
      // after a later withdrawal, is refused as stale instead of silently
      // re-publishing.
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
    if (share && lostRace) {
      // This request lost a concurrent first-publication race and the
      // member withdrew the winner's Share while it was in flight: the
      // member made NO fresh confirmation after that withdrawal, so the
      // Share stays withdrawn. Only a genuinely new confirm revives it.
      throw new ChallengeFeedError(409, 'share_withdrawn', 'This Share was withdrawn; confirm to share it again');
    }
    if (share) {
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
    // No row read, none inserted: a concurrent first publication committed
    // in between — loop once more and settle its state idempotently, with
    // revival now forbidden (this request was in flight across the change).
    lostRace = true;
    }
    // Three consecutive lost races (pathological churn): fail closed.
    throw new ChallengeFeedError(503, 'feed_unavailable', 'Share publication is unavailable');
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

/** CF-01 §6.2 — resolve a currently-visible Feed entry for a Kudos
 * mutation, under the SAME audience and visibility truth as the Feed read,
 * with the entry row LOCKED so a concurrent withdrawal or suppression
 * serializes against this decision. Denials stay indistinguishable from
 * not-found. Never fails open: an unreadable source lineage is a 503, not
 * an implicit pass. */
async function requireKudosEntry(
  db: Db,
  authority: GroupMembershipAuthority,
  memberId: string,
  challengeId: string,
  feedItemId: string,
): Promise<{ shareId: string; sharerMemberId: string; activityEventId: string }> {
  if (!UUID_RE.test(challengeId)) {
    throw new ChallengeFeedError(400, 'invalid_challenge_id', 'challengeId must be a Tiizi challenge UUID');
  }
  if (!UUID_RE.test(feedItemId)) {
    throw new ChallengeFeedError(400, 'invalid_entry', 'feedItemId must be a Tiizi Feed entry UUID');
  }
  const { endedAt } = await requireFeedAudience(db, authority, challengeId, memberId);
  if (feedExpired(endedAt, new Date())) {
    throw new ChallengeFeedError(404, 'unknown_entry', 'Feed entry not found');
  }
  const found = await db.query<{ share_id: string; member_id: string; activity_event_id: string; withdrawn_at: Date | null; suppressed_at: Date | null }>(
    `SELECT s.share_id, s.member_id, s.activity_event_id, s.withdrawn_at, s.suppressed_at
       FROM challenge_feed_shares s
      WHERE s.share_id = $1 AND s.challenge_id = $2
        AND s.withdrawn_at IS NULL AND s.suppressed_at IS NULL
      FOR UPDATE`,
    [feedItemId, challengeId],
  );
  const share = found.rows[0];
  if (!share) throw new ChallengeFeedError(404, 'unknown_entry', 'Feed entry not found');
  // Reversal safety: a Feed entry whose source lineage was reversed is not
  // currently visible, so it cannot be Kudos-mutated either. The lookup never
  // fails open — an unreadable lineage refuses the mutation.
  const head = await currentHead(db, String(share.activity_event_id));
  if (head.correction_kind === 'reversal') {
    throw new ChallengeFeedError(404, 'unknown_entry', 'Feed entry not found');
  }
  return {
    shareId: String(share.share_id),
    sharerMemberId: String(share.member_id),
    activityEventId: String(share.activity_event_id),
  };
}

/** CF-01 §6.2 required abuse protection: a member may not exceed a bounded
 * rate of Kudos mutations. Enforced per member over a sliding window. */
const KUDOS_RATE_LIMIT_PER_MINUTE = 30;

async function requireKudosRateAllowed(db: Db, memberId: string): Promise<void> {
  const recent = await db.query<{ count: string | number }>(
    `SELECT COUNT(*) AS count
       FROM challenge_feed_kudos
      WHERE member_id = $1 AND created_at > now() - interval '1 minute'`,
    [memberId],
  );
  if (Number(recent.rows[0]?.count ?? 0) > KUDOS_RATE_LIMIT_PER_MINUTE) {
    throw new ChallengeFeedError(429, 'kudos_rate_limited', 'Slow down — try again in a minute');
  }
}

async function readKudosState(db: Db, feedItemId: string, memberId: string): Promise<KudosState> {
  const state = await db.query<{ count: string | number; viewer: boolean }>(
    `SELECT COALESCE(kc.count, 0) AS count,
            (vk.kudos_id IS NOT NULL) AS viewer
       FROM challenge_feed_shares s
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS count FROM challenge_feed_kudos kk WHERE kk.share_id = s.share_id
       ) kc ON TRUE
       LEFT JOIN challenge_feed_kudos vk ON vk.share_id = s.share_id AND vk.member_id = $2
      WHERE s.share_id = $1`,
    [feedItemId, memberId],
  );
  const row = state.rows[0];
  return {
    feedItemId,
    kudosCount: Number(row?.count ?? 0),
    viewerKudos: Boolean(row?.viewer),
  };
}

/** Add the member's single Kudos to a visible Feed entry (idempotent). */
export async function addChallengeFeedKudos(
  db: Db,
  authority: GroupMembershipAuthority,
  memberId: string,
  challengeId: string,
  feedItemId: string,
): Promise<KudosState> {
  await requireKudosRateAllowed(db, memberId);
  return db.transaction(async (tx) => {
    // Entry authorization and the insert share ONE transaction with the
    // entry row locked, so a concurrent withdrawal/suppression serializes
    // before this decision rather than racing it.
    const entry = await requireKudosEntry(tx, authority, memberId, challengeId, feedItemId);
    if (entry.sharerMemberId === memberId) {
      // CF-01 §6.2: no self-Kudos. The entry is visible to the sharer, so an
      // honest policy refusal discloses nothing.
      throw new ChallengeFeedError(409, 'self_kudos', 'You cannot add Kudos to your own Share');
    }
    await tx.query(
      `INSERT INTO challenge_feed_kudos (share_id, member_id) VALUES ($1, $2)
       ON CONFLICT (share_id, member_id) DO NOTHING`,
      [entry.shareId, memberId],
    );
    return readKudosState(tx, feedItemId, memberId);
  });
}

/** Remove the member's Kudos from a Feed entry (idempotent). Uses the
 * SAME entry authorization as the add: a cross-Challenge, withdrawn,
 * suppressed, reversed or expired entry is not-found, never a silent zero
 * state, and a Kudos can never be removed for an entry the caller cannot
 * currently view. */
export async function removeChallengeFeedKudos(
  db: Db,
  authority: GroupMembershipAuthority,
  memberId: string,
  challengeId: string,
  feedItemId: string,
): Promise<KudosState> {
  return db.transaction(async (tx) => {
    const entry = await requireKudosEntry(tx, authority, memberId, challengeId, feedItemId);
    await tx.query(
      'DELETE FROM challenge_feed_kudos WHERE share_id = $1 AND member_id = $2',
      [entry.shareId, memberId],
    );
    return readKudosState(tx, feedItemId, memberId);
  });
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
                required: ['feedItemId', 'kind', 'sharerDisplayName', 'activityName', 'value', 'unit', 'publishedAt', 'ownShare', 'kudosCount', 'viewerKudos'],
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
                  kudosCount: { type: 'integer', minimum: 0 },
                  viewerKudos: { type: 'boolean' },
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

  const kudosResponseSchema = {
    type: 'object',
    required: ['feedItemId', 'kudosCount', 'viewerKudos'],
    additionalProperties: false,
    properties: {
      feedItemId: { type: 'string', format: 'uuid' },
      kudosCount: { type: 'integer', minimum: 0 },
      viewerKudos: { type: 'boolean' },
    },
  };

  app.post(apiPath('/challenges/:challengeId/feed/entries/:feedItemId/kudos'), {
    schema: {
      params: {
        type: 'object', required: ['challengeId', 'feedItemId'],
        properties: {
          challengeId: { type: 'string', format: 'uuid' },
          feedItemId: { type: 'string', format: 'uuid' },
        },
      },
      response: { 200: kudosResponseSchema },
    },
  }, async (request) => {
    const member = authenticatedMember(request);
    const params = request.params as { challengeId: string; feedItemId: string };
    const authority = requireAuthority(deps);
    return feedRoute(() => addChallengeFeedKudos(
      db, authority, member.memberId, params.challengeId, params.feedItemId,
    ), 'Kudos authority is unavailable');
  });

  app.delete(apiPath('/challenges/:challengeId/feed/entries/:feedItemId/kudos'), {
    schema: {
      params: {
        type: 'object', required: ['challengeId', 'feedItemId'],
        properties: {
          challengeId: { type: 'string', format: 'uuid' },
          feedItemId: { type: 'string', format: 'uuid' },
        },
      },
      response: { 200: kudosResponseSchema },
    },
  }, async (request) => {
    const member = authenticatedMember(request);
    const params = request.params as { challengeId: string; feedItemId: string };
    const authority = requireAuthority(deps);
    return feedRoute(() => removeChallengeFeedKudos(
      db, authority, member.memberId, params.challengeId, params.feedItemId,
    ), 'Kudos authority is unavailable');
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
