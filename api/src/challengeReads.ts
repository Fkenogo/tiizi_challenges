/**
 * Phase C3A V2 Challenge read API — minimum read surface for Challenge UI.
 *
 * Reads come ONLY from V2 PostgreSQL truth: challenges, immutable configs,
 * participations, challenge_participation_derived, challenge_derived_state.
 * There is deliberately NO fallback to workouts / wellnessLogs /
 * challengeMembers progress / Firestore leaderboards / V1
 * challengeActivitySummaries — no dual-read merge. A missing derived row
 * means "no accepted activity yet" and renders as zero-state, never as a
 * V1 lookup.
 *
 * Endpoints (conceptual):
 * - GET /v1/challenges — challenges the caller is entitled to see;
 * - GET /v1/challenges/:challengeId — detail + governing config + own progress;
 * - GET /v1/challenges/:challengeId/leaderboard — competitive only.
 *
 * No personal activity-history/diary API (Stage F: Tiizi is not a personal
 * activity logger; C1 deliberate omission stands).
 *
 * Authorization reuses the provider-neutral live Group-Membership authority
 * seam (the PG group_memberships shadow never authorizes on its own while
 * Firestore remains operational authority). No Firebase imports here —
 * Firebase lives at the application adapter boundary only.
 *
 * Competitive finishing positions are derived at read time via the existing
 * C2B resolver (computeFinishingPositions): completion order governs, ties
 * share (1, 2, 2, 4), non-completers have no position. Nothing is persisted.
 * One finisher does not end the Challenge (lifecycle untouched here).
 * No streak leaderboard (no ranking semantics for streaks).
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { normalizeChallengeRow, type ChallengeRow } from './challenges.js';
import {
  getGoverningVersion,
  type ActivityConfigRow,
  type GoverningSnapshot,
} from './challengeConfigs.js';
import {
  listParticipations,
  normalizeParticipationRow,
  type ParticipationRow,
} from './challengeParticipations.js';
import {
  computeFinishingPositions,
  emptyChallengeState,
  emptyParticipationState,
  normalizeChallengeDerived,
  normalizeParticipationDerived,
  type ChallengeDerivedRow,
  type ParticipationDerivedRow,
} from './derivedTruth.js';
import type { GroupMembershipAuthority } from './groupMembershipAuthority.js';
import {
  getChallengeFinal,
  getParticipationFinals,
  type ParticipationFinalRow,
} from './challengeFinalization.js';

export class ChallengeReadError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function readFail(statusCode: number, code: string, message: string): never {
  throw new ChallengeReadError(statusCode, code, message);
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ─── Response shapes (V2 truth only; no Firestore/V1 fields) ───────────────

export interface ApiParticipationProgress {
  logsAccepted: number;
  distinctDays: number;
  totalPoints: number;
  completionRate: number;
  cumulativeValues: Record<string, number>;
  cumulativeTotal: number;
  currentStreak: number;
  bestStreak: number;
  lastCompletedDay: string | null;
  dayStates: Record<string, { complete: boolean; activities: string[] }>;
  daysCompleted: number;
  completionStatus: 'in_progress' | 'completed';
  completedAt: string | null;
  /**
   * EBC-04 frozen competitive finishing position (standard competition
   * ranking). Set only from finalized history; null for non-completers,
   * non-competitive families (streaks never carry rank), and unfinalized
   * Challenges.
   */
  finalPosition: number | null;
}

export interface ApiOwnParticipation {
  participationId: string;
  status: 'active' | 'withdrawn' | 'removed';
  joinedAt: string;
  joinedConfigVersion: number;
  progress: ApiParticipationProgress;
}

export interface ApiChallengeSummary {
  challengeId: string;
  groupId: string;
  title: string;
  description: string;
  challengeType: 'collective' | 'competitive' | 'streak';
  status: 'establishment' | 'active' | 'ended';
  startDate: string;
  endDate: string;
  /** EBC-03 governing Challenge timezone (IANA) defining the Challenge day. */
  timezone: string;
  /** EBC-04: true once the terminal result is computed and frozen. */
  finalized: boolean;
  currentConfigVersion: number;
  goalValue: number | null;
  goalUnit: string | null;
  collectiveTotal: number;
  collectiveGoalReached: boolean;
  completionsCount: number;
  myParticipation: ApiOwnParticipation | null;
}

/**
 * EBC-04 frozen terminal result: the authoritative historical truth for an
 * ended + finalized Challenge. Null while unfinalized.
 */
