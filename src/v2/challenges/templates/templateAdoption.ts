/**
 * Member Template selection — pure mapping from a published Template to an
 * EDITABLE seven-step wizard draft (FER-001-B Amendment 002 / TPL-001: a
 * Template only pre-fills a draft; it never creates a Challenge).
 *
 * No validation lives here. The wizard's own completeness gating and the
 * governed server seam remain the only authorities; this module restates what
 * the Template carries and invents nothing (no default duration from presets,
 * no group, no dates beyond "starts today" which is the wizard's own default).
 */
import type { ActivityOptionsResponse, ComposerChallengeType } from '../../../api/challengeCreationApi';
import type { MemberChallengeTemplate } from '../../../api/challengeTemplatesApi';
import type { ApiKnowledgeItem } from '../../../api/knowledgeApi';
import { isChallengeCoverId } from '../challengeCovers';
import {
  createInitialWizardState,
  deriveEndDate,
  type WizardActivity,
  type WizardState,
} from '../challengeCreationDraft';

export interface TemplateProvenance {
  templateId: string;
  version: number;
  title: string;
}

const TYPES: ReadonlyArray<string> = ['collective', 'competitive', 'streak'];

/** True when the Template carries everything the wizard needs to pre-fill without guessing. */
export function isTemplateComplete(template: MemberChallengeTemplate): boolean {
  if (!template.title?.trim() || !template.summary?.trim()) return false;
  if (!TYPES.includes(template.challengeType)) return false;
  if (!Number.isInteger(template.durationDays) || template.durationDays < 1) return false;
  const activities = template.composer?.activities ?? [];
  if (activities.length === 0) return false;
  return activities.every((a) => Boolean(a.activity) && Number.isInteger(a.observedVersion) && Boolean(a.metric) && Boolean(a.unit) && typeof a.targetValue === 'number');
}

/** Member discovery shows only what the server says is adoptable AND is fully configured. */
export function eligibleTemplates(templates: MemberChallengeTemplate[]): MemberChallengeTemplate[] {
  return templates.filter((t) => t.adoptable && isTemplateComplete(t));
}

export type TemplateDomain = 'fitness' | 'wellness';

/** Governed Activity facts used for search and Domain — resolved from the catalogue, never invented here. */
export type TemplateActivityLookup = Record<string, { name: string; kind: TemplateDomain }>;

export interface TemplateFilterState {
  search: string;
  type: ComposerChallengeType | 'all';
  /** Interest is retained in the model (and tests); the redesigned library surfaces Domain and Type. */
  interest: string | 'all';
  domain?: TemplateDomain | 'all';
}

/** Domains a Template spans, taken from the governed `kind` of its Activities. */
export function domainsOf(template: MemberChallengeTemplate, lookup: TemplateActivityLookup = {}): TemplateDomain[] {
  const found = template.composer.activities.map((a) => lookup[a.activity]?.kind).filter((k): k is TemplateDomain => Boolean(k));
  return Array.from(new Set(found));
}

export function filterTemplates(templates: MemberChallengeTemplate[], filter: TemplateFilterState, lookup: TemplateActivityLookup = {}): MemberChallengeTemplate[] {
  const q = filter.search.trim().toLowerCase();
  const domain = filter.domain ?? 'all';
  return templates.filter((t) => {
    if (filter.type !== 'all' && t.challengeType !== filter.type) return false;
    if (filter.interest !== 'all' && !t.focusTags.includes(filter.interest)) return false;
    if (domain !== 'all' && !domainsOf(t, lookup).includes(domain)) return false;
    if (!q) return true;
    const activityNames = t.composer.activities.map((a) => lookup[a.activity]?.name ?? '');
    return [t.title, t.summary, t.description ?? '', ...t.focusTags, ...activityNames].some((x) => x.toLowerCase().includes(q));
  });
}

export function interestsOf(templates: MemberChallengeTemplate[]): string[] {
  return Array.from(new Set(templates.flatMap((t) => t.focusTags))).sort();
}

export interface ResolvedTemplateActivity {
  item: Pick<ApiKnowledgeItem, 'id' | 'activityCode' | 'name' | 'kind' | 'category' | 'subcategory' | 'imageUrl'>;
  options: ActivityOptionsResponse;
}

/**
 * Template → wizard draft. Group is left unset (the member must host it), dates
 * start from the wizard's own "today" default, and everything the Template
 * does not carry stays at the wizard's initial value.
 */
export function templateToWizardState(
  template: MemberChallengeTemplate,
  resolved: Record<string, ResolvedTemplateActivity>,
  now: Date = new Date(),
): WizardState & { templateRef: TemplateProvenance } {
  const base = createInitialWizardState(now);
  const activities: WizardActivity[] = template.composer.activities.map((entry) => {
    const found = resolved[entry.activity];
    if (!found) throw new Error(`template-adoption: Activity ${entry.activity} could not be resolved`);
    return {
      activity: found.item.id,
      activityCode: found.item.activityCode,
      name: found.item.name,
      kind: found.item.kind,
      category: found.item.category,
      subcategory: found.item.subcategory,
      imageUrl: found.item.imageUrl,
      observedVersion: entry.observedVersion,
      options: found.options,
      metric: entry.metric ?? '',
      unit: entry.unit ?? '',
      targetValue: typeof entry.targetValue === 'number' ? String(entry.targetValue) : '',
      durationMode: entry.durationMode ?? (entry.metric === 'duration' ? 'CONTINUOUS' : ''),
      completionOccurrence: entry.completionOccurrence ?? '',
      loadBasis: entry.loadBasis ?? '',
    };
  });
  return {
    ...base,
    challengeType: template.challengeType as ComposerChallengeType,
    title: template.title,
    description: template.description ?? '',
    coverId: isChallengeCoverId(template.coverId) ? template.coverId : null,
    activities,
    durationDays: template.durationDays,
    endDate: deriveEndDate(base.startDate, template.durationDays),
    scheduleMode: 'preset',
    templateRef: { templateId: template.templateId, version: template.version, title: template.title },
  };
}

/** The wizard step a templated draft opens on: type is already chosen, so the member picks the host next. */
export const TEMPLATE_ADOPTION_START_STEP = 1;
