import { ArrowLeft, Search } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
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

function WellnessTemplateGalleryScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const [category, setCategory] = useState<(typeof categoryOptions)[number]>('all');
  const [difficulty, setDifficulty] = useState<(typeof difficultyOptions)[number]>('all');
  const [search, setSearch] = useState('');

  const { data = [], isLoading, isError } = useWellnessTemplates({ category, difficulty });

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return data;
    return data.filter((item) =>
      item.name.toLowerCase().includes(term)
      || item.description.toLowerCase().includes(term)
      || item.category.toLowerCase().includes(term));
  }, [data, search]);

  if (isLoading) return <LoadingSpinner fullScreen label="Loading wellness templates..." />;

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-50 px-4 pt-4 pb-2 flex items-center gap-2">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges')}>
            <ArrowLeft size={24} className="text-slate-900" />
          </button>
          <h1 className="st-page-title">Wellness Templates</h1>
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

          <div className="mt-3 flex gap-2 overflow-x-auto hide-scrollbar">
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

          <section className="mt-4 space-y-3">
            {filtered.map((template) => (
              <article key={template.id} className="rounded-2xl border border-slate-200 bg-white p-3">
                <button className="w-full text-left" onClick={() => navigate(`/app/challenges/wellness/${template.id}${groupId ? `?groupId=${groupId}` : ''}`)}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs uppercase tracking-[0.08em] text-primary font-bold">{template.category}</p>
                      <h2 className="mt-1 text-base font-black text-slate-900">{template.name}</h2>
                      <p className="mt-1 text-sm text-slate-600">{template.description}</p>
                    </div>
                    <span className="text-2xl">{template.icon ?? '✨'}</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2 text-xs text-slate-600">
                    <span className="rounded-lg bg-slate-100 px-2 py-1">{template.difficulty}</span>
                    <span className="rounded-lg bg-slate-100 px-2 py-1">{template.duration} days</span>
                    <span className="rounded-lg bg-slate-100 px-2 py-1">{template.activities.length} activity</span>
                  </div>
                </button>
              </article>
            ))}
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
        </main>
      </div>
      <BottomNav active="challenges" />
    </Screen>
  );
}

export default WellnessTemplateGalleryScreen;
