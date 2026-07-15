import { Navigate, useLocation } from 'react-router-dom';
import { LoadingSpinner } from '../Mobile';
import { useAuth } from '../../hooks/useAuth';
import { getOnboardingPath, HOME_PATH, isOnboardingPath, useProfileSetup } from '../../hooks/useProfileSetup';

type RequireProfileSetupProps = {
  children: React.ReactNode;
  mode: 'completed' | 'onboarding';
};

export function RequireProfileSetup({ children, mode }: RequireProfileSetupProps) {
  const { user } = useAuth();
  const location = useLocation();
  const { data: profileSetup, isLoading, isFetching } = useProfileSetup(user?.uid);

  if (user?.uid && (isLoading || isFetching) && profileSetup === undefined) {
    return <LoadingSpinner fullScreen label="Checking profile setup..." />;
  }

  const onboardingPath = getOnboardingPath(profileSetup);
  const isCompleted = onboardingPath === HOME_PATH;

  if (mode === 'completed' && !isCompleted) {
    return <Navigate to={onboardingPath} replace />;
  }

  if (mode === 'onboarding') {
    if (isCompleted) {
      return <Navigate to={HOME_PATH} replace />;
    }

    if (isOnboardingPath(location.pathname) && location.pathname !== onboardingPath) {
      return <Navigate to={onboardingPath} replace />;
    }
  }

  return <>{children}</>;
}
