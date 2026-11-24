// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { V2SignedImage, resetSignedImageRefreshCooldowns } from './V2SignedImage';

afterEach(() => {
  cleanup();
  resetSignedImageRefreshCooldowns();
});

describe('V2SignedImage expiration & fallback', () => {
  it('triggers a bounded refresh once on expired URL error and swaps to the new signed URL', () => {
    const onExpired = vi.fn();
    const { rerender } = render(
      <V2SignedImage
        src="https://signed.example.test/old.webp?expires=60"
        alt="Profile"
        refreshKey="test-profile"
        onExpired={onExpired}
        fallback={<span>Fallback</span>}
      />,
    );

    const img = screen.getByRole('img', { name: 'Profile' });
    fireEvent.error(img);
    expect(onExpired).toHaveBeenCalledTimes(1);

    // Firing error again immediately within cooldown does not spam refreshes and falls back cleanly
    fireEvent.error(img);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(screen.getByText('Fallback')).toBeTruthy();

    // When the query returns a fresh signed URL, the image renders again
    rerender(
      <V2SignedImage
        src="https://signed.example.test/new.webp?expires=60"
        alt="Profile"
        refreshKey="test-profile"
        onExpired={onExpired}
        fallback={<span>Fallback</span>}
      />,
    );
    expect(screen.getByRole('img', { name: 'Profile' }).getAttribute('src')).toBe(
      'https://signed.example.test/new.webp?expires=60',
    );
  });
});