export interface ApiFinalResult {
  finalizedAt: string;
  configVersion: number;
  finalizationVersion: string;
  engineVersion: string;
  scoringVersion: string;
  /** Type-specific terminal payload (collective aggregate, completions). */
  result: Record<string, unknown>;
}

export interface ApiChallengeDetail extends ApiChallengeSummary {
  instructions: string;
  activatedAt: string | null;
  endedAt: string | null;
  /** EBC-04 finalization marker mirror (NULL = not finalized). */
  finalizedAt: string | null;
  /** EBC-04 frozen terminal result (NULL = not finalized). */
  finalResult: ApiFinalResult | null;
  config: {
    version: number;
    period: { startDate: string; endDate: string };
    /** EBC-03 governing timezone pinned by this config version. */
    timezone: string;
    requiredConsecutiveDays: number | null;
    activities: Array<{
      canonicalKey: string;
      activityVariant: string | null;
      /** Authoritative configured kind (fitness|wellness) from the pinned
       *  Knowledge item — never inferred from name/unit/prefix. */
      activityKind: 'fitness' | 'wellness';
      targetValue: number;
      unit: string;
      position: number;
    }>;
  };
}

export interface ApiLeaderboardEntry {
  memberId: string;
  participationId: string;
  totalPoints: number;
  cumulativeTotal: number;
  logsAccepted: number;
  completionStatus: 'in_progress' | 'completed';
  completedAt: string | null;
  /** Competition ranking (1, 2, 2, 4); null for non-completers. */
  position: number | null;
}

// ─── Internal assembly ─────────────────────────────────────────────────────

function toProgress(
  derived: ParticipationDerivedRow,
  finalPosition: number | null = null,
): ApiParticipationProgress {
  return {
    logsAccepted: derived.logsAccepted,
    distinctDays: derived.distinctDays,
    totalPoints: derived.totalPoints,
    completionRate: derived.completionRate,
    cumulativeValues: { ...derived.cumulativeValues },
    cumulativeTotal: derived.cumulativeTotal,
    currentStreak: derived.currentStreak,
    bestStreak: derived.bestStreak,
    lastCompletedDay: derived.lastCompletedDay,
    dayStates: Object.fromEntries(
      Object.entries(derived.dayStates).map(([day, state]) => [
        day,
        { complete: state.complete, activities: [...state.activities] },
      ]),
    ),
    daysCompleted: derived.daysCompleted,
    completionStatus: derived.completionStatus,
    completedAt: derived.completedAt,
    // EBC-04: frozen rank only — callers pass the finals position (or null).
    finalPosition,
  };
}

function zeroParticipationDerived(
  participation: ParticipationRow,
): ParticipationDerivedRow {
  return {
    ...emptyParticipationState(),
    participation_id: participation.participation_id,
    challenge_id: participation.challenge_id,
    member_id: participation.member_id,
    engine_version: 'v2',
    scoring_version: 'computeActivityScore/v1',
    updated_at: new Date(0).toISOString(),
  };
}

function zeroChallengeDerived(challenge: ChallengeRow): ChallengeDerivedRow {
  return {
    ...emptyChallengeState(),
    challenge_id: challenge.challenge_id,
    challenge_type: challenge.challenge_type,
    engine_version: 'v2',
    scoring_version: 'computeActivityScore/v1',
    updated_at: new Date(0).toISOString(),
  };
}

function inClause(column: string, count: number, startAt = 1): string {
  return `${column} IN (${Array.from({ length: count }, (_, i) => `$${startAt + i}`).join(', ')})`;
}

async function fetchChallenges(db: Db, challengeIds: string[]): Promise<ChallengeRow[]> {
  if (challengeIds.length === 0) return [];
  const result = await db.query(
    `SELECT * FROM challenges WHERE ${inClause('challenge_id', challengeIds.length)}`,
    challengeIds,
  );
  return (result.rows as never[]).map(normalizeChallengeRow);
}

async function fetchParticipationDerived(
  db: Db,
  participationIds: string[],
): Promise<Map<string, ParticipationDerivedRow>> {
  const out = new Map<string, ParticipationDerivedRow>();
  if (participationIds.length === 0) return out;
  const result = await db.query(
    `SELECT * FROM challenge_participation_derived WHERE ${inClause('participation_id', participationIds.length)}`,
    participationIds,
  );
  for (const row of result.rows as Record<string, unknown>[]) {
    const normalized = normalizeParticipationDerived(row);
    out.set(normalized.participation_id, normalized);
  }
  return out;
}

