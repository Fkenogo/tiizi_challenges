import assert from 'node:assert/strict';
import {
  allowsFirestoreFallback,
  isKnowledgeApiActive,
  resolveKnowledgeAuthorityMode,
} from '../src/api/knowledgeAuthorityMode.js';

/**
 * Phase B frontend authority-mode contract
 * (run: npm run test:knowledge-authority-mode).
 *
 * - firestore: legacy Firestore paths, API inactive, no API involved;
 * - transition: API primary, controlled Firestore fallback allowed (by-ID);
 * - postgres: API/PG only — API errors surface, Firestore never substitutes;
 * - explicit VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE wins; otherwise the legacy
 *   VITE_TIIZI_KNOWLEDGE_API_ENABLED flag maps to transition/firestore;
 * - invalid mode values throw instead of silently running the wrong authority.
 */

async function run() {
  // Explicit mode wins over the legacy flag in both directions.
  assert.equal(
    resolveKnowledgeAuthorityMode({ VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE: 'postgres' }, false),
    'postgres',
  );
  assert.equal(
    resolveKnowledgeAuthorityMode({ VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE: 'firestore' }, true),
    'firestore',
  );
  assert.equal(
    resolveKnowledgeAuthorityMode({ VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE: 'Transition' }, false),
    'transition',
  );

  // Legacy flag fallback when the mode env is unset/blank.
  assert.equal(resolveKnowledgeAuthorityMode({}, true), 'transition');
  assert.equal(resolveKnowledgeAuthorityMode({}, false), 'firestore');
  assert.equal(
    resolveKnowledgeAuthorityMode({ VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE: '  ' }, true),
    'transition',
  );

  // Invalid mode values fail loud.
  assert.throws(
    () => resolveKnowledgeAuthorityMode({ VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE: 'bogus' }, true),
    /Invalid VITE_TIIZI_KNOWLEDGE_AUTHORITY_MODE/,
  );

  // Active matrix.
  assert.equal(isKnowledgeApiActive('firestore'), false);
  assert.equal(isKnowledgeApiActive('transition'), true);
  assert.equal(isKnowledgeApiActive('postgres'), true);

  // Fallback matrix: only transition may consult Firestore once the API
  // path is active. Postgres mode surfaces API errors (404/5xx/network,
  // retired/missing) instead of substituting stale Firestore records.
  assert.equal(allowsFirestoreFallback('firestore'), false);
  assert.equal(allowsFirestoreFallback('transition'), true);
  assert.equal(allowsFirestoreFallback('postgres'), false);

  console.log('knowledge authority mode (frontend contract): 7 assertions passed');
}

await run();
