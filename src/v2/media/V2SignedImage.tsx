import { useEffect, useRef, useState, type ReactNode } from 'react';

const REFRESH_COOLDOWN_MS = 10_000;
const lastRefreshByKey = new Map<string, number>();

export function resetSignedImageRefreshCooldowns(): void {
  lastRefreshByKey.clear();
}

/**
 * Renders an authenticated, short-lived signed image URL with bounded
 * expiration recovery. Never polls; on load error (e.g., expired 60s R2
 * signature), triggers at most one refresh per URL within a 10s cooldown.
 * Falls back cleanly if the image was removed or remains unavailable.
 */
export function V2SignedImage({
  src,
  alt,
  className,
  refreshKey,
  onExpired,
  fallback = null,
}: {
  src: string;
  alt: string;
  className?: string;
  refreshKey: string;
  onExpired?: () => void;
  fallback?: ReactNode;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const retriedSrcsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    setFailedSrc(null);
  }, [src]);

  if (failedSrc === src) {
    return <>{fallback}</>;
  }

  const handleError = () => {
    if (onExpired && !retriedSrcsRef.current.has(src)) {
      const now = Date.now();
      const last = lastRefreshByKey.get(refreshKey) ?? 0;
      if (now - last >= REFRESH_COOLDOWN_MS) {
        retriedSrcsRef.current.add(src);
        lastRefreshByKey.set(refreshKey, now);
        onExpired();
        return;
      }
    }
    setFailedSrc(src);
  };

  return <img src={src} alt={alt} className={className} onError={handleError} />;
}
