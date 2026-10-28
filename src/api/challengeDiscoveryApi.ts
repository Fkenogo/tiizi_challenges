/**
 * TIIZI-FER-P2-001 — typed client for cross-Group Challenge discovery
 * (`GET /api/challenges/discover`).
 *
 * The server owns the authorized set, the outsider projection, the hosting
 * Group's admission mode and the member's relationship to it, and the
 * ordering. Saved preferences only ORDER the result; nothing here filters,
 * joins, or enrolls.
 */
import { apiFetch, apiPath } from './apiClient';
import type { V2ChallengeSummary } from './v2ChallengeApi';
import type { V2AdmissionMode, V2DiscoveryRank, V2ViewerRelationship } from './groupsApi';

export interface V2DiscoverableChallenge extends V2ChallengeSummary {
  host: {
    groupId: string;
    groupName: string | null;
    admissionMode: V2AdmissionMode;
    viewerRelationship: V2ViewerRelationship;
  };
  relevance: { interests: string[]; goals: string[]; domains: Array<'fitness' | 'wellness'> };
}

export interface V2ChallengeDiscovery {
  challenges: V2DiscoverableChallenge[];
  ranking: { applied: boolean };
}

export function fetchDiscoverableChallenges(rank: V2DiscoveryRank = 'relevance'): Promise<V2ChallengeDiscovery> {
  return apiFetch<V2ChallengeDiscovery>(apiPath(`/challenges/discover${rank === 'general' ? '?rank=general' : ''}`));
}
