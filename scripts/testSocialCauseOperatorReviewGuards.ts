import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');
const route = read('api/src/socialCauseApprovalRoutes.ts');
const provider = read('api/src/socialCauseApprovalAuthority.ts');
const runtime = read('api/src/index.ts');
const screen = read('src/v2/operator/SocialCauseReviewPage.tsx');
const routes = read('src/v2/routes.tsx');
const previewSetup = read('scripts/previewSocialCauseOperator.ts');
const signIn = read('src/v2/auth/V2SignInPage.tsx');
const shell = read('src/v2/operator/OperatorShell.tsx');
const styles = read('src/index.css');
const migration = read('api/migrations/023_platform_operator_cause_review_authority.sql');
const checks: Array<[string, boolean]> = [
  ['runtime wires the scoped Postgres Cause-review authority', runtime.includes('createPostgresSocialCauseReviewerAuthority(db)')],
  ['authority is explicit, revocable, and not inferred from Group roles', provider.includes('platform_operator_cause_reviewers') && provider.includes('revoked_at IS NULL')],
  ['pending queue and detail require Operator authority before reading', /app\.get\('\/v1\/operator\/social-causes\/pending',[\s\S]*?requireOperator[\s\S]*?db\.query/.test(route) && /app\.get\('\/v1\/operator\/social-causes\/:challengeId',[\s\S]*?requireOperator[\s\S]*?db\.query/.test(route)],
  ['approval decision rejects Challenge creator self-review', route.includes('cause_creator_cannot_decide')],
  ['decision reason, authority, and timestamp use the existing audit store', route.includes('challenge_social_cause_decisions') && route.includes('decision_reason=$4')],
  ['review UI is wired into the existing Operator Review route', routes.includes('<Route path="review" element={<SocialCauseReviewPage />} />')],
  ['review UI exposes approved/revision-required actions and decision reason', screen.includes("value: 'approved'") && screen.includes("value: 'revision_required'") && screen.includes('Decision reason')],
  ['review UI displays governed beneficiary destination facts and audit', screen.includes('Beneficiary payment destination reference') && screen.includes('Decision audit')],
  ['Development Operator provisioning is loopback-only and refuses production', previewSetup.includes("NODE_ENV === 'production'") && previewSetup.includes("target.host !== '127.0.0.1'") && previewSetup.includes("['localhost', '127.0.0.1', '::1']")],
  ['Operator account switching is Development-only and targets only Social Cause review', signIn.includes('import.meta.env.DEV') && signIn.includes("next === '/v2/operator/review'") && signIn.includes("params.get('operatorPreview') === '1'")],
  ['switching accounts signs the member session out before Operator sign-in', signIn.includes('await logout()') && signIn.includes('Sign out and switch account') && signIn.includes('social-cause-operator@tiizi.local')],
  ['Operator desktop shell uses persistent navigation and full workspace width', shell.includes('lg:sticky') && shell.includes('lg:h-screen') && shell.includes('w-full p-4 sm:p-6 lg:p-8') && styles.includes('body.operator-desktop #root')],
  ['authority migration is narrowly scoped to Cause review', migration.includes('platform_operator_cause_reviewers') && !/CREATE TABLE[^;]*operator_roles/i.test(migration)],
];
let failures = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '  ok' : '  FAIL'}: ${name}`);
  if (!ok) failures++;
}
if (failures) {
  console.error(`\nSocial Cause Operator review guards: ${failures} failure(s).`);
  process.exitCode = 1;
} else {
  console.log('\nSocial Cause Operator review guards: PASS');
}
