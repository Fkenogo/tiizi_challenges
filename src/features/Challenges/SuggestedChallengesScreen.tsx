import { ArrowLeft, Clock3, Search, Star, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useSuggestedChallengeTemplates } from '../../hooks/useChallengeTemplates';
import type { SuggestedChallengeTemplate } from '../../services/challengeTemplateService';

type FilterType = 'all' | 'collective' | 'competitive' | 'streak';
const isValidHttpImage = (value?: string) => !!value && /^https?:\/\//i.test(value);

function SuggestedChallengesScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const previewTemplateId = params.get('previewTemplateId') ?? undefined;
  const { data } = useSuggestedChallengeTemplates();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [previewTemplate, setPreviewTemplate] = useState<SuggestedChallengeTemplate | null>(null);

  const templates = (data ?? []).filter((template) => {
    const matchesFilter = filter === 'all' || template.challengeType === filter;
    const matchesSearch =
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const modalActivity = useMemo(() => previewTemplate?.activities[0], [previewTemplate]);

  useEffect(() => {
    if (!previewTemplateId) return;
    const list = data ?? [];
    const found = list.find((item) => item.id === previewTemplateId);
    if (found) setPreviewTemplate(found);
  }, [previewTemplateId, data]);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[96px]">
        <header className="st-form-max flex items-center gap-2">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges')}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <h1 className="st-page-title">Suggested Challenges</h1>
        </header>

        <div className="st-form-max mt-4 relative">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a challenge..."
            className="h-12 w-full rounded-[16px] border border-slate-200 bg-white pl-12 pr-4 text-[14px] leading-[20px] text-slate-600 font-medium"
          />
        </div>

        <div className="st-form-max mt-3 flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
          {([
            ['all', 'All'],
            ['collective', 'Collective'],
            ['competitive', 'Competitive'],
            ['streak', 'Streak'],
          ] as const).map(([key, label]) => (
              <button
                key={key}
                className={`h-10 px-5 rounded-[16px] text-[14px] leading-[16px] font-bold whitespace-nowrap ${filter === key ? 'bg-primary text-white' : 'bg-[#efece8] text-slate-900'}`}
                onClick={() => setFilter(key)}
              >
                {label}
            </button>
          ))}
        </div>

        <div className="st-form-max mt-4 space-y-4">
          {templates.map((template) => (
            <article key={template.id} className="st-card overflow-hidden">
              <div className="relative" style={{ height: 270, minHeight: 270, maxHeight: 270 }}>
                <img
                  src={
                    isValidHttpImage(template.coverImageUrl)
                      ? template.coverImageUrl!
                      : 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=1200&q=80'
                  }
                  alt={template.name}
                  className="h-full w-full object-cover"
                  style={{ display: 'block' }}
                />
                <span className={`absolute top-4 left-4 rounded-full px-4 py-2 text-[14px] leading-[14px] tracking-[0.08em] uppercase font-bold text-white ${template.tag?.toLowerCase() === 'hardcore' ? 'bg-red-500' : 'bg-primary'}`}>
                  {template.tag || 'Trending'}
                </span>
              </div>

              <div className="p-4">
                <div className="flex items-start justify-between gap-3">
                  <h2 className="text-[13px] leading-[18px] font-black text-slate-900">{template.name}</h2>
                  <Star size={20} className="text-primary fill-primary shrink-0" />
                </div>
                <p className="mt-2 text-[13px] leading-[19px] text-[#546b89] font-medium">{template.description}</p>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-3 text-[13px] leading-[17px] font-semibold text-slate-500">
                    <span className="flex items-center gap-1"><Clock3 size={16} /> {template.durationDays} Days</span>
                    <span className="flex items-center gap-1"><Users size={16} /> {template.popularityText || '0 joined'}</span>
                  </div>
                  <button className="h-10 px-5 rounded-[12px] bg-primary text-white text-[14px] font-bold shrink-0" onClick={() => setPreviewTemplate(template)}>
                    Use Template
                  </button>
                </div>
              </div>
            </article>
          ))}
          {templates.length === 0 && (
            <article className="st-card p-5">
              <h2 className="text-[16px] leading-[22px] font-black text-slate-900">No suggested challenges yet</h2>
              <p className="mt-2 text-[14px] leading-[20px] text-slate-600">Your admin can publish reusable templates from the admin dashboard.</p>
            </article>
          )}
        </div>
      </div>

      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px]">
          <div className="absolute inset-x-0 bottom-[78px]">
            <div className="mx-auto w-full max-w-mobile px-4">
              <div className="st-card overflow-hidden rounded-[26px]">
            <div className="relative h-[230px]">
              <img
                src={
                  isValidHttpImage(previewTemplate.coverImageUrl)
                    ? previewTemplate.coverImageUrl!
                    : 'https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1200&q=80'
                }
                alt={previewTemplate.name}
                className="h-full w-full object-cover"
              />
              <button className="absolute top-4 right-4 h-10 w-10 rounded-full bg-slate-900/45 text-white flex items-center justify-center" onClick={() => setPreviewTemplate(null)}>
                <X size={26} />
              </button>
              <span className="absolute left-4 bottom-4 rounded-full bg-primary px-4 py-2 text-[13px] leading-[13px] tracking-[0.08em] uppercase font-bold text-white">
                Weekly
              </span>
            </div>

            <div className="p-5">
              <h2 className="text-[14px] leading-[19px] font-black tracking-[-0.01em] text-slate-900">{previewTemplate.name}</h2>
              <p className="mt-3 text-[14px] leading-[21px] text-[#9a5f28]">{previewTemplate.description}</p>

              <div className="mt-4 st-card p-4 border-[#f7d2ba] bg-[#fff8f4] flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-16 w-16 rounded-2xl bg-primary/15 text-primary text-[28px] flex items-center justify-center">✕</div>
                  <div>
                    <p className="text-[14px] leading-[20px] font-black text-slate-900">{modalActivity?.exerciseName || 'Activity'}</p>
                    <p className="text-[14px] leading-[20px] text-[#9a5f28]">Activity Type</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[18px] leading-[22px] font-black text-primary">{modalActivity?.targetValue || 0} {modalActivity?.unit || 'Reps'}</p>
                  <p className="text-[14px] leading-[20px] text-[#9a5f28]">Target Goal</p>
                </div>
              </div>

              <button
                className="st-btn-primary mt-5"
                onClick={() => {
                  const query = new URLSearchParams({ templateId: previewTemplate.id });
                  if (groupId) query.set('groupId', groupId);
                  navigate(`/app/create-challenge?${query.toString()}`);
                }}
              >
                Proceed to Create
              </button>
            </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <BottomNav active="challenges" />
    </Screen>
  );
}

export default SuggestedChallengesScreen;
