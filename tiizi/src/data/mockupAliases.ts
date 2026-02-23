export type MockupAlias = {
  path: string;
  slug: string;
};

export const mockupAliases: MockupAlias[] = [
  { path: '/welcome', slug: 'welcome-full-brand' },
  { path: '/login', slug: 'sign-up-login-aligned' },
  { path: '/signup', slug: 'sign-up-login-aligned' },
  { path: '/home', slug: 'home-aligned' },
  { path: '/quick-actions', slug: 'quick-actions-aligned' },
  { path: '/exercises', slug: 'exercise-library-aligned' },
  { path: '/exercises/:id', slug: 'exercise-detail-aligned' },
  { path: '/challenges', slug: 'challenges-aligned' },
  { path: '/suggested-challenges', slug: 'suggested-challenges-aligned' },
  { path: '/challenge-preview', slug: 'challenge-preview-aligned' },
  { path: '/create-challenge', slug: 'create-challenge-aligned' },
  { path: '/competitive-challenge', slug: 'competitive-challenge-view' },
  { path: '/collective-challenge', slug: 'collective-challenge-details' },
  { path: '/streak-challenge', slug: 'streak-challenge-view' },
  { path: '/groups', slug: 'groups-aligned' },
  { path: '/join-group', slug: 'join-group-aligned' },
  { path: '/create-group', slug: 'create-group-aligned' },
  { path: '/group/challenges', slug: 'group-detail-challenges-aligned' },
  { path: '/group/challenges-highlighted', slug: 'group-detail-challenges-highlighted' },
  { path: '/group/feed', slug: 'group-detail-feed-highlighted' },
  { path: '/group/members', slug: 'group-detail-members-highlighted' },
  { path: '/group/leaderboard', slug: 'group-detail-leaderboard-aligned' },
  { path: '/profile', slug: 'profile-aligned' },
  { path: '/profile/completion', slug: 'profile-completion-aligned' },
  { path: '/profile/interests', slug: 'profile-interests-aligned' },
  { path: '/profile/personal-info', slug: 'profile-personal-info-aligned' },
  { path: '/profile/privacy-settings', slug: 'profile-privacy-settings-aligned' },
  { path: '/admin/challenge-approved', slug: 'admin-challenge-approved-aligned' },
  { path: '/admin/challenge-pending', slug: 'admin-pending-challenge-aligned' },
];
