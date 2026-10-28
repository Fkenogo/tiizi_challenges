/**
 * TIIZI-FER-P1B-001 — member Interests and Goals.
 *
 * Authority: Member Completion Founder Disposition 001 §5 (FD-MC-04b..e) and
 * §17. Interests are the governed 12 Focus Area concepts, Goals the governed 9
 * Group Goal concepts, each held as a STABLE ID (never a label). They are
 * private, member-owned relevance preferences: they create NO eligibility,
 * access, membership, participation, scoring or visibility effect.
 *
 * Ownership: the actor is only the authenticated member (token → member map);
 * no request-supplied member id is accepted, and one member's preferences are
 * never readable by another member.
 *
 * P2 CONTRACT (preference read for ranking): `getMemberPreferenceIds(db,
 * memberId)` returns `{ interestIds, goalIds }`; `GET /api/me/preferences`
 * returns the same plus decided flags and the vocabulary. P2 may use the IDs
 * only to ORDER results the member is already authorized to discover; it must
 * never filter, hide or gate on them.
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember, type RequestMember } from './auth.js';
import { API_PREFIX } from './apiPrefix.js';
import type { Db } from './db.js';
import { GROUP_FOCUS_AREAS, GROUP_GOALS } from './groupVocabulary.js';

export const MAX_MEMBER_INTERESTS = 5;
export const MAX_MEMBER_GOALS = 3;

/**
 * Stable machine IDs for the 12 governed Focus Area concepts (Disposition
 * §5.3: application-owned, immutable once published; labels may evolve
 * without changing identity). Keyed by the governed label so a drift test can
 * prove this is NOT a competing vocabulary.
 */
const INTEREST_ID_BY_LABEL = {
  Strength: 'strength',
  'Cardio & Conditioning': 'cardio_conditioning',
  'Mobility & Flexibility': 'mobility_flexibility',
  'Balance & Stability': 'balance_stability',
  'Power, Speed & Agility': 'power_speed_agility',
  'Sports & Recreation': 'sports_recreation',
  'Sleep & Rest': 'sleep_rest',
  'Mind & Emotional Wellbeing': 'mind_emotional_wellbeing',
  'Nutrition & Hydration': 'nutrition_hydration',
  'Daily Living': 'daily_living',
  'Personal Growth': 'personal_growth',
  'Social Wellbeing': 'social_wellbeing',
} as const satisfies Record<(typeof GROUP_FOCUS_AREAS)[number]['label'], string>;

export interface InterestOption { id: string; label: string; domain: 'Fitness' | 'Wellness' }
export interface GoalOption { id: string; label: string }

export const MEMBER_INTEREST_OPTIONS: readonly InterestOption[] = GROUP_FOCUS_AREAS.map((area) => ({
  id: INTEREST_ID_BY_LABEL[area.label],
  label: area.label,
  domain: area.domain,
}));
export const MEMBER_GOAL_OPTIONS: readonly GoalOption[] = GROUP_GOALS.map(({ id, label }) => ({ id, label }));

const INTEREST_IDS = new Set<string>(MEMBER_INTEREST_OPTIONS.map((o) => o.id));
const GOAL_IDS = new Set<string>(MEMBER_GOAL_OPTIONS.map((o) => o.id));

export class InvalidPreferencesError extends Error {
  readonly statusCode = 400;
  constructor(readonly code: 'invalid_preferences' | 'unknown_preference_id' | 'preference_limit_exceeded', message: string) {
    super(message);
  }
}

export interface MemberPreferenceIds { interestIds: string[]; goalIds: string[] }

export interface MemberPreferencesState extends MemberPreferenceIds {
  /** False until the member has saved OR explicitly skipped that side. */
  interestsDecided: boolean;
  goalsDecided: boolean;
  limits: { interests: number; goals: number };
  vocabulary: { interests: readonly InterestOption[]; goals: readonly GoalOption[] };
}

interface ParsedChange { interestIds?: string[]; goalIds?: string[] }

function parseIds(
  value: unknown,
  field: string,
  allowed: Set<string>,
  max: number,
): string[] {
  if (!Array.isArray(value) || value.some((v) => typeof v !== 'string')) {
    throw new InvalidPreferencesError('invalid_preferences', `${field} must be an array of IDs`);
  }
  // Cheap bound before any set work: no valid request is longer than this.
  if (value.length > 64) {
    throw new InvalidPreferencesError('preference_limit_exceeded', `Choose at most ${max} ${field}`);
  }
  // Selection order is not meaningful: store a canonical (sorted) set so a
  // re-ordered repeat of the same selection is a true no-op.
  const unique = [...new Set(value as string[])].sort();
  const unknown = unique.find((id) => !allowed.has(id));
  if (unknown !== undefined) {
    throw new InvalidPreferencesError('unknown_preference_id', `Unknown ${field} ID`);
  }
  if (unique.length > max) {
    throw new InvalidPreferencesError('preference_limit_exceeded', `Choose at most ${max} ${field}`);
  }
  return unique;
}

