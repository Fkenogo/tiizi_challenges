import { ArrowLeft, AlertTriangle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { LoadingSpinner } from '../../components/Layout/LoadingSpinner';
import { useMyGroups } from '../../hooks/useGroups';
import { useWellnessTemplate } from '../../hooks/useWellnessTemplates';

function WellnessTemplateDetailScreen() {
  const navigate = useNavigate();
  const { id } = useParams();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const { data: template, isLoading } = useWellnessTemplate(id);
  const { data: myGroups = [] } = useMyGroups();
  const [selectedGroupId, setSelectedGroupId] = useState<string>('');

  useEffect(() => {
    if (groupId && myGroups.some((group) => group.id === groupId)) {
      setSelectedGroupId(groupId);
      return;
    }
    setSelectedGroupId('');
  }, [groupId, myGroups]);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading template..." />;
  if (!template) {
    return (
      <Screen className="st-page">
        <div className="st-frame">
          <p className="text-sm text-slate-500">Template not found.</p>
          <button className="mt-3 h-10 rounded-xl bg-primary px-4 text-sm font-bold text-white" onClick={() => navigate('/app/challenges/wellness')}>
            Back to Wellness Templates
          </button>
        </div>
      </Screen>
    );
  }

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 pt-4 pb-2 flex items-center gap-2">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges/wellness')}>
            <ArrowLeft size={24} className="text-slate-900" />
          </button>
          <h1 className="st-page-title">Wellness Template</h1>
        </header>

        <main className="px-4 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.08em] text-primary font-bold">{template.category}</p>
                <h2 className="mt-1 text-xl font-black text-slate-900">{template.name}</h2>
              </div>
              <span className="text-3xl">{template.icon ?? '✨'}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{template.description}</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded-lg bg-slate-100 px-2 py-1">{template.difficulty}</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1">{template.duration} days</span>
              <span className="rounded-lg bg-slate-100 px-2 py-1">{template.type}</span>
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.08em]">Protocol Details</h3>
            <div className="mt-3 space-y-3">
              {template.activities.map((activity) => (
                <article key={activity.activityId} className="rounded-xl border border-slate-200 p-3">
                  <p className="text-sm font-bold text-slate-900">{activity.name}</p>
                  <p className="mt-1 text-xs text-slate-600">
                    Target: {activity.targetValue} {activity.metricUnit} • {activity.dailyFrequency ?? 1}x/day
                  </p>
                  {(activity.instructions && activity.instructions.length > 0) || (activity.protocolSteps && activity.protocolSteps.length > 0) ? (
                    <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-slate-600">
                      {(activity.instructions ?? activity.protocolSteps ?? []).slice(0, 4).map((line) => (
                        <li key={line}>{line}</li>
                      ))}
                    </ul>
                  ) : null}
                </article>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.08em]">Benefits</h3>
            {(template.benefits ?? []).length > 0 ? (
              <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-slate-600">
                {(template.benefits ?? []).map((benefit) => (
                  <li key={benefit}>{benefit}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No benefits listed for this template yet.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-black text-slate-900 uppercase tracking-[0.08em]">Guidelines</h3>
            {(template.guidelines ?? []).length > 0 ? (
              <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-slate-600">
                {(template.guidelines ?? []).map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-xs text-slate-500">No guidelines listed for this template yet.</p>
            )}
          </section>

          {template.warnings && template.warnings.length > 0 && (
            <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 text-amber-700">
                <AlertTriangle size={16} />
                <h3 className="text-sm font-black uppercase tracking-[0.08em]">Warnings</h3>
              </div>
              <ul className="mt-2 list-disc pl-4 space-y-1 text-xs text-amber-700">
                {template.warnings.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </section>
          )}

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <div>
              <label className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-700">
                Select Group
              </label>
              <select
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-800"
                value={selectedGroupId}
                onChange={(event) => setSelectedGroupId(event.target.value)}
              >
                <option value="">Choose group first</option>
                {myGroups.map((group) => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
              </select>
            </div>
            <button
              className="mt-3 h-12 w-full rounded-xl bg-primary text-white text-sm font-black disabled:opacity-50"
              disabled={!selectedGroupId}
              onClick={() => navigate(`/app/create-challenge?wellnessTemplateId=${template.id}${selectedGroupId ? `&groupId=${selectedGroupId}` : ''}`)}
            >
              Adopt to Group
            </button>
            {!selectedGroupId && (
              <p className="mt-2 text-xs text-slate-500">Join at least one group before adopting this template.</p>
            )}
          </section>
        </main>
      </div>
      <BottomNav active="challenges" />
    </Screen>
  );
}

export default WellnessTemplateDetailScreen;
