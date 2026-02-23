import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Dumbbell, Home, Plus, Trophy, User, Users } from 'lucide-react';
import { useExercise } from '../../hooks/useExercises';
import { Screen } from '../../components/Layout';
import { EmptyState, LoadingSpinner } from '../../components/Mobile';

function ExerciseDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;
  const { data: exercise, isLoading, error } = useExercise(id);

  const backPath = `/app/exercises${challengeId ? `?challengeId=${challengeId}${groupId ? `&groupId=${groupId}` : ''}` : ''}`;

  if (isLoading) return <LoadingSpinner fullScreen label="Loading exercise..." />;

  if (error || !exercise) {
    return (
      <EmptyState
        icon={<Dumbbell size={48} />}
        title="Exercise not found"
        message="This exercise may have been removed."
        action={(
          <button className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate(backPath)}>
            Back to Exercises
          </button>
        )}
      />
    );
  }

  const handleStart = () => {
    const qs = new URLSearchParams({ exerciseId: exercise.id });
    if (challengeId) qs.set('challengeId', challengeId);
    if (groupId) qs.set('groupId', groupId);
    navigate(`/app/workouts/log?${qs.toString()}`);
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[132px]">
        <header className="st-form-max flex items-center justify-between">
          <button onClick={() => navigate(backPath)} className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
            <ArrowLeft size={20} />
          </button>
          <h2 className="text-[28px] leading-[30px] font-black text-slate-900">Exercise Detail</h2>
          <button className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-primary text-[20px]">♥</button>
        </header>

        <div className="st-form-max mt-4">
          <div className="h-[230px] rounded-[22px] overflow-hidden border border-slate-100">
            <img
              src="https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1100&q=80"
              alt={exercise.name}
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <section className="st-form-max mt-5">
          <div className="flex items-center justify-between gap-3">
            <h1 className="text-[24px] leading-[30px] font-black text-slate-900">{exercise.name}</h1>
            <span className="rounded-full bg-primary/15 px-3 py-2 text-[12px] leading-[12px] tracking-[0.1em] uppercase font-bold text-primary">
              {exercise.tier_2}
            </span>
          </div>
        </section>

        <section className="st-form-max mt-4 st-card p-4 border-primary/20 bg-[#fff6f1]">
          <p className="text-[12px] leading-[14px] tracking-[0.12em] uppercase font-bold text-primary">Benefits</p>
          <p className="mt-2 text-[16px] leading-[24px] font-medium text-slate-700">{exercise.description || 'Builds upper body strength and core stability.'}</p>
        </section>

        <section className="st-form-max mt-4 grid grid-cols-2 gap-3">
          <div className="st-card p-4">
            <p className="text-[12px] leading-[14px] tracking-[0.1em] uppercase font-bold text-slate-500">Metric Unit</p>
            <p className="mt-2 text-[24px] leading-[30px] font-black text-primary">{exercise.metric.unit.toUpperCase()}</p>
          </div>
          <div className="st-card p-4">
            <p className="text-[12px] leading-[14px] tracking-[0.1em] uppercase font-bold text-slate-500">Recommended</p>
            <p className="mt-2 text-[24px] leading-[30px] font-black text-slate-900">10-20</p>
            <p className="text-[14px] leading-[18px] text-slate-500">per set</p>
          </div>
        </section>

        <section className="st-form-max mt-5">
          <h3 className="text-[24px] leading-[30px] font-black text-slate-900">Instructions</h3>

          {exercise.setup.length > 0 && (
            <div className="st-card p-0 overflow-hidden mt-3">
              <div className="h-12 px-4 flex items-center bg-slate-50 border-b border-slate-100">
                <h4 className="text-[20px] leading-[22px] font-bold text-slate-900">Setup</h4>
              </div>
              <div className="px-4 py-4">
                <p className="text-[16px] leading-[30px] text-[#273d5a]">{exercise.setup.join(' ')}</p>
              </div>
            </div>
          )}

          {exercise.execution.length > 0 && (
            <div className="st-card p-0 overflow-hidden mt-3">
              <div className="h-12 px-4 flex items-center bg-slate-50 border-b border-slate-100">
                <h4 className="text-[20px] leading-[22px] font-bold text-slate-900">Execution</h4>
              </div>
              <div className="px-4 py-4">
                <p className="text-[16px] leading-[30px] text-[#273d5a]">{exercise.execution.join(' ')}</p>
              </div>
            </div>
          )}

          {exercise.formCues.length > 0 && (
            <div className="st-card mt-3 p-4 border-green-200 bg-green-50">
              <h4 className="text-[18px] leading-[22px] font-bold text-green-700">Cues</h4>
              <ul className="mt-2 space-y-2">
                {exercise.formCues.slice(0, 3).map((cue) => (
                  <li key={cue} className="text-[16px] leading-[24px] text-green-800">• {cue}</li>
                ))}
              </ul>
            </div>
          )}

          {exercise.commonMistakes.length > 0 && (
            <div className="st-card mt-3 p-4 border-red-200 bg-red-50">
              <h4 className="text-[18px] leading-[22px] font-bold text-red-700">Common Mistakes</h4>
              <ul className="mt-2 space-y-2">
                {exercise.commonMistakes.slice(0, 3).map((mistake) => (
                  <li key={mistake} className="text-[16px] leading-[24px] text-red-700">• {mistake}</li>
                ))}
              </ul>
            </div>
          )}

          {exercise.safetyNotes.length > 0 && (
            <div className="st-card mt-3 p-4 border-amber-200 bg-amber-50">
              <h4 className="text-[18px] leading-[22px] font-bold text-amber-800">Safety First</h4>
              <p className="mt-1 text-[16px] leading-[24px] text-amber-700">{exercise.safetyNotes[0]}</p>
            </div>
          )}
        </section>
      </div>

      <div className="fixed bottom-[92px] left-0 right-0 z-30 px-5">
        <div className="mx-auto max-w-mobile">
          <button className="st-btn-primary" onClick={handleStart}>START EXERCISE</button>
        </div>
      </div>

      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 px-4 py-3 z-20">
        <div className="max-w-mobile mx-auto flex items-end justify-between">
          <button className="h-11 min-w-[64px] flex flex-col items-center justify-center text-slate-500" onClick={() => navigate('/app/home')}>
            <Home size={20} />
            <span className="text-xs">Home</span>
          </button>
          <button className="h-11 min-w-[64px] flex flex-col items-center justify-center text-slate-500" onClick={() => navigate('/app/groups')}>
            <Users size={20} />
            <span className="text-xs">Groups</span>
          </button>
          <div className="-mt-6">
            <button className="w-14 h-14 rounded-full bg-primary text-white flex items-center justify-center shadow-lg" onClick={() => navigate('/app/quick-actions')}>
              <Plus size={24} />
            </button>
          </div>
          <button className="h-11 min-w-[64px] flex flex-col items-center justify-center text-slate-500" onClick={() => navigate('/app/challenges')}>
            <Trophy size={20} />
            <span className="text-xs">Challenges</span>
          </button>
          <button className="h-11 min-w-[64px] flex flex-col items-center justify-center text-primary" onClick={() => navigate('/app/profile')}>
            <User size={20} />
            <span className="text-xs font-bold">Profile</span>
          </button>
        </div>
      </nav>
    </Screen>
  );
}

export default ExerciseDetailScreen;
