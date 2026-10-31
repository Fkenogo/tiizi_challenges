import { createRequire } from 'node:module';
import { join } from 'node:path';

/**
 * Locate `playwright` without any machine-specific directory. Search order:
 * 1. PLAYWRIGHT_MODULE_DIR (a directory that has node_modules/playwright), 2. the script's directory, 3. the current directory.
 * Each is resolved with Node's normal upward node_modules lookup. Throws a message that says how to fix it.
 */
export function loadPlaywright({ env = process.env, scriptDir, cwd = process.cwd() }) {
  const roots = [env.PLAYWRIGHT_MODULE_DIR, scriptDir, cwd].filter(Boolean);
  const tried = [];
  for (const root of roots) {
    try {
      return createRequire(join(root, 'noop.js'))('playwright');
    } catch (error) {
      // Skip a location only when `playwright` itself is missing; a broken install (a missing dependency of it) is surfaced.
      if (error?.code !== 'MODULE_NOT_FOUND' || !/Cannot find module 'playwright'/.test(String(error.message))) throw error;
      tried.push(root);
    }
  }
  throw new Error(`playwright could not be resolved from: ${tried.join(', ')}. Install it (npm i playwright@1.64.1 && npx playwright install chromium) in one of them, or set PLAYWRIGHT_MODULE_DIR.`);
}

/** Process exit status for a finished matrix: any non-PASS scenario (or an empty matrix) fails the run. */
export function exitCodeFor(results) {
  return results.length > 0 && results.every((r) => r.result === 'PASS') ? 0 : 1;
}
