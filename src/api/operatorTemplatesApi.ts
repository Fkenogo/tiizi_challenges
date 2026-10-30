import { API_PREFIX, apiFetch } from './apiClient';
import { LIBRARY_PAGE_SIZE, templateListQuery, type LibraryFilters } from '../v2/operator/templates/templateLibraryModel';

/**
 * Client for the P5T-1 Operator Template endpoints.
 *
 * Reads (Slice 2) plus exactly three Slice 3b additions: the caller-scoped
 * capability read, draft creation and the conditional draft save. There is
 * deliberately NO validate/publish/revise/retire function in this module:
 * those arrive in later slices.
 */

export interface OperatorTemplateSummary {
  templateId: string;
  lifecycle: 'draft' | 'published' | 'retired';
  createdByMemberId: string;
  createdAt: string;
  latestPublishedVersion: number | null;
  latestVersion: number;
  openDraftVersion: number | null;
  title: string | null;
  summary: string | null;
  challengeType: 'collective' | 'competitive' | 'streak' | null;
  durationDays: number | null;
  focusTags: string[];
}

export interface OperatorTemplatePage { templates: OperatorTemplateSummary[]; nextCursor: string | null }

export interface TemplateActivityConfig {
  activity: string;
  observedVersion?: number;
  activityVariant?: string | null;
  position?: number;
  kind?: string;
  metric?: string;
  unit?: string;
  targetValue?: number;
  durationMode?: string;
  completionOccurrence?: string;
  loadBasis?: string;
  componentIds?: string[];
}

export interface OperatorTemplateVersion {
  version: number;
  state: 'draft' | 'published';
  /** Optimistic-concurrency token; present for open drafts, null once published. */
  revisionToken: string | null;
  content: {
    summary: string | null;
    focusTags: string[];
    sortOrder: number;
    coverId: string | null;
    durationDays: number | null;
    durationPresetDays: number[] | null;
    composer: {
      title?: string;
      description?: string;
      challengeType?: string;
      goalValue?: number;
      goalUnit?: string;
      requiredConsecutiveDays?: number;
      activities: TemplateActivityConfig[];
    };
  };
  authoredByMemberId: string;
  authoredAt: string;
  lastEditedByMemberId: string;
  lastEditedAt: string;
  publishedByMemberId: string | null;
  publishedAt: string | null;
}

export type TemplateVersionContent = OperatorTemplateVersion['content'];

/** Caller-scoped authoring/reading capability (server-derived, never inferred). */
export interface TemplateCapabilities { canAuthor: boolean; canRead: boolean }

/** The 409 `template_draft_changed` details: the draft as it now exists on the server. */
export interface TemplateDraftConflictDetails {
  current: {
    revisionToken: string;
    content: TemplateVersionContent;
    lastEditedByMemberId: string;
    lastEditedAt: string;
  };
}

/** Body of a Template draft create/save. Only fields a Template may carry. */
export interface TemplateDraftBody {
  summary: string | null;
  focusTags: string[];
  sortOrder: number;
  coverId: string | null;
  durationDays: number | null;
  durationPresetDays: number[] | null;
  composer: {
    draftKind: 'pf04-v1';
    mode: 'TEMPLATE_AUTHORING';
    challengeType?: string;
    title?: string;
    description?: string;
    activities: TemplateActivityConfig[];
  };
}

export interface OperatorTemplateDetail {
  templateId: string;
  lifecycle: 'draft' | 'published' | 'retired';
  createdByMemberId: string;
  createdAt: string;
  latestPublishedVersion: number | null;
  latestPublishedAt: string | null;
  retiredByMemberId: string | null;
  retiredAt: string | null;
  retiredReason: string | null;
  versions: OperatorTemplateVersion[];
}

export interface TemplateAdoptionRow {
  templateId: string;
  version: number;
  lifecycle: string;
  title: string | null;
  adoptions: number;
}

export const fetchOperatorTemplatePage = (filters: LibraryFilters, cursor: string | null) =>
  apiFetch<OperatorTemplatePage>(`${API_PREFIX}/operator/templates?${templateListQuery(filters, cursor, LIBRARY_PAGE_SIZE)}`);

export const fetchOperatorTemplate = (templateId: string) =>
  apiFetch<OperatorTemplateDetail>(`${API_PREFIX}/operator/templates/${encodeURIComponent(templateId)}`);

/** All adoption rows for one Template, following the cursor until it is null. */
export async function fetchTemplateAdoption(templateId: string): Promise<TemplateAdoptionRow[]> {
  const rows: TemplateAdoptionRow[] = [];
  let cursor: string | null = null;
  for (let page = 0; page < 50; page += 1) {
    const params = new URLSearchParams({ templateId, limit: '100' });
    if (cursor) params.set('cursor', cursor);
    const result: { adoption: TemplateAdoptionRow[]; nextCursor: string | null } =
      await apiFetch(`${API_PREFIX}/operator/templates/adoption?${params.toString()}`);
    rows.push(...result.adoption);
    cursor = result.nextCursor;
    if (!cursor) break;
  }
  return rows;
}

export const fetchTemplateCapabilities = () =>
  apiFetch<TemplateCapabilities>(`${API_PREFIX}/operator/templates/capabilities`);

/** Create a draft. The response carries no revision token: read the detail next. */
export const createTemplateDraft = (body: TemplateDraftBody) =>
  apiFetch<{ templateId: string; version: number }>(`${API_PREFIX}/operator/templates`, { method: 'POST', body });

/** Conditional draft save. `If-Match` is the quoted revision token and is required by the server. */
export const saveTemplateDraft = (templateId: string, version: number, body: TemplateDraftBody, revisionToken: string) =>
  apiFetch<{ templateId: string; version: number; revisionToken: string }>(
    `${API_PREFIX}/operator/templates/${encodeURIComponent(templateId)}/versions/${version}`,
    { method: 'PUT', body, headers: { 'If-Match': `"${revisionToken}"` } },
  );
