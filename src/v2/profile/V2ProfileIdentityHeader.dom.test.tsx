// @vitest-environment jsdom
import { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { V2ProfileIdentityHeader } from './V2ProfileIdentityHeader';
import { useLocalImagePreview } from '../media/useLocalImagePreview';
import { V2AccountTrigger } from '../components/V2Primitives';

const OLD_URL = 'https://r2.example.invalid/old.webp';
const NEW_URL = 'https://r2.example.invalid/new.webp';

function Harness() {
  const preview = useLocalImagePreview();
  const [imageUrl, setImageUrl] = useState<string | null>(OLD_URL);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [nameEdits, setNameEdits] = useState(0);
  const editName = () => setNameEdits((count) => count + 1);

  const upload = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    setImageUrl(NEW_URL);
    preview.remove();
    setSaving(false);
    setSuccess('Profile photo updated.');
  };
  const remove = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    await new Promise((resolve) => setTimeout(resolve, 0));
    setImageUrl(null);
    setSaving(false);
    setSuccess('Profile photo removed.');
  };

  return (
    <>
      <V2ProfileIdentityHeader
        displayName="Media005 A"
        persistedUrl={imageUrl}
        preview={preview}
        durable
        isSaving={saving}
        error={error}
        success={success}
        refreshKey="profile-media-005"
        onSelectFile={() => void upload()}
        onRemove={() => void remove()}
        onPersistedImageExpired={vi.fn()}
        onEditName={editName}
      />
      <V2AccountTrigger name="Media005 A" imageUrl={imageUrl} refreshKey="account-media-005" onOpen={vi.fn()} />
      <output aria-label="Name edits">{nameEdits}</output>
    </>
  );
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('compact Profile identity', () => {
  it('uses avatar/name affordances, hides persistent management buttons, updates the global avatar, and removes via the secondary menu', async () => {
    const NativeURL = URL;
    class URLWithPreview extends NativeURL {}
    Object.defineProperty(URLWithPreview, 'createObjectURL', { value: vi.fn(() => 'blob:selected') });
    Object.defineProperty(URLWithPreview, 'revokeObjectURL', { value: vi.fn() });
    vi.stubGlobal('URL', URLWithPreview);

    const { container } = render(<Harness />);
    expect(screen.getByRole('button', { name: 'Replace profile photo' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Edit display name' }));
    expect(screen.getByLabelText('Name edits').textContent).toBe('1');
    expect(screen.queryByRole('button', { name: 'Add Photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Change Photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Remove Photo' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add name' })).toBeNull();

    await userEvent.setup().upload(
      screen.getByLabelText('Choose profile photo'),
      new File(['replacement'], 'replacement.png', { type: 'image/png' }),
    );
    await waitFor(() => expect(screen.getByText('Profile photo updated.')).toBeTruthy());
    expect(container.querySelector(`img[src="${NEW_URL}"]`)).toBeTruthy();
    const accountButton = screen.getByRole('button', { name: 'Open profile for Media005 A' });
    expect(accountButton.querySelector('img')?.getAttribute('src')).toBe(NEW_URL);

    const options = screen.getByLabelText('Profile photo options');
    fireEvent.click(options);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Remove photo' }));
    await waitFor(() => expect(screen.getByText('Profile photo removed.')).toBeTruthy());
    expect(container.querySelector(`img[src="${NEW_URL}"]`)).toBeNull();
    expect(accountButton.textContent).toContain('M');
  });
});
