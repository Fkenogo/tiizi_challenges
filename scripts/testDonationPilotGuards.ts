/**
 * Phase 18I-6X — Support Tiizi donation guards (pilot text removed, frequency redesign).
 * Run: npx tsx scripts/testDonationPilotGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const donateScreen = read('src/features/Donate/DonateScreen.tsx');
const firestoreRules = read('firestore.rules');
const typesIndex = read('src/types/index.ts');
const donationService = read('src/services/donationService.ts');
const useDonations = read('src/hooks/useDonations.ts');

// ── Old wrong phone number must be gone ──────────────────────────────────────
assert.doesNotMatch(donateScreen, /0722361789/, 'DonateScreen must NOT contain old phone 0722361789');

// ── Old hardcoded MPESA constants must be gone ───────────────────────────────
assert.doesNotMatch(donateScreen, /RECEIVER_PHONE\s*=\s*['"`]/, 'DonateScreen must NOT have hardcoded RECEIVER_PHONE');
assert.doesNotMatch(donateScreen, /MPESA_USSD_CODE\s*=\s*['"`]/, 'DonateScreen must NOT have hardcoded MPESA_USSD_CODE');
assert.doesNotMatch(donateScreen, /MPESA_USSD_TEL_URI\s*=\s*['"`]/, 'DonateScreen must NOT have hardcoded MPESA_USSD_TEL_URI');

// ── Pilot fallback phone present ─────────────────────────────────────────────
assert.match(donateScreen, /\+250794003947/, 'DonateScreen must have pilot fallback phone +250794003947');

// ── Multi-currency: KES, RWF, UGX all present ────────────────────────────────
assert.match(donateScreen, /['"]KES['"]/, 'DonateScreen must support KES');
assert.match(donateScreen, /['"]RWF['"]/, 'DonateScreen must support RWF');
assert.match(donateScreen, /['"]UGX['"]/, 'DonateScreen must support UGX');

// ── PILOT_FALLBACK_CURRENCY defaults to KES (Kenya) ──────────────────────────
assert.match(
  donateScreen,
  /PILOT_FALLBACK_CURRENCY\s*=\s*['"]KES['"]/,
  'PILOT_FALLBACK_CURRENCY must default to KES',
);

// ── Per-currency preset amounts ───────────────────────────────────────────────
assert.match(donateScreen, /PRESET_AMOUNTS/, 'DonateScreen must define PRESET_AMOUNTS per currency');
assert.match(donateScreen, /KES.*\[.*100|100.*KES/, 'KES presets must include 100');
assert.match(donateScreen, /RWF.*\[.*1000|1000.*RWF/, 'RWF presets must include 1000');
assert.match(donateScreen, /UGX.*\[.*3000|3000.*UGX/, 'UGX presets must include 3000');

// ── Currency selector is user-controllable ────────────────────────────────────
assert.match(donateScreen, /selectedCurrency|handleCurrencyChange/, 'DonateScreen must have selectedCurrency state and handler');

// ── No hardcoded single-currency assumption in display ────────────────────────
assert.doesNotMatch(
  donateScreen,
  /PILOT_FALLBACK_CURRENCY\s*=\s*['"]RWF['"]/,
  'PILOT_FALLBACK_CURRENCY must not be RWF (it changed to KES for East Africa pilot)',
);

// ── Reads from Firestore admin settings ──────────────────────────────────────
assert.match(donateScreen, /getPlatformSupportSettings/, 'DonateScreen must call getPlatformSupportSettings');
assert.match(donateScreen, /adminDonationService/, 'DonateScreen must use adminDonationService');
assert.match(donateScreen, /mobileMoneyNumber/, 'DonateScreen must read mobileMoneyNumber from platform settings');
assert.match(donateScreen, /defaultCurrency|platformSettings.*currency/, 'DonateScreen must read defaultCurrency from platform settings');

// ── Currency stored on intent ─────────────────────────────────────────────────
assert.match(donationService, /currency.*input\.currency|input\.currency.*currency/, 'donationService must store currency on intent payload');
assert.match(useDonations, /currency\?:.*string/, 'useCreateSupportDonation input must accept currency field');
assert.match(useDonations, /one_time.*occasional|occasional.*one_time/, 'useCreateSupportDonation frequency must include one_time and occasional');
assert.doesNotMatch(useDonations, /goal_triggered/, 'useDonations must not reference goal_triggered');

// ── Card payment must be disabled / coming soon ──────────────────────────────
assert.doesNotMatch(donateScreen, /payments\.tiizi\.app/, 'DonateScreen must NOT route to payments.tiizi.app');
assert.match(donateScreen, /[Cc]oming soon|coming-soon/, 'DonateScreen must show "coming soon" for card payment');

// ── Multi-country payment copy ───────────────────────────────────────────────
assert.match(
  donateScreen,
  /Kenya.*Rwanda.*Uganda|Rwanda.*Kenya.*Uganda|Uganda.*Kenya.*Rwanda/i,
  'DonateScreen must mention Kenya, Rwanda, and Uganda in payment copy',
);

// ── No "pilot" in user-facing text ───────────────────────────────────────────
assert.doesNotMatch(donateScreen, /during the pilot/, 'DonateScreen must not contain "during the pilot"');
assert.doesNotMatch(donateScreen, /not available during pilot/, 'DonateScreen must not say "not available during pilot"');
assert.doesNotMatch(donateScreen, /Tap the number to dial/, 'DonateScreen must not say "Tap the number to dial"');

// ── Free + optional messaging present ────────────────────────────────────────
assert.match(donateScreen, /Tiizi remains free|remains free for everyone/i, 'DonateScreen must say Tiizi remains free');
assert.match(donateScreen, /[Ss]upport is completely optional|completely optional/i, 'DonateScreen must say support is completely optional');

// ── Frequency options: new set, goal_triggered removed ───────────────────────
assert.match(donateScreen, /one_time/, 'DonateScreen must have one_time frequency');
assert.match(donateScreen, /occasional/, 'DonateScreen must have occasional frequency');
assert.doesNotMatch(donateScreen, /goal_triggered/, 'DonateScreen must not have goal_triggered frequency');

// ── Intent-only: submit does not confirm ─────────────────────────────────────
assert.match(donateScreen, /return here and confirm|After sending payment.*return/i, 'DonateScreen must include return-here-and-confirm copy');

// ── SupportDonationSettings has multi-currency fields ────────────────────────
assert.match(typesIndex, /defaultCurrency\?.*string/, 'SupportDonationSettings must have defaultCurrency field');
assert.match(typesIndex, /supportedCurrencies\?.*string\[\]/, 'SupportDonationSettings must have supportedCurrencies field');
assert.match(typesIndex, /cardPaymentEnabled\?.*boolean/, 'SupportDonationSettings must have cardPaymentEnabled field');

// ── SupportDonation type stores currency ─────────────────────────────────────
assert.match(typesIndex, /SupportDonation[\s\S]{0,400}currency\?.*string/, 'SupportDonation type must store currency');

// ── Firestore rules: platformSettings/support scoped read ────────────────────
assert.match(firestoreRules, /match \/platformSettings\/\{/, 'firestore.rules must have platformSettings match block');
assert.match(firestoreRules, /settingId\s*==\s*["']support["']/, 'firestore.rules must scope reads to settingId == "support"');
assert.match(firestoreRules, /allow write.*isSuperAdmin\(\)/, 'firestore.rules must restrict platformSettings writes to super-admin');

console.log('✅ All Support Tiizi pilot donation guards passed (multi-currency).');