async function fetchChallengeDerived(
  db: Db,
  challengeIds: string[],
): Promise<Map<string, ChallengeDerivedRow>> {
  const out = new Map<string, ChallengeDerivedRow>();
  if (challengeIds.length === 0) return out;
  const result = await db.query(
    `SELECT * FROM challenge_derived_state WHERE ${inClause('challenge_id', challengeIds.length)}`,
    challengeIds,
  );
  for (const row of result.rows as Record<string, unknown>[]) {
    const normalized = normalizeChallengeDerived(row);
    out.set(normalized.challenge_id, normalized);
  }
  return out;
}

/** Display episode: the active one when present, else the latest joined. */
function displayEpisode(episodes: ParticipationRow[]): ParticipationRow | null {
  if (episodes.length === 0) return null;
  const active = episodes.find((e) => e.status === 'active');
  if (active) return active;
  return [...episodes].sort((a, b) =>
    a.joined_at < b.joined_at ? 1 : a.joined_at > b.joined_at ? -1 : 0,
  )[0];
}

/**
 * Live-authority eligibility for a (group, member) pair. The PG shadow is
 * never consulted here: null/ineligible under live authority means "not
 * entitled". Authority outages throw ChallengeReadError(503) so reads fail
 * closed instead of treating them as non-membership.
 */
async function liveEligibility(
  authority: GroupMembershipAuthority,
  groupId: string,
  memberId: string,
): Promise<boolean> {
  let result;
  try {
    result = await authority.resolveGroupMembershipAuthority(groupId, memberId);
  } catch (error) {
    readFail(
      503,
      'group_authority_unavailable',
      `Group authority unreachable: ${(error as Error).message}`,
    );
  }
  return result?.eligible === true;
}

async function readChallenge(db: Db, challengeId: string): Promise<ChallengeRow> {
  if (!UUID_RE.test(challengeId)) {
    readFail(400, 'invalid_challenge_id', 'challengeId must be a Tiizi challenge UUID');
  }
  const result = await db.query(
    `SELECT * FROM challenges WHERE challenge_id = $1`,
    [challengeId],
  );
  if (result.rows.length === 0) readFail(404, 'unknown_challenge', 'Challenge not found');
  return normalizeChallengeRow(result.rows[0] as never);
}

/**
 * Entitlement for one challenge: the caller has any participation episode
 * (own history is always visible) OR is currently eligible in the
 * challenge's group under live authority. Otherwise 404 (existence is not
 * leaked to unauthorized callers); authority outages are 503.
 */
async function requireChallengeVisible(
  db: Db,
  challenge: ChallengeRow,
  memberId: string,
  authority: GroupMembershipAuthority,
): Promise<ParticipationRow[]> {
  const episodes = await listParticipations(db, challenge.challenge_id, memberId);
  if (episodes.length > 0) return episodes;
  if (await liveEligibility(authority, challenge.group_id, memberId)) return episodes;
  readFail(404, 'unknown_challenge', 'Challenge not found');
}

function toOwnParticipation(
  episode: ParticipationRow,
  derived: ParticipationDerivedRow | undefined,
  finalPosition: number | null = null,
): ApiOwnParticipation {
  return {
    participationId: episode.participation_id,
    status: episode.status,
    joinedAt: episode.joined_at,
    joinedConfigVersion: episode.joined_config_version,
    progress: toProgress(derived ?? zeroParticipationDerived(episode), finalPosition),
  };
}

async function toSummary(
  challenge: ChallengeRow,
  challengeDerived: Map<string, ChallengeDerivedRow>,
  episodesByChallenge: Map<string, ParticipationRow[]>,
  participationDerived: Map<string, ParticipationDerivedRow>,
  participationFinals: Map<string, ParticipationFinalRow>,
): Promise<ApiChallengeSummary> {
  const derived = challengeDerived.get(challenge.challenge_id) ?? zeroChallengeDerived(challenge);
  const episode = displayEpisode(episodesByChallenge.get(challenge.challenge_id) ?? []);
  return {
    challengeId: challenge.challenge_id,
    groupId: challenge.group_id,
    title: challenge.title,
    description: challenge.description,
    challengeType: challenge.challenge_type,
    status: challenge.status,
    startDate: challenge.start_date,
    endDate: challenge.end_date,
    timezone: challenge.timezone,
    // EBC-04: finalized once the terminal result is frozen (NULL marker = no).
    finalized: challenge.finalized_at != null,
    currentConfigVersion: challenge.current_config_version,
    goalValue: challenge.goal_value,
    goalUnit: challenge.goal_unit,
    collectiveTotal: derived.collectiveTotal,
    collectiveGoalReached: derived.collectiveGoalReached,
    completionsCount: derived.completionsCount,
    myParticipation: episode
      ? toOwnParticipation(
        episode,
        participationDerived.get(episode.participation_id),
        participationFinals.get(episode.participation_id)?.final_position ?? null,
      )
      : null,
  };
}

