import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

const RETRY_DELAY_MS = 300;
const DEFAULT_LOAD_TIMEOUT_MS = 10_000;

/**
 * Renders an authenticated, short-lived signed image URL with bounded,
 * instance-local expiry recovery.
 *
 * Lifecycle rules:
 * - Same-asset URL rotation (`assetKey` unchanged, `src` changed): keeps the
 *   previously loaded image visible while the fresh URL loads, avoiding flashes.
 * - Persisted asset replacement (`assetKey` changed) or removal (`!src`):
 *   clears the previous image immediately so an obsolete asset is not left
 *   visible.
 * - Pending requests that fail or never complete within `loadTimeoutMs`:
 *   clears the previous image, triggers at most one `onExpired` refresh +
 *   retry, and settles on `fallback`.
 */
export function V2SignedImage({
  src,
  alt,
  className,
  refreshKey,
  assetKey,
  onExpired,
  fallback = null,
  loadingFallback,
  loadTimeoutMs = DEFAULT_LOAD_TIMEOUT_MS,
}: {
  src: string | null | undefined;
  alt: string;
  className?: string;
  refreshKey: string;
  assetKey?: string | null;
  onExpired?: () => void;
  fallback?: ReactNode;
  loadingFallback?: ReactNode;
  loadTimeoutMs?: number;
}) {
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<{
    src: string;
    assetKey: string | null | undefined;
  } | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const hasRefreshedRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
  }, []);

  useEffect(() => {
    hasRefreshedRef.current = false;
    setLastLoaded(null);
  }, [refreshKey, assetKey]);

  useEffect(() => {
    clearTimers();
    setLoadedSrc(null);
    setFailedSrc(null);
    setRetrying(false);
    if (!src) {
      setLastLoaded(null);
      return;
    }
    setAttempt((current) => current + 1);
  }, [src, clearTimers]);

  useEffect(() => clearTimers, [clearTimers]);

  const handleError = useCallback(() => {
    clearTimers();
    setLastLoaded(null);
    if (!src) return;
    if (!hasRefreshedRef.current && onExpiredRef.current) {
      hasRefreshedRef.current = true;
      setLoadedSrc(null);
      setRetrying(true);
      onExpiredRef.current();
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        setRetrying(false);
        setAttempt((current) => current + 1);
      }, RETRY_DELAY_MS);
      return;
    }
    setRetrying(false);
    setFailedSrc(src);
  }, [clearTimers, src]);

  useEffect(() => {
    if (loadTimerRef.current) {
      clearTimeout(loadTimerRef.current);
      loadTimerRef.current = null;
    }
    if (!src || loadedSrc === src || failedSrc === src || retrying) {
      return;
    }
    if (loadTimeoutMs <= 0) return;
    loadTimerRef.current = setTimeout(() => {
      loadTimerRef.current = null;
      handleError();
    }, loadTimeoutMs);
    return () => {
      if (loadTimerRef.current) {
        clearTimeout(loadTimerRef.current);
        loadTimerRef.current = null;
      }
    };
  }, [src, attempt, loadedSrc, failedSrc, retrying, loadTimeoutMs, handleError]);

  if (!src) {
    return <>{fallback}</>;
  }

  if (failedSrc === src) {
    return (
      <>
        {fallback}
        <span className="sr-only" role="status" aria-live="polite">{`${alt} is unavailable.`}</span>
      </>
    );
  }

  const ready = loadedSrc === src;
  const keepPreviousVisible =
    !ready &&
    lastLoaded !== null &&
    lastLoaded.src !== src &&
    lastLoaded.assetKey === assetKey;
  return (
    <>
      {!ready && (keepPreviousVisible ? (
        <img
          src={lastLoaded.src}
          alt={alt}
          className={className}
        />
      ) : (
        loadingFallback ?? fallback
      ))}
      <img
        key={`${refreshKey}:${assetKey ?? ''}:${src}:${attempt}`}
        src={src}
        alt={alt}
        className={ready ? className : 'hidden'}
        onLoad={() => {
          clearTimers();
          hasRefreshedRef.current = false;
          setLoadedSrc(src);
          setLastLoaded({ src, assetKey });
        }}
        onError={handleError}
      />
      {!ready && (
        <span className="sr-only" role="status" aria-live="polite">
          {retrying ? `Refreshing ${alt}…` : `Loading ${alt}…`}
        </span>
      )}
    </>
  );
}
