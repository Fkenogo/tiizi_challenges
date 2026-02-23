import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import { storage } from '../lib/firebase';

const IMAGE_MIME_PREFIX = 'image/';
// Firestore single document limit is 1 MiB. Keep some headroom for other fields.
const MAX_PERSISTABLE_DATA_URL_LENGTH = 900_000;

export function isValidImageUrl(value: string): boolean {
  if (!value.trim()) return false;
  try {
    const parsed = new URL(value.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsDataURL(file);
  });
}

export function isPersistableImageSource(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (isValidImageUrl(trimmed)) return true;
  if (!trimmed.startsWith('data:image/')) return false;
  return trimmed.length <= MAX_PERSISTABLE_DATA_URL_LENGTH;
}

export async function uploadImageFile(file: File, folder: string, uid?: string): Promise<string> {
  if (!file.type.startsWith(IMAGE_MIME_PREFIX)) {
    throw new Error('Only image files are supported.');
  }

  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg';
  const safeExtension = extension.replace(/[^a-z0-9]/g, '') || 'jpg';
  const key = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${safeExtension}`;
  const path = `${folder}/${uid || 'anon'}/${key}`;
  const imageRef = ref(storage, path);

  await uploadBytes(imageRef, file, {
    contentType: file.type,
    cacheControl: 'public,max-age=3600',
  });

  return getDownloadURL(imageRef);
}
