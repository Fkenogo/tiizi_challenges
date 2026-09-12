/**
 * EBC-05 V2 Founder Preview Knowledge selection client.
 *
 * Challenge establishment selects ONLY from server-authoritative
 * Knowledge: GET /v1/knowledge lists published records (draft/retired
 * items are never offered by this seam). Establishment readiness (KCS)
 * and the exact (Activity, Metric, Unit) tuple are enforced server-side
 * by the EBC-01 creation authority; the client additionally constrains
 * Metric/Unit choices to each item's governed contract so invalid
 * combinations are impossible to send — and surfaces the server's
 * rejection when one slips through.
 */
import { apiFetch } from './apiClient';
import type { V2KnowledgeItem, V2KnowledgeKind } from './v2KnowledgeContract';

export type { V2KnowledgeItem, V2KnowledgeKind } from './v2KnowledgeContract';
export { permittedMetrics } from './v2KnowledgeContract';

export function listEstablishmentKnowledge(params?: {
  kind?: V2KnowledgeKind;
  search?: string;
}): Promise<{ items: V2KnowledgeItem[] }> {
  const query = new URLSearchParams();
  if (params?.kind) query.set('kind', params.kind);
  if (params?.search) query.set('search', params.search);
  const suffix = query.toString();
  return apiFetch<{ items: V2KnowledgeItem[] }>(`/v1/knowledge${suffix ? `?${suffix}` : ''}`);
}
