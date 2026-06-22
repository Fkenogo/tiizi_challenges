import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userProfileService, type UserProfileSetup } from '../services/userProfileService';
import { auth } from '../lib/firebaseAuth';

export const HOME_PATH = '/app/home';

const ONBOARDING_PATHS = [
  '/app/profile/completion',
  '/app/profile/interests',
  '/app/profile/setup-finish',
] as const;

export function getOnboardingPath(profileSetup: UserProfileSetup | null | undefined): string {
  if (profileSetup?.onboardingCompleted === true) return HOME_PATH;
  if (!profileSetup?.exerciseInterests?.length) return '/app/profile/interests';
  if (!profileSetup?.primaryGoal) return '/app/profile/setup-finish';
  return '/app/profile/completion';
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
