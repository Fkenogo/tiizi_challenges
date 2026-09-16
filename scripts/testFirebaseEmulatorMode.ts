/**
 * TIIZI S1 CORR-002 — Firebase Auth emulator-mode safety guard
 * (run: npm run test:firebase-emulator-mode).
 *
 * Proves:
 * A. explicit development emulator mode CAN route Auth to 127.0.0.1:9099;
 * B. localhost serving alone NEVER enables emulator mode;
 * C. production (DEV !== true) NEVER activates emulator wiring,
 *    whatever the flag value;
 * D. default production configuration is unchanged (no emulator
 *    references in app init; helper never touches credential config).
 *
 * No secrets are printed: only booleans and static source patterns.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  AUTH_EMULATOR_URL,
  resolveAuthEmulatorMode,
} from '../src/lib/firebaseEmulators.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string): string => readFileSync(join(root, rel), 'utf8');

let failures = 0;
function check(name: string, condition: boolean, detail = ''): void {
  if (condition) {
    console.log(`  ok: ${name}`);
  } else {
    failures += 1;
    console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

console.log('A. explicit development opt-in connects');
check('DEV + flag=true enables mode', resolveAuthEmulatorMode({ DEV: true, VITE_USE_FIREBASE_EMULATORS: 'true' }) === true);
check('flag is case/whitespace tolerant', resolveAuthEmulatorMode({ DEV: true, VITE_USE_FIREBASE_EMULATORS: ' True ' }) === true);
check('emulator endpoint is the local Auth emulator', AUTH_EMULATOR_URL === 'http://127.0.0.1:9099');

console.log('B. localhost alone never enables mode');
check('DEV without flag stays off', resolveAuthEmulatorMode({ DEV: true }) === false);
check('DEV + flag=false stays off', resolveAuthEmulatorMode({ DEV: true, VITE_USE_FIREBASE_EMULATORS: 'false' }) === false);
check('DEV + empty flag stays off', resolveAuthEmulatorMode({ DEV: true, VITE_USE_FIREBASE_EMULATORS: '' }) === false);
check(
  'hostname extras are ignored (localhost serving changes nothing)',
  resolveAuthEmulatorMode({ DEV: true, HOSTNAME: 'localhost', location: 'http://localhost:5173', host: '127.0.0.1:5173' }) === false,
);
check(
  'localhost extras cannot upgrade a disabled flag',
  resolveAuthEmulatorMode({ DEV: true, VITE_USE_FIREBASE_EMULATORS: 'false', HOSTNAME: 'localhost' }) === false,
);

console.log('C. production never activates emulator wiring');
for (const flag of ['true', ' True ', 'TRUE', '1', 'yes', 'on']) {
  check(`DEV=false + flag=${JSON.stringify(flag)} stays off`, resolveAuthEmulatorMode({ DEV: false, VITE_USE_FIREBASE_EMULATORS: flag }) === false);
}
check('DEV unset + flag=true stays off', resolveAuthEmulatorMode({ VITE_USE_FIREBASE_EMULATORS: 'true' }) === false);
check('empty env stays off', resolveAuthEmulatorMode({}) === false);
for (const loose of ['1', 'yes', 'on', 'enabled']) {
  check(`DEV + loose flag ${JSON.stringify(loose)} stays off (narrow opt-in)`, resolveAuthEmulatorMode({ DEV: true, VITE_USE_FIREBASE_EMULATORS: loose }) === false);
}

console.log('D. default production configuration unchanged');
const helper = read('src/lib/firebaseEmulators.ts');
const authModule = read('src/lib/firebaseAuth.ts');
const appModule = read('src/lib/firebaseApp.ts');
check('Auth module wires the helper once', (authModule.match(/connectAuthEmulatorOnce\(auth\)/g) ?? []).length === 1);
check('app init has no emulator references', !/emulator/i.test(appModule));
check('helper never touches credential config', !/VITE_FIREBASE_/.test(helper));
check('helper changes no providers/projects', !/projectId|provider|signInWith|createUser/i.test(helper));
check('HMR-safe: connected marker survives module reload', helper.includes('globalThis'));
check(
  'SDK connect call exists exactly once',
  (helper.match(/connectAuthEmulator\(auth,/g) ?? []).length === 1,
);

if (failures > 0) {
  console.error(`\nFirebase emulator-mode guard: ${failures} failure(s).`);
  process.exit(1);
}
console.log('\nFirebase emulator-mode guard: all passing.');
