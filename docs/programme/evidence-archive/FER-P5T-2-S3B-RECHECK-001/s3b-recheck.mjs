// TIIZI-FER-P5T-2-S3B-EVIDENCE-RECHECK-001 — final-head browser matrix.
// Executor: Claude Code implementation agent (this session), Playwright 1.64.1, headless Chromium.
// Target: the accepted Slice 3b source (tree 57b7fbe…, head 3e70368), served by a LOCAL Vite harness against a LOCAL
// API and a DISPOSABLE PostgreSQL database (tiizi_p5_preview_s3b_recheck). Synthetic users and Templates only.
// Run:  node s3b-recheck.mjs   (needs: the disposable stack up on :5198 / :8788 / :55779 and `playwright` resolvable; see README)
// Exit status: 0 only when every scenario passes; any failure leaves the evidence files and exits 1.
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { exitCodeFor, loadPlaywright } from './s3b-recheck-lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const { chromium } = loadPlaywright({ scriptDir: here });
const shots = join(here, 'screenshots');
mkdirSync(shots, { recursive: true });

const BASE = 'http://localhost:5198/p5-harness.html';
const API = 'http://127.0.0.1:8788';
const DB = 'tiizi_p5_preview_s3b_recheck';
// Loopback harness stub credential for the synthetic `author2` user; supplied by the operator, never committed.
const STUB_TOKEN_AUTHOR2 = process.env.STUB_TOKEN_AUTHOR2;
if (!STUB_TOKEN_AUTHOR2) throw new Error('STUB_TOKEN_AUTHOR2 is required (synthetic harness token for author2)');
const SHA = execFileSync('git', ['-C', (process.env.S3B_SOURCE_WORKTREE ?? process.cwd()), 'rev-parse', 'HEAD']).toString().trim();
const TREE = execFileSync('git', ['-C', (process.env.S3B_SOURCE_WORKTREE ?? process.cwd()), 'rev-parse', 'HEAD^{tree}']).toString().trim();
const EXEC = 'Claude Code implementation agent — Playwright 1.64.1 script s3b-recheck.mjs (NOT the independent R1 reviewer)';
// Optional: a specific Chromium binary. Unset = Playwright's own installed Chromium.
const CHROMIUM_EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE || undefined;

const psql = (sql) => execFileSync('psql', ['-h', '127.0.0.1', '-p', '55779', '-U', 'postgres', '-d', DB, '-At', '-F', '|', '-c', sql]).toString().trim();
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const url = (as, path) => `${BASE}?as=${as}&path=${encodeURIComponent(path)}`;
const tid = (title) => psql(`select template_id from challenge_template_versions where title='${title}' limit 1`);
const cfg = (templateId) => JSON.parse(psql(`select composer_config::text from challenge_template_versions where template_id='${templateId}'`));
const counts = () => ({ templates: Number(psql('select count(*) from challenge_templates')), audit: Number(psql('select count(*) from challenge_template_audit_events')) });

const RUN = Date.now().toString(36);
const results = [];
let browser;

async function scenario(id, title, fn) {
  if (process.env.ONLY && !id.startsWith(process.env.ONLY)) return;
  const rec = { id, title, sourceSha: SHA, sourceTree: TREE, executor: EXEC, startedAt: new Date().toISOString(), steps: [], checks: [], api: [], db: {}, result: 'PASS' };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  // API traffic (method/path/status only — no headers, no tokens, no bodies except sanitized write bodies).
  page.on('response', (res) => {
    const req = res.request();
    const u = new URL(req.url());
    if (u.origin === API && /\/api\/(operator\/templates|knowledge)/.test(u.pathname)) {
      const e = { method: req.method(), path: u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<uuid>'), status: res.status() };
      if (['PUT', 'POST'].includes(req.method())) { try { e.ifMatch = req.headers()['if-match'] ? 'present(quoted)' : 'absent'; } catch { /* ignore */ } }
      rec.api.push(e);
    }
  });
  page.on('requestfailed', (req) => { const u = new URL(req.url()); if (u.origin === API) rec.api.push({ method: req.method(), path: u.pathname.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/g, '<uuid>'), status: 'ABORTED' }); });
  const ctxApi = { page, ctx, rec };
  const step = (s) => rec.steps.push(s);
  const check = (name, ok, detail = '') => { rec.checks.push({ name, ok: !!ok, detail: String(detail) }); if (!ok) rec.result = 'FAIL'; };
  try {
    await fn({ ...ctxApi, step, check });
  } catch (error) {
    rec.result = 'FAIL';
    rec.checks.push({ name: 'script error', ok: false, detail: String(error?.message ?? error).slice(0, 400) });
  }
  try { await page.screenshot({ path: join(shots, `${id}.png`), fullPage: false }); } catch { /* ignore */ }
  rec.endedAt = new Date().toISOString();
  results.push(rec);
  console.log(`${rec.result}  ${id}  ${title}`);
  for (const c of rec.checks) if (!c.ok) console.log(`   FAIL: ${c.name} ${c.detail}`);
  await ctx.close();
}

