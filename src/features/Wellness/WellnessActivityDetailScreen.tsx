import { useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useWellnessActivity } from '../../hooks/useWellnessActivities';
import { BottomNav, Screen } from '../../components/Layout';
import { EmptyState, LoadingSpinner } from '../../components/Mobile';

function WellnessActivityDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: activity, isLoading, error } = useWellnessActivity(id);

  const handleAddToChallenge = () => {
    if (!activity) return;
    const qs = new URLSearchParams({ wellnessActivityId: activity.id });
    navigate(`/app/create-challenge?${qs.toString()}`);
  };

  if (isLoading) return <LoadingSpinner fullScreen label="Loading activity..." />;

  if (error || !activity) {
    return (
      <EmptyState
        icon={<span className="text-5xl">✨</span>}
        title="Activity not found"
        message="This wellness activity may have been removed."
        action={
          <button className="h-11 px-4 rounded-xl bg-primary text-white text-sm font-bold" onClick={() => navigate('/app/wellness-activities')}>
            Back to Wellness Activities
          </button>
        }
      />
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[132px]">
        <div className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 pb-2">
          <header className="st-form-max flex items-center justify-between">
            <button onClick={() => navigate(-1)} className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-900">
              <ArrowLeft size={20} />
            </button>
            <h2 className="text-[22px] leading-[28px] font-black text-slate-900">Activity Detail</h2>
            <div className="h-10 w-10" />
          </header>
        </div>

        {activity.coverImage ? (
          <div className="st-form-max mt-4">
            <div className="h-[200px] rounded-[22px] overflow-hidden border border-slate-100">
              <img src={activity.coverImage} alt={activity.name} className="w-full h-full object-cover" />
            </div>
          </div>
        ) : (
          <div className="st-form-max mt-4">
            <div className="h-[120px] rounded-[22px] bg-primary/10 flex items-center justify-center">
              <span className="text-6xl">{activity.icon ?? '✨'}</span>
            </div>
          </div>
        )}

        <section className="st-form-max mt-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-[24px] leading-[30px] font-black text-slate-900 flex-1">{activity.name}</h1>
            <span className="rounded-full bg-primary/15 px-3 py-2 text-[11px] leading-[12px] tracking-[0.1em] uppercase font-bold text-primary shrink-0">
              {activity.category}
            </span>
          </div>
          <div className="flex gap-2 mt-2">
            <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600 capitalize">
              {activity.difficulty}
            </span>
            {activity.defaultTargetValue ? (
              <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-600">
                Target: {activity.defaultTargetValue} {activity.defaultMetricUnit}
              </span>
            ) : null}
          </div>
        </section>

        {activity.description ? (
          <section className="st-form-max mt-4 st-card p-4 border-primary/20 bg-[#fff6f1]">
            <p className="text-[12px] leading-[14px] tracking-[0.12em] uppercase font-bold text-primary">About</p>
            <p className="mt-2 text-[15px] leading-[22px] font-medium text-slate-700">{activity.description}</p>
          </section>
        ) : null}

        <section className="st-form-max mt-4 grid grid-cols-2 gap-3">
          <div className="st-card p-4">
            <p className="text-[12px] leading-[14px] tracking-[0.1em] uppercase font-bold text-slate-500">Metric</p>
            <p className="mt-2 text-[22px] leading-[28px] font-black text-primary uppercase">{activity.defaultMetricUnit}</p>
          </div>
          <div className="st-card p-4">
            <p className="text-[12px] leading-[14px] tracking-[0.1em] uppercase font-bold text-slate-500">Daily Target</p>
            <p className="mt-2 text-[22px] leading-[28px] font-black text-slate-900">{activity.defaultTargetValue}</p>
            <p className="text-[13px] leading-[17px] text-slate-500">{activity.defaultMetricUnit}</p>
          </div>
        </section>

        {activity.benefits && activity.benefits.length > 0 ? (
          <section className="st-form-max mt-4 st-card p-4 border-green-200 bg-green-50">
            <h4 className="text-[16px] leading-[20px] font-bold text-green-700">Benefits</h4>
            <ul className="mt-2 space-y-1.5">
              {activity.benefits.map((b, i) => (
                <li key={i} className="text-[14px] leading-[20px] text-green-800">• {b}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {activity.guidelines && activity.guidelines.length > 0 ? (
          <section className="st-form-max mt-4 st-card p-0 overflow-hidden">
            <div className="h-12 px-4 flex items-center bg-slate-50 border-b border-slate-100">
              <h4 className="text-[18px] leading-[22px] font-bold text-slate-900">Guidelines</h4>
            </div>
            <ul className="px-4 py-3 space-y-2">
              {activity.guidelines.map((g, i) => (
                <li key={i} className="text-[14px] leading-[22px] text-slate-700">• {g}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {activity.protocolSteps && activity.protocolSteps.length > 0 ? (
          <section className="st-form-max mt-4 st-card p-0 overflow-hidden">
            <div className="h-12 px-4 flex items-center bg-slate-50 border-b border-slate-100">
              <h4 className="text-[18px] leading-[22px] font-bold text-slate-900">Protocol</h4>
            </div>
            <ol className="px-4 py-3 space-y-2">
              {activity.protocolSteps.map((step, i) => (
                <li key={i} className="text-[14px] leading-[22px] text-slate-700">{i + 1}. {step}</li>
              ))}
            </ol>
          </section>
        ) : null}

        {activity.warnings && activity.warnings.length > 0 ? (
          <section className="st-form-max mt-4 st-card p-4 border-amber-200 bg-amber-50">
            <h4 className="text-[16px] leading-[20px] font-bold text-amber-800">Safety Notes</h4>
            <ul className="mt-2 space-y-1.5">
              {activity.warnings.map((w, i) => (
                <li key={i} className="text-[14px] leading-[20px] text-amber-700">• {w}</li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      <div className="fixed bottom-[92px] left-0 right-0 z-30 px-5">
        <div className="mx-auto max-w-mobile">
          <button className="st-btn-primary" onClick={handleAddToChallenge}>
            Add to Challenge
          </button>
        </div>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default WellnessActivityDetailScreen;
