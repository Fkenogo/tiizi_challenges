import { useEffect, useState, type ReactNode } from 'react';
import type { V2MediaImageProjection } from '../../api/mediaApi';
import { getLocalGroupCoverPreview } from './localGroupCoverPreviews';
import { coverGradientFor, isGroupCoverId } from './groupCovers';

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

  const effectiveUrl = photoUrl ?? (coverImage?.status === 'ready' ? coverImage.url : null);
  const explicitCover = isGroupCoverId(coverId) ? coverId : null;
  const bgClass = !effectiveUrl && explicitCover
    ? `bg-gradient-to-br ${coverGradientFor(explicitCover)}`
    : 'bg-slate-200';

  return (
    <div
      data-group-cover-id={groupId}
      data-local-cover={effectiveUrl ? 'true' : 'false'}
      data-catalogue-cover={explicitCover ?? ''}
      className={`relative isolate overflow-hidden ${bgClass} ${heightClass} ${className}`}
    >
      {effectiveUrl ? (
        <img src={effectiveUrl} alt={`${title} cover photo`} className="absolute inset-0 h-full w-full object-cover" />
      ) : !explicitCover ? (
        <div aria-label={`${title} has no cover photo`} className="absolute inset-0 bg-slate-200" />
      ) : null}
      {overlay && <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-slate-950/10" />}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
