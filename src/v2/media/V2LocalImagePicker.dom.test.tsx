import { StrictMode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { V2LocalImagePicker } from './V2LocalImagePicker';
import { useLocalImagePreview } from './useLocalImagePreview';

function PickerHarness({ initialFile }: { initialFile?: File | null }) {
  const preview = useLocalImagePreview(initialFile);
  return (
    <>
      <output data-testid="selected-file">{preview.file?.name ?? 'No file selected'}</output>
      <V2LocalImagePicker
        subject="Challenge cover"
        preview={preview}
        previewClassName="h-28 rounded-xl"
        fallback={<div>No photo selected</div>}
      />
    </>
  );
}

describe('V2LocalImagePicker', () => {
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('previews a selected image immediately, replaces it, then removes it', async () => {
    const NativeURL = URL;
    class URLWithBlobPreview extends NativeURL {}
    Object.defineProperty(URLWithBlobPreview, 'createObjectURL', {
      value: vi.fn().mockReturnValueOnce('blob:challenge-first').mockReturnValueOnce('blob:challenge-second'),
    });
    Object.defineProperty(URLWithBlobPreview, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', URLWithBlobPreview);
    const user = userEvent.setup();
    const { container } = render(<PickerHarness />);
    const input = screen.getByLabelText('Choose challenge cover') as HTMLInputElement;

    expect(screen.getByText('No photo selected')).toBeTruthy();
    await user.upload(input, new File(['first'], 'first.png', { type: 'image/png' }));
    expect(screen.getByTestId('selected-file').textContent).toBe('first.png');
    expect(screen.getByRole('img', { name: 'Challenge cover local preview' }).getAttribute('src')).toBe('blob:challenge-first');
    expect(screen.getByRole('button', { name: 'Change Photo' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Change Photo' }));
    await user.upload(input, new File(['second'], 'second.png', { type: 'image/png' }));
    expect(screen.getByTestId('selected-file').textContent).toBe('second.png');
    expect(screen.getByRole('img', { name: 'Challenge cover local preview' }).getAttribute('src')).toBe('blob:challenge-second');

    await user.click(screen.getByRole('button', { name: 'Remove Photo' }));
    expect(screen.queryByRole('img', { name: 'Challenge cover local preview' })).toBeNull();
    expect(screen.getByTestId('selected-file').textContent).toBe('No file selected');
    expect(screen.getByText('No photo selected')).toBeTruthy();
    expect(container.querySelector('input[type="file"]')).toBeTruthy();
  });

  it('creates a fresh non-revoked object URL after React StrictMode remounts with an initialFile', () => {
    const NativeURL = URL;
    class URLWithStrictMode extends NativeURL {}
    const revoked: string[] = [];
    const createMock = vi.fn().mockReturnValueOnce('blob:mount-1').mockReturnValueOnce('blob:mount-2');
    Object.defineProperty(URLWithStrictMode, 'createObjectURL', { value: createMock });
    Object.defineProperty(URLWithStrictMode, 'revokeObjectURL', {
      value: vi.fn((url: string) => revoked.push(url)),
    });
    vi.stubGlobal('URL', URLWithStrictMode);

    const initial = new File(['cover-bytes'], 'cover.png', { type: 'image/png' });
    render(
      <StrictMode>
        <PickerHarness initialFile={initial} />
      </StrictMode>,
    );

    const src = screen.getByRole('img', { name: 'Challenge cover local preview' }).getAttribute('src');
    expect(src).toBe('blob:mount-2');
    expect(revoked).toContain('blob:mount-1');
    expect(revoked).not.toContain('blob:mount-2');
  });

  it('allows removing an initialFile without restoring it and allows selecting another image afterward', async () => {
    const NativeURL = URL;
    class URLWithRemove extends NativeURL {}
    Object.defineProperty(URLWithRemove, 'createObjectURL', {
      value: vi.fn().mockReturnValueOnce('blob:initial-photo').mockReturnValueOnce('blob:replacement-photo'),
    });
    Object.defineProperty(URLWithRemove, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', URLWithRemove);

    const user = userEvent.setup();
    const initial = new File(['initial-bytes'], 'initial.png', { type: 'image/png' });
    render(<PickerHarness initialFile={initial} />);

    expect(screen.getByRole('img', { name: 'Challenge cover local preview' }).getAttribute('src')).toBe('blob:initial-photo');
    expect(screen.getByTestId('selected-file').textContent).toBe('initial.png');

    await user.click(screen.getByRole('button', { name: 'Remove Photo' }));
    expect(screen.queryByRole('img', { name: 'Challenge cover local preview' })).toBeNull();
    expect(screen.getByTestId('selected-file').textContent).toBe('No file selected');
    expect(screen.getByText('No photo selected')).toBeTruthy();

    const input = screen.getByLabelText('Choose challenge cover') as HTMLInputElement;
    await user.upload(input, new File(['replacement-bytes'], 'replacement.png', { type: 'image/png' }));
    expect(screen.getByTestId('selected-file').textContent).toBe('replacement.png');
    expect(screen.getByRole('img', { name: 'Challenge cover local preview' }).getAttribute('src')).toBe('blob:replacement-photo');
  });
});
