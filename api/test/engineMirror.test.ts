import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The API replays through vendored copies of the frontend engines
 * (api/src/engine/*) because the Docker build context is api/-only.
 * These copies MUST stay logic-identical to src/services/challengeEngine/*,
 * src/services/scoringConfig.ts, src/services/challengeCompletion.ts, and
 * src/features/Challenges/challengeProgressResolver.ts: the replay uses the
 * existing engines, it never rewrites them. The single permitted difference
 * is ESM `.js` import extensions, which api node16 module resolution
 * requires (the frontend bundler resolves extensionless paths).
 */
const MIRRORED: Array<[string, string]> = [
  ['../src/engine/types.ts', '../../src/services/challengeEngine/types.ts'],
  ['../src/engine/collectiveEngine.ts', '../../src/services/challengeEngine/collectiveEngine.ts'],
  ['../src/engine/competitiveEngine.ts', '../../src/services/challengeEngine/competitiveEngine.ts'],
  ['../src/engine/streakEngine.ts', '../../src/services/challengeEngine/streakEngine.ts'],
  ['../src/engine/index.ts', '../../src/services/challengeEngine/index.ts'],
  ['../src/engine/scoringConfig.ts', '../../src/services/scoringConfig.ts'],
  ['../src/engine/challengeCompletion.ts', '../../src/services/challengeCompletion.ts'],
  [
    '../src/engine/challengeProgressResolver.ts',
    '../../src/features/Challenges/challengeProgressResolver.ts',
  ],
];

// NOTE: the ONLY permitted shape feeding the Challenge Engine in production
// is the accepted Challenge Activity Record (see activityEvents.ts C2
// boundary + challengeActivityApplication.ts). Raw Member Activity Evidence
// never reaches an engine directly, so the domain surface under the
// no-Firebase check is the Evidence seam, the C2A Challenge foundation, and
// the C2B application/derived-truth seam. The Firestore authority adapter
// (firestoreGroupAuthority.ts) is the single documented boundary exception
// and is intentionally absent from this list.
const DOMAIN_MODULES = [
  '../src/activityEvents.ts',
  '../src/challenges.ts',
  '../src/challengeConfigs.ts',
  '../src/challengeParticipations.ts',
  '../src/groupMembershipAuthority.ts',
  '../src/challengeActivityApplication.ts',
  '../src/challengeFinalization.ts',
  '../src/derivedTruth.ts',
  '../src/knowledgePins.ts',
  '../src/challengeActivityRoutes.ts',
  // EBC-01 governed seams: establishment + creation authority + measurement
  // eligibility/vocabulary + group mutation boundary and their routes. The
  // Firestore adapters (firestoreGroupAuthority.ts,
  // firestoreChallengeCreationAuthority.ts, firestoreGroupMutationStore.ts)
  // are the documented boundary exceptions and stay absent from this list.
  '../src/challengeEstablishment.ts',
  '../src/challengeCreationAuthority.ts',
  '../src/challengeCreationRoutes.ts',
  '../src/knowledgeEligibility.ts',
  '../src/measurementVocabulary.ts',
  '../src/groupMutations.ts',
  '../src/groupMutationRoutes.ts',
  '../src/engine/index.ts',
  '../src/engine/types.ts',
  '../src/engine/collectiveEngine.ts',
  '../src/engine/competitiveEngine.ts',
  '../src/engine/streakEngine.ts',
  '../src/engine/scoringConfig.ts',
  '../src/engine/challengeCompletion.ts',
  '../src/engine/challengeProgressResolver.ts',
];

/** Normalize the one permitted difference: ESM `.js` import extensions. */
function normalizeExtensions(content: string): string {
  return content.replace(/from '(\.[^']+?)(\.js)?'/g, "from '$1'");
}

describe('engine mirror (replay uses the existing engines)', () => {
  for (const [vendored, original] of MIRRORED) {
    it(`${vendored} matches ${original} modulo ESM extensions`, () => {
      const vendoredPath = fileURLToPath(new URL(vendored, import.meta.url));
      const originalPath = fileURLToPath(new URL(original, import.meta.url));
      expect(existsSync(originalPath), original).toBe(true);
      expect(normalizeExtensions(readFileSync(vendoredPath, 'utf8'))).toBe(
        normalizeExtensions(readFileSync(originalPath, 'utf8')),
      );
    });
  }

  it('vendored engines import nothing outside the engine folder', () => {
    for (const [vendored] of MIRRORED) {
      const path = fileURLToPath(new URL(vendored, import.meta.url));
      const content = readFileSync(path, 'utf8');
      const imports = [...content.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
      for (const spec of imports) {
        expect(spec.startsWith('./'), `${vendored} imports ${spec}`).toBe(true);
      }
    }
  });
});

describe('no Firebase in the engine/replay domain layer', () => {
  for (const module of DOMAIN_MODULES) {
    it(`${module} never imports Firebase`, () => {
      const path = fileURLToPath(new URL(module, import.meta.url));
      const content = readFileSync(path, 'utf8');
      // Strip comments so doc mentions of Firebase do not trip the check;
      // only real module specifiers count.
      const code = content
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/(^|\s)\/\/.*$/gm, '$1');
      expect(code).not.toMatch(/from\s+['"]firebase[^'"]*['"]/);
      expect(code).not.toMatch(/require\(['"]firebase[^'"]*['"]\)/);
      expect(code).not.toMatch(/from\s+['"]firebase-admin['"]/);
    });
  }
});
