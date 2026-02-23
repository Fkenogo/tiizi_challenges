import { BookOpen, ChevronRight, Dumbbell, Search, Trophy, UserPlus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { getStoredActiveGroupId } from '../../hooks/useActiveGroup';

function QuickActionsScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const activeGroupId = getStoredActiveGroupId();

  const createChallengePath = activeGroupId
    ? `/app/create-challenge?groupId=${activeGroupId}`
    : '/app/groups';
  const logWorkoutPath = activeGroupId
    ? `/app/workouts/select-activity?groupId=${activeGroupId}`
    : '/app/groups';

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame min-h-screen pb-[88px]">
        <div className="fixed inset-0 bg-[#0f172a]/50 backdrop-blur-[2px]" />

        <section className="fixed left-1/2 bottom-[78px] z-30 w-full max-w-mobile -translate-x-1/2 px-4">
          <div className="mx-auto w-full rounded-[26px] bg-white px-5 pt-3 pb-5 border border-slate-200 shadow-[0_12px_30px_rgba(15,23,42,0.2)]">
            <div className="mx-auto h-2 w-[88px] rounded-full bg-[#c7d4e5]" />

            <h1 className="mt-7 text-[20px] leading-[24px] tracking-[-0.01em] font-black text-slate-900">
              Quick Actions
            </h1>
            <p className="mt-2 text-[14px] leading-[20px] text-[#5d7390]">
              What would you like to do today?
            </p>

            <div className="mt-5 space-y-3">
              <button
                className="w-full rounded-[16px] border border-[#f8d6c0] bg-[#fff8f3] px-4 py-3 flex items-center gap-4"
                onClick={() => navigate('/app/create-group')}
              >
                <span className="h-12 w-12 rounded-[12px] bg-primary text-white flex items-center justify-center">
                  <UserPlus size={24} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[16px] leading-[20px] font-black text-slate-900">Create Group</span>
                  <span className="block mt-1 text-[12px] leading-[16px] text-[#60748f]">Build your community</span>
                </span>
                <ChevronRight size={24} className="text-[#9eb0c6]" />
              </button>

              <button
                className="w-full rounded-[16px] border border-slate-200 bg-[#f8fafd] px-4 py-3 flex items-center gap-4"
                onClick={() => {
                  if (!activeGroupId) showToast('Join or create a group first to create challenges.', 'error');
                  navigate(createChallengePath);
                }}
              >
                <span className="h-12 w-12 rounded-[12px] bg-[#f7f1df] text-[#dba700] flex items-center justify-center">
                  <Trophy size={24} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[16px] leading-[20px] font-black text-slate-900">Create Challenge</span>
                  <span className="block mt-1 text-[12px] leading-[16px] text-[#60748f]">Compete with friends</span>
                </span>
                <ChevronRight size={24} className="text-[#9eb0c6]" />
              </button>

              <button
                className="w-full rounded-[16px] border border-slate-200 bg-[#f8fafd] px-4 py-3 flex items-center gap-4"
                onClick={() => {
                  if (!activeGroupId) showToast('Join or create a group first to log workouts.', 'error');
                  navigate(logWorkoutPath);
                }}
              >
                <span className="h-12 w-12 rounded-[12px] bg-[#e8eefb] text-[#3b82f6] flex items-center justify-center">
                  <Dumbbell size={24} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[16px] leading-[20px] font-black text-slate-900">Log Workout</span>
                  <span className="block mt-1 text-[12px] leading-[16px] text-[#60748f]">Share your progress</span>
                </span>
                <ChevronRight size={24} className="text-[#9eb0c6]" />
              </button>

              <button
                className="w-full rounded-[16px] border border-slate-200 bg-[#f8fafd] px-4 py-3 flex items-center gap-4"
                onClick={() => navigate('/app/exercises')}
              >
                <span className="h-12 w-12 rounded-[12px] bg-[#e1f3ef] text-[#10b981] flex items-center justify-center">
                  <Search size={24} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[16px] leading-[20px] font-black text-slate-900">Browse Exercises</span>
                  <span className="block mt-1 text-[12px] leading-[16px] text-[#60748f]">Find your next move</span>
                </span>
                <ChevronRight size={24} className="text-[#9eb0c6]" />
              </button>

              <button
                className="w-full rounded-[16px] border border-slate-200 bg-[#f8fafd] px-4 py-3 flex items-center gap-4"
                onClick={() => navigate('/app/library')}
              >
                <span className="h-12 w-12 rounded-[12px] bg-[#efe9ff] text-[#6d28d9] flex items-center justify-center">
                  <BookOpen size={24} />
                </span>
                <span className="flex-1 text-left">
                  <span className="block text-[16px] leading-[20px] font-black text-slate-900">Read Books</span>
                  <span className="block mt-1 text-[12px] leading-[16px] text-[#60748f]">Read with text-to-speech</span>
                </span>
                <ChevronRight size={24} className="text-[#9eb0c6]" />
              </button>
            </div>

            <button className="mt-5 w-full text-center text-[14px] leading-[18px] font-medium text-[#5f7694]" onClick={() => navigate(-1)}>
              Cancel
            </button>
          </div>
        </section>

        <BottomNav />
      </div>
    </Screen>
  );
}

export default QuickActionsScreen;