/** Only `interestIds` and/or `goalIds` are accepted; an omitted side is left untouched. */
export function parsePreferenceChange(input: unknown): ParsedChange {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new InvalidPreferencesError('invalid_preferences', 'A preferences object is required');
  }
  const body = input as Record<string, unknown>;
  const keys = Object.keys(body);
  if (keys.length === 0 || keys.some((k) => k !== 'interestIds' && k !== 'goalIds')) {
    throw new InvalidPreferencesError('invalid_preferences', 'Only interestIds and goalIds may be set');
  }
  const change: ParsedChange = {};
  if (Object.hasOwn(body, 'interestIds')) {
    change.interestIds = parseIds(body.interestIds, 'interests', INTEREST_IDS, MAX_MEMBER_INTERESTS);
  }
  if (Object.hasOwn(body, 'goalIds')) {
    change.goalIds = parseIds(body.goalIds, 'goals', GOAL_IDS, MAX_MEMBER_GOALS);
  }
  return change;
}

interface Row {
  interest_ids: string[];
  goal_ids: string[];
  interests_decided_at: Date | string | null;
  goals_decided_at: Date | string | null;
}

function toState(row: Row | undefined): MemberPreferencesState {
  return {
    interestIds: row?.interest_ids ?? [],
    goalIds: row?.goal_ids ?? [],
    interestsDecided: !!row?.interests_decided_at,
    goalsDecided: !!row?.goals_decided_at,
    limits: { interests: MAX_MEMBER_INTERESTS, goals: MAX_MEMBER_GOALS },
    vocabulary: { interests: MEMBER_INTEREST_OPTIONS, goals: MEMBER_GOAL_OPTIONS },
  };
}

const COLUMNS = 'interest_ids, goal_ids, interests_decided_at, goals_decided_at';

/** Own-member read. No row means nothing decided yet (empty, undecided). */
export async function getMemberPreferences(db: Db, memberId: string): Promise<MemberPreferencesState> {
  const result = await db.query<Row>(`SELECT ${COLUMNS} FROM member_preferences WHERE member_id = $1`, [memberId]);
  return toState(result.rows[0]);
}

/** P2 read contract: the saved IDs only (ordering input, never a filter or gate). */
export async function getMemberPreferenceIds(db: Db, memberId: string): Promise<MemberPreferenceIds> {
  const { interestIds, goalIds } = await getMemberPreferences(db, memberId);
  return { interestIds, goalIds };
}

const sameSet = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/**
 * Replace the provided side(s) for the authenticated member. Idempotent: the
 * same request twice changes nothing and writes no second audit event. An
 * empty array is a valid selection (skip/clear) and records the decision.
 */
export async function setOwnMemberPreferences(
  db: Db,
  member: RequestMember,
  input: unknown,
): Promise<MemberPreferencesState> {
  const change = parsePreferenceChange(input);
  return db.transaction(async (tx) => {
    await tx.query(
      'INSERT INTO member_preferences (member_id) VALUES ($1) ON CONFLICT (member_id) DO NOTHING',
      [member.memberId],
    );
    const locked = await tx.query<Row>(
      `SELECT ${COLUMNS} FROM member_preferences WHERE member_id = $1 FOR UPDATE`,
      [member.memberId],
    );
    const current = locked.rows[0];
    const events: Array<{ field: 'interests' | 'goals'; old: string[]; next: string[]; decisionOnly: boolean }> = [];
    let nextInterests = current.interest_ids;
    let nextGoals = current.goal_ids;
    let decideInterests = false;
    let decideGoals = false;

    if (change.interestIds) {
      const decisionOnly = sameSet(change.interestIds, current.interest_ids);
      if (!decisionOnly || !current.interests_decided_at) {
        events.push({ field: 'interests', old: current.interest_ids, next: change.interestIds, decisionOnly });
        nextInterests = change.interestIds;
        decideInterests = !current.interests_decided_at;
      }
    }
    if (change.goalIds) {
      const decisionOnly = sameSet(change.goalIds, current.goal_ids);
      if (!decisionOnly || !current.goals_decided_at) {
        events.push({ field: 'goals', old: current.goal_ids, next: change.goalIds, decisionOnly });
        nextGoals = change.goalIds;
        decideGoals = !current.goals_decided_at;
      }
    }
    if (events.length === 0) return toState(current);

    for (const event of events) {
      await tx.query(
        `INSERT INTO member_preference_events
           (member_id, actor_member_id, field, old_ids, new_ids, decision_only)
         VALUES ($1, $1, $2, $3, $4, $5)`,
        [member.memberId, event.field, event.old, event.next, event.decisionOnly],
      );
    }
    const updated = await tx.query<Row>(
      `UPDATE member_preferences
          SET interest_ids = $2,
              goal_ids = $3,
              interests_decided_at = CASE WHEN $4 THEN clock_timestamp() ELSE interests_decided_at END,
              goals_decided_at = CASE WHEN $5 THEN clock_timestamp() ELSE goals_decided_at END,
              updated_at = clock_timestamp()
        WHERE member_id = $1
        RETURNING ${COLUMNS}`,
      [member.memberId, nextInterests, nextGoals, decideInterests, decideGoals],
    );
    return toState(updated.rows[0]);
  });
}

export function registerMemberPreferenceRoutes(app: FastifyInstance, db: Db): void {
  const path = `${API_PREFIX}/me/preferences`;

  app.get(path, async (request): Promise<MemberPreferencesState> => {
    const member = authenticatedMember(request);
    return getMemberPreferences(db, member.memberId);
  });

  app.put(path, async (request): Promise<MemberPreferencesState> => {
    const member = authenticatedMember(request);
    return setOwnMemberPreferences(db, member, request.body);
  });
}
