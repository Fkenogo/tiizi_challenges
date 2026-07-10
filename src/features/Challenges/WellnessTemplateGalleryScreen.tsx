import { ArrowLeft, Flame, Search, Trophy, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { LearnMoreLink } from '../../components/LearnMoreLink';
import { LoadingSpinner } from '../../components/Layout/LoadingSpinner';
import { useWellnessTemplates } from '../../hooks/useWellnessTemplates';

const categoryOptions = [
  'all',
  'fasting',
  'hydration',
  'sleep',
  'mindfulness',
  'nutrition',
  'habits',
  'stress',
  'social',
] as const;

const difficultyOptions = ['all', 'beginner', 'intermediate', 'advanced', 'expert'] as const;

type EngineType = 'collective' | 'competitive' | 'streak';

const ENGINE = {
  collective: {
    emoji: '👥',
    icon: <Users size={12} />,
    label: 'Collective',
    badge: 'bg-blue-100 text-blue-700',
    description: 'Team works toward a shared goal. Every contribution adds up.',
  },
  competitive: {
    emoji: '🏆',
    icon: <Trophy size={12} />,
    label: 'Competitive',
    badge: 'bg-amber-100 text-amber-700',
    description: 'Race to hit personal targets. Highest completion wins.',
  },
  streak: {
    emoji: '🔥',
    icon: <Flame size={12} />,
    label: 'Streak',
    badge: 'bg-orange-100 text-orange-700',
    description: 'Log every required day. Consistency is the winning move.',
  },
} satisfies Record<EngineType, { emoji: string; icon: React.ReactNode; label: string; badge: string; description: string }>;

function WellnessTemplateGalleryScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const [category, setCategory] = useState<(typeof categoryOptions)[number]>('all');
  const [difficulty, setDifficulty] = useState<(typeof difficultyOptions)[number]>('all');
  const [search, setSearch] = useState('');
  const [engineFilter, setEngineFilter] = useState<'all' | EngineType>('all');

  const { data = [], isLoading, isError } = useWellnessTemplates({ category, difficulty });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesEngine = engineFilter === 'all' || item.type === engineFilter;
      const matchesSearch = !term || (
        item.name.toLowerCase().includes(term)
        || item.description.toLowerCase().includes(term)
        || item.category.toLowerCase().includes(term)
      );
      return matchesEngine && matchesSearch;
    });
  }, [data, search, engineFilter]);

  const grouped = useMemo(() => ({
    collective: filtered.filter((t) => t.type === 'collective'),
    competitive: filtered.filter((t) => t.type === 'competitive'),
    streak: filtered.filter((t) => t.type === 'streak'),
  }), [filtered]);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading wellness templates..." />;

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 pt-4 pb-2 flex items-center gap-2">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges')}>
            <ArrowLeft size={24} className="text-slate-900" />
          </button>
          <div className="flex-1 flex flex-col">
            <h1 className="st-page-title">Wellness Templates</h1>
            <LearnMoreLink section="templates" />
          </div>
        </header>

        <main className="px-4">
          <div className="mt-2 relative">
            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search wellness templates..."
              className="h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-sm"
            />
          </div>

          {/* Engine filter */}
          <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">
            {([['all', 'All'], ['collective', '👥 Collective'], ['competitive', '🏆 Competitive'], ['streak', '🔥 Streak']] as const).map(([key, label]) => (
              <button
                key={key}
                className={`h-9 rounded-xl px-3 text-xs font-bold whitespace-nowrap ${engineFilter === key ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                onClick={() => setEngineFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">
            {categoryOptions.map((option) => (
              <button
                key={option}
                className={`h-9 rounded-xl px-3 text-xs font-bold uppercase whitespace-nowrap ${category === option ? 'bg-primary text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                onClick={() => setCategory(option)}
              >
                {option}
              </button>
            ))}
          </div>

          <div className="mt-2 flex gap-2 overflow-x-auto hide-scrollbar">
            {difficultyOptions.map((option) => (
              <button
                key={option}
                className={`h-9 rounded-xl px-3 text-xs font-bold capitalize whitespace-nowrap ${difficulty === option ? 'bg-slate-900 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}
                onClick={() => setDifficulty(option)}
              >
                {option}
              </button>
            ))}
          </div>

          {/* Grouped view (all engines) */}
          {engineFilter === 'all' ? (
            <div className="mt-4">
              {(['collective', 'competitive', 'streak'] as EngineType[]).map((type) => {
                const group = grouped[type];
                const e = ENGINE[type];
                if (group.length === 0) return null;
                return (
                  <section key={type} className="mb-6">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[16px]">{e.emoji}</span>
                      <p className="text-[13px] font-black text-slate-900">{e.label}</p>
                      <span className={`ml-auto rounded-full px-2 py-0.5 text-[10px] font-bold ${e.badge}`}>{group.length}</span>
                    </div>
                    <p className="text-[11px] text-slate-500 mb-3">{e.description}</p>
                    <div className="space-y-3">
                      {group.map((template) => (
                        <article key={template.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                          <button className="w-full text-left" onClick={() => navigate(`/app/challenges/wellness/${template.id}${groupId ? `?groupId=${groupId}` : ''}`)}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="text-xs uppercase tracking-[0.08em] text-primary font-bold">{template.category}</p>
                                <h2 className="mt-1 text-base font-black text-slate-900">{template.name}</h2>
                                <p className="mt-1 text-sm text-slate-600">{template.description}</p>
                              </div>
                              <span className="text-2xl flex-shrink-0">{template.icon ?? '✨'}</span>
                            </div>
                            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                              <span className="rounded-lg bg-slate-100 px-2 py-1">{template.difficulty}</span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1">{template.duration} days</span>
                              <span className="rounded-lg bg-slate-100 px-2 py-1">{template.activities.length} {template.activities.length === 1 ? 'activity' : 'activities'}</span>
                              <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${e.badge}`}>
                                {e.icon}{e.label}
                              </span>
                            </div>
                          </button>
                        </article>
                      ))}
                    </div>
                  </section>
                );
              })}
              {filtered.length === 0 && (
                <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  No wellness templates match your filters.
                </article>
              )}
            </div>
          ) : (
            /* Single engine filter: flat list */
            <section className="mt-4 space-y-3">
              {(() => {
                const e = ENGINE[engineFilter as EngineType];
                return (
                  <div className={`rounded-xl border ${engineFilter === 'collective' ? 'border-blue-200 bg-blue-50' : engineFilter === 'competitive' ? 'border-amber-200 bg-amber-50' : 'border-orange-200 bg-orange-50'} px-3 py-2.5`}>
                    <p className="text-[12px] font-semibold text-slate-600">{e.emoji} {e.description}</p>
                  </div>
                );
              })()}
              {filtered.map((template) => {
                const e = ENGINE[template.type as EngineType] ?? ENGINE.collective;
                return (
                  <article key={template.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                    <button className="w-full text-left" onClick={() => navigate(`/app/challenges/wellness/${template.id}${groupId ? `?groupId=${groupId}` : ''}`)}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-xs uppercase tracking-[0.08em] text-primary font-bold">{template.category}</p>
                          <h2 className="mt-1 text-base font-black text-slate-900">{template.name}</h2>
                          <p className="mt-1 text-sm text-slate-600">{template.description}</p>
                        </div>
                        <span className="text-2xl flex-shrink-0">{template.icon ?? '✨'}</span>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-lg bg-slate-100 px-2 py-1">{template.difficulty}</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1">{template.duration} days</span>
                        <span className="rounded-lg bg-slate-100 px-2 py-1">{template.activities.length} {template.activities.length === 1 ? 'activity' : 'activities'}</span>
                        <span className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${e.badge}`}>
                          {e.icon}{e.label}
                        </span>
                      </div>
                    </button>
                  </article>
                );
              })}
              {filtered.length === 0 && (
                <article className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-500">
                  No wellness templates match your filters.
                </article>
              )}
              {isError && (
                <article className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  Could not load wellness templates. Please refresh and try again.
                </article>
              )}
            </section>
          )}
          {isError && engineFilter === 'all' && (
            <article className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 mt-3">
              Could not load wellness templates. Please refresh and try again.
            </article>
          )}
        </main>
      </div>
      <BottomNav active="challenges" />
    </Screen>
  );
}

export default WellnessTemplateGalleryScreen;
