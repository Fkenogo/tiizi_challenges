import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import type { V2MediaImageProjection } from '../../api/mediaApi';
import { removeChallengeCoverImage, saveChallengeCoverImage } from '../../api/mediaApi';
import { useAuth } from '../../hooks/useAuth';
import { V2LocalImagePicker } from '../media/V2LocalImagePicker';
import { useLocalImagePreview } from '../media/useLocalImagePreview';
import { useFileUploadIdentity } from '../media/useFileUploadIdentity';
import { removeLocalChallengeCoverPreview } from './localChallengeCoverPreviews';
import { invalidateV2ChallengeCoverReads, v2ChallengeDetailKey } from './challengeQueryKeys';

/** Accountable-Steward-only lifecycle cover controls for an existing Challenge. */
export function V2ChallengeCoverEditor({ detail }: { detail: V2ChallengeDetail }) {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const preview = useLocalImagePreview();
  const uploadIdentity = useFileUploadIdentity();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const uidRef = useRef(user?.uid);
  const challengeIdRef = useRef(detail.challengeId);
  const operationSeqRef = useRef(0);
  const inFlightRef = useRef(false);
  uidRef.current = user?.uid;
  challengeIdRef.current = detail.challengeId;

  useEffect(() => {
    operationSeqRef.current += 1;
    inFlightRef.current = false;
    uploadIdentity.reset();
    preview.remove();
    setSaving(false);
    setError(null);
    setSuccess(null);
  }, [user?.uid, detail.challengeId, preview.remove, uploadIdentity.reset]);

  const reconcile = async (
    coverImage: V2MediaImageProjection,
    message: string,
    uidAtMutation: string | undefined,
    challengeIdAtMutation: string,
    operation: number,
  ) => {
    removeLocalChallengeCoverPreview(challengeIdAtMutation);
    queryClient.setQueryData<V2ChallengeDetail>(
      v2ChallengeDetailKey(challengeIdAtMutation, uidAtMutation),
      (current) => current ? { ...current, coverImage } : current,
    );
    await invalidateV2ChallengeCoverReads(queryClient, uidAtMutation, challengeIdAtMutation);
    if (
      uidRef.current === uidAtMutation
      && challengeIdRef.current === challengeIdAtMutation
      && operationSeqRef.current === operation
    ) {
      setSuccess(message);
    }
  };

  const save = async (file: File) => {
    if (inFlightRef.current) return;
    const uidAtMutation = uidRef.current;
    const challengeIdAtMutation = challengeIdRef.current;
    const operation = ++operationSeqRef.current;
    const idempotencyKey = uploadIdentity.keyForFile(file);
    inFlightRef.current = true;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const coverImage = await saveChallengeCoverImage(challengeIdAtMutation, file, { idempotencyKey });
      if (
        uidRef.current !== uidAtMutation
        || challengeIdRef.current !== challengeIdAtMutation
        || operationSeqRef.current !== operation
      ) return;
      uploadIdentity.reset();
      preview.remove();
      await reconcile(coverImage, 'Challenge cover updated.', uidAtMutation, challengeIdAtMutation, operation);
    } catch {
      if (
        uidRef.current !== uidAtMutation
        || challengeIdRef.current !== challengeIdAtMutation
        || operationSeqRef.current !== operation
      ) return;
      preview.remove();
      setError('Could not save the Challenge cover photo. Please try again.');
    } finally {
      if (operationSeqRef.current === operation) {
        inFlightRef.current = false;
        if (uidRef.current === uidAtMutation && challengeIdRef.current === challengeIdAtMutation) {
          setSaving(false);
        }
      }
    }
  };

  const remove = async () => {
    if (inFlightRef.current) return;
    const uidAtMutation = uidRef.current;
    const challengeIdAtMutation = challengeIdRef.current;
    const operation = ++operationSeqRef.current;
    inFlightRef.current = true;
    setError(null);
    setSuccess(null);
    setSaving(true);
    try {
      const coverImage = await removeChallengeCoverImage(challengeIdAtMutation);
      if (
        uidRef.current !== uidAtMutation
        || challengeIdRef.current !== challengeIdAtMutation
        || operationSeqRef.current !== operation
      ) return;
      uploadIdentity.reset();
      preview.remove();
      await reconcile(coverImage, 'Challenge cover removed.', uidAtMutation, challengeIdAtMutation, operation);
    } catch {
      if (
        uidRef.current !== uidAtMutation
        || challengeIdRef.current !== challengeIdAtMutation
        || operationSeqRef.current !== operation
      ) return;
      setError('Could not remove the Challenge cover photo. Please try again.');
    } finally {
      if (operationSeqRef.current === operation) {
        inFlightRef.current = false;
        if (uidRef.current === uidAtMutation && challengeIdRef.current === challengeIdAtMutation) {
          setSaving(false);
        }
      }
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
