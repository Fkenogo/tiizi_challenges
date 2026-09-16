import { ApiError, apiFetch, apiFetchRaw } from './apiClient';
import type { ApiKnowledgeItem } from './knowledgeApi';

/**
 * S2b — V2 Challenge Creation client seam.
 *
 * Transport only. The client composes a PF-04 Composer draft and sends it
 * over the already-merged S2a seam; it never validates semantics itself and
 * never writes a Challenge directly (no Firestore write, no direct database
 * access). Semantic authority stays server-side:
 *   Composer (PF-04) → PF-03 validator → governed establishment
 *   (POST /v1/challenges) → ChallengeCreationAuthority.
 *
 * The draft shape mirrors the PF-04 contract exactly. It is a transport
 * contract, not a second validator: no rule here decides validity.
 */

export type ComposerChallengeType = 'collective' | 'competitive' | 'streak';

export interface ComposerActivityDraft {
  /** Immutable identity ONLY: canonical Knowledge UUID or Activity Code. */
  activity: string;
  observedVersion: number;
  kind: 'fitness' | 'wellness';
  metric?: string;
  unit?: string;
  targetValue?: number;
  componentIds?: string[];
  loadBasis?: string;
  durationMode?: string;
  completionOccurrence?: string;
  activityVariant?: string | null;
  position?: number;
}

export interface ChallengeComposerDraft {
  draftKind: 'pf04-v1';
  mode: 'CHALLENGE';
  challengeType?: ComposerChallengeType;
  title?: string;
  description?: string;
  instructions?: string;
  activities: ComposerActivityDraft[];
  startDate?: string;
  endDate?: string;
  timezone?: string;
  goalValue?: number;
  goalUnit?: string;
  requiredConsecutiveDays?: number;
}

/** Governed Composer options for one canonical Activity (S2a seam). */
export interface ActivityOptionsResponse {
  knowledgeId: string;
  activityCode: string | null;
  kind: 'fitness' | 'wellness';
  currentVersion: number;
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
  components: Array<{ componentId: string; displayName: string; relationship: string }>;
  supportedLoadBases: string[];
  /**
   * Derived presentation grouping of the governed compatible units by the
   * Metric each unit expresses (server-owned single vocabulary). The client
   * never re-derives compatibility.
   */
  unitsByMetric: Record<string, string[]>;
}

/** Structured PF-04 / PF-03 issue as returned by the preview seam. */
export interface ComposerPreviewIssue {
  code: string;
  field?: string;
  stage?: string;
  activityIndex?: number;
  message: string;
}

export interface ComposerPreviewDefinition {
  definitionKind: string;
  challengeType: ComposerChallengeType;
  title: string;
  description: string;
  window: { startDate: string; endDate: string; timezone: string };
  goalValue: number | null;
  goalUnit: string | null;
  requiredConsecutiveDays: number | null;
  activities: Array<{
    canonicalKey: string;
    activityCode: string | null;
    metric: string;
    unit: string;
    targetValue: number;
    requiredComponents: string[];
    loadReportingBasis: string | null;
    durationMode: string | null;
    completionOccurrence: string | null;
  }>;
}

export type ComposerPreviewResult =
  | { ok: true; definition: ComposerPreviewDefinition }
  | { ok: false; issues: ComposerPreviewIssue[] };

/** Composer-selectable canonical catalogue (published, coded, eligible). */
export async function fetchComposerSelectableKnowledge(
  kind?: 'fitness' | 'wellness',
  search?: string,
): Promise<ApiKnowledgeItem[]> {
  const query = new URLSearchParams({ composerSelectable: 'true' });
  if (kind) query.set('kind', kind);
  if (search && search.trim()) query.set('search', search.trim());
  const response = await apiFetch<{ items: ApiKnowledgeItem[] }>(`/v1/knowledge?${query.toString()}`);
  return response.items;
}

/** Governed Metric/Unit/Component/Load-basis options for one Activity. */
export function fetchActivityOptions(identity: string): Promise<ActivityOptionsResponse> {
  return apiFetch<ActivityOptionsResponse>(`/v1/knowledge/${encodeURIComponent(identity)}/options`);
}

interface PreviewBody {
  ok?: boolean;
  definition?: ComposerPreviewDefinition;
  issues?: ComposerPreviewIssue[];
  error?: { code?: string; message?: string };
}

/**
 * Server preview/validation. A 422 carries structured issues (never an
 * ApiError body) so the wizard can locate the offending step/field; every
 * other failure surfaces as a conventional ApiError. Persists nothing.
 */
export async function previewChallengeDefinition(
  draft: ChallengeComposerDraft,
): Promise<ComposerPreviewResult> {
  const result = await apiFetchRaw<PreviewBody>('/v1/challenge-definitions/preview', {
    method: 'POST',
    body: draft,
  });
  if (result.ok && result.data?.ok === true && result.data.definition) {
    return { ok: true, definition: result.data.definition };
  }
  if (result.status === 422 && Array.isArray(result.data?.issues)) {
    return { ok: false, issues: result.data.issues };
  }
  throw new ApiError(
    result.status,
    result.data?.error?.code ?? 'preview_failed',
    result.data?.error?.message ?? `Challenge preview failed (${result.status})`,
  );
}

export interface EstablishChallengeActivityBody {
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

export interface EstablishChallengeBody {
  group_id: string;
  challenge_type: ComposerChallengeType;
  title: string;
  description?: string;
  instructions?: string;
  start_date: string;
  end_date: string;
  goal_value?: number;
  goal_unit?: string;
  required_consecutive_days?: number;
  timezone?: string;
  activities: EstablishChallengeActivityBody[];
  activate?: boolean;
  join_creator?: boolean;
  idempotency_key?: string;
}

export interface EstablishChallengeResponse {
  challengeId: string;
  groupId: string;
  status: string;
  configVersion: number;
  activated: boolean;
  creatorParticipationId: string | null;
  idempotentReplay: boolean;
}

/** Governed V2 Challenge establishment (the ONLY creation path). */
export function establishChallengeV2(
  body: EstablishChallengeBody,
): Promise<EstablishChallengeResponse> {
  return apiFetch<EstablishChallengeResponse>('/v1/challenges', { method: 'POST', body });
}

/**
 * Member-facing copy for a governed denial lives in the pure draft module
 * (creationErrorMessage) so it is directly testable without Firebase.
 */
