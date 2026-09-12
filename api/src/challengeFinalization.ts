/**
 * Phase EBC-04 Challenge ending / finalization / authoritative rebuild.
 *
 * Settled lifecycle (Stage F FR-V2-111/FR-V2-112 + EBC-04):
 *
 *   ENDING        — ordinary activity acceptance stops. Occurs on collective
 *                   goal crossing (existing seam), window expiry (maintenance
 *                   seam below), or the governed manual endChallenge domain
 *                   operation. `status = 'ended'` keeps gating acceptance.
 *   FINALIZATION  — the authoritative terminal derived state is computed
 *                   ONCE from canonical accepted applications + immutable
 *                   pinned configs and frozen as historical truth
 *                   (`finalized_at` + immutable finals rows). Exactly-once
 *                   logically; repeated calls converge on the stored result.
 *
 *   status='ended' + finalized_at NULL  → ended, not yet finalized.
 *   status='ended' + finalized_at SET   → finalized (historical).
 *
 * No new lifecycle status exists; there is no reopen path. Streak
 * completion is a finalization-time terminal evaluation (reaching
 * requiredConsecutiveDays early never finishes a participant); competitive
 * finishing order freezes at finalization (standard competition ranking);
 * collective goal-crossing behavior is preserved and frozen.
 *
 * Source of truth for every computation here: challenge_activity_records
 * (effective = committed Evidence) + pinned config/version + participation
 * episodes. Rejected intents and raw Evidence never contribute. Replay and
 * rebuild share the same pure fold (derivedTruth), so parity holds by
 * construction.
 *
 * Finalized history is verify-only: rebuild on a finalized Challenge
 * recomputes and compares but never mutates. A governed repair mode does
 * not exist (ACT-04 correction remains deferred) and is refused loudly.
 *
 * No Firebase. No routes. No scheduler deployment — processExpiredChallenges
 * is the deterministic callable seam a later job/CLI invokes. Pure domain
 * + `Db`.
 */

import type { Db } from './db.js';
import { ApplicationError } from './challengeActivityApplication.js';
import { dayInTimezone } from './activityEvents.js';
import {
  getGoverningVersion,
  type GoverningSnapshot,
} from './challengeConfigs.js';
import {
  getChallenge,
  normalizeChallengeRow,
  type ChallengeRow,
} from './challenges.js';
import {
  computeFinishingPositions,
  DERIVED_ENGINE_VERSION,
  DERIVED_SCORING_VERSION,
  recomputeChallengeDerived,
  type ParticipationTruthState,
} from './derivedTruth.js';

/** Code version stamped on every finalization (provenance, never reinterpreted). */
export const FINALIZATION_VERSION = 'ebc04/v1';

function fail(statusCode: number, code: string, message: string): never {
  // ApplicationError (not a bare Error) so callers, routes, and CLIs map
  // these lifecycle failures to stable status codes deterministically.
  throw new ApplicationError(statusCode, code, message);
}

export interface ChallengeFinalRow {
  challenge_id: string;
  challenge_type: 'collective' | 'competitive' | 'streak';
  config_version: number;
  timezone: string;
  finalized_at: string;
  finalization_version: string;
  engine_version: string;
  scoring_version: string;
  result: Record<string, unknown>;
}

export interface ParticipationFinalRow {
  participation_id: string;
  challenge_id: string;
  member_id: string;
  completed: boolean;
  completed_at: string | null;
  days_completed: number;
  best_streak: number;
  final_streak: number;
  final_position: number | null;
  finalized_at: string;
}

function parseFinalResult(value: unknown): Record<string, unknown> {
  if (value == null) return {};
  if (typeof value === 'string') return JSON.parse(value) as Record<string, unknown>;
  return value as Record<string, unknown>;
}

