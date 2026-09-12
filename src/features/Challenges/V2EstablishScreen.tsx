/**
 * EBC-05 V2 Challenge establishment screen (Founder Preview).
 *
 * Exposes the real EBC-01 creation authority (POST /v1/challenges) for all
 * three families. Knowledge comes ONLY from the server-authoritative
 * published list; Metric/Unit choices are constrained per item to its
 * governed contract so invalid tuples cannot be sent — and the server's
 * rejection is surfaced when establishment still fails. No Firestore
 * writes, no second config model, no V1 fallback.
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Flame, Plus, Trophy, Users, X } from 'lucide-react';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { isV2ChallengesEnabled } from '../../api/v2ChallengeMode';
import type { V2ChallengeType } from '../../api/v2ChallengeApi';
import {
  permittedMetrics,
  type V2KnowledgeItem,
  type V2KnowledgeKind,
} from '../../api/v2KnowledgeContract';
import {
  useV2CreateChallenge,
  useV2EstablishmentKnowledge,
  useV2MyGroups,
} from '../../hooks/useV2Challenges';
import {
  buildCreationPayload,
  metricForUnit,
  validateEstablishForm,
  type EstablishActivityDraft,
  type EstablishFormState,
} from './v2EstablishPayload';

const FAMILIES: Array<{ type: V2ChallengeType; label: string; icon: typeof Users }> = [
  { type: 'collective', label: 'Collective', icon: Users },
  { type: 'competitive', label: 'Competitive', icon: Trophy },
  { type: 'streak', label: 'Streak', icon: Flame },
];

const TIMEZONES = [
  'Pacific/Auckland',
  'Australia/Sydney',
  'Asia/Tokyo',
  'Asia/Singapore',
  'Europe/London',
  'Europe/Berlin',
  'Africa/Johannesburg',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Pacific/Honolulu',
  'UTC',
];

function todayPlus(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function defaultUnitFor(item: V2KnowledgeItem, metric: string): string {
  const units = item.compatibleUnits ?? [];
  return units.find((unit) => metricForUnit(unit) === metric) ?? units[0] ?? '';
}

function draftFromItem(item: V2KnowledgeItem): EstablishActivityDraft {
  const metric = permittedMetrics(item)[0] ?? '';
  return {
    knowledge: item,
    activityKind: item.kind,
    metric,
    targetValue: item.kind === 'fitness' ? '10' : '1',
    unit: defaultUnitFor(item, metric),
  };
}

function deviceTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? 'UTC';
  } catch {
    return 'UTC';
  }
}

function KnowledgePicker({
  onAdd,
  addedIds,
}: {
  onAdd: (item: V2KnowledgeItem) => void;
  addedIds: Set<string>;
}) {
  const [kind, setKind] = useState<V2KnowledgeKind | undefined>(undefined);
  const [search, setSearch] = useState('');
  const [liveSearch, setLiveSearch] = useState('');
  const { data, isLoading, isError } = useV2EstablishmentKnowledge(kind, liveSearch);
  const items = data?.items ?? [];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-3">
      <p className="text-[13px] font-black text-slate-900">Add Knowledge activity</p>
      <p className="text-[12px] text-slate-500">
        Published, server-authoritative Knowledge only. Drafts and retired items are never listed.
      </p>
      <div className="flex gap-2">
        {(['all', 'fitness', 'wellness'] as const).map((option) => (
          <button
            key={option}
            type="button"
            className={`h-9 px-3 rounded-full text-[13px] font-bold ${
              (option === 'all' ? undefined : option) === kind
                ? 'bg-primary text-white'
                : 'bg-slate-100 text-slate-700'
            }`}
            onClick={() => setKind(option === 'all' ? undefined : option)}
          >
            {option === 'all' ? 'All' : option === 'fitness' ? 'Fitness' : 'Wellness'}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <input
          className="flex-1 h-10 rounded-xl border border-slate-200 px-3 text-[14px]"
          placeholder="Search published Knowledge…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              event.preventDefault();
              setLiveSearch(search);
            }
          }}
        />
        <button
          type="button"
          className="h-10 px-4 rounded-xl bg-slate-900 text-white text-[13px] font-bold"
          onClick={() => setLiveSearch(search)}
        >
          Search
        </button>
      </div>
      {isLoading && <p className="text-[13px] text-slate-500">Loading Knowledge…</p>}
      {isError && <p className="text-[13px] font-bold text-red-600">Could not load Knowledge.</p>}
      {!isLoading && !isError && items.length === 0 && (
        <p className="text-[13px] text-slate-500">No published Knowledge matches.</p>
      )}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {items.map((item) => {
          const added = addedIds.has(item.id);
          return (
            <div key={item.id} className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 px-3 py-2">
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-slate-900 truncate">{item.name}</p>
                <p className="text-[11px] text-slate-500 truncate">
                  {item.kind} · {(item.primaryMetrics ?? []).join('/') || 'no metric'}
                  {' · '}
                  {(item.compatibleUnits ?? []).join(', ') || 'no units'}
                </p>
              </div>
              <button
                type="button"
                disabled={added}
                className="h-8 px-3 rounded-full bg-primary text-white text-[12px] font-black disabled:opacity-40 flex-shrink-0"
                onClick={() => onAdd(item)}
              >
                {added ? 'Added' : 'Add'}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function fieldLabel(text: string) {
  return <p className="text-[12px] font-black uppercase tracking-wider text-slate-500">{text}</p>;
}

function V2EstablishScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const enabled = isV2ChallengesEnabled();
  const { data: groupsData } = useV2MyGroups();
  const create = useV2CreateChallenge();
  const memberships = useMemo(
    () => (groupsData?.memberships ?? []).filter((m) => m.status === 'active' || m.status === 'joined'),
    [groupsData],
  );

  const [family, setFamily] = useState<V2ChallengeType>('collective');
  const [groupId, setGroupId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startDate, setStartDate] = useState(() => todayPlus(0));
  const [endDate, setEndDate] = useState(() => todayPlus(7));
  const [timezone, setTimezone] = useState(() => deviceTimezone());
  const [goalValue, setGoalValue] = useState('100');
  const [goalUnit, setGoalUnit] = useState('reps');
  const [requiredDays, setRequiredDays] = useState('5');
  const [activities, setActivities] = useState<EstablishActivityDraft[]>([]);
  const [formError, setFormError] = useState<string | null>(null);

  const addedIds = useMemo(() => new Set(activities.map((a) => a.knowledge.id)), [activities]);

  if (!enabled) {
    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="st-frame st-bottom-safe pb-[108px]">
          <main className="st-form-max mt-10 text-center">
            <p className="text-[15px] font-bold text-slate-900">V2 Challenges are not enabled.</p>
            <button className="st-btn-primary mt-6" onClick={() => navigate('/app/challenges')}>
              Back to Challenges
            </button>
          </main>
        </div>
        <BottomNav active="home" />
      </Screen>
    );
  }

  const updateActivity = (index: number, patch: Partial<EstablishActivityDraft>) => {
    setActivities((current) => {
      const next = [...current];
      const row = next[index];
      if (!row) return current;
      const merged = { ...row, ...patch };
      // Metric/Unit stay inside the item's governed contract: changing the
      // metric resets the unit to one that expresses it.
      if (patch.metric !== undefined && patch.metric !== row.metric) {
        merged.unit = defaultUnitFor(merged.knowledge, patch.metric);
      }
      next[index] = merged;
      return next;
    });
  };

  const handleSubmit = async () => {
    const form: EstablishFormState = {
      challengeType: family,
      groupId,
      title,
      description,
      startDate,
      endDate,
      timezone,
      goalValue,
      goalUnit,
      requiredConsecutiveDays: requiredDays,
      activities,
    };
    const problem = validateEstablishForm(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    setFormError(null);
    try {
      const response = await create.mutateAsync(buildCreationPayload(form));
      showToast(
        response.idempotentReplay
          ? 'Challenge already established — opened the existing one.'
          : 'V2 challenge established.',
        'success',
      );
      navigate(`/app/challenge/v2/${response.challengeId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not establish this challenge.';
      setFormError(message);
      showToast(message, 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges/v2')}>
              <ArrowLeft size={22} className="text-slate-900" />
            </button>
            <h1 className="st-page-title">New V2 Challenge</h1>
            <span className="w-10" />
          </header>
        </div>
        <main className="st-form-max mt-5 space-y-4">
          <div className="flex gap-2">
            {FAMILIES.map(({ type, label, icon: Icon }) => (
              <button
                key={type}
                type="button"
                className={`flex-1 h-11 rounded-2xl text-[14px] font-black flex items-center justify-center gap-1.5 ${
                  family === type ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'
                }`}
                onClick={() => setFamily(type)}
              >
                <Icon size={15} />
                {label}
              </button>
            ))}
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Group')}
            <select
              className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
              value={groupId}
              onChange={(event) => setGroupId(event.target.value)}
            >
              <option value="">Choose a group…</option>
              {memberships.map((m) => (
                <option key={m.groupId} value={m.groupId}>
                  {m.group.name} ({m.role})
                </option>
              ))}
            </select>
            <button
              type="button"
              className="text-[13px] font-bold text-primary"
              onClick={() => navigate('/app/challenges/v2/groups')}
            >
              Create or join a group first
            </button>
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Title')}
            <input
              className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
              placeholder={family === 'streak' ? 'e.g. Morning movement streak' : 'e.g. Team 10k push-ups'}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Description (optional)')}
            <textarea
              className="w-full rounded-2xl border border-slate-200 px-3 py-2.5 text-[14px]"
              rows={2}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              {fieldLabel('Start date')}
              <input
                type="date"
                className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              {fieldLabel('End date')}
              <input
                type="date"
                className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            {fieldLabel('Governing timezone')}
            <select
              className="w-full h-12 rounded-2xl border border-slate-200 bg-white px-3 text-[14px]"
              value={TIMEZONES.includes(timezone) ? timezone : '__custom'}
              onChange={(event) => {
                if (event.target.value !== '__custom') setTimezone(event.target.value);
              }}
            >
              {!TIMEZONES.includes(timezone) && <option value="__custom">{timezone} (custom)</option>}
              {TIMEZONES.map((zone) => (
                <option key={zone} value={zone}>{zone}</option>
              ))}
            </select>
          </div>

          {family === 'collective' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                {fieldLabel('Team goal')}
                <input
                  inputMode="decimal"
                  className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
                  value={goalValue}
                  onChange={(event) => setGoalValue(event.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                {fieldLabel('Goal unit')}
                <input
                  className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
                  placeholder="reps"
                  value={goalUnit}
                  onChange={(event) => setGoalUnit(event.target.value)}
                />
              </div>
            </div>
          )}

          {family === 'competitive' && (
            <p className="text-[12px] text-slate-500">
              Competitive has no team goal — members race to each activity’s target below.
            </p>
          )}

          {family === 'streak' && (
            <div className="space-y-1.5">
              {fieldLabel('Required consecutive days')}
              <input
                inputMode="numeric"
                className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
                value={requiredDays}
                onChange={(event) => setRequiredDays(event.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            {fieldLabel('Daily activities')}
            {activities.map((row, index) => {
              const metrics = permittedMetrics(row.knowledge);
              const units = row.knowledge.compatibleUnits ?? [];
              return (
                <div key={row.knowledge.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[14px] font-bold text-slate-900 truncate">{row.knowledge.name}</p>
                    <button
                      type="button"
                      aria-label={`Remove ${row.knowledge.name}`}
                      className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 flex-shrink-0"
                      onClick={() => setActivities((current) => current.filter((_, i) => i !== index))}
                    >
                      <X size={15} className="text-slate-600" />
                    </button>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-500">Metric</span>
                      <select
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-2 text-[13px]"
                        value={row.metric}
                        onChange={(event) => updateActivity(index, { metric: event.target.value })}
                      >
                        {metrics.map((metric) => (
                          <option key={metric} value={metric}>{metric}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-500">Unit</span>
                      <select
                        className="w-full h-10 rounded-xl border border-slate-200 bg-white px-2 text-[13px]"
                        value={row.unit}
                        onChange={(event) => updateActivity(index, { unit: event.target.value })}
                      >
                        {units.map((unit) => (
                          <option key={unit} value={unit}>{unit}</option>
                        ))}
                      </select>
                    </label>
                    <label className="space-y-1">
                      <span className="text-[11px] font-bold text-slate-500">Target</span>
                      <input
                        inputMode="decimal"
                        className="w-full h-10 rounded-xl border border-slate-200 px-2 text-[13px]"
                        value={row.targetValue}
                        onChange={(event) => updateActivity(index, { targetValue: event.target.value })}
                      />
                    </label>
                  </div>
                </div>
              );
            })}
          </div>

          <KnowledgePicker
            onAdd={(item) => setActivities((current) => [...current, draftFromItem(item)])}
            addedIds={addedIds}
          />

          {formError && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-[13px] font-bold text-red-700">{formError}</p>
            </div>
          )}

          <button
            className="w-full h-12 rounded-2xl bg-primary text-white text-[15px] font-black disabled:opacity-60 flex items-center justify-center gap-2"
            disabled={create.isPending}
            onClick={handleSubmit}
          >
            <Plus size={17} />
            {create.isPending ? 'Establishing…' : 'Establish & activate challenge'}
          </button>
          <p className="text-[12px] text-slate-500 text-center">
            Establishes through the governed V2 authority and activates immediately. You join as creator.
          </p>
        </main>
      </div>
      <BottomNav active="home" />
    </Screen>
  );
}

export default V2EstablishScreen;

