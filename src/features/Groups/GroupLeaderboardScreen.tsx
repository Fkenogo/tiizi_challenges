import { ArrowLeft } from 'lucide-react';
import { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useGroup } from '../../hooks/useGroups';
import { GroupBottomNav } from './components/GroupBottomNav';

function GroupLeaderboardScreen() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { data: group } = useGroup(id);

  useEffect(() => {
    if (id) setActiveGroupId(id);
  }, [id]);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 px-4 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <button
              className="h-10 w-10 flex items-center justify-center text-slate-900"
              onClick={() => navigate(id ? `/app/group/${id}` : '/app/groups')}
            >
              <ArrowLeft size={24} />
            </button>
            <h1 className="text-[20px] leading-[24px] font-black text-slate-900">
              {group?.name ?? 'Group'}
            </h1>
          </div>
        </header>

        <main className="px-4 pt-8">
          <div className="rounded-[24px] border border-slate-200 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
            <p className="text-[20px] leading-[26px] font-black text-slate-900">Group leaderboard has moved</p>
            <p className="mt-3 text-[15px] leading-[22px] text-[#61758f]">
              Challenge leaderboards are now available inside each challenge. Open any active challenge to see rankings.
            </p>
            <button
              className="mt-5 h-12 w-full rounded-xl bg-primary text-white text-[15px] font-bold"
              onClick={() => navigate(id ? `/app/group/${id}` : '/app/groups')}
            >
              View Group Challenges
            </button>
          </div>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default GroupLeaderboardScreen;
