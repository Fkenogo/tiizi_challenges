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
 * - GET /v1/challenges/:challengeId/contributors — collective only (S3c
 *   contribution visibility, NOT a leaderboard: no rank, no position,
 *   no ordering semantics beyond display convenience).
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
import { dayInTimezone } from './activityEvents.js';
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
  emptyChallengeState,
  emptyParticipationState,
  memberFinishingPositions,
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

/**
 * S3d — frozen per-participation final block, projected read-only from
 * `challenge_participation_finals` (the sealed authority). Null while the
 * Challenge is unfinalized. For Race this is the member's GOVERNING (earliest
 * completed) episode — the PR #41 member-identity result — while identity and
 * gating stay on the display episode. It is a projection of existing authority:
 * no recomputation, no schema, no second results authority.
 */
export interface ApiParticipationFinal {
  completed: boolean;
  completedAt: string | null;
  daysCompleted: number;
  bestStreak: number;
  /** Frozen terminal streak (challenge_participation_finals.final_streak). */
  finalStreak: number;
  /** Frozen standard-competition position; null for non-finishers and streaks. */
  finalPosition: number | null;
  finalizedAt: string;
}

export interface ApiOwnParticipation {
  participationId: string;
  status: 'active' | 'withdrawn' | 'removed';
  joinedAt: string;
  joinedConfigVersion: number;
  progress: ApiParticipationProgress;
  /** S3d — frozen final block (null while unfinalized). */
  final: ApiParticipationFinal | null;
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
  /**
   * S3c — server-authoritative governing Challenge day (YYYY-MM-DD in the
   * Challenge timezone at read time). The client may format this value but
   * must never determine the Challenge day from the device clock.
   */
  governingToday: string;
  /** S3c — server wall-clock instant (ISO) the governing day was derived from. */
  serverNow: string;
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
      /** Governing Metric of this configuration. Null ONLY on pre-PF-03 rows. */
      metric: string | null;
      targetValue: number;
      unit: string;
      position: number;
      /** PF-03 pinned required Component ids ([] when the Activity declares none). */
      requiredComponents: string[];
      /** PF-03 explicit Load Reporting Basis (Weight configurations only). */
      loadReportingBasis: string | null;
      /** PF-03 Duration mode (Duration configurations only). */
      durationMode: string | null;
      /** PF-03 Completion occurrence (Completion configurations only). */
      completionOccurrence: string | null;
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

/**
 * S3c — bounded collective contributor projection (Together / Collective
 * only). Contribution visibility, NOT a leaderboard: by design this shape
 * carries NO position, NO rank, NO winner and NO ordering semantics. Entry
 * order is display convenience only (largest contribution first) and must
 * never be presented as a placing.
 */
export interface ApiContributorEntry {
  memberId: string;
  /**
   * CORR-001: the member's current episode (active, else latest joined) —
   * identity for "You"/current-participation behaviour. History stays on
   * its original episodes internally; contributionTotal aggregates across
   * all of them.
   */
  participationId: string;
  participationStatus: 'active' | 'withdrawn' | 'removed';
  /**
   * CORR-001: authoritative cumulative accepted contribution (goal unit),
   * aggregated across ALL of the member's episodes of this Challenge.
   * Reconciles exactly with the canonical collectiveTotal.
   */
  contributionTotal: number;
  /**
   * Share of the current collective total (0..1, above 1 with overshoot);
   * null while the collective total is 0 (no share is defined yet).
   */
  share: number | null;
  logsAccepted: number;
}

export interface ApiChallengeContributors {
  challengeId: string;
  challengeType: 'collective';
  collectiveTotal: number;
  goalValue: number | null;
  goalUnit: string | null;
  contributors: ApiContributorEntry[];
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
 * Race competitive identity (Founder rule: one member = ONE competitive
 * participant per Race Challenge). A member who left and rejoined holds
 * several participation episodes; their competitive result is the one
 * governing episode — the EARLIEST completed episode (Stage F K.6/K.7:
 * position follows who reached the target first) — and null when no
 * episode completed. Read-only selection: history is never rewritten,
 * and the same rule the finalization computation applies
 * (`memberFinishingPositions`).
 */
function governingCompetitiveEpisode(
  episodes: ParticipationRow[],
  derived: Map<string, ParticipationDerivedRow>,
): ParticipationRow | null {
  let best: { episode: ParticipationRow; at: number } | null = null;
  for (const episode of episodes) {
    const row = derived.get(episode.participation_id);
    if (row?.completionStatus !== 'completed' || row.completedAt == null) continue;
    const at = Date.parse(row.completedAt);
    if (!Number.isFinite(at)) continue;
    if (
      !best
      || at < best.at
      || (at === best.at && episode.participation_id < best.episode.participation_id)
    ) best = { episode, at };
  }
  return best?.episode ?? null;
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
  final: ParticipationFinalRow | null | undefined = null,
): ApiOwnParticipation {
  return {
    participationId: episode.participation_id,
    status: episode.status,
    joinedAt: episode.joined_at,
    joinedConfigVersion: episode.joined_config_version,
    progress: toProgress(derived ?? zeroParticipationDerived(episode), final?.final_position ?? null),
    final: final ? toFinalBlock(final) : null,
  };
}

/**
 * S3d — project the sealed participation final row into the read contract.
 * Pure projection: every field is copied from frozen authority (never derived
 * from the live derived row, which for Streak can contradict `final_streak`).
 */
function toFinalBlock(final: ParticipationFinalRow): ApiParticipationFinal {
  return {
    completed: final.completed,
    completedAt: final.completed_at,
    daysCompleted: final.days_completed,
    bestStreak: final.best_streak,
    finalStreak: final.final_streak,
    finalPosition: final.final_position,
    finalizedAt: final.finalized_at,
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
  const episodes = episodesByChallenge.get(challenge.challenge_id) ?? [];
  const episode = displayEpisode(episodes);
  // Race: the member's result is their governing (earliest completed)
  // episode; identity/status/gating stay on the current display episode.
  const resultEpisode = (challenge.challenge_type === 'competitive' && episode
    ? governingCompetitiveEpisode(episodes, participationDerived)
    : null) ?? episode;
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
        participationDerived.get(resultEpisode!.participation_id),
        participationFinals.get(resultEpisode!.participation_id),
      )
      : null,
  };
}

// ─── Domain seams ──────────────────────────────────────────────────────────

export interface ChallengeReadDeps {
  groupMembershipAuthority: GroupMembershipAuthority;
  /**
   * S3c — acceptance clock for the server-authoritative governing day.
   * Production passes nothing (wall clock governs); tests drive time
   * explicitly for deterministic day-boundary proofs.
   */
  now?: Date;
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
  const ownDerived = await fetchParticipationDerived(db, episodes.map((e) => e.participation_id));
  // Race: the member's result comes from their governing (earliest
  // completed) episode; identity/status/gating stay on the display episode.
  const resultEpisode = (challenge.challenge_type === 'competitive' && episode
    ? governingCompetitiveEpisode(episodes, ownDerived)
    : null) ?? episode;
  const participationDerived = resultEpisode
    ? ownDerived.get(resultEpisode.participation_id)
    : undefined;
  // EBC-04 frozen terminal result + frozen rank (absent when unfinalized).
  const finalization = await getChallengeFinal(db, challengeId);
  const finals = await getParticipationFinals(db, challengeId);
  const episodeFinal = resultEpisode ? finals.get(resultEpisode.participation_id) : undefined;
  // S3c — server-authoritative governing day: derived from the server clock
  // in the Challenge timezone. The client formats this value; it never
  // determines the Challenge day from the device clock.
  const now = deps.now ?? new Date();
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
    governingToday: dayInTimezone(now, challenge.timezone),
    serverNow: now.toISOString(),
    finalized: challenge.finalized_at != null,
    currentConfigVersion: challenge.current_config_version,
    goalValue: challenge.goal_value,
    goalUnit: challenge.goal_unit,
    collectiveTotal: derived.collectiveTotal,
    collectiveGoalReached: derived.collectiveGoalReached,
    completionsCount: derived.completionsCount,
    myParticipation: episode
      ? toOwnParticipation(episode, participationDerived, episodeFinal)
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
        metric: a.metric,
        targetValue: a.target_value,
        unit: a.unit,
        position: a.position,
        requiredComponents: Array.isArray(a.required_components) ? [...a.required_components] : [],
        loadReportingBasis: a.load_reporting_basis,
        durationMode: a.duration_mode,
        completionOccurrence: a.completion_occurrence,
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
  // Competitive identity is the MEMBER (Founder rule): every episode is
  // read (history stays put), grouped per member, and each member appears
  // ONCE. The entry's participationId is the member's current episode
  // (active, else latest joined — "You"/current-participation identity);
  // completion, position and progress come from the member's governing
  // episode: the earliest completed one, else the current episode.
  const all = await db.query(
    `SELECT * FROM challenge_participations
     WHERE challenge_id = $1
     ORDER BY member_id, joined_at DESC, participation_id DESC`,
    [challengeId],
  );
  const episodes = (all.rows as never[]).map(normalizeParticipationRow);
  const derived = await fetchParticipationDerived(
    db,
    episodes.map((e) => e.participation_id),
  );
  // EBC-04: finalized Challenges serve frozen finishing positions so the
  // rank can never shift under read-time recalculation. Unfinalized
  // Challenges keep the live deterministic computation (same member-level
  // rule as finalization).
  const frozen = challenge.finalized_at != null
    ? await getParticipationFinals(db, challengeId)
    : new Map<string, ParticipationFinalRow>();
  const livePositions = challenge.finalized_at != null
    ? {}
    : memberFinishingPositions(
      episodes.map((episode) => {
        const row = derived.get(episode.participation_id);
        return {
          participation_id: episode.participation_id,
          member_id: episode.member_id,
          completed_at: row?.completionStatus === 'completed' ? row.completedAt : null,
        };
      }),
      episodes.map((e) => e.participation_id),
    );
  const episodesByMember = new Map<string, ParticipationRow[]>();
  for (const episode of episodes) {
    const group = episodesByMember.get(episode.member_id);
    if (group) group.push(episode);
    else episodesByMember.set(episode.member_id, [episode]);
  }
  const entries: ApiLeaderboardEntry[] = [...episodesByMember.values()].map((memberEpisodes) => {
    const current = memberEpisodes[0];
    const governing = governingCompetitiveEpisode(memberEpisodes, derived) ?? current;
    const row = derived.get(governing.participation_id);
    const progress = toProgress(row ?? zeroParticipationDerived(governing));
    const position = challenge.finalized_at != null
      ? (frozen.get(governing.participation_id)?.final_position ?? null)
      : (livePositions[governing.participation_id] ?? null);
    return {
      memberId: governing.member_id,
      participationId: current.participation_id,
      totalPoints: progress.totalPoints,
      cumulativeTotal: progress.cumulativeTotal,
      logsAccepted: progress.logsAccepted,
      completionStatus: progress.completionStatus,
      completedAt: progress.completedAt,
      position,
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

/**
  * S3c — bounded collective contributor projection (Together / Collective
 * only). CORR-001: contributor identity is MEMBER-level within the
 * Challenge. A member who leaves and rejoins holds several participation
 * episodes; every episode keeps its own history (records stay attached to
 * the episode that earned them — nothing is migrated or reassigned), but
 * the member's contributionTotal aggregates governed accepted
 * contribution across ALL of their episodes, so contributor totals
 * reconcile exactly with the canonical collectiveTotal. The exposed
 * participationId is the member's current episode (active when present,
 * else latest joined — the same display-episode rule as the detail read)
 * for "You"/current-participation behaviour. Contributions come ONLY
 * from governed participation Derived Truth; overshoot is preserved in
 * the shared total and therefore in shares. 404 for competitive/streak
 * (no share-of-total semantics there): competitive placement stays on
 * the leaderboard seam, streaks have no cross-member aggregation at all.
 */
export async function getChallengeContributors(
  db: Db,
  memberId: string,
  challengeId: string,
  deps: ChallengeReadDeps,
): Promise<ApiChallengeContributors> {
  const challenge = await readChallenge(db, challengeId);
  await requireChallengeVisible(db, challenge, memberId, deps.groupMembershipAuthority);
  if (challenge.challenge_type !== 'collective') {
    readFail(404, 'contributors_not_available', `No contributor rollup for ${challenge.challenge_type} challenges`);
  }
  const latest = await db.query(
    `SELECT * FROM challenge_participations
     WHERE challenge_id = $1
     ORDER BY member_id, joined_at DESC, participation_id DESC`,
    [challengeId],
  );
  const episodes = (latest.rows as never[]).map(normalizeParticipationRow);
  // CORR-001: group every episode by member. The member's contribution is
  // the exact sum of governed Derived Truth across their episodes; the
  // exposed identity is their current episode (active, else latest joined).
  const episodesByMember = new Map<string, ParticipationRow[]>();
  for (const episode of episodes) {
    const group = episodesByMember.get(episode.member_id);
    if (group) group.push(episode);
    else episodesByMember.set(episode.member_id, [episode]);
  }
  const derived = await fetchParticipationDerived(
    db,
    episodes.map((e) => e.participation_id),
  );
  const challengeDerived = await fetchChallengeDerived(db, [challengeId]);
  // A missing derived row means "no accepted activity yet" (zero-state).
  const total = challengeDerived.get(challengeId)?.collectiveTotal ?? 0;
  const contributors: ApiContributorEntry[] = [...episodesByMember].map(([member, memberEpisodes]) => {
    let contributionTotal = 0;
    let logsAccepted = 0;
    for (const episode of memberEpisodes) {
      const progress = toProgress(derived.get(episode.participation_id) ?? zeroParticipationDerived(episode));
      contributionTotal += progress.cumulativeTotal;
      logsAccepted += progress.logsAccepted;
    }
    // Current episode mirrors the detail display-episode rule (active when
    // present, else latest joined — episodes arrive latest-first).
    const current = memberEpisodes.find((e) => e.status === 'active') ?? memberEpisodes[0];
    return {
      memberId: member,
      participationId: current.participation_id,
      participationStatus: current.status,
      contributionTotal,
      share: total > 0 ? contributionTotal / total : null,
      logsAccepted,
    };
  });
  // Display convenience only (largest contribution first, stable by member):
  // carries no rank semantics — there is no position field by design.
  contributors.sort((a, b) => {
    if (b.contributionTotal !== a.contributionTotal) return b.contributionTotal - a.contributionTotal;
    return a.memberId < b.memberId ? -1 : a.memberId > b.memberId ? 1 : 0;
  });
  return {
    challengeId,
    challengeType: 'collective',
    collectiveTotal: total,
    goalValue: challenge.goal_value,
    goalUnit: challenge.goal_unit,
    contributors,
  };
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

  app.get(
    '/v1/challenges/:challengeId/contributors',
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
      return getChallengeContributors(db, member.memberId, params.challengeId, readDeps);
    },
  );
}
