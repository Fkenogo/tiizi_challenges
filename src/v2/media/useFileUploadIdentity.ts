import { useCallback, useRef } from 'react';

function nextUploadKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `media-${Date.now()}-${Math.random().toString(36).slice(2, 12)}`;
}

/**
 * Tracks a stable idempotency key per File reference so retrying an unchanged
 * File reuses safe idempotency semantics while selecting a new File rotates to
 * a fresh upload identity.
 */
export function useFileUploadIdentity() {
  const fileRef = useRef<File | null>(null);
  const keyRef = useRef<string>(nextUploadKey());

  const keyForFile = useCallback((file: File): string => {
    if (fileRef.current !== file) {
      fileRef.current = file;
      keyRef.current = nextUploadKey();
    }
    return keyRef.current;
  }, []);

  const reset = useCallback(() => {
    fileRef.current = null;
    keyRef.current = nextUploadKey();
  }, []);

  return { keyForFile, reset };
}
