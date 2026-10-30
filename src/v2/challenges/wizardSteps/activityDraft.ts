import type { ActivityOptionsResponse, ComposerChallengeType } from '../../../api/challengeCreationApi';
import type { ApiKnowledgeItem } from '../../../api/knowledgeApi';
import type { WizardActivity } from '../challengeCreationDraft';

/** The minimum catalogue identity the picker needs to add an Activity. */
export type ApiKnowledgeItemLike = Pick<ApiKnowledgeItem, 'id' | 'activityCode' | 'name' | 'kind' | 'category' | 'subcategory' | 'imageUrl'>;

export function defaultTargetFor(type: ComposerChallengeType | null, metric: string): string {
  if (metric === 'completion') return '1';
  if (metric === 'distance') return type === 'collective' ? '500' : '5';
  if (metric === 'duration') return type === 'streak' ? '20' : '60';
  if (metric === 'repetitions') return '20';
  if (metric === 'quantity') return '2000';
  if (metric === 'weight') return '20';
  return '10';
}

export function unitsForMetric(options: ActivityOptionsResponse, metric: string): string[] {
  const grouped = options.unitsByMetric[metric];
  if (grouped && grouped.length > 0) return grouped;
  return options.compatibleUnits;
}

export function buildWizardActivity(
  item: ApiKnowledgeItemLike,
  options: ActivityOptionsResponse,
  type: ComposerChallengeType | null,
): WizardActivity {
  const metric = options.primaryMetrics[0] ?? options.secondaryMetrics[0] ?? '';
  const units = unitsForMetric(options, metric);
  const unit = units[0] ?? options.compatibleUnits[0] ?? '';
  return {
    activity: item.id,
    activityCode: item.activityCode,
    name: item.name,
    kind: item.kind,
    category: item.category,
    subcategory: item.subcategory,
    imageUrl: item.imageUrl,
    observedVersion: options.currentVersion,
    options,
    metric,
    unit,
    targetValue: defaultTargetFor(type, metric),
    durationMode: metric === 'duration' ? 'CONTINUOUS' : '',
    completionOccurrence: '',
    loadBasis: '',
  };
}
