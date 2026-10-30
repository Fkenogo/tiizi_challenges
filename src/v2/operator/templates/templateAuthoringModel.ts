import type { ActivityOptionsResponse, ComposerChallengeType } from '../../../api/challengeCreationApi';
import type { TemplateActivityConfig, TemplateDraftBody, TemplateVersionContent } from '../../../api/operatorTemplatesApi';
import { CHALLENGE_COVER_IDS } from '../../challenges/challengeCovers';
import {
  metricLabel,
  requiredComponentIds,
  unitLabel,
  type WizardActivity,
} from '../../challenges/challengeCreationDraft';
import { defaultTargetFor, unitsForMetric, type ApiKnowledgeItemLike } from '../../challenges/wizardSteps/activityDraft';
import { GROUP_FOCUS_AREA_LABELS } from '../../groups/groupFocusAreas';

/**
 * TIIZI-FER-P5T-2-S3B — pure authoring model for the Template Draft Editor.
 *
 * No React, no transport, no Firebase: the DOM tests, the parity guard and the
 * editor all load it directly. It carries no Template validity authority. The
 * limits in AUTHORING_LIMITS restate what the server's strict normalizer
 * enforces so the author sees a problem before a round trip; the server stays
 * authoritative and a parity guard keeps both in step.
 */

/** Server-enforced content limits, restated for early feedback (see parity guard). */
export const AUTHORING_LIMITS = {
  summaryMax: 280,
  focusTagsMax: 5,
  durationDaysMin: 1,
  durationDaysMax: 3660,
  presetsMax: 8,
  sortOrderMin: -1000,
  sortOrderMax: 1000,
  coverIds: CHALLENGE_COVER_IDS as readonly string[],
} as const;

/** Instance fields a Template never carries; the editor never sends them. */
export const PROHIBITED_COMPOSER_FIELDS = ['startDate', 'endDate', 'timezone', 'temporalConditions', 'instructions'] as const;

/** An Activity as the editor holds it: the Wizard shape plus the Template-only identity details. */
export interface TemplateActivity extends WizardActivity {
  activityVariant?: string | null;
  /**
   * The Component ids the draft carries. Present for every hydrated Activity (empty = none stored) and
   * authoritative: they change only when the author adds the Activity or explicitly refreshes its version.
   * Absent for a newly added Activity, whose Components come from the governed options.
   */
  storedComponentIds?: string[];
  /** False when the stored config carried no `kind`; the editor then does not invent one. */
  kindStored?: boolean;
}

export interface TemplateAuthoringState {
  challengeType: ComposerChallengeType | null;
  title: string;
  description: string;
  coverId: string | null;
  summary: string;
  focusTags: string[];
  /** Kept as text so the input stays editable. */
  durationDays: string;
  durationPresetDays: number[];
  /** Hidden; preserved exactly as stored. */
  sortOrder: number;
  activities: TemplateActivity[];
}

export function createEmptyAuthoringState(): TemplateAuthoringState {
  return {
    challengeType: null, title: '', description: '', coverId: null, summary: '', focusTags: [],
    durationDays: '', durationPresetDays: [], sortOrder: 0, activities: [],
  };
}

function numeric(value: string): number | null {
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : null;
}

export function wireActivity(activity: TemplateActivity, index: number): TemplateActivityConfig {
  const target = numeric(activity.targetValue);
  const componentIds = activity.storedComponentIds ?? requiredComponentIds(activity.options);
  return {
    activity: activity.activity,
    observedVersion: activity.observedVersion,
    ...(activity.kindStored === false ? {} : { kind: activity.kind }),
    ...(activity.metric ? { metric: activity.metric } : {}),
    ...(activity.unit ? { unit: activity.unit } : {}),
    ...(target !== null ? { targetValue: target } : {}),
    ...(componentIds.length > 0 ? { componentIds } : {}),
    ...(activity.metric === 'weight' && activity.loadBasis ? { loadBasis: activity.loadBasis } : {}),
    ...(activity.metric === 'duration' && activity.durationMode ? { durationMode: activity.durationMode } : {}),
    ...(activity.metric === 'completion' && activity.completionOccurrence.trim()
      ? { completionOccurrence: activity.completionOccurrence.trim() } : {}),
    ...(activity.activityVariant !== undefined ? { activityVariant: activity.activityVariant } : {}),
    position: index,
  };
}

