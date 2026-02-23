import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

const ACTIVE_GROUP_KEY = 'tiizi_active_group_id';

export function setActiveGroupId(groupId: string) {
  if (!groupId) return;
  localStorage.setItem(ACTIVE_GROUP_KEY, groupId);
}

export function getStoredActiveGroupId() {
  return localStorage.getItem(ACTIVE_GROUP_KEY) ?? undefined;
}

export function clearActiveGroupId() {
  localStorage.removeItem(ACTIVE_GROUP_KEY);
}

export function useResolvedGroupId() {
  const [params] = useSearchParams();
  return useMemo(() => params.get('groupId') ?? getStoredActiveGroupId(), [params]);
}

export function useRequireGroupContext() {
  const navigate = useNavigate();
  const groupId = useResolvedGroupId();

  const ensureGroup = () => {
    if (!groupId) {
      navigate('/app/groups', { replace: true });
      return undefined;
    }
    return groupId;
  };

  return { groupId, ensureGroup };
}
