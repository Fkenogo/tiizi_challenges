import { useContext, useEffect, useState, type ReactNode } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { V2MediaImageProjection } from '../../api/mediaApi';
import { V2SignedImage } from '../media/V2SignedImage';
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
  const queryClient = useContext(QueryClientContext);
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

  const persistedUrl = coverImage?.status === 'ready' ? coverImage.url : null;
  const effectiveUrl = photoUrl ?? persistedUrl;
  const fallbackNode = <div aria-label={`${title} has no cover photo`} className="absolute inset-0 bg-slate-200" />;

  return (
    <div
      data-challenge-cover-id={challengeId}
      data-local-cover={effectiveUrl ? 'true' : 'false'}
      className={`relative isolate overflow-hidden bg-slate-200 ${heightClass} ${className}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={`${title} cover photo`} className="absolute inset-0 h-full w-full object-cover" />
      ) : persistedUrl ? (
        <V2SignedImage
          src={persistedUrl}
          alt={`${title} cover photo`}
          className="absolute inset-0 h-full w-full object-cover"
          refreshKey={`challenge-cover-${challengeId}`}
          onExpired={() => void queryClient?.invalidateQueries({
            predicate: (q) => Array.isArray(q.queryKey) && typeof q.queryKey[0] === 'string'
              && q.queryKey[0].includes('challenge'),
          })}
          fallback={fallbackNode}
        />
      ) : (
        fallbackNode
      )}
      {overlay && <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-slate-950/10" />}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
