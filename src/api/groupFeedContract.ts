// Pure module (no transport/auth imports) so the contract is unit-testable.
/**
 * Client mirror of the ONE canonical automatic Group Feed family contract
 * (GF-01 v1.1; server definition: `api/src/groupFeedPublication.ts`). Exactly four
 * families. Challenge finalization is Challenge-domain truth and is NOT Group Feed
 * publishable, so it has no representation here. The frontend is a separate package
 * and may not import API source; drift against the server tuple and titles is
 * prevented by `npm run test:gf04-group-feed`.
 */
export const GROUP_FEED_EVENT_TYPES = [
  'challenge_established',
  'challenge_started',
  'together_goal_achieved',
  'challenge_ended',
] as const;

export type GroupFeedEventType = (typeof GROUP_FEED_EVENT_TYPES)[number];

/** Presentation titles are server-supplied; this records the accepted GF-03 set. */
export const GROUP_FEED_PRESENTATION_TITLES = {
  challenge_established: 'A new Challenge is available',
  challenge_started: 'The Challenge has started',
  together_goal_achieved: 'The Group reached its Challenge goal',
  challenge_ended: 'The Challenge has ended',
} as const satisfies Record<GroupFeedEventType, string>;
