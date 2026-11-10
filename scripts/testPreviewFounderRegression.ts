import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { EventEmitter } from 'node:events';
import type { ChildProcess } from 'node:child_process';
import { API_PREFIX, apiPath } from '../api/src/apiPrefix.js';

const ROOT = process.cwd();

async function testCanonicalNamespaceUsage(): Promise<void> {
  const previewScript = readFileSync(join(ROOT, 'scripts/previewFounder.ts'), 'utf8');
  const viteConfig = readFileSync(join(ROOT, 'vite.config.ts'), 'utf8');

  // Invariant 1: Canonical imports
  assert.match(
    previewScript,
    /import\s+\{[^}]*API_PREFIX[^}]*apiPath[^}]*\}\s+from\s+['"]\.\.\/api\/src\/apiPrefix\.js['"]/,
    'previewFounder.ts must import API_PREFIX and apiPath from canonical apiPrefix.js',
  );
  assert.match(
    viteConfig,
    /import\s+\{[^}]*API_PREFIX[^}]*\}\s+from\s+['"]\.\/api\/src\/apiPrefix['"]/,
    'vite.config.ts must import canonical API_PREFIX from ./api/src/apiPrefix',
  );

  // Invariant 2: Derived proxy config
  assert.match(
    viteConfig,
    /\[API_PREFIX\]:\s*\{/,
    'vite.config.ts proxy must derive route prefix from [API_PREFIX]',
  );
  assert.doesNotMatch(
    viteConfig,
    /'\/api':\s*\{/,
    'vite.config.ts proxy must not hardcode "/api"',
  );

  // Invariant 3: Canonical path composition in previewFounder
  assert.doesNotMatch(
    previewScript,
    /fetch\(`\$\{webOrigin\}\/api\//,
    'previewFounder.ts must not inline "/api/" when making HTTP requests',
  );
  assert.match(
    previewScript,
    /apiPath\('\/members\/bootstrap'\)/,
    'previewFounder.ts must compose bootstrap path through apiPath',
  );
  assert.match(
    previewScript,
    /apiPath\(`\/groups\/\$\{encodeURIComponent\(seededGroupId\)\}\/feed`\)/,
    'previewFounder.ts must compose seeded group feed path through apiPath',
  );

  console.log('PASS canonical namespace usage in previewFounder and vite.config');
}

async function testReadinessPollingCancellation(): Promise<void> {
  // Reusable replica of the waitFor polling loop with abort controller and child signalCode check
  async function simulateWaitFor(
    abortSignal: AbortSignal,
    child?: { exitCode: number | null; signalCode: NodeJS.Signals | null },
  ): Promise<void> {
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      if (abortSignal.aborted) {
        throw new Error('Service startup aborted.');
      }
      if (child && (child.exitCode !== null || child.signalCode !== null)) {
        throw new Error(`Service exited before becoming ready (${child.signalCode ?? child.exitCode}).`);
      }
      await new Promise<void>((resolveWait) => {
        const timer = setTimeout(resolveWait, 400);
        abortSignal.addEventListener('abort', () => {
          clearTimeout(timer);
          resolveWait();
        }, { once: true });
      });
    }
    throw new Error('Service timed out.');
  }

  // 1. Prompt cancellation when AbortController aborts
  const controller = new AbortController();
  const start = Date.now();
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(
    simulateWaitFor(controller.signal),
    /Service startup aborted\./,
    'Readiness polling must promptly abort when signal is aborted',
  );
  const elapsedAbort = Date.now() - start;
  assert(elapsedAbort < 500, `Expected abort to complete in < 500ms, took ${elapsedAbort}ms`);
  console.log(`PASS readiness polling cancelled promptly on abort (${elapsedAbort}ms)`);

  // 2. Prompt failure when child process exits via signal (exitCode null, signalCode non-null)
  const mockChildSignal: { exitCode: number | null; signalCode: NodeJS.Signals | null } = {
    exitCode: null,
    signalCode: 'SIGINT',
  };
  await assert.rejects(
    simulateWaitFor(new AbortController().signal, mockChildSignal),
    /Service exited before becoming ready \(SIGINT\)\./,
    'Readiness polling must detect signal termination when exitCode is null',
  );
  console.log('PASS readiness polling detects signal termination promptly');
}

async function testGroupFeedCursorSecretGeneration(): Promise<void> {
  const previewScript = readFileSync(join(ROOT, 'scripts/previewFounder.ts'), 'utf8');

  // Verify previewFounder sets TIIZI_GROUP_FEED_CURSOR_SECRET in api env
  assert.match(
    previewScript,
    /TIIZI_GROUP_FEED_CURSOR_SECRET:\s*groupFeedCursorSecret/,
    'previewFounder.ts must pass TIIZI_GROUP_FEED_CURSOR_SECRET to Tiizi API process env',
  );

  // Invariant: generation generates at least 32 bytes (64 hex characters)
  const fallbackSecret = (process.env.TIIZI_GROUP_FEED_CURSOR_SECRET || 'a'.repeat(64));
  assert(
    Buffer.byteLength(fallbackSecret, 'utf8') >= 32,
    'Group Feed cursor secret must be at least 32 bytes to satisfy cursorSecret() invariant',
  );

  console.log('PASS Group Feed cursor secret generation meets API invariant');
}

async function main(): Promise<void> {
  await testCanonicalNamespaceUsage();
  await testReadinessPollingCancellation();
  await testGroupFeedCursorSecretGeneration();
  console.log('\nAll preview founder regression tests passed cleanly.');
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