export function normalizeChallengeFinal(row: Record<string, unknown>): ChallengeFinalRow {
  return {
    challenge_id: String(row.challenge_id),
    challenge_type: row.challenge_type as ChallengeFinalRow['challenge_type'],
    config_version: Number(row.config_version),
    timezone: String(row.timezone),
    finalized_at: new Date(row.finalized_at as string).toISOString(),
    finalization_version: String(row.finalization_version),
    engine_version: String(row.engine_version),
    scoring_version: String(row.scoring_version),
    result: parseFinalResult(row.result),
  };
}

export function normalizeParticipationFinal(row: Record<string, unknown>): ParticipationFinalRow {
  return {
    participation_id: String(row.participation_id),
    challenge_id: String(row.challenge_id),
    member_id: String(row.member_id),
    completed: Boolean(row.completed),
    completed_at: row.completed_at == null ? null : new Date(row.completed_at as string).toISOString(),
    days_completed: Number(row.days_completed ?? 0),
    best_streak: Number(row.best_streak ?? 0),
    final_streak: Number(row.final_streak ?? 0),
    final_position: row.final_position == null ? null : Number(row.final_position),
    finalized_at: new Date(row.finalized_at as string).toISOString(),
  };
}

/**
 * Authoritative period-end determination (Stage F FR-V2-111): the governing
 * window has expired when the Challenge-local day is past end_date. Uses
 * the pinned snapshot's period + timezone — never device time.
 */
export function isWindowExpired(snapshot: GoverningSnapshot, now: Date): boolean {
  return dayInTimezone(now, snapshot.timezone) > snapshot.end_date;
}

/** Terminal consecutive run ending ON the terminal Challenge day (streak). */
export function finalStreakAsOfTerminalDay(
  dayStates: Record<string, { complete: boolean }>,
  terminalDay: string,
): number {
  let run = 0;
  let day = terminalDay;
  for (;;) {
    if (dayStates[day]?.complete !== true) break;
    run += 1;
    day = previousDay(day);
  }
  return run;
}

function previousDay(day: string): string {
  const ms = Date.parse(`${day}T00:00:00Z`) - 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}

export interface TerminalEvaluation {
  /** Per-episode terminal outcome (keyed by participation_id). */
  episodes: Record<string, {
    completed: boolean;
    daysCompleted: number;
    bestStreak: number;
    finalStreak: number;
    finalPosition: number | null;
  }>;
  /** Challenge-level terminal payload (frozen into challenge_finalizations.result). */
  challengeResult: Record<string, unknown>;
  completionsCount: number;
}

/**
 * Pure terminal evaluation shared by finalization (persist) and
 * finalized-history verification (compare): same canonical inputs produce
 * the same terminal truth. `finalizedAt` stamps streak terminal completion
 * (first terminal write; never moves afterwards).
 */
export function evaluateTerminalTruth(
  snapshot: GoverningSnapshot,
  states: Record<string, ParticipationTruthState>,
  episodeIds: string[],
  finalizedAt: string,
): TerminalEvaluation {
  const episodes: TerminalEvaluation['episodes'] = {};
  if (snapshot.challenge_type === 'competitive') {
    const completions = episodeIds.map((id) => ({
      participation_id: id,
      completed_at: states[id]?.completionStatus === 'completed'
        ? states[id].completedAt
        : null,
    }));
    const positions = computeFinishingPositions(completions, episodeIds);
    for (const id of episodeIds) {
      const state = states[id];
      const completed = state?.completionStatus === 'completed';
      episodes[id] = {
        completed,
        daysCompleted: state?.daysCompleted ?? 0,
        bestStreak: state?.bestStreak ?? 0,
        finalStreak: state?.currentStreak ?? 0,
        finalPosition: completed ? (positions[id] ?? null) : null,
      };
    }
  } else if (snapshot.challenge_type === 'streak') {
    // Terminal completion is evaluated here — never during live logging:
    // the run that satisfies requiredConsecutiveDays counts wherever it
    // sits in history (bestStreak), and the freeze records it once.
    const required = snapshot.required_consecutive_days ?? 0;
    for (const id of episodeIds) {
      const state = states[id];
      const daysCompleted = state?.daysCompleted ?? 0;
      const bestStreak = state?.bestStreak ?? 0;
      const finalStreak = finalStreakAsOfTerminalDay(state?.dayStates ?? {}, snapshot.end_date);
      const completed = required > 0 && bestStreak >= required;
      episodes[id] = {
        completed,
        daysCompleted,
        bestStreak,
        finalStreak,
        finalPosition: null,
      };
    }
  } else {
    for (const id of episodeIds) {
      const state = states[id];
      episodes[id] = {
        completed: state?.completionStatus === 'completed',
        daysCompleted: state?.daysCompleted ?? 0,
        bestStreak: state?.bestStreak ?? 0,
        finalStreak: state?.currentStreak ?? 0,
        finalPosition: null,
      };
    }
  }
  const completionsCount = Object.values(episodes).filter((e) => e.completed).length;
  return { episodes, challengeResult: { completions_count: completionsCount }, completionsCount };
}

