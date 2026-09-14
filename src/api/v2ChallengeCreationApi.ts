/**
 * PF-05 V2 Challenge Creation API seam (frontend).
 *
 * Bounded client functions for the V2 Creation Wizard:
 * - canonical published Activity listing (identity + display fields);
 * - per-Activity Composer options (GET /v1/knowledge/:id/options);
 * - Composer draft preview (POST /v1/challenge-definitions/preview);
 * - governed establishment (POST /v1/challenges).
 *
 * No server semantics are duplicated here: option lists and validation
 * verdicts come from the API; client-side guards are UX only and the
 * server remains the authority. No Firebase/Firestore calls. No V1
 * Template services. No V1 Exercise/Wellness catalogue services.
 */

import { apiFetch, ApiError } from './apiClient';
import { resolveLegacyGroupId, resolveTiiziGroupId } from './groupIdentityBridge';
import { isV2ChallengeId } from './v2ChallengeMode';
import {
  definitionToRouteBody as mapDefinitionToRouteBody,
  DURATION_MODE_DESCRIPTIONS,
  DURATION_MODE_LABELS,
  loadBasisLabel as basisLabel,
  LOAD_BASIS_DESCRIPTIONS,
  LOAD_BASIS_LABELS,
} from './v2ChallengeCreationMapping.js';

export {
  mapDefinitionToRouteBody,
  DURATION_MODE_DESCRIPTIONS,
  DURATION_MODE_LABELS,
  basisLabel as loadBasisLabel,
  LOAD_BASIS_DESCRIPTIONS,
  LOAD_BASIS_LABELS,
};

export interface V2PublishedActivity {
  id: string;
  activityCode: string | null;
  name: string;
  kind: 'fitness' | 'wellness';
  category: string;
  knowledgeVersion: number;
}

export interface V2ActivityComponentOption {
  componentId: string;
  displayName: string;
  relationship: string;
}

export interface V2ActivityOptions {
  knowledgeId: string;
  activityCode: string | null;
  kind: 'fitness' | 'wellness';
  currentVersion: number;
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
  components: V2ActivityComponentOption[];
  supportedLoadBases: string[];
}

export interface V2PreviewIssue {
  code: string;
  field?: string;
  stage?: string;
  activityIndex?: number;
  message: string;
}

export type V2PreviewResult =
  | { ok: true; definition: V2NormalizedDefinition }
  | { ok: false; issues: V2PreviewIssue[] };

export interface V2NormalizedDefinitionActivity {
  canonicalKey: string;
  knowledgeId: string;
  activityCode: string | null;
  knowledgeVersion: number;
  kind: 'fitness' | 'wellness';
  metric: string;
  unit: string;
  targetValue: number;
  requiredComponents: string[];
  componentRelationship: 'ALL_REQUIRED' | null;
  loadReportingBasis: string | null;
  durationMode: 'CONTINUOUS' | 'ACCUMULATED' | null;
  completionOccurrence: string | null;
  position: number;
  activityVariant: string | null;
}

export interface V2NormalizedDefinition {
  definitionKind: 'pf03-v1';
  challengeType: 'collective' | 'competitive' | 'streak';
  title: string;
  description: string;
  instructions: string;
  window: { startDate: string; endDate: string; timezone: string };
  temporalConditions: {
    at: string | null;
    before: string | null;
    after: string | null;
    within: { start: string; end: string } | null;
  } | null;
  goalValue: number | null;
  goalUnit: string | null;
  requiredConsecutiveDays: number | null;
  resetOnMiss: boolean;
  cadence: 'DAILY' | null;
  activities: V2NormalizedDefinitionActivity[];
}

export interface V2EstablishResponse {
  challengeId: string;
  groupId: string;
  status: string;
  configVersion: number;
  activated: boolean;
  creatorParticipationId: string | null;
  idempotentReplay: boolean;
}

interface KnowledgeListResponse {
  items: Array<{
    id: string;
    activityCode?: string | null;
    name: string;
    kind: 'fitness' | 'wellness';
    category: string;
    knowledgeVersion: number;
  }>;
}

/** Canonical published Activities for Wizard selection (both domains).
 *
 * Composer-selectable candidates only (composerSelectable): published V2
 * Activities with an immutable code, current readiness and a governed
 * contract. Legacy/draft/retired/KCS-thin/codeless Knowledge never
 * appears here — that quarantine is server-owned.
 */
