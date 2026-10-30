import { V2Button, V2Card, V2EmptyState, V2Field, V2Select, V2TextInput } from '../../components/V2Primitives';
import {
  loadBasisLabel,
  metricLabel,
  requiredComponentIds,
  unitLabel,
  type WizardActivity,
} from '../challengeCreationDraft';
import { defaultTargetFor, unitsForMetric } from './activityDraft';
import type { WhatCountsStepState } from './stepStates';

export function WhatCountsStep({
  state,
  onUpdateActivity,
  onRemove,
}: {
  state: WhatCountsStepState;
  onUpdateActivity: (index: number, patch: Partial<WizardActivity>) => void;
  onRemove: (index: number) => void;
}) {
  if (state.activities.length === 0) {
    return (
      <V2EmptyState
        title="No activities chosen yet"
        message="Go back to the previous step and choose at least one activity."
      />
    );
  }
  const type = state.challengeType;
  const targetLabel =
    type === 'collective' ? 'Shared goal'
      : type === 'streak' ? 'Daily requirement'
        : 'Target to reach';

  return (
    <div className="space-y-4">
      {state.activities.map((activity, index) => {
        const metricOptions = [
          ...activity.options.primaryMetrics,
          ...activity.options.secondaryMetrics,
        ].map((metric) => ({ value: metric, label: metricLabel(metric) }));
        const unitOptions = unitsForMetric(activity.options, activity.metric).map((unit) => ({
          value: unit,
          label: unitLabel(unit),
        }));
        const components = requiredComponentIds(activity.options);
        return (
          <V2Card key={activity.activity}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-black text-slate-900">{activity.name}</p>
                <p className="text-xs text-slate-500">
                  {activity.kind === 'wellness' ? 'Wellness' : 'Fitness'} · {metricLabel(activity.metric)}
                </p>
              </div>
              {state.activities.length > 1 && (
                <V2Button variant="ghost" onClick={() => onRemove(index)}>
                  Remove
                </V2Button>
              )}
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <V2Field label="How it is measured">
                <V2Select
                  value={activity.metric}
                  options={metricOptions}
                  onChange={(metric) => {
                    const units = unitsForMetric(activity.options, metric);
                    onUpdateActivity(index, {
                      metric,
                      unit: units[0] ?? '',
                      durationMode: metric === 'duration' ? activity.durationMode || 'CONTINUOUS' : '',
                      completionOccurrence: metric === 'completion' ? activity.completionOccurrence : '',
                      loadBasis: metric === 'weight' ? activity.loadBasis : '',
                      targetValue: defaultTargetFor(state.challengeType, metric),
                    });
                  }}
                />
              </V2Field>
              <V2Field label="Unit">
                <V2Select
                  value={activity.unit}
                  options={unitOptions}
                  onChange={(unit) => onUpdateActivity(index, { unit })}
                />
              </V2Field>
              <V2Field label={targetLabel}>
                <V2TextInput
                  type="number"
                  min="0"
                  value={activity.targetValue}
                  onChange={(targetValue) => onUpdateActivity(index, { targetValue })}
                />
              </V2Field>
            </div>

            {activity.metric === 'duration' && (
              <div className="mt-3">
                <V2Field label="How the time counts" hint="Choose whether the time must be done all at once or can add up.">
                  <V2Select
                    value={activity.durationMode || 'CONTINUOUS'}
                    options={[
                      { value: 'CONTINUOUS', label: 'All at once' },
                      { value: 'ACCUMULATED', label: 'Added up across the day' },
                    ]}
                    onChange={(durationMode) => onUpdateActivity(index, { durationMode })}
                  />
                </V2Field>
              </div>
            )}

            {activity.metric === 'completion' && (
              <div className="mt-3">
                <V2Field label="What must be completed?" hint="Say exactly what counts as done for this activity.">
                  <V2TextInput
                    value={activity.completionOccurrence}
                    onChange={(completionOccurrence) => onUpdateActivity(index, { completionOccurrence })}
                    placeholder="e.g. one full guided breathing session"
                  />
                </V2Field>
              </div>
            )}

            {activity.metric === 'weight' && (
              <div className="mt-3">
                <V2Field label="How the weight is reported">
                  <V2Select
                    value={activity.loadBasis}
                    options={[
                      { value: '', label: 'Choose how the weight is reported' },
                      ...activity.options.supportedLoadBases.map((basis) => ({
                        value: basis,
                        label: loadBasisLabel(basis),
                      })),
                    ]}
                    onChange={(loadBasis) => onUpdateActivity(index, { loadBasis })}
                  />
                </V2Field>
              </div>
            )}

            {components.length > 0 && (
              <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
                This activity has required parts that must each meet the target:{' '}
                {activity.options.components.map((component) => component.displayName).join(', ')}.
              </p>
            )}
          </V2Card>
        );
      })}
    </div>
  );
}
