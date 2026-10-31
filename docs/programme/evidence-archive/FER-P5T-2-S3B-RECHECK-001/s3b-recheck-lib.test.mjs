// Focused verification of the two script corrections. No browser, database or network:  node --test s3b-recheck-lib.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { chmodSync, cpSync, mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { exitCodeFor, loadPlaywright } from './s3b-recheck-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const fakePlaywright = (root, marker) => {
  const dir = join(root, 'node_modules', 'playwright');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), '{"name":"playwright","version":"0.0.0","main":"index.js"}');
  writeFileSync(join(dir, 'index.js'), `module.exports = { marker: ${JSON.stringify(marker)}, chromium: { launch: async () => { throw new Error('fake launch'); } } };`);
};
const tmp = () => mkdtempSync(join(tmpdir(), 's3b-lib-'));

test('resolves Playwright from PLAYWRIGHT_MODULE_DIR, then the script directory, then the working directory', () => {
  const envDir = tmp(); const scriptDir = tmp(); const cwd = tmp();
  fakePlaywright(envDir, 'env'); fakePlaywright(scriptDir, 'script'); fakePlaywright(cwd, 'cwd');
  assert.equal(loadPlaywright({ env: { PLAYWRIGHT_MODULE_DIR: envDir }, scriptDir, cwd }).marker, 'env');
  assert.equal(loadPlaywright({ env: {}, scriptDir, cwd }).marker, 'script');
  assert.equal(loadPlaywright({ env: {}, scriptDir: tmp(), cwd }).marker, 'cwd');
});

test('never depends on a machine-specific temporary directory and explains how to fix a missing install', () => {
  assert.doesNotMatch(readFileSync(join(here, 's3b-recheck.mjs'), 'utf8') + readFileSync(join(here, 's3b-recheck-lib.mjs'), 'utf8'), /\/tmp\/s3b-pw/);
  assert.throws(() => loadPlaywright({ env: {}, scriptDir: tmp(), cwd: tmp() }), /npm i playwright.*PLAYWRIGHT_MODULE_DIR/s);
});

test('the real script loads Playwright from its own directory and fails later, at launch', () => {
  const dir = tmp();
  cpSync(join(here, 's3b-recheck.mjs'), join(dir, 's3b-recheck.mjs'));
  cpSync(join(here, 's3b-recheck-lib.mjs'), join(dir, 's3b-recheck-lib.mjs'));
  fakePlaywright(dir, 'script');
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', 'commit', '--allow-empty', '-qm', 'x'], { cwd: dir });
  const { PLAYWRIGHT_MODULE_DIR: _ignored, ...env } = process.env;
  const out = spawnSync('node', ['s3b-recheck.mjs'], { cwd: dir, encoding: 'utf8', env: { ...env, STUB_TOKEN_AUTHOR2: 'x', S3B_SOURCE_WORKTREE: dir } });
  assert.doesNotMatch(out.stderr, /could not be resolved/);
  assert.match(out.stderr, /fake launch/);
  // A crash outside any scenario still writes the evidence, records the failure, and exits nonzero.
  assert.equal(out.status, 1);
  assert.match(readFileSync(join(dir, 'evidence.json'), 'utf8'), /"overall": "FAIL"[\s\S]*run-error/);
});

test('with a valid disposable marker the run gets past the marker check and reaches the scenarios', () => {
  const dir = tmp();
  cpSync(join(here, 's3b-recheck.mjs'), join(dir, 's3b-recheck.mjs'));
  cpSync(join(here, 's3b-recheck-lib.mjs'), join(dir, 's3b-recheck-lib.mjs'));
  // A fake browser whose first context fails with a known message; a stub psql that reports a valid marker.
  const fake = join(dir, 'node_modules', 'playwright');
  mkdirSync(fake, { recursive: true });
  writeFileSync(join(fake, 'package.json'), '{"name":"playwright","version":"0.0.0","main":"index.js"}');
  writeFileSync(join(fake, 'index.js'), "module.exports = { chromium: { launch: async () => ({ newContext: async () => { throw new Error('ctx boom'); }, close: async () => {} }) } };");
  const bin = join(dir, 'bin'); mkdirSync(bin);
  writeFileSync(join(bin, 'psql'), '#!/bin/sh\necho tiizi-disposable-preview:stub\n'); chmodSync(join(bin, 'psql'), 0o755);
  execFileSync('git', ['init', '-q'], { cwd: dir });
  execFileSync('git', ['-c', 'user.email=t@example.test', '-c', 'user.name=t', 'commit', '--allow-empty', '-qm', 'x'], { cwd: dir });
  const out = spawnSync('node', ['s3b-recheck.mjs'], { cwd: dir, encoding: 'utf8', env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, STUB_TOKEN_AUTHOR2: 'x', S3B_SOURCE_WORKTREE: dir } });
  const evidence = readFileSync(join(dir, 'evidence.json'), 'utf8');
  assert.doesNotMatch(out.stderr + evidence, /is not defined/);
  assert.match(evidence, /ctx boom/);
  assert.match(readFileSync(join(dir, 'evidence.md'), 'utf8'), /marker: tiizi-disposable-preview:stub/);
  assert.equal(out.status, 1);
});

test('a playwright install with a missing dependency is reported as broken, not as "not found"', () => {
  const dir = tmp();
  fakePlaywright(dir, 'x');
  writeFileSync(join(dir, 'node_modules', 'playwright', 'index.js'), "require('playwright-core-missing');");
  assert.throws(() => loadPlaywright({ env: {}, scriptDir: dir, cwd: tmp() }), /playwright-core-missing/);
});

test('any failed scenario, or no scenarios at all, gives a nonzero exit status', () => {
  assert.equal(exitCodeFor([{ result: 'PASS' }, { result: 'PASS' }]), 0);
  assert.equal(exitCodeFor([{ result: 'PASS' }, { result: 'FAIL' }]), 1);
  assert.equal(exitCodeFor([{ result: 'FAIL' }]), 1);
  assert.equal(exitCodeFor([]), 1);
});

test('the script sets the exit status from the results only after the evidence files are written', () => {
  const source = readFileSync(join(here, 's3b-recheck.mjs'), 'utf8');
  const wroteMd = source.indexOf("writeFileSync(join(here, 'evidence.md')");
  const exit = source.indexOf('process.exitCode = exitCodeFor(results)');
  assert.ok(wroteMd > 0 && exit > wroteMd);
  assert.match(source, /run\(\)\.catch\(.*process\.exit\(1\)/);
});
