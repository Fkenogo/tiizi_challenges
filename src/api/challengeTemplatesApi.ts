import { API_PREFIX, apiFetch } from './apiClient';
import type { ChallengeComposerDraft } from './challengeCreationApi';

/**
 * Client for the P5T-1 MEMBER Template read routes (`/api/challenge-templates*`).
 *
 * Read-only. The server returns only published, non-retired, adoptable
 * Template versions and never creates a Challenge, a membership or a
 * participation from these routes. This client owns no validation: whether a
 * Template can be adopted is the server's `adoptable` flag, rendered as served.
 */
export interface MemberChallengeTemplate {
  templateId: string;
  version: number;
  title: string;
  summary: string;
  description: string | null;
  challengeType: 'collective' | 'competitive' | 'streak' | string;
  durationDays: number;
  durationPresetDays: number[];
  coverId: string | null;
  focusTags: string[];
  composer: ChallengeComposerDraft;
  publishedAt: string | null;
  adoptable: boolean;
  unavailableReason: string | null;
  /**
   * Set ONLY by the local preview adapter, which serves clearly labelled
   * simulated publications. The real server never emits this field.
   */
  simulatedPublication?: boolean;
}

export interface MemberTemplatePage { templates: MemberChallengeTemplate[]; nextCursor: string | null }

export interface MemberTemplateFilters { q?: string; type?: string; tag?: string; activity?: string }

const founderPreviewUnavailable: MemberTemplatePage = { templates: [], nextCursor: null };

function isLocalFounderPreview(): boolean {
  return import.meta.env.DEV && import.meta.env.VITE_TIIZI_FOUNDER_PREVIEW === '1';
}

export function fetchMemberTemplates(filters: MemberTemplateFilters = {}): Promise<MemberTemplatePage> {
  if (!isLocalFounderPreview()) return Promise.resolve(founderPreviewUnavailable);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) if (value) params.set(key, value);
  params.set('limit', '50');
  return apiFetch<MemberTemplatePage>(`${API_PREFIX}/challenge-templates?${params.toString()}`);
}

export function fetchMemberTemplate(templateId: string, version?: number): Promise<MemberChallengeTemplate> {
  if (!isLocalFounderPreview()) return Promise.reject(new Error('Template previews are available only in the local Founder Preview.'));
  const base = `${API_PREFIX}/challenge-templates/${encodeURIComponent(templateId)}`;
  return apiFetch<MemberChallengeTemplate>(version ? `${base}/versions/${version}` : base);
}
