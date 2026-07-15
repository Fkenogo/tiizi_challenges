export interface IntroSlide {
  id: string;
  title: string;
  body: string;
  imageUrl: string;
}

export const ONBOARDING_SLIDES: IntroSlide[] = [
  {
    id: 'welcome',
    title: 'Welcome to Tiizi',
    body: 'Move together. Stay accountable. Make every activity count.\nJoin communities that turn fitness and wellness into shared journeys.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAAb5Mcy4OWxUJCBaKLmDQ9VgdAFe_EdAw3KKd4Ou5LaMbZlrGO93j8AjzkyfbWbbgC0LXu5CsdHn11uUogpK5W3FMcxUB8TH3BGZxGV17sfqfClwgMyr1kVF7e2E651muNCr-AKgUO1s_LRmPjv5eS996XynIdJ9suPkON-qGBsbUDRV3Ewd1j_mjM32ThM55uFyKF2-FJp_bMnuVRkzq4lOHBnP4QpuHWndGzNICkHIWByfHoK3eCzlCj7JW-EnN8MZiDD1lCd2lQ',
  },
  {
    id: 'community',
    title: 'Join a Community',
    body: 'Everything in Tiizi begins with a group.\nJoin friends, workplaces, schools, churches or local communities that motivate one another every day.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuBE4NFK2GvPatdL_CG5usDpcSyBzdhRc9FLtaLZZifiYSL9tP134Ki8iwZeT3rsBrCOpHSnLudqWoKpf9P1BfYuzqaVaVhd1gnEXxAJpApXrMutYG7BizyHVQTInMbhRrxbHTMmcN6eE3Yg1T-NTJlz2VFZ-JDiq3vCN5MtbaH4V20p9nx25jGcHqQCB6KbTwrot5SorMvklf0hKabecZRumQuq1LBd0Bufb5XnZeXknQ20DPvFFb-ZWtmUWThlgq1ypYsl5Ds5Gxxw',
  },
  {
    id: 'challenges',
    title: 'Join Challenges',
    body: 'Take part in challenges created by your community.\nChoose from Collective, Competitive or Streak challenges depending on what motivates you.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC6WXj_8Q47KWI8vVp9WzrP9zG6h1kr1FIfZi5ClLBfM95fkOe7WvIcmCWPpjI3B9sQz5k159XaZOYInricpZv5Yy9M0PmN-MnhrQn_BWW3Yj33u_nVZsZCAiHIgTklvEcf1D2Yd0ZY4aup-tlSOLh5dW96uknAxgUNCX8IMThkCjWxU6X_2XuhFj9U62pPFvFg8kqVzbI8XMHKjkT76SocXeUKD_3fAguR2l4Z1yHVK3zZ3nvR0WSVwXjvyj6R5zBTpLQFEGmYgkBi',
  },
  {
    id: 'log-activity',
    title: 'Log Every Activity',
    body: 'Record workouts, wellness activities and healthy habits in seconds.\nEvery activity helps you and your group make progress.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCOaumkaFMXt9fbLl_DbyUT8k0sLGZQAliIhv5XUX1mEWOcXnKaL_vqxtc89sL1YQZSwvZy7T-mwRDIXJ0TZQIbBxHluBWEn86luB20eGyc6dsdVrxPuPRO5-glu-D8K9M7FdYMxPNwBy6XL5xsZT953qgF9XVbwyk1pFIWNCSf7oC299M3Tp4fN-kVEpSOjY1WIiC6-xONA_oM2_aKxXf8qSxS6SEVZT_0xcpWIYY6kbTCSrceUnKw7TEKg7TQLnyy0KGDJbc3Y4I7',
  },
  {
    id: 'causes',
    title: 'Make Every Step Matter',
    body: 'Some challenges support real causes.\nWalk. Run. Move.\nHelp your community while improving your own health.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuABcA1nJnmVYWnpNe4WYyIRn_5SMfFIRqsx6yIpdi__DiEbcecb2x34XawwXGRWsWpAZnOFXFW7XnQmHRp9UvNFTVmxJgwWIpk2Tq5tAKt6jWNmKPiRmcCRYflvhH2XG56tZw9FSmuTc4RqKTpDgdnHmID3hNT3TWa83eXgXuiCpde9Voz47_X7NcxzJOLwOoRE64lEKs-wT3BvkC8iiZJe9JkzzzFN7BaowLAYopmOMnXFj6GIqSs20hsWVES-rL0vh0wXplgU9J0k',
  },
  {
    id: 'consistency',
    title: 'Build Consistency',
    body: 'Stay active every day.\nTrack streaks, celebrate milestones and create habits that last.',
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDHDv46_gGRYsmLE3arKEkz9x18eew8pj7oz3Iavy8ZOmSR8p_MrMB-xwiUqsUNWhXFpN22hKxQ4dWw5_v07FR4i-2Yqf1CTXNKvnXoOa0tcpVd562DICHOQcKhjVvgEPC238ijDeF00IEfcYBAbtIufe-Xp7MCPrFM8Aulcl8nFWacrs8VNZs669ZKAYbsXMdNJgS2hfPpuzYMZXPJaqzS9eSRzDRCiDt3kfBCXJYcigvKbtivNiUk46wbf1hz7zUQUKao2N2TQRea',
  },
  {
    id: 'ready',
    title: 'Ready to Begin?',
    body: "Join your first group.\nChoose a challenge.\nLog your first activity.\nLet's build healthier communities together.",
    imageUrl:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuB6zAuSX1D19KhaCqm6nM9t3TW___L_L0HmwT6BRyOJ0L9WmmiqT1ENQniWNfgJ10elslmcqO89zlAdHximwnTDvhYMXvh1g9bIE6hxUir_bD3c0Iou9JL9YWlQIHoJaF5BlwjvpnxJD29AaO5Jt2xNzVfDbefQ9-WOOp0EVZtJIa7cktbcz59kO3zTyK1jU70A5O-X_s5-vrgyqjbESMQwtdavb6c8uvyixAn5dbyzOr7-1FtFyUH7pIBmzJDR0NH5NC--6ZjPA7wr',
  },
];
