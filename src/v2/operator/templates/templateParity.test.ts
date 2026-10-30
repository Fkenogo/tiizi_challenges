import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { CHALLENGE_COVER_IDS } from '../../challenges/challengeCovers';
import { GROUP_FOCUS_AREA_LABELS } from '../../groups/groupFocusAreas';
import { AUTHORING_LIMITS, PROHIBITED_COMPOSER_FIELDS } from './templateAuthoringModel';

/**
 * Client/server parity. The editor's early-feedback limits restate what the
 * server's strict normalizer enforces; this reads the server SOURCE so a limit
 * changed on one side fails here instead of drifting.
 */
const server = readFileSync(resolve(process.cwd(), 'api/src/challengeTemplates.ts'), 'utf8');
const list = (name: string) => [...(server.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))?.[1] ?? '').matchAll(/'([^']+)'/g)].map((m) => m[1]);

describe('Template editor limits match the server normalizer', () => {
  it('cover catalogue', () => expect(list('COVER_IDS')).toEqual([...CHALLENGE_COVER_IDS]));
  it('prohibited instance fields', () => expect(list('COMPOSER_FORBIDDEN')).toEqual([...PROHIBITED_COMPOSER_FIELDS]));
  it('duration maximum', () => expect(Number(server.match(/const MAX_DURATION_DAYS = (\d+)/)?.[1])).toBe(AUTHORING_LIMITS.durationDaysMax));
  it('summary length', () => expect(server).toContain(`record.summary.length > ${AUTHORING_LIMITS.summaryMax}`));
  it('focus tags', () => {
    expect(server).toContain(`record.focusTags.length > ${AUTHORING_LIMITS.focusTagsMax}`);
    expect(server).toContain('GROUP_FOCUS_AREAS.map((area) => area.label)');
    expect(GROUP_FOCUS_AREA_LABELS.length).toBeGreaterThan(0);
  });
  it('presets', () => expect(server).toContain(`presets.length > ${AUTHORING_LIMITS.presetsMax}`));
  it('sort order range', () => expect(server).toContain(`(record.sortOrder as number) < ${AUTHORING_LIMITS.sortOrderMin} || (record.sortOrder as number) > ${AUTHORING_LIMITS.sortOrderMax}`));
  it('duration minimum', () => expect(server).toContain(`(record.durationDays as number) < ${AUTHORING_LIMITS.durationDaysMin}`));
});
