const GROUP_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Fixed internal Challenge return destination; accepted only for its source Group. */
export function challengeReturnPath(locationState: unknown, challengeGroupId: string): string {
  const groupId = locationState && typeof locationState === 'object'
    ? (locationState as { gf04FeedOriginGroupId?: unknown }).gf04FeedOriginGroupId
    : undefined;
  return typeof groupId === 'string' && GROUP_UUID_RE.test(groupId) && groupId === challengeGroupId
    ? `/v2/groups/${encodeURIComponent(groupId)}/feed`
    : '/v2/challenges';
}
