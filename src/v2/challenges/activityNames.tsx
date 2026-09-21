import { useQueries, useQuery } from '@tanstack/react-query';
import { fetchKnowledgeByCode, fetchKnowledgeById } from '../../api/knowledgeApi';
import { humanizeCanonicalKey } from './loggingView';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function fetchDisplayName(canonicalKey: string): Promise<string | null> {
  const query = UUID_RE.test(canonicalKey)
    ? fetchKnowledgeById(canonicalKey)
    : fetchKnowledgeByCode(canonicalKey);
  return query.then(
    (item) => item?.name ?? null,
    () => null,
  );
}

/**
 * CORR-002 §7 — governed activity display names.
 *
 * Participant surfaces must show the governed human-readable Knowledge name,
 * never a raw Activity Code or UUID, as the primary label.
 * Canonical identity (the code/UUID submitted to the server) is unchanged —
 * this resolves display text only, through the existing governed
 * Knowledge/activity source. No code→name mapping is hard-coded here: every
 * name comes from `fetchKnowledgeByCode` / `fetchKnowledgeById`.
 *
 * Batch hook for surfaces that need synchronous labels (select options,
 * requirement rows). While a name is still resolving the caller falls back
 * to `humanizeCanonicalKey` (transient only — never persisted, never
 * submitted).
 */
export function useActivityDisplayNames(canonicalKeys: readonly string[]): Map<string, string> {
  const unique = [...new Set(canonicalKeys.filter((key) => key.length > 0))];
  const results = useQueries({
    queries: unique.map((key) => ({
      queryKey: ['v2-activity-name', key],
      queryFn: () => fetchDisplayName(key),
      staleTime: 5 * 60 * 1000,
      retry: false,
    })),
  });
  const names = new Map<string, string>();
  unique.forEach((key, index) => {
    const resolved = results[index]?.data;
    if (resolved) names.set(key, resolved);
  });
  return names;
}

/** Resolved display name with a transient humanized fallback while loading. */
export function resolveActivityDisplayName(
  canonicalKey: string,
  names: Map<string, string>,
): string {
  return names.get(canonicalKey) ?? humanizeCanonicalKey(canonicalKey);
}

/**
 * Single governed activity name. Replaces the previously duplicated local
 * `ActivityName` / `ChoiceName` components in the detail and logging
 * surfaces — one resolution path, same Knowledge source.
 */
export function V2ActivityName({ canonicalKey }: { canonicalKey: string }) {
  const query = useQuery({
    queryKey: ['v2-activity-name', canonicalKey],
    queryFn: () => fetchDisplayName(canonicalKey),
    enabled: !!canonicalKey,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
  if (query.isLoading) return <span className="text-slate-400">Activity…</span>;
  return <span>{query.data ?? humanizeCanonicalKey(canonicalKey)}</span>;
}
