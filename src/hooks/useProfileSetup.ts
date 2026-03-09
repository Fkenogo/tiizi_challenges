import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { userProfileService, type UserProfileSetup } from '../services/userProfileService';
import { auth } from '../lib/firebaseAuth';

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
