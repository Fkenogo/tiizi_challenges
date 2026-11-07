import { useRef, type ReactNode, type ChangeEvent } from 'react';
import { LOCAL_IMAGE_ACCEPT, useLocalImagePreview } from './useLocalImagePreview';

type PreviewState = ReturnType<typeof useLocalImagePreview>;

export function V2LocalImagePicker({
  subject,
  preview,
  className = '',
  previewClassName,
  imageClassName = 'h-full w-full object-cover',
  messageClassName = 'text-slate-500',
  errorClassName = 'text-red-700',
  fallback,
}: {
  subject: string;
  preview: PreviewState;
  className?: string;
  previewClassName: string;
  imageClassName?: string;
  messageClassName?: string;
  errorClassName?: string;
  fallback: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    if (file) preview.selectFile(file);
    // Let the same image be selected again after removal or a rejected file.
    event.currentTarget.value = '';
  };

  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <div className={`${previewClassName} overflow-hidden`}>
        {preview.previewUrl ? (
          <img src={preview.previewUrl} alt={`${subject} local preview`} className={imageClassName} />
        ) : fallback}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={LOCAL_IMAGE_ACCEPT}
        aria-label={`Choose ${subject.toLowerCase()}`}
        className="sr-only"
        onChange={handleFile}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
        >
          {preview.previewUrl ? 'Change Photo' : 'Add Photo'}
        </button>
        {preview.previewUrl && (
          <button
            type="button"
            onClick={preview.remove}
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            Remove Photo
          </button>
        )}
      </div>
      <p className={`text-xs leading-5 ${messageClassName}`} role="status" aria-live="polite">
        {preview.previewUrl
          ? 'Local preview only. This photo is not permanently saved.'
        : 'JPG, PNG or WebP · 5 MB or smaller. This photo will not be permanently saved.'}
      </p>
      {preview.error && <p role="alert" className={`text-xs font-bold ${errorClassName}`}>{preview.error}</p>}
    </div>
  );
}
