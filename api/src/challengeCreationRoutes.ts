/**
 * PF-03-CORR-001 governed V2 Challenge establishment route — the minimum
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
 *   allowMemberChallenges rule) is proven through the PostgreSQL-backed
 *   ChallengeCreationAuthority wired by the V2 runtime;
 * - semantic validation has ONE authority: validateChallengeDefinition
 *   (api/src/challengeDefinition.ts). Transport validation here checks
 *   JSON shape/types only; every meaning decision (identity, version
 *   currency, compatibility, Components, load basis, Duration mode,
 *   occurrence, window, type rules) is the validator's. There is no
 *   second semantic validator on this path;
 * - Activity identity is the immutable UUID/Code pin (never a display
 *   name); new definitions pin the CURRENT Activity version (stale
 *   versions reject; history stays read-only);
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
import { establishChallengeDefinitionV2 } from './challengeEstablishment.js';
import {
  validateChallengeDefinition,
  type ChallengeDefinitionInput,
} from './challengeDefinition.js';
import type {
  ChallengeCreationAuthority,
} from './challengeCreationAuthority.js';
import type {
  KnowledgeEligibility,
  KnowledgeEligibilityResolver,
} from './knowledgeEligibility.js';

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
  // PF-03-CORR-001: the single semantic authority speaks challenge-
  // definition. Every meaning rejection maps to 422 with the validator's
  // machine-readable message (codes in brackets).
  if (message.includes('challenge-definition:')) {
    routeFail(422, 'invalid_challenge_definition', message);
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
  pinsFor?: (
    kind: 'fitness' | 'wellness',
    key: string,
  ) => Promise<{ knowledge_id: string; current_version: number } | null>;
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
  'timezone',
  'temporal_conditions',
  'activities',
  'activate',
  'join_creator',
  'idempotency_key',
]);

const ALLOWED_ACTIVITY_FIELDS = new Set([
  'activity_kind',
  'canonical_key',
  'version',
  'activity_variant',
  'metric',
  'target_value',
  'unit',
  'component_ids',
  'load_basis',
  'duration_mode',
  'completion_occurrence',
  'position',
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
  // PF-03 transport shape (types only — every meaning decision belongs to
  // validateChallengeDefinition, the single semantic authority).
  if (activity.version !== undefined
    && (!Number.isInteger(activity.version) || (activity.version as number) < 1)) {
    return 'version must be an integer >= 1 when present (it must equal the current Activity version)';
  }
  if (activity.component_ids !== undefined
    && (!Array.isArray(activity.component_ids)
      || activity.component_ids.some((entry) => typeof entry !== 'string'))) {
    return 'component_ids must be an array of Component machine identifiers when present';
  }
  if (activity.load_basis !== undefined && typeof activity.load_basis !== 'string') {
    return 'load_basis must be a string when present';
  }
  if (activity.duration_mode !== undefined && typeof activity.duration_mode !== 'string') {
    return 'duration_mode must be a string when present';
  }
  if (activity.completion_occurrence !== undefined && typeof activity.completion_occurrence !== 'string') {
    return 'completion_occurrence must be a string when present';
  }
  if (activity.position !== undefined
    && (!Number.isInteger(activity.position) || (activity.position as number) < 0)) {
    return 'position must be an integer >= 0 when present';
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
  if (body.timezone !== undefined
    && (typeof body.timezone !== 'string' || body.timezone.length < 1 || body.timezone.length > 100)) {
    return 'timezone must be an IANA identifier string (1..100 chars) when present';
  }
  if (body.temporal_conditions !== undefined
    && (typeof body.temporal_conditions !== 'object'
      || body.temporal_conditions === null
      || Array.isArray(body.temporal_conditions))) {
    return 'temporal_conditions must be an object when present (at|before|after|within only)';
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
    version: { type: 'integer', minimum: 1 },
    activity_variant: { type: 'string', minLength: 1, maxLength: 120 },
    metric: { type: 'string', enum: METRICS },
    target_value: { type: 'number' },
    unit: { type: 'string', minLength: 1, maxLength: 40 },
    component_ids: { type: 'array', items: { type: 'string' } },
    load_basis: { type: 'string' },
    duration_mode: { type: 'string' },
    completion_occurrence: { type: 'string', maxLength: 500 },
    position: { type: 'integer', minimum: 0 },
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
    timezone: { type: 'string', minLength: 1, maxLength: 100 },
    temporal_conditions: { type: 'object' },
    activities: { type: 'array', minItems: 1, maxItems: 50, items: activitySchema },
    activate: { type: 'boolean' },
    join_creator: { type: 'boolean' },
    idempotency_key: { type: 'string', minLength: 1, maxLength: 100 },
  },
} as const;

interface RouteActivity {
  activity_kind: 'fitness' | 'wellness';
  canonical_key: string;
  version?: number;
  activity_variant?: string;
  metric: string;
  target_value: number;
  unit: string;
  component_ids?: string[];
  load_basis?: string;
  duration_mode?: string;
  completion_occurrence?: string;
  position?: number;
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
  timezone?: string;
  temporal_conditions?: Record<string, unknown>;
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
      try {
        // PF-03-CORR-001 deliberate transport mapping (snake_case route
        // naming retained; camelCase definition contract). Shape/types were
        // checked above; every meaning decision below belongs to
        // validateChallengeDefinition — the single semantic authority.
        const definitionInput: ChallengeDefinitionInput = {
          challengeType: body.challenge_type,
          title: body.title,
          ...(body.description !== undefined ? { description: body.description } : {}),
          ...(body.instructions !== undefined ? { instructions: body.instructions } : {}),
          startDate: body.start_date,
          endDate: body.end_date,
          ...(body.timezone !== undefined ? { timezone: body.timezone } : {}),
          ...(body.goal_value !== undefined ? { goalValue: body.goal_value } : {}),
          ...(body.goal_unit !== undefined ? { goalUnit: body.goal_unit } : {}),
          ...(body.required_consecutive_days !== undefined
            ? { requiredConsecutiveDays: body.required_consecutive_days }
            : {}),
          ...(body.reset_on_miss !== undefined ? { resetOnMiss: body.reset_on_miss } : {}),
          ...(body.temporal_conditions !== undefined
            ? { temporalConditions: body.temporal_conditions }
            : {}),
          activities: body.activities.map((activity) => ({
            activity: activity.canonical_key,
            ...(activity.version !== undefined ? { version: activity.version } : {}),
            ...(activity.activity_variant !== undefined
              ? { activityVariant: activity.activity_variant }
              : {}),
            metric: activity.metric,
            targetValue: activity.target_value,
            unit: activity.unit,
            ...(activity.component_ids !== undefined ? { componentIds: activity.component_ids } : {}),
            ...(activity.load_basis !== undefined ? { loadBasis: activity.load_basis } : {}),
            ...(activity.duration_mode !== undefined ? { durationMode: activity.duration_mode } : {}),
            ...(activity.completion_occurrence !== undefined
              ? { completionOccurrence: activity.completion_occurrence }
              : {}),
            ...(activity.position !== undefined ? { position: activity.position } : {}),
          })),
        };
        const normalized = await validateChallengeDefinition(db, definitionInput);
        // activity_kind is transport only: it must agree with Knowledge
        // truth (never override it). A mismatch rejects rather than
        // silently resolving a different domain.
        for (const [index, activity] of body.activities.entries()) {
          if (activity.activity_kind !== normalized.activities[index].kind) {
            routeFail(
              422,
              'invalid_challenge_definition',
              `challenge-definition: [activities[${index}]_kind_mismatch] activity_kind `
              + `'${activity.activity_kind}' does not match canonical Knowledge kind `
              + `'${normalized.activities[index].kind}' (kind is server truth, never client input)`,
            );
          }
        }
        const established = await establishChallengeDefinitionV2(
          db,
          {
            definition: normalized,
            groupId: body.group_id,
            creatorMemberId: member.memberId,
            activate: body.activate ?? false,
            joinCreator: body.join_creator ?? false,
            ...(body.idempotency_key !== undefined ? { idempotencyKey: body.idempotency_key } : {}),
          },
          {
            // Governed path: live Group authority only. Knowledge
            // resolution already happened inside validateChallengeDefinition
            // (server-side, current-version, fail-closed); the legacy
            // group-authority seams are unreachable here (creationAuthority
            // decides); they throw loudly if ever called.
            resolveKnowledgePin: async () => null,
            resolveKnowledgeEligibility: async () => null,
            resolveGroupAuthority: unusedAuthority,
            resolveGroupMembershipAuthority: unusedAuthority,
          },
          {
            creationAuthority: deps.creationAuthority!,
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
