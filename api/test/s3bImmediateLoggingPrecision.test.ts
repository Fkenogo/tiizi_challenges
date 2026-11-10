import { describe, expect, it } from 'vitest';
import {
  isParticipationActiveAt,
  type ParticipationRow,
} from '../src/challengeParticipations.js';

describe('S3b immediate logging timestamp precision & episode ownership', () => {
  const row = (overrides: Partial<ParticipationRow> = {}): ParticipationRow => ({
    participation_id: 'part-1',
    challenge_id: 'ch-1',
    member_id: 'mem-1',
    status: 'active',
    joined_at: '2026-11-10T15:22:45.321Z',
    joined_config_version: 1,
    exited_at: null,
    exit_reason: null,
    exited_by_member_id: null,
    created_at: '2026-11-10T15:22:45.321Z',
    updated_at: '2026-11-10T15:22:45.321Z',
    ...overrides,
  });

  it('reproduces the defect: minute-truncated client timestamp is rejected in the same minute', () => {
    const episode = row({ joined_at: '2026-11-10T15:22:45.321Z' });
    // Minute-truncated datetime-local (2026-11-10T15:22 -> 15:22:00.000Z)
    const truncatedTime = new Date('2026-11-10T15:22:00.000Z');
    expect(isParticipationActiveAt(episode, truncatedTime)).toBe(false);
  });

  it('accepts immediate logging using the actual current instant with seconds and ms', () => {
    const episode = row({ joined_at: '2026-11-10T15:22:45.321Z' });
    // Immediate logging recorded 800ms after joining in the same minute
    const immediateTime = new Date('2026-11-10T15:22:46.121Z');
    expect(isParticipationActiveAt(episode, immediateTime)).toBe(true);

    // Exact join millisecond is also eligible
    const exactJoinTime = new Date('2026-11-10T15:22:45.321Z');
    expect(isParticipationActiveAt(episode, exactJoinTime)).toBe(true);
  });

  it('accepts later logging during the active participation episode', () => {
    const episode = row({ joined_at: '2026-11-10T15:22:45.321Z' });
    const laterTime = new Date('2026-11-10T16:05:00.000Z');
    expect(isParticipationActiveAt(episode, laterTime)).toBe(true);
  });

  it('strictly rejects manual historical entries before joining', () => {
    const episode = row({ joined_at: '2026-11-10T15:22:45.321Z' });
    // Manual historical entry from 30 minutes before joining
    const pastTime = new Date('2026-11-10T14:52:00.000Z');
    expect(isParticipationActiveAt(episode, pastTime)).toBe(false);
  });

  it('handles rejoining: honors independent episodes and rejects gap periods', () => {
    const ep1 = row({
      participation_id: 'part-1',
      joined_at: '2026-11-10T10:00:00.000Z',
      exited_at: '2026-11-10T11:00:00.000Z',
      status: 'withdrawn',
      exit_reason: 'withdrawn',
    });
    const ep2 = row({
      participation_id: 'part-2',
      joined_at: '2026-11-10T12:00:00.000Z',
      exited_at: null,
      status: 'active',
    });

    // During episode 1: active
    expect(isParticipationActiveAt(ep1, new Date('2026-11-10T10:30:00.000Z'))).toBe(true);
    expect(isParticipationActiveAt(ep2, new Date('2026-11-10T10:30:00.000Z'))).toBe(false);

    // In the gap between episodes: neither is active
    const gapTime = new Date('2026-11-10T11:30:00.000Z');
    expect(isParticipationActiveAt(ep1, gapTime)).toBe(false);
    expect(isParticipationActiveAt(ep2, gapTime)).toBe(false);

    // Immediate log under episode 2 (rejoined at 12:00:00): active
    const ep2Immediate = new Date('2026-11-10T12:00:02.500Z');
    expect(isParticipationActiveAt(ep1, ep2Immediate)).toBe(false);
    expect(isParticipationActiveAt(ep2, ep2Immediate)).toBe(true);
  });
});
