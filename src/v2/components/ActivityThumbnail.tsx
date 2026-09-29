import { useState } from 'react';

/** Optional Knowledge media reference with a neutral Tiizi fallback. */
export function ActivityThumbnail({
  imageUrl,
  size = 'list',
}: {
  imageUrl?: string | null;
  size?: 'list' | 'selected';
}) {
  const [failed, setFailed] = useState(false);
  const sizeClass = size === 'selected' ? 'h-10 w-10' : 'h-11 w-11 sm:h-12 sm:w-12';
  if (!imageUrl || failed) {
    return <span className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-xl bg-orange-50 text-lg font-black lowercase text-primary`} aria-hidden="true">t</span>;
  }
  return (
    <img
      src={imageUrl}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
      className={`${sizeClass} shrink-0 rounded-xl border border-slate-100 object-cover`}
    />
  );
}
