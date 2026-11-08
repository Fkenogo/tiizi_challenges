import type { ComposerActivityDraft } from '../../../api/challengeCreationApi';
import type { MemberChallengeTemplate } from '../../../api/challengeTemplatesApi';
import { metricLabel, unitLabel } from '../challengeCreationDraft';

const number = (n: number) => n.toLocaleString('en-GB');

/** "20 minutes", "3,000 reps", "2 litres" — restates the Template's own target and unit. */
export function targetPhrase(activity: ComposerActivityDraft): string {
  if (typeof activity.targetValue !== 'number' || !activity.unit) return 'Not set';
  return `${number(activity.targetValue)} ${unitLabel(activity.unit)}`;
}

export function measuredAs(activity: ComposerActivityDraft): string {
  return metricLabel(activity.metric);
}

/** How the target is read, per Challenge type (copy follows the wizard's own "what counts" wording). */
export function targetScope(type: string): string {
  if (type === 'streak') return 'every day';
  if (type === 'collective') return 'together, as one shared goal';
  if (type === 'competitive') return 'each, first to finish places first';
  return '';
}

export function durationPhrase(template: MemberChallengeTemplate): string {
  return `${template.durationDays} days`;
}

export function permittedDurations(template: MemberChallengeTemplate): string {
  return template.durationPresetDays.length > 0 ? template.durationPresetDays.map((d) => `${d}`).join(', ') + ' days' : 'Not specified';
}