export async function fetchV2PublishedActivities(
  search?: string,
): Promise<V2PublishedActivity[]> {
  const kinds = ['fitness', 'wellness'] as const;
  const lists = await Promise.all(
    kinds.map(async (kind) => {
      const query = new URLSearchParams({ kind, composerSelectable: 'true' });
      if (search && search.trim().length > 0) query.set('search', search.trim());
      const response = await apiFetch<KnowledgeListResponse>(
        `/v1/knowledge?${query.toString()}`,
      );
      return response.items;
    }),
  );
  return lists.flat().map((item) => ({
    id: item.id,
    activityCode: item.activityCode ?? null,
    name: item.name,
    kind: item.kind,
    category: item.category,
    knowledgeVersion: item.knowledgeVersion,
  }));
}

/** Valid Composer choices for one Activity (server-derived, never hard-coded). */
export function fetchV2ActivityOptions(knowledgeId: string): Promise<V2ActivityOptions> {
  return apiFetch<V2ActivityOptions>(
    `/v1/knowledge/${encodeURIComponent(knowledgeId)}/options`,
  );
}

/** Server preview of a Composer draft (writes nothing).
 *
 * The preview seam answers 422 with structured {ok:false, issues} when the
 * draft is incomplete or semantically invalid. apiFetch surfaces non-2xx
 * as ApiError, so a 422 preview body is converted back into the
 * V2PreviewResult here — the Wizard always receives structured issues,
 * never a bare transport error.
 */
export async function previewV2Draft(draft: unknown): Promise<V2PreviewResult> {
  try {
    return await apiFetch<V2PreviewResult>('/v1/challenge-definitions/preview', {
      method: 'POST',
      body: draft,
    });
  } catch (error) {
    if (error instanceof ApiError && error.status === 422) {
      const body = error.body as { ok?: unknown; issues?: V2PreviewIssue[] } | undefined;
      if (body && body.ok === false && Array.isArray(body.issues)) {
        return { ok: false, issues: body.issues };
      }
    }
    throw error;
  }
}

/**
 * Deliberate mapping: normalized PF-03 definition → existing PF-03 route
 * transport shape. Pure behavior lives in v2ChallengeCreationMapping
 * (import-free for guard suites); re-exported here for one import surface.
 */
export function definitionToRouteBody(
  definition: V2NormalizedDefinition,
  groupId: string,
  opts?: { activate?: boolean; joinCreator?: boolean; idempotencyKey?: string },
): Record<string, unknown> {
  return mapDefinitionToRouteBody(definition, groupId, opts);
}

/** Governed establishment through the existing V2 route (PG truth). */
export function establishV2Challenge(body: Record<string, unknown>): Promise<V2EstablishResponse> {
  return apiFetch<V2EstablishResponse>('/v1/challenges', { method: 'POST', body });
}

export interface GroupBridgeDeps {
  resolveLegacyId: (legacyId: string) => Promise<string | null>;
  resolveUuid: (uuid: string) => Promise<string | null>;
}

const defaultGroupBridge: GroupBridgeDeps = {
  resolveLegacyId: (legacyId) => resolveTiiziGroupId(legacyId),
  resolveUuid: (uuid) => resolveLegacyGroupId(uuid),
};

/**
 * V2 establishment Group resolution (bounded translation at the V2
 * application seam): POST /v1/challenges requires the authoritative Tiizi
 * Group UUID, but Group UI context may carry a Firestore document id.
 * UUID-shaped input is verified through the identity bridge (never
 * trusted on shape alone); legacy ids translate to the Tiizi UUID;
 * unmapped groups reject (fail closed — never a guessed identity).
 * PostgreSQL membership shadow is never consulted here; live Firestore
 * authority still decides creation authorization at establishment.
 */
export async function resolveEstablishmentGroupId(
  rawGroupId: string,
  bridge: GroupBridgeDeps = defaultGroupBridge,
): Promise<string> {
  if (!rawGroupId) throw new Error('A Group context is required to create a V2 Challenge.');
  if (isV2ChallengeId(rawGroupId)) {
    const confirmed = await bridge.resolveUuid(rawGroupId);
    if (confirmed) return rawGroupId;
    throw new Error(
      'This Group is not linked for V2 Challenge creation (unknown Tiizi Group identity).',
    );
  }
  const translated = await bridge.resolveLegacyId(rawGroupId);
  if (!translated) {
    throw new Error(
      'This Group is not linked for V2 Challenge creation (no Tiizi Group identity found).',
    );
  }
  return translated;
}
