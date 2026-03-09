import { isLikelyDirectImageUrl, isValidImageUrl } from '../../../services/imageUploadService';
import type { AdminWellnessActivityInput } from '../../../services/adminWellnessActivityService';
import {
  arrayToLines,
  linesToArray,
  wellnessActivityTypeOptions,
  wellnessCategoryOptions,
  wellnessDifficultyOptions,
} from './wellnessActivityFormUtils';

type Props = {
  value: AdminWellnessActivityInput;
  onChange: (next: AdminWellnessActivityInput) => void;
};

export function WellnessActivityForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <input
        value={value.name}
        onChange={(event) => onChange({ ...value, name: event.target.value })}
        placeholder="Activity name"
        className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
      />
      <input
        value={value.shortName}
        onChange={(event) => onChange({ ...value, shortName: event.target.value })}
        placeholder="Short name"
        className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
      />
      <textarea
        value={value.description}
        onChange={(event) => onChange({ ...value, description: event.target.value })}
        placeholder="Description"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <input
        value={value.coverImage ?? ''}
        onChange={(event) => onChange({ ...value, coverImage: event.target.value })}
        placeholder="Cover image URL (optional)"
        className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
      />
      {!!value.coverImage && isValidImageUrl(value.coverImage) && !isLikelyDirectImageUrl(value.coverImage) ? (
        <p className="text-xs text-amber-600">Album/page URL accepted. Preview cards may require a direct image link.</p>
      ) : null}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          value={value.category}
          onChange={(event) => onChange({ ...value, category: event.target.value as AdminWellnessActivityInput['category'] })}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          {wellnessCategoryOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select
          value={value.difficulty}
          onChange={(event) => onChange({ ...value, difficulty: event.target.value as AdminWellnessActivityInput['difficulty'] })}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          {wellnessDifficultyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select
          value={value.activityType}
          onChange={(event) => onChange({ ...value, activityType: event.target.value as AdminWellnessActivityInput['activityType'] })}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          {wellnessActivityTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
        <input
          value={value.icon}
          onChange={(event) => onChange({ ...value, icon: event.target.value })}
          placeholder="Icon (emoji)"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          value={value.defaultMetricUnit}
          onChange={(event) => onChange({ ...value, defaultMetricUnit: event.target.value })}
          placeholder="Metric unit (hours/ml/count)"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          type="number"
          min={0}
          value={value.defaultTargetValue}
          onChange={(event) => onChange({ ...value, defaultTargetValue: Number(event.target.value) || 0 })}
          placeholder="Default target"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          type="number"
          min={1}
          value={value.suggestedFrequency}
          onChange={(event) => onChange({ ...value, suggestedFrequency: Number(event.target.value) || 1 })}
          placeholder="Frequency/day"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
      </div>

      <textarea
        value={arrayToLines(value.protocolSteps ?? [])}
        onChange={(event) => onChange({ ...value, protocolSteps: linesToArray(event.target.value) })}
        placeholder="Protocol steps (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.benefits ?? [])}
        onChange={(event) => onChange({ ...value, benefits: linesToArray(event.target.value) })}
        placeholder="Benefits (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.guidelines ?? [])}
        onChange={(event) => onChange({ ...value, guidelines: linesToArray(event.target.value) })}
        placeholder="Guidelines (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.warnings ?? [])}
        onChange={(event) => onChange({ ...value, warnings: linesToArray(event.target.value) })}
        placeholder="Warnings (one per line, optional)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.tags ?? [])}
        onChange={(event) => onChange({ ...value, tags: linesToArray(event.target.value) })}
        placeholder="Tags (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          type="number"
          min={0}
          value={value.defaultPoints}
          onChange={(event) => onChange({ ...value, defaultPoints: Number(event.target.value) || 0 })}
          placeholder="Default points"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <label className="h-11 rounded-xl border border-slate-200 px-3 text-sm flex items-center justify-between">
          <span>Popular</span>
          <input
            type="checkbox"
            checked={value.popular}
            onChange={(event) => onChange({ ...value, popular: event.target.checked })}
          />
        </label>
        <label className="h-11 rounded-xl border border-slate-200 px-3 text-sm flex items-center justify-between">
          <span>Medical supervision required</span>
          <input
            type="checkbox"
            checked={value.medicalSupervisionRequired}
            onChange={(event) => onChange({ ...value, medicalSupervisionRequired: event.target.checked })}
          />
        </label>
      </div>
    </div>
  );
}