// ─── Reads (frozen history; fail closed on unknown challenges) ─────────────

export async function getChallengeFinal(
  db: Db,
  challengeId: string,
): Promise<ChallengeFinalRow | null> {
  const result = await db.query(
    `SELECT * FROM challenge_finalizations WHERE challenge_id = $1`,
    [challengeId],
  );
  if (result.rows.length === 0) return null;
  return normalizeChallengeFinal(result.rows[0] as Record<string, unknown>);
}

export async function getParticipationFinals(
  db: Db,
  challengeId: string,
): Promise<Map<string, ParticipationFinalRow>> {
  const out = new Map<string, ParticipationFinalRow>();
  const result = await db.query(
    `SELECT * FROM challenge_participation_finals WHERE challenge_id = $1`,
    [challengeId],
  );
  for (const row of result.rows as Record<string, unknown>[]) {
    const final = normalizeParticipationFinal(row);
    out.set(final.participation_id, final);
  }
  return out;
}

// ─── Ending + finalization (transactional; idempotent; race-safe) ──────────

export interface FinalizeResult {
  challenge: ChallengeRow;
  finalization: ChallengeFinalRow;
  participations: ParticipationFinalRow[];
  /** True when this call converged on an already-stored finalization. */
  alreadyFinalized: boolean;
  recordsReplayed: number;
}

async function lockChallengeRow(tx: Db, challengeId: string): Promise<ChallengeRow> {
  const locked = await tx.query(
    `SELECT * FROM challenges WHERE challenge_id = $1 FOR UPDATE`,
    [challengeId],
  );
  if (locked.rows.length === 0) fail(404, 'unknown_challenge', `unknown challenge ${challengeId}`);
  return normalizeChallengeRow(locked.rows[0] as never);
}

async function readFinalizationTx(tx: Db, challengeId: string): Promise<FinalizeResult | null> {
  const existing = await tx.query(
    `SELECT * FROM challenge_finalizations WHERE challenge_id = $1`,
    [challengeId],
  );
  if (existing.rows.length === 0) return null;
  const finalization = normalizeChallengeFinal(existing.rows[0] as Record<string, unknown>);
  const parts = await tx.query(
    `SELECT * FROM challenge_participation_finals WHERE challenge_id = $1
     ORDER BY participation_id ASC`,
    [challengeId],
  );
  const participations = (parts.rows as Record<string, unknown>[]).map(normalizeParticipationFinal);
  const challengeRow = await tx.query(
    `SELECT * FROM challenges WHERE challenge_id = $1`,
    [challengeId],
  );
  return {
    challenge: normalizeChallengeRow(challengeRow.rows[0] as never),
    finalization,
    participations,
    alreadyFinalized: true,
    recordsReplayed: -1,
  };
}

