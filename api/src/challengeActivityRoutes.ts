/**
 * Phase C2B runtime route: POST /v1/challenges/:challengeId/activity.
 *
 * The narrow V2 transaction surface. Authenticated via the existing Tiizi
 * API auth adapter (the /v1/ onRequest hook populates request.member; the
 * member identity is server-derived, never taken from the client).
 *
 * The request carries ONLY legitimate client Evidence inputs. Points,
 * participation, config version and Derived Truth are server-derived; the
 * schema (additionalProperties: false) rejects them, and the domain seam
 * defensively rejects them again.
 *
 * No frontend integration. No Firestore activity writes (the Group
 * authority adapter is read-only).
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import {
  ApplicationError,
  applyChallengeActivity,
  type ApplyChallengeActivityResult,
} from './challengeActivityApplication.js';
import type { Db } from './db.js';
import type { GroupMembershipAuthority } from './groupMembershipAuthority.js';
import { createDbKnowledgeResolver } from './knowledgePins.js';

export interface ChallengeActivityRouteDeps {
  groupMembershipAuthority?: GroupMembershipAuthority;
}

function missingAuthority(): GroupMembershipAuthority {
  return {
    async resolveGroupMembershipAuthority() {
      throw new Error('group membership authority is not configured');
    },
  };
}

/**
 * Legitimate client Evidence inputs. Everything else — member identity,
 * participation, points, config version, Derived Truth — is server-derived
 * and rejected. Enforced here explicitly (allowlist) rather than relying
 * solely on schema additionalProperties, so the boundary holds regardless
 * of validator configuration; the domain seam re-checks defensively.
 */
const ALLOWED_BODY_FIELDS = new Set([
  'activity_kind',
  'canonical_key',
  'activity_variant',
  'value',
  'unit',
  'occurred_at',
  'occurred_day',
  'occurred_tz',
  'client_key',
]);

function rejectServerDerivedFields(body: Record<string, unknown>): void {
  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_FIELDS.has(key)) {
      throw new ApplicationError(
        400,
        'server_derived_field',
        `field '${key}' is server-derived and must not be supplied by the client`,
      );
    }
  }
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const REQUIRED_BODY_FIELDS = [
  'activity_kind',
  'canonical_key',
  'value',
  'unit',
  'occurred_at',
  'client_key',
];

function isValidBody(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  const body = data as Record<string, unknown>;
  for (const key of Object.keys(body)) {
    if (!ALLOWED_BODY_FIELDS.has(key)) return false;
  }
  for (const key of REQUIRED_BODY_FIELDS) {
    if (body[key] === undefined) return false;
  }
  if (body.activity_kind !== 'fitness' && body.activity_kind !== 'wellness') return false;
  if (typeof body.canonical_key !== 'string'
    || body.canonical_key.length < 1 || body.canonical_key.length > 200) return false;
  if (body.activity_variant !== undefined
    && (typeof body.activity_variant !== 'string'
      || body.activity_variant.length < 1 || body.activity_variant.length > 120)) return false;
  if (typeof body.value !== 'number') return false;
  if (typeof body.unit !== 'string' || body.unit.length < 1 || body.unit.length > 40) return false;
  if (typeof body.occurred_at !== 'string' || body.occurred_at.length < 1) return false;
  if (body.occurred_day !== undefined
    && (typeof body.occurred_day !== 'string' || body.occurred_day.length > 10)) return false;
  if (body.occurred_tz !== undefined
    && (typeof body.occurred_tz !== 'string' || body.occurred_tz.length > 60)) return false;
  if (typeof body.client_key !== 'string'
    || body.client_key.length < 1 || body.client_key.length > 300) return false;
  return true;
}

function isValidParams(data: unknown): boolean {
  if (typeof data !== 'object' || data === null) return false;
  return UUID_RE.test(String((data as Record<string, unknown>).challengeId ?? ''));
}

/**
 * Route-local validator. The runtime's default validator strips unknown
 * JSON properties instead of rejecting them, which would silently absorb
 * forged member/points/config/derived fields. This compiler rejects them
 * with a 400 before the handler runs; deeper value rules stay in the
 * domain seam (422s), and the JSON schema above remains the documented
 * contract. Returning false yields Fastify's 400 validation error.
 */
