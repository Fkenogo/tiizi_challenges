/**
 * TIIZI-FER-P8A-001 — Support Tiizi guards (run: npm run test:v2-support).
 * The screen is placeholder-complete and NON-TRANSACTIONAL (FDR-04): it can
 * never initiate a payment, copy, message or network call.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FOUNDER_APPROVED, FOUNDER_SUPPLIED_PENDING, SUPPORT_TIIZI } from '../src/v2/support/supportTiiziContent';
import { supportBackTarget } from '../src/v2/support/supportBackTarget';

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
const visible = JSON.stringify(SUPPORT_TIIZI).replace(SUPPORT_TIIZI.copy.placeholderMark, '');

console.log('A. nothing can initiate a transaction, copy, message or network call');
check('activation guard is off (real details need a later authorized package)', SUPPORT_TIIZI.activated === false);
check('no tel:, mailto:, sms:, wa.me, whatsapp links, URLs or href/Link', !/tel:|mailto:|sms:|wa\.me|whatsapp\.com|https?:\/\/|href=|<Link\b/i.test(all));
check('no copy control (clipboard, onCopy, execCommand)', !/onCopy|execCommand|clipboard/i.test(all));
check('no fetch, API, storage, clipboard, window.open or location navigation',
  !/\bfetch\(|apiFetch|axios|XMLHttpRequest|localStorage|sessionStorage|indexedDB|navigator\.clipboard|window\.open|location\.(href|assign)|sendBeacon/.test(all));
check('no form, submit, anchor, text input or payment-provider code', !/<form|type="submit"|<a\b|<input|<textarea|V2TextInput|paystack|stripe|mpesa|m-pesa|daraja/i.test(all));
const cardNav = [...card.matchAll(/navigate\(([^,)]*)/g)].map((m) => m[1].trim());
const screenNav = [...screen.matchAll(/navigate\(([^,)]*)/g)].map((m) => m[1].trim());
check('the card navigates only to /v2/support, passing its own origin as state', cardNav.join('|') === "'/v2/support'" && /state: \{ from: '\/v2\/profile' \}/.test(card), cardNav.join('|'));
check('the screen navigates only through supportBackTarget (no history, no location.key)',
  screenNav.join('|') === 'supportBackTarget(location.state' && !/navigate\(-\d|history\.|location\.key|document\.referrer/.test(screen), screenNav.join('|'));
check('no state is persisted or sent: selections are local React state only', /useState/.test(screen) && !/mutate|useMutation|useQuery/.test(all));

console.log('B. honest copy');
check('no number-like strings (7+ digits or a + prefix) in members\' text', !/\d{7,}|\+\d/.test(visible));
check('no paid/received/total/receipt/pledge/donation/thank-you claims', !/\bpaid\b|\breceived\b|\btotal\b|receipt|pledg|donat|thank you|raised|goal reached/i.test(visible));
check('no "coming soon" or later-availability promises', !/coming soon|later update|will be available|will appear|once .{0,40}confirmed|launching|\bsoon\b/i.test(visible));
check('status says nothing can be sent, charged or recorded', /nothing can be sent, charged or recorded/.test(SUPPORT_TIIZI.copy.status));
check('suggested amounts are exactly KES 500 / 1,000 / 2,000 / 5,000 / Custom',
  SUPPORT_TIIZI.amounts.map((a) => a.label).join('|') === 'KES 500|KES 1,000|KES 2,000|KES 5,000|Custom amount');
check('frequencies are just once / occasionally / monthly / annually and are not a subscription',
  SUPPORT_TIIZI.frequencies.map((f) => f.id).join('|') === 'once|occasionally|monthly|annually' && /not a subscription/.test(SUPPORT_TIIZI.copy.frequencyHint));
check('recipient, holder and WhatsApp are each marked "Placeholder – not payable"',
  SUPPORT_TIIZI.placeholders.length === 3 && SUPPORT_TIIZI.copy.placeholderMark === 'Placeholder – not payable'
  && /SUPPORT_TIIZI\.copy\.placeholderMark/.test(screen) && /<dl/.test(screen) && !/<button/.test(screen.slice(screen.indexOf('<dl'), screen.indexOf('</dl>'))));
check('platform support is distinguished from Group and Challenge contributions', /separate from any Group or Challenge/.test(SUPPORT_TIIZI.copy.about));
check('Tiizi stays free and results never depend on supporting', /never depend on supporting Tiizi/.test(SUPPORT_TIIZI.copy.lead));
check('content tiers are structurally separate: approved constants, pending details, and all proposed strings under copy',
  Object.keys(SUPPORT_TIIZI).sort().join('|') === 'activated|amounts|copy|frequencies|placeholders'
  && Object.keys(FOUNDER_APPROVED).sort().join('|') === 'currency|customAmount|frequencies|operatingModel|suggestedAmounts'
  && Object.values(SUPPORT_TIIZI.copy).every((v) => typeof v === 'string' || typeof v === 'object')
  && /FOUNDER-APPROVED/.test(content) && /FOUNDER-SUPPLIED/.test(content) && /PROPOSED/.test(content));
check('Founder-approved frequency choices and labels', FOUNDER_APPROVED.frequencies.map((f) => f.label).join('|') === 'Just once|Occasionally, whenever able|Monthly|Annually');

console.log('A2. Founder-approved constants and pending details');
check('KES, exactly four suggested amounts, custom option, manual mobile-money model',
  FOUNDER_APPROVED.currency === 'KES' && FOUNDER_APPROVED.suggestedAmounts.join(',') === '500,1000,2000,5000'
  && FOUNDER_APPROVED.customAmount === true && FOUNDER_APPROVED.operatingModel === 'manual-mobile-money');
check('the three Founder-supplied details stay null placeholders that no screen reads',
  FOUNDER_SUPPLIED_PENDING.map((p) => p.id).join('|') === 'recipient|holder|whatsapp' && FOUNDER_SUPPLIED_PENDING.every((p) => p.value === null)
  && !/\.value\b/.test(screen) && SUPPORT_TIIZI.activated === false);

console.log('C0. Back never relies on browser history');
const fallback = '/v2/profile';
check('no state, null, or non-object state falls back to Profile', supportBackTarget(undefined) === fallback && supportBackTarget(null) === fallback && supportBackTarget('x') === fallback);
check('the Profile origin goes back to Profile; another safe in-app origin is honoured', supportBackTarget({ from: '/v2/profile' }) === fallback && supportBackTarget({ from: '/v2/groups' }) === '/v2/groups' && supportBackTarget({ from: '/v2/groups/AbC_12' }) === '/v2/groups/AbC_12');
check('external, protocol-relative, odd or self origins fall back to Profile',
  [ 'https://evil.example', '//evil.example', 'javascript:alert(1)', '/app/home', '/v2/../x', '/v2/support', '/v2/support/x', '/v2/', 42, {}].every((from) => supportBackTarget({ from }) === fallback));

console.log('C. mobile, accessibility and navigation');
check('choices are toggle buttons with a 44px minimum touch target and a visible focus ring',
  /aria-pressed/.test(screen) && /min-h-11/.test(screen) && /focus-visible:ring-2/.test(screen));
check('amounts and frequency are each a fieldset/legend group; status and preview are announced',
  (screen.match(/<ChoiceGroup/g) ?? []).length === 2 && /<fieldset/.test(screen) && /<legend/.test(screen) && /label=\{SUPPORT_TIIZI\.copy\.amountsHeading\}/.test(screen) && /label=\{SUPPORT_TIIZI\.copy\.frequencyHeading\}/.test(screen)
  && /role="status"/.test(screen) && /aria-live="polite"/.test(screen));
check('Profile card heading is a section-level h2, like Interests & Goals', /<h2 /.test(card) && !/<h3/.test(card));
check('back control is a 44px button with text', /min-h-11[^"]*"[\s\S]{0,160}ArrowLeft/.test(screen) && /SUPPORT_TIIZI\.copy\.back/.test(screen));
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