// ─── Domain seams ──────────────────────────────────────────────────────────

export interface ChallengeReadDeps {
  groupMembershipAuthority: GroupMembershipAuthority;
}

/**
 * Challenges the caller is entitled to see: every challenge where the caller
 * holds any participation episode (own history, any status), plus every
 * challenge in a group where the caller is CURRENTLY eligible under live
 * authority (joinable/visible scope — no broad discovery is invented).
 */
export async function listVisibleChallenges(
  db: Db,
  memberId: string,
  deps: ChallengeReadDeps,
): Promise<ApiChallengeSummary[]> {
  if (!UUID_RE.test(memberId)) readFail(400, 'invalid_member', 'member must be a member UUID');
  const mine = await db.query<{ challenge_id: string }>(
    `SELECT DISTINCT challenge_id FROM challenge_participations WHERE member_id = $1`,
    [memberId],
  );
  const visible = new Set<string>(mine.rows.map((r) => String(r.challenge_id)));

  const shadowGroups = await db.query<{ group_id: string }>(
    `SELECT DISTINCT group_id FROM group_memberships
     WHERE member_id = $1 AND status IN ('joined', 'active')`,
    [memberId],
  );
  const eligibleGroups: string[] = [];
  for (const row of shadowGroups.rows) {
    const groupId = String(row.group_id);
    if (await liveEligibility(deps.groupMembershipAuthority, groupId, memberId)) {
      eligibleGroups.push(groupId);
    }
  }
  if (eligibleGroups.length > 0) {
    const inGroups = await db.query<{ challenge_id: string }>(
      `SELECT challenge_id FROM challenges WHERE ${inClause('group_id', eligibleGroups.length)}`,
      eligibleGroups,
    );
    for (const row of inGroups.rows) visible.add(String(row.challenge_id));
  }

  const ids = [...visible];
  const challenges = await fetchChallenges(db, ids);
  const episodesByChallenge = new Map<string, ParticipationRow[]>();
  const participationIds: string[] = [];
  for (const challengeId of ids) {
    const episodes = await listParticipations(db, challengeId, memberId);
    episodesByChallenge.set(challengeId, episodes);
    for (const episode of episodes) participationIds.push(episode.participation_id);
  }
  const [challengeDerived, participationDerived] = await Promise.all([
    fetchChallengeDerived(db, ids),
    fetchParticipationDerived(db, participationIds),
  ]);
  // EBC-04 frozen ranks for the displayed episodes (empty when unfinalized).
  const participationFinals = new Map<string, ParticipationFinalRow>();
  for (const challengeId of ids) {
    for (const [participationId, final] of await getParticipationFinals(db, challengeId)) {
      participationFinals.set(participationId, final);
    }
  }
  const summaries = await Promise.all(
    challenges.map((challenge) =>
      toSummary(challenge, challengeDerived, episodesByChallenge, participationDerived, participationFinals),
    ),
  );
  // A corrupt governing version fails the whole list closed (loud integrity
  // signal, never a silent skip); validate after assembly so ordering is stable.
  for (const challenge of challenges) {
    await getGoverningVersion(db, challenge.challenge_id, challenge.current_config_version);
  }
  summaries.sort((a, b) =>
    a.startDate < b.startDate ? 1 : a.startDate > b.startDate ? -1 : 0,
  );
  return summaries;
}

