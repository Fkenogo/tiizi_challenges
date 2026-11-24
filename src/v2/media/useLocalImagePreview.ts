import { useCallback, useEffect, useState } from 'react';

export const LOCAL_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const LOCAL_IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp';

const ALLOWED_IMAGE_TYPES = new Set(LOCAL_IMAGE_ACCEPT.split(','));

/** A browser-memory-only image draft. The object URL is created and revoked strictly in useEffect (React 18 StrictMode safe). */
export function useLocalImagePreview(initialFile?: File | null) {
  const [file, setFile] = useState<File | null>(() => initialFile ?? null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (initialFile && !file) {
      setFile(initialFile);
    }
  }, [initialFile, file]);

  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  const selectFile = useCallback((nextFile: File) => {
    if (!ALLOWED_IMAGE_TYPES.has(nextFile.type)) {
      setError('Choose a JPG, PNG or WebP image.');
      return false;
    }
    if (nextFile.size > LOCAL_IMAGE_MAX_BYTES) {
      setError('Choose an image smaller than 5 MB.');
      return false;
    }
    setError(null);
    setFile(nextFile);
    return true;
  }, []);

  const remove = useCallback(() => {
    setFile(null);
    setError(null);
  }, []);

  return { previewUrl, file, error, selectFile, remove };
}

export type LocalImagePreviewState = ReturnType<typeof useLocalImagePreview>;
