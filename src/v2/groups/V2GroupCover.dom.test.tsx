import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { V2GroupCover } from './V2GroupCover';
import { getLocalGroupCoverPreview, removeLocalGroupCoverPreview, setLocalGroupCoverPreview } from './localGroupCoverPreviews';

afterEach(() => {
  cleanup();
  removeLocalGroupCoverPreview('group-shared');
  removeLocalGroupCoverPreview('group-other');
  vi.restoreAllMocks();
  Reflect.deleteProperty(URL, 'createObjectURL');
  Reflect.deleteProperty(URL, 'revokeObjectURL');
});

describe('V2 Group local cover previews', () => {
  it('keeps the selected File under its canonical Group identity only', () => {
    const selected = new File(['fictional preview photo'], 'group.jpg', { type: 'image/jpeg' });
    setLocalGroupCoverPreview('group-shared', selected);

    expect(getLocalGroupCoverPreview('group-shared')).toBe(selected);
    expect(getLocalGroupCoverPreview('group-other')).toBeNull();
  });

  it('renders uploaded photos, preserves explicit catalogue covers, and uses a neutral fallback when neither exists', () => {
    const selected = new File(['fictional preview photo'], 'group.jpg', { type: 'image/jpeg' });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:group-photo') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    setLocalGroupCoverPreview('group-shared', selected);
    render(
      <>
        <V2GroupCover groupId="group-shared" title="Shared Group" coverId="cover-2" heightClass="h-24" />
        <V2GroupCover groupId="group-shared" title="Shared Group" coverId="cover-2" heightClass="h-48" />
        <V2GroupCover groupId="group-catalogue" title="Catalogue Group" coverId="cover-3" heightClass="h-24" />
        <V2GroupCover groupId="group-other" title="Other Group" coverId={null} heightClass="h-24" />
      </>,
    );

    expect(screen.getAllByRole('img', { name: 'Shared Group cover photo' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Shared Group cover photo' }).map((image) => image.getAttribute('src'))).toEqual(['blob:group-photo', 'blob:group-photo']);

    const catEl = document.querySelector('[data-group-cover-id="group-catalogue"][data-local-cover="false"]');
    expect(catEl?.getAttribute('data-catalogue-cover')).toBe('cover-3');
    expect(catEl?.className).toContain('bg-gradient-to-br');
    expect(screen.queryByLabelText('Catalogue Group has no cover photo')).toBeNull();

    expect(screen.queryByRole('img', { name: 'Other Group cover photo' })).toBeNull();
    const otherEl = document.querySelector('[data-group-cover-id="group-other"][data-local-cover="false"]');
    expect(otherEl).toBeTruthy();
    expect(otherEl?.className).toContain('bg-slate-200');
    expect(otherEl?.className).not.toContain('bg-gradient-to-br');
    expect(screen.getByLabelText('Other Group has no cover photo')).toBeTruthy();
  });
});
