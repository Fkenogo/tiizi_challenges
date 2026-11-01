import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { fetchActivityOptions } from '../../../api/challengeCreationApi';
import { fetchKnowledgeById } from '../../../api/knowledgeApi';
import {
  createTemplateDraft,
  fetchOperatorTemplate,
  publishTemplateVersion,
  saveTemplateDraft,
  validateTemplateDraft,
  type TemplateDraftBody,
  type TemplateValidationIssue,
} from '../../../api/operatorTemplatesApi';
import { useAuth } from '../../../hooks/useAuth';
import { V2Card, V2Chip, V2EmptyState, V2LoadingState, V2Page, V2SectionHeader } from '../../components/V2Primitives';
import { allowsMultipleActivities, DURATION_OPTIONS, type WizardActivity } from '../../challenges/challengeCreationDraft';
import {
  ActivitiesStep,
  ChallengeTypeStep,
  NameAppearanceFields,
  WhatCountsStep,
  buildWizardActivity,
  type ApiKnowledgeItemLike,
} from '../../challenges/wizardSteps';
import { GROUP_FOCUS_AREA_LABELS } from '../../groups/groupFocusAreas';
import {
  AUTHORING_LIMITS,
  activityStaleness,
  applyReconciliation,
  bodyFromContent,
  canonicalBody,
  classifySaveFailure,
  createEmptyAuthoringState,
  hydrateAuthoringState,
  reconcile,
  refreshActivityVersion,
  toTemplateBody,
  validateAuthoring,
  type ActivityLookup,
  type Choices,
  type ReconcileItem,
  type SaveFailure,
  type TemplateActivity,
  type TemplateAuthoringState,
} from './templateAuthoringModel';
import { TemplateConflictPanel } from './TemplateConflictPanel';
import { StepIssues, TemplateValidationPanel } from './TemplateValidationPanel';
import {
  classifyValidationFailure,
  groupIssuesByStep,
  isValidationStale,
  toValidationRecord,
  type ValidationFailure,
  type ValidationRecord,
} from './templateValidationModel';
import { clearAccountRecovery, clearRecovery, purgeOtherAccountsRecovery, readRecovery, writeRecovery, type DraftIdentity } from './templateDraftRecovery';
import { templateCapabilitiesKey, useTemplateCapabilities } from './useTemplateCapabilities';

/**
 * TIIZI-FER-P5T-2-S3B — Template Draft Editor.
 *
 * Creates and edits OPEN Template drafts only. It reuses the Slice 1 Wizard
 * steps over a Template-only state (no hosting Group, dates, Social Cause,
 * Support or creator fields exist in it). It is not a validation authority:
 * the server validates every write; this page only mirrors hard content limits
 * for early feedback. "Save and check" asks the server to validate the saved draft;
 * the read-only preview is a separate route. Slice 5B adds publish for the
 * exact saved revision that passed the server validation; revise and retire
 * remain in the Operator Library.
 */

const STEPS = [
  { id: 'type', label: 'Challenge type' },
  { id: 'name', label: 'Name & appearance' },
  { id: 'activities', label: 'Activities' },
  { id: 'counts', label: 'What counts' },
  { id: 'template', label: 'Template details' },
] as const;
type StepId = (typeof STEPS)[number]['id'];

type Phase = 'loading' | 'ready' | 'published' | 'retired' | 'denied' | 'signin' | 'missing' | 'nodraft' | 'error';

interface Session { templateId: string | null; version: number | null; token: string | null; baseBody: TemplateDraftBody | null }

interface ConflictState {
  theirsToken: string;
  theirsBody: TemplateDraftBody;
  theirsState: TemplateAuthoringState;
  lastEditedByMemberId: string;
  lastEditedAt: string;
  items: ReconcileItem[];
  choices: Choices;
}

type Banner = { tone: 'info' | 'error'; text: string } | null;

const EMPTY_BODY = toTemplateBody(createEmptyAuthoringState());