/**
 * Finalize one Challenge: end it when its window has expired, recompute the
 * canonical terminal truth, and freeze it — all in ONE transaction so no
 * half-finalized state can survive failure.
 *
 * Idempotent and race-safe: concurrent calls serialize on the challenge row
 * lock; UNIQUE finals rows plus NULL-guarded marker writes make exactly one
 * winner, and every caller converges on the stored finalization.
 */
export async function finalizeChallenge(
  db: Db,
  challengeId: string,
  now: Date = new Date(),
): Promise<FinalizeResult> {
  return db.transaction(async (tx) => {
    const fast = await readFinalizationTx(tx, challengeId);
    if (fast) return fast;
    let challenge = await lockChallengeRow(tx, challengeId);
    if (challenge.status !== 'ended') {
      if (challenge.status !== 'active') {
        fail(422, 'challenge_not_ended',
          `challenge cannot finalize from status '${challenge.status}' (only an ended challenge finalizes)`);
      }
      const governing = await getGoverningVersion(tx, challengeId, challenge.current_config_version);
      if (!isWindowExpired(governing.snapshot, now)) {
        fail(422, 'challenge_not_ended',
          'challenge window has not expired: only an ended (or expired) challenge finalizes');
      }
      const ended = await tx.query(
        `UPDATE challenges SET status = 'ended', ended_at = now(), updated_at = now()
         WHERE challenge_id = $1 AND status = 'active' RETURNING *`,
        [challengeId],
      );
      if (ended.rows.length === 0) {
        // Lost the race with a concurrent end: re-read and continue — the
        // finals-row convergence below decides the single winner.
        challenge = normalizeChallengeRow(
          (await tx.query(`SELECT * FROM challenges WHERE challenge_id = $1`, [challengeId])).rows[0] as never,
        );
      } else {
        challenge = normalizeChallengeRow(ended.rows[0] as never);
      }
    }
    if (challenge.finalized_at) {
      const raced = await readFinalizationTx(tx, challengeId);
      if (raced) return raced;
      fail(500, 'finalization_missing', 'challenge is marked finalized without stored finals rows');
    }

    const governing = await getGoverningVersion(tx, challengeId, challenge.current_config_version);
    const snapshot = governing.snapshot;
    const finalizedAt = now.toISOString();
    const recomputed = await recomputeChallengeDerived(tx, challengeId);
    const episodeRows = (
      await tx.query(
        `SELECT participation_id, member_id FROM challenge_participations WHERE challenge_id = $1`,
        [challengeId],
      )
    ).rows as { participation_id: unknown; member_id: unknown }[];
    const memberByParticipation = new Map(
      episodeRows.map((row) => [String(row.participation_id), String(row.member_id)]),
    );
    const episodeIds = [...memberByParticipation.keys()].sort();
    const terminal = evaluateTerminalTruth(snapshot, recomputed.participations, episodeIds, finalizedAt);

    // Challenge-level frozen payload: terminal aggregates. Collective
    // freezes its exact total (overshoot retained); every family freezes
    // its completions count.
    const challengeResult: Record<string, unknown> = {
      ...terminal.challengeResult,
    };
    if (snapshot.challenge_type === 'collective') {
      challengeResult.collective_total = recomputed.challenge.collectiveTotal;
      challengeResult.collective_goal_reached = recomputed.challenge.collectiveGoalReached;
      challengeResult.goal_completed_at = recomputed.challenge.goalCompletedAt;
    }

    await tx.query(
      `INSERT INTO challenge_finalizations
         (challenge_id, challenge_type, config_version, timezone, finalized_at,
          finalization_version, engine_version, scoring_version, result)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       ON CONFLICT (challenge_id) DO NOTHING`,
      [
        challengeId, snapshot.challenge_type, governing.version, snapshot.timezone, finalizedAt,
        FINALIZATION_VERSION, DERIVED_ENGINE_VERSION, DERIVED_SCORING_VERSION,
        JSON.stringify(challengeResult),
      ],
    );
    for (const id of episodeIds) {
      const outcome = terminal.episodes[id];
      await tx.query(
        `INSERT INTO challenge_participation_finals
           (participation_id, challenge_id, member_id, completed, completed_at,
            days_completed, best_streak, final_streak, final_position, finalized_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (participation_id) DO NOTHING`,
        [
          id, challengeId, memberByParticipation.get(id),
          outcome.completed, outcome.completed ? finalizedAt : null,
          outcome.daysCompleted, outcome.bestStreak, outcome.finalStreak,
          outcome.finalPosition, finalizedAt,
        ],
      );
      // Streak terminal completion lands on the live projection as the
      // single terminal transition (first-write-wins: only in_progress
      // rows flip, so concurrent winners converge and history never moves).
      // Competitive/collective completion already happened live.
      if (snapshot.challenge_type === 'streak' && outcome.completed) {
        await tx.query(
          `UPDATE challenge_participation_derived
           SET completion_status = 'completed', completed_at = $2, updated_at = now()
           WHERE participation_id = $1 AND completion_status = 'in_progress'`,
          [id, finalizedAt],
        );
      }
    }
    await tx.query(
      `UPDATE challenges SET finalized_at = $2, updated_at = now()
       WHERE challenge_id = $1 AND finalized_at IS NULL`,
      [challengeId, finalizedAt],
    );
    const stored = await readFinalizationTx(tx, challengeId);
    if (!stored) fail(500, 'finalization_missing', 'finalization writes did not persist');
    const done = stored as FinalizeResult;
    done.alreadyFinalized = false;
    done.recordsReplayed = recomputed.recordsReplayed;
    const refreshed = await tx.query(
      `SELECT * FROM challenges WHERE challenge_id = $1`,
      [challengeId],
    );
    done.challenge = normalizeChallengeRow(refreshed.rows[0] as never);
    return done;
  });
}

