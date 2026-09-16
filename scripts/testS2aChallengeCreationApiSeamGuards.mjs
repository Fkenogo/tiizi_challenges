import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

/**
 * S2a — Challenge creation API seam (transport only) boundary guard.
 *
 * Proves the S2a slice added ONLY an additive, read-only transport seam:
 * - the seam delegates to the merged PF-04 Composer and the single PF-03
 *   validator (no second validator, no duplicated semantics);
 * - no V1 experience module, V1 route, or PF-05 UI is imported anywhere in
 *   the slice;
 * - registration is additive (existing routes remain registered);
 * - the Firestore emulator is declared for local Founder preview without any
 *   production Firebase configuration.
 */

const root = new URL('../', import.meta.url);
const rootPath = fileURLToPath(root);
const read = (path) => readFileSync(new URL(path, root), 'utf8');
const exists = (path) => existsSync(new URL(path, root));

let failures = 0;
const check = (name, condition, detail) => {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}`);
    if (detail) console.error(detail);
  }
};

console.log('S2a challenge creation API seam guards');

const seamPath = 'api/src/challengeCreationSeamRoutes.ts';
const seam = exists(seamPath) ? read(seamPath) : '';
check('seam module exists', exists(seamPath));

// Delegates to existing authorities — never a second validator.
check(
  'seam delegates to PF-04 Composer options authority',
  /describeComposerActivityOptions/.test(seam) && /challengeComposer\.js/.test(seam),
);
check(
  'seam delegates to PF-04 preview authority',
  /previewChallengeComposer/.test(seam) && /challengeComposer\.js/.test(seam),
);
const seamImports = [...seam.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
check(
  'seam does not import the PF-03 validator directly (single authority)',
  !seamImports.some((source) => source.includes('challengeDefinition')),
);
check(
  'seam is documented transport-only and write-free',
  /transport only/i.test(seam) && /(writes nothing|read-only|Persists nothing)/i.test(seam),
);

// Registered additively in the API composition root.
const appSource = read('api/src/app.ts');
check('seam registered in app.ts', /registerChallengeCreationSeamRoutes/.test(appSource));
check(
  'existing route registrations preserved (additive)',
  [
    'registerMembershipRoutes',
    'registerGroupIdentityRoutes',
    'registerKnowledgeRoutes',
    'registerChallengeActivityRoutes',
    'registerChallengeReadRoutes',
    'registerParticipationRoutes',
    'registerGroupMutationRoutes',
    'registerChallengeCreationRoutes',
  ].every((name) => appSource.includes(name)),
);

// No V1 experience / V1 route / PF-05 UI enter the slice.
const sliceFiles = [
  seamPath,
  'api/src/knowledge.ts',
  'api/src/app.ts',
  'api/test/s2aChallengeCreationApiSeam.test.ts',
];
const forbidden = [
  'V2CreateChallengeWizard',
  'V2ChallengesScreen',
  'V2ChallengeDetailScreen',
  'BottomNav',
  'CreateChallengeWizard',
  'src/features/',
  '"/app/',
  "'/app/",
];
const violations = sliceFiles.flatMap((path) => {
  if (!exists(path)) return [`${path}::missing`];
  const source = read(path);
  return forbidden.filter((token) => source.includes(token)).map((token) => `${path}::${token}`);
});
check(
  'no V1 experience imports, V1 /app routes or PF-05 UI in the slice',
  violations.length === 0,
  violations.length > 0 ? `    violations:\n${violations.map((v) => `    - ${v}`).join('\n')}` : undefined,
);

// composerSelectable remains opt-in.
const knowledge = read('api/src/knowledge.ts');
check(
  'composerSelectable is opt-in (plain listing unchanged)',
  /composerSelectable !== true\) return items/.test(knowledge)
    && /composerSelectable === 'true'/.test(knowledge),
);

// Firestore emulator for local preview; no production Firebase config.
const firebase = JSON.parse(read('firebase.json'));
check(
  'Firestore emulator declared at 127.0.0.1:8080',
  firebase.emulators?.firestore?.host === '127.0.0.1' && firebase.emulators?.firestore?.port === 8080,
);
check(
  'no production Firebase project/config added',
  !Object.prototype.hasOwnProperty.call(firebase, 'projects')
    && !Object.prototype.hasOwnProperty.call(firebase, 'projectId'),
);

if (failures > 0) {
  console.error(`\nS2a challenge creation API seam guards: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nS2a challenge creation API seam guards: all passing.');
}