/** Editor state → the exact body the API accepts. Derived and prohibited fields are never sent. */
export function toTemplateBody(state: TemplateAuthoringState): TemplateDraftBody {
  const duration = numeric(state.durationDays);
  return {
    summary: state.summary.trim() ? state.summary.trim() : null,
    focusTags: [...state.focusTags],
    sortOrder: state.sortOrder,
    coverId: state.coverId,
    durationDays: duration,
    durationPresetDays: state.durationPresetDays.length > 0 ? [...state.durationPresetDays] : null,
    composer: {
      draftKind: 'pf04-v1',
      mode: 'TEMPLATE_AUTHORING',
      ...(state.challengeType ? { challengeType: state.challengeType } : {}),
      ...(state.title.trim() ? { title: state.title.trim() } : {}),
      ...(state.description.trim() ? { description: state.description.trim() } : {}),
      activities: state.activities.map(wireActivity),
    },
  };
}

function normalizeActivityConfig(entry: TemplateActivityConfig, index: number): TemplateActivityConfig {
  return {
    activity: entry.activity,
    ...(entry.observedVersion !== undefined ? { observedVersion: entry.observedVersion } : {}),
    ...(entry.kind !== undefined ? { kind: entry.kind } : {}),
    ...(entry.metric !== undefined ? { metric: entry.metric } : {}),
    ...(entry.unit !== undefined ? { unit: entry.unit } : {}),
    ...(entry.targetValue !== undefined ? { targetValue: entry.targetValue } : {}),
    ...(entry.componentIds !== undefined ? { componentIds: entry.componentIds } : {}),
    ...(entry.loadBasis !== undefined ? { loadBasis: entry.loadBasis } : {}),
    ...(entry.durationMode !== undefined ? { durationMode: entry.durationMode } : {}),
    ...(entry.completionOccurrence !== undefined ? { completionOccurrence: entry.completionOccurrence } : {}),
    ...(entry.activityVariant !== undefined ? { activityVariant: entry.activityVariant } : {}),
    position: index,
  };
}

/** Server content → the same normalized body shape the editor produces (derived fields dropped). */
export function bodyFromContent(content: TemplateVersionContent): TemplateDraftBody {
  const composer = content.composer;
  return {
    summary: content.summary,
    focusTags: [...content.focusTags],
    sortOrder: content.sortOrder,
    coverId: content.coverId,
    durationDays: content.durationDays,
    durationPresetDays: content.durationPresetDays && content.durationPresetDays.length > 0 ? [...content.durationPresetDays] : null,
    composer: {
      draftKind: 'pf04-v1',
      mode: 'TEMPLATE_AUTHORING',
      ...(composer.challengeType ? { challengeType: composer.challengeType } : {}),
      ...(composer.title ? { title: composer.title } : {}),
      ...(composer.description ? { description: composer.description } : {}),
      activities: composer.activities.map(normalizeActivityConfig),
    },
  };
}

/** Deterministic form used for every "has this changed" comparison. */
export function canonicalBody(body: TemplateDraftBody): string {
  return JSON.stringify({
    summary: body.summary,
    focusTags: body.focusTags,
    sortOrder: body.sortOrder,
    coverId: body.coverId,
    durationDays: body.durationDays,
    durationPresetDays: body.durationPresetDays && body.durationPresetDays.length > 0 ? body.durationPresetDays : null,
    composer: {
      challengeType: body.composer.challengeType ?? null,
      title: body.composer.title ?? null,
      description: body.composer.description ?? null,
      activities: body.composer.activities.map(normalizeActivityConfig).map((entry) => ({ ...entry })),
    },
  });
}

/* ------------------------------ validation ------------------------------ */

export interface AuthoringIssue { field: string; message: string }

