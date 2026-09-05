import { ArrowLeft, Clock3, Flame, Search, Trophy, Users, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';
import { useSuggestedChallengeTemplates } from '../../hooks/useChallengeTemplates';
import type { SuggestedChallengeTemplate } from '../../services/challengeTemplateService';
import { isLikelyDirectImageUrl } from '../../services/imageUploadService';

type FilterType = 'all' | 'collective' | 'competitive' | 'streak';
const canRenderImage = (value?: string) => !!value && isLikelyDirectImageUrl(value);

type EngineType = 'collective' | 'competitive' | 'streak';

const ENGINE = {
  collective: {
    icon: <Users size={14} />,
    emoji: '👥',
    label: 'Collective',
    badge: 'bg-blue-100 text-blue-700',
    accentBg: 'bg-blue-50',
    accentBorder: 'border-blue-200',
    accentText: 'text-blue-700',
    headline: 'The team wins together.',
    explanation: "Every member contributes to a shared goal. There's no finish line until everyone crosses it together.",
    completionModel: 'Group reaches a shared cumulative target',
    leaderboardModel: 'Ranked by total contribution',
    winnerRule: 'The team succeeds as a unit',
  },
  competitive: {
    icon: <Trophy size={14} />,
    emoji: '🏆',
    label: 'Competitive',
    badge: 'bg-amber-100 text-amber-700',
    accentBg: 'bg-amber-50',
    accentBorder: 'border-amber-200',
    accentText: 'text-amber-700',
    headline: 'Race to the finish.',
    explanation: 'Each member pushes toward their own targets. Completion percentage decides the winner.',
    completionModel: 'Each member hits all per-activity cumulative targets',
    leaderboardModel: 'Ranked by completion % — tiebreaker: total points',
    winnerRule: 'Highest completion % wins',
  },
  streak: {
    icon: <Flame size={14} />,
    emoji: '🔥',
    label: 'Streak',
    badge: 'bg-orange-100 text-orange-700',
    accentBg: 'bg-orange-50',
    accentBorder: 'border-orange-200',
    accentText: 'text-orange-700',
    headline: 'Show up every day.',
    explanation: 'Consistency is the skill. Log every required day to keep your streak alive — miss one and the clock resets.',
    completionModel: 'Log every required consecutive day',
    leaderboardModel: 'Personal progress — no ranking',
    winnerRule: 'Beat your own best streak',
  },
} satisfies Record<EngineType, {
  icon: React.ReactNode;
  emoji: string;
  label: string;
  badge: string;
  accentBg: string;
  accentBorder: string;
  accentText: string;
  headline: string;
  explanation: string;
  completionModel: string;
  leaderboardModel: string;
  winnerRule: string;
}>;

function EngineExplanationCallout({ type }: { type: EngineType }) {
  const e = ENGINE[type];
  return (
    <div className={`rounded-2xl border ${e.accentBorder} ${e.accentBg} px-4 py-3 flex items-start gap-3`}>
      <span className="text-[22px] leading-none mt-0.5">{e.emoji}</span>
      <div>
        <p className={`text-[13px] leading-[17px] font-black ${e.accentText}`}>{e.headline}</p>
        <p className="mt-1 text-[12px] leading-[17px] text-slate-600">{e.explanation}</p>
        <div className="mt-2 grid grid-cols-1 gap-0.5">
          <p className="text-[11px] text-slate-500"><span className="font-semibold">Completion:</span> {e.completionModel}</p>
          <p className="text-[11px] text-slate-500"><span className="font-semibold">Leaderboard:</span> {e.leaderboardModel}</p>
          <p className="text-[11px] text-slate-500"><span className="font-semibold">Winner:</span> {e.winnerRule}</p>
        </div>
      </div>
    </div>
  );
}

function TemplateListCard({ template, onPreview }: { template: SuggestedChallengeTemplate; onPreview: (t: SuggestedChallengeTemplate) => void }) {
  const engineType = template.challengeType as EngineType;
  const e = ENGINE[engineType] ?? ENGINE.collective;
  return (
    <article className="st-card overflow-hidden">
      <div className="relative" style={{ height: 200, minHeight: 200, maxHeight: 200 }}>
        {canRenderImage(template.coverImageUrl) ? (
          <img src={template.coverImageUrl} alt={template.name} className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-400 text-[12px] font-semibold">
            No cover image
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
        <span className={`absolute top-3 left-3 rounded-full px-3 py-1 text-[11px] leading-[13px] font-bold uppercase ${
          template.tag?.toLowerCase() === 'hardcore' ? 'bg-red-500 text-white' : 'bg-primary text-white'
        }`}>
          {template.tag || 'Featured'}
        </span>
        <span className={`absolute top-3 right-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold ${e.badge}`}>
          {e.icon}{e.label}
        </span>
      </div>

      <div className="p-4">
        <h2 className="text-[14px] leading-[19px] font-black text-slate-900">{template.name}</h2>
        <p className="mt-1.5 text-[13px] leading-[19px] text-[#546b89] font-medium">{template.description}</p>

        <div className="mt-3 flex flex-wrap items-center gap-2 text-[12px] font-semibold text-slate-500">
          <span className="flex items-center gap-1"><Clock3 size={13} /> {template.durationDays} days</span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px]">{template.difficultyLevel}</span>
          <span className="rounded-lg bg-slate-100 px-2 py-1 text-[11px]">{template.activityCount} {template.activityCount === 1 ? 'activity' : 'activities'}</span>
          {template.popularityText && (
            <span className="text-[11px] text-slate-400">{template.popularityText}</span>
          )}
        </div>

        <button
          className="mt-4 h-10 w-full rounded-xl bg-primary text-white text-[14px] font-bold"
          onClick={() => onPreview(template)}
        >
          Use Template
        </button>
      </div>
    </article>
  );
}

function SuggestedChallengesScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const groupId = params.get('groupId') ?? undefined;
  const previewTemplateId = params.get('previewTemplateId') ?? undefined;
  const { data } = useSuggestedChallengeTemplates();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<FilterType>('all');
  const [previewTemplate, setPreviewTemplate] = useState<SuggestedChallengeTemplate | null>(null);

  const allTemplates = data ?? [];
  const filtered = allTemplates.filter((template) => {
    const matchesFilter = filter === 'all' || template.challengeType === filter;
    const matchesSearch =
      template.name.toLowerCase().includes(search.toLowerCase()) ||
      template.description.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const grouped = useMemo(() => ({
    collective: filtered.filter((t) => t.challengeType === 'collective'),
    competitive: filtered.filter((t) => t.challengeType === 'competitive'),
    streak: filtered.filter((t) => t.challengeType === 'streak'),
  }), [filtered]);

  const modalActivity = useMemo(() => previewTemplate?.activities[0], [previewTemplate]);

  useEffect(() => {
    if (!previewTemplateId) return;
    const found = allTemplates.find((item) => item.id === previewTemplateId);
    if (found) setPreviewTemplate(found);
  }, [previewTemplateId, allTemplates]);

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[96px]">
        <header className="st-form-max flex items-center gap-2">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges')}>
            <ArrowLeft size={28} className="text-slate-900" />
          </button>
          <h1 className="st-page-title">Challenge Templates</h1>
        </header>

        <div className="st-form-max mt-4 relative">
          <Search size={22} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Find a challenge..."
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-12 pr-4 text-[14px] leading-[20px] text-slate-600 font-medium"
          />
        </div>

        <div className="st-form-max mt-3 flex gap-3 overflow-x-auto pb-1 hide-scrollbar">
          {([
            ['all', 'All'],
            ['collective', '👥 Collective'],
            ['competitive', '🏆 Competitive'],
            ['streak', '🔥 Streak'],
          ] as const).map(([key, label]) => (
            <button
              key={key}
              className={`h-10 px-5 rounded-full text-[13px] leading-[16px] font-bold whitespace-nowrap ${filter === key ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
              onClick={() => setFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Single-type filter: show explanation + flat list */}
        {filter !== 'all' && (
          <div className="st-form-max mt-4 space-y-4">
            <EngineExplanationCallout type={filter as EngineType} />
            {filtered.map((template) => (
              <TemplateListCard key={template.id} template={template} onPreview={setPreviewTemplate} />
            ))}
            {filtered.length === 0 && (
              <article className="st-card p-5">
                <h2 className="text-[15px] leading-[20px] font-black text-slate-900">No {filter} templates yet</h2>
                <p className="mt-2 text-[13px] leading-[19px] text-slate-500">Your admin can publish templates from the admin dashboard.</p>
              </article>
            )}
          </div>
        )}

        {/* All: grouped by engine type */}
        {filter === 'all' && (
          <div className="st-form-max mt-4">
            {(['collective', 'competitive', 'streak'] as EngineType[]).map((type) => {
              const group = grouped[type];
              const e = ENGINE[type];
              return (
                <section key={type} className="mb-8">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[18px] leading-none">{e.emoji}</span>
                    <h2 className="text-[15px] leading-[19px] font-black text-slate-900">{e.label} Challenges</h2>
                    <span className={`ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold ${e.badge}`}>{group.length}</span>
                  </div>
                  <EngineExplanationCallout type={type} />
                  {group.length > 0 ? (
                    <div className="mt-3 space-y-4">
                      {group.map((template) => (
                        <TemplateListCard key={template.id} template={template} onPreview={setPreviewTemplate} />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4 text-[13px] text-slate-500">
                      No {type} templates published yet.
                    </div>
                  )}
                </section>
              );
            })}
            {allTemplates.length === 0 && (
              <article className="st-card p-5">
                <h2 className="text-[16px] leading-[22px] font-black text-slate-900">No suggested challenges yet</h2>
                <p className="mt-2 text-[14px] leading-[20px] text-slate-600">Your admin can publish reusable templates from the admin dashboard.</p>
              </article>
            )}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {previewTemplate && (
        <div className="fixed inset-0 z-50 bg-slate-900/55 backdrop-blur-[2px]">
          <div className="absolute inset-x-0 bottom-[78px]">
            <div className="mx-auto w-full max-w-mobile px-4">
              <div className="st-card overflow-hidden rounded-2xl max-h-[85vh] overflow-y-auto">
                <div className="relative h-[200px]">
                  {canRenderImage(previewTemplate.coverImageUrl) ? (
                    <img src={previewTemplate.coverImageUrl} alt={previewTemplate.name} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full bg-slate-200 flex items-center justify-center text-slate-400 text-[12px]">No cover image</div>
                  )}
                  <button
                    className="absolute top-4 right-4 h-10 w-10 rounded-full bg-slate-900/45 text-white flex items-center justify-center"
                    onClick={() => setPreviewTemplate(null)}
                  >
                    <X size={26} />
                  </button>
                  {(() => {
                    const e = ENGINE[previewTemplate.challengeType as EngineType] ?? ENGINE.collective;
                    return (
                      <span className={`absolute left-4 bottom-4 flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-bold ${e.badge}`}>
                        {e.emoji} {e.label}
                      </span>
                    );
                  })()}
                </div>

                <div className="p-5">
                  <h2 className="text-[15px] leading-[20px] font-black tracking-[-0.01em] text-slate-900">{previewTemplate.name}</h2>
                  <p className="mt-2 text-[13px] leading-[20px] text-slate-600">{previewTemplate.description}</p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{previewTemplate.durationDays} days</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{previewTemplate.difficultyLevel}</span>
                    <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{previewTemplate.activityCount} {previewTemplate.activityCount === 1 ? 'activity' : 'activities'}</span>
                  </div>

                  {/* Engine model summary */}
                  {(() => {
                    const type = previewTemplate.challengeType as EngineType;
                    const e = ENGINE[type] ?? ENGINE.collective;
                    return (
                      <div className={`mt-4 rounded-xl border ${e.accentBorder} ${e.accentBg} p-3 space-y-1`}>
                        <p className={`text-[12px] font-black uppercase tracking-[0.08em] ${e.accentText}`}>{e.emoji} How {e.label} works</p>
                        <p className="text-[11px] text-slate-600"><span className="font-semibold">Completion:</span> {e.completionModel}</p>
                        <p className="text-[11px] text-slate-600"><span className="font-semibold">Leaderboard:</span> {e.leaderboardModel}</p>
                        <p className="text-[11px] text-slate-600"><span className="font-semibold">Winner:</span> {e.winnerRule}</p>
                      </div>
                    );
                  })()}

                  {/* First activity preview */}
                  {modalActivity && (
                    <div className="mt-4 st-card p-4 border-[#f7d2ba] bg-[#fff8f4] flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-2xl bg-primary/15 text-primary text-[24px] flex items-center justify-center">✕</div>
                        <div>
                          <p className="text-[13px] leading-[18px] font-black text-slate-900">{modalActivity.exerciseName || 'Activity'}</p>
                          <p className="text-[12px] leading-[17px] text-[#9a5f28]">{modalActivity.unit || 'Reps'}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-[17px] leading-[21px] font-black text-primary">{modalActivity.targetValue || 0} {modalActivity.unit || 'Reps'}</p>
                        <p className="text-[12px] leading-[17px] text-[#9a5f28]">Target Goal</p>
                      </div>
                    </div>
                  )}

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
