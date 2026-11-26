// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import { V2SignedImage } from './V2SignedImage';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('V2SignedImage expiration & fallback', () => {
  it('shows a neutral loading state, refreshes once, and swaps to a fresh signed URL', () => {
    const onExpired = vi.fn();
    const { container, rerender } = render(
      <V2SignedImage
        src="https://signed.example.test/old.webp?expires=60"
        alt="Profile"
        refreshKey="test-profile"
        onExpired={onExpired}
        fallback={<span>Fallback</span>}
      />,
    );

    expect(container.textContent).toContain('Fallback');
    const firstImage = container.querySelector('img')!;
    expect(firstImage.className).toBe('hidden');
    fireEvent.load(firstImage);
    expect(container.textContent).not.toContain('Fallback');

    fireEvent.error(firstImage);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Fallback');

    rerender(
      <V2SignedImage
        src="https://signed.example.test/new.webp?expires=60"
        alt="Profile"
        refreshKey="test-profile"
        onExpired={onExpired}
        fallback={<span>Fallback</span>}
      />,
    );
    const freshImage = container.querySelector('img')!;
    expect(freshImage.getAttribute('src')).toBe('https://signed.example.test/new.webp?expires=60');
    fireEvent.load(freshImage);
    expect(container.textContent).not.toContain('Fallback');
  });

  it('retries a same-URL refresh once and then stops without a permanent error loop', () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    const { container } = render(
      <V2SignedImage
        src="https://signed.example.test/same.webp?expires=60"
        alt="Group cover"
        refreshKey="same-url"
        onExpired={onExpired}
        fallback={<span>Fallback</span>}
      />,
    );

    fireEvent.error(container.querySelector('img')!);
    expect(onExpired).toHaveBeenCalledTimes(1);
    act(() => vi.advanceTimersByTime(300));
    const retriedImage = container.querySelector('img')!;
    fireEvent.error(retriedImage);

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Group cover is unavailable.');
    expect(container.querySelector('img')).toBeNull();
  });

  it('stops after one failed refresh even when the server keeps rotating signed URLs', () => {
    const onExpired = vi.fn();
    const { container, rerender } = render(
      <V2SignedImage src="https://signed.example.test/one.webp" alt="Cover" refreshKey="rotating" onExpired={onExpired} fallback={<span>Fallback</span>} />,
    );
    fireEvent.error(container.querySelector('img')!);
    expect(onExpired).toHaveBeenCalledTimes(1);

    rerender(<V2SignedImage src="https://signed.example.test/two.webp" alt="Cover" refreshKey="rotating" onExpired={onExpired} fallback={<span>Fallback</span>} />);
    fireEvent.error(container.querySelector('img')!);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Cover is unavailable.');
  });

  it('does not let one sibling instance suppress another instance recovery', () => {
    const firstExpired = vi.fn();
    const secondExpired = vi.fn();
    const { container } = render(
      <>
        <V2SignedImage src="https://signed.example.test/a.webp" alt="A" refreshKey="shared" onExpired={firstExpired} fallback={<span>A fallback</span>} />
        <V2SignedImage src="https://signed.example.test/b.webp" alt="B" refreshKey="shared" onExpired={secondExpired} fallback={<span>B fallback</span>} />
      </>,
    );

    const images = container.querySelectorAll('img');
    fireEvent.error(images[0]);
    fireEvent.error(images[1]);
    expect(firstExpired).toHaveBeenCalledTimes(1);
    expect(secondExpired).toHaveBeenCalledTimes(1);
  });

  it('uses loadingFallback on initial load and keeps the previous image visible when src rotates', () => {
    const { container, rerender } = render(
      <V2SignedImage
        src="https://signed.example.test/v1.webp"
        alt="Challenge cover"
        className="h-full w-full object-cover"
        refreshKey="cover-1"
        loadingFallback={<div data-testid="shimmer">Loading…</div>}
        fallback={<span>No cover photo</span>}
      />,
    );

    expect(container.querySelector('[data-testid="shimmer"]')).toBeTruthy();
    expect(container.textContent).not.toContain('No cover photo');

    const firstImg = container.querySelector('img')!;
    fireEvent.load(firstImg);
    expect(container.querySelector('[data-testid="shimmer"]')).toBeNull();

    rerender(
      <V2SignedImage
        src="https://signed.example.test/v2.webp"
        alt="Challenge cover"
        className="h-full w-full object-cover"
        refreshKey="cover-1"
        loadingFallback={<div data-testid="shimmer">Loading…</div>}
        fallback={<span>No cover photo</span>}
      />,
    );

    expect(container.querySelector('[data-testid="shimmer"]')).toBeNull();
    expect(container.textContent).not.toContain('No cover photo');
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(2);
    expect(imgs[0].getAttribute('src')).toBe('https://signed.example.test/v1.webp');
    expect(imgs[0].className).toBe('h-full w-full object-cover');
    expect(imgs[1].getAttribute('src')).toBe('https://signed.example.test/v2.webp');
    expect(imgs[1].className).toBe('hidden');

    fireEvent.load(imgs[1]);
    const finalImgs = container.querySelectorAll('img');
    expect(finalImgs.length).toBe(1);
    expect(finalImgs[0].getAttribute('src')).toBe('https://signed.example.test/v2.webp');
    expect(finalImgs[0].className).toBe('h-full w-full object-cover');
  });

  it('clears the obsolete image immediately on persisted asset replacement (assetKey change)', () => {
    const { container, rerender } = render(
      <V2SignedImage
        src="https://signed.example.test/asset-1.webp"
        alt="Challenge cover"
        className="h-full w-full object-cover"
        refreshKey="cover-1"
        assetKey="asset-1"
        loadingFallback={<div data-testid="shimmer">Loading…</div>}
        fallback={<span>No cover photo</span>}
      />,
    );

    fireEvent.load(container.querySelector('img')!);
    expect(container.querySelectorAll('img').length).toBe(1);

    // Genuine asset replacement: assetKey changes from asset-1 to asset-2.
    rerender(
      <V2SignedImage
        src="https://signed.example.test/asset-2.webp"
        alt="Challenge cover"
        className="h-full w-full object-cover"
        refreshKey="cover-1"
        assetKey="asset-2"
        loadingFallback={<div data-testid="shimmer">Loading…</div>}
        fallback={<span>No cover photo</span>}
      />,
    );

    // Obsolete asset-1 image must NOT remain visible while asset-2 loads.
    expect(container.querySelector('[data-testid="shimmer"]')).toBeTruthy();
    const imgs = container.querySelectorAll('img');
    expect(imgs.length).toBe(1);
    expect(imgs[0].getAttribute('src')).toBe('https://signed.example.test/asset-2.webp');
    expect(imgs[0].className).toBe('hidden');

    fireEvent.load(imgs[0]);
    expect(container.querySelector('[data-testid="shimmer"]')).toBeNull();
    expect(imgs[0].className).toBe('h-full w-full object-cover');
  });

  it('clears the old image immediately when the asset is removed (src becomes null)', () => {
    const { container, rerender } = render(
      <V2SignedImage
        src="https://signed.example.test/asset-1.webp"
        alt="Challenge cover"
        className="h-full w-full object-cover"
        refreshKey="cover-1"
        assetKey="asset-1"
        fallback={<span>No cover photo</span>}
      />,
    );

    fireEvent.load(container.querySelector('img')!);
    expect(container.querySelectorAll('img').length).toBe(1);

    rerender(
      <V2SignedImage
        src={null}
        alt="Challenge cover"
        className="h-full w-full object-cover"
        refreshKey="cover-1"
        assetKey={null}
        fallback={<span>No cover photo</span>}
      />,
    );

    expect(container.querySelectorAll('img').length).toBe(0);
    expect(container.textContent).toContain('No cover photo');
  });

  it('bounds pending image requests that never complete and clears stale previous images', () => {
    vi.useFakeTimers();
    const onExpired = vi.fn();
    const { container, rerender } = render(
      <V2SignedImage
        src="https://signed.example.test/v1.webp"
        alt="Group cover"
        className="h-full w-full object-cover"
        refreshKey="group-1"
        assetKey="asset-1"
        onExpired={onExpired}
        loadTimeoutMs={2000}
        fallback={<span>Fallback</span>}
      />,
    );

    fireEvent.load(container.querySelector('img')!);

    // URL rotates for the same asset, but the new request hangs and never completes.
    rerender(
      <V2SignedImage
        src="https://signed.example.test/v2-stalled.webp"
        alt="Group cover"
        className="h-full w-full object-cover"
        refreshKey="group-1"
        assetKey="asset-1"
        onExpired={onExpired}
        loadTimeoutMs={2000}
        fallback={<span>Fallback</span>}
      />,
    );

    // Previous image stays visible initially during rotation.
    expect(container.querySelectorAll('img').length).toBe(2);

    // After loadTimeoutMs, bounded failure handling clears previous image and requests one refresh.
    act(() => vi.advanceTimersByTime(2000));
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(container.textContent).toContain('Fallback');

    // Retry fires after RETRY_DELAY_MS (300ms), then stalls again for loadTimeoutMs (2000ms).
    act(() => vi.advanceTimersByTime(300));
    act(() => vi.advanceTimersByTime(2000));

    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('Group cover is unavailable.');
  });
});
