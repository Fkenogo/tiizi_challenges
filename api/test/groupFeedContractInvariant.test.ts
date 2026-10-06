import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { GROUP_FEED_EVENT_TYPES } from '../src/groupFeedPublication.js';
import { GROUP_FEED_PRESENTATION_TITLES } from '../src/groupFeedReads.js';

/**
 * GF-01 v1.1 automatic Group Feed family invariant.
 *
 * Product Truth: `docs/product-truth/TIIZI-GF-01-GROUP-FEED-EVENT-CONTRACT.md`
 * (GF-01 v1.1, approved/effective) — exactly four automatic Group Feed families,
 * and Challenge finalization is authoritative Challenge/domain truth but is NOT
 * Group Feed publishable. This file is *traceability and enforcement* of
 * already-approved Product Truth; it is not a second source of that truth, it
 * does not parse the document, and it introduces no runtime dependency on it.
 *
 * Together with the shared constant in `groupFeedPublication.ts` (which GF-03
 * consumes directly, so the two layers cannot drift) this guard exists so that
 * a future change adding a fifth automatic family, or adding it to only one
 * layer, produces a red CI result unless consciously updated.
 *
 * Every assertion here is an EXACT-equality assertion on purpose: "contains
 * these four" is explicitly not sufficient, because a fifth family would pass
 * it. Runs in the normal `api` CI job via `npm test`, because
 * `api/vitest.config.ts` collects every test file under `api/test`.
 */
const SOURCE_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'src');

/**
 * The approved GF-01 v1.1 families, written out literally and independently of
 * the implementation so the assertion is a real check rather than a tautology.
 */
const APPROVED_AUTOMATIC_FAMILIES = [
  'challenge_established',
  'challenge_started',
  'together_goal_achieved',
  'challenge_ended',
] as const;

function typescriptSources(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return typescriptSources(path);
    return path.endsWith('.ts') ? [path] : [];
  });
}

describe('GF-01 v1.1 Group Feed automatic-family invariant', () => {
  it('A/B — the canonical automatic tuple is exactly the four approved families', () => {
    // Ordered, exact equality: an added fifth family, a removed family or a
    // renamed family all fail here.
    expect([...GROUP_FEED_EVENT_TYPES]).toEqual([...APPROVED_AUTOMATIC_FAMILIES]);
    expect(GROUP_FEED_EVENT_TYPES).toHaveLength(APPROVED_AUTOMATIC_FAMILIES.length);
  });

  it('C — challenge_finalized is not an automatic Group Feed family', () => {
    expect(GROUP_FEED_EVENT_TYPES as readonly string[]).not.toContain('challenge_finalized');
  });

  it('D — publication families and member-visible read families cannot diverge', () => {
    const published = [...GROUP_FEED_EVENT_TYPES].sort();
    const memberVisible = Object.keys(GROUP_FEED_PRESENTATION_TITLES).sort();
    // Exact set equality in both directions: nothing publication-only, nothing
    // read-only.
    expect(memberVisible).toEqual(published);
  });

  it('E — every canonical family has exactly one fixed member presentation title', () => {
    expect(Object.keys(GROUP_FEED_PRESENTATION_TITLES)).toHaveLength(APPROVED_AUTOMATIC_FAMILIES.length);
    for (const family of APPROVED_AUTOMATIC_FAMILIES) {
      const title = (GROUP_FEED_PRESENTATION_TITLES as Record<string, string>)[family];
      expect(typeof title, `missing presentation title for ${family}`).toBe('string');
      expect(title.trim().length).toBeGreaterThan(0);
    }
    // Titles are not aliased across families, so each family has its own title.
    const titles = Object.values(GROUP_FEED_PRESENTATION_TITLES);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('F — no member-visible event or title exists outside the canonical set', () => {
    const approved = APPROVED_AUTOMATIC_FAMILIES as readonly string[];
    const extra = Object.keys(GROUP_FEED_PRESENTATION_TITLES).filter((family) => !approved.includes(family));
    expect(extra).toEqual([]);
  });

  it('G — no API source publishes a non-canonical family, and finalization publishes no finalized event', () => {
    // Challenge finalization must not emit a Group Feed publication for
    // `challenge_finalized` (finalization truth itself is unaffected).
    const finalization = readFileSync(join(SOURCE_DIR, 'challengeFinalization.ts'), 'utf8');
    expect(finalization).not.toContain('challenge_finalized');

    // Every literal family handed to the publication authority anywhere in the
    // API source must be canonical.
    const callSite = /recordChallengePublication\([\s\S]{0,400}?eventType:\s*'([a-z_]+)'/g;
    const published: Array<{ file: string; family: string }> = [];
    for (const file of typescriptSources(SOURCE_DIR)) {
      for (const match of readFileSync(file, 'utf8').matchAll(callSite)) {
        published.push({ file: file.slice(SOURCE_DIR.length + 1), family: match[1]! });
      }
    }
    // Guards the guard: the scanner must actually find the real call sites.
    expect(published.length).toBeGreaterThan(0);

    const canonical = GROUP_FEED_EVENT_TYPES as readonly string[];
    for (const { file, family } of published) {
      expect(canonical.includes(family), `${file} publishes non-canonical Group Feed family "${family}"`).toBe(true);
    }
  });
});
