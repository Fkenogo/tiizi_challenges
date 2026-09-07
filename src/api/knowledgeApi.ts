import { apiFetch } from './apiClient';
import type { AdminExerciseInput } from '../services/adminExerciseService';
import type { AdminWellnessActivityInput } from '../services/adminWellnessActivityService';
import type { CatalogExercise } from '../types';
import type {
  WellnessActivity,
  WellnessActivityType,
  WellnessCategory,
  WellnessDifficulty,
} from '../types/wellnessActivity';

/**
 * Phase B Knowledge API seam. When VITE_TIIZI_KNOWLEDGE_API_ENABLED=true,
 * Knowledge-selection UI and canonical Knowledge admin writes go through the
 * Tiizi API (PostgreSQL authority); otherwise callers use the legacy
 * Firestore services. Canonical `id` is always the Tiizi UUID — Firestore
 * document ids never appear as domain ids here.
 */

export type ApiKnowledgeKind = 'fitness' | 'wellness';
export type ApiKnowledgeLifecycle = 'draft' | 'published' | 'retired';

export interface ApiKnowledgeItem {
  id: string;
  kind: ApiKnowledgeKind;
  lifecycle: ApiKnowledgeLifecycle;
  knowledgeVersion: number;
  name: string;
  category: string;
  subcategory: string;
  difficulty: string;
  icon: string;
  description: string;
  metricUnit: string;
  targetValue: number | null;
  targetType: string;
  frequency: string;
  points: number;
  imageUrl: string;
  tags: string[];
  details: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface ApiKnowledgeContentInput {
  name: string;
  category: string;
  subcategory?: string;
  difficulty: string;
  icon?: string;
  description?: string;
  metricUnit: string;
  targetValue?: number | null;
  targetType?: string;
  frequency?: string;
  points?: number;
  imageUrl?: string;
  tags?: string[];
  details?: Record<string, unknown>;
}

interface KnowledgeListResponse {
  items: ApiKnowledgeItem[];
}

function listQuery(params: { kind?: ApiKnowledgeKind; search?: string }): string {
  const query = new URLSearchParams();
  if (params.kind) query.set('kind', params.kind);
  if (params.search) query.set('search', params.search);
  const suffix = query.toString();
  return `/v1/knowledge${suffix ? `?${suffix}` : ''}`;
}

/** Runtime listing: published records only (enforced server-side). */
export async function fetchPublishedKnowledge(
  kind: ApiKnowledgeKind,
  search?: string,
): Promise<ApiKnowledgeItem[]> {
  const response = await apiFetch<KnowledgeListResponse>(listQuery({ kind, search }));
  return response.items;
}

/** By-UUID fetch (unfiltered lifecycle — historical resolution preserved). */
export function fetchKnowledgeById(id: string): Promise<ApiKnowledgeItem> {
  return apiFetch<ApiKnowledgeItem>(`/v1/knowledge/${encodeURIComponent(id)}`);
}

/** Admin listing across lifecycle states. */
export async function fetchAdminKnowledgeList(
  kind?: ApiKnowledgeKind,
  lifecycle?: ApiKnowledgeLifecycle,
): Promise<ApiKnowledgeItem[]> {
  const query = new URLSearchParams();
  if (kind) query.set('kind', kind);
  if (lifecycle) query.set('lifecycle', lifecycle);
  const suffix = query.toString();
  const response = await apiFetch<KnowledgeListResponse>(
    `/v1/admin/knowledge${suffix ? `?${suffix}` : ''}`,
  );
  return response.items;
}

export function createKnowledgeItem(
  kind: ApiKnowledgeKind,
  content: ApiKnowledgeContentInput,
  lifecycle?: 'draft' | 'published',
): Promise<ApiKnowledgeItem> {
  return apiFetch<ApiKnowledgeItem>('/v1/admin/knowledge', {
    method: 'POST',
    body: { kind, ...content, ...(lifecycle ? { lifecycle } : {}) },
  });
}

export function reviseKnowledgeItem(
  id: string,
  content: ApiKnowledgeContentInput,
): Promise<ApiKnowledgeItem> {
  return apiFetch<ApiKnowledgeItem>(`/v1/admin/knowledge/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: content,
  });
}

export function publishKnowledgeItem(id: string): Promise<ApiKnowledgeItem> {
  return apiFetch<ApiKnowledgeItem>(`/v1/admin/knowledge/${encodeURIComponent(id)}/publish`, {
    method: 'POST',
    body: {},
  });
}

export function retireKnowledgeItem(id: string): Promise<ApiKnowledgeItem> {
  return apiFetch<ApiKnowledgeItem>(`/v1/admin/knowledge/${encodeURIComponent(id)}/retire`, {
    method: 'POST',
    body: {},
  });
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string');
}

function detailString(details: Record<string, unknown>, key: string): string {
  const value = details[key];
  return typeof value === 'string' ? value : '';
}

/** API fitness item → legacy CatalogExercise shape (id is the Tiizi UUID). */
export function mapApiItemToExercise(api: ApiKnowledgeItem): CatalogExercise {
  const details = api.details ?? {};
  const metricType = detailString(details, 'metricType') || api.metricUnit;
  return {
    id: api.id,
    name: api.name,
    imageUrl: api.imageUrl || undefined,
    tier_1: api.category,
    tier_2: api.subcategory,
    difficulty: api.difficulty,
    musclesTargeted: stringArray(details.musclesTargeted),
    equipment: stringArray(details.equipment),
    trainingGoals: stringArray(details.trainingGoals),
    metric: {
      type: metricType,
      unit: api.metricUnit,
      allowCustomUnit: details.allowCustomUnit === true,
    },
    description: api.description,
    setup: stringArray(details.setup),
    execution: stringArray(details.execution),
    breathing: (details.breathing as CatalogExercise['breathing']) ?? {
      inhale: '',
      exhale: '',
      pattern: '',
    },
    formCues: stringArray(details.formCues),
    commonMistakes: stringArray(details.commonMistakes),
    progressions: stringArray(details.progressions),
    advancedVariations: stringArray(details.advancedVariations),
    safetyNotes: stringArray(details.safetyNotes),
    recommendedVolume: (details.recommendedVolume as CatalogExercise['recommendedVolume']) ?? {
      beginner: '',
      intermediate: '',
      advanced: '',
    },
    tags: api.tags,
    movementType: details.movementType === 'isometric' || details.movementType === 'isotonic'
      ? details.movementType
      : undefined,
    holdBased: details.holdBased === true ? true : undefined,
    lifecycleStatus: api.lifecycle,
    knowledgeVersion: api.knowledgeVersion,
  };
}

const WELLNESS_TARGET_TYPES = new Set(['daily', 'cumulative', 'weekly', 'monthly']);

/** API wellness item → legacy WellnessActivity shape (id is the Tiizi UUID). */
export function mapApiItemToWellnessActivity(api: ApiKnowledgeItem): WellnessActivity {
  const details = api.details ?? {};
  const activityType = detailString(details, 'activityType') as WellnessActivityType;
  return {
    id: api.id,
    category: api.category as WellnessCategory,
    name: api.name,
    shortName: detailString(details, 'shortName') || api.name,
    description: api.description,
    difficulty: api.difficulty as WellnessDifficulty,
    icon: api.icon,
    coverImage: api.imageUrl || undefined,
    activityType: activityType || 'habit',
    defaultMetricUnit: api.metricUnit,
    defaultTargetValue: api.targetValue ?? 1,
    targetType: WELLNESS_TARGET_TYPES.has(api.targetType)
      ? (api.targetType as WellnessActivity['targetType'])
      : undefined,
    suggestedFrequency: typeof details.suggestedFrequency === 'number' && details.suggestedFrequency >= 1
      ? Math.floor(details.suggestedFrequency as number)
      : 1,
    protocolSteps: stringArray(details.protocolSteps),
    fastingProtocol: details.fastingProtocol as WellnessActivity['fastingProtocol'],
    hydrationProtocol: details.hydrationProtocol as WellnessActivity['hydrationProtocol'],
    sleepProtocol: details.sleepProtocol as WellnessActivity['sleepProtocol'],
    benefits: stringArray(details.benefits),
    benefitsTimeline: details.benefitsTimeline as WellnessActivity['benefitsTimeline'],
    guidelines: stringArray(details.guidelines),
    warnings: Array.isArray(details.warnings) ? stringArray(details.warnings) : undefined,
    contraindications: Array.isArray(details.contraindications)
      ? stringArray(details.contraindications)
      : undefined,
    bodyResponse: details.bodyResponse as WellnessActivity['bodyResponse'],
    defaultPoints: api.points,
    bonusConditions: Array.isArray(details.bonusConditions)
      ? (details.bonusConditions as WellnessActivity['bonusConditions'])
      : [],
    popular: details.popular === true,
    medicalSupervisionRequired: details.medicalSupervisionRequired === true,
    prerequisite: detailString(details, 'prerequisite') || undefined,
    tags: api.tags,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
    lifecycleStatus: api.lifecycle,
    knowledgeVersion: api.knowledgeVersion,
  };
}

/** Legacy fitness admin input → API content payload (vocabulary-preserving). */
export function mapExerciseToApiInput(input: AdminExerciseInput): ApiKnowledgeContentInput {
  return {
    name: input.name,
    category: input.tier_1,
    subcategory: input.tier_2,
    difficulty: input.difficulty,
    description: input.description,
    metricUnit: input.metric.unit,
    imageUrl: input.imageUrl,
    tags: input.tags,
    details: {
      musclesTargeted: input.musclesTargeted,
      equipment: input.equipment,
      trainingGoals: input.trainingGoals,
      setup: input.setup,
      execution: input.execution,
      breathing: input.breathing,
      formCues: input.formCues,
      commonMistakes: input.commonMistakes,
      progressions: input.progressions,
      advancedVariations: input.advancedVariations,
      safetyNotes: input.safetyNotes,
      recommendedVolume: input.recommendedVolume,
      movementType: input.movementType,
      holdBased: input.holdBased,
      metricType: input.metric.type,
      allowCustomUnit: input.metric.allowCustomUnit,
    },
  };
}

/** Legacy wellness admin input → API content payload (vocabulary-preserving). */
export function mapWellnessActivityToApiInput(
  input: AdminWellnessActivityInput,
): ApiKnowledgeContentInput {
  return {
    name: input.name,
    category: input.category,
    difficulty: input.difficulty,
    icon: input.icon,
    description: input.description,
    metricUnit: input.defaultMetricUnit,
    targetValue: input.defaultTargetValue,
    targetType: input.targetType,
    points: input.defaultPoints,
    imageUrl: input.coverImage,
    tags: input.tags,
    details: {
      shortName: input.shortName,
      activityType: input.activityType,
      suggestedFrequency: input.suggestedFrequency,
      protocolSteps: input.protocolSteps,
      fastingProtocol: input.fastingProtocol,
      hydrationProtocol: input.hydrationProtocol,
      sleepProtocol: input.sleepProtocol,
      benefits: input.benefits,
      benefitsTimeline: input.benefitsTimeline,
      guidelines: input.guidelines,
      warnings: input.warnings,
      contraindications: input.contraindications,
      bodyResponse: input.bodyResponse,
      bonusConditions: input.bonusConditions,
      popular: input.popular,
      medicalSupervisionRequired: input.medicalSupervisionRequired,
      prerequisite: input.prerequisite,
    },
  };
}
