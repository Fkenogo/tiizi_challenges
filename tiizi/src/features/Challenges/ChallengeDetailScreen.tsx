import { useEffect } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card, EmptyState } from '../../components/Mobile';
import { useChallenge } from '../../hooks/useChallenges';
import { useGroups } from '../../hooks/useGroups';
import { useAuth } from '../../hooks/useAuth';
import { useChallengeProgress } from '../../hooks/useWorkouts';

function ChallengeDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const { data: challenge, isLoading } = useChallenge(id);
  const { data: groups } = useGroups();
  const { user } = useAuth();

  if (isLoading) {
    return (
      <Screen>
        <Section title="Challenge Detail">
          <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3 animate-pulse">
            <div className="h-4 bg-slate-200 rounded w-2/3" />
            <div className="h-3 bg-slate-100 rounded w-1/2" />
            <div className="h-11 bg-slate-200 rounded-xl" />
            <div className="h-11 bg-slate-100 rounded-xl" />
          </div>
        </Section>
      </Screen>
    );
  }
  const resolvedChallenge = challenge ?? null;

  const hasValidGroupId = !!groupId && !!groups?.some((group) => group.id === groupId);
  const activeGroupId = hasValidGroupId ? groupId : undefined;
  const challengeGroupId = resolvedChallenge?.groupId;
  const normalizedGroupId = challengeGroupId ?? activeGroupId;

  useEffect(() => {
    if (!groupId) return;
    if (groups && !hasValidGroupId) {
      if (resolvedChallenge) {
        navigate(`/app/challenge/${resolvedChallenge.id}`, { replace: true });
      } else {
        navigate('/app/challenges', { replace: true });
      }
      return;
    }
    if (resolvedChallenge && challengeGroupId && groupId !== challengeGroupId) {
      navigate(`/app/challenge/${resolvedChallenge.id}?groupId=${challengeGroupId}`, { replace: true });
      return;
    }
    if (resolvedChallenge && !challengeGroupId) {
      navigate(`/app/challenge/${resolvedChallenge.id}`, { replace: true });
    }
  }, [groupId, groups, hasValidGroupId, resolvedChallenge, challengeGroupId, id, navigate]);

  const backToChallengesPath = `/app/challenges${normalizedGroupId ? `?groupId=${normalizedGroupId}` : ''}`;
  const { data: progress } = useChallengeProgress(resolvedChallenge?.id, user?.uid);
  if (!resolvedChallenge) {
    return (
      <EmptyState
        icon={<span>🏆</span>}
        title="Challenge not found"
        message="This challenge may have expired or the link is invalid."
        action={(
          <button
            className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold"
            onClick={() => navigate(backToChallengesPath)}
          >
            Back to Challenges
          </button>
        )}
      />
    );
  }

  return (
    <Screen>
      <Section title="Challenge Detail">
        <Card>
          <p className="text-sm text-slate-700">Challenge: <span className="font-bold">{resolvedChallenge.name}</span></p>
          <p className="text-xs text-slate-500 mt-2">Status: {resolvedChallenge.status}</p>
          <p className="text-xs text-slate-500">Starts: {new Date(resolvedChallenge.startDate).toLocaleDateString()}</p>
          <div className="grid grid-cols-3 gap-2 mt-3">
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">My Logs</p>
              <p className="text-base font-black text-slate-900">{progress?.myLogs ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Total Logs</p>
              <p className="text-base font-black text-slate-900">{progress?.totalLogs ?? 0}</p>
            </div>
            <div className="rounded-lg bg-slate-50 border border-slate-200 p-2">
              <p className="text-[10px] uppercase font-bold text-slate-500">Participants</p>
              <p className="text-base font-black text-slate-900">{progress?.uniqueParticipants ?? 0}</p>
            </div>
          </div>
          {!!normalizedGroupId && <p className="text-xs text-primary mt-1">Linked to selected group</p>}
          <div className="mt-4 space-y-2">
            <button className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate(`/app/workouts/select-activity?challengeId=${resolvedChallenge.id}${normalizedGroupId ? `&groupId=${normalizedGroupId}` : ''}`)}>
              Log Workout
            </button>
            <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate(backToChallengesPath)}>
              Back to Challenges
            </button>
            {!!normalizedGroupId && (
              <button className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold" onClick={() => navigate(`/app/group/${normalizedGroupId}`)}>
                Back to Group
              </button>
            )}
          </div>
        </Card>
      </Section>
    </Screen>
  );
}

export default ChallengeDetailScreen;
