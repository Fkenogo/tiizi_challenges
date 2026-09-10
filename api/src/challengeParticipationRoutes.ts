/**
 * Phase C3B V2 participation mutations — the minimum authenticated
 * Challenge-management surface the frontend needs.
 *
 * - POST /v1/challenges/:challengeId/join — open a participation episode;
 * - POST /v1/challenges/:challengeId/withdraw — close the caller's active
 *   episode (history preserved, never deleted).
 *
 * Both reuse the existing C2A domain seams (joinChallenge /
 * withdrawParticipation) with the injected LIVE Group-Membership authority —
 * the stale PG group_memberships shadow never authorizes. No Firestore
 * challengeMembers write exists anywhere on these paths (PG-only).
 * No rejoin restrictions beyond the C2A structure (one active episode per
 * pair; closed episodes never block a later one).
 *
 * No Firebase imports here (routes + injected authority only).
 */

import type { FastifyInstance } from 'fastify';
import { authenticatedMember } from './auth.js';
import { getChallenge } from './challenges.js';
import {
  getActiveParticipation,
  joinChallenge,
  withdrawParticipation,
  type ParticipationRow,
} from './challengeParticipations.js';
import type { Db } from './db.js';
import type { GroupMembershipAuthority } from './groupMembershipAuthority.js';

export class ParticipationRouteError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(statusCode: number, code: string, message: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

function routeFail(statusCode: number, code: string, message: string): never {
  throw new ParticipationRouteError(statusCode, code, message);
}

/**
 * Map C2A domain failures to HTTP semantics in ONE place (the domain seams
 * throw plain Errors by design). Unknown substrings stay 500.
 */
export function mapParticipationError(error: unknown): never {
  const message = (error as Error)?.message ?? 'Participation request failed';
  if (message.includes('unknown challenge')) {
    routeFail(404, 'unknown_challenge', 'Challenge not found');
  }
  if (
    message.includes('membership authority unreachable')
    || message.includes('authority is not configured')
  ) {
    routeFail(503, 'group_authority_unavailable', 'Group authority unreachable');
  }
  if (message.includes('no current Group Membership')) {
    routeFail(403, 'no_group_membership', 'Current Group Membership is required');
  }
  if (message.includes('an active participation episode already exists')) {
    routeFail(409, 'participation_exists', 'An active participation already exists');
  }
  if (message.includes('cannot join an ended challenge')) {
    routeFail(422, 'challenge_ended', 'Ended challenges cannot be joined');
  }
  if (message.includes('unknown participation') || message.includes('no active participation')) {
    routeFail(404, 'no_active_participation', 'No active participation for this Challenge');
  }
  if (message.includes('only active participations can withdraw')) {
    routeFail(409, 'participation_closed', 'Participation is already closed');
  }
  throw error;
}

function toParticipationResponse(episode: ParticipationRow) {
  return {
    participationId: episode.participation_id,
    challengeId: episode.challenge_id,
    memberId: episode.member_id,
    status: episode.status,
    joinedAt: episode.joined_at,
    joinedConfigVersion: episode.joined_config_version,
    exitedAt: episode.exited_at,
    exitReason: episode.exit_reason,
  };
}

export interface ParticipationRouteDeps {
  groupMembershipAuthority?: GroupMembershipAuthority;
}

function missingAuthority(): GroupMembershipAuthority {
  return {
    async resolveGroupMembershipAuthority() {
      throw new Error('group membership authority is not configured');
    },
  };
}

const challengeIdParamsSchema = {
  type: 'object',
  required: ['challengeId'],
  properties: { challengeId: { type: 'string', format: 'uuid' } },
} as const;

export function registerParticipationRoutes(
  app: FastifyInstance,
  db: Db,
  deps: ParticipationRouteDeps = {},
): void {
  const authority = deps.groupMembershipAuthority ?? missingAuthority();

  app.post(
    '/v1/challenges/:challengeId/join',
    { schema: { params: challengeIdParamsSchema } },
    async (request) => {
      const member = authenticatedMember(request);
      const params = request.params as { challengeId: string };
      try {
        // 404 when the Challenge does not exist (readChallenge throws).
        await getChallenge(db, params.challengeId);
        const episode = await joinChallenge(db, params.challengeId, member.memberId, authority);
        return toParticipationResponse(episode);
      } catch (error) {
        if (error instanceof ParticipationRouteError) throw error;
        mapParticipationError(error);
      }
    },
  );

  app.post(
    '/v1/challenges/:challengeId/withdraw',
    { schema: { params: challengeIdParamsSchema } },
    async (request) => {
      const member = authenticatedMember(request);
      const params = request.params as { challengeId: string };
      try {
        await getChallenge(db, params.challengeId);
        // Only the caller's OWN active episode can be closed.
        const active = await getActiveParticipation(db, params.challengeId, member.memberId);
        if (!active) {
          routeFail(404, 'no_active_participation', 'No active participation for this Challenge');
        }
        const closed = await withdrawParticipation(db, (active as ParticipationRow).participation_id);
        return toParticipationResponse(closed);
      } catch (error) {
        if (error instanceof ParticipationRouteError) throw error;
        mapParticipationError(error);
      }
    },
  );
}
