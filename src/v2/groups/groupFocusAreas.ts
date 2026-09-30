/**
 * Presentation choices use the exact Fitness/Wellness categories in the
 * governed Knowledge taxonomy (EKG-01 §5). They remain Group focusTags:
 * descriptive searchable metadata, never eligibility or recommendation
 * authority. Legacy/custom tags continue to be read as stored.
 */
export const GROUP_FOCUS_AREAS = [
  { domain: 'Fitness', category: 'Strength' },
  { domain: 'Fitness', category: 'Cardio & Conditioning' },
  { domain: 'Fitness', category: 'Mobility & Flexibility' },
  { domain: 'Fitness', category: 'Balance & Stability' },
  { domain: 'Fitness', category: 'Power, Speed & Agility' },
  { domain: 'Fitness', category: 'Sports & Recreation' },
  { domain: 'Wellness', category: 'Sleep & Rest' },
  { domain: 'Wellness', category: 'Mind & Emotional Wellbeing' },
  { domain: 'Wellness', category: 'Nutrition & Hydration' },
  { domain: 'Wellness', category: 'Daily Living' },
  { domain: 'Wellness', category: 'Personal Growth' },
  { domain: 'Wellness', category: 'Social Wellbeing' },
] as const;

export const GROUP_FOCUS_AREA_LABELS: string[] = GROUP_FOCUS_AREAS.map(({ category }) => category);

export function focusAreaMatchesSearch(category: string, query: string): boolean {
  return category.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
}
