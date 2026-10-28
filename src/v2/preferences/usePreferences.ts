import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchV2Preferences, saveV2Preferences, type V2PreferenceChange } from '../../api/preferencesApi';
import { useAuth } from '../../hooks/useAuth';
import { v2MemberPreferencesKey } from './preferencesQuery';

export function useV2Preferences() {
  const { user } = useAuth();
  return useQuery({
    queryKey: v2MemberPreferencesKey(user?.uid),
    queryFn: fetchV2Preferences,
    enabled: !!user?.uid,
    staleTime: 60_000,
  });
}

/** Saves through the server and stores the SERVER's response as the cache value. */
export function useSaveV2Preferences() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const uid = user?.uid;
  return useMutation({
    mutationFn: (change: V2PreferenceChange) => saveV2Preferences(change),
    onSuccess: (saved) => {
      // Never write another member's response into this member's slot.
      if (uid) queryClient.setQueryData(v2MemberPreferencesKey(uid), saved);
    },
  });
}
