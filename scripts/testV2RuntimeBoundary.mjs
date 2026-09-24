import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { routeProductGeneration } from '../src/runtime/routeProductGeneration.js';

let failures = 0;
function check(name, condition) {
  if (condition) console.log(`  ok: ${name}`);
  else {
    failures += 1;
    console.error(`  FAIL: ${name}`);
  }
}

const app = readFileSync('src/App.tsx', 'utf8');
const authContext = readFileSync('src/context/AuthContext.tsx', 'utf8');
const bootstrap = readFileSync('src/services/legacyUserDocumentBootstrap.ts', 'utf8');

check('V2 paths resolve to V2 generation', routeProductGeneration('/v2/today') === 'v2');
check('V1 app paths resolve to V1 generation', routeProductGeneration('/app/groups') === 'v1');
check('non-product paths do not run either authenticated product runtime', routeProductGeneration('/privacy') === 'public');
check('V2 root boundary is exact', routeProductGeneration('/v20/today') === 'public');

const warmupStart = app.indexOf('function RouteWarmup()');
const warmupEnd = app.indexOf('\nfunction App()', warmupStart);
const warmup = app.slice(warmupStart, warmupEnd);
const v1Gate = warmup.indexOf("routeProductGeneration(location.pathname) !== 'v1'");
check('legacy RouteWarmup is gated to the explicit V1 route family', v1Gate >= 0);
check('V1 gate precedes all legacy warmup calls', v1Gate >= 0 && [
  'dailyGoalsService.getTodayGoals',
  'groupService.getMyGroups',
  'challengeService.getUserAccessibleChallenges',
].every((call) => warmup.indexOf(call) > v1Gate));
check('V1 still retains all three existing data warmups', [
  'dailyGoalsService.getTodayGoals',
  'groupService.getMyGroups',
  'challengeService.getUserAccessibleChallenges',
].every((call) => warmup.includes(call)));
check('legacy user bootstrap is also invoked only after the V1 gate',
  v1Gate >= 0 && warmup.indexOf('bootstrapLegacyUserDocument(user') > v1Gate);
check('AuthContext remains Firestore-free and preserves Firebase Auth flows',
  !authContext.includes('firebase/firestore')
  && !authContext.includes('ensureUserDocument')
  && authContext.includes('onAuthStateChanged')
  && authContext.includes('signInWithEmailAndPassword')
  && authContext.includes('createUserWithEmailAndPassword')
  && authContext.includes('signOut(auth)'));
check('the separate legacy bootstrap still writes the V1 user document',
  bootstrap.includes("doc(db, 'users', firebaseUser.uid)")
  && bootstrap.includes('setDoc('));

function sourceFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const path = join(directory, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.(ts|tsx)$/.test(path) ? [path] : [];
  });
}
const v2Files = sourceFiles('src/v2');
check('V2 source tree contains no direct Firestore imports or emulator binding',
  v2Files.every((path) => !/firebase\/firestore|connectFirestoreEmulator|\bgetFirestore\b/.test(readFileSync(path, 'utf8'))));

const groupHooks = readFileSync('src/v2/groups/useV2Groups.ts', 'utf8');
const challengeHooks = readFileSync('src/v2/challenges/useChallengeCreation.ts', 'utf8');
check('S4a Groups remain bound to the existing Tiizi API seams',
  groupHooks.includes('fetchMyMemberships')
  && groupHooks.includes('fetchGroupDetail')
  && groupHooks.includes('listGroupChallengesV2')
  && !groupHooks.includes('firebase/firestore'));
check('V2 Challenges remain bound to the Tiizi API client',
  challengeHooks.includes('listChallengesV2')
  && challengeHooks.includes('getChallengeV2')
  && !challengeHooks.includes('firebase/firestore'));

if (failures > 0) {
  console.error(`\nV2 runtime boundary: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nV2 runtime boundary: all passing.');
}