function ActivityVersionNotices({
  activities, problems, flags, onRefresh, onAcknowledge,
}: {
  activities: TemplateActivity[];
  problems: Record<string, string>;
  flags: Record<string, string[]>;
  onRefresh: (activity: TemplateActivity) => void;
  onAcknowledge: (identity: string) => void;
}) {
  const rows = activities.filter((activity) => activityStaleness(activity).stale || problems[activity.activity] || flags[activity.activity]?.length);
  if (rows.length === 0) return null;
  return (
    <section aria-label="Activity version notices" className="space-y-2">
      {rows.map((activity) => {
        const staleness = activityStaleness(activity);
        const flagged = flags[activity.activity] ?? [];
        return (
          <div key={activity.activity} data-activity-notice={activity.activity} className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
            <p className="font-bold">{activity.name}</p>
            {problems[activity.activity] ? <p className="mt-1">{problems[activity.activity]}</p> : null}
            {staleness.stale ? (
              <>
                <p className="mt-1">This Template was written against Activity Guide version {staleness.stored}; the current version is {staleness.current}. Nothing changes until you refresh it.</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <a href={`/v2/guide/${encodeURIComponent(activity.activity)}`} target="_blank" rel="noopener noreferrer" className="rounded-lg border border-amber-400 bg-white px-3 py-1.5 font-bold">Inspect current version</a>
                  <button type="button" onClick={() => onRefresh(activity)} className="rounded-lg bg-amber-700 px-3 py-1.5 font-bold text-white">{`Refresh ${activity.name} to version ${staleness.current}`}</button>
                </div>
              </>
            ) : null}
            {flagged.length > 0 ? (
              <div className="mt-2" role="status">
                <p className="font-bold">Some settings could not be kept:</p>
                <ul className="list-disc pl-5">{flagged.map((line) => <li key={line}>{line}</li>)}</ul>
                <button type="button" onClick={() => onAcknowledge(activity.activity)} className="mt-1 rounded-lg border border-amber-400 bg-white px-3 py-1 font-bold">Got it</button>
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

function TemplateDetailsStep({
  state, onChange, issues,
}: {
  state: TemplateAuthoringState;
  onChange: (patch: Partial<TemplateAuthoringState>) => void;
  issues: { field: string; message: string }[];
}) {
  const [custom, setCustom] = useState('');
  const issue = (field: string) => issues.filter((entry) => entry.field === field);
  const presetOptions = [...new Set([...DURATION_OPTIONS, ...state.durationPresetDays])].sort((a, b) => a - b);
  const toggleTag = (tag: string) => {
    const has = state.focusTags.includes(tag);
    if (!has && state.focusTags.length >= AUTHORING_LIMITS.focusTagsMax) return;
    onChange({ focusTags: has ? state.focusTags.filter((entry) => entry !== tag) : [...state.focusTags, tag] });
  };
  const togglePreset = (value: number) => {
    const has = state.durationPresetDays.includes(value);
    if (!has && state.durationPresetDays.length >= AUTHORING_LIMITS.presetsMax) return;
    onChange({ durationPresetDays: has ? state.durationPresetDays.filter((entry) => entry !== value) : [...state.durationPresetDays, value].sort((a, b) => a - b) });
  };
  const addCustom = () => {
    const value = Number(custom.trim());
    if (!Number.isInteger(value) || value < AUTHORING_LIMITS.durationDaysMin || value > AUTHORING_LIMITS.durationDaysMax) return;
    if (!state.durationPresetDays.includes(value)) togglePreset(value);
    setCustom('');
  };
  const fieldErrors = (field: string) => issue(field).map((entry) => <p key={entry.message} role="alert" className="mt-1 text-xs font-bold text-red-700">{entry.message}</p>);
  const input = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-primary';
  return (
    <div className="space-y-5">
      <div>
        <label htmlFor="tpl-summary" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Template summary</label>
        <textarea id="tpl-summary" rows={3} value={state.summary} onChange={(event) => onChange({ summary: event.target.value })} className={input} placeholder="A short, member-facing description of this Template" />
        <p className="mt-1 text-xs text-slate-500">{state.summary.trim().length}/{AUTHORING_LIMITS.summaryMax}</p>
        {fieldErrors('summary')}
      </div>
      <fieldset>
        <legend className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">Interests (up to {AUTHORING_LIMITS.focusTagsMax})</legend>
        <div className="flex flex-wrap gap-2">
          {GROUP_FOCUS_AREA_LABELS.map((tag) => <V2Chip key={tag} selected={state.focusTags.includes(tag)} onClick={() => toggleTag(tag)}>{tag}</V2Chip>)}
        </div>
        {fieldErrors('focusTags')}
      </fieldset>
      <div>
        <label htmlFor="tpl-duration" className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-slate-600">Duration in days</label>
        <input id="tpl-duration" type="number" inputMode="numeric" value={state.durationDays} onChange={(event) => onChange({ durationDays: event.target.value })} className={input} />
        {fieldErrors('durationDays')}
      </div>
      <fieldset>
        <legend className="mb-1 text-[11px] font-bold uppercase tracking-wider text-slate-600">Duration choices offered to members</legend>
        <div className="flex flex-wrap items-center gap-2">
          {presetOptions.map((value) => <V2Chip key={value} selected={state.durationPresetDays.includes(value)} onClick={() => togglePreset(value)}>{`${value} days`}</V2Chip>)}
          <input aria-label="Add a duration choice (days)" type="number" inputMode="numeric" value={custom} onChange={(event) => setCustom(event.target.value)} className="w-28 rounded-xl border border-slate-300 px-3 py-1.5 text-xs" />
          <button type="button" onClick={addCustom} className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-bold text-slate-700">Add choice</button>
        </div>
        {fieldErrors('durationPresetDays')}
      </fieldset>
    </div>
  );
}

/** Remounts per account so one account's in-memory work can never be written under another account. */
export function TemplateDraftEditor() {
  const { user } = useAuth();
  return <TemplateDraftEditorInner key={user?.uid ?? ''} />;
}

function TemplateDraftEditorInner() {
  const { templateId: routeTemplateId } = useParams<{ templateId: string }>();
  const { user } = useAuth();
  const uid = user?.uid ?? '';
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const capabilities = useTemplateCapabilities();

  const [phase, setPhase] = useState<Phase>('loading');
  const [loadMessage, setLoadMessage] = useState('');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [session, setSession] = useState<Session>({ templateId: null, version: null, token: null, baseBody: null });
  const [current, setCurrent] = useState<TemplateAuthoringState>(createEmptyAuthoringState);
  const [problems, setProblems] = useState<Record<string, string>>({});
  const [flags, setFlags] = useState<Record<string, string[]>>({});
  const [step, setStep] = useState<StepId>('type');
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishConfirmOpen, setPublishConfirmOpen] = useState(false);
  const [publishedVersion, setPublishedVersion] = useState<number | null>(null);
  const [banner, setBanner] = useState<Banner>(null);
  const [failure, setFailure] = useState<SaveFailure | null>(null);
  const [conflict, setConflict] = useState<ConflictState | null>(null);
  const [revoked, setRevoked] = useState(false);
  const [immutable, setImmutable] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addError, setAddError] = useState('');
  const [validation, setValidation] = useState<ValidationRecord | null>(null);
  const [checking, setChecking] = useState(false);
  const [validationFailure, setValidationFailure] = useState<ValidationFailure | null>(null);
  const location = useLocation();
  const phaseRef = useRef<Phase>('loading');
  phaseRef.current = phase;
  const readOnlyRef = useRef(false);
  const loadedRouteRef = useRef(routeTemplateId);
  const routeIdRef = useRef(routeTemplateId);
  routeIdRef.current = routeTemplateId;
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const currentRef = useRef(current);
  currentRef.current = current;

  const lookup: ActivityLookup = useMemo(() => ({
    options: (identity) => queryClient.fetchQuery({ queryKey: ['v2-create-options', identity], queryFn: () => fetchActivityOptions(identity), staleTime: 0 }),
    item: (identity) => fetchKnowledgeById(identity),
  }), [queryClient]);

  const draftIdentity = useCallback((): DraftIdentity => (
    sessionRef.current.templateId && sessionRef.current.version !== null
      ? { templateId: sessionRef.current.templateId, version: sessionRef.current.version }
      : 'new'
  ), []);

  const canAuthor = capabilities.data?.canAuthor === true;
  const capabilityKnown = capabilities.isSuccess;
  const capabilityFailed = capabilities.isError;

  /** Start reconciliation of the author's work against a newer server draft. */
  const beginConflict = useCallback(async (args: {
    mineState: TemplateAuthoringState;
    baseBody: TemplateDraftBody | null;
    theirsBody: TemplateDraftBody;
    theirsToken: string;
    lastEditedByMemberId: string;
    lastEditedAt: string;
    theirsState?: TemplateAuthoringState;
    /** The caller's mine-state is the live editor state: re-read it after the async hydration so newer edits are kept. */
    live?: boolean;
  }) => {
    const theirs = args.theirsState ?? (await hydrateAuthoringState(args.theirsBody, lookup)).state;
    const mineState = args.live ? currentRef.current : args.mineState;
    const names = new Map<string, string>();
    [...mineState.activities, ...theirs.activities].forEach((activity) => names.set(activity.activity, activity.name));
    const items = reconcile(args.baseBody ?? EMPTY_BODY, toTemplateBody(mineState), args.theirsBody, (id) => names.get(id) ?? id);
    setCurrent(mineState);
    setConflict({ theirsToken: args.theirsToken, theirsBody: args.theirsBody, theirsState: theirs, lastEditedByMemberId: args.lastEditedByMemberId, lastEditedAt: args.lastEditedAt, items, choices: {} });
    setFailure(null);
  }, [lookup]);

  /* ---------------------------- load / restore ---------------------------- */
  useEffect(() => {
    if (!uid) { setPhase('signin'); return; }
    if (capabilityFailed) { setLoadMessage('We could not confirm your Template authoring access. Check your connection and retry.'); setPhase('error'); return; }
    if (!capabilityKnown) { setPhase('loading'); return; }
    if (!canAuthor) {
      // Authority withdrawn after the editor opened: keep the author's work visible but read-only.
      if (phaseRef.current === 'ready') setRevoked(true); else setPhase('denied');
      return;
    }
    let cancelled = false;
    purgeOtherAccountsRecovery(uid);
    setRevoked(false); setFlags({}); setProblems({});
    setValidation(null); setValidationFailure(null);
    if (loadedRouteRef.current !== routeTemplateId) {
      // In-place move to another draft: nothing about the previous draft may carry over.
      loadedRouteRef.current = routeTemplateId;
      setConflict(null); setImmutable(false); setFailure(null);
    }
    setPhase('loading');
    (async () => {
      try {
        if (!routeTemplateId) {
          const record = readRecovery(uid, 'new');
          if (record) {
            const restored = await hydrateAuthoringState(record.body, lookup);
            if (cancelled) return;
            setSession({ templateId: null, version: null, token: null, baseBody: null });
            setCurrent(restored.state); setProblems(restored.problems);
            setBanner({ tone: 'info', text: 'Restored your unsaved work from this browser session.' });
          } else {
            setSession({ templateId: null, version: null, token: null, baseBody: null });
            setCurrent(createEmptyAuthoringState());
          }
          setPhase('ready');
          return;
        }
        const detail = await fetchOperatorTemplate(routeTemplateId);
        const draft = detail.versions.find((version) => version.state === 'draft');
        if (!draft || !draft.revisionToken) {
          if (!cancelled && detail.lifecycle === 'published' && detail.latestPublishedVersion !== null) {
            setPublishedVersion(detail.latestPublishedVersion);
            setPhase('published');
          } else if (!cancelled && detail.lifecycle === 'retired') setPhase('retired');
          else if (!cancelled) setPhase('nodraft');
          return;
        }
        const serverBody = bodyFromContent(draft.content);
        const server = await hydrateAuthoringState(serverBody, lookup);
        const identity: DraftIdentity = { templateId: detail.templateId, version: draft.version };
        const record = readRecovery(uid, identity);
        if (cancelled) return;
        const sess: Session = { templateId: detail.templateId, version: draft.version, token: draft.revisionToken, baseBody: serverBody };
        setSession(sess);
        setProblems(server.problems);
        if (record && canonicalBody(record.body) !== canonicalBody(serverBody)) {
          const mine = await hydrateAuthoringState(record.body, lookup);
          if (cancelled) return;
          if (record.baseToken === draft.revisionToken) {
            setCurrent(mine.state); setProblems({ ...server.problems, ...mine.problems });
            setBanner({ tone: 'info', text: 'Restored your unsaved work from this browser session.' });
          } else {
            setSession({ ...sess, token: record.baseToken, baseBody: record.baseBody });
            setProblems({ ...server.problems, ...mine.problems });
            await beginConflict({
              mineState: mine.state, baseBody: record.baseBody, theirsBody: serverBody, theirsToken: draft.revisionToken,
              lastEditedByMemberId: draft.lastEditedByMemberId, lastEditedAt: draft.lastEditedAt, theirsState: server.state,
            });
          }
        } else {
          if (record) clearRecovery(uid, identity);
          setCurrent(server.state);
        }
        setPhase('ready');
      } catch (error) {
        if (cancelled) return;
        const result = classifySaveFailure(error);
        if (result.kind === 'revoked') setPhase('denied');
        else if (result.kind === 'signin') setPhase('signin');
        else if (result.kind === 'missing') setPhase('missing');
        else { setLoadMessage(result.kind === 'conflict' ? 'Could not load the draft.' : result.message); setPhase('error'); }
      }
    })();
    return () => { cancelled = true; };
  }, [uid, routeTemplateId, capabilityKnown, capabilityFailed, canAuthor, reloadNonce, lookup, beginConflict]);

  /* ----------------------------- derived state ---------------------------- */
  const issues = useMemo(() => validateAuthoring(current), [current]);
  const currentCanonical = useMemo(() => canonicalBody(toTemplateBody(current)), [current]);
  const baseCanonical = useMemo(() => canonicalBody(session.baseBody ?? EMPTY_BODY), [session.baseBody]);
  const dirty = currentCanonical !== baseCanonical;
  const readOnly = revoked || immutable || conflict !== null;
  const locked = readOnly || saving || publishing;
  readOnlyRef.current = readOnly;

  /* ------------------------ temporary session recovery -------------------- */
  useEffect(() => {
    if (phase !== 'ready' || !uid) return;
    const identity = draftIdentity();
    if (dirty) writeRecovery(uid, identity, { baseToken: session.token, baseBody: session.baseBody, body: toTemplateBody(current) });
    else clearRecovery(uid, identity);
  }, [phase, uid, dirty, current, session.token, session.baseBody, draftIdentity]);

  // Sign-out or account switch: never leave this account's unsaved work behind.
  const previousUid = useRef(uid);
  useEffect(() => {
    if (previousUid.current && previousUid.current !== uid) clearAccountRecovery(previousUid.current);
    previousUid.current = uid;
  }, [uid]);

  useEffect(() => {
    if (!dirty) return undefined;
    const handler = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  /* --------------------------------- edits -------------------------------- */
  const patch = useCallback((value: Partial<TemplateAuthoringState>) => {
    setCurrent((previous) => ({ ...previous, ...value }));
    setBanner(null);
  }, []);

  const handleAddActivity = useCallback(async (item: ApiKnowledgeItemLike): Promise<TemplateAuthoringState | null> => {
    setAddError('');
    const existing = currentRef.current;
    if (existing.activities.some((activity) => activity.activity === item.id)) return existing;
    setAddingId(item.id);
    try {
      const options = await queryClient.fetchQuery({ queryKey: ['v2-create-options', item.id], queryFn: () => fetchActivityOptions(item.id), staleTime: 5 * 60 * 1000 });
      // A conflict opened (or editing was switched off) while this Activity was loading: adding now would be silently dropped.
      if (readOnlyRef.current) { setAddError('The draft changed while that Activity was loading. Resolve the changes, then add it again.'); return null; }
      const latest = currentRef.current;
      const next = buildWizardActivity(item, options, latest.challengeType) as TemplateActivity;
      const others = latest.activities.filter((activity) => activity.activity !== item.id);
      const activities = allowsMultipleActivities(latest.challengeType) ? [...others, next] : [...others, next].slice(-1);
      const updated = { ...latest, activities };
      setCurrent(updated);
      return updated;
    } catch {
      setAddError('We could not load that Activity. Please choose another.');
      return null;
    } finally {
      setAddingId(null);
    }
  }, [queryClient]);

  const removeActivity = useCallback((identity: string) => {
    setCurrent((previous) => ({ ...previous, activities: previous.activities.filter((activity) => activity.activity !== identity) }));
  }, []);

  const updateActivity = useCallback((index: number, value: Partial<WizardActivity>) => {
    setCurrent((previous) => ({ ...previous, activities: previous.activities.map((activity, i) => (i === index ? { ...activity, ...value } : activity)) }));
  }, []);

  const refreshActivity = useCallback((activity: TemplateActivity) => {
    const { activity: refreshed, dropped } = refreshActivityVersion(activity, currentRef.current.challengeType);
    setCurrent((previous) => ({ ...previous, activities: previous.activities.map((entry) => (entry.activity === activity.activity ? refreshed : entry)) }));
    setFlags((previous) => ({ ...previous, [activity.activity]: dropped }));
  }, []);

  const acknowledgeFlags = useCallback((identity: string) => {
    setFlags((previous) => { const next = { ...previous }; delete next[identity]; return next; });
  }, []);

  /* --------------------------------- saving ------------------------------- */
  const applyFailure = useCallback(async (result: SaveFailure) => {
    if (result.kind === 'conflict') {
      await beginConflict({
        live: true,
        mineState: currentRef.current,
        baseBody: sessionRef.current.baseBody,
        theirsBody: bodyFromContent(result.current.content),
        theirsToken: result.current.revisionToken,
        lastEditedByMemberId: result.current.lastEditedByMemberId,
        lastEditedAt: result.current.lastEditedAt,
      });
      return;
    }
    if (result.kind === 'revoked') {
      setRevoked(true);
      void queryClient.invalidateQueries({ queryKey: templateCapabilitiesKey(uid) });
    }
    if (result.kind === 'immutable') setImmutable(true);
    setFailure(result);
  }, [beginConflict, queryClient, uid]);

  /**
   * Ask the SERVER to validate the draft it has stored, for the token we just saved or loaded. If the stored draft
   * has moved on by the time the answer arrives, the answer describes someone else's content: treat it as a concurrent
   * edit and reconcile instead of presenting it.
   */
  const check = useCallback(async (templateId: string, version: number, token: string) => {
    setChecking(true); setValidationFailure(null); setValidation(null);
    try {
      const response = await validateTemplateDraft(templateId, version);
      const detail = await fetchOperatorTemplate(templateId);
      // The editor moved to another Template while this check ran: its answer is not ours to show.
      if (routeIdRef.current !== templateId || sessionRef.current.templateId !== templateId || sessionRef.current.version !== version) return;
      const draft = detail.versions.find((entry) => entry.version === version && entry.state === 'draft');
      if (!draft || !draft.revisionToken) {
        // Published or retired by someone else meanwhile: no longer an open draft.
        setImmutable(true);
        setValidationFailure({ kind: 'immutable', message: 'This version stopped being an open draft while it was being checked (it was published or retired), so no result is shown. Your work is kept here.' });
        return;
      }
      if (draft.revisionToken !== token) {
        await beginConflict({
          live: true, mineState: currentRef.current, baseBody: sessionRef.current.baseBody, theirsBody: bodyFromContent(draft.content),
          theirsToken: draft.revisionToken, lastEditedByMemberId: draft.lastEditedByMemberId, lastEditedAt: draft.lastEditedAt,
        });
        setBanner({ tone: 'error', text: 'The draft was changed by someone else while it was being checked. Review their changes, then save and check again.' });
        return;
      }
      setValidation(toValidationRecord(templateId, version, token, response, Date.now()));
    } catch (error) {
      const result = classifyValidationFailure(error);
      setValidationFailure(result);
      if (result.kind === 'revoked') {
        setRevoked(true);
        void queryClient.invalidateQueries({ queryKey: templateCapabilitiesKey(uid) });
      }
      if (result.kind === 'immutable') setImmutable(true);
    } finally {
      setChecking(false);
    }
  }, [beginConflict, queryClient, uid]);

  const save = useCallback(async (andCheck = false) => {
    if (saving || checking || publishing || readOnly) return;
    if (validateAuthoring(currentRef.current).length > 0) return;
    const body = toTemplateBody(currentRef.current);
    setSaving(true); setFailure(null); setBanner(null);
    let toCheck: { templateId: string; version: number; token: string } | null = null;
    try {
      const sess = sessionRef.current;
      if (sess.templateId !== null && sess.version !== null && sess.token !== null && andCheck && canonicalBody(body) === canonicalBody(sess.baseBody ?? EMPTY_BODY)) {
        // Nothing to save: check the draft exactly as it is stored.
        toCheck = { templateId: sess.templateId, version: sess.version, token: sess.token };
      } else if (sess.templateId === null || sess.version === null) {
        const created = await createTemplateDraft(body);
        // Record the new identity before anything else can fail: a retry must never create a second Template.
        // The edit route's load reads the draft back for its first revision token (create returns none).
        writeRecovery(uid, { templateId: created.templateId, version: created.version }, { baseToken: null, baseBody: body, body });
        clearRecovery(uid, 'new');
        void queryClient.invalidateQueries({ queryKey: ['operator-templates'] });
        setBanner({ tone: 'info', text: 'Draft created. You can keep editing and saving.' });
        navigate(`/v2/operator/templates/${encodeURIComponent(created.templateId)}/edit`, { replace: true, state: andCheck ? { checkAfterCreate: true } : null });
      } else {
        if (sess.token === null) { setReloadNonce((n) => n + 1); return; }
        const result = await saveTemplateDraft(sess.templateId, sess.version, body, sess.token);
        sessionRef.current = { ...sess, token: result.revisionToken, baseBody: body };
        setSession(sessionRef.current);
        setBanner({ tone: 'info', text: 'Draft saved.' });
        void queryClient.invalidateQueries({ queryKey: ['operator-templates'] });
        if (andCheck) toCheck = { templateId: sess.templateId, version: sess.version, token: result.revisionToken };
      }
    } catch (error) {
      await applyFailure(classifySaveFailure(error));
    } finally {
      setSaving(false);
    }
    // Validation runs only after a successful save (or against an unchanged saved draft).
    if (toCheck) await check(toCheck.templateId, toCheck.version, toCheck.token);
  }, [saving, checking, publishing, readOnly, uid, navigate, queryClient, applyFailure, check]);

  const publish = useCallback(async () => {
    const sess = sessionRef.current;
    const record = validation;
    if (!sess.templateId || sess.version === null || !record || !record.ok || publishing || saving || checking || readOnlyRef.current) return;
    if (isValidationStale(record, { currentToken: sess.token, templateId: sess.templateId, version: sess.version, dirty, conflict: conflict !== null })) return;
    setPublishing(true); setPublishConfirmOpen(false); setFailure(null); setBanner(null);
    try {
      const result = await publishTemplateVersion(sess.templateId, sess.version, record.token);
      setPublishedVersion(result.version);
      setImmutable(true);
      setPhase('published');
      setBanner({ tone: 'info', text: `Published as version ${result.version}. Published versions are immutable.` });
      void queryClient.invalidateQueries({ queryKey: ['operator-templates'] });
      // The write response is deliberately small; refresh the authoritative detail after the success.
      void fetchOperatorTemplate(result.templateId).then(() => queryClient.invalidateQueries({ queryKey: ['operator-templates', 'detail', result.templateId] })).catch(() => undefined);
    } catch (error) {
      const publishError = error as { status?: number; code?: string; details?: unknown };
      if (publishError.status === 422 && publishError.code === 'invalid_template') {
        const issues = (publishError.details as { issues?: unknown } | undefined)?.issues;
        if (Array.isArray(issues) && issues.every((issue) => issue && typeof issue.code === 'string' && typeof issue.message === 'string')) {
          setValidation({
            templateId: sess.templateId,
            version: sess.version,
            token: record.token,
            checkedAt: Date.now(),
            ok: false,
            issues: issues as TemplateValidationIssue[],
          });
          setFailure(null);
          setBanner(null);
          return;
        }
      }
      const result = classifySaveFailure(error);
      if (result.kind === 'unavailable' || result.kind === 'failed') {
        // A transport failure can hide a committed publish. Read before offering another attempt.
        try {
          const latest = await fetchOperatorTemplate(sess.templateId);
          if (latest.lifecycle === 'published' && latest.latestPublishedVersion !== null && latest.latestPublishedVersion >= sess.version) {
            setPublishedVersion(latest.latestPublishedVersion);
            setImmutable(true); setPhase('published');
            setBanner({ tone: 'info', text: `Published as version ${latest.latestPublishedVersion}. Published versions are immutable.` });
            void queryClient.invalidateQueries({ queryKey: ['operator-templates'] });
            return;
          }
        } catch (readError) {
          if ((readError as { status?: number }).status === 403) {
            setRevoked(true); void queryClient.invalidateQueries({ queryKey: templateCapabilitiesKey(uid) });
          }
        }
        setBanner({ tone: 'error', text: 'The publish result could not be confirmed. The saved draft was reread; check its state before trying again.' });
      }
      await applyFailure(result);
      if (result.kind === 'immutable' || result.kind === 'missing') {
        try {
          const latest = await fetchOperatorTemplate(sess.templateId);
          if (latest.lifecycle === 'published' && latest.latestPublishedVersion !== null) {
            setPublishedVersion(latest.latestPublishedVersion); setPhase('published');
          } else if (latest.lifecycle === 'retired') setPhase('retired');
        } catch { /* Keep the classified error if the follow-up read is unavailable. */ }
      }
    } finally {
      setPublishing(false);
    }
  }, [validation, publishing, saving, checking, dirty, conflict, uid, queryClient, applyFailure]);

  // A draft created by "Save and check" is checked once the edit route has read back its first revision token.
  useEffect(() => {
    const state = location.state as { checkAfterCreate?: boolean } | null;
    if (phase !== 'ready' || !state?.checkAfterCreate || !session.templateId || session.version === null || !session.token) return;
    navigate(location.pathname, { replace: true, state: null });
    void check(session.templateId, session.version, session.token);
  }, [phase, location.state, location.pathname, session, navigate, check]);

  /* ----------------------------- reconciliation --------------------------- */
  const choose = useCallback((key: string, side: 'mine' | 'theirs') => {
    setConflict((previous) => (previous ? { ...previous, choices: { ...previous.choices, [key]: side } } : previous));
  }, []);

  const applyResolution = useCallback(() => {
    if (!conflict) return;
    const merged = applyReconciliation(conflict.items, conflict.choices, currentRef.current, conflict.theirsState);
    // The reconciled draft is based on the server's CURRENT version, so the next save carries its token.
    setSession((previous) => ({ ...previous, token: conflict.theirsToken, baseBody: conflict.theirsBody }));
    setCurrent(merged);
    setConflict(null);
    setBanner({ tone: 'info', text: 'Decisions applied. Review the combined draft, then save.' });
  }, [conflict]);

  const discardMine = useCallback(() => {
    if (!conflict) return;
    clearRecovery(uid, draftIdentity());
    setSession((previous) => ({ ...previous, token: conflict.theirsToken, baseBody: conflict.theirsBody }));
    setCurrent(conflict.theirsState);
    setConflict(null);
    setBanner({ tone: 'info', text: 'Your unsaved changes were discarded. The saved draft is shown.' });
  }, [conflict, uid, draftIdentity]);

  /* --------------------------------- render ------------------------------- */
  const back = <Link to="/v2/operator/templates" className="text-sm font-bold text-primary underline">Back to the Template Library</Link>;
  const header = (
    <V2SectionHeader
      eyebrow="Operator · Templates"
      title={phase === 'published' ? 'Published Template' : routeTemplateId ? 'Edit Template draft' : 'New Template'}
      description={phase === 'published' ? 'This published version is read-only. Start a revision from the Template Library to make changes.' : 'Templates are reusable Challenge blueprints. Drafts stay private until an active author publishes them.'}
    />
  );

  if (phase === 'loading') return <V2Page wide>{header}<V2LoadingState label="Loading the editor…" /></V2Page>;
  if (phase === 'signin') return <V2Page wide>{header}<V2EmptyState title="Sign in required" message="Sign in to author Templates." action={back} /></V2Page>;
  if (phase === 'denied') {
    return <V2Page wide>{header}<V2EmptyState title="Template authoring access required" message={capabilities.data?.canRead ? 'You can read Templates, but you are not a Template author, so you cannot create or edit drafts.' : 'You do not have access to author Templates.'} action={back} /></V2Page>;
  }
  if (phase === 'missing') return <V2Page wide>{header}<V2EmptyState title="Template not found" message="This Template does not exist." action={back} /></V2Page>;
  if (phase === 'published') return <V2Page wide>{header}<V2EmptyState title={`Published as version ${publishedVersion ?? session.version ?? ''}`} message="This published version is read-only. To make a change, open the Template Library and start a revision." action={<div className="flex flex-wrap justify-center gap-3"><Link to={`/v2/operator/templates/${encodeURIComponent(session.templateId ?? routeTemplateId ?? '')}/preview`} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white">Preview published Template</Link>{back}</div>} /></V2Page>;
  if (phase === 'retired') return <V2Page wide>{header}<V2EmptyState title="Template retired" message="This Template is retired and can no longer be changed or published." action={back} /></V2Page>;
  if (phase === 'nodraft') return <V2Page wide>{header}<V2EmptyState title="No open draft" message="This Template has no open draft to edit. Only open drafts can be edited; published versions are immutable." action={back} /></V2Page>;
  if (phase === 'error') {
    return (
      <V2Page wide>{header}
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
          <p className="text-sm font-black text-red-800">We could not open the editor</p>
          <p className="mt-1 text-sm text-red-800">{loadMessage}</p>
          <button type="button" onClick={() => { void capabilities.refetch(); setReloadNonce((n) => n + 1); }} className="mt-3 rounded-lg bg-red-700 px-3 py-2 text-xs font-bold text-white">Retry</button>
        </div>
      </V2Page>
    );
  }

  const stepIndex = STEPS.findIndex((entry) => entry.id === step);
  const saveLabel = session.templateId === null ? 'Create draft' : 'Save draft';
  const saveDisabled = saving || checking || publishing || readOnly || issues.length > 0 || (!dirty && session.templateId !== null) || (session.templateId === null && !dirty);
  const checkDisabled = saving || checking || publishing || readOnly || issues.length > 0 || (session.templateId === null && !dirty);
  const validationStale = validation !== null && isValidationStale(validation, {
    currentToken: session.token, templateId: session.templateId, version: session.version, dirty, conflict: conflict !== null,
  });
  const publishDisabled = !session.templateId || session.version === null || !validation?.ok || validationStale || saving || checking || publishing || readOnly || dirty || issues.length > 0;
  const groupedIssues = validation ? groupIssuesByStep(validation.issues) : null;
  const activityNames = current.activities.map((activity) => activity.name);
  const stepIssues = (id: StepId) => (groupedIssues && !validationStale ? groupedIssues[id] : []);
  const multiNotice = !allowsMultipleActivities(current.challengeType) && current.activities.length > 1;

  return (
    <V2Page wide>
      {header}
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => void save()} disabled={saveDisabled} className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{saving ? 'Saving…' : saveLabel}</button>
        <button type="button" onClick={() => void save(true)} disabled={checkDisabled} className="rounded-xl border border-primary bg-white px-4 py-2.5 text-sm font-bold text-primary disabled:opacity-40">{checking ? 'Checking…' : 'Save and check'}</button>
        {session.templateId && session.version !== null ? <button type="button" onClick={() => setPublishConfirmOpen(true)} disabled={publishDisabled} className="rounded-xl bg-emerald-700 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">{publishing ? 'Publishing…' : 'Publish'}</button> : null}
        {session.templateId ? <Link to={`/v2/operator/templates/${encodeURIComponent(session.templateId)}/preview`} className="text-sm font-bold text-primary underline">Preview saved draft</Link> : null}
        <span aria-live="polite" className="text-xs font-bold text-slate-500">{dirty ? 'Unsaved changes' : session.templateId ? 'All changes saved' : 'Nothing to save yet'}</span>
        {back}
      </div>

      {banner ? <p role="status" className={`mb-3 rounded-xl px-3 py-2 text-sm font-semibold ${banner.tone === 'error' ? 'bg-red-50 text-red-800' : 'bg-emerald-50 text-emerald-800'}`}>{banner.text}</p> : null}
      {publishConfirmOpen ? (
        <div role="dialog" aria-modal="true" aria-labelledby="publish-template-title" aria-describedby="publish-template-description" className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 p-4">
          <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <h2 id="publish-template-title" className="text-lg font-black text-slate-900">Publish Template?</h2>
            <p id="publish-template-description" className="mt-2 text-sm leading-6 text-slate-700">Publish “{current.title.trim() || 'Untitled Template'}” as version {session.version}. Published versions are immutable; future changes require a new revision.</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setPublishConfirmOpen(false)} disabled={publishing} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700">Cancel</button>
              <button type="button" onClick={() => void publish()} disabled={publishDisabled} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">{publishing ? 'Publishing…' : 'Confirm publish'}</button>
            </div>
          </section>
        </div>
      ) : null}
      {failure && failure.kind !== 'conflict' ? (
        <div role="alert" data-failure={failure.kind} className="mb-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          <p className="font-bold">{failure.kind === 'invalid' ? 'The server did not accept this draft' : 'Not saved'}</p>
          <p>{failure.message}</p>
          {(failure.kind === 'precondition' || failure.kind === 'failed') ? <button type="button" onClick={() => setReloadNonce((n) => n + 1)} className="mt-2 rounded-lg bg-red-700 px-3 py-1.5 text-xs font-bold text-white">Reload the draft</button> : null}
        </div>
      ) : null}
      <TemplateValidationPanel
        record={validation} stale={validationStale} checking={checking} failure={validationFailure}
        grouped={groupedIssues} activityNames={activityNames} onOpenStep={setStep}
      />
      {revoked ? <p role="alert" className="mb-3 rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-800">Template authoring access was removed. Editing is switched off; your work is kept in this tab.</p> : null}
      {issues.length > 0 ? (
        <ul aria-label="Fix before saving" className="mb-3 list-disc rounded-xl bg-red-50 px-8 py-2 text-xs font-bold text-red-700">{issues.map((issue) => <li key={`${issue.field}-${issue.message}`}>{issue.message}</li>)}</ul>
      ) : null}

      {conflict ? (
        <div className="mb-4">
          <TemplateConflictPanel
            items={conflict.items} choices={conflict.choices} onChoose={choose}
            lastEditedBy={conflict.lastEditedByMemberId} lastEditedAt={conflict.lastEditedAt}
            onApply={applyResolution} onDiscard={discardMine}
          />
        </div>
      ) : null}

      <nav aria-label="Editor steps" className="mb-4 flex flex-wrap gap-2">
        {STEPS.map((entry, index) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => setStep(entry.id)}
            aria-current={entry.id === step ? 'step' : undefined}
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${entry.id === step ? 'bg-primary text-white' : 'bg-slate-100 text-slate-700'}`}
          >
            {index + 1}. {entry.label}{stepIssues(entry.id).length > 0 ? <span className="ml-1 rounded-full bg-red-600 px-1.5 text-[10px] text-white"><span aria-hidden="true">{stepIssues(entry.id).length}</span><span className="sr-only">{` (${stepIssues(entry.id).length} server check ${stepIssues(entry.id).length === 1 ? 'issue' : 'issues'})`}</span></span> : null}
          </button>
        ))}
      </nav>

      <V2Card>
        <fieldset disabled={locked} className="min-w-0 space-y-4 border-0 p-0">
          <legend className="sr-only">{STEPS[stepIndex].label}</legend>
          <StepIssues issues={stepIssues(step)} stale={validationStale} activityNames={activityNames} />
          {step === 'type' ? <ChallengeTypeStep selected={current.challengeType} onSelect={(challengeType) => patch({ challengeType })} /> : null}
          {step === 'name' ? (
            <NameAppearanceFields
              state={current}
              onUpdate={(value) => patch(value)}
              intro={<p className="text-sm leading-6 text-slate-600">Name this Template the way members will first see it.</p>}
            />
          ) : null}
          {step === 'activities' ? (
            <>
              <ActivitiesStep<TemplateAuthoringState>
                state={current}
                preselectedIdentity=""
                addToDraft={false}
                addingId={addingId}
                addError={addError}
                onAdd={handleAddActivity}
                onRemove={removeActivity}
                onHandoffConsumed={() => undefined}
                pick
              />
              {multiNotice ? <p role="status" className="text-xs font-bold text-amber-800">Together and Race use a single activity. Remove the extras before this Template is published.</p> : null}
              <ActivityVersionNotices activities={current.activities} problems={problems} flags={flags} onRefresh={refreshActivity} onAcknowledge={acknowledgeFlags} />
            </>
          ) : null}
          {step === 'counts' ? (
            <>
              <WhatCountsStep state={current} onUpdateActivity={updateActivity} onRemove={(index) => removeActivity(current.activities[index].activity)} />
              <ActivityVersionNotices activities={current.activities} problems={problems} flags={flags} onRefresh={refreshActivity} onAcknowledge={acknowledgeFlags} />
            </>
          ) : null}
          {step === 'template' ? <TemplateDetailsStep state={current} onChange={patch} issues={issues} /> : null}
        </fieldset>
      </V2Card>

      <div className="mt-4 flex items-center justify-between">
        <button type="button" onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)].id)} disabled={stepIndex === 0} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Back</button>
        <button type="button" onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)].id)} disabled={stepIndex === STEPS.length - 1} className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 disabled:opacity-40">Next</button>
      </div>
    </V2Page>
  );
}
