import { useQuery } from '@tanstack/react-query';
import { fetchTemplateCapabilities, type TemplateCapabilities } from '../../../api/operatorTemplatesApi';
import { useAuth } from '../../../hooks/useAuth';

export const templateCapabilitiesKey = (uid: string | undefined) => ['operator-templates', 'capabilities', uid ?? ''] as const;

/** Caller-scoped capability, read from the server. The UI never infers authority from anything else. */
export function useTemplateCapabilities() {
  const { user } = useAuth();
  return useQuery<TemplateCapabilities>({
    queryKey: templateCapabilitiesKey(user?.uid),
    queryFn: fetchTemplateCapabilities,
    enabled: !!user?.uid,
    staleTime: 30_000,
    retry: false,
  });
}
