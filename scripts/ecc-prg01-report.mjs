#!/usr/bin/env node
// ECCL-005 Phase B v0.1: read-only, non-gating source and handover diagnostic.
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, appendFileSync } from 'node:fs';

const git = (...args) => {
  try { return execFileSync('git', args, { encoding: 'utf8', timeout: 15000 }).trim(); }
  catch { return null; }
};
const short = sha => sha ? sha.slice(0, 12) : 'UNKNOWN';
const event = (() => {
  try { return JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8')); }
  catch { return {}; }
})();
const pr = event.pull_request ?? null;
const main = git('rev-parse', 'refs/remotes/origin/main');
const checkedOut = git('rev-parse', 'HEAD');
const head = pr?.head?.sha ?? null;
const base = pr?.base?.sha ?? null;
const mergeBase = head && main ? git('merge-base', head, main) : null;
const upToDate = head && main && mergeBase ? mergeBase === main : null;
const inMain = head && main ? git('merge-base', '--is-ancestor', head, main) !== null : null;
const agentEntry = existsSync('AGENTS.md');
const body = pr?.body ?? '';
const handoverFields = {
  source: /\b(sha|commit|baseline|head)\b/i.test(body),
  verification: /\b(test|ci|check|verification|evidence)\b/i.test(body),
  authority: /\b(approval|founder|decision|authori[sz]ation)\b/i.test(body),
  continuation: /\b(next|handover|follow.up|blocker|pending)\b/i.test(body),
};
const missing = Object.entries(handoverFields).filter(([,found]) => !found).map(([name]) => name);
const signals = [];
if (!agentEntry) signals.push('Root AGENTS.md is missing.');
if (pr && !mergeBase) signals.push('Cannot independently establish PR head ancestry.');
if (upToDate === false) signals.push('PR head predates remote main; assess accepted changes before integration.');
if (missing.length) signals.push('PR description has no evidence markers for: ' + missing.join(', ') + '.');
const report = {
  schema: 'ECCL-005/phase-b/v0.1',
  status: 'DIAGNOSTIC_COMPLETE_NEEDS_HUMAN_RECONCILIATION',
  repository: process.env.GITHUB_REPOSITORY ?? 'local',
  pr: pr?.number ?? null,
  source: { checkedOut, remoteMain: main, pullRequestHead: head, pullRequestBase: base,
    mergeBase, containsCurrentMain: upToDate, headAlreadyInMain: inMain },
  agentEntry: agentEntry ? 'CONFIRMED' : 'UNKNOWN',
  handoverDescriptionMarkers: handoverFields,
  humanChecks: ['Founder-accepted behaviour and exact reviewed head',
    'stacked PR dependencies and supersessions', 'active routes and retired consumers',
    'actual preview artifact SHA and fixture isolation', 'local dirty worktrees'],
  observations: signals,
};
const lines = [
  '## ECCL Phase B — informational only',
  '',
  '**Result: DIAGNOSTIC COMPLETE — NOT PRG-01 PASS OR MERGE AUTHORITY.**',
  '',
  '| Signal | Evidence |', '| --- | --- |',
  `| Remote main | ${short(main)} |`,
  `| PR head | ${short(head)} |`,
  `| Merge base | ${short(mergeBase)} |`,
  `| Head includes current main | ${upToDate === null ? 'UNKNOWN' : upToDate ? 'YES' : 'NO — reconcile'} |`,
  `| Root AGENTS.md | ${agentEntry ? 'PRESENT' : 'UNKNOWN'} |`,
  `| Handover description markers | ${missing.length ? 'MISSING: ' + missing.join(', ') : 'PRESENT (content not validated)'} |`,
  '', '### Observations',
  ...(signals.length ? signals.map(s => '- ' + s) : ['- No machine-detectable exceptions.']),
  '', '### Still requires Technical Lead reconciliation',
  ...report.humanChecks.map(s => '- ' + s),
  '', 'Diagnostic exit code 0 means the collector ran, not that implementation is approved.',
];
const markdown = lines.join('\n') + '\n';
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
console.log(markdown);
console.log(JSON.stringify(report));