export async function getChallengeDetail(
  db: Db,
  memberId: string,
  challengeId: string,
  deps: ChallengeReadDeps,
): Promise<ApiChallengeDetail> {
  const challenge = await readChallenge(db, challengeId);
  const episodes = await requireChallengeVisible(db, challenge, memberId, deps.groupMembershipAuthority);
  // Governing truth loads fail-closed (C3A): a malformed persisted snapshot
  // rejects here rather than rendering unit-blind terms.
  const governing = await getGoverningVersion(db, challengeId, challenge.current_config_version);
  const activityKinds = await fetchActivityKinds(
    db,
    governing.activities.map((a) => a.knowledge_id),
  );
  const derivedMap = await fetchChallengeDerived(db, [challengeId]);
  const derived = derivedMap.get(challengeId) ?? zeroChallengeDerived(challenge);
  const episode = displayEpisode(episodes);
  const participationDerived = episode
    ? (await fetchParticipationDerived(db, [episode.participation_id])).get(episode.participation_id)
    : undefined;
  // EBC-04 frozen terminal result + frozen rank (absent when unfinalized).
  const finalization = await getChallengeFinal(db, challengeId);
  const finals = await getParticipationFinals(db, challengeId);
  const episodeFinal = episode ? finals.get(episode.participation_id) : undefined;
  return {
    challengeId: challenge.challenge_id,
    groupId: challenge.group_id,
    title: challenge.title,
    description: challenge.description,
    challengeType: challenge.challenge_type,
    status: challenge.status,
    startDate: challenge.start_date,
    endDate: challenge.end_date,
    timezone: challenge.timezone,
    finalized: challenge.finalized_at != null,
    currentConfigVersion: challenge.current_config_version,
    goalValue: challenge.goal_value,
    goalUnit: challenge.goal_unit,
    collectiveTotal: derived.collectiveTotal,
    collectiveGoalReached: derived.collectiveGoalReached,
    completionsCount: derived.completionsCount,
    myParticipation: episode
      ? toOwnParticipation(episode, participationDerived, episodeFinal?.final_position ?? null)
      : null,
    instructions: challenge.instructions,
    activatedAt: challenge.activated_at,
    endedAt: challenge.ended_at,
    finalizedAt: challenge.finalized_at,
    finalResult: finalization
      ? {
        finalizedAt: finalization.finalized_at,
        configVersion: finalization.config_version,
        finalizationVersion: finalization.finalization_version,
        engineVersion: finalization.engine_version,
        scoringVersion: finalization.scoring_version,
        result: { ...finalization.result },
      }
      : null,
    config: toConfigContract(governing.version, governing.snapshot, governing.activities, activityKinds),
  };
}

function toConfigContract(
  version: number,
  snapshot: GoverningSnapshot,
  activities: ActivityConfigRow[],
  activityKinds: Map<string, 'fitness' | 'wellness'>,
): ApiChallengeDetail['config'] {
  return {
    version,
    period: { startDate: snapshot.start_date, endDate: snapshot.end_date },
    timezone: snapshot.timezone,
    requiredConsecutiveDays: snapshot.required_consecutive_days,
    activities: activities.map((a) => {
      const kind = activityKinds.get(a.knowledge_id);
      // The pinned knowledge_id is FK-constrained to a knowledge_items row
      // whose kind is NOT NULL + CHECK(fitness|wellness). A missing kind is a
      // corrupt DB — fail closed rather than infer.
      if (kind !== 'fitness' && kind !== 'wellness') {
        readFail(500, 'activity_kind_missing', `no Knowledge kind for activity '${a.canonical_key}'`);
      }
      return {
        canonicalKey: a.canonical_key,
        activityVariant: a.activity_variant,
        activityKind: kind!,
        targetValue: a.target_value,
        unit: a.unit,
        position: a.position,
      };
    }),
  };
}

/**
 * Authoritative activity kind for each pinned Knowledge id (knowledge_items
 * kind is the domain truth for fitness vs wellness; never inferred from
 * canonical key, unit, title, prefix, category or route).
 */
async function fetchActivityKinds(
  db: Db,
  knowledgeIds: string[],
): Promise<Map<string, 'fitness' | 'wellness'>> {
  const out = new Map<string, 'fitness' | 'wellness'>();
  if (knowledgeIds.length === 0) return out;
  const result = await db.query(
    `SELECT knowledge_id, kind FROM knowledge_items WHERE ${inClause('knowledge_id', knowledgeIds.length)}`,
    knowledgeIds,
  );
  for (const row of result.rows as { knowledge_id: string; kind: string }[]) {
    out.set(String(row.knowledge_id), row.kind as 'fitness' | 'wellness');
  }
  return out;
}

