import { apiFetch, apiPath, apiUploadBinary } from './apiClient';

export type V2MediaPurpose = 'profile_image' | 'group_cover' | 'challenge_cover';

export type V2MediaImageProjection =
  | { status: 'not_configured' }
  | { status: 'none' }
  | {
      status: 'ready';
      assetId: string;
      url: string;
      contentType: string;
      width: number;
      height: number;
    };

function newIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

export async function uploadDurableImage(params: {
  purpose: V2MediaPurpose;
  file: File;
  targetScopeId?: string;
}): Promise<{ intentId: string; assetId: string }> {
  const intent = await apiFetch<{ intentId: string; status: string; expiresAt: string }>(
    apiPath('/media/intents'),
    {
      method: 'POST',
      body: {
        purpose: params.purpose,
        ...(params.targetScopeId ? { targetScopeId: params.targetScopeId } : {}),
        idempotencyKey: newIdempotencyKey(),
      },
    },
  );

  const uploaded = await apiUploadBinary<{ intentId: string; assetId: string; status: 'uploaded' }>(
    apiPath(`/media/intents/${encodeURIComponent(intent.intentId)}/content`),
    params.file,
    {
      method: 'PUT',
      headers: {
        'Content-Type': params.file.type || 'application/octet-stream',
      },
    },
  );

  return { intentId: uploaded.intentId, assetId: uploaded.assetId };
}

export async function saveOwnProfileImage(file: File): Promise<V2MediaImageProjection> {
  const { intentId } = await uploadDurableImage({ purpose: 'profile_image', file });
  const res = await apiFetch<{ profileImage: V2MediaImageProjection }>(
    apiPath('/me/profile-image'),
    {
      method: 'PUT',
      body: { intentId },
    },
  );
  return res.profileImage;
}

export async function removeOwnProfileImage(): Promise<V2MediaImageProjection> {
  const res = await apiFetch<{ profileImage: V2MediaImageProjection }>(
    apiPath('/me/profile-image'),
    { method: 'DELETE' },
  );
  return res.profileImage;
}

export async function saveGroupCoverImage(
  groupId: string,
  file: File,
): Promise<V2MediaImageProjection> {
  const { intentId } = await uploadDurableImage({
    purpose: 'group_cover',
    file,
    targetScopeId: groupId,
  });
  const res = await apiFetch<{ coverImage: V2MediaImageProjection }>(
    apiPath(`/groups/${encodeURIComponent(groupId)}/cover-image`),
    {
      method: 'PUT',
      body: { intentId },
    },
  );
  return res.coverImage;
}

export async function removeGroupCoverImage(groupId: string): Promise<V2MediaImageProjection> {
  const res = await apiFetch<{ coverImage: V2MediaImageProjection }>(
    apiPath(`/groups/${encodeURIComponent(groupId)}/cover-image`),
    { method: 'DELETE' },
  );
  return res.coverImage;
}

export async function saveChallengeCoverImage(
  challengeId: string,
  file: File,
  options?: { initialBind?: boolean; groupId?: string },
): Promise<V2MediaImageProjection> {
  const { intentId } = await uploadDurableImage({
    purpose: 'challenge_cover',
    file,
    targetScopeId: options?.initialBind ? options.groupId : challengeId,
  });
  const res = await apiFetch<{ coverImage: V2MediaImageProjection }>(
    apiPath(`/challenges/${encodeURIComponent(challengeId)}/cover-image`),
    {
      method: 'PUT',
      body: {
        intentId,
        ...(options?.initialBind ? { initialBind: true } : {}),
      },
    },
  );
  return res.coverImage;
}

export async function removeChallengeCoverImage(
  challengeId: string,
): Promise<V2MediaImageProjection> {
  const res = await apiFetch<{ coverImage: V2MediaImageProjection }>(
    apiPath(`/challenges/${encodeURIComponent(challengeId)}/cover-image`),
    { method: 'DELETE' },
  );
  return res.coverImage;
}
