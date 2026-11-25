import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import type { V2MediaImageProjection } from '../../api/mediaApi';
import { removeChallengeCoverImage, saveChallengeCoverImage } from '../../api/mediaApi';
import { useAuth } from '../../hooks/useAuth';
import { V2LocalImagePicker } from '../media/V2LocalImagePicker';
import { useLocalImagePreview } from '../media/useLocalImagePreview';
import { removeLocalChallengeCoverPreview } from './localChallengeCoverPreviews';
import { invalidateV2ChallengeCoverReads, v2ChallengeDetailKey } from './challengeQueryKeys';

/** Accountable-Steward-only lifecycle cover controls for an existing Challenge. */
export function V2ChallengeCoverEditor({ detail }: { detail: V2ChallengeDetail }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const preview = useLocalImagePreview();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const reconcile = async (coverImage: V2MediaImageProjection, message: string) => {
    removeLocalChallengeCoverPreview(detail.challengeId);
    queryClient.setQueryData<V2ChallengeDetail>(
      v2ChallengeDetailKey(detail.challengeId, user?.uid),
      (current) => current ? { ...current, coverImage } : current,
    );
    await invalidateV2ChallengeCoverReads(queryClient, user?.uid, detail.challengeId);
    setSuccess(message);
  };

  const save = async (file: File) => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const coverImage = await saveChallengeCoverImage(detail.challengeId, file);
      preview.remove();
      await reconcile(coverImage, 'Challenge cover updated.');
    } catch {
      preview.remove();
      setError('Could not save the Challenge cover photo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const coverImage = await removeChallengeCoverImage(detail.challengeId);
      preview.remove();
      await reconcile(coverImage, 'Challenge cover removed.');
    } catch {
      setError('Could not remove the Challenge cover photo. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <details className="rounded-2xl border border-slate-200 bg-white p-4">
      <summary className="cursor-pointer text-sm font-black text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600">
        Manage cover photo
      </summary>
      <div className="mt-3">
        <V2LocalImagePicker
          subject="Challenge cover"
          preview={preview}
          persistedUrl={detail.coverImage?.status === 'ready' ? detail.coverImage.url : null}
          refreshKey={`challenge-cover-editor-${detail.challengeId}`}
          onPersistedImageExpired={() => void invalidateV2ChallengeCoverReads(queryClient, user?.uid, detail.challengeId)}
          durable
          isSaving={saving}
          onSelectFile={(file) => void save(file)}
          onRemove={() => void remove()}
          previewClassName="h-28 w-full rounded-xl bg-slate-100"
          fallback={<div className="flex h-full w-full items-center justify-center bg-slate-100 px-4 text-center text-sm font-medium text-slate-500">No cover photo</div>}
        />
        {error && <p role="alert" className="mt-2 text-xs font-bold text-red-700">{error}</p>}
        {success && <p role="status" className="mt-2 text-xs font-bold text-emerald-700">{success}</p>}
      </div>
    </details>
  );
}
