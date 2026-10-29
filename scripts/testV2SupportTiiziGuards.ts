/**
 * TIIZI-FER-P8A-001 — Support Tiizi guards (run: npm run test:v2-support).
 * The screen is placeholder-complete and NON-TRANSACTIONAL (FDR-04): it can
 * never initiate a payment, copy, message or network call.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SUPPORT_TIIZI } from '../src/v2/support/supportTiiziContent';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (rel: string) => readFileSync(join(root, rel), 'utf8');
let failures = 0;
function check(name: string, ok: boolean, detail = '') {
  if (ok) console.log(`  ok: ${name}`);
  else { failures += 1; console.error(`  FAIL: ${name}${detail ? ` — ${detail}` : ''}`); }
}

const files = readdirSync(join(root, 'src/v2/support')).map((f) => `src/v2/support/${f}`);
const sources = Object.fromEntries(files.map((f) => [f, read(f)]));
const all = Object.values(sources).join('\n');
const screen = sources['src/v2/support/V2SupportTiiziScreen.tsx'];
const card = sources['src/v2/support/V2SupportTiiziCard.tsx'];
const content = sources['src/v2/support/supportTiiziContent.ts'];
const visible = JSON.stringify(SUPPORT_TIIZI).replace(SUPPORT_TIIZI.placeholderMark, '');

console.log('A. nothing can initiate a transaction, copy, message or network call');
check('activation guard is off (real details need a later authorized package)', SUPPORT_TIIZI.activated === false);
check('no tel:, mailto:, wa.me, whatsapp links or URLs', !/tel:|mailto:|wa\.me|whatsapp\.com|https?:\/\//i.test(all));
check('no fetch, API, storage, clipboard, window.open or location navigation',
  !/\bfetch\(|apiFetch|axios|XMLHttpRequest|localStorage|sessionStorage|indexedDB|navigator\.clipboard|window\.open|location\.(href|assign)|sendBeacon/.test(all));
check('no form, submit, anchor, text input or payment-provider code', !/<form|type="submit"|<a\b|<input|<textarea|V2TextInput|paystack|stripe|mpesa|m-pesa|daraja/i.test(all));
check('only navigation hooks: the card routes to /v2/support, the screen goes back or to Profile',
  /navigate\('\/v2\/support'\)/.test(card) && /navigate\(-1\)/.test(screen) && /navigate\('\/v2\/profile'\)/.test(screen));
check('no state is persisted or sent: selections are local React state only', /useState/.test(screen) && !/mutate|useMutation|useQuery/.test(all));

console.log('B. honest copy');
check('no number-like strings (7+ digits or a + prefix) in members\' text', !/\d{7,}|\+\d/.test(visible));
check('no paid/received/total/receipt/pledge/donation/thank-you claims', !/\bpaid\b|\breceived\b|\btotal\b|receipt|pledg|donat|thank you|raised|goal reached/i.test(visible));
check('no "coming soon" or later-availability promises', !/coming soon|later update|will be available|launching/i.test(visible));
check('status says nothing can be sent, charged or recorded', /nothing can be sent, charged or recorded/.test(SUPPORT_TIIZI.status));
check('suggested amounts are exactly KES 500 / 1,000 / 2,000 / 5,000 / Custom',
  SUPPORT_TIIZI.amounts.map((a) => a.label).join('|') === 'KES 500|KES 1,000|KES 2,000|KES 5,000|Custom amount');
check('frequencies are just once / occasionally / monthly / annually and are not a subscription',
  SUPPORT_TIIZI.frequencies.map((f) => f.id).join('|') === 'once|occasionally|monthly|annually' && /not a subscription/.test(SUPPORT_TIIZI.frequencyHint));
check('recipient, holder and WhatsApp are each marked "Placeholder – not payable"',
  SUPPORT_TIIZI.placeholders.length === 3 && SUPPORT_TIIZI.placeholderMark === 'Placeholder – not payable'
  && /SUPPORT_TIIZI\.placeholderMark/.test(screen) && /<dl/.test(screen) && !/<button/.test(screen.slice(screen.indexOf('<dl'), screen.indexOf('</dl>'))));
check('platform support is distinguished from Group and Challenge contributions', /separate from any Group or Challenge/.test(SUPPORT_TIIZI.about));
check('Tiizi stays free and results never depend on supporting', /never depend on supporting Tiizi/.test(SUPPORT_TIIZI.lead));
check('wording is flagged as proposed and unapproved in the content module', /PROPOSED and UNAPPROVED/.test(content));

console.log('C. mobile, accessibility and navigation');
check('choices are toggle buttons with a 44px minimum touch target and a visible focus ring',
  /aria-pressed/.test(screen) && /min-h-11/.test(screen) && /focus-visible:ring-2/.test(screen));
check('amounts and frequency are grouped with fieldset/legend; status and preview are announced', /<fieldset/.test(screen) && /<legend/.test(screen) && /role="status"/.test(screen) && /aria-live="polite"/.test(screen));
check('back control is a 44px button with text', /min-h-11[^"]*"[\s\S]{0,160}ArrowLeft/.test(screen) && /SUPPORT_TIIZI\.back/.test(screen));
check('the Profile card is a full-width 44px entry', /min-h-11 w-full/.test(card));

console.log('D. integration');
const routes = read('src/v2/routes.tsx');
check('/v2/support is registered inside the authenticated member shell',
  routes.indexOf('<Route element={<V2MemberShell />}>') < routes.indexOf('path="support"') && routes.indexOf('path="support"') < routes.indexOf('path="operator"'));
const profile = read('src/v2/profile/V2ProfileScreen.tsx');
check('Profile shows the Support Tiizi card in its slot between Interests & Goals and My Tiizi Journey',
  profile.indexOf('<ProfilePreferencesSection') < profile.indexOf('<V2SupportTiiziCard') && profile.indexOf('<V2SupportTiiziCard') < profile.indexOf('My Tiizi Journey'));

if (failures > 0) { console.error(`\nSupport Tiizi guards: ${failures} failure(s).`); process.exit(1); }
console.log('\nSupport Tiizi guards: all passing.');
