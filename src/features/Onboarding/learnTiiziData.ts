export interface GuideSlide {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
}

// Image URLs reused from onboardingData.ts (same Stitch-hosted images)
const IMG = {
  welcome:     'https://lh3.googleusercontent.com/aida-public/AB6AXuAAb5Mcy4OWxUJCBaKLmDQ9VgdAFe_EdAw3KKd4Ou5LaMbZlrGO93j8AjzkyfbWbbgC0LXu5CsdHn11uUogpK5W3FMcxUB8TH3BGZxGV17sfqfClwgMyr1kVF7e2E651muNCr-AKgUO1s_LRmPjv5eS996XynIdJ9suPkON-qGBsbUDRV3Ewd1j_mjM32ThM55uFyKF2-FJp_bMnuVRkzq4lOHBnP4QpuHWndGzNICkHIWByfHoK3eCzlCj7JW-EnN8MZiDD1lCd2lQ',
  community:   'https://lh3.googleusercontent.com/aida-public/AB6AXuBE4NFK2GvPatdL_CG5usDpcSyBzdhRc9FLtaLZZifiYSL9tP134Ki8iwZeT3rsBrCOpHSnLudqWoKpf9P1BfYuzqaVaVhd1gnEXxAJpApXrMutYG7BizyHVQTInMbhRrxbHTMmcN6eE3Yg1T-NTJlz2VFZ-JDiq3vCN5MtbaH4V20p9nx25jGcHqQCB6KbTwrot5SorMvklf0hKabecZRumQuq1LBd0Bufb5XnZeXknQ20DPvFFb-ZWtmUWThlgq1ypYsl5Ds5Gxxw',
  challenges:  'https://lh3.googleusercontent.com/aida-public/AB6AXuC6WXj_8Q47KWI8vVp9WzrP9zG6h1kr1FIfZi5ClLBfM95fkOe7WvIcmCWPpjI3B9sQz5k159XaZOYInricpZv5Yy9M0PmN-MnhrQn_BWW3Yj33u_nVZsZCAiHIgTklvEcf1D2Yd0ZY4aup-tlSOLh5dW96uknAxgUNCX8IMThkCjWxU6X_2XuhFj9U62pPFvFg8kqVzbI8XMHKjkT76SocXeUKD_3fAguR2l4Z1yHVK3zZ3nvR0WSVwXjvyj6R5zBTpLQFEGmYgkBi',
  logActivity: 'https://lh3.googleusercontent.com/aida-public/AB6AXuCOaumkaFMXt9fbLl_DbyUT8k0sLGZQAliIhv5XUX1mEWOcXnKaL_vqxtc89sL1YQZSwvZy7T-mwRDIXJ0TZQIbBxHluBWEn86luB20eGyc6dsdVrxPuPRO5-glu-D8K9M7FdYMxPNwBy6XL5xsZT953qgF9XVbwyk1pFIWNCSf7oC299M3Tp4fN-kVEpSOjY1WIiC6-xONA_oM2_aKxXf8qSxS6SEVZT_0xcpWIYY6kbTCSrceUnKw7TEKg7TQLnyy0KGDJbc3Y4I7',
  causes:      'https://lh3.googleusercontent.com/aida-public/AB6AXuABcA1nJnmVYWnpNe4WYyIRn_5SMfFIRqsx6yIpdi__DiEbcecb2x34XawwXGRWsWpAZnOFXFW7XnQmHRp9UvNFTVmxJgwWIpk2Tq5tAKt6jWNmKPiRmcCRYflvhH2XG56tZw9FSmuTc4RqKTpDgdnHmID3hNT3TWa83eXgXuiCpde9Voz47_X7NcxzJOLwOoRE64lEKs-wT3BvkC8iiZJe9JkzzzFN7BaowLAYopmOMnXFj6GIqSs20hsWVES-rL0vh0wXplgU9J0k',
  consistency: 'https://lh3.googleusercontent.com/aida-public/AB6AXuDHDv46_gGRYsmLE3arKEkz9x18eew8pj7oz3Iavy8ZOmSR8p_MrMB-xwiUqsUNWhXFpN22hKxQ4dWw5_v07FR4i-2Yqf1CTXNKvnXoOa0tcpVd562DICHOQcKhjVvgEPC238ijDeF00IEfcYBAbtIufe-Xp7MCPrFM8Aulcl8nFWacrs8VNZs669ZKAYbsXMdNJgS2hfPpuzYMZXPJaqzS9eSRzDRCiDt3kfBCXJYcigvKbtivNiUk46wbf1hz7zUQUKao2N2TQRea',
  ready:       'https://lh3.googleusercontent.com/aida-public/AB6AXuB6zAuSX1D19KhaCqm6nM9t3TW___L_L0HmwT6BRyOJ0L9WmmiqT1ENQniWNfgJ10elslmcqO89zlAdHximwnTDvhYMXvh1g9bIE6hxUir_bD3c0Iou9JL9YWlQIHoJaF5BlwjvpnxJD29AaO5Jt2xNzVfDbefQ9-WOOp0EVZtJIa7cktbcz59kO3zTyK1jU70A5O-X_s5-vrgyqjbESMQwtdavb6c8uvyixAn5dbyzOr7-1FtFyUH7pIBmzJDR0NH5NC--6ZjPA7wr',
};

/**
 * Maps a section key (used in ?section=X URL params) to its slide index.
 * Invalid or missing keys fall back to 0.
 */
