/**
 * EBC-05 V2 Knowledge contract (pure — no network, no Firebase).
 *
 * Shape of one server-authoritative published Knowledge item plus the
 * governed-contract selectors the establishment form uses to constrain
 * Metric/Unit choices. Imported by the API client, the establishment
 * payload builder, and the guard suite without pulling the API transport.
 */

export type V2KnowledgeKind = 'fitness' | 'wellness';

export interface V2KnowledgeItem {
  id: string;
  kind: V2KnowledgeKind;
  lifecycle: 'draft' | 'published' | 'retired';
  knowledgeVersion: number;
  name: string;
  category: string;
  description: string;
  metricUnit: string;
  grandfathered: boolean;
  primaryMetrics: string[];
  secondaryMetrics: string[];
  compatibleUnits: string[];
}

/** All Metrics the item permits (primary ∪ secondary), in stable order. */
export function permittedMetrics(item: V2KnowledgeItem): string[] {
  const seen = new Set<string>();
  for (const metric of [...(item.primaryMetrics ?? []), ...(item.secondaryMetrics ?? [])]) {
    if (metric && !seen.has(metric)) seen.add(metric);
  }
  return [...seen];
}