export async function getChallengeLeaderboard(
  db: Db,
  memberId: string,
  challengeId: string,
  deps: ChallengeReadDeps,
): Promise<{ challengeId: string; challengeType: string; entries: ApiLeaderboardEntry[] }> {
  const challenge = await readChallenge(db, challengeId);
  await requireChallengeVisible(db, challenge, memberId, deps.groupMembershipAuthority);
  if (challenge.challenge_type !== 'competitive') {
    // No ranking semantics for streak (consistency, not order) or collective
    // (one shared pool, not positions).
    readFail(404, 'leaderboard_not_available', `No leaderboard for ${challenge.challenge_type} challenges`);
  }
  // Latest episode per member: history stays put, ranking reflects the
  // current episode of each participant.
  const latest = await db.query(
    `SELECT DISTINCT ON (member_id) * FROM challenge_participations
     WHERE challenge_id = $1
     ORDER BY member_id, joined_at DESC, participation_id DESC`,
    [challengeId],
  );
  const episodes = (latest.rows as never[]).map(normalizeParticipationRow);
  const derived = await fetchParticipationDerived(
    db,
    episodes.map((e) => e.participation_id),
  );
  // EBC-04: finalized Challenges serve frozen finishing positions so the
  // rank can never shift under read-time recalculation. Unfinalized
  // Challenges keep the live deterministic computation.
  const frozen = challenge.finalized_at != null
    ? await getParticipationFinals(db, challengeId)
    : new Map<string, ParticipationFinalRow>();
  const positions: Record<string, number | null> = {};
  if (challenge.finalized_at != null) {
    for (const episode of episodes) {
      positions[episode.participation_id] = frozen.get(episode.participation_id)?.final_position ?? null;
    }
  } else {
    const completions = episodes.map((episode) => {
      const row = derived.get(episode.participation_id);
      return {
        participation_id: episode.participation_id,
        completed_at: row?.completedAt ?? null,
      };
    });
    Object.assign(
      positions,
      computeFinishingPositions(completions, episodes.map((e) => e.participation_id)),
    );
  }
  const entries: ApiLeaderboardEntry[] = episodes.map((episode) => {
    const row = derived.get(episode.participation_id);
    const progress = toProgress(row ?? zeroParticipationDerived(episode));
    return {
      memberId: episode.member_id,
      participationId: episode.participation_id,
      totalPoints: progress.totalPoints,
      cumulativeTotal: progress.cumulativeTotal,
      logsAccepted: progress.logsAccepted,
      completionStatus: progress.completionStatus,
      completedAt: progress.completedAt,
      position: positions[episode.participation_id] ?? null,
    };
  });
  entries.sort((a, b) => {
    if (a.position != null || b.position != null) {
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      if (a.position !== b.position) return a.position - b.position;
    } else if (b.totalPoints !== a.totalPoints) {
      return b.totalPoints - a.totalPoints;
    }
    return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0;
  });
  return { challengeId, challengeType: challenge.challenge_type, entries };
}

// ─── HTTP routes ───────────────────────────────────────────────────────────

export interface ChallengeReadRouteDeps {
  groupMembershipAuthority?: GroupMembershipAuthority;
}

function missingAuthority(): GroupMembershipAuthority {
  return {
    async resolveGroupMembershipAuthority() {
      throw new Error('group membership authority is not configured');
    },
  };
}

export function registerChallengeReadRoutes(
  app: FastifyInstance,
  db: Db,
  deps: ChallengeReadRouteDeps = {},
): void {
  const authority = deps.groupMembershipAuthority ?? missingAuthority();
  const readDeps: ChallengeReadDeps = { groupMembershipAuthority: authority };

  app.get(
    '/v1/challenges',
    async (request) => {
      const member = authenticatedMember(request);
      return {
        memberId: member.memberId,
        challenges: await listVisibleChallenges(db, member.memberId, readDeps),
      };
    },
  );

  app.get(
    '/v1/challenges/:challengeId',
    {
      schema: {
        params: {
          type: 'object',
          required: ['challengeId'],
          properties: { challengeId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request) => {
      const member = authenticatedMember(request);
      const params = request.params as { challengeId: string };
      return getChallengeDetail(db, member.memberId, params.challengeId, readDeps);
    },
  );

  app.get(
    '/v1/challenges/:challengeId/leaderboard',
    {
      schema: {
        params: {
          type: 'object',
          required: ['challengeId'],
          properties: { challengeId: { type: 'string', format: 'uuid' } },
        },
      },
    },
    async (request) => {
      const member = authenticatedMember(request);
      const params = request.params as { challengeId: string };
      return getChallengeLeaderboard(db, member.memberId, params.challengeId, readDeps);
    },
  );
}
