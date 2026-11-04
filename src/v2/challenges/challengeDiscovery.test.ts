import { describe, expect, it } from 'vitest';
import { lifecycleBucket } from './challengeDiscovery';
import type { V2ChallengeSummary } from '../../api/v2ChallengeApi';

const challenge = (overrides: Partial<Pick<V2ChallengeSummary, 'status' | 'finalized' | 'governingToday' | 'startDate' | 'endDate'>> = {}): Pick<V2ChallengeSummary, 'status' | 'finalized' | 'governingToday' | 'startDate' | 'endDate'> => ({
  status: 'active', finalized: false, governingToday: '2026-11-04', startDate: '2026-11-01', endDate: '2026-11-30', ...overrides,
});

describe('Challenge discovery lifecycle labels', () => {
  it('labels an establishment Challenge as upcoming', () => {
    expect(lifecycleBucket(challenge({ status: 'establishment', governingToday: '2026-11-04', startDate: '2026-11-01' }))).toBe('upcoming');
  });
  it('labels an active Challenge as upcoming before its governed start date', () => {
    expect(lifecycleBucket(challenge({ status: 'active', governingToday: '2026-11-04', startDate: '2026-11-05' }))).toBe('upcoming');
  });
  it('does not label a started active Challenge as upcoming', () => {
    expect(lifecycleBucket(challenge({ status: 'active', governingToday: '2026-11-05', startDate: '2026-11-05' }))).toBe('active');
  });
  it('keeps an ended or finalized Challenge out of the upcoming state', () => {
    expect(lifecycleBucket(challenge({ status: 'ended' }))).toBe('completed');
    expect(lifecycleBucket(challenge({ status: 'establishment', finalized: true }))).toBe('completed');
  });
});