/** Early, field-level feedback that mirrors the server's strict normalizer. Not a validity authority. */
export function validateAuthoring(state: TemplateAuthoringState): AuthoringIssue[] {
  const issues: AuthoringIssue[] = [];
  const L = AUTHORING_LIMITS;
  if (state.summary.trim().length > L.summaryMax) issues.push({ field: 'summary', message: `The summary can be at most ${L.summaryMax} characters.` });
  if (state.focusTags.length > L.focusTagsMax) issues.push({ field: 'focusTags', message: `Choose at most ${L.focusTagsMax} interests.` });
  if (state.focusTags.some((tag) => !GROUP_FOCUS_AREA_LABELS.includes(tag))) issues.push({ field: 'focusTags', message: 'Interests must come from the governed list.' });
  if (new Set(state.focusTags).size !== state.focusTags.length) issues.push({ field: 'focusTags', message: 'Interests must be distinct.' });
  const rawDuration = state.durationDays.trim();
  if (rawDuration) {
    const days = Number(rawDuration);
    if (!Number.isInteger(days) || days < L.durationDaysMin || days > L.durationDaysMax) {
      issues.push({ field: 'durationDays', message: `Duration must be a whole number of days from ${L.durationDaysMin} to ${L.durationDaysMax}.` });
    }
  }
  if (state.durationPresetDays.length > L.presetsMax) issues.push({ field: 'durationPresetDays', message: `Offer at most ${L.presetsMax} duration choices.` });
  if (state.durationPresetDays.some((value) => !Number.isInteger(value) || value < L.durationDaysMin || value > L.durationDaysMax)) {
    issues.push({ field: 'durationPresetDays', message: `Duration choices must be whole days from ${L.durationDaysMin} to ${L.durationDaysMax}.` });
  }
  if (new Set(state.durationPresetDays).size !== state.durationPresetDays.length) issues.push({ field: 'durationPresetDays', message: 'Duration choices must be distinct.' });
  if (state.coverId !== null && !L.coverIds.includes(state.coverId)) issues.push({ field: 'coverId', message: 'Choose one of the available backgrounds.' });
  if (!Number.isInteger(state.sortOrder) || state.sortOrder < L.sortOrderMin || state.sortOrder > L.sortOrderMax) {
    issues.push({ field: 'sortOrder', message: 'The stored ordering value is out of range.' });
  }
  state.activities.forEach((activity, index) => {
    if (activity.targetValue.trim() && numeric(activity.targetValue) === null) {
      issues.push({ field: `activities[${index}].targetValue`, message: `${activity.name}: the target must be a number.` });
    }
  });
  if (new Set(state.activities.map((a) => a.activity)).size !== state.activities.length) {
    issues.push({ field: 'activities', message: 'An Activity can appear only once.' });
  }
  return issues;
}

/* --------------------------- Activity versioning -------------------------- */

export interface ActivityStaleness { stale: boolean; stored: number; current: number }

export function activityStaleness(activity: TemplateActivity): ActivityStaleness {
  const current = activity.options.currentVersion;
  return { stale: current > 0 && current !== activity.observedVersion, stored: activity.observedVersion, current };
}

/**
 * Explicit refresh to the current governed version. Settings that remain
 * compatible are preserved; anything the new version no longer supports is
 * reset to a governed default and reported in `dropped` (never silent).
 */
export function refreshActivityVersion(
  activity: TemplateActivity,
  challengeType: ComposerChallengeType | null,
): { activity: TemplateActivity; dropped: string[] } {
  const options: ActivityOptionsResponse = activity.options;
  const dropped: string[] = [];
  const metrics = [...options.primaryMetrics, ...options.secondaryMetrics];
  let { metric, unit, targetValue, durationMode, completionOccurrence, loadBasis } = activity;
  const defaultMetric = options.primaryMetrics[0] ?? options.secondaryMetrics[0] ?? '';
  if (metric && !metrics.includes(metric)) {
    dropped.push(`The measurement “${metricLabel(metric)}” is no longer offered; reset to “${metricLabel(defaultMetric)}”.`);
    metric = defaultMetric;
    targetValue = defaultTargetFor(challengeType, metric);
    durationMode = metric === 'duration' ? 'CONTINUOUS' : '';
    completionOccurrence = '';
  }
  const units = unitsForMetric(options, metric);
  if (unit && !units.includes(unit)) {
    const next = units[0] ?? options.compatibleUnits[0] ?? '';
    dropped.push(`The unit “${unitLabel(unit)}” is no longer offered; reset to “${unitLabel(next)}”.`);
    unit = next;
  }
  if (metric === 'weight' && loadBasis && !options.supportedLoadBases.includes(loadBasis)) {
    dropped.push('How the weight is reported is no longer supported; choose it again.');
    loadBasis = '';
  }
  const nextComponents = requiredComponentIds(options);
  const storedComponents = activity.storedComponentIds ?? nextComponents;
  if (JSON.stringify([...storedComponents].sort()) !== JSON.stringify([...nextComponents].sort())) {
    dropped.push(`The required parts changed from ${storedComponents.length ? storedComponents.join(', ') : 'none'} to ${nextComponents.length ? nextComponents.join(', ') : 'none'}; review them.`);
  }
  return {
    activity: {
      ...activity, observedVersion: options.currentVersion, metric, unit, targetValue, durationMode, completionOccurrence, loadBasis,
      storedComponentIds: nextComponents, kindStored: true,
    },
    dropped,
  };
}

