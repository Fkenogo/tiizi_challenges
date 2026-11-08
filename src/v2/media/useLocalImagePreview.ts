import { useCallback, useEffect, useState } from 'react';

export const LOCAL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const LOCAL_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

const ALLOWED_IMAGE_TYPES = new Set(LOCAL_IMAGE_ACCEPT.split(','));

/** A browser-memory-only image draft. The object URL is revoked on replace, remove, and unmount. */
export function useLocalImagePreview() {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
  }, [previewUrl]);

  const selectFile = useCallback((file: File) => {
    if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
      setError('Choose a JPG, PNG or WebP image.');
      return false;
    }
    if (file.size > LOCAL_IMAGE_MAX_BYTES) {
      setError('Choose an image smaller than 5 MB.');
      return false;
    }
    setError(null);
    setFile(file);
    const nextUrl = URL.createObjectURL(file);
    setPreviewUrl(nextUrl);
    return true;
  }, []);

  const remove = useCallback(() => {
    setFile(null);
    setPreviewUrl(null);
    setError(null);
  }, []);

  return { previewUrl, file, error, selectFile, remove };
}

export type LocalImagePreviewState = ReturnType<typeof useLocalImagePreview>;