export interface ExpiredProcessingOutcome {
  challenge_id: string;
  expired: boolean;
  ended: boolean;
  finalized: boolean;
  alreadyFinalized: boolean;
}

/**
 * Scheduled-ending seam (EBC-04 §6): end + finalize every active Challenge
 * whose governing window has expired — without requiring any future
 * participant activity. Deterministic for a given `now`; each Challenge
 * finalizes in its own transaction so one failure never blocks the rest.
 * No scheduler is deployed here: this is the callable seam a later job
 * invokes.
 */
export async function processExpiredChallenges(
  db: Db,
  now: Date = new Date(),
): Promise<ExpiredProcessingOutcome[]> {
  const active = await db.query<{
    challenge_id: unknown;
    end_date: string | Date;
    timezone: unknown;
  }>(
    `SELECT challenge_id, end_date, timezone FROM challenges WHERE status = 'active'`,
  );
  const outcomes: ExpiredProcessingOutcome[] = [];
  for (const row of active.rows) {
    const challengeId = String(row.challenge_id);
    const endDate = row.end_date instanceof Date
      ? row.end_date.toISOString().slice(0, 10)
      : String(row.end_date).slice(0, 10);
    const timezone = row.timezone == null ? 'UTC' : String(row.timezone);
    let expired: boolean;
    try {
      expired = dayInTimezone(now, timezone) > endDate;
    } catch {
      // Unreadable timezone config fails closed for this Challenge only;
      // the seam continues with the remaining Challenges.
      outcomes.push({ challenge_id: challengeId, expired: false, ended: false, finalized: false, alreadyFinalized: false });
      continue;
    }
    if (!expired) {
      outcomes.push({ challenge_id: challengeId, expired: false, ended: false, finalized: false, alreadyFinalized: false });
      continue;
    }
    try {
      const result = await finalizeChallenge(db, challengeId, now);
      const challenge = await getChallenge(db, challengeId);
      outcomes.push({
        challenge_id: challengeId,
        expired: true,
        ended: challenge.status === 'ended',
        finalized: result.finalization != null,
        alreadyFinalized: result.alreadyFinalized,
      });
    } catch {
      outcomes.push({ challenge_id: challengeId, expired: true, ended: false, finalized: false, alreadyFinalized: false });
    }
  }
  return outcomes;
}

