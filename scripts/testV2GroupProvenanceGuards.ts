/**
 * TIIZI-FER-P4A-001 — Group creator provenance guards (run: npm run test:v2-provenance).
 * Authorization, immutability and no-backfill are proven against PostgreSQL in
 * api/test/p4aGroupCreatorProvenance.test.ts.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groupProvenanceView, NOT_RECORDED_LABEL } from '../src/v2/groups/groupProvenanceView';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}
const A = '11111111-1111-4111-8111-111111111111', B = '22222222-2222-4222-8222-222222222222';

console.log('A. presentation distinguishes the original creator from the current Steward');
check('not authorized (field absent) renders nothing', groupProvenanceView({ steward: { memberId: B } }, null, A) === null);
check('creator not recorded shows "Not recorded" and never the Steward',
  JSON.stringify(groupProvenanceView({ originalCreator: null, steward: { memberId: B } }, { memberId: B, displayName: 'Amani' }, A))
  === JSON.stringify({ creatorLabel: NOT_RECORDED_LABEL, creatorIsSteward: false, showSteward: false, stewardLabel: '' }));
check('creator who is still the Steward is shown once, flagged as also the current Steward',
  (() => { const v = groupProvenanceView({ originalCreator: { memberId: A, displayName: 'Wanjiru' }, steward: { memberId: A } }, { memberId: A, displayName: 'Wanjiru' }, B)!; return v.creatorLabel === 'Wanjiru' && v.creatorIsSteward && !v.showSteward; })());
check('creator and Steward can differ: both are shown with their own names',
  (() => { const v = groupProvenanceView({ originalCreator: { memberId: A, displayName: 'Wanjiru' }, steward: { memberId: B } }, { memberId: B, displayName: 'Amani' }, null)!; return v.creatorLabel === 'Wanjiru' && !v.creatorIsSteward && v.showSteward && v.stewardLabel === 'Amani'; })());
check('the viewer\'s own identity reads "You"',
  groupProvenanceView({ originalCreator: { memberId: A, displayName: 'W' }, steward: { memberId: B } }, null, A)!.creatorLabel === 'You'
  && groupProvenanceView({ originalCreator: { memberId: A, displayName: 'W' }, steward: { memberId: B } }, null, B)!.stewardLabel === 'You');
check('NULL names use neutral fallbacks',
  (() => { const v = groupProvenanceView({ originalCreator: { memberId: A, displayName: null }, steward: { memberId: B } }, { memberId: B, displayName: null }, null)!; return v.creatorLabel === 'A Group member' && v.stewardLabel === 'The Accountable Steward'; })());

console.log('B. wiring and boundaries');
const screen = read('src/v2/groups/V2GroupHomeScreen.tsx');
check('Group Details renders provenance only through the pure view, inside the existing Stewardship block',
  /groupProvenanceView\(detail, rosterSteward, viewerMemberId\)/.test(screen) && /data-group-provenance/.test(screen) && screen.includes('Original creator') && screen.includes('Current Steward'));
const view = read('src/v2/groups/groupProvenanceView.ts');
check('the view never derives the creator from the Steward, a roster order or a join date',
  !/joinedAt|steward\?\.memberId\s*\?\?\s*creator|creator\s*=\s*steward/i.test(view.replace(/\/\*[\s\S]*?\*\//g, '')));
const reads = read('api/src/groupReads.ts');
const detailFn = reads.slice(reads.indexOf('export async function getGroupDetail'), reads.indexOf('const groupDetailResponseSchema'));
const subsetAt = detailFn.indexOf("relationship === 'none' || relationship === 'pending'");
const fullAt = detailFn.indexOf('// Full member projection');
const creatorAt = detailFn.indexOf('const creatorId');
check('the API reads provenance only after the active-member split (the discoverable subset returns earlier and carries no creator)',
  subsetAt > 0 && fullAt > subsetAt && creatorAt > fullAt && !detailFn.slice(subsetAt, fullAt).includes('originalCreator'));
check('the creator name comes from the governed display-name projection (no email/auth fields)',
  detailFn.includes('readDisplayNames(db, [String(creatorId)])') && !/auth_subject|email/.test(detailFn.slice(creatorAt, creatorAt + 500)));
const pg = read('api/src/postgresGroupAuthority.ts');
check('establishment records the creator from the authenticated actor in the same insert as the Steward', /original_creator_member_id\)\s*\n\s*VALUES \(\$1,\$2,\$3,'active',\$4,\$5,\$6,[^)]*\$17,\$17,\$6\)/.test(pg));
const migration = read('api/migrations/029_group_original_creator.sql');
check('the migration only adds a nullable column and a guard trigger: no UPDATE/INSERT backfill', !/^\s*(UPDATE|INSERT)\b/im.test(migration.replace(/--.*$/gm, '')) && /ADD COLUMN IF NOT EXISTS original_creator_member_id UUID REFERENCES members/.test(migration));
check('the migration records the no-backfill decision, the candidate establishment signature and why it is not adopted', /NO BACKFILL IN THIS MIGRATION/.test(migration) && /CANDIDATE signature/.test(migration) && /approved_by_member_id = member_id/.test(migration));
check('the current Steward row is matched by member id, never by relationship order', /member\.memberId === detail\.steward\?\.memberId/.test(screen) && !/relationship === 'steward'\) \?\? null/.test(screen));

if (failures > 0) { console.error(`\nGroup provenance guards: ${failures} failure(s).`); process.exit(1); }
console.log('\nGroup provenance guards: all passing.');
