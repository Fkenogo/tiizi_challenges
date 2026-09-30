/** V2 member-facing Group metadata catalogues. IDs are stable API values. */
export const GROUP_FOCUS_AREAS = [
  { domain: 'Fitness', label: 'Strength' },
  { domain: 'Fitness', label: 'Cardio & Conditioning' },
  { domain: 'Fitness', label: 'Mobility & Flexibility' },
  { domain: 'Fitness', label: 'Balance & Stability' },
  { domain: 'Fitness', label: 'Power, Speed & Agility' },
  { domain: 'Fitness', label: 'Sports & Recreation' },
  { domain: 'Wellness', label: 'Sleep & Rest' },
  { domain: 'Wellness', label: 'Mind & Emotional Wellbeing' },
  { domain: 'Wellness', label: 'Nutrition & Hydration' },
  { domain: 'Wellness', label: 'Daily Living' },
  { domain: 'Wellness', label: 'Personal Growth' },
  { domain: 'Wellness', label: 'Social Wellbeing' },
] as const;

export const GROUP_GOALS = [
  { id: 'manage_weight', label: 'Manage weight' },
  { id: 'build_strength', label: 'Build strength' },
  { id: 'improve_endurance', label: 'Improve endurance and fitness' },
  { id: 'improve_mobility', label: 'Improve mobility and flexibility' },
  { id: 'improve_nutrition', label: 'Improve eating habits' },
  { id: 'improve_sleep', label: 'Improve sleep' },
  { id: 'manage_stress', label: 'Manage stress' },
  { id: 'support_wellbeing', label: 'Support overall wellbeing' },
  { id: 'build_consistency', label: 'Build consistency with healthy habits' },
] as const;

export const GROUP_COMMUNITY_NORMS = [
  { id: 'respect_others', label: 'Treat each other with respect.' },
  { id: 'encourage_each_other', label: 'Encourage one another.' },
  { id: 'participate_consistently', label: 'Participate consistently in ways that work for you.' },
  { id: 'log_honestly', label: 'Log Activities honestly.' },
  { id: 'support_every_pace', label: 'Support every pace, without shaming.' },
  { id: 'keep_constructive', label: 'Help keep this Group welcoming and constructive.' },
] as const;

export function labelsForIds(ids: unknown, catalogue: readonly { id: string; label: string }[]): string[] {
  if (!Array.isArray(ids)) return [];
  const labels = new Map(catalogue.map((entry) => [entry.id, entry.label]));
  return ids.flatMap((id) => typeof id === 'string' && labels.has(id) ? [labels.get(id)!] : []);
}
