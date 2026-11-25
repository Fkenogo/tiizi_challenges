import { useEffect, useRef, useState, type ReactNode } from 'react';

const RETRY_DELAY_MS = 300;

/**
 * Renders an authenticated, short-lived signed image URL with bounded,
 * instance-local expiry recovery. A failed load shows the neutral fallback
 * while one authenticated refresh is requested; a same-URL refresh can retry
 * the load once, but a persistent failure never loops.
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
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const retriedSrcRef = useRef<string | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    retriedSrcRef.current = null;
    setLoadedSrc(null);
    setFailedSrc(null);
    setRetrying(false);
    setAttempt((current) => current + 1);
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    retryTimerRef.current = null;
  }, [src]);

  useEffect(() => () => {
    if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
  }, []);

  const handleError = () => {
    if (retriedSrcRef.current !== src && onExpired) {
      retriedSrcRef.current = src;
      setLoadedSrc(null);
      setRetrying(true);
      onExpired();
      retryTimerRef.current = setTimeout(() => {
        retryTimerRef.current = null;
        setRetrying(false);
        setAttempt((current) => current + 1);
      }, RETRY_DELAY_MS);
      return;
    }
    setRetrying(false);
    setFailedSrc(src);
  };

  if (failedSrc === src) {
    return (
      <>
        {fallback}
        <span className="sr-only" role="status" aria-live="polite">{`${alt} is unavailable.`}</span>
      </>
    );
  }

  const ready = loadedSrc === src;
  return (
    <>
      {!ready && fallback}
      <img
        key={`${refreshKey}:${src}:${attempt}`}
        src={src}
        alt={alt}
        className={ready ? className : 'hidden'}
        onLoad={() => setLoadedSrc(src)}
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
