import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchMemberTemplate, fetchMemberTemplates, type MemberChallengeTemplate } from '../../../api/challengeTemplatesApi';
import { fetchKnowledgeById } from '../../../api/knowledgeApi';
import { eligibleTemplates } from './templateAdoption';

export const templateKeys = {
  list: ['v2-member-templates'] as const,
  one: (id: string, version?: number) => ['v2-member-template', id, version ?? 'latest'] as const,
  knowledge: (id: string) => ['v2-template-activity', id] as const,
};

/** Published, adoptable and fully configured Templates only (the server decides adoptable; completeness is double-checked). */
export function useMemberTemplates() {
  return useQuery({
    queryKey: templateKeys.list,
    queryFn: async () => eligibleTemplates((await fetchMemberTemplates()).templates),
    staleTime: 60_000,
  });
}

export function useMemberTemplate(templateId: string | undefined) {
  return useQuery({
    queryKey: templateKeys.one(templateId ?? ''),
    enabled: Boolean(templateId),
    queryFn: () => fetchMemberTemplate(templateId as string),
    staleTime: 60_000,
  });
}

/** Display names for Template Activities, resolved from the governed catalogue (identity stays the id). */
export function useTemplateActivityNames(templates: MemberChallengeTemplate[]) {
  const ids = Array.from(new Set(templates.flatMap((t) => t.composer.activities.map((a) => a.activity))));
  const results = useQueries({
    queries: ids.map((id) => ({ queryKey: templateKeys.knowledge(id), queryFn: () => fetchKnowledgeById(id), staleTime: 5 * 60_000 })),
  });
  const names: Record<string, { name: string; category: string; kind: 'fitness' | 'wellness' }> = {};
  results.forEach((r, i) => { if (r.data) names[ids[i]] = { name: r.data.name, category: r.data.category, kind: r.data.kind }; });
  return names;
}