const open = async (page, as, path) => { await page.goto(url(as, path)); };
const stepNav = (page, re) => page.getByRole('button', { name: re }).first().click();
const saveBtn = (page) => page.getByRole('button', { name: /^(Save|Create) draft$/ });
const storageKeys = (page) => page.evaluate(() => Object.keys(sessionStorage).filter((k) => k.startsWith('tiizi:v2:template-draft:')));
const storageText = (page) => page.evaluate(() => JSON.stringify(Object.fromEntries(Object.keys(sessionStorage).filter((k) => k.startsWith('tiizi:v2:template-draft:')).map((k) => [k, sessionStorage.getItem(k)]))));
const editorReady = (page) => page.getByRole('navigation', { name: 'Editor steps' }).waitFor({ timeout: 20000 });

async function matrix() {
  const marker = psql(`select shobj_description(oid,'pg_database') from pg_database where datname='${DB}'`);
  console.log(`DB target ${DB} marker=${marker} source=${SHA} tree=${TREE}`);
  if (!/^tiizi-disposable-preview:/.test(marker)) throw new Error('refusing: database is not marked disposable');

  await scenario('A1-account-switch-in-place', 'Author A unsaved draft; in-place switch to Author B', async ({ page, step, check, rec }) => {
    const before = counts();
    await open(page, 'author', '/v2/operator/templates/new'); await editorReady(page);
    await stepNav(page, /Template details/); await page.getByLabel('Template summary').fill('A-SECRET-UNSAVED');
    await page.waitForFunction(() => Object.keys(sessionStorage).some((k) => k.endsWith(':author:new')));
    step('Author A typed an unsaved summary; recovery record for A exists');
    const reqs = []; page.on('request', (r) => { if (['POST', 'PUT'].includes(r.method()) && r.url().startsWith(API)) reqs.push(`${r.method()} ${new URL(r.url()).pathname}`); });
    await page.evaluate(() => window.__p5SwitchUser('author2'));
    await sleep(2500); await editorReady(page);
    step('Switched the signed-in account to Author B without a reload');
    await stepNav(page, /Template details/);
    check('B\'s editor does not show A\'s text', (await page.getByLabel('Template summary').inputValue()) === '', await page.getByLabel('Template summary').inputValue());
    const keys = await storageKeys(page); const text = await storageText(page);
    check('no recovery record under B contains A\'s work', !keys.some((k) => k.includes(':author2:') && text.includes('A-SECRET')), keys.join(','));
    const templateWrites = reqs.filter((r) => /\/api\/operator\/templates/.test(r));
    check('no Template write (POST/PUT /api/operator/templates…) was sent after the switch', templateWrites.length === 0, templateWrites.join(','));
    step(`Other writes observed after the switch (not Template writes): ${reqs.filter((r) => !/\/api\/operator\/templates/.test(r)).join(', ') || 'none'}`);
    rec.db = { before, after: counts() };
    check('database unchanged', JSON.stringify(before) === JSON.stringify(rec.db.after), JSON.stringify(rec.db));
  });

  await scenario('A2-account-switch-reload', 'Author B opens the editor after A (same tab session): A\'s record is purged', async ({ page, step, check, rec }) => {
    const before = counts();
    await open(page, 'author', '/v2/operator/templates/new'); await editorReady(page);
    await stepNav(page, /Template details/); await page.getByLabel('Template summary').fill('A-SECRET-2');
    await page.waitForFunction(() => Object.keys(sessionStorage).some((k) => k.endsWith(':author:new')));
    await open(page, 'author2', '/v2/operator/templates/new'); await editorReady(page);
    step('Navigated the same tab as Author B');
    await stepNav(page, /Template details/);
    check('B sees an empty summary', (await page.getByLabel('Template summary').inputValue()) === '');
    check('A\'s recovery record was purged', !(await storageKeys(page)).some((k) => k.includes(':author:')), (await storageKeys(page)).join(','));
    check('no "Restored" banner for B', (await page.getByText(/Restored your unsaved work/).count()) === 0);
    rec.db = { before, after: counts() };
    check('database unchanged', JSON.stringify(before) === JSON.stringify(rec.db.after));
  });

  await scenario('B-canonical-sign-out', 'Canonical sign-out with the editor unmounted; same account signs back in', async ({ page, step, check, rec }) => {
    await open(page, 'author', '/v2/operator/templates/new'); await editorReady(page);
    await stepNav(page, /Template details/); await page.getByLabel('Template summary').fill('B-UNSAVED-RECOVERY');
    await page.waitForFunction(() => Object.keys(sessionStorage).some((k) => k.endsWith(':author:new')));
    await page.evaluate(() => sessionStorage.setItem('tiizi:v2:template-draft:author2:new', JSON.stringify({ savedAt: Date.now(), baseToken: null, baseBody: null, body: { summary: 'control', focusTags: [], sortOrder: 0, coverId: null, durationDays: null, durationPresetDays: null, composer: { draftKind: 'pf04-v1', mode: 'TEMPLATE_AUTHORING', activities: [] } } })));
    step('Recovery record for A created (plus a synthetic control record for Author B)');
    await open(page, 'author', '/v2/profile'); // full navigation: the editor is unmounted
    step('Navigated to the profile screen (editor unmounted)');
    const keysBefore = await storageKeys(page);
    check('A\'s record survives mere navigation', keysBefore.some((k) => k.endsWith(':author:new')), keysBefore.join(','));
    for (let i = 0; i < 4; i += 1) {
      await page.waitForTimeout(1500);
      const skip = page.getByRole('button', { name: /Skip for now/ });
      if (!(await skip.count())) break;
      await skip.click(); step(`Dismissed first-run preferences prompt step ${i + 1} (synthetic member)`);
    }
    await page.getByRole('button', { name: /^Sign out$/ }).click({ timeout: 20000 });
    step('Executed the canonical sign-out action (profile "Sign out" → useV2SignOut)');
    await page.waitForFunction(() => !Object.keys(sessionStorage).some((k) => k.endsWith(':author:new')), null, { timeout: 15000 });
    const keysAfter = await storageKeys(page);
    check('A\'s recovery record is gone after sign-out', !keysAfter.some((k) => k.endsWith(':author:new')), keysAfter.join(','));
    check('another account\'s control record is untouched', keysAfter.some((k) => k.endsWith(':author2:new')), keysAfter.join(','));
    await page.evaluate(() => window.__p5SwitchUser('author'));
    await open(page, 'author', '/v2/operator/templates/new'); await editorReady(page);
    step('Signed back into the same account and reopened the editor');
    await stepNav(page, /Template details/);
    check('previous work is NOT restored', (await page.getByLabel('Template summary').inputValue()) === '');
    check('no "Restored" banner', (await page.getByText(/Restored your unsaved work/).count()) === 0);
    rec.db = counts();
  });

  await scenario('C-stored-activity-integrity', 'Older Activity version: unrelated save keeps version/components/kind; only Refresh adopts current', async ({ page, step, check, rec }) => {
    const t1 = tid('T1 stale-activity draft');
    const writes = []; page.on('request', (r) => { if (r.method() === 'PUT' && r.url().startsWith(API)) writes.push(((d) => { try { return JSON.parse(d ?? '{}'); } catch { return {}; } })(r.postData())); });
    const before = cfg(t1).activities[0];
    check('seed: stored version 3, components [LEFT], kind fitness', before.observedVersion === 3 && JSON.stringify(before.componentIds) === '["LEFT"]' && before.kind === 'fitness', JSON.stringify(before));
    check('seed: governed current version is 4', psql(`select current_version from knowledge_items where activity_code='FIT-SBB-001'`) === '4');
    await open(page, 'author', `/v2/operator/templates/${t1}/edit`); await editorReady(page);
    await stepNav(page, /Activities/);
    await page.getByText(/written against Activity Guide version 3; the current version is 4/).waitFor({ timeout: 15000 });
    step('Mismatch shown (stored 3, current 4); nothing written');
    check('no write request before an edit', writes.length === 0);
    check('Save disabled on load (not dirty)', await saveBtn(page).isDisabled());
    await stepNav(page, /Template details/);
    await page.getByLabel('Template summary').fill('T1 unrelated edit');
    await saveBtn(page).click(); await page.getByText('Draft saved.').waitFor({ timeout: 15000 });
    step('Edited and saved only the summary');
    const sent = writes[0]?.composer?.activities?.[0];
    check('PUT carried version 3, [LEFT] and kind fitness', sent?.observedVersion === 3 && JSON.stringify(sent?.componentIds) === '["LEFT"]' && sent?.kind === 'fitness', JSON.stringify(sent));
    const mid = cfg(t1).activities[0];
    check('DB: version 3, [LEFT], kind fitness unchanged', mid.observedVersion === 3 && JSON.stringify(mid.componentIds) === '["LEFT"]' && mid.kind === 'fitness', JSON.stringify(mid));
    check('DB: the summary did change', psql(`select summary from challenge_template_versions where template_id='${t1}'`) === 'T1 unrelated edit');
    await stepNav(page, /Activities/);
    await page.getByRole('button', { name: /Refresh .* to version 4/ }).click();
    await page.getByText(/required parts changed from LEFT to LEFT, RIGHT/).waitFor({ timeout: 10000 });
    step('Explicit Refresh: current version adopted in the editor, part change flagged');
    check('Refresh alone wrote nothing', writes.length === 1);
    await saveBtn(page).click(); await page.getByText('Draft saved.').waitFor({ timeout: 15000 });
    const after = cfg(t1).activities[0];
    check('DB after refresh+save: version 4, [LEFT,RIGHT], metric/unit/target kept', after.observedVersion === 4 && JSON.stringify(after.componentIds) === '["LEFT","RIGHT"]' && after.metric === 'repetitions' && after.unit === 'reps' && after.targetValue === 100, JSON.stringify(after));
    rec.db = { before, afterUnrelatedSave: mid, afterRefreshSave: after, audit: psql(`select action, count(*) from challenge_template_audit_events where template_id='${t1}' group by 1 order by 1`) };
  });

  await scenario('D-duplicate-creation-prevention', 'First detail GET fails after a successful create POST; retry', async ({ page, step, check, rec }) => {
    const before = counts(); const createAuditBefore = Number(psql(`select count(*) from challenge_template_audit_events where action='create_draft'`));
    let posts = 0, postDone = false, failed = 0;
    await page.route('**/api/operator/templates**', async (route) => {
      const req = route.request(); const u = new URL(req.url());
      if (req.method() === 'POST' && u.pathname.endsWith('/operator/templates')) { posts += 1; postDone = true; return route.continue(); }
      if (req.method() === 'GET' && postDone && failed === 0 && /\/operator\/templates\/[0-9a-f-]{36}$/.test(u.pathname)) { failed += 1; return route.abort('failed'); }
      return route.continue();
    });
    await open(page, 'author', '/v2/operator/templates/new'); await editorReady(page);
    await page.getByRole('button', { name: /Race/ }).first().click();
    await stepNav(page, /Name & appearance/); await page.getByLabel('Challenge title').fill('D duplicate guard Template');
    await stepNav(page, /Activities/); await page.getByRole('button', { name: 'Add Push-ups' }).click();
    await page.getByRole('button', { name: 'Push-ups is already added' }).waitFor({ timeout: 15000 });
    await stepNav(page, /Template details/); await page.getByLabel('Template summary').fill('D summary'); await page.getByLabel('Duration in days').fill('14');
    await saveBtn(page).click();
    await page.getByText(/We could not open the editor/).waitFor({ timeout: 20000 });
    step('POST succeeded; the first detail GET was aborted; editor shows the retryable error');
    check('exactly one POST so far', posts === 1, posts);
    check('exactly one new Template + one new create audit event', Number(psql(`select count(*) from challenge_templates`)) === before.templates + 1 && Number(psql(`select count(*) from challenge_template_audit_events where action='create_draft'`)) === createAuditBefore + 1, JSON.stringify(counts()));
    await page.getByRole('button', { name: 'Retry' }).click();
    await page.getByRole('button', { name: 'Save draft' }).waitFor({ timeout: 20000 });
    step('Retry loaded the same draft');
    check('still exactly one POST after retry (no second create)', posts === 1, posts);
    const mid = counts();
    check('exactly one new Template after retry', mid.templates === before.templates + 1, JSON.stringify(mid));
    const createAudits = psql(`select count(*) from challenge_template_audit_events e join challenge_template_versions v using(template_id) where e.action='create_draft' and v.title='D duplicate guard Template'`);
    check('exactly one create audit event for the new Template', createAudits === '1', createAudits);
    check('the new-draft recovery record is cleared', !(await storageKeys(page)).some((k) => k.endsWith(':author:new')));
    check('the draft content loaded back (summary D summary)', (await (async () => { await stepNav(page, /Template details/); return page.getByLabel('Template summary').inputValue(); })()) === 'D summary');
    rec.db = { before, after: counts(), posts, abortedDetailGets: failed };
  });

  await scenario('E-conflict-hydration', 'Stale-save conflict with delayed Activity/options requests', async ({ page, step, check, rec }) => {
    const t2 = tid('T2 conflict draft');
    const writes = []; page.on('request', (r) => { if (r.method() === 'PUT' && r.url().startsWith(API)) writes.push({ ifMatch: r.headers()['if-match'] ? 'present' : 'absent', summary: JSON.parse(r.postData() ?? '{}').summary }); });
    await open(page, 'author', `/v2/operator/templates/${t2}/edit`); await editorReady(page);
    await stepNav(page, /Template details/); await page.getByLabel('Template summary').fill(`E-MINE-${RUN}`);
    step('Author typed an unsaved summary (E-MINE-<run>)');
    // Second author saves first, through the real API.
    const detail = await (await fetch(`${API}/api/operator/templates/${t2}`, { headers: { Authorization: `Bearer ${STUB_TOKEN_AUTHOR2}` } })).json();
    const v = detail.versions[0];
    const body = { ...v.content, summary: `E-THEIRS-${RUN}` }; delete body.composer.goalValue; delete body.composer.goalUnit; delete body.composer.requiredConsecutiveDays; body.composer.mode = 'TEMPLATE_AUTHORING';
    const put = await fetch(`${API}/api/operator/templates/${t2}/versions/1`, { method: 'PUT', headers: { Authorization: `Bearer ${STUB_TOKEN_AUTHOR2}`, 'Content-Type': 'application/json', 'If-Match': `"${v.revisionToken}"` }, body: JSON.stringify(body) });
    check('second author\'s concurrent save succeeded (200)', put.status === 200, put.status);
    step('Author B saved E-THEIRS-<run> through the API');
    let delayedHits = 0;
    const tl = []; const t00 = Date.now();
    await page.route(/\/api\/knowledge\//, async (route) => { delayedHits += 1; tl.push(`${Date.now() - t00}ms delayed ${route.request().url().slice(-12)}`); await sleep(3500); tl.push(`${Date.now() - t00}ms released`); await route.continue(); });
    const tClick = Date.now(); await saveBtn(page).click();
    await sleep(900);
    step('Author A pressed Save; Activity/options requests are delayed 3.5 s');
    // One synchronous in-page snapshot of the loading state (separate Playwright calls would outlast the delay).
    const snap = await page.evaluate(() => {
      const ta = document.getElementById('tpl-summary');
      const save = [...document.querySelectorAll('button')].find((b) => /^(Save|Create) draft$|^Saving/.test(b.textContent.trim()));
      return { msSinceNav: Math.round(performance.now()), summaryDisabled: !!ta?.matches(':disabled'), summaryValue: ta?.value, saveDisabled: !!save?.disabled, panels: document.querySelectorAll('[aria-labelledby="conflict-title"]').length };
    });
    tl.push(`${Date.now() - t00}ms snapshot ${JSON.stringify({ ...snap, msSinceNav: undefined })}`);
    check('while loading: the summary field is disabled (locked)', snap.summaryDisabled);
    check('while loading: Save is disabled', snap.saveDisabled);
    check('while loading: unsaved work is still shown', snap.summaryValue === `E-MINE-${RUN}`, snap.summaryValue);
    check('while loading: the conflict panel is not yet shown', snap.panels === 0, `count=${snap.panels}`);
    check('while loading: the delayed requests are still pending (snapshot taken inside the delay window)', Date.now() - t00 < 3400, `${Date.now() - t00}ms`);
    const panel = page.getByRole('alert', { name: /changed while you were editing/ });
    await panel.waitFor({ timeout: 20000 }); tl.push(`${Date.now() - t00}ms panel visible`); step(`timeline: ${tl.join(' | ')}`);
    check('the delayed Activity/options requests were actually exercised', delayedHits >= 1, delayedHits);
    step('Conflict panel appeared after hydration completed');
    check('unsaved work preserved after hydration', (await page.getByLabel('Template summary').inputValue()) === `E-MINE-${RUN}`);
    const apply = page.getByRole('button', { name: 'Apply my decisions' });
    check('Apply disabled until the conflict is resolved', await apply.isDisabled());
    check('Save disabled during reconciliation', await saveBtn(page).isDisabled());
    await page.getByRole('radio', { name: 'Summary: keep mine' }).check();
    check('Apply enabled after the explicit choice', await apply.isEnabled());
    await apply.click();
    await page.getByText(/Review the combined draft, then save/).waitFor();
    await page.unroute(/\/api\/knowledge\//);
    await saveBtn(page).click(); await page.getByText('Draft saved.').waitFor({ timeout: 15000 });
    check('reconciled save sent If-Match', writes.length >= 2 && writes.at(-1).ifMatch === 'present', JSON.stringify(writes));
    check('DB summary is the reconciled choice (E-MINE-<run>)', psql(`select summary from challenge_template_versions where template_id='${t2}'`) === `E-MINE-${RUN}`);
    const audit = psql(`select e.action, (select auth_subject from members m where m.member_id=e.actor_member_id) from challenge_template_audit_events e where e.template_id='${t2}' order by e.occurred_at`);
    rec.db = { audit };
    check('audit: two edit_draft events (author2 then author)', /edit_draft\|author2\nedit_draft\|author$/.test(audit.replace(/\r/g, '')), audit);
  });

  await scenario('F1-normal-create-edit-save', 'Normal edit and save of an existing draft', async ({ page, step, check, rec }) => {
    const t2 = tid('T2 conflict draft');
    await open(page, 'author', `/v2/operator/templates/${t2}/edit`); await editorReady(page);
    await stepNav(page, /Template details/); await page.getByLabel('Template summary').fill(`F-normal-${RUN}`);
    await saveBtn(page).click(); await page.getByText('Draft saved.').waitFor({ timeout: 15000 });
    check('DB: summary saved', psql(`select summary from challenge_template_versions where template_id='${t2}'`) === `F-normal-${RUN}`);
    rec.db = { audit: psql(`select action, count(*) from challenge_template_audit_events where template_id='${t2}' group by 1 order by 1`) };
  });

  await scenario('F2-mid-session-revocation', 'Author revoked mid-session; save returns 403', async ({ page, step, check, rec }) => {
    const t2 = tid('T2 conflict draft');
    await open(page, 'author3', `/v2/operator/templates/${t2}/edit`); await editorReady(page);
    await stepNav(page, /Template details/); await page.getByLabel('Template summary').fill(`F-REVOKED-${RUN}`);
    psql(`update platform_operator_template_authors set revoked_at=now(), revoked_reference='Recheck mid-session revocation' where member_id=(select member_id from members where auth_subject='author3')`);
    step('Author 3 revoked in the database while the editor is open');
    await saveBtn(page).click();
    await page.getByText(/authoring access was removed/).waitFor({ timeout: 15000 });
    check('a 403 was returned by the server', rec.api.some((a) => a.method === 'PUT' && a.status === 403), JSON.stringify(rec.api.filter((a) => a.method === 'PUT')));
    check('editing is switched off (fieldset disabled)', await page.getByLabel('Template summary').isDisabled());
    check('the author\'s work is still visible', (await page.getByLabel('Template summary').inputValue()) === `F-REVOKED-${RUN}`);
    check('Save is disabled', await saveBtn(page).isDisabled());
    check('DB summary unchanged by the revoked author', psql(`select summary from challenge_template_versions where template_id='${t2}'`) === `F-normal-${RUN}`);
    check('work retained in recovery', (await storageKeys(page)).some((k) => k.includes(':author3:')));
  });

  for (const w of [1280, 1440, 900, 390]) {
    await scenario(`F3-layout-${w}`, `Layout at ${w}px: no page-level horizontal overflow`, async ({ page, ctx, step, check, rec }) => {
      await page.setViewportSize({ width: w, height: 900 });
      const t2 = tid('T2 conflict draft');
      await open(page, 'author', `/v2/operator/templates/${t2}/edit`); await editorReady(page);
      const m = await page.evaluate(() => ({ iw: window.innerWidth, sw: document.documentElement.scrollWidth }));
      rec.db = m;
      check(`scrollWidth ${m.sw} <= innerWidth ${m.iw}`, m.sw <= m.iw, JSON.stringify(m));
      for (const name of [/Activities/, /What counts/, /Template details/]) { await stepNav(page, name); const mm = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth); check(`no overflow on step ${name}`, mm); }
    });
  }

}

function writeEvidence() {
  const finished = new Date().toISOString();
  const pass = exitCodeFor(results) === 0;
  writeFileSync(join(here, 'evidence.json'), JSON.stringify({ sourceSha: SHA, sourceTree: TREE, executor: EXEC, finished, database: DB, overall: pass ? 'PASS' : 'FAIL', scenarios: results }, null, 2));
  const md = [`# S3b final-head browser matrix`, ``, `- Source SHA: \`${SHA}\` (tree \`${TREE}\`)`, `- Executor: ${EXEC}`, `- Finished: ${finished}`, `- Database: ${DB} (disposable, marker verified)`, `- Overall: **${pass ? 'PASS' : 'FAIL'}**`, ``,
    ...results.flatMap((r) => [`## ${r.id} — ${r.title}`, `Result: **${r.result}** · ${r.startedAt} → ${r.endedAt}`, ``, `Steps:`, ...r.steps.map((s) => `- ${s}`), ``, `Checks:`, ...r.checks.map((c) => `- ${c.ok ? 'PASS' : 'FAIL'}: ${c.name}${c.ok ? '' : ` (${c.detail})`}`), ``, `API: ${r.api.map((a) => `${a.method} ${a.path} ${a.status}`).join('; ') || '—'}`, ``])].join('\n');
  writeFileSync(join(here, 'evidence.md'), md);
  console.log(`OVERALL ${pass ? 'PASS' : 'FAIL'}`);
}

async function run() {
  try {
    browser = await chromium.launch(CHROMIUM_EXECUTABLE ? { executablePath: CHROMIUM_EXECUTABLE } : {});
    await matrix();
  } catch (error) {
    console.error(error);
    const now = new Date().toISOString();
    results.push({ id: 'run-error', title: 'Run aborted outside a scenario', startedAt: now, endedAt: now, steps: [], checks: [{ name: 'run error', ok: false, detail: String(error?.message ?? error).slice(0, 400) }], api: [], db: {}, result: 'FAIL' });
  } finally {
    await browser?.close().catch(() => undefined);
  }
  writeEvidence();
  process.exitCode = exitCodeFor(results);
}
run().catch((e) => { console.error(e); process.exit(1); });
