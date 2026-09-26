import assert from 'node:assert/strict';
import { findGroupFirestoreModules } from './v2FirestoreDependencyGraph.mjs';

const modules = new Map([
  ['src/v2/routes.tsx', `import { Screen } from './Screen'; import { useAuth } from './auth';`],
  ['src/v2/Screen.tsx', `import { useGroups } from '../hooks/useGroups';`],
  ['src/hooks/useGroups.ts', `import { groupService } from '@/services/groupService';`],
  ['src/services/groupService.ts', `import { collection, getDocs } from 'firebase/firestore'; const ref = collection(db, 'groups');`],
  ['src/v2/auth.ts', `import { onAuthStateChanged } from 'firebase/auth';`],
  ['src/legacy/unreachable.ts', `import { getFirestore, collection } from 'firebase/firestore'; const ref = collection(db, 'groups');`],
  ['src/services/unrelatedFirestore.ts', `import { collection, getDocs } from 'firebase/firestore'; const ref = collection(db, 'wellnessActivities');`],
]);

assert.deepEqual(
  findGroupFirestoreModules(modules, 'src/v2/routes.tsx'),
  ['src/services/groupService.ts'],
  'the route closure catches transitive Group collection access but ignores Auth, unrelated Firestore, and unreachable legacy code',
);

const apiOnly = new Map([
  ['src/v2/routes.tsx', `import { Screen } from './Screen';`],
  ['src/v2/Screen.tsx', `import { fetchGroups } from '../api/groupsApi';`],
  ['src/api/groupsApi.ts', `import { apiFetch } from './apiClient';`],
  ['src/api/apiClient.ts', `import { auth } from 'firebase/auth';`],
]);

assert.deepEqual(findGroupFirestoreModules(apiOnly, 'src/v2/routes.tsx'), []);
console.log('V2 Firestore dependency graph regression: passed');
