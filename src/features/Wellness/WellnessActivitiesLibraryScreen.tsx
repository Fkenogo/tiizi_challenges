import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Search } from 'lucide-react';
import { useWellnessActivities } from '../../hooks/useWellnessActivities';
import { BottomNav, Screen } from '../../components/Layout';
import { LoadingSpinner } from '../../components/Mobile';
import type { WellnessCategory } from '../../types/wellnessActivity';

const CATEGORIES: { label: string; value: WellnessCategory | 'all' }[] = [
  { label: 'All', value: 'all' },
  { label: 'Fasting', value: 'fasting' },
  { label: 'Hydration', value: 'hydration' },
  { label: 'Sleep', value: 'sleep' },
  { label: 'Mindfulness', value: 'mindfulness' },
  { label: 'Nutrition', value: 'nutrition' },
  { label: 'Habits', value: 'habits' },
  { label: 'Stress', value: 'stress' },
  { label: 'Movement', value: 'movement' },
  { label: 'Social', value: 'social' },
  { label: 'Health', value: 'health-monitoring' },
];

function WellnessActivitiesLibraryScreen() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState<WellnessCategory | 'all'>('all');

  const { data: activities = [], isLoading } = useWellnessActivities({
    category,
    search: search.trim().length >= 2 ? search.trim() : undefined,
  });

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[96px]">
        <header className="st-header flex items-center gap-3 px-4 pt-4 pb-3">
          <button
            className="h-11 w-11 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center shrink-0"
            onClick={() => navigate(-1)}
          >
            <ArrowLeft size={22} />
          </button>
          <h1 className="st-title flex-1">Wellness Activities</h1>
        </header>

        <div className="px-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              type="search"
              placeholder="Search activities…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full h-11 rounded-xl border border-slate-200 bg-white pl-9 pr-4 text-[14px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="mt-3 -mx-0 overflow-x-auto px-4 hide-scrollbar">
          <div className="flex gap-2 pb-1">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.value}
                className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition-colors ${
                  category === cat.value
                    ? 'bg-primary text-white'
                    : 'bg-slate-100 text-slate-600'
                }`}
                onClick={() => setCategory(cat.value)}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 px-4">
          {isLoading ? (
            <LoadingSpinner fullScreen={false} label="Loading activities…" />
          ) : activities.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-12">No activities found.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {activities.map((item) => (
                <article
                  key={item.id}
                  className="rounded-[14px] border border-slate-200 bg-white p-3 flex items-start gap-3 active:bg-slate-50"
                >
                  <button
                    className="flex items-start gap-3 w-full text-left"
                    onClick={() => navigate(`/app/wellness-activities/${item.id}`)}
                  >
                    <span className="text-2xl shrink-0 mt-0.5">{item.icon ?? '✨'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[14px] leading-[18px] font-black text-slate-900">{item.name}</p>
                      <p className="text-[12px] text-slate-500 capitalize mt-0.5">
                        {item.category} · {item.difficulty}
                      </p>
                      {item.defaultTargetValue ? (
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Target: {item.defaultTargetValue} {item.defaultMetricUnit}
                        </p>
                      ) : null}
                    </div>
                    <span className="text-slate-300 text-lg mt-0.5">›</span>
                  </button>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default WellnessActivitiesLibraryScreen;
