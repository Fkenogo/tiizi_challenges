import { useEffect, useState, type ReactNode } from 'react';
import { getLocalGroupCoverPreview } from './localGroupCoverPreviews';
import { coverGradientFor, isGroupCoverId } from './groupCovers';

/** Shared, tab-local Group cover rendering for active V2 Group surfaces. */
export function V2GroupCover({
  groupId,
  title,
  coverId,
  heightClass,
  children,
  className = '',
  overlay = true,
}: {
  groupId: string;
  title: string;
  coverId?: string | null;
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

  const explicitCover = isGroupCoverId(coverId) ? coverId : null;
  const bgClass = !photoUrl && explicitCover
    ? `bg-gradient-to-br ${coverGradientFor(explicitCover)}`
    : 'bg-slate-200';

  return (
    <div
      data-group-cover-id={groupId}
      data-local-cover={photoUrl ? 'true' : 'false'}
      data-catalogue-cover={explicitCover ?? ''}
      className={`relative isolate overflow-hidden ${bgClass} ${heightClass} ${className}`}
    >
      {photoUrl ? (
        <img src={photoUrl} alt={`${title} cover photo`} className="absolute inset-0 h-full w-full object-cover" />
      ) : !explicitCover ? (
        <div aria-label={`${title} has no cover photo`} className="absolute inset-0 bg-slate-200" />
      ) : null}
      {overlay && <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-t from-slate-950/85 via-slate-950/25 to-slate-950/10" />}
      <div className="relative z-10 h-full">{children}</div>
    </div>
  );
}
