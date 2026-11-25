import type { ActivityOptionsResponse, ComposerChallengeType } from '../../../api/challengeCreationApi';
import type { WizardActivity, WizardState } from '../challengeCreationDraft';
import { defaultTargetFor, unitsForMetric } from './activityDraft';

export type RequiredMeasurementField = 'durationMode' | 'completionOccurrence' | 'loadBasis';

export interface ActivityRefreshPlan {
  sourceActivityId: string;
  sourceActivitySnapshot: string;
  activityName: string;
  previousVersion: number;
  nextVersion: number;
  changes: string[];
  missingRequiredFields: RequiredMeasurementField[];
  updated: WizardActivity;
}

export function isStaleActivityIssue(issue: { code: string; raw?: string }): boolean {
  return issue.code === 'STALE_ACTIVITY' || /explicit refresh required/i.test(issue.raw ?? '');
}

export function resolveStaleActivityIndex(
  issue: { activityIndex?: number; raw?: string },
  activities: readonly WizardActivity[],
): number {
  if (
    typeof issue.activityIndex === 'number' &&
    issue.activityIndex >= 0 &&
    issue.activityIndex < activities.length
  ) {
    return issue.activityIndex;
  }
  const raw = issue.raw ?? '';
  const matched = activities.findIndex((a) => raw.includes(a.activity));
  return matched >= 0 ? matched : 0;
}

export function activityDraftSnapshot(
  activity: WizardActivity,
  challengeType: ComposerChallengeType | null,
): string {
  return JSON.stringify({
    challengeType,
    activity: activity.activity,
    observedVersion: activity.observedVersion,
    metric: activity.metric,
    unit: activity.unit,
    targetValue: activity.targetValue,
    durationMode: activity.durationMode,
    completionOccurrence: activity.completionOccurrence,
    loadBasis: activity.loadBasis,
    optionsVersion: activity.options.currentVersion,
  });
}

export function isRefreshPlanFresh(
  plan: ActivityRefreshPlan,
  state: Pick<WizardState, 'activities' | 'challengeType'>,
): { fresh: boolean; currentIndex: number; reason: 'ok' | 'removed' | 'changed' } {
  const currentIndex = state.activities.findIndex((a) => a.activity === plan.sourceActivityId);
  if (currentIndex < 0) {
    return { fresh: false, currentIndex: -1, reason: 'removed' };
  }
  const current = state.activities[currentIndex];
  if (activityDraftSnapshot(current, state.challengeType) !== plan.sourceActivitySnapshot) {
    return { fresh: false, currentIndex, reason: 'changed' };
  }
  if (plan.nextVersion !== plan.updated.options.currentVersion) {
    return { fresh: false, currentIndex, reason: 'changed' };
  }
  return { fresh: true, currentIndex, reason: 'ok' };
}

/**
 * Reconcile a stale WizardActivity against freshly fetched canonical options.
 * Binds the proposal to the exact source activity identity and draft snapshot,
 * reconciles metric-specific required fields, and never mutates the draft directly.
 */
export function planActivityRefresh(
  activity: WizardActivity,
  options: ActivityOptionsResponse,
  challengeType: ComposerChallengeType | null,
): ActivityRefreshPlan {
  const changes: string[] = [];
  const missingRequiredFields: RequiredMeasurementField[] = [];
  const allowedMetrics = [...options.primaryMetrics, ...options.secondaryMetrics];
  const metric =
    activity.metric && allowedMetrics.includes(activity.metric)
      ? activity.metric
      : (allowedMetrics[0] ?? activity.metric ?? '');
  const metricChanged = metric !== activity.metric;
  if (metricChanged) {
    changes.push(`Measurement metric updated from ${activity.metric || 'unset'} to ${metric}.`);
  }

  const allowedUnits = unitsForMetric(options, metric);
  const unit =
    activity.unit && allowedUnits.includes(activity.unit)
      ? activity.unit
      : (allowedUnits[0] ?? activity.unit ?? '');
  if (unit !== activity.unit) {
    changes.push(`Unit updated from ${activity.unit || 'unset'} to ${unit}.`);
  }

  let targetValue = activity.targetValue;
  const parsedTarget = Number(targetValue.trim());
  if (
    metricChanged &&
    (targetValue.trim().length === 0 || Number.isNaN(parsedTarget) || (metric !== 'completion' && parsedTarget <= 0))
  ) {
    targetValue = defaultTargetFor(challengeType, metric);
    changes.push(`Target initialized to ${targetValue} ${unit}.`);
  }

  let durationMode = '';
  if (metric === 'duration') {
    if (activity.durationMode === 'CONTINUOUS' || activity.durationMode === 'ACCUMULATED') {
      durationMode = activity.durationMode;
    } else {
      durationMode = 'CONTINUOUS';
      changes.push('Duration mode set to Continuous (reviewable in What counts).');
    }
  }

  let completionOccurrence = '';
  if (metric === 'completion') {
    if (activity.completionOccurrence.trim().length > 0) {
      completionOccurrence = activity.completionOccurrence;
    } else {
      missingRequiredFields.push('completionOccurrence');
      changes.push('Completion occurrence must be selected in What counts after refresh.');
    }
  }

  let loadBasis = '';
  if (metric === 'weight') {
    if (activity.loadBasis && options.supportedLoadBases.includes(activity.loadBasis)) {
      loadBasis = activity.loadBasis;
    } else if (options.supportedLoadBases.length === 1) {
      loadBasis = options.supportedLoadBases[0];
      changes.push(`Load tracking basis updated to ${loadBasis}.`);
    } else {
      missingRequiredFields.push('loadBasis');
      changes.push('Load tracking basis must be selected in What counts after refresh.');
    }
  } else if (activity.loadBasis && options.supportedLoadBases.includes(activity.loadBasis)) {
    loadBasis = activity.loadBasis;
  } else if (options.supportedLoadBases.length === 1) {
    loadBasis = options.supportedLoadBases[0];
  }

  const prevComponents = activity.options.components
    .filter((c) => c.relationship === 'required')
    .map((c) => c.componentId);
  const nextComponents = options.components
    .filter((c) => c.relationship === 'required')
    .map((c) => c.componentId);
  if (
    nextComponents.length !== prevComponents.length ||
    nextComponents.some((id, idx) => prevComponents[idx] !== id)
  ) {
    changes.push('Required activity components were updated to match the latest guide.');
  }

  return {
    sourceActivityId: activity.activity,
    sourceActivitySnapshot: activityDraftSnapshot(activity, challengeType),
    activityName: activity.name,
    previousVersion: activity.observedVersion,
    nextVersion: options.currentVersion,
    changes,
    missingRequiredFields,
    updated: {
      ...activity,
      options,
      observedVersion: options.currentVersion,
      metric,
      unit,
      targetValue,
      durationMode,
      completionOccurrence,
      loadBasis,
    },
  };
}
