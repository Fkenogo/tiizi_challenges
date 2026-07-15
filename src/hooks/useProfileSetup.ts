import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userProfileService, type UserProfileSetup } from '../services/userProfileService';
import { auth } from '../lib/firebaseAuth';

export const HOME_PATH = '/app/home';

// Phase 6B founder decision: minimum 3 activity interests, maximum 10 (max is
// enforced in ProfileInterestsScreen's own selection UI, not here). Shared so
// the route guard and the screen's own Next-button validation can't drift.
export const MIN_EXERCISE_INTERESTS = 3;

const ONBOARDING_PATHS = [
  '/app/onboarding/intro',
  '/app/profile/completion',
  '/app/profile/interests',
  '/app/profile/wellness-interests',
  '/app/profile/health-goals',
  '/app/profile/privacy-settings',
  '/app/profile/setup-finish',
] as const;

export function getOnboardingPath(profileSetup: UserProfileSetup | null | undefined): string {
  // Fully onboarded users are ALWAYS treated as complete, regardless of which
  // newer marker fields (hasSeenIntro, wellnessInterestsCompleted,
  // privacySettingsCompleted, etc.) existed when they finished onboarding.
  // This must be the very first check — checking any per-step field first
  // (including hasSeenIntro) would incorrectly re-onboard legacy completed
  // users who predate that field. See docs/reports/
  // pre-beta-group-detail-onboarding-and-taxonomy-fix.md for the real-data
  // proof: most existing completed users lack hasSeenIntro/the newer step
  // markers entirely.
  if (profileSetup?.onboardingCompleted === true) return HOME_PATH;
  // Show intro slides once to everyone (new users and existing users who haven't seen them)
  if (!profileSetup?.hasSeenIntro) return '/app/onboarding/intro';
  // No personal info (name + birthday) saved yet → step 1
  if (!profileSetup?.personalInfo?.fullName?.trim() || !profileSetup?.personalInfo?.birthday?.trim()) {
    return '/app/profile/completion';
  }
  // Has personal info but fewer than the approved minimum exercise interests → step 2
  if ((profileSetup?.exerciseInterests?.length ?? 0) < MIN_EXERCISE_INTERESTS) return '/app/profile/interests';
  // Has exercise interests but hasn't gone through wellness topics (optional,
  // so an empty selection doesn't mean incomplete — checked via its own
  // completion marker) → step 3
  if (!profileSetup?.wellnessInterestsCompleted) return '/app/profile/wellness-interests';
  // Has wellness interests but no health goals → step 4
  if (!profileSetup?.goals?.length) return '/app/profile/health-goals';
  // Has health goals but hasn't gone through privacy settings → step 5
  if (!profileSetup?.privacySettingsCompleted) return '/app/profile/privacy-settings';
  // Has all steps but not marked complete → finish screen
  return '/app/profile/setup-finish';
}

export function isOnboardingPath(pathname: string): boolean {
  return (ONBOARDING_PATHS as readonly string[]).includes(pathname);
}

export function useProfileSetup(uid: string | undefined) {
  return useQuery({
    queryKey: ['profile-setup', uid],
    queryFn: () => (uid ? userProfileService.getProfileSetup(uid) : Promise.resolve(null)),
    enabled: !!uid,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSaveProfileSetup(uid: string | undefined) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: UserProfileSetup) => {
      const resolvedUid = uid ?? auth.currentUser?.uid;
      if (!resolvedUid) throw new Error('User not authenticated');
      return userProfileService.upsertProfileSetup(resolvedUid, input);
    },
    onSuccess: () => {
      const resolvedUid = uid ?? auth.currentUser?.uid;
      if (resolvedUid) {
        queryClient.invalidateQueries({ queryKey: ['profile-setup', resolvedUid] });
      }
    },
  });
}
