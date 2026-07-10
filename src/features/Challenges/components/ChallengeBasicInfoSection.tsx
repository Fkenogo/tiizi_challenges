import { Camera } from 'lucide-react';
import { ChangeEvent, useRef } from 'react';
import {
  isLikelyDirectImageUrl,
  isPersistableImageSource,
  isValidImageUrl,
} from '../../../services/imageUploadService';
import type { ChallengeType } from '../utils/challengeFormDefaults';
import { CHALLENGE_TYPE_DESCRIPTIONS, MODE_DESCRIPTIONS } from '../utils/challengeFormCopy';

const TYPE_OPTIONS: Array<{ id: ChallengeType; label: string }> = [
  { id: 'collective', label: 'Collective' },
  { id: 'competitive', label: 'Competitive' },
  { id: 'streak', label: 'Streak' },
];

const TYPE_DESCRIPTIONS = CHALLENGE_TYPE_DESCRIPTIONS;

interface ChallengeBasicInfoSectionProps {
  // Cover image
  coverImageUrl: string;
  coverImageUploadState: 'idle' | 'uploading';
  onCoverFileChange: (e: ChangeEvent<HTMLInputElement>) => void;
  onCoverUrlChange: (value: string) => void;

  // Name & description
  name: string;
  onNameChange: (value: string) => void;
  description: string;
  onDescriptionChange: (value: string) => void;

  // Content rendered inside the Info field group, before Name (Wizard uses this for Group selector)
  afterCoverSlot?: React.ReactNode;

  // Template mode
  isWellnessMode: boolean;
  onModeChange: (mode: 'fitness' | 'wellness') => void;

  // Challenge type
  challengeType: ChallengeType;
  onTypeChange: (type: ChallengeType) => void;

  // Optional wrapper class for layout context (e.g. "st-form-max mt-3" in the Wizard)
  className?: string;
}

export function ChallengeBasicInfoSection({
  coverImageUrl,
  coverImageUploadState,
  onCoverFileChange,
  onCoverUrlChange,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  afterCoverSlot,
  isWellnessMode,
  onModeChange,
  challengeType,
  onTypeChange,
  className,
}: ChallengeBasicInfoSectionProps) {
  const coverInputRef = useRef<HTMLInputElement>(null);

  return (
    <div className={className}>
      {/* Cover Image */}
      <div className="st-card border-dashed border-primary/40 p-4 text-center">
        <div className="h-12 w-12 rounded-full bg-primary/10 text-primary mx-auto flex items-center justify-center">
          <Camera size={24} />
        </div>
        <p className="text-[16px] leading-[22px] font-bold text-slate-900 mt-3">Upload Challenge Cover</p>
        <p className="text-[13px] leading-[18px] text-slate-500 mt-1">Add a visual for your challenge</p>
        {coverImageUrl && (
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-200">
            <img src={coverImageUrl} alt="Challenge cover preview" className="h-28 w-full object-cover" />
          </div>
        )}
        <input
          ref={coverInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={onCoverFileChange}
        />
        <button
          className="mt-4 h-11 rounded-xl bg-primary px-5 text-[14px] font-bold text-white disabled:opacity-60"
          onClick={() => coverInputRef.current?.click()}
          disabled={coverImageUploadState === 'uploading'}
        >
          {coverImageUploadState === 'uploading' ? 'Uploading image...' : 'Choose Image'}
        </button>
        <input
          className="st-input mt-3"
          value={coverImageUrl}
          onChange={(e) => onCoverUrlChange(e.target.value)}
          placeholder="Paste image URL"
        />
        {coverImageUrl.trim() && !isValidImageUrl(coverImageUrl) && !coverImageUrl.startsWith('data:image/') && (
          <p className="mt-2 text-[12px] leading-[16px] text-amber-600">
            Image URL should start with http:// or https://
          </p>
        )}
        {isValidImageUrl(coverImageUrl) && !isLikelyDirectImageUrl(coverImageUrl) && (
          <p className="mt-2 text-[12px] leading-[16px] text-amber-600">
            This looks like a page/album link. Use a direct image URL so the cover can render correctly.
          </p>
        )}
        {coverImageUrl.startsWith('data:image/') && !isPersistableImageSource(coverImageUrl) && (
          <p className="mt-2 text-[12px] leading-[16px] text-amber-600">
            Selected image is too large. Use a smaller file or paste an image URL.
          </p>
        )}
      </div>

      {/* Info */}
      <p className="mt-4 st-section-title text-primary">Info</p>
      <div className="mt-2.5 space-y-3.5">
        {afterCoverSlot}
        <div>
          <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">
            Challenge Name
          </p>
          <input
            className="st-input mt-2"
            value={name}
            onChange={(e) => onNameChange(e.target.value)}
            placeholder="e.g. 30 Day Shred"
          />
        </div>
        <div>
          <p className="text-[12px] leading-[16px] tracking-[0.08em] font-semibold uppercase text-slate-800">
            Challenge Description
          </p>
          <textarea
            value={description}
            onChange={(e) => onDescriptionChange(e.target.value)}
            placeholder="Tell everyone what this is about..."
            className="w-full h-24 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-[16px] leading-[22px] text-slate-700"
          />
        </div>
      </div>

      {/* Template Mode */}
      <p className="mt-4 st-section-title text-primary">Template Mode</p>
      <div className="mt-2.5 grid grid-cols-2 gap-2">
        {(['fitness', 'wellness'] as const).map((mode) => (
          <button
            key={mode}
            className={`h-11 rounded-full text-[12px] uppercase tracking-[0.1em] font-bold ${
              (mode === 'fitness' && !isWellnessMode) || (mode === 'wellness' && isWellnessMode)
                ? 'bg-primary text-white'
                : 'bg-white border border-slate-200 text-slate-700'
            }`}
            onClick={() => onModeChange(mode)}
          >
            {mode === 'fitness' ? 'Fitness' : 'Wellness'}
          </button>
        ))}
      </div>
      <div className="mt-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="text-[13px] leading-[18px] text-primary font-semibold">
          {isWellnessMode ? MODE_DESCRIPTIONS.wellness : MODE_DESCRIPTIONS.fitness}
        </p>
      </div>

      {/* Challenge Type */}
      <p className="mt-4 st-section-title text-primary">Challenge Type</p>
      <div className="mt-2.5 grid grid-cols-3 gap-2">
        {TYPE_OPTIONS.map((option) => (
          <button
            key={option.id}
            className={`h-11 rounded-full text-[12px] uppercase tracking-[0.1em] font-bold ${
              challengeType === option.id
                ? 'bg-primary text-white'
                : 'bg-white border border-slate-200 text-slate-700'
            }`}
            onClick={() => onTypeChange(option.id)}
          >
            {option.label}
          </button>
        ))}
      </div>
      <div className="mt-2.5 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2">
        <p className="text-[13px] leading-[18px] text-primary font-semibold">
          {TYPE_DESCRIPTIONS[challengeType]}
        </p>
      </div>
    </div>
  );
}
