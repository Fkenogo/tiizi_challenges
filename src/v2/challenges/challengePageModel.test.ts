import { describe, expect, it } from 'vitest';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';
import type { V2DiscoverableChallenge } from '../../api/challengeDiscoveryApi';
import { findChallenges, myJoinedChallenges } from './challengePageModel';

function challenge(challengeId: string, participation: string | null = null): V2ChallengeSummary {
  return {
    challengeId,
    title: challengeId,
    description: '',
    challengeType: 'collective',
    status: 'active',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
    timezone: 'UTC',
    governingToday: '2026-11-03',
    finalized: false,
    groupId: `group-${challengeId}`,
    groupName: 'Community',
    coverId: null,
    activities: [],
    currentConfigVersion: 1,
    goalValue: 100,
    goalUnit: 'reps',
    collectiveTotal: 0,
    collectiveGoalReached: false,
    completionsCount: 0,
    myParticipation: participation ? { status: participation } as V2ChallengeSummary['myParticipation'] : null,
  } as V2ChallengeSummary;
}

function discoverable(challengeId: string): V2DiscoverableChallenge {
  return {
    ...challenge(challengeId),
    host: { groupId: `group-${challengeId}`, groupName: 'Community', admissionMode: 'open', viewerRelationship: 'none' },
    relevance: { interests: [], goals: [], domains: [] },
  } as V2DiscoverableChallenge;
}

describe('Challenges page membership model', () => {
  it('shows only explicitly active participation under My Challenges', () => {
    expect(myJoinedChallenges([
      challenge('hosted', null),
      challenge('withdrawn', 'withdrawn'),
      challenge('joined', 'active'),
    ]).map(({ challengeId }) => challengeId)).toEqual(['joined']);
  });

  it('combines discovery and Group-visible candidates without duplicates or joined rows', () => {
    const combined = findChallenges(
      [challenge('joined', 'active'), challenge('local'), challenge('shared')],
      [discoverable('remote'), discoverable('shared')],
    );
    expect(combined.map(({ challengeId }) => challengeId)).toEqual(['remote', 'shared', 'local']);
  });

  it('returns an empty joined section for Group members and Stewards without participation', () => {
    expect(myJoinedChallenges([challenge('hosted-one'), challenge('hosted-two')])).toEqual([]);
  });
});
