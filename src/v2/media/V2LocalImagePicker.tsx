import { useRef, type ReactNode, type ChangeEvent } from 'react';
import { LOCAL_IMAGE_ACCEPT, useLocalImagePreview } from './useLocalImagePreview';
import { V2SignedImage } from './V2SignedImage';

type PreviewState = ReturnType<typeof useLocalImagePreview>;

export function V2LocalImagePicker({
  subject,
  preview,
  persistedUrl,
  onPersistedImageExpired,
  onSelectFile,
  onRemove,
  isSaving = false,
  durable = false,
  refreshKey = `picker-${subject}`,
  draftPersistenceMessage,
  className = '',
  previewClassName,
  imageClassName = 'h-full w-full object-cover',
  messageClassName = 'text-slate-500',
  errorClassName = 'text-red-700',
  fallback,
}: {
  subject: string;
  preview: PreviewState;
  persistedUrl?: string | null;
  onPersistedImageExpired?: () => void;
  onSelectFile?: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  isSaving?: boolean;
  durable?: boolean;
  refreshKey?: string;
  draftPersistenceMessage?: string;
  className?: string;
  previewClassName: string;
  imageClassName?: string;
  messageClassName?: string;
  errorClassName?: string;
  fallback: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const displayUrl = preview.previewUrl ?? persistedUrl ?? null;
  const isPersistedUrl = !preview.previewUrl && Boolean(persistedUrl);
  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (isSaving) return;
    const file = event.currentTarget.files?.[0];
    if (file && preview.selectFile(file)) {
      void onSelectFile?.(file);
    }
    // Let the same image be selected again after removal or a rejected file.
    event.currentTarget.value = '';
  };

  const handleRemove = () => {
    if (isSaving) return;
    preview.remove();
    void onRemove?.();
  };

  return (
    <div className={`min-w-0 space-y-2 ${className}`}>
      <div className={`${previewClassName} overflow-hidden`}>
        {isPersistedUrl && persistedUrl ? (
          <V2SignedImage
            src={persistedUrl}
            alt={durable ? subject : `${subject} local preview`}
            className={imageClassName}
            refreshKey={refreshKey}
            onExpired={onPersistedImageExpired}
            fallback={fallback}
            loadingFallback={<div aria-hidden="true" className="h-full w-full animate-pulse bg-slate-200/80" />}
          />
        ) : displayUrl ? (
          <img src={displayUrl} alt={durable ? subject : `${subject} local preview`} className={imageClassName} />
        ) : fallback}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={LOCAL_IMAGE_ACCEPT}
        aria-label={`Choose ${subject.toLowerCase()}`}
        className="sr-only"
        disabled={isSaving}
        onChange={handleFile}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={isSaving}
          onClick={() => inputRef.current?.click()}
          className="min-h-10 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white hover:bg-orange-700 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-700"
        >
          {isSaving ? 'Saving…' : displayUrl ? 'Change Photo' : 'Add Photo'}
        </button>
        {displayUrl && (
          <button
            type="button"
            disabled={isSaving}
            onClick={handleRemove}
            className="min-h-10 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-500"
          >
            Remove Photo
          </button>
        )}
      </div>
      <p className={`text-xs leading-5 ${messageClassName}`} role="status" aria-live="polite">
        {isSaving
          ? 'Saving photo…'
          : durable
            ? displayUrl
              ? 'JPG, PNG or WebP · Saved to your account.'
              : 'JPG, PNG or WebP · 5 MB or smaller.'
            : draftPersistenceMessage
              ? draftPersistenceMessage
              : displayUrl
                ? 'Local preview only. This photo is not permanently saved.'
                : 'JPG, PNG or WebP · 5 MB or smaller. This photo will not be permanently saved.'}
      </p>
      {preview.error && <p role="alert" className={`text-xs font-bold ${errorClassName}`}>{preview.error}</p>}
    </div>
  );
}
