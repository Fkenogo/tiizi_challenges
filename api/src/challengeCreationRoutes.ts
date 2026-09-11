/**
 * EBC-01 governed V2 Challenge establishment route — the minimum
 * API/domain boundary for governed V2 Challenge creation.
 *
 * - POST /v1/challenges — establish a V2 Challenge atomically.
 *
 * This is NOT the full PKG-1 creation wizard: one governed establishment
 * call carrying validated governing inputs, for later EBC-05 integration.
 *
 * Authority discipline (fail closed):
 * - the global /v1/ auth hook resolves the Bearer token to an internal
 *   Member UUID server-side; that UUID is the Challenge creator. The body
 *   carries NO actor/member identity (additionalProperties:false rejects
 *   smuggled created_by_member_id / knowledge ids / Firestore ids with 400);
 * - creation authority (live group + live membership + existing Charter
 *   allowMemberChallenges rule) is proven through the injected
 *   ChallengeCreationAuthority — the PG membership shadow cannot authorize;
 * - every activity proves establishment eligibility (published +
 *   non-grandfathered KCS-ready Knowledge) and the exact (Activity, Metric,
 *   Unit) governed tuple; raw IDs/strings bypass nothing because resolution
 *   is server-side from canonical_key + activity_kind;
 * - without the wired governed dependencies the route fails closed (503)
 *   instead of establishing;
 * - no Firestore Challenge write exists on this path (PG-only); no V1
 *   dual-write; no legacy V1 truth dependency.
 *
 * No Firebase imports here (routes + injected authority only).
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import type { Db } from './db.js';
import { establishChallengeV2 } from './challengeEstablishment.js';
import type {
  ChallengeCreationAuthority,
} from './challengeCreationAuthority.js';
import type { KnowledgeEligibility } from './knowledgeEligibility.js';
import type { NewChallengeInput } from './challenges.js';
import type { ActivityConfigInput } from './challengeConfigs.js';

export class ChallengeCreationRouteError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function routeFail(statusCode: number, code: string, message: string): never {
  throw new ChallengeCreationRouteError(statusCode, code, message);
}

/**
 * Map governed establishment failures to HTTP semantics in ONE place (the
 * domain seams throw plain Errors by design). Unknown substrings stay 500.
 */
export function mapChallengeCreationError(error: unknown): never {
  const message = (error as Error)?.message ?? 'Challenge creation failed';
  if (message.includes('creation authority unreachable')) {
    routeFail(503, 'group_authority_unavailable', 'Group authority unreachable');
  }
  if (message.includes('group is not available for challenge establishment')) {
    routeFail(404, 'unknown_group', 'Group not found under current Group authority');
  }
  if (message.includes('(group_inactive)')) {
    routeFail(422, 'group_inactive', 'Group is not active for Challenge establishment');
  }
  if (message.includes('(no_membership)')) {
    routeFail(403, 'no_group_membership', 'Current Group Membership is required');
  }
  if (message.includes('(membership_inactive)')) {
    routeFail(403, 'group_membership_inactive', 'Current Group Membership is required');
  }
  if (message.includes('(charter_restricted)')) {
    routeFail(403, 'challenge_creation_forbidden', 'Group Charter reserves Challenge creation to stewards');
  }
  if (message.includes('no current Group Membership')) {
    routeFail(403, 'no_group_membership', 'Current Group Membership is required');
  }
  if (message.includes('unknown, unpublished, or not KCS-ready Knowledge')) {
    routeFail(422, 'knowledge_not_eligible', message);
  }
  if (message.includes('knowledge-eligibility:')) {
    routeFail(422, 'incompatible_measurement', message);
  }
  if (message.includes('idempotency key was already used for a different establishment request')) {
    routeFail(409, 'idempotency_conflict', 'Idempotency key was already used for a different request');
  }
  if (
    message.includes('challenge-configs:')
    || message.includes('challenges:')
    || message.includes('unknown or unpublished Knowledge')
  ) {
    routeFail(422, 'invalid_challenge', message);
  }
  throw error;
}

export interface ChallengeCreationRouteDeps {
  creationAuthority?: ChallengeCreationAuthority;
  eligibilityFor?: (
    kind: 'fitness' | 'wellness',
    key: string,
  ) => Promise<KnowledgeEligibility | null>;
}

