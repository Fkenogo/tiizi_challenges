/**
 * Phase 18I-6X Prompt 2 — Cause donation pledge flow guards.
 * Run: npx tsx scripts/testCauseDonationGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const challengeDetail = read('src/features/Challenges/ChallengeDetailScreen.tsx');
const donationSection = read('src/features/Challenges/components/ChallengeDonationSection.tsx');
const adminPending = read('src/features/Admin/AdminPendingChallengesScreen.tsx');
const adminChallengeService = read('src/services/adminChallengeService.ts');
const typesIndex = read('src/types/index.ts');
const createWizard = read('src/features/Challenges/CreateChallengeWizard.tsx');
const adminCreateScreen = read('src/features/Admin/Challenges/CreateChallengeScreen.tsx');
const donationService = read('src/services/donationService.ts');
const useDonations = read('src/hooks/useDonations.ts');

// ── Challenge donation type includes currency field ───────────────────────────
assert.match(
  typesIndex,
  /donation\?.*\{[\s\S]{0,700}currency\?.*string/,
  'Challenge.donation type must include optional currency field',
);

// ── ChallengeDonationSection: currency selector present ──────────────────────
assert.match(donationSection, /onCurrencyChange/, 'ChallengeDonationSection must accept onCurrencyChange prop');
assert.match(donationSection, /['"]KES['"]/, 'ChallengeDonationSection must list KES currency option');
assert.match(donationSection, /['"]RWF['"]/, 'ChallengeDonationSection must list RWF currency option');
assert.match(donationSection, /['"]UGX['"]/, 'ChallengeDonationSection must list UGX currency option');

// ── ChallengeDonationSection: no hardcoded KES label ─────────────────────────
assert.doesNotMatch(
  donationSection,
  /Target Contribution \(KES/,
  'ChallengeDonationSection must not have hardcoded "(KES" in target label',
);
assert.match(
  donationSection,
  /Target Contribution \(\{currency\}|Target Contribution.*\{currency\}/,
  'ChallengeDonationSection target label must use dynamic {currency}',
);

// ── ChallengeDonationSection: admin approval notice ──────────────────────────
assert.match(donationSection, /Admin approval required|admin review|admin approval/i, 'ChallengeDonationSection must include admin approval notice');
assert.match(donationSection, /hidden until approved|stay hidden|not yet visible|remain hidden/i, 'ChallengeDonationSection must explain details stay hidden until approved');
assert.match(donationSection, /Tiizi does not hold|does not hold.*funds/i, 'ChallengeDonationSection must clarify Tiizi does not hold cause funds');

// ── CreateChallengeWizard: currency state and payload ────────────────────────
assert.match(createWizard, /donationCurrency/, 'CreateChallengeWizard must have donationCurrency state');
assert.match(createWizard, /currency.*donationCurrency|donationCurrency.*currency/, 'CreateChallengeWizard must include currency in donation payload');
assert.match(createWizard, /onCurrencyChange.*setDonationCurrency|setDonationCurrency.*onCurrencyChange/, 'CreateChallengeWizard must wire onCurrencyChange to setDonationCurrency');

// ── Admin CreateChallengeScreen: currency state and payload ──────────────────
assert.match(adminCreateScreen, /donationCurrency/, 'Admin CreateChallengeScreen must have donationCurrency state');
assert.match(adminCreateScreen, /currency.*donationCurrency|donationCurrency.*currency/, 'Admin CreateChallengeScreen must include currency in donation payload');

// ── ChallengeDetailScreen: approvalStatus gate ───────────────────────────────
assert.match(
  challengeDetail,
  /approvalStatus.*===.*['"]approved['"]|['"]approved['"].*===.*approvalStatus/,
  'ChallengeDetailScreen must check donation.approvalStatus === "approved"',
);
assert.match(challengeDetail, /donationApproved/, 'ChallengeDetailScreen must use donationApproved variable');
assert.match(challengeDetail, /awaiting admin approval|Donation details are awaiting/, 'ChallengeDetailScreen must show pending notice to creator when not approved');
assert.match(challengeDetail, /isCreator/, 'ChallengeDetailScreen must gate pending notice behind isCreator');

// ── ChallengeDetailScreen: no immediate pledge on CTA click ──────────────────
// The "Support this Cause" button must call startPledgeFlow (sets step), not createContribution directly.
assert.match(challengeDetail, /startPledgeFlow/, 'ChallengeDetailScreen must use startPledgeFlow to begin pledge without immediately creating a record');
assert.doesNotMatch(
  challengeDetail,
  /Support this Cause[\s\S]{0,300}mutateAsync/,
  'Support this Cause CTA must not directly call mutateAsync',
);

// ── ChallengeDetailScreen: amount selection step present ─────────────────────
assert.match(challengeDetail, /selecting_amount/, 'ChallengeDetailScreen must have selecting_amount pledge step');
assert.match(challengeDetail, /pledgeCustom|pledgePreset/, 'ChallengeDetailScreen must track pledge amount state');
assert.match(challengeDetail, /pledgeAmount.*>.*0|Enter an amount greater than 0/, 'ChallengeDetailScreen must validate amount > 0');

// ── ChallengeDetailScreen: pledge record includes amount and currency ─────────
assert.match(challengeDetail, /pledgedAmount.*pledgeAmount|pledgeAmount.*pledgedAmount/, 'createContribution call must pass pledgedAmount');
assert.match(challengeDetail, /currency.*causeCurrency|causeCurrency.*currency/, 'createContribution call must pass currency');

// ── ChallengeDetailScreen: pledge status starts as pledged ───────────────────
assert.match(challengeDetail, /status.*['"]pledged['"]/, 'Pledge must be created with status "pledged"');

// ── ChallengeDetailScreen: confirm action (I've Sent My Contribution) ────────
assert.match(challengeDetail, /I've Sent My Contribution|markSent/, 'ChallengeDetailScreen must have confirm sent action');
assert.match(challengeDetail, /confirmChallengeContribution|confirmContribution/, 'ChallengeDetailScreen must call confirmChallengeContribution');

// ── donationService: confirmChallengeContribution sets status confirmed ───────
assert.match(donationService, /status.*['"]confirmed['"]/, 'confirmChallengeContribution must set status to confirmed');
assert.match(donationService, /confirmedAt/, 'confirmChallengeContribution must write confirmedAt');

// ── ChallengeContributionPledge type: new fields present ─────────────────────
assert.match(typesIndex, /pledgedAmount.*number/, 'ChallengeContributionPledge must have pledgedAmount field');
assert.match(typesIndex, /confirmedAt\?.*string/, 'ChallengeContributionPledge must have confirmedAt field');
assert.match(typesIndex, /status.*'confirmed'/, 'ChallengeContributionPledge status must include "confirmed"');

// ── ChallengeDetailScreen: approved gate protects payment details ─────────────
const approvedBlockStart = challengeDetail.indexOf('donationApproved ?');
const phoneIdx = challengeDetail.indexOf("I've Sent My Contribution", approvedBlockStart);
assert.ok(
  approvedBlockStart !== -1 && phoneIdx !== -1 && phoneIdx > approvedBlockStart,
  'Payment instructions ("I\'ve Sent My Contribution") must appear inside the donationApproved branch',
);

// ── ChallengeDetailScreen: unapproved phone hidden from participants ──────────
// The phone CTA must be inside donationApproved block (checked above via approvedBlockStart)
const unapprovedIdx = challengeDetail.indexOf('awaiting admin approval');
const phoneBeforeApprovalCheck = unapprovedIdx !== -1 && unapprovedIdx < approvedBlockStart;
assert.ok(!phoneBeforeApprovalCheck, 'Phone/payment must not appear before the donationApproved guard');

// ── ChallengeDetailScreen: multiple contributions allowed ─────────────────────
assert.match(challengeDetail, /Contribute Again/, 'ChallengeDetailScreen must allow contributing again');
assert.match(challengeDetail, /hasConfirmedContribution/, 'ChallengeDetailScreen must track hasConfirmedContribution for repeat-contribution UX');

// ── Success copy: no "payment successful" or "payment verified" ───────────────
assert.doesNotMatch(challengeDetail, /[Pp]ayment successful/, 'Must not say "payment successful"');
assert.doesNotMatch(challengeDetail, /[Pp]ayment verified/, 'Must not say "payment verified"');
assert.match(challengeDetail, /marked as sent|Contribution marked/i, 'Success copy must say "marked as sent"');

// ── Cause target displayed as total campaign target ───────────────────────────
assert.match(challengeDetail, /Cause target|cause target/i, 'ChallengeDetailScreen must show "Cause target" label');
assert.match(challengeDetail, /total/, 'Cause target label must include "total" to clarify campaign scope');

// ── AdminPendingChallengesScreen: no hardcoded KES ───────────────────────────
assert.doesNotMatch(adminPending, />\s*KES\s+\{|Target:\s*KES\s/, 'AdminPendingChallengesScreen must not show hardcoded "KES" in donation target');

// ── AdminPendingChallengesScreen: donation verification prompt ────────────────
assert.match(adminPending, /[Vv]erify.*[Bb]efore [Aa]pproving|[Vv]erify [Bb]efore/, 'AdminPendingChallengesScreen must prompt admin to verify before approving');
assert.match(adminPending, /contributionPhoneNumber/, 'AdminPendingChallengesScreen must display contributionPhoneNumber');
assert.match(adminPending, /contributionCardUrl/, 'AdminPendingChallengesScreen must display contributionCardUrl');
assert.match(adminPending, /approvalStatus/, 'AdminPendingChallengesScreen must display donation approvalStatus');

// ── adminChallengeService: approval sets donation.approvalStatus ──────────────
assert.match(adminChallengeService, /donation\.approvalStatus.*approved|['"]approved['"].*donation\.approvalStatus/, 'approveChallenge must set donation.approvalStatus to "approved"');
assert.match(adminChallengeService, /donation\.approvalStatus.*rejected|needs_changes/, 'requestChallengeChanges must reset donation.approvalStatus');

console.log('✅ All cause donation pledge flow guards passed.');
