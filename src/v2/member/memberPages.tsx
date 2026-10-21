import { V2Placeholder } from '../components/V2Placeholder';

/**
 * TIIZI S1 — Member placeholder surfaces.
 *
 * S1 does not bind real read models. Each route renders a
 * product-like placeholder (title + human explanation + empty state
 * + next slice) so the new experience is Founder-previewable.
 *
 * Today is no longer a placeholder: S5b binds the real member Today
 * experience (`src/v2/today/**`) to the server-composed `GET /api/today`
 * projection. Profile is no longer a placeholder either: MC-2C-1 binds
 * `/v2/profile` to the governed `GET /api/me` read
 * (`src/v2/profile/**`). Both routes live in routes.tsx.
 */

/**
 * Challenges is no longer a placeholder: S2b binds the real V2 Challenges
 * read + creation journey (see src/v2/challenges/**). The route lives in
 * routes.tsx.
 */

/**
 * Groups is no longer a placeholder: S2-G binds the real V2 Groups surface
 * and the minimum Create Group journey (see src/v2/groups/**). The routes
 * live in routes.tsx.
 */

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
