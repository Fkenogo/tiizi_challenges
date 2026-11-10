import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  stashChallengeCoverPhotoDraft,
  peekChallengeCoverPhotoDraft,
  clearChallengeCoverPhotoDraft,
  clearOtherMembersChallengeDrafts,
  releaseAbandonedChallengeDraft,
} from './challengeDraftSession';

afterEach(() => {
  cleanup();
  clearChallengeCoverPhotoDraft('member-1');
  clearChallengeCoverPhotoDraft('member-2');
  vi.unstubAllGlobals();
});

describe('Challenge cover photo memory draft carrier', () => {
  it('stashes and peeks a selected photo in memory without using web storage', () => {
    const file = new File(['dummy binary bytes'], 'cover.png', { type: 'image/png' });

    // Mock storage to ensure setItem is never called for the photo file
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem');

    stashChallengeCoverPhotoDraft('member-1', file);
    expect(peekChallengeCoverPhotoDraft('member-1')).toBe(file);
    expect(peekChallengeCoverPhotoDraft('member-2')).toBeNull();

    // Invariant: zero web storage used for the photo file
    expect(setItemSpy).not.toHaveBeenCalled();

    clearChallengeCoverPhotoDraft('member-1');
    expect(peekChallengeCoverPhotoDraft('member-1')).toBeNull();
  });

  it('preserves photo across simulated Activity Guide round trip and isolates across members', () => {
    const member1Photo = new File(['photo-1'], 'photo-1.jpg', { type: 'image/jpeg' });
    const member2Photo = new File(['photo-2'], 'photo-2.jpg', { type: 'image/jpeg' });

    stashChallengeCoverPhotoDraft('member-1', member1Photo);
    stashChallengeCoverPhotoDraft('member-2', member2Photo);

    // Navigating to Activity Guide (/v2/guide/activities) must NOT release the draft
    releaseAbandonedChallengeDraft('member-1', '/v2/guide/activities');
    expect(peekChallengeCoverPhotoDraft('member-1')).toBe(member1Photo);

    // Account switch / clearing other members removes only non-active member
    clearOtherMembersChallengeDrafts('member-1');
    expect(peekChallengeCoverPhotoDraft('member-1')).toBe(member1Photo);
    expect(peekChallengeCoverPhotoDraft('member-2')).toBeNull();

    // Navigating away from the wizard and guide (e.g. to /v2/today) abandons and clears the draft
    releaseAbandonedChallengeDraft('member-1', '/v2/today');
    expect(peekChallengeCoverPhotoDraft('member-1')).toBeNull();
  });
});
