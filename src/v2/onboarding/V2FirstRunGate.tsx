import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { V2LoadingState } from '../components/V2Primitives';
import { useV2Groups } from '../groups/useV2Groups';
import { ORIENTATION_PATHS } from './orientationContent';
import { firstRunDecision, hasSeenOrientation } from './orientationState';

/**
 * TIIZI — V2 Experience Recovery 001: first-run gate for the default landing.
 *
 * Wraps ONLY the Today route. A signed-in member who has not seen the
 * orientation and belongs to no Group is sent to `/v2/welcome` once; everyone
 * else (including members arriving through an explicit return path to any
 * other V2 route) is untouched. Reads the existing membership query only.
 */
export function V2FirstRunGate({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const groups = useV2Groups();
  const uid = user?.uid ?? null;
  const decision = firstRunDecision({
    seen: uid ? hasSeenOrientation(uid) : true,
    groupsStatus: groups.isLoading ? 'loading' : groups.isError ? 'error' : 'ready',
    groupCount: groups.data?.memberships.length ?? 0,
  });
  if (decision === 'wait') return <V2LoadingState label="Getting things ready…" />;
  if (decision === 'show-orientation') {
    return <Navigate to={ORIENTATION_PATHS.welcome} replace />;
  }
  return <>{children}</>;
}
