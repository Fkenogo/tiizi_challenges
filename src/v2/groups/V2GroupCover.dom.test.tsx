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

  it('renders the same selected Group photo on listing and detail surfaces with a Tiizi fallback for others', () => {
    const selected = new File(['fictional preview photo'], 'group.jpg', { type: 'image/jpeg' });
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, value: vi.fn().mockReturnValue('blob:group-photo') });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, value: vi.fn() });
    setLocalGroupCoverPreview('group-shared', selected);
    render(
      <>
        <V2GroupCover groupId="group-shared" title="Shared Group" coverId="cover-2" heightClass="h-24" />
        <V2GroupCover groupId="group-shared" title="Shared Group" coverId="cover-2" heightClass="h-48" />
        <V2GroupCover groupId="group-other" title="Other Group" coverId="cover-3" heightClass="h-24" />
      </>,
    );

    expect(screen.getAllByRole('img', { name: 'Shared Group cover photo' })).toHaveLength(2);
    expect(screen.getAllByRole('img', { name: 'Shared Group cover photo' }).map((image) => image.getAttribute('src'))).toEqual(['blob:group-photo', 'blob:group-photo']);
    expect(screen.queryByRole('img', { name: 'Other Group cover photo' })).toBeNull();
    expect(document.querySelector('[data-group-cover-id="group-other"][data-local-cover="false"]')).toBeTruthy();
  });
});