/* -------------------------------- hydration ------------------------------- */

export interface ActivityLookup {
  options(identity: string): Promise<ActivityOptionsResponse>;
  item(identity: string): Promise<ApiKnowledgeItemLike>;
}

function unavailableOptions(identity: string, version: number): ActivityOptionsResponse {
  return {
    knowledgeId: identity, activityCode: null, kind: 'fitness', currentVersion: 0,
    primaryMetrics: [], secondaryMetrics: [], compatibleUnits: [], components: [], supportedLoadBases: [], unitsByMetric: {},
  };
}

export interface HydratedAuthoring {
  state: TemplateAuthoringState;
  /** Activity identity → why its governed details could not be loaded. */
  problems: Record<string, string>;
}

/** Rebuild the editor state from a body, loading each Activity's governed options and display details. */
export async function hydrateAuthoringState(body: TemplateDraftBody, lookup: ActivityLookup): Promise<HydratedAuthoring> {
  const problems: Record<string, string> = {};
  const activities = await Promise.all(body.composer.activities.map(async (config): Promise<TemplateActivity> => {
    const [options, item] = await Promise.allSettled([lookup.options(config.activity), lookup.item(config.activity)]);
    if (options.status === 'rejected') problems[config.activity] = 'This Activity’s governed details could not be loaded. Its saved settings are kept unchanged.';
    const opt = options.status === 'fulfilled' ? options.value : unavailableOptions(config.activity, config.observedVersion ?? 0);
    const info = item.status === 'fulfilled' ? item.value : null;
    return {
      activity: config.activity,
      activityCode: info?.activityCode ?? opt.activityCode,
      name: info?.name ?? 'Activity unavailable',
      kind: (config.kind === 'fitness' || config.kind === 'wellness' ? config.kind : opt.kind),
      category: info?.category,
      subcategory: info?.subcategory,
      imageUrl: info?.imageUrl ?? null,
      observedVersion: config.observedVersion ?? opt.currentVersion,
      options: opt,
      metric: config.metric ?? '',
      unit: config.unit ?? '',
      targetValue: config.targetValue === undefined ? '' : String(config.targetValue),
      durationMode: config.durationMode ?? '',
      completionOccurrence: config.completionOccurrence ?? '',
      loadBasis: config.loadBasis ?? '',
      ...(config.activityVariant !== undefined ? { activityVariant: config.activityVariant } : {}),
      storedComponentIds: config.componentIds ?? [],
      kindStored: config.kind !== undefined,
    };
  }));
  return {
    state: {
      challengeType: (body.composer.challengeType as ComposerChallengeType | undefined) ?? null,
      title: body.composer.title ?? '',
      description: body.composer.description ?? '',
      coverId: body.coverId,
      summary: body.summary ?? '',
      focusTags: [...body.focusTags],
      durationDays: body.durationDays === null ? '' : String(body.durationDays),
      durationPresetDays: body.durationPresetDays ? [...body.durationPresetDays] : [],
      sortOrder: body.sortOrder,
      activities,
    },
    problems,
  };
}

/* ------------------------------- reconciliation --------------------------- */

export const SCALAR_FIELDS = ['challengeType', 'title', 'description', 'coverId', 'summary', 'focusTags', 'durationDays', 'durationPresetDays', 'sortOrder'] as const;
export type ScalarField = (typeof SCALAR_FIELDS)[number];

export const FIELD_LABELS: Record<ScalarField, string> = {
  challengeType: 'Challenge type', title: 'Title', description: 'Description', coverId: 'Background', summary: 'Summary',
  focusTags: 'Interests', durationDays: 'Duration (days)', durationPresetDays: 'Duration choices', sortOrder: 'Ordering',
};

