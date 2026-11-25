import type { ActivityOptionsResponse, ComposerChallengeType } from '../../../api/challengeCreationApi';
import type { WizardActivity } from '../challengeCreationDraft';

export interface ActivityRefreshPlan {
  activityIndex: number;
  activityName: string;
  previousVersion: number;
  nextVersion: number;
  changes: string[];
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

/**
 * Reconcile a stale WizardActivity against freshly fetched canonical options.
 * Never mutates the draft directly; returns a preview plan for explicit member acceptance.
 */
export function planActivityRefresh(
  activityIndex: number,
  activity: WizardActivity,
  options: ActivityOptionsResponse,
  _challengeType: ComposerChallengeType | null,
): ActivityRefreshPlan {
  const changes: string[] = [];
  const allowedMetrics = [...options.primaryMetrics, ...options.secondaryMetrics];
  const metric =
    activity.metric && allowedMetrics.includes(activity.metric)
      ? activity.metric
      : (allowedMetrics[0] ?? activity.metric ?? '');
  if (metric !== activity.metric) {
    changes.push(`Measurement metric updated from ${activity.metric || 'unset'} to ${metric}.`);
  }

  const allowedUnits = options.unitsByMetric[metric] ?? options.compatibleUnits;
  const unit =
    activity.unit && allowedUnits.includes(activity.unit)
      ? activity.unit
      : (allowedUnits[0] ?? activity.unit ?? '');
  if (unit !== activity.unit) {
    changes.push(`Unit updated from ${activity.unit || 'unset'} to ${unit}.`);
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

  const loadBasis =
    activity.loadBasis && options.supportedLoadBases.includes(activity.loadBasis)
      ? activity.loadBasis
      : (options.supportedLoadBases[0] ?? '');
  if (loadBasis !== activity.loadBasis && (activity.loadBasis || loadBasis)) {
    changes.push(`Load tracking basis updated to ${loadBasis || 'default'}.`);
  }

  return {
    activityIndex,
    activityName: activity.name,
    previousVersion: activity.observedVersion,
    nextVersion: options.currentVersion,
    changes,
    updated: {
      ...activity,
      options,
      observedVersion: options.currentVersion,
      metric,
      unit,
      loadBasis,
    },
  };
}
