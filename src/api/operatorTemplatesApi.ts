import { API_PREFIX, apiFetch } from './apiClient';
import { LIBRARY_PAGE_SIZE, templateListQuery, type LibraryFilters } from '../v2/operator/templates/templateLibraryModel';

/**
 * TIIZI-FER-P5T-2-S2 — read-only client for the P5T-1 Operator Template
 * endpoints. Reads only: no Template write function exists in this module.
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
