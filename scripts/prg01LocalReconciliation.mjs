#!/usr/bin/env node
/**
 * Tiizi PRG-01 read-only local state collector.
 * Does not fetch, checkout, reset, run app code, or contact any hosted service.
 * Report is evidence for a human/agent, not an approval or a PASS gate.
 */
import { spawnSync } from 'node:child_process';

function git(...args) {
  const result = spawnSync('git', args, { encoding: 'utf8', maxBuffer: 2_000_000 });
  return result.status === 0
    ? { ok: true, value: result.stdout.trim() }
    : { ok: false, value: 'UNKNOWN', reason: (result.stderr || result.error?.message || 'git failed').trim() };
}
function value(result) { return result.ok ? result.value : 'UNKNOWN'; }
const inside = git('rev-parse', '--is-inside-work-tree');
if (!inside.ok || value(inside) !== 'true') {
  process.stderr.write('PRG-01 STOP: run from a Tiizi Git worktree. No files were changed.\n');
  process.exitCode = 2;
} else {
  const head = git('rev-parse', 'HEAD');
  const main = git('rev-parse', 'refs/remotes/origin/main');
  const branch = git('branch', '--show-current');
  const status = git('status', '--porcelain=v1', '--untracked-files=normal');
  const worktrees = git('worktree', 'list', '--porcelain');
  const base = main.ok ? git('merge-base', 'HEAD', 'refs/remotes/origin/main') : {ok:false,value:'UNKNOWN'};
  const behindAhead = main.ok ? git('rev-list', '--left-right', '--count', 'HEAD...refs/remotes/origin/main') : {ok:false,value:'UNKNOWN'};
  const remote = git('remote', 'get-url', 'origin');
  let gate = 'NEEDS_RECONCILIATION';
  const issues = [];
  if (!main.ok) issues.push('origin/main unavailable; remote baseline UNKNOWN');
  if (!status.ok) issues.push('worktree status unavailable');
  else if (status.value) issues.push('working tree contains changed or untracked files; preserve them');
  if (!branch.ok || !branch.value) issues.push('detached or unknown branch');
  if (behindAhead.ok) {
    const [ahead, behind] = behindAhead.value.split(/\s+/).map(Number);
    if (Number.isFinite(behind) && behind > 0) issues.push(`HEAD is behind cached origin/main by ${behind} commit(s)`);
    if (Number.isFinite(ahead) && ahead > 0) issues.push(`HEAD has ${ahead} commit(s) not in cached origin/main`);
  }
  if (!issues.length) gate = 'SOURCE_ONLY_RECONCILED';
  const result = {
    schema: 'TIIZI-PRG-01-LOCAL-v1',
    collected_at_utc: new Date().toISOString(),
    repository: value(remote),
    branch: value(branch) || 'DETACHED',
    head_sha: value(head),
    cached_origin_main_sha: value(main),
    merge_base_sha: value(base),
    head_vs_cached_origin_main_ahead_behind: value(behindAhead),
    status_porcelain: value(status),
    worktrees_porcelain: value(worktrees),
    source_gate: gate,
    issues,
    remote_freshness: 'UNKNOWN (no fetch performed)',
    founder_accepted_feature_state: 'UNKNOWN (manual evidence required)',
    active_runtime_entrypoint: 'UNKNOWN (manual code trace required)',
    deployed_preview_sha: 'UNKNOWN (verify running build)',
    open_and_stacked_prs: 'UNKNOWN (verify current GitHub PR metadata)',
    overall_prg: 'NOT_ASSESSED (requires authority, PR, runtime and preview checks)'
  };
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  // Deliberately non-gating. Only the technical lead can reconcile missing evidence.
}
