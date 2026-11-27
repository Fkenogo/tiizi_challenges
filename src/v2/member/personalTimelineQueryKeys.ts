import type { QueryClient } from '@tanstack/react-query';

export const V2_PERSONAL_TIMELINE_SCOPE = 'v2-member-personal-timeline';
export const V2_PERSONAL_TIMELINE_PAGE_SIZE = 20;

export function v2PersonalTimelineKey(uid: string | undefined, limit: number) {
  return [V2_PERSONAL_TIMELINE_SCOPE, uid, limit] as const;
}

export async function invalidateV2PersonalTimeline(
  queryClient: QueryClient,
  uid?: string,
): Promise<void> {
  await queryClient.invalidateQueries({
    queryKey: uid === undefined ? [V2_PERSONAL_TIMELINE_SCOPE] : [V2_PERSONAL_TIMELINE_SCOPE, uid],
  });
}

export async function removeV2PersonalTimeline(
  queryClient: QueryClient,
  uid: string | undefined | null,
): Promise<void> {
  if (!uid) return;
  const queryKey = [V2_PERSONAL_TIMELINE_SCOPE, uid];
  await queryClient.cancelQueries({ queryKey });
  queryClient.removeQueries({ queryKey });
}
