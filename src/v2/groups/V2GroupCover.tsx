import { useContext, useEffect, useState, type ReactNode } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { V2MediaImageProjection } from '../../api/mediaApi';
import { V2SignedImage } from '../media/V2SignedImage';
import { getLocalGroupCoverPreview } from './localGroupCoverPreviews';
import { coverGradientFor, isGroupCoverId } from './groupCovers';
import { invalidateV2GroupCoverReads } from './groupQueryKeys';

/** Shared Group cover rendering for active V2 Group surfaces. */
export function V2GroupCover({
  groupId,
  title,
  coverId,
  coverImage,
  heightClass,
  children,
  className = '',
  overlay = true,
}: {
  groupId: string;
  title: string;
  coverId?: string | null;
  coverImage?: V2MediaImageProjection | null;
  heightClass: string;
  children?: ReactNode;
  className?: string;
  overlay?: boolean;
}) {
  const queryClient = useContext(QueryClientContext);
  const localCover = getLocalGroupCoverPreview(groupId);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localCover) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(localCover);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [groupId, localCover]);

  const persistedUrl = coverImage?.status === 'ready' ? coverImage.url : null;
  const effectiveUrl = persistedUrl ?? photoUrl;
  const explicitCover = isGroupCoverId(coverId) ? coverId : null;
  const bgClass = !effectiveUrl && explicitCover
    ? `bg-gradient-to-br ${coverGradientFor(explicitCover)}`
    : 'bg-slate-200';
  const fallbackNode = !explicitCover
    ? <div aria-label={`${title} has no cover photo`} className="absolute inset-0 bg-slate-200" />
    : <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${coverGradientFor(explicitCover)}`} />;
  const loadingNode = <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-slate-200/80" />;

  return (
    <div
      data-group-cover-id={groupId}
      data-local-cover={photoUrl && !persistedUrl ? 'true' : 'false'}
      data-catalogue-cover={explicitCover ?? ''}
      className={`relative isolate overflow-hidden ${bgClass} ${heightClass} ${className}`}
    >
      {persistedUrl ? (
        <V2SignedImage
          src={persistedUrl}
          alt={`${title} cover photo`}
          className="absolute inset-0 h-full w-full object-cover"
          refreshKey={`group-cover-${groupId}`}
          onExpired={() => {
            if (queryClient) void invalidateV2GroupCoverReads(queryClient, undefined, groupId);
          }}
          fallback={fallbackNode}
          loadingFallback={loadingNode}
        />
      ) : photoUrl ? (
        <img src={photoUrl} alt={`${title} cover photo`} className="absolute inset-0 h-full w-full object-cover" />
      ) : !explicitCover ? (
        <div aria-label={`${title} has no cover photo`} className="absolute inset-0 bg-slate-200" />
      ) : null}
      {overlay && <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-slate-950/10" />}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
