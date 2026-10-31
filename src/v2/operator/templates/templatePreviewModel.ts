import type { OperatorTemplateVersion, TemplateActivityConfig } from '../../../api/operatorTemplatesApi';
import {
  challengeTypeLabel,
  metricLabel,
  unitLabel,
  whatCountsExplanation,
} from '../../challenges/challengeCreationDraft';
import { challengeCoverGradient } from '../../challenges/challengeCovers';
import { activitySettings } from './templateLibraryModel';

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

/** Counting settings come from the Library's shared helper so the two views can never disagree. */
const describeSettings = (config: TemplateActivityConfig): string[] => activitySettings(config);

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
