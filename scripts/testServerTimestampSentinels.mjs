/**
 * Regression guard: verifies that serverTimestamp() FieldValue sentinels survive
 * the payload-construction pattern used in activityLogSessionService.
 *
 * Firebase 11 — serverTimestamp() returns ServerTimestampFieldValueImpl with one
 * enumerable own property (_methodName). Passing it through removeUndefinedDeep()
 * via Object.entries / Object.fromEntries strips the prototype, producing a plain
 * object that Firestore writes as a map instead of a server timestamp. Firestore
 * Security Rules then reject the write because `createdAt == request.time` is false.
 *
 * The fix: build basePayload with removeUndefinedDeep(), then spread the timestamp
 * fields on top — matching the pattern already used in workoutService.ts.
 */

import { FieldValue, serverTimestamp } from 'firebase/firestore';

let passed = 0;
let failed = 0;

function check(label, condition) {
  if (condition) {
    console.log(`  PASS  ${label}`);
    passed++;
  } else {
    console.error(`  FAIL  ${label}`);
    failed++;
  }
}

function removeUndefinedDeep(value) {
  if (Array.isArray(value)) return value.map(removeUndefinedDeep);
  if (value && typeof value === 'object') {
    const cleaned = Object.entries(value)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, removeUndefinedDeep(item)]);
    return Object.fromEntries(cleaned);
  }
  return value;
}

console.log('\n--- serverTimestamp sentinel preservation ---\n');

// Demonstrate that the OLD pattern destroys sentinels (baseline: test is meaningful)
const brokenBase = removeUndefinedDeep({
  userId: 'u',
  date: '2026-01-01',
  completedAt: serverTimestamp(),
  createdAt: serverTimestamp(),
  loggedAt: serverTimestamp(),
});
check('old pattern destroys completedAt (confirms test detects the bug)', !(brokenBase.completedAt instanceof FieldValue));
check('old pattern destroys createdAt',  !(brokenBase.createdAt instanceof FieldValue));
check('old pattern destroys loggedAt',   !(brokenBase.loggedAt instanceof FieldValue));

console.log('');

// Fixed workout-payload pattern (serverTimestamp spread on top after removeUndefinedDeep)
const workoutBase = removeUndefinedDeep({
  userId: 'u',
  challengeId: 'c',
  groupId: 'g',
  activityId: 'squats',
  exerciseId: 'squats',
  exerciseName: 'Squats',
  value: 50,
  unit: 'reps',
  date: '2026-06-10',
});
const workoutPayload = {
  ...workoutBase,
  completedAt: serverTimestamp(),
  createdAt: serverTimestamp(),
  loggedAt: serverTimestamp(),
};
check('workout fixed: completedAt instanceof FieldValue', workoutPayload.completedAt instanceof FieldValue);
check('workout fixed: createdAt instanceof FieldValue',   workoutPayload.createdAt instanceof FieldValue);
check('workout fixed: loggedAt instanceof FieldValue',    workoutPayload.loggedAt instanceof FieldValue);

console.log('');

// Fixed wellness-payload pattern
const wellnessBase = removeUndefinedDeep({
  userId: 'u',
  challengeId: 'c',
  groupId: 'g',
  activityId: 'hydration',
  logType: 'hydration',
  value: 500,
  unit: 'milliliters',
  points: 10,
  date: '2026-06-10',
  metadata: { activityName: 'Hydration', activityType: 'hydration' },
});
const wellnessPayload = {
  ...wellnessBase,
  createdAt: serverTimestamp(),
  loggedAt: serverTimestamp(),
};
check('wellness fixed: createdAt instanceof FieldValue', wellnessPayload.createdAt instanceof FieldValue);
check('wellness fixed: loggedAt instanceof FieldValue',  wellnessPayload.loggedAt instanceof FieldValue);

console.log(`\n${passed + failed} checks: ${passed} passed, ${failed} failed\n`);
if (failed > 0) process.exit(1);
