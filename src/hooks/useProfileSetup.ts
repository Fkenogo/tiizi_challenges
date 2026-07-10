import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userProfileService, type UserProfileSetup } from '../services/userProfileService';
import { auth } from '../lib/firebaseAuth';

export const HOME_PATH = '/app/home';

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
  // Show intro slides once to everyone (new users and existing users who haven't seen them)
  if (!profileSetup?.hasSeenIntro) return '/app/onboarding/intro';
  // Fully onboarded
  if (profileSetup?.onboardingCompleted === true) return HOME_PATH;
  // No exercise interests → start at personal info (step 1) then interests (step 2)
  if (!profileSetup?.exerciseInterests?.length) return '/app/profile/completion';
  // Has exercise interests but no wellness interests → step 3
  if (!profileSetup?.wellnessInterests?.length) return '/app/profile/wellness-interests';
  // Has wellness interests but no health goals → step 4
  if (!profileSetup?.goals?.length) return '/app/profile/health-goals';
  // Has all selections but not marked complete → finish screen
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
