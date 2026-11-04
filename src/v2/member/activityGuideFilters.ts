import type { ApiKnowledgeItem, ApiKnowledgeKind } from '../../api/knowledgeApi';

/**
 * Activity Guide first-level filter ("Category" in the control: Fitness /
 * Wellness). '' means "all" (default, full catalogue). Fitness / Wellness is
 * the existing canonical Knowledge `kind`; no new taxonomy is introduced here.
 * The second-level filter ("Subcategory" in the control) is the existing
 * governed Knowledge `category` (e.g. Strength, Sleep & Rest), unchanged.
 */
export type GuideDomain = '' | ApiKnowledgeKind;

type GuideItem = Pick<ApiKnowledgeItem, 'kind' | 'category'>;
export interface GuideSelection { domain: GuideDomain; category: string }

const DOMAINS: ReadonlyArray<ApiKnowledgeKind> = ['fitness', 'wellness'];

/** Distinct, sorted categories represented by the (optionally domain-filtered) catalogue. */
export function guideCategories(items: readonly GuideItem[], domain: GuideDomain): string[] {
  return [...new Set(
    items
      .filter((item) => !domain || item.kind === domain)
      .map((item) => item.category)
      .filter(Boolean),
  )].sort();
}

/** Categories grouped by domain, in Fitness → Wellness order, limited to `domain` when one is selected. */
export function guideCategoryGroups(items: readonly GuideItem[], domain: GuideDomain): Array<{ domain: ApiKnowledgeKind; categories: string[] }> {
  return DOMAINS
    .filter((kind) => !domain || kind === domain)
    .map((kind) => ({ domain: kind, categories: guideCategories(items, kind) }))
    .filter((group) => group.categories.length > 0);
}

/** The parent domain a category is listed under (first match, Fitness before Wellness). */
export function guideCategoryDomain(items: readonly GuideItem[], category: string): GuideDomain {
  return DOMAINS.find((kind) => items.some((item) => item.kind === kind && item.category === category)) ?? '';
}

/** A category that is not offered by the current domain resolves to '' (All categories). */
export function resolveGuideCategory(category: string, categories: readonly string[]): string {
  return category && categories.includes(category) ? category : '';
}

/** Choosing a domain clears a category that domain does not offer. */
export function selectGuideDomain(items: readonly GuideItem[], current: GuideSelection, domain: GuideDomain): GuideSelection {
  return { domain, category: resolveGuideCategory(current.category, guideCategories(items, domain)) };
}

/**
 * Choosing a category (from the group it was listed under) selects that
 * parent domain. Choosing "All" keeps the current domain.
 */
export function selectGuideCategory(current: GuideSelection, category: string, parent: ApiKnowledgeKind | ''): GuideSelection {
  return category ? { domain: parent || current.domain, category } : { domain: current.domain, category: '' };
}
