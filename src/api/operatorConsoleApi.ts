import { API_PREFIX, apiFetch } from './apiClient';

export interface OperatorPage<T> { [key: string]: T[] | number | string | boolean | undefined; limit: number; offset: number; }
export interface OperatorOverview {
  counts: { members: number; groups: number; challenges: number; participations: number; accepted_activities: number; pending_causes: number; support_enabled: number; support_disabled: number };
  lifecycle: Array<{ status: string; count: number }>;
  finalizedChallenges: number;
  causes: Array<{ status: string; count: number }>;
  support: { enabled: number; disabled: number; with_social_cause: number };
  recentAcceptedActivities: Array<Record<string, unknown>>;
  recentCauseDecisions: Array<Record<string, unknown>>;
  currentOperatorMemberId: string;
}

function withQuery(path: string, query: Record<string, string | number | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) if (value !== undefined && value !== '') params.set(key, String(value));
  const suffix = params.toString();
  return suffix ? `${path}?${suffix}` : path;
}

export const fetchOperatorOverview = () => apiFetch<OperatorOverview>(`${API_PREFIX}/operator/console/overview`);
export const fetchOperatorMembers = (query: Record<string, string | number | undefined>) => apiFetch<Record<string, any>>(withQuery(`${API_PREFIX}/operator/console/members`, query));
export const fetchOperatorMember = (id: string) => apiFetch<Record<string, any>>(`${API_PREFIX}/operator/console/members/${encodeURIComponent(id)}`);
export const fetchOperatorGroups = (query: Record<string, string | number | undefined>) => apiFetch<Record<string, any>>(withQuery(`${API_PREFIX}/operator/console/groups`, query));
export const fetchOperatorGroup = (id: string) => apiFetch<Record<string, any>>(`${API_PREFIX}/operator/console/groups/${encodeURIComponent(id)}`);
export const fetchOperatorActivities = (query: Record<string, string | number | undefined>) => apiFetch<Record<string, any>>(withQuery(`${API_PREFIX}/operator/console/activities`, query));
export const fetchOperatorChallenges = (query: Record<string, string | number | undefined>) => apiFetch<Record<string, any>>(withQuery(`${API_PREFIX}/operator/console/challenges`, query));
export const fetchOperatorChallenge = (id: string) => apiFetch<Record<string, any>>(`${API_PREFIX}/operator/console/challenges/${encodeURIComponent(id)}`);
export const fetchOperatorSupport = (query: Record<string, string | number | undefined>) => apiFetch<Record<string, any>>(withQuery(`${API_PREFIX}/operator/console/support`, query));
export const fetchOperatorLocalisation = (query: Record<string, string | number | undefined>) => apiFetch<Record<string, any>>(withQuery(`${API_PREFIX}/operator/console/localisation`, query));
export const fetchOperatorAccess = () => apiFetch<Record<string, any>>(`${API_PREFIX}/operator/console/access`);
export const fetchOperatorAudit = (query: Record<string, string | number | undefined>) => apiFetch<Record<string, any>>(withQuery(`${API_PREFIX}/operator/console/audit`, query));
export const fetchOperatorHealth = () => apiFetch<{ api: string; database: string; checkedAt: string; scope: string }>(`${API_PREFIX}/operator/console/health`);
