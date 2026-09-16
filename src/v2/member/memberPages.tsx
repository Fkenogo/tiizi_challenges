import { V2Placeholder } from '../components/V2Placeholder';

/**
 * TIIZI S1 — Member placeholder surfaces.
 *
 * S1 does not bind real read models. Each route renders a
 * product-like placeholder (title + human explanation + empty state
 * + next slice) so the new experience is Founder-previewable.
 */

export function V2TodayPage() {
  return (
    <V2Placeholder
      eyebrow="Today"
      title="Today"
      explanation="Your movement for today, in one glance — what you planned, what you finished, and what is next."
      emptyTitle="Nothing planned for today yet"
      emptyMessage="When you join a challenge or plan an activity, it will show up here so you always know what is next."
      nextSlice="Today read models (S5)"
    />
  );
}

export function V2ChallengesPage() {
  return (
    <V2Placeholder
      eyebrow="Challenges"
      title="Challenges"
      explanation="Move together or race each other — find a challenge that fits how you like to move."
      emptyTitle="No challenges to show yet"
      emptyMessage="Challenges you join or are invited to will appear here. You can browse by how they work: together, race, or streak."
      nextSlice="Challenge experience (S3)"
    />
  );
}

export function V2GroupsPage() {
  return (
    <V2Placeholder
      eyebrow="Groups"
      title="Groups"
      explanation="Your people, your pace. Groups are the friends, family, or colleagues you move with."
      emptyTitle="You are not in a group yet"
      emptyMessage="Join a group to share challenges, cheer each other on, and keep the momentum going."
      nextSlice="Group experience (S4)"
    />
  );
}

export function V2GuidePage() {
  return (
    <V2Placeholder
      eyebrow="Activity Guide"
      title="Activity Guide"
      explanation="Not sure what to do today? Browse simple, safe activity ideas for every level."
      emptyTitle="The guide is getting ready"
      emptyMessage="A friendly catalogue of activities with clear how-to steps is on its way. Check back soon."
      nextSlice="Activity Guide knowledge binding (S6)"
    />
  );
}

export function V2ProfilePage() {
  return (
    <V2Placeholder
      eyebrow="Profile"
      title="Your profile"
      explanation="Your story on Tiizi — your movement, your groups, and the recognition you have earned."
      emptyTitle="Your profile is just getting started"
      emptyMessage="Finish a challenge to start filling your profile with achievements worth celebrating."
      nextSlice="Profile, recognition & notifications (S8)"
    />
  );
}

export function V2NotificationsPage() {
  return (
    <V2Placeholder
      eyebrow="Notifications"
      title="Notifications"
      explanation="Invites, reminders, and cheers from your groups — everything that needs your attention."
      emptyTitle="All caught up"
      emptyMessage="When something needs your attention, you will find it here."
      nextSlice="Profile, recognition & notifications (S8)"
    />
  );
}
