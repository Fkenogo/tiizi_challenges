import type { ReactNode } from 'react';
import { V2Field, V2TextArea, V2TextInput } from '../../components/V2Primitives';
import type { NameAppearanceState } from './stepStates';
import { V2LocalImagePicker } from '../../media/V2LocalImagePicker';
import type { LocalImagePreviewState } from '../../media/useLocalImagePreview';

/**
 * Reusable "Name & Appearance" fields: title, description and optional photo.
 * Hosting, Support and Social Cause are NOT here (member-only, composed by
 * the member Wizard). `intro` is the composition's lead-in copy.
 */
export function NameAppearanceFields({
  state,
  onUpdate,
  intro,
  coverPhoto,
}: {
  state: NameAppearanceState;
  onUpdate: (patch: Partial<NameAppearanceState>) => void;
  intro: ReactNode;
  coverPhoto?: LocalImagePreviewState;
}) {
  return (
    <>
      {intro}
      <V2Field label="Challenge title"><V2TextInput value={state.title} onChange={(title) => onUpdate({ title })} placeholder="e.g. Sunrise walking streak" /></V2Field>
      <V2Field label="Description" hint="Optional. Explain what this Challenge means to your Group."><V2TextArea value={state.description} onChange={(description) => onUpdate({ description })} placeholder="Add a short description…" /></V2Field>
      {coverPhoto && (
        <V2LocalImagePicker
          subject="Challenge cover"
          preview={coverPhoto}
          previewClassName="h-28 w-full rounded-xl bg-slate-100"
          fallback={<div className="flex h-full w-full items-center justify-center bg-slate-100 px-4 text-center text-sm font-medium text-slate-500">No photo selected</div>}
        />
      )}
    </>
  );
}