function scalarOf(body: TemplateDraftBody, field: ScalarField): unknown {
  switch (field) {
    case 'challengeType': return body.composer.challengeType ?? null;
    case 'title': return body.composer.title ?? null;
    case 'description': return body.composer.description ?? null;
    case 'coverId': return body.coverId;
    case 'summary': return body.summary;
    case 'focusTags': return body.focusTags;
    case 'durationDays': return body.durationDays;
    case 'durationPresetDays': return body.durationPresetDays && body.durationPresetDays.length > 0 ? body.durationPresetDays : null;
    case 'sortOrder': return body.sortOrder;
  }
}

export function displayScalar(field: ScalarField, value: unknown): string {
  if (value === null || value === undefined || value === '') return '— none —';
  if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '— none —';
  if (field === 'challengeType') return value === 'collective' ? 'Together' : value === 'competitive' ? 'Race' : value === 'streak' ? 'Streak' : String(value);
  return String(value);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export type Side = 'mine' | 'theirs';

export interface ReconcileItem {
  key: string;
  kind: 'field' | 'activity';
  label: string;
  /** What each side holds, in words. */
  mine: string;
  theirs: string;
  /** For activities: added/removed/modified from the author's point of view. */
  change?: 'added' | 'removed' | 'modified';
  /** Pre-resolved because only one side changed since the author's base; null when both did. */
  auto: Side | null;
}

function activityMap(body: TemplateDraftBody): Map<string, TemplateActivityConfig> {
  return new Map(body.composer.activities.map((entry, index) => [entry.activity, normalizeActivityConfig(entry, index)]));
}

function configForCompare(entry: TemplateActivityConfig | undefined): unknown {
  if (!entry) return null;
  const { position: _position, ...rest } = entry;
  return rest;
}

export function describeActivityConfig(entry: TemplateActivityConfig | undefined): string {
  if (!entry) return '— not in the draft —';
  const parts = [
    entry.metric ? metricLabel(entry.metric) : null,
    entry.targetValue !== undefined ? `${entry.targetValue}${entry.unit ? ` ${unitLabel(entry.unit)}` : ''}` : null,
    entry.durationMode ?? null,
    entry.completionOccurrence ?? null,
    entry.loadBasis ?? null,
    entry.observedVersion !== undefined ? `guide version ${entry.observedVersion}` : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : 'no settings yet';
}

/**
 * Three-way comparison of the author's work (`mine`), the draft the author
 * last saw (`base`) and the server's current draft (`theirs`). Only
 * differences between mine and theirs appear. A difference only one side made
 * since `base` is pre-resolved (and still shown); a difference both sides
 * made needs an explicit choice.
 */
export function reconcile(
  base: TemplateDraftBody,
  mine: TemplateDraftBody,
  theirs: TemplateDraftBody,
  nameOf: (identity: string) => string = (identity) => identity,
): ReconcileItem[] {
  const items: ReconcileItem[] = [];
  const decide = (b: unknown, m: unknown, t: unknown): Side | null => (same(m, b) ? 'theirs' : same(t, b) ? 'mine' : null);
  for (const field of SCALAR_FIELDS) {
    const m = scalarOf(mine, field); const t = scalarOf(theirs, field); const b = scalarOf(base, field);
    if (same(m, t)) continue;
    items.push({ key: `field:${field}`, kind: 'field', label: FIELD_LABELS[field], mine: displayScalar(field, m), theirs: displayScalar(field, t), auto: decide(b, m, t) });
  }
  const mm = activityMap(mine); const tm = activityMap(theirs); const bm = activityMap(base);
  const ids = [...new Set([...tm.keys(), ...mm.keys()])];
  for (const id of ids) {
    const m = mm.get(id); const t = tm.get(id); const b = bm.get(id);
    if (same(configForCompare(m), configForCompare(t))) continue;
    items.push({
      key: `activity:${id}`, kind: 'activity', label: nameOf(id),
      mine: describeActivityConfig(m), theirs: describeActivityConfig(t),
      change: m && !t ? 'added' : !m && t ? 'removed' : 'modified',
      auto: decide(configForCompare(b), configForCompare(m), configForCompare(t)),
    });
  }
  return items;
}

export type Choices = Record<string, Side>;

export function sideFor(item: ReconcileItem, choices: Choices): Side | null {
  return item.auto ?? choices[item.key] ?? null;
}

export function unresolvedItems(items: ReconcileItem[], choices: Choices): ReconcileItem[] {
  return items.filter((item) => sideFor(item, choices) === null);
}

/** Build the reconciled editor state. Throws if any item is still unresolved: saving is gated on this. */
export function applyReconciliation(
  items: ReconcileItem[],
  choices: Choices,
  mine: TemplateAuthoringState,
  theirs: TemplateAuthoringState,
): TemplateAuthoringState {
  if (unresolvedItems(items, choices).length > 0) throw new Error('reconciliation: unresolved conflicts remain');
  const result: TemplateAuthoringState = { ...theirs, activities: [...theirs.activities] };
  const take = <K extends keyof TemplateAuthoringState>(field: K, from: TemplateAuthoringState) => { result[field] = from[field]; };
  for (const item of items) {
    if (item.kind !== 'field') continue;
    const from = sideFor(item, choices) === 'mine' ? mine : theirs;
    const field = item.key.slice('field:'.length) as ScalarField;
    take(field, from);
  }
  const mineById = new Map(mine.activities.map((activity) => [activity.activity, activity]));
  const theirsIds = new Set(theirs.activities.map((a) => a.activity));
  const merged: TemplateActivity[] = [];
  for (const activity of theirs.activities) {
    const item = items.find((entry) => entry.key === `activity:${activity.activity}`);
    if (item && sideFor(item, choices) === 'mine') {
      const own = mineById.get(activity.activity);
      if (own) merged.push(own); // 'mine' for a removed-by-me entry drops it
    } else merged.push(activity);
  }
  for (const activity of mine.activities) {
    if (theirsIds.has(activity.activity)) continue;
    const item = items.find((entry) => entry.key === `activity:${activity.activity}`);
    if (item && sideFor(item, choices) === 'mine') merged.push(activity);
  }
  result.activities = merged;
  return result;
}

/* ------------------------------ error handling ---------------------------- */

export type SaveFailure =
  | { kind: 'conflict'; current: { revisionToken: string; content: TemplateVersionContent; lastEditedByMemberId: string; lastEditedAt: string } }
  | { kind: 'immutable'; message: string }
  | { kind: 'precondition'; message: string }
  | { kind: 'invalid'; message: string }
  | { kind: 'signin'; message: string }
  | { kind: 'revoked'; message: string }
  | { kind: 'missing'; message: string }
  | { kind: 'unavailable'; message: string }
  | { kind: 'failed'; message: string };

interface ErrorLike { status?: number; code?: string; message?: string; details?: unknown }

/** One place that turns a save/create failure into a distinct, honest state (400/401/403/409/428 never collapse). */
export function classifySaveFailure(error: unknown): SaveFailure {
  const e = (error ?? {}) as ErrorLike;
  const message = typeof e.message === 'string' && e.message ? e.message : 'The request failed.';
  if (e.status === 409 && e.code === 'template_draft_changed') {
    const current = (e.details as { current?: SaveFailureCurrent } | undefined)?.current;
    if (current && typeof current.revisionToken === 'string' && current.content) return { kind: 'conflict', current };
    return { kind: 'failed', message: 'The draft changed but its current version could not be read. Reload to continue.' };
  }
  if (e.status === 409) return { kind: 'immutable', message: 'This version can no longer be edited (it was published or the Template was retired). Your work is kept here.' };
  if (e.status === 428) return { kind: 'precondition', message: 'The editor lost track of the draft version. Reload the draft; your work is kept.' };
  if (e.status === 400) return { kind: 'invalid', message };
  if (e.status === 401) return { kind: 'signin', message: 'Your session ended. Sign in again; your work is kept in this tab.' };
  if (e.status === 403) return { kind: 'revoked', message: 'You no longer have Template authoring access. Your work is kept but cannot be saved.' };
  if (e.status === 404) return { kind: 'missing', message: 'This Template draft no longer exists.' };
  if (e.status === 503 || e.code === 'api_unreachable') return { kind: 'unavailable', message: 'Tiizi is unreachable. Your work is kept; try again.' };
  return { kind: 'failed', message };
}

type SaveFailureCurrent = Extract<SaveFailure, { kind: 'conflict' }>['current'];
