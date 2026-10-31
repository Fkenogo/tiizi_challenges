import type { OperatorTemplateVersion, TemplateActivityConfig } from '../../../api/operatorTemplatesApi';
import {
  challengeTypeLabel,
  loadBasisLabel,
  metricLabel,
  unitLabel,
  whatCountsExplanation,
} from '../../challenges/challengeCreationDraft';
import { challengeCoverGradient } from '../../challenges/challengeCovers';

/**
 * TIIZI-FER-P5T-2-S4 — illustrative member-style preview of a SAVED Template version.
 *
 * Pure presentation over stored content using the shared Wizard labels. It
 * derives nothing governed: no goal, scoring, Streak length or recognition is
 * computed here, and no Challenge, participation or adoption is created.
 */

export interface PreviewActivity {
  identity: string;
  name: string;
  metric: string;
  unit: string;
  target: string | null;
  settings: string[];
}

export interface TemplatePreviewModel {
  title: string;
  description: string;
  coverGradient: string;
  challengeTypeLabel: string | null;
  summary: string | null;
  tags: string[];
  durationDays: number | null;
  durationChoices: number[];
  activities: PreviewActivity[];
  whatCounts: string[];
  /** Plain-language notes about content that is still missing, never a validity verdict. */
  gaps: string[];
}

const DURATION_MODE: Record<string, string> = { CONTINUOUS: 'All at once', ACCUMULATED: 'Added up across the day' };

function describeSettings(config: TemplateActivityConfig): string[] {
  const settings: string[] = [];
  if (config.metric === 'weight' && config.loadBasis) settings.push(`Weight is reported as: ${loadBasisLabel(config.loadBasis)}`);
  if (config.metric === 'duration' && config.durationMode) settings.push(`How the time counts: ${DURATION_MODE[config.durationMode] ?? 'Custom'}`);
  if (config.metric === 'completion' && config.completionOccurrence) settings.push(`Counts as done: ${config.completionOccurrence}`);
  if (config.activityVariant) settings.push('Uses a specific Activity variant');
  return settings;
}

export function derivePreview(version: Pick<OperatorTemplateVersion, 'content'>, names: Record<string, string> = {}): TemplatePreviewModel {
  const { content } = version;
  const composer = content.composer;
  const type = (composer.challengeType ?? null) as Parameters<typeof challengeTypeLabel>[0];
  const activities = [...composer.activities]
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map<PreviewActivity>((config) => ({
      identity: config.activity,
      name: names[config.activity] ?? 'Activity (name unavailable)',
      metric: metricLabel(config.metric),
      unit: unitLabel(config.unit),
      target: config.targetValue === undefined ? null : String(config.targetValue),
      settings: describeSettings(config),
    }));
  const gaps: string[] = [];
  if (!composer.title) gaps.push('No title yet');
  if (!composer.challengeType) gaps.push('No Challenge type yet');
  if (!content.summary) gaps.push('No summary yet');
  if (content.durationDays === null) gaps.push('No duration yet');
  if (activities.length === 0) gaps.push('No Activities yet');
  return {
    title: composer.title || 'Untitled Template',
    description: composer.description ?? '',
    coverGradient: challengeCoverGradient(content.coverId),
    challengeTypeLabel: type ? `${challengeTypeLabel(type)} Challenge` : null,
    summary: content.summary,
    tags: [...content.focusTags],
    durationDays: content.durationDays,
    durationChoices: [...(content.durationPresetDays ?? [])],
    activities,
    whatCounts: whatCountsExplanation(type),
    gaps,
  };
}