function unusedPin(): Promise<never> {
  throw new Error('challenge-creation-routes: pins derive from proven eligibility (unreachable)');
}

function unusedAuthority(): Promise<never> {
  throw new Error('challenge-creation-routes: authority resolves through the creation authority (unreachable)');
}

const DAY_PATTERN = '^\\d{4}-\\d{2}-\\d{2}$';
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const METRICS = ['completion', 'repetitions', 'duration', 'distance', 'weight', 'quantity'];
const CHALLENGE_TYPES = ['collective', 'competitive', 'streak'];

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Route-local body validator (same pattern as challengeActivityRoutes:
 * the runtime's default validator strips unknown JSON properties instead
 * of rejecting them, which would silently absorb forged actor/knowledge
 * fields). Unknown fields — including created_by_member_id, knowledge
 * ids, and Firestore ids — reject with a 400 before the handler runs;
 * deeper value rules stay in the domain seam (422s). The JSON schema
 * remains the documented contract.
 */
const ALLOWED_TOP_FIELDS = new Set([
  'group_id',
  'challenge_type',
  'title',
  'description',
  'instructions',
  'start_date',
  'end_date',
  'goal_value',
  'goal_unit',
  'required_consecutive_days',
  'reset_on_miss',
  'activities',
  'activate',
  'join_creator',
  'idempotency_key',
]);

const ALLOWED_ACTIVITY_FIELDS = new Set([
  'activity_kind',
  'canonical_key',
  'activity_variant',
  'metric',
  'target_value',
  'unit',
]);

type ValidatorResult = boolean | { error: Error };

/**
 * Fastify honors a custom validator's failure only through a thrown-free
 * `{ error }` result (a bare `false` without `.errors` passes silently —
 * verified against the installed Fastify). Every custom check below goes
 * through this wrapper so rejections always surface as 400s.
 */
function toValidator(check: (data: unknown) => string | null): (data: unknown) => ValidatorResult {
  return (data: unknown) => {
    const reason = check(data);
    return reason === null ? true : { error: new Error(reason) };
  };
}

function checkActivity(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'each activity must be an object';
  const activity = data as Record<string, unknown>;
  for (const key of Object.keys(activity)) {
    if (!ALLOWED_ACTIVITY_FIELDS.has(key)) {
      return `field '${key}' is server-derived and must not be supplied by the client`;
    }
  }
  if (activity.activity_kind !== 'fitness' && activity.activity_kind !== 'wellness') {
    return 'activity_kind must be fitness|wellness';
  }
  if (typeof activity.canonical_key !== 'string'
    || activity.canonical_key.length < 1 || activity.canonical_key.length > 200) {
    return 'canonical_key is required (1..200 chars)';
  }
  if (activity.activity_variant !== undefined
    && (typeof activity.activity_variant !== 'string'
      || activity.activity_variant.length < 1 || activity.activity_variant.length > 120)) {
    return 'activity_variant must be 1..120 chars when present';
  }
  if (typeof activity.metric !== 'string' || !METRICS.includes(activity.metric)) {
    return 'metric must be a canonical Metric (completion|repetitions|duration|distance|weight|quantity)';
  }
  if (typeof activity.target_value !== 'number') return 'target_value must be a number';
  if (typeof activity.unit !== 'string' || activity.unit.length < 1 || activity.unit.length > 40) {
    return 'unit is required (1..40 chars)';
  }
  return null;
}

