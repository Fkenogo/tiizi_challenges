import { useEffect, useState, type ReactNode } from 'react';
import type { V2MediaImageProjection } from '../../api/mediaApi';
import { getLocalChallengeCoverPreview } from './localChallengeCoverPreviews';

/** Shared cover rendering for every active V2 Challenge surface. */
export function V2ChallengeCover({
  challengeId,
  title,
  coverImage,
  heightClass,
  children,
  className = '',
  overlay = true,
}: {
  challengeId: string;
  title: string;
  coverImage?: V2MediaImageProjection | null;
  heightClass: string;
  children?: ReactNode;
  className?: string;
  overlay?: boolean;
}) {
  const localCover = getLocalChallengeCoverPreview(challengeId);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!localCover) {
      setPhotoUrl(null);
      return;
    }
    const url = URL.createObjectURL(localCover);
    setPhotoUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [challengeId, localCover]);

  const effectiveUrl = photoUrl ?? (coverImage?.status === 'ready' ? coverImage.url : null);

  return (
    <div
      data-challenge-cover-id={challengeId}
      data-local-cover={effectiveUrl ? 'true' : 'false'}
      className={`relative isolate overflow-hidden bg-slate-200 ${heightClass} ${className}`}
    >
      {effectiveUrl ? (
        <img src={effectiveUrl} alt={`${title} cover photo`} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        <div aria-label={`${title} has no cover photo`} className="absolute inset-0 bg-slate-200" />
      )}
      {overlay && <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-slate-950/10" />}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
