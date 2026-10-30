import type { ActivityOptionsResponse } from '../../../../api/challengeCreationApi';
import type { ApiKnowledgeItem } from '../../../../api/knowledgeApi';
import type {
  OperatorTemplateDetail,
  OperatorTemplateVersion,
  TemplateActivityConfig,
  TemplateVersionContent,
} from '../../../../api/operatorTemplatesApi';
import type { ActivityLookup } from '../templateAuthoringModel';

export const TOKEN_A = 'a'.repeat(64);
export const TOKEN_B = 'b'.repeat(64);
export const TOKEN_C = 'c'.repeat(64);
export const TEMPLATE_ID = '11111111-1111-4111-8111-111111111111';

export function optionsFor(id: string, currentVersion = 3): ActivityOptionsResponse {
  return {
    knowledgeId: id, activityCode: `CODE-${id}`, kind: 'fitness', currentVersion,
    primaryMetrics: ['repetitions', 'duration'], secondaryMetrics: [],
    compatibleUnits: ['reps', 'minutes', 'seconds'], components: [], supportedLoadBases: [],
    unitsByMetric: { repetitions: ['reps'], duration: ['minutes', 'seconds'] },
  };
}

export function knowledge(id: string, name: string): ApiKnowledgeItem {
  return {
    id, activityCode: `CODE-${id}`, kind: 'fitness', lifecycle: 'published', knowledgeVersion: 3, name,
    category: 'Strength', subcategory: '', difficulty: '', icon: '', description: '', metricUnit: '', targetValue: null,
    targetType: '', frequency: '', points: 0, imageUrl: '', tags: [], details: {}, createdAt: '', updatedAt: '',
  } as unknown as ApiKnowledgeItem;
}

export const CATALOGUE = [knowledge('act-1', 'Push-ups'), knowledge('act-2', 'Plank')];

export function activityConfig(id: string, over: Partial<TemplateActivityConfig> = {}): TemplateActivityConfig {
  return { activity: id, observedVersion: 3, kind: 'fitness', metric: 'repetitions', unit: 'reps', targetValue: 100, position: 0, ...over };
}

export function contentOf(over: Partial<TemplateVersionContent> = {}, activities: TemplateActivityConfig[] = [activityConfig('act-1')]): TemplateVersionContent {
  return {
    summary: 'A short race.', focusTags: ['Strength'], sortOrder: 7, coverId: 'challenge-2', durationDays: 14, durationPresetDays: [7, 14],
    composer: { title: 'Hundred Rep Race', description: 'Race', challengeType: 'competitive', goalValue: undefined, activities },
    ...over,
  };
}

export function versionOf(token: string | null, content = contentOf(), over: Partial<OperatorTemplateVersion> = {}): OperatorTemplateVersion {
  return {
    version: 1, state: token ? 'draft' : 'published', revisionToken: token, content,
    authoredByMemberId: 'member-author', authoredAt: '2026-10-30T08:00:00Z', lastEditedByMemberId: 'member-author',
    lastEditedAt: '2026-10-30T08:00:00Z', publishedByMemberId: null, publishedAt: null, ...over,
  };
}

export function detailOf(versions: OperatorTemplateVersion[]): OperatorTemplateDetail {
  return {
    templateId: TEMPLATE_ID, lifecycle: 'draft', createdByMemberId: 'member-author', createdAt: '2026-10-30T08:00:00Z',
    latestPublishedVersion: null, latestPublishedAt: null, retiredByMemberId: null, retiredAt: null, retiredReason: null, versions,
  };
}

/** Lookup double: `currentVersions` maps identity → the governed current version. */
export function lookupWith(currentVersions: Record<string, number> = {}, failing: string[] = []): ActivityLookup {
  return {
    options: async (id) => { if (failing.includes(id)) throw new Error('gone'); return optionsFor(id, currentVersions[id] ?? 3); },
    item: async (id) => { if (failing.includes(id)) throw new Error('gone'); return knowledge(id, id === 'act-1' ? 'Push-ups' : id === 'act-2' ? 'Plank' : id); },
  };
}