export function c2bValidatorCompiler({ httpPart }: { httpPart?: string }) {
  if (httpPart === 'body') return isValidBody;
  if (httpPart === 'params') return isValidParams;
  return () => true;
}

function toResponse(result: ApplyChallengeActivityResult) {
  return {
    recordId: result.record.record_id,
    eventId: result.record.event_id,
    participationId: result.record.participation_id,
    challengeId: result.record.challenge_id,
    activityConfigId: result.record.activity_config_id,
    configVersion: result.record.config_version,
    acceptedAt: result.record.accepted_at,
    occurredDay: result.record.occurred_day,
    value: result.record.value,
    unit: result.record.unit,
    pointsAwarded: result.record.points_awarded,
    scoringMethod: result.record.scoring_method,
    completionTriggered: result.record.completion_triggered,
    duplicate: result.duplicate,
    participation: {
      logsAccepted: result.participation.logsAccepted,
      distinctDays: result.participation.distinctDays,
      totalPoints: result.participation.totalPoints,
      completionRate: result.participation.completionRate,
      cumulativeTotal: result.participation.cumulativeTotal,
      currentStreak: result.participation.currentStreak,
      bestStreak: result.participation.bestStreak,
      daysCompleted: result.participation.daysCompleted,
      completionStatus: result.participation.completionStatus,
      completedAt: result.participation.completedAt,
    },
    challenge: {
      collectiveTotal: result.challenge.collectiveTotal,
      collectiveGoalReached: result.challenge.collectiveGoalReached,
      completionsCount: result.challenge.completionsCount,
    },
  };
}

export function registerChallengeActivityRoutes(
  app: FastifyInstance,
  db: Db,
  deps: ChallengeActivityRouteDeps = {},
): void {
  const authority = deps.groupMembershipAuthority ?? missingAuthority();
  app.post(
    '/v1/challenges/:challengeId/activity',
    {
      validatorCompiler: c2bValidatorCompiler,
      schema: {
        params: {
          type: 'object',
          required: ['challengeId'],
          properties: {
            challengeId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          additionalProperties: false,
          required: ['activity_kind', 'canonical_key', 'value', 'unit', 'occurred_at', 'client_key'],
          properties: {
            activity_kind: { type: 'string', enum: ['fitness', 'wellness'] },
            canonical_key: { type: 'string', minLength: 1, maxLength: 200 },
            activity_variant: { type: 'string', minLength: 1, maxLength: 120 },
            value: { type: 'number' },
            unit: { type: 'string', minLength: 1, maxLength: 40 },
            occurred_at: { type: 'string', minLength: 1 },
            occurred_day: { type: 'string', minLength: 1, maxLength: 10 },
            occurred_tz: { type: 'string', minLength: 1, maxLength: 60 },
            client_key: { type: 'string', minLength: 1, maxLength: 300 },
          },
        },
      },
    },
    async (request) => {
      const member = authenticatedMember(request);
      const params = request.params as { challengeId: string };
      const body = request.body as {
        activity_kind: 'fitness' | 'wellness';
        canonical_key: string;
        activity_variant?: string;
        value: number;
        unit: string;
        occurred_at: string;
        occurred_day?: string;
        occurred_tz?: string;
        client_key: string;
      };
      rejectServerDerivedFields(body as unknown as Record<string, unknown>);
      const occurredAt = new Date(body.occurred_at);
      if (Number.isNaN(occurredAt.getTime())) {
        throw new ApplicationError(422, 'invalid_occurred_at', 'occurred_at must be a valid timestamp');
      }
      const result = await applyChallengeActivity(db, member.memberId, params.challengeId, {
        activity_kind: body.activity_kind,
        canonical_key: body.canonical_key,
        activity_variant: body.activity_variant ?? null,
        value: body.value,
        unit: body.unit,
        occurred_at: occurredAt,
        occurred_day: body.occurred_day,
        occurred_tz: body.occurred_tz ?? null,
        client_key: body.client_key,
      }, {
        resolveKnowledgePin: createDbKnowledgeResolver(db, body.activity_kind),
        resolveGroupMembershipAuthority: authority.resolveGroupMembershipAuthority,
      });
      return toResponse(result);
    },
  );
}
