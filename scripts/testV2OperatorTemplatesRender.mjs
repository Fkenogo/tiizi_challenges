/** TIIZI-FER-P5T-2-S2: render the Operator Template Library over seeded data (run via npm run test:v2-operator-templates). */
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
for (const key of ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID']) {
  process.env[`VITE_FIREBASE_${key}`] ??= 'harness-placeholder';
}
const server = await createServer({ root, configFile: false, appType: 'custom', logLevel: 'error', server: { middlewareMode: true }, esbuild: { jsx: 'automatic' } });
let cases;
try { cases = (await server.ssrLoadModule('/scripts/operatorTemplateLibraryHarness.tsx')).renderCases(); } finally { await server.close(); }

let failures = 0;
const check = (name, ok) => { if (ok) console.log(`  ok: ${name}`); else { failures += 1; console.error(`  FAIL: ${name}`); } };
const text = (html) => html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

const populated = cases.populated; const t = text(populated);
check('lists Templates with title, summary, type, lifecycle and versions', t.includes('Hundred Rep Race') && t.includes('A short race to a hundred reps.') && />Race<\/td>/.test(populated) && t.includes('Published') && t.includes('v2') && t.includes('14 days'));
check('a draft with no content is shown honestly as an untitled draft', t.includes('Untitled draft') && t.includes('No summary yet'));
check('shows tags', t.includes('Strength'));
check('detail shows every version with state and adoption counts', t.includes('v1') && t.includes('v2') && t.includes('v3') && /Adoptions/.test(t) && />3<\/td>/.test(populated) && /<td[^>]*>0<\/td>/.test(populated));
const versionsTable = populated.slice(populated.indexOf('aria-label="Versions"'));
const versionRow = (n) => versionsTable.match(new RegExp(`<tr[^>]*>(?:(?!</tr>).)*?>v${n}</button>(?:(?!</tr>).)*?</tr>`))?.[0] ?? '';
check('an unpublished draft version shows no adoption number', />—<\/td><\/tr>$/.test(versionRow(3)) && !/<td[^>]*>\d+<\/td><\/tr>$/.test(versionRow(3)));
check('published versions show their adoption counts in the Versions table', />3<\/td><\/tr>$/.test(versionRow(1)) && />0<\/td><\/tr>$/.test(versionRow(2)));
check('detail shows the selected version configuration and Activities', t.includes('Version 3 configuration'));
check('more-available is offered with an explicit control, never a total', t.includes('Load more') && !/of\s+\d+\s+Templates|total/i.test(t));
check('read-only: no authoring controls are rendered', !/\b(Publish|Revise|Retire|Save draft)\b|New Template|Create Template/i.test(t));
check('no Firestore / deferred-capability copy remains', !/Firestore|not available in the current Product Truth/.test(t));

const end = text(cases.endOfList);
check('end of list is stated when the cursor is null', end.includes('end of list') && !end.includes('Load more'));

const offlineDetail = text(cases.offlineDetail); const offlineList = text(cases.offlineList);
check('an offline (paused) detail query renders a loading state instead of crashing', offlineDetail.includes('Loading Template') && offlineDetail.includes('Hundred Rep Race'));
check('an offline (paused) list renders a loading state instead of a blank page', offlineList.includes('Loading Templates') && !/denied|No Templates/.test(offlineList));

const empty = text(cases.emptyLibrary);
check('empty Library is distinct from no-results and from errors', empty.includes('No Templates yet') && !empty.includes('No Templates match') && !/denied|unreachable/i.test(empty));
check('empty Library offers no unsupported create action', !/\bCreate\b|New Template/i.test(empty));

if (failures) { console.error(`\n${failures} render failure(s)`); process.exit(1); }
console.log('\noperator-template render checks: all passing');
