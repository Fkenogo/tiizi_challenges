import type { ApiKnowledgeItem, ApiKnowledgeKind } from '../../api/knowledgeApi';

/**
 * Activity Guide first-level domain filter. '' means "all" (default, full
 * catalogue). Fitness / Wellness is the existing canonical Knowledge `kind`;
 * no new taxonomy is introduced here.
 */
export type GuideDomain = '' | ApiKnowledgeKind;

type GuideItem = Pick<ApiKnowledgeItem, 'kind' | 'category'>;

/** Distinct, sorted categories represented by the (optionally domain-filtered) catalogue. */
export function guideCategories(items: readonly GuideItem[], domain: GuideDomain): string[] {
  return [...new Set(
    items
      .filter((item) => !domain || item.kind === domain)
      .map((item) => item.category)
      .filter(Boolean),
  )].sort();
}

/** A category that is not offered by the current domain resolves to '' (All categories). */
export function resolveGuideCategory(category: string, categories: readonly string[]): string {
  return category && categories.includes(category) ? category : '';
}

/**
 * Domain toggle: choosing the active domain again clears it (back to the full
 * catalogue). Switching domain keeps the category only when it is still valid.
 */
export function nextGuideSelection(
  items: readonly GuideItem[],
  current: { domain: GuideDomain; category: string },
  pressed: Exclude<GuideDomain, ''>,
): { domain: GuideDomain; category: string } {
  const domain: GuideDomain = current.domain === pressed ? '' : pressed;
  return { domain, category: resolveGuideCategory(current.category, guideCategories(items, domain)) };
}
