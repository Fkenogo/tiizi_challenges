import { describe, expect, it } from 'vitest';
import { derivePreview } from './templatePreviewModel';
import { activityConfig, contentOf, versionOf } from './testing/fixtures';

describe('Template preview derivation', () => {
  it('presents the stored content with shared member labels and no derived goal', () => {
    const model = derivePreview(
      versionOf('a'.repeat(64), contentOf({}, [activityConfig('act-1', { targetValue: 100 }), activityConfig('act-2', { metric: 'weight', unit: 'kilograms', targetValue: 40, loadBasis: 'PER_SIDE', position: 1 })])),
      { 'act-1': 'Push-ups', 'act-2': 'Plank' },
    );
    expect(model.title).toBe('Hundred Rep Race');
    expect(model.challengeTypeLabel).toBe('Race Challenge');
    expect(model.summary).toBe('A short race.');
    expect(model.tags).toEqual(['Strength']);
    expect(model.durationDays).toBe(14);
    expect(model.durationChoices).toEqual([7, 14]);
    expect(model.activities.map((a) => [a.name, a.metric, a.unit, a.target])).toEqual([
      ['Push-ups', 'Reps', 'reps', '100'], ['Plank', 'Weight', 'kilograms', '40'],
    ]);
    expect(model.activities[1].settings).toEqual(['Weight reported as: Per side']);
    expect(model.whatCounts.some((line) => /ranked/.test(line))).toBe(true);
    expect(model.gaps).toEqual([]);
    expect(JSON.stringify(model)).not.toMatch(/goal/i);
  });
  it('shows counting settings for time and completion Activities', () => {
    const model = derivePreview(versionOf(null, contentOf({}, [
      activityConfig('act-1', { metric: 'duration', unit: 'minutes', durationMode: 'ACCUMULATED' }),
      activityConfig('act-2', { metric: 'completion', unit: 'completion', completionOccurrence: 'one guided session', position: 1 }),
    ])), {});
    expect(model.activities[0].settings).toEqual(['Time counts: Added up across the day']);
    expect(model.activities[1].settings).toEqual(['Counts when: one guided session']);
    expect(model.activities[0].name).toMatch(/name unavailable/);
  });
  it('lists what is still missing from an incomplete draft without claiming validity', () => {
    const model = derivePreview({ content: { summary: null, focusTags: [], sortOrder: 0, coverId: null, durationDays: null, durationPresetDays: null, composer: { activities: [] } } }, {});
    expect(model.title).toBe('Untitled Template');
    expect(model.gaps).toEqual(['No title yet', 'No Challenge type yet', 'No summary yet', 'No duration yet', 'No Activities yet']);
  });
  it('shows required parts and the named variant so drafts differing only there never look identical', () => {
    const model = derivePreview(versionOf(null, contentOf({}, [activityConfig('act-1', { componentIds: ['LEFT', 'RIGHT'], activityVariant: 'incline' })])), {});
    expect(model.activities[0].settings).toEqual(['Variant: incline', 'Required parts: LEFT, RIGHT']);
  });
});
