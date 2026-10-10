/** Pure request-path builder; the API namespace is supplied by apiClient. */
export function groupFeedPagePath(apiPrefix: string, groupId: string, options: { limit?: number; cursor?: string } = {}): string {
  const params = new URLSearchParams();
  if (options.limit !== undefined) params.set('limit', String(options.limit));
  if (options.cursor !== undefined) params.set('cursor', options.cursor);
  const query = params.size ? `?${params.toString()}` : '';
  return `${apiPrefix}/groups/${encodeURIComponent(groupId)}/feed${query}`;
}
