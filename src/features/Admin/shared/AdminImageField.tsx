import { ChangeEvent, useRef, useState } from 'react';
import {
  isLikelyDirectImageUrl,
  isPersistableImageSource,
  isValidImageUrl,
  readFileAsDataUrl,
  uploadImageFile,
} from '../../../services/imageUploadService';

type Props = {
  value?: string;
  onChange: (next: string) => void;
  label: string;
  placeholder: string;
  folder: string;
  uid?: string;
  alt: string;
};

export function AdminImageField({ value, onChange, label, placeholder, folder, uid, alt }: Props) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading'>('idle');
  const [previewUrl, setPreviewUrl] = useState('');
  const [error, setError] = useState('');
  const [previewFailed, setPreviewFailed] = useState(false);
  const imageSource = previewUrl || value?.trim() || '';
  const hasImage = imageSource.length > 0;

  const handleFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError('');
    setPreviewFailed(false);
    setUploadState('uploading');

    try {
      const localPreview = await readFileAsDataUrl(file);
      setPreviewUrl(localPreview);
      const uploadedUrl = await uploadImageFile(file, folder, uid);
      onChange(uploadedUrl);
      setPreviewUrl('');
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : 'Could not upload image.');
    } finally {
      setUploadState('idle');
      if (event.target) event.target.value = '';
    }
  };

  const handleUrlChange = (next: string) => {
    setPreviewUrl('');
    setPreviewFailed(false);
    setError('');
    onChange(next);
  };

  const clearImage = () => {
    setPreviewUrl('');
    setPreviewFailed(false);
    setError('');
    onChange('');
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase text-slate-500">{label}</p>
        {hasImage ? (
          <button type="button" className="text-xs font-bold text-red-600" onClick={clearImage}>
            Remove
          </button>
        ) : null}
      </div>

      {hasImage ? (
        <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {previewFailed ? (
            <div className="flex h-36 items-center justify-center px-4 text-center text-sm text-slate-500">
              Image preview unavailable. Check the URL or upload a replacement.
            </div>
          ) : (
            <img
              src={imageSource}
              alt={alt}
              className="h-36 w-full object-cover"
              onError={() => setPreviewFailed(true)}
              onLoad={() => setPreviewFailed(false)}
            />
          )}
        </div>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileSelected}
        />
        <button
          type="button"
          className="h-10 rounded-lg bg-primary px-4 text-sm font-bold text-white disabled:opacity-60"
          disabled={uploadState === 'uploading'}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploadState === 'uploading' ? 'Uploading image...' : hasImage ? 'Replace image' : 'Upload image'}
        </button>
      </div>

      <input
        value={value ?? ''}
        onChange={(event) => handleUrlChange(event.target.value)}
        placeholder={placeholder}
        className="mt-3 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm"
      />

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {value?.trim() && !isValidImageUrl(value) && !value.startsWith('data:image/') ? (
        <p className="mt-2 text-xs text-amber-600">Image URL should start with http:// or https://.</p>
      ) : null}
      {value && isValidImageUrl(value) && !isLikelyDirectImageUrl(value) ? (
        <p className="mt-2 text-xs text-amber-600">This looks like a webpage link. Use a direct image URL for reliable display.</p>
      ) : null}
      {value?.startsWith('data:image/') && !isPersistableImageSource(value) ? (
        <p className="mt-2 text-xs text-amber-600">Selected image is too large. Upload a smaller file or paste an image URL.</p>
      ) : null}
    </div>
  );
}