export const GUIDE_SECTION_MAP: Record<string, number> = {
  'groups':      1,
  'challenges':  2,
  'collective':  3,
  'competitive': 4,
  'streak':      5,
  'wellness':    6,
  'templates':   7,
  'wizard':      8,
  'logging':     9,
  'leaderboards': 10,
  'donations':   11,
  'analytics':   12,
  'faqs':        13,
};

export function sectionToIndex(section: string | null | undefined): number {
  if (!section) return 0;
  return GUIDE_SECTION_MAP[section] ?? 0;
}

export const LEARN_TIIZI_SLIDES: GuideSlide[] = [
  // 1
  {
    id: 'learn-welcome',
    title: 'Learn Tiizi',
    body: 'A quick walkthrough of how Tiizi works — groups, challenges, logging, and more.\n\nTap Next to explore at your own pace.',
    imageUrl: IMG.welcome,
  },

  // 2
  {
    id: 'groups',
    title: 'Start With a Group',
    body: 'Tiizi is built around groups. Before you join a challenge, you need to be part of a group.\n\nGroups can be friends, a workplace, a school, a church, or any community. They keep everyone accountable and moving together.',
    imageUrl: IMG.community,
  },

  // 3
  {
    id: 'challenges-overview',
    title: 'Join or Create Challenges',
    body: 'Once you are in a group, you can join challenges created by group admins — or create one yourself if you have permission.\n\nThere are three challenge types: Collective, Competitive, and Streak.',
    imageUrl: IMG.challenges,
  },

  // 4
  {
    id: 'collective',
    title: 'Collective Challenges',
    body: 'Everyone in the group works toward a single shared target.\n\nExample: "Run 500 km as a group by the end of the month."\n\nEvery log from every member counts toward the same goal. It is about teamwork.',
    imageUrl: IMG.community,
  },

  // 5
  {
    id: 'competitive',
    title: 'Competitive Challenges',
    body: 'Each member works toward their own personal target. A leaderboard ranks everyone by progress.\n\nExample: "Who can log the most workout sessions this week?"\n\nThis type is about individual performance within the group.',
    imageUrl: IMG.challenges,
  },

  // 6
  {
    id: 'streak',
    title: 'Streak Challenges',
    body: 'Consistency is the goal. You must log the required activity every day — missing a day can reset your streak.\n\nIf a streak requires multiple activities in one day, all of them must be logged together for that day to count.',
    imageUrl: IMG.consistency,
  },

  // 7
  {
    id: 'fitness-vs-wellness',
    title: 'Fitness vs Wellness',
    body: 'Fitness activities are exercise-based: running, cycling, gym sessions, sports, and more.\n\nWellness activities focus on health habits: sleep, hydration, meditation, nutrition, and similar practices.\n\nBoth count. Both matter.',
    imageUrl: IMG.logActivity,
  },

  // 8
  {
    id: 'templates',
    title: 'Challenge Templates',
    body: 'Not sure where to start? Browse templates — ready-made challenge ideas created by Tiizi.\n\nFitness and wellness templates are listed separately. Preview any template before using it. Templates make it easy to launch a great challenge quickly.',
    imageUrl: IMG.welcome,
  },

  // 9
  {
    id: 'wizard',
    title: 'The Challenge Wizard',
    body: 'Creating a challenge takes a few steps:\n1. Choose a type (Collective, Competitive, or Streak)\n2. Pick your activities\n3. Set start and end dates\n4. Review everything before you launch\n\nNote: group admins may restrict who can create challenges.',
    imageUrl: IMG.challenges,
  },

  // 10
  {
    id: 'logging',
    title: 'Logging Activity',
    body: 'Tap Log Activity to record a workout or wellness session. Each log automatically updates your challenge progress, appears in your group feed, and contributes to your analytics.\n\nFor streak challenges that require multiple activities in a day, log all of them in the same session.',
    imageUrl: IMG.logActivity,
  },

  // 11
  {
    id: 'leaderboards',
    title: 'Leaderboards',
    body: 'Each challenge has its own leaderboard showing how members rank for that specific challenge.\n\nThere is no single group-wide leaderboard — this is intentional, because different challenges measure different things and a combined ranking would not be fair.',
    imageUrl: IMG.consistency,
  },

  // 12
  {
    id: 'donations',
    title: 'Cause Challenges & Donations',
    body: 'Some challenges are linked to a real cause — your activity helps raise awareness or support.\n\nYou can also choose to support Tiizi to help keep the platform free for everyone. Donations are always optional.',
    imageUrl: IMG.causes,
  },

  // 13
  {
    id: 'analytics',
    title: 'Profile Analytics',
    body: 'Your profile tracks everything: total logs, active streaks, challenge history, and activity trends over time.\n\nUse your analytics to see what is working and where you can improve.',
    imageUrl: IMG.consistency,
  },

  // 14
  {
    id: 'faqs',
    title: 'Frequently Asked Questions',
    body: 'Do I need a group first? Yes — join or create one before joining a challenge.\n\nWhy can\'t I see a challenge? It may have ended, or your group admin may have restricted it.\n\nCan I create a challenge? Yes, if your group admin allows it.\n\nWhat if I miss a streak day? Your streak may reset — check the challenge rules.\n\nAre donations required? No, they are always optional.',
    imageUrl: IMG.community,
  },

  // 15
  {
    id: 'ready',
    title: 'Ready to Use Tiizi',
    body: 'You now know how Tiizi works.\n\nJoin a group. Pick a challenge. Log your activity. Watch your community grow stronger — one day at a time.',
    imageUrl: IMG.ready,
  },
];
