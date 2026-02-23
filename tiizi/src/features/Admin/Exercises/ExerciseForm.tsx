import { AdminExerciseInput } from '../../../services/adminExerciseService';
import {
  arrayToCsv,
  arrayToLines,
  csvToArray,
  difficultyOptions,
  linesToArray,
  metricTypeOptions,
  tier1Options,
  tier2Options,
} from './exerciseFormUtils';

type Props = {
  value: AdminExerciseInput;
  onChange: (next: AdminExerciseInput) => void;
};

export function ExerciseForm({ value, onChange }: Props) {
  return (
    <div className="space-y-3">
      <input
        value={value.name}
        onChange={(e) => onChange({ ...value, name: e.target.value })}
        placeholder="Exercise name"
        className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          value={value.tier_1}
          onChange={(e) => onChange({ ...value, tier_1: e.target.value })}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          {tier1Options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select
          value={value.tier_2}
          onChange={(e) => onChange({ ...value, tier_2: e.target.value })}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          {tier2Options.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <select
          value={value.difficulty}
          onChange={(e) => onChange({ ...value, difficulty: e.target.value })}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          {difficultyOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select
          value={value.metric.type}
          onChange={(e) => onChange({ ...value, metric: { ...value.metric, type: e.target.value } })}
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        >
          {metricTypeOptions.map((option) => <option key={option} value={option}>{option}</option>)}
        </select>
        <input
          value={value.metric.unit}
          onChange={(e) => onChange({ ...value, metric: { ...value.metric, unit: e.target.value } })}
          placeholder="Metric unit (e.g. reps, sec, km)"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <label className="h-11 rounded-xl border border-slate-200 px-3 text-sm flex items-center justify-between">
          <span>Allow custom unit</span>
          <input
            type="checkbox"
            checked={value.metric.allowCustomUnit}
            onChange={(e) => onChange({ ...value, metric: { ...value.metric, allowCustomUnit: e.target.checked } })}
          />
        </label>
      </div>

      <textarea
        value={value.description}
        onChange={(e) => onChange({ ...value, description: e.target.value })}
        placeholder="Description (max 200 chars)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />

      <textarea
        value={arrayToLines(value.setup)}
        onChange={(e) => onChange({ ...value, setup: linesToArray(e.target.value) })}
        placeholder="Setup instructions (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.execution)}
        onChange={(e) => onChange({ ...value, execution: linesToArray(e.target.value) })}
        placeholder="Execution instructions (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.formCues)}
        onChange={(e) => onChange({ ...value, formCues: linesToArray(e.target.value) })}
        placeholder="Form cues (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.commonMistakes)}
        onChange={(e) => onChange({ ...value, commonMistakes: linesToArray(e.target.value) })}
        placeholder="Common mistakes (one per line, optional)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />

      <textarea
        value={arrayToLines(value.breathing)}
        onChange={(e) => onChange({ ...value, breathing: linesToArray(e.target.value) })}
        placeholder="Breathing notes (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />

      <input
        value={arrayToCsv(value.musclesTargeted)}
        onChange={(e) => onChange({ ...value, musclesTargeted: csvToArray(e.target.value) })}
        placeholder="Muscles targeted (comma separated)"
        className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
      />
      <input
        value={arrayToCsv(value.equipment)}
        onChange={(e) => onChange({ ...value, equipment: csvToArray(e.target.value) })}
        placeholder="Equipment required (comma separated)"
        className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
      />
      <input
        value={arrayToCsv(value.trainingGoals)}
        onChange={(e) => onChange({ ...value, trainingGoals: csvToArray(e.target.value) })}
        placeholder="Training goals (comma separated)"
        className="w-full h-11 rounded-xl border border-slate-200 px-3 text-sm"
      />

      <textarea
        value={arrayToLines(value.progressions)}
        onChange={(e) => onChange({ ...value, progressions: linesToArray(e.target.value) })}
        placeholder="Progressions (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.advancedVariations)}
        onChange={(e) => onChange({ ...value, advancedVariations: linesToArray(e.target.value) })}
        placeholder="Regressions/advanced variations (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />
      <textarea
        value={arrayToLines(value.safetyNotes)}
        onChange={(e) => onChange({ ...value, safetyNotes: linesToArray(e.target.value) })}
        placeholder="Safety notes (one per line)"
        className="w-full min-h-20 rounded-xl border border-slate-200 p-3 text-sm"
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <input
          value={value.recommendedVolume.beginner}
          onChange={(e) => onChange({ ...value, recommendedVolume: { ...value.recommendedVolume, beginner: e.target.value } })}
          placeholder="Recommended volume: beginner"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          value={value.recommendedVolume.intermediate}
          onChange={(e) => onChange({ ...value, recommendedVolume: { ...value.recommendedVolume, intermediate: e.target.value } })}
          placeholder="Recommended volume: intermediate"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
        <input
          value={value.recommendedVolume.advanced}
          onChange={(e) => onChange({ ...value, recommendedVolume: { ...value.recommendedVolume, advanced: e.target.value } })}
          placeholder="Recommended volume: advanced"
          className="h-11 rounded-xl border border-slate-200 px-3 text-sm"
        />
      </div>
    </div>
  );
}

