import { Navigate, useSearchParams } from 'react-router-dom';

function CompetitiveChallengeScreen() {
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId');
  const groupId = params.get('groupId');

  if (!challengeId) return <Navigate replace to="/app/challenges" />;

  const qs = groupId ? `?groupId=${groupId}` : '';
  return <Navigate replace to={`/app/challenge/${challengeId}${qs}`} />;
}

export default CompetitiveChallengeScreen;