// ─── Authoritative rebuild ─────────────────────────────────────────────────

export interface RebuildOptions {
  /**
   * Request a governed repair of FINALIZED history. No such authority
   * exists (ACT-04 correction remains deferred): the request is refused
   * loudly and nothing mutates. Present so callers cannot silently assume
   * a repair happened.
   */
  repairFinalized?: boolean;
}

export interface RebuildResult {
  mode: 'rebuild' | 'verify';
  recordsReplayed: number;
  /** Episodes whose persisted projection was rewritten (rebuild mode). */
  participationsPersisted: number;
  /** Finalized-history verification outcome (verify mode). */
  verified?: boolean;
  /** Human-readable divergences when verification fails (verify mode). */
  mismatches?: string[];
}

/**
 * Authoritative persisted rebuild: recompute derived truth from canonical
 * accepted applications + pinned versions and persist it, repairing stale
 * or corrupt live projections. Deterministic: same canonical inputs
 * produce the same result. Never fabricates activity, never reinterprets
 * records under the current config (each record replays under its pinned
 * version inside recomputeChallengeDerived).
 *
 * Finalized Challenges are verify-only: the recomputed terminal truth is
 * compared against the frozen rows and reported, never written.
 */
export async function rebuildChallengeDerived(
  db: Db,
  challengeId: string,
  options: RebuildOptions = {},
): Promise<RebuildResult> {
  const challenge = await getChallenge(db, challengeId).catch(() => {
    fail(404, 'unknown_challenge', `unknown challenge ${challengeId}`);
  });
  if (challenge.finalized_at) {
    if (options.repairFinalized) {
      fail(422, 'finalized_repair_not_authorized',
        'finalized history is immutable: no governed repair authority exists (ACT-04 correction remains deferred)');
    }
    return verifyFinalizedHistory(db, challengeId);
  }
  const recomputed = await recomputeChallengeDerived(db, challengeId);
  let persisted = 0;
  await db.transaction(async (tx) => {
    for (const [participationId, state] of Object.entries(recomputed.participations)) {
      const head = await tx.query(
        `SELECT participation_id, challenge_id, member_id FROM challenge_participations WHERE participation_id = $1`,
        [participationId],
      );
      if (head.rows.length === 0) continue;
      const episode = head.rows[0] as { challenge_id: unknown; member_id: unknown };
      await tx.query(
        `INSERT INTO challenge_participation_derived
           (participation_id, challenge_id, member_id, scoring_version)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (participation_id) DO NOTHING`,
        [participationId, String(episode.challenge_id), String(episode.member_id), DERIVED_SCORING_VERSION],
      );
      await tx.query(
        `UPDATE challenge_participation_derived
         SET logs_accepted = $2, distinct_days = $3, total_points = $4,
             completion_rate = $5, cumulative_values = $6, cumulative_total = $7,
             current_streak = $8, best_streak = $9, last_completed_day = $10,
             day_states = $11, days_completed = $12,
             completion_status = $13, completed_at = $14, updated_at = now()
         WHERE participation_id = $1`,
        [
          participationId,
          state.logsAccepted, state.distinctDays, state.totalPoints,
          state.completionRate, JSON.stringify(state.cumulativeValues), state.cumulativeTotal,
          state.currentStreak, state.bestStreak, state.lastCompletedDay,
          JSON.stringify(state.dayStates), state.daysCompleted,
          state.completionStatus, state.completedAt,
        ],
      );
      persisted += 1;
    }
    await tx.query(
      `INSERT INTO challenge_derived_state (challenge_id, challenge_type, scoring_version)
       VALUES ($1, $2, $3)
       ON CONFLICT (challenge_id) DO NOTHING`,
      [challengeId, challenge.challenge_type, DERIVED_SCORING_VERSION],
    );
    await tx.query(
      `UPDATE challenge_derived_state
       SET collective_total = $2, collective_goal_reached = $3,
           goal_completed_at = $4, completions_count = $5, updated_at = now()
       WHERE challenge_id = $1`,
      [
        challengeId,
        recomputed.challenge.collectiveTotal, recomputed.challenge.collectiveGoalReached,
        recomputed.challenge.goalCompletedAt, recomputed.challenge.completionsCount,
      ],
    );
  });
  return { mode: 'rebuild', recordsReplayed: recomputed.recordsReplayed, participationsPersisted: persisted };
}

