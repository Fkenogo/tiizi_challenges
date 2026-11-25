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
});