function checkCreationBody(data: unknown): string | null {
  if (typeof data !== 'object' || data === null) return 'request body must be an object';
  const body = data as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_TOP_FIELDS.has(key)) {
      return `field '${key}' is server-derived and must not be supplied by the client`;
    }
  }
  if (typeof body.group_id !== 'string' || !UUID_RE.test(body.group_id)) {
    return 'group_id must be a Tiizi group UUID (never a Firestore document id)';
  }
  if (typeof body.challenge_type !== 'string' || !CHALLENGE_TYPES.includes(body.challenge_type)) {
    return 'challenge_type must be collective|competitive|streak';
  }
  if (typeof body.title !== 'string' || body.title.length < 1 || body.title.length > 200) {
    return 'title is required (1..200 chars)';
  }
  if (body.description !== undefined
    && (typeof body.description !== 'string' || body.description.length > 2000)) {
    return 'description must be a string up to 2000 chars when present';
  }
  if (body.instructions !== undefined
    && (typeof body.instructions !== 'string' || body.instructions.length > 2000)) {
    return 'instructions must be a string up to 2000 chars when present';
  }
  if (typeof body.start_date !== 'string' || !DAY_RE.test(body.start_date)) {
    return 'start_date must be YYYY-MM-DD';
  }
  if (typeof body.end_date !== 'string' || !DAY_RE.test(body.end_date)) return 'end_date must be YYYY-MM-DD';
  if (body.goal_value !== undefined && typeof body.goal_value !== 'number') {
    return 'goal_value must be a number when present';
  }
  if (body.goal_unit !== undefined
    && (typeof body.goal_unit !== 'string' || body.goal_unit.length < 1 || body.goal_unit.length > 40)) {
    return 'goal_unit must be 1..40 chars when present';
  }
  if (body.required_consecutive_days !== undefined
    && (!Number.isInteger(body.required_consecutive_days) || (body.required_consecutive_days as number) < 1)) {
    return 'required_consecutive_days must be an integer >= 1 when present';
  }
  if (body.reset_on_miss !== undefined && typeof body.reset_on_miss !== 'boolean') {
    return 'reset_on_miss must be boolean when present';
  }
  if (!Array.isArray(body.activities) || body.activities.length < 1 || body.activities.length > 50) {
    return 'activities must list 1..50 configured activities';
  }
  for (const [index, activity] of body.activities.entries()) {
    const reason = checkActivity(activity);
    if (reason !== null) return `activities[${index}]: ${reason}`;
  }
  if (body.activate !== undefined && typeof body.activate !== 'boolean') {
    return 'activate must be boolean when present';
  }
  if (body.join_creator !== undefined && typeof body.join_creator !== 'boolean') {
    return 'join_creator must be boolean when present';
  }
  if (body.idempotency_key !== undefined
    && (typeof body.idempotency_key !== 'string'
      || body.idempotency_key.length < 1 || body.idempotency_key.length > 100)) {
    return 'idempotency_key must be 1..100 chars when present';
  }
  return null;
}

export function challengeCreationValidatorCompiler({ httpPart }: { httpPart?: string }) {
  if (httpPart === 'body') return toValidator(checkCreationBody);
  return () => true;
}

const activitySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['activity_kind', 'canonical_key', 'metric', 'target_value', 'unit'],
  properties: {
    activity_kind: { type: 'string', enum: ['fitness', 'wellness'] },
    canonical_key: { type: 'string', minLength: 1, maxLength: 200 },
    activity_variant: { type: 'string', minLength: 1, maxLength: 120 },
    metric: { type: 'string', enum: METRICS },
    target_value: { type: 'number' },
    unit: { type: 'string', minLength: 1, maxLength: 40 },
  },
} as const;

const createBodySchema = {
  type: 'object',
  additionalProperties: false,
  required: ['group_id', 'challenge_type', 'title', 'start_date', 'end_date', 'activities'],
  properties: {
    group_id: { type: 'string', format: 'uuid' },
    challenge_type: { type: 'string', enum: ['collective', 'competitive', 'streak'] },
    title: { type: 'string', minLength: 1, maxLength: 200 },
    description: { type: 'string', maxLength: 2000 },
    instructions: { type: 'string', maxLength: 2000 },
    start_date: { type: 'string', pattern: DAY_PATTERN },
    end_date: { type: 'string', pattern: DAY_PATTERN },
    goal_value: { type: 'number' },
    goal_unit: { type: 'string', minLength: 1, maxLength: 40 },
    required_consecutive_days: { type: 'integer', minimum: 1 },
    reset_on_miss: { type: 'boolean' },
    activities: { type: 'array', minItems: 1, maxItems: 50, items: activitySchema },
    activate: { type: 'boolean' },
    join_creator: { type: 'boolean' },
    idempotency_key: { type: 'string', minLength: 1, maxLength: 100 },
  },
} as const;

interface RouteActivity {
  activity_kind: 'fitness' | 'wellness';
  canonical_key: string;
  activity_variant?: string;
  metric: string;
  target_value: number;
  unit: string;
}