/**
 * Verify-only pass over finalized history: re-evaluate the terminal truth
 * from canonical inputs with the same pure function finalization used, and
 * compare field-by-field against the frozen rows. Reports divergences;
 * never writes.
 */
async function verifyFinalizedHistory(db: Db, challengeId: string): Promise<RebuildResult> {
  const finalization = await getChallengeFinal(db, challengeId);
  if (!finalization) {
    fail(500, 'finalization_missing', 'challenge is marked finalized without stored finals rows');
  }
  const finals = finalization as ChallengeFinalRow;
  const episodeFinals = await getParticipationFinals(db, challengeId);
  const governing = await getGoverningVersion(db, challengeId, finals.config_version);
  const recomputed = await recomputeChallengeDerived(db, challengeId);
  const episodeIds = [...episodeFinals.keys()].sort();
  const terminal = evaluateTerminalTruth(
    governing.snapshot, recomputed.participations, episodeIds, finals.finalized_at,
  );
  const mismatches: string[] = [];
  const result = finals.result;
  if (Number(result.completions_count ?? -1) !== terminal.completionsCount) {
    mismatches.push(
      `completions_count frozen=${String(result.completions_count)} recomputed=${terminal.completionsCount}`,
    );
  }
  if (finals.challenge_type === 'collective') {
    if (Number(result.collective_total ?? -1) !== recomputed.challenge.collectiveTotal) {
      mismatches.push(
        `collective_total frozen=${String(result.collective_total)} recomputed=${recomputed.challenge.collectiveTotal}`,
      );
    }
    if (Boolean(result.collective_goal_reached) !== recomputed.challenge.collectiveGoalReached) {
      mismatches.push('collective_goal_reached diverges from recomputed truth');
    }
  }
  for (const id of episodeIds) {
    const frozen = episodeFinals.get(id);
    const outcome = terminal.episodes[id];
    if (!frozen || !outcome) {
      mismatches.push(`episode ${id} missing on one side of the comparison`);
      continue;
    }
    const sameCompletedAt = (frozen.completed_at == null && !outcome.completed)
      || (frozen.completed_at != null && outcome.completed
        && frozen.completed_at === finals.finalized_at);
    if (frozen.completed !== outcome.completed || !sameCompletedAt) {
      mismatches.push(`episode ${id} completion diverges (frozen=${frozen.completed})`);
    }
    if (frozen.days_completed !== outcome.daysCompleted
      || frozen.best_streak !== outcome.bestStreak
      || frozen.final_streak !== outcome.finalStreak) {
      mismatches.push(
        `episode ${id} streak counters diverge `
        + `(frozen=${frozen.days_completed}/${frozen.best_streak}/${frozen.final_streak} `
        + `recomputed=${outcome.daysCompleted}/${outcome.bestStreak}/${outcome.finalStreak})`,
      );
    }
    if ((frozen.final_position ?? null) !== outcome.finalPosition) {
      mismatches.push(`episode ${id} final position diverges (frozen=${String(frozen.final_position)})`);
    }
  }
  return {
    mode: 'verify',
    recordsReplayed: recomputed.recordsReplayed,
    participationsPersisted: 0,
    verified: mismatches.length === 0,
    mismatches,
  };
}
