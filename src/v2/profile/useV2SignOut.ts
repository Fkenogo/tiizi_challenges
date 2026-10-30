/**
 * MC-2C-2 — V2 sign-out.
 *
 * Cancels every in-flight query and clears the shared query cache before
 * Firebase sign-out. Authentication caches are not all UID-keyed (for example
 * operator-console queries), so clearing only Profile and Today would let the
 * next member read data cached for the previous member. Sign-out itself stays
 * owned by the existing Auth context.
 */
import { useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../../hooks/useAuth';
import { clearChallengeDraft } from '../challenges/challengeDraftSession';
import { clearChallengeIntent } from '../challenges/challengeIntent';
import { clearAccountRecovery } from '../operator/templates/templateDraftRecovery';

export function useV2SignOut() {
  const { logout, user } = useAuth();
  const queryClient = useQueryClient();

  return useCallback(async () => {
    const uid = user?.uid;
    await queryClient.cancelQueries();
    queryClient.clear();
    await logout();
    // Signing out ends this member's Challenge-draft session backup too —
    // only once sign-out has actually succeeded (a failed sign-out keeps the
    // member signed in with their draft).
    // The same holds for this member's Challenge return context (only this
    // uid's key; other members' stored context is left alone).
    if (uid) {
      clearChallengeDraft(uid);
      clearChallengeIntent(uid);
      clearAccountRecovery(uid); // unsaved Template-draft work never outlives the session
    }
  }, [logout, queryClient, user?.uid]);
}
