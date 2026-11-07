import { API_PREFIX, apiFetch } from './apiClient';
import { LIBRARY_PAGE_SIZE, templateListQuery, type LibraryFilters } from '../v2/operator/templates/templateLibraryModel';

/**
 * Client for the P5T-1 Operator Template endpoints.
 *
 * Reads (Slice 2), draft authoring, server validation, and the Slice 5A
 * publish/revise/retire operations. Validation remains server-only.
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

/** Read-only member response fields used for the Operator needs-revision indicator. */
export interface TemplateMemberReadiness {
  templateId: string;
  version: number;
  adoptable: boolean;
  unavailableReason: string | null;
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

/** One issue reported by the server's Template validation (PF-04 preview + establishment-grade gate). */
export interface TemplateValidationIssue {
  code: string;
  message: string;
  field?: string;
  activityIndex?: number;
  /** Wizard stage the server attributes the issue to (TYPE, BASICS, ACTIVITIES, MEASUREMENT, REQUIREMENT, SCHEDULE, RULES). */
  stage?: string;
}

export interface TemplateValidationResponse { ok: boolean; issues: TemplateValidationIssue[] }

/** Validate a SAVED draft version on the server (author-only). The server reads the stored draft, never a client body. */
export const validateTemplateDraft = (templateId: string, version: number) =>
  apiFetch<TemplateValidationResponse>(
    `${API_PREFIX}/operator/templates/${encodeURIComponent(templateId)}/versions/${version}/validate`,
    { method: 'POST', body: {} },
  );

/** Publish only the exact saved revision that passed the server validation. */
export const publishTemplateVersion = (templateId: string, version: number, revisionToken: string) =>
  apiFetch<{ templateId: string; version: number }>(
    `${API_PREFIX}/operator/templates/${encodeURIComponent(templateId)}/versions/${version}/publish`,
    { method: 'POST', headers: { 'If-Match': `"${revisionToken}"` } },
  );

/** Create the next draft from the latest published version. */
export const reviseTemplate = (templateId: string) =>
  apiFetch<{ templateId: string; version: number }>(
    `${API_PREFIX}/operator/templates/${encodeURIComponent(templateId)}/revisions`,
    { method: 'POST' },
  );

/** Retire a Template. Blank reasons are omitted because the API rejects an explicit empty string. */
export const retireTemplate = (templateId: string, reason?: string) => {
  const trimmed = reason?.trim();
  return apiFetch<{ templateId: string; lifecycle: 'retired' }>(
    `${API_PREFIX}/operator/templates/${encodeURIComponent(templateId)}/retire`,
    { method: 'POST', body: trimmed ? { reason: trimmed } : {} },
  );
};

/** Existing authenticated member read; the Operator displays its result without deriving eligibility. */
export const fetchTemplateMemberReadiness = (templateId: string) =>
  apiFetch<TemplateMemberReadiness>(`${API_PREFIX}/challenge-templates/${encodeURIComponent(templateId)}`);
