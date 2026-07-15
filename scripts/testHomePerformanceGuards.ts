import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// Phase 6B: rewritten to test actual unsafe behavior instead of banning legitimate
// service-layer imports. See docs/reports/pre-beta-phase-6b-final-guard-closure.md
// for the per-assertion classification (valid / stale / post-beta) that produced
// this version.

const homeHook = readFileSync('src/features/Home/useHomeScreen.ts', 'utf8');
const challengeService = readFileSync('src/services/challengeService.ts', 'utf8');

// ── Home data hook must not talk to Firestore directly ───────────────────────
// (VALID CURRENT REQUIREMENT — carried over unchanged from the original guard)

assert.equal(
  /from ['"]firebase\/firestore['"]/.test(homeHook),
  false,
  'Home data hook must not import Firestore query helpers directly',
);
assert.equal(
  /getDocs\s*\(/.test(homeHook),
  false,
  'Home data hook must not run collection reads directly',
);
assert.equal(
  /\bcollection\s*\(/.test(homeHook),
  false,
  'Home data hook must not run collection queries directly',
);
assert.equal(
  /documentId\s*\(/.test(homeHook),
  false,
  'Home data hook must not backfill missing challenge docs by a direct ID query',
);
assert.equal(
  /memberActivitySummaryService/.test(homeHook),
  false,
  'Home data hook must not read activity summaries as a live fallback',
);

// ── Home reads go through bounded, chunked service methods ───────────────────
// (VALID CURRENT REQUIREMENT — replaces the stale ban on groupService/
// userProfileService, which the accepted architecture explicitly allows)

assert.match(
  homeHook,
  /challengeService\.getChallengesByIds/,
  'Home must backfill missing challenges through challengeService.getChallengesByIds (bounded, chunked)',
);
assert.match(
  homeHook,
  /challengeService\.getCompetitiveLeaderboards/,
  'Home must read competitive leaderboards through challengeService.getCompetitiveLeaderboards (bounded, per-challenge)',
);
assert.match(
  homeHook,
  /challengeService\.getChallengeActivitySummaries/,
  'Home must read activity summaries through challengeService.getChallengeActivitySummaries (bounded, chunked)',
);

// groupService/userProfileService reads are allowed by the accepted architecture —
// no assertion forbids them. (STALE ARCHITECTURE EXPECTATION removed.)

// ── Challenge-ID queries stay within Firestore's safe `in` limit ─────────────
// (NEW — the original guard never actually checked chunk size)

const documentIdInQueries = [...challengeService.matchAll(/where\(documentId\(\),\s*['"]in['"],\s*(\w+)\)/g)];
assert.ok(
  documentIdInQueries.length > 0,
  'challengeService must contain at least one documentId() `in` query for chunked ID lookups',
);
for (const [, chunkVar] of documentIdInQueries) {
  assert.notEqual(
    chunkVar,
    'uniqueIds',
    'challengeService documentId() `in` query must run against a chunked slice, not the full unique-id array',
  );
}
assert.match(
  challengeService,
  /\+=\s*10\s*\)\s*{?\s*\n?\s*(chunks\.push|const chunk)/,
  'challengeService must chunk id arrays in groups of 10 (Firestore `in` query limit) before querying',
);

// ── No duplicate unbounded query was introduced ───────────────────────────────
// (NEW — guards against a future regression re-adding an unfiltered collection scan
// to any of the three Home-facing challengeService methods)

const homeFacingMethods = ['getChallengesByIds', 'getCompetitiveLeaderboards', 'getChallengeActivitySummaries'];
for (const methodName of homeFacingMethods) {
  const methodMatch = challengeService.match(
    new RegExp(`async ${methodName}\\([^)]*\\)[^{]*\\{([\\s\\S]*?)\\n  \\}`),
  );
  assert.ok(methodMatch, `challengeService.${methodName} must exist`);
  const body = methodMatch[1];
  assert.equal(
    /getDocs\(\s*collection\(/.test(body),
    false,
    `challengeService.${methodName} must not run an unbounded collection scan (missing a where()/query() filter)`,
  );
}

console.log('home performance guards passed');
