/**
 * TIIZI — V2 Experience Recovery 001: first-run orientation content.
 *
 * Experience baseline: the committed Tiizi onboarding design exports
 * (`stitch_tiizi_revamp/*`: Welcome to Tiizi, Join a Community, Join
 * Challenges, Log Every Activity, Ready to Begin?) — full-bleed photography,
 * a short headline and one paragraph per step, an orange primary action and
 * a "Skip intro" escape on every step. The adopted prototype repository was
 * not available to this package; the design exports are the baseline.
 *
 * Copy is subject to current Product Truth: Challenge types use the V2 names
 * (Together / Race / Streak). Nothing here claims rewards, recognition,
 * recommendations, goals or payment features, none of which exist in V2.
 */

export interface OrientationSlide {
  id: 'welcome' | 'community' | 'challenges' | 'activity' | 'begin';
  title: string;
  body: string;
  image: string;
}

export const ORIENTATION_SLIDES: readonly OrientationSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to Tiizi',
    body: 'Move together. Stay accountable. Make every activity count. Join communities that turn fitness and wellness into shared journeys.',
    image: '/onboarding/welcome.jpg',
  },
  {
    id: 'community',
    title: 'Join a Community',
    body: 'Everything in Tiizi begins with a Group. Join the people you already move with, using the invite code they share, or find a Group that fits you.',
    image: '/onboarding/community.jpg',
  },
  {
    id: 'challenges',
    title: 'Take on Challenges',
    body: 'Challenges are created inside Groups. Choose Together, Race or Streak, depending on what motivates you. Joining a Group never joins you to a Challenge on its own.',
    image: '/onboarding/challenges.jpg',
  },
  {
    id: 'activity',
    title: 'Log Every Activity',
    body: 'Record workouts, wellness activities and healthy habits in seconds. Every activity you log counts toward your Challenge and your Group.',
    image: '/onboarding/activity.jpg',
  },
  {
    id: 'begin',
    title: 'Ready to begin?',
    body: 'Join your first Group. Choose a Challenge. Log your first activity. Have an invite code? Enter it below.',
    image: '/onboarding/begin.jpg',
  },
] as const;

/** Route targets used by the orientation exits (V2 routes only). */
export const ORIENTATION_PATHS = {
  today: '/v2/today',
  discover: '/v2/groups?tab=discover',
  createGroup: '/v2/groups/new',
  welcome: '/v2/welcome',
} as const;
