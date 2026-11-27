import { useContext, useEffect, useState, type ReactNode } from 'react';
import { QueryClientContext } from '@tanstack/react-query';
import type { V2MediaImageProjection } from '../../api/mediaApi';
import { V2SignedImage } from '../media/V2SignedImage';
import { getLocalChallengeCoverPreview } from './localChallengeCoverPreviews';
import { invalidateV2ChallengeCoverReads } from './challengeQueryKeys';
import { challengeCoverGradient, isChallengeCoverId } from './challengeCovers';

/**
 * Shared cover rendering for every active V2 Challenge surface.
 *
 * TIIZI-V2-UX-008 — the persisted catalogue cover is rendered when no
 * authorized photo exists. `challenges.cover_id` is the governed, persisted
 * Challenge background catalogue (`challenge-1`…`challenge-8`, the Challenge
 * catalogue; Groups have their own `cover-1`…`cover-8` catalogue), so showing
 * it is the governed default, not substituted photography. When no catalogue
 * cover is persisted either, the card falls back to the neutral placeholder
 * and never to invented imagery.
 */
export function V2ChallengeCover({
  challengeId,
  title,
  coverId,
  coverImage,
  heightClass,
  children,
  className = '',
  overlay = true,
}: {
  challengeId: string;
  title: string;
  coverId?: string | null;
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
  const explicitCover = isChallengeCoverId(coverId) ? coverId : null;
  const effectiveUrl = persistedUrl ?? photoUrl;
  const bgClass = !effectiveUrl && explicitCover
    ? `bg-gradient-to-br ${challengeCoverGradient(explicitCover)}`
    : 'bg-slate-200';
  const fallbackNode = !explicitCover
    ? <div aria-label={`${title} has no cover photo`} className="absolute inset-0 bg-slate-200" />
    : <div aria-hidden="true" className={`absolute inset-0 bg-gradient-to-br ${challengeCoverGradient(explicitCover)}`} />;
  const loadingNode = <div aria-hidden="true" className="absolute inset-0 animate-pulse bg-slate-200/80" />;

  return (
    <div
      data-challenge-cover-id={challengeId}
      data-local-cover={photoUrl && !persistedUrl ? 'true' : 'false'}
      data-catalogue-cover={explicitCover ?? ''}
      className={`relative isolate overflow-hidden ${bgClass} ${heightClass} ${className}`}
    >
      {persistedUrl ? (
        <V2SignedImage
          src={persistedUrl}
          alt={`${title} cover photo`}
          className="absolute inset-0 h-full w-full object-cover"
          refreshKey={`challenge-cover-${challengeId}`}
          assetKey={coverImage?.status === 'ready' ? coverImage.assetId : null}
          onExpired={() => {
            if (queryClient) void invalidateV2ChallengeCoverReads(queryClient, undefined, challengeId);
          }}
          fallback={fallbackNode}
          loadingFallback={loadingNode}
        />
      ) : photoUrl ? (
        <img src={photoUrl} alt={`${title} cover photo`} className="absolute inset-0 h-full w-full object-cover" />
      ) : (
        fallbackNode
      )}
      {overlay && <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/30 to-slate-950/10" />}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