interface RouteBody {
  group_id: string;
  challenge_type: 'collective' | 'competitive' | 'streak';
  title: string;
  description?: string;
  instructions?: string;
  start_date: string;
  end_date: string;
  goal_value?: number;
  goal_unit?: string;
  required_consecutive_days?: number;
  reset_on_miss?: boolean;
  activities: RouteActivity[];
  activate?: boolean;
  join_creator?: boolean;
  idempotency_key?: string;
}

export function registerChallengeCreationRoutes(
  app: FastifyInstance,
  db: Db,
  deps: ChallengeCreationRouteDeps = {},
): void {
  app.post(
    '/v1/challenges',
    {
      validatorCompiler: challengeCreationValidatorCompiler,
      schema: {
        body: createBodySchema,
        response: {
          200: creationResponseSchema(),
          201: creationResponseSchema(),
        },
      },
    },
    async (request, reply) => {
      const member = authenticatedMember(request);
      if (!deps.creationAuthority || !deps.eligibilityFor) {
        routeFail(503, 'creation_authority_unavailable', 'Challenge creation authority is not configured');
      }
      const body = request.body as RouteBody;
      const kindByKey = new Map<string, 'fitness' | 'wellness'>();
      for (const activity of body.activities) {
        kindByKey.set(activity.canonical_key, activity.activity_kind);
      }
      const eligibilityFor = deps.eligibilityFor!;
      try {
        const activities: ActivityConfigInput[] = body.activities.map((activity) => ({
          canonical_key: activity.canonical_key,
          activity_variant: activity.activity_variant ?? null,
          metric: activity.metric,
          target_value: activity.target_value,
          unit: activity.unit,
        }));
        const input: NewChallengeInput = {
          group_id: body.group_id,
          created_by_member_id: member.memberId,
          challenge_type: body.challenge_type,
          title: body.title,
          description: body.description,
          instructions: body.instructions,
          start_date: body.start_date,
          end_date: body.end_date,
          goal_value: body.goal_value,
          goal_unit: body.goal_unit,
          required_consecutive_days: body.required_consecutive_days,
          reset_on_miss: body.reset_on_miss,
          activities,
        };
        const established = await establishChallengeV2(
          db,
          {
            ...input,
            activate: body.activate ?? false,
            joinCreator: body.join_creator ?? false,
            ...(body.idempotency_key !== undefined ? { idempotencyKey: body.idempotency_key } : {}),
          },
          {
            // Governed path: authority + pins both derive from the proven
            // eligibility/creation authority. These legacy seams are
            // unreachable here; they throw loudly if ever called.
            resolveKnowledgePin: unusedPin,
            resolveGroupAuthority: unusedAuthority,
            resolveGroupMembershipAuthority: unusedAuthority,
          },
          {
            creationAuthority: deps.creationAuthority!,
            knowledgeEligibility: async (key: string) => {
              const kind = kindByKey.get(key);
              if (!kind) return null;
              return eligibilityFor(kind, key);
            },
          },
        );
        const response = {
          challengeId: established.challenge.challenge_id,
          groupId: established.challenge.group_id,
          status: established.challenge.status,
          configVersion: established.version.version,
          activated: established.activated,
          creatorParticipationId: established.creatorParticipationId,
          idempotentReplay: established.idempotentReplay,
        };
        return reply.status(established.idempotentReplay ? 200 : 201).send(response);
      } catch (error) {
        if (error instanceof ChallengeCreationRouteError) throw error;
        mapChallengeCreationError(error);
      }
    },
  );
}

function creationResponseSchema() {
  return {
    type: 'object',
    required: [
      'challengeId',
      'groupId',
      'status',
      'configVersion',
      'activated',
      'creatorParticipationId',
      'idempotentReplay',
    ],
    properties: {
      challengeId: { type: 'string', format: 'uuid' },
      groupId: { type: 'string', format: 'uuid' },
      status: { type: 'string' },
      configVersion: { type: 'integer', minimum: 1 },
      activated: { type: 'boolean' },
      creatorParticipationId: { type: ['string', 'null'], format: 'uuid' },
      idempotentReplay: { type: 'boolean' },
    },
  };
}
