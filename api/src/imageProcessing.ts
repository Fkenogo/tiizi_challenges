import sharp, { type Metadata } from 'sharp';

export const MEDIA_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const MEDIA_UPLOAD_MAX_PIXELS = 16_000_000;
const ALLOWED_INPUT_FORMATS = new Set(['jpeg', 'png', 'webp']);

export type MediaPurpose = 'profile_image' | 'group_cover' | 'challenge_cover';

export interface ProcessedImageResult {
  buffer: Buffer;
  contentType: 'image/webp';
  byteSize: number;
  width: number;
  height: number;
}

export class ImageValidationError extends Error {
  readonly statusCode = 400;
  readonly code = 'invalid_image';
}

/**
 * Validate, decode, strip EXIF/GPS metadata, and re-encode an uploaded image
 * to a normalized sRGB WebP asset sized for its Tiizi surface.
 */
export async function validateAndOptimizeImage(
  rawBytes: Buffer,
  purpose: MediaPurpose,
): Promise<ProcessedImageResult> {
  if (!Buffer.isBuffer(rawBytes) || rawBytes.byteLength === 0) {
    throw new ImageValidationError('Image payload is empty');
  }
  if (rawBytes.byteLength > MEDIA_UPLOAD_MAX_BYTES) {
    throw new ImageValidationError('Image exceeds the 5 MiB size limit');
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(rawBytes, {
      limitInputPixels: MEDIA_UPLOAD_MAX_PIXELS,
      failOn: 'error',
    }).metadata();
  } catch {
    throw new ImageValidationError('Image file is invalid or exceeds pixel limits');
  }

  if (!metadata.format || !ALLOWED_INPUT_FORMATS.has(metadata.format)) {
    throw new ImageValidationError('Only JPEG, PNG, and WebP images are supported');
  }
  if (!metadata.width || !metadata.height || metadata.width * metadata.height > MEDIA_UPLOAD_MAX_PIXELS) {
    throw new ImageValidationError('Image dimensions are invalid or exceed 16 megapixels');
  }

  const pipeline = sharp(rawBytes, {
    limitInputPixels: MEDIA_UPLOAD_MAX_PIXELS,
    failOn: 'error',
  })
    .rotate()
    .toColorspace('srgb');

  if (purpose === 'profile_image') {
    pipeline.resize({ width: 256, height: 256, fit: 'cover', withoutEnlargement: true });
  } else {
    pipeline.resize({ width: 960, height: 540, fit: 'inside', withoutEnlargement: true });
  }

  // sharp omits EXIF/GPS/XMP metadata unless withMetadata() is explicitly called.
  const { data, info } = await pipeline.webp({ quality: 82 }).toBuffer({ resolveWithObject: true });
  if (!data.byteLength || !info.width || !info.height) {
    throw new ImageValidationError('Image optimization failed');
  }

  return {
    buffer: data,
    contentType: 'image/webp',
    byteSize: data.byteLength,
    width: info.width,
    height: info.height,
  };
}
