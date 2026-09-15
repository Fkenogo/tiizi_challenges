import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
let failures = 0;

function check(name, condition) {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}`);
  }
}

console.log('PF-05 local preview harness guards');

const firebase = JSON.parse(read('firebase.json'));
const packageJson = JSON.parse(read('package.json'));
check('Firebase Auth emulator uses 9099', firebase.emulators?.auth?.port === 9099);
check('Firestore emulator uses 8080', firebase.emulators?.firestore?.port === 8080);
check('Emulator UI uses 4401, not API port 4000', firebase.emulators?.ui?.port === 4401
  && firebase.emulators?.ui?.port !== 4000);
check('emulator command selects the isolated demo project', packageJson.scripts?.['preview:emulators']
  === 'firebase emulators:start --only auth,firestore --project demo-tiizi-pf05-preview');

const app = read('src/lib/firebaseApp.ts');
check('frontend emulator use requires explicit local flag', app.includes('VITE_FIREBASE_USE_EMULATORS')
  && app.includes('import.meta.env.DEV'));
check('frontend delegates only to loopback emulator wiring', app.includes('configureFirebaseEmulators'));

const authSeed = read('api/src/previewAuthSeedCli.ts');
check('Auth seed has a strict loopback emulator guard', authSeed.includes("parsed.port !== '9099'")
  && authSeed.includes('non-localhost Auth emulator target'));
check('Auth seed does not embed a preview password', !authSeed.includes('preview-password-from-environment')
  && authSeed.includes('TIIZI_PREVIEW_PASSWORD'));

const memberSeed = read('api/src/previewMemberSeedCli.ts');
check('member seed defaults to dry run and requires apply', memberSeed.includes("includes('--apply')")
  && memberSeed.includes('dry run'));
check('member seed refuses non-local PostgreSQL', memberSeed.includes('non-localhost PostgreSQL target'));

const groupAdapter = read('src/api/previewGroupApi.ts');
check('preview Group creation uses governed API instead of direct Firestore', groupAdapter.includes("apiFetch<GovernedGroupResponse>('/v1/groups'")
  && !/addDoc|setDoc|updateDoc|deleteDoc|writeBatch/.test(groupAdapter));

const changedSource = [app, authSeed, memberSeed, groupAdapter, read('src/services/groupService.ts')].join('\n');
check('no EBC-05 UI code is imported into the harness', !/ebc-05|EBC-05|V2EstablishScreen|V2ChallengeDetailScreen/.test(changedSource));

const previewEnv = read('.env.preview.example');
const apiPreviewEnv = read('api/.env.preview.example');
check('preview examples use the isolated demo Firebase project', previewEnv.includes('VITE_FIREBASE_PROJECT_ID=demo-tiizi-pf05-preview')
  && apiPreviewEnv.includes('FIREBASE_PROJECT_ID=demo-tiizi-pf05-preview')
  && !/GOOGLE_APPLICATION_CREDENTIALS|firebase-adminsdk|AIza/.test(`${previewEnv}\n${apiPreviewEnv}`));

if (failures > 0) {
  console.error(`\nPF-05 local preview harness guards: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nPF-05 local preview harness guards: all passing.');
}
