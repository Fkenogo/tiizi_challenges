/**
 * TIIZI-FER-P1B-001 — typed client for the member's own Interests and Goals
 * (`/api/me/preferences`).
 *
 * The server is the sole authority for the vocabulary, the limits, the
 * validation and the saved selections. The actor is bound by the
 * authenticated transport; no member id is ever sent. IDs, never labels, are
 * what is stored and sent. Preferences are relevance-only: they carry no
 * eligibility, membership or participation meaning anywhere.
 */
import { apiFetch, apiPath } from './apiClient';

export interface V2InterestOption { id: string; label: string; domain: 'Fitness' | 'Wellness' }
export interface V2GoalOption { id: string; label: string }

export interface V2Preferences {
  interestIds: string[];
  goalIds: string[];
  /** False until the member has saved OR skipped that side. */
  interestsDecided: boolean;
  goalsDecided: boolean;
  limits: { interests: number; goals: number };
  vocabulary: { interests: V2InterestOption[]; goals: V2GoalOption[] };
}

export interface V2PreferenceChange {
  interestIds?: string[];
  goalIds?: string[];
}

export function fetchV2Preferences(): Promise<V2Preferences> {
  return apiFetch<V2Preferences>(apiPath('/me/preferences'));
}

/** Replaces the provided side(s); an omitted side is untouched; `[]` clears/skips. */
export function saveV2Preferences(change: V2PreferenceChange): Promise<V2Preferences> {
  return apiFetch<V2Preferences>(apiPath('/me/preferences'), { method: 'PUT', body: change });
}
