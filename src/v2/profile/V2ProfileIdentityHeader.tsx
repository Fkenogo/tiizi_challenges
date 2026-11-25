import { useRef, type ChangeEvent, type ReactNode } from 'react';
import { AlertCircle, Camera, CheckCircle2, Loader2, MoreHorizontal, Pencil } from 'lucide-react';
import { V2SignedImage } from '../media/V2SignedImage';
import { LOCAL_IMAGE_ACCEPT, type LocalImagePreviewState } from '../media/useLocalImagePreview';
import { initialsFor } from './profileView';

export function V2ProfileIdentityHeader({
  displayName,
  persistedUrl,
  preview,
  durable,
  isSaving,
  error,
  success,
  refreshKey,
  onSelectFile,
  onRemove,
  onPersistedImageExpired,
  onEditName,
  children,
}: {
  displayName: string | null;
  persistedUrl: string | null;
  preview: LocalImagePreviewState;
  durable: boolean;
  isSaving: boolean;
  error: string | null;
  success: string | null;
  refreshKey: string;
  onSelectFile?: (file: File) => void | Promise<void>;
  onRemove?: () => void | Promise<void>;
  onPersistedImageExpired?: () => void;
  onEditName: () => void;
  children?: ReactNode;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDetailsElement>(null);
  const previewUrl = preview.previewUrl ?? persistedUrl;
  const canUpload = durable && Boolean(onSelectFile) && !isSaving;
  const initials = initialsFor(displayName);

  const handleFile = (event: ChangeEvent<HTMLInputElement>) => {
    if (isSaving) return;
    const file = event.currentTarget.files?.[0];
    if (file && preview.selectFile(file)) void onSelectFile?.(file);
    event.currentTarget.value = '';
  };

  return (
    <section aria-label="Profile identity" className="rounded-2xl border border-slate-200 bg-white p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label={previewUrl ? 'Replace profile photo' : 'Add profile photo'}
          aria-busy={isSaving}
          disabled={!canUpload}
          onClick={() => inputRef.current?.click()}
          className="relative flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-orange-50 text-xl font-black text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-orange-600 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {preview.previewUrl ? (
            <img src={preview.previewUrl} alt="Selected profile photo" className="h-full w-full object-cover" />
          ) : persistedUrl ? (
            <V2SignedImage
              src={persistedUrl}
              alt="Profile photo"
              className="h-full w-full object-cover"
              refreshKey={refreshKey}
              onExpired={onPersistedImageExpired}
              fallback={initials}
            />
          ) : (
            initials
          )}
          {isSaving && (
            <span className="absolute inset-0 flex items-center justify-center bg-slate-950/55 text-white" aria-hidden="true">
              <Loader2 className="h-5 w-5 animate-spin" />
            </span>
          )}
          {!isSaving && canUpload && (
            <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900 text-white ring-2 ring-white" aria-hidden="true">
              <Camera className="h-3 w-3" />
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={onEditName}
          className="group flex min-w-0 flex-1 items-center gap-2 rounded-lg px-1 py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600"
          aria-label={displayName ? 'Edit display name' : 'Add display name'}
        >
          <span className="min-w-0">
            <span className="block break-words text-lg font-black text-slate-900">{displayName ?? 'Add your name'}</span>
            <span className="mt-0.5 block text-xs text-slate-500">{displayName ? 'Your Tiizi identity' : 'Choose how Tiizi greets you'}</span>
          </span>
          <Pencil className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-orange-600" aria-hidden="true" />
        </button>

        {previewUrl && onRemove && (
          <details ref={menuRef} className="relative shrink-0">
            <summary
              aria-label="Profile photo options"
              className="flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full text-slate-500 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-600 [&::-webkit-details-marker]:hidden"
            >
              <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
            </summary>
            <div className="absolute right-0 top-11 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
              <button
                type="button"
                disabled={isSaving}
                onClick={() => {
                  if (isSaving) return;
                  menuRef.current?.removeAttribute('open');
                  preview.remove();
                  void onRemove();
                }}
                className="min-h-10 w-full rounded-lg px-3 text-left text-sm font-bold text-red-700 hover:bg-red-50 disabled:opacity-60"
              >
                Remove photo
              </button>
            </div>
          </details>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept={LOCAL_IMAGE_ACCEPT}
        aria-label="Choose profile photo"
        className="sr-only"
        disabled={isSaving}
        onChange={handleFile}
      />

      {preview.error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-xs font-bold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{preview.error}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3 flex items-start gap-2 text-xs font-bold text-red-700">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />{error}
        </p>
      )}
      {success && (
        <p role="status" aria-live="polite" className="mt-3 flex items-center gap-2 text-xs font-bold text-emerald-700">
          <CheckCircle2 className="h-4 w-4" aria-hidden="true" />{success}
        </p>
      )}
      {children}
    </section>
  );
}
