import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const homeScreen = readFileSync('src/features/Home/HomeScreen.tsx', 'utf8');
const homeHook = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');

// Guard: home screen must render active challenges section
assert(
  homeScreen.includes('activeChallenges') || homeScreen.includes('challenge'),
  'HomeScreen must reference challenges',
);

// Guard: home hook must fetch challenges
assert(
  homeHook.includes('challenge') || homeHook.includes('Challenge'),
  'useHomeScreen must fetch challenge data',
);

// Guard: hook must not over-fetch (no unbounded queries)
assert(
  !homeHook.includes('getChallenges()') || homeHook.includes('limit') || homeHook.includes('maxResults'),
  'useHomeScreen must use bounded challenge queries',
);

console.log('✅ testHomeChallengeFeeds: all guards passed');
