/**
 * Phase 18I-6Y Follow-up 3 — Cause campaign currency source-of-truth guards.
 * Run: npx tsx scripts/testAdminDonationCurrencySourceGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const adminService = read('src/services/adminDonationService.ts');
const campaignsScreen = read('src/features/Admin/Donations/DonationCampaignsScreen.tsx');
const wizard = read('src/features/Challenges/CreateChallengeWizard.tsx');
const seedScript = read('scripts/seedAppData.ts');
const challengeTypes = read('src/types/index.ts');

// ── Challenge type declares donation.currency field ────────────────────────
assert.match(challengeTypes, /currency\?\s*:\s*string/, 'Challenge type must declare donation.currency field (as currency?: string)');

// ── Admin service reads challenge.donation.currency ─────────────────────────
assert.match(adminService, /donation\?\.currency/, 'adminDonationService must read donation?.currency from challenge doc');
assert.match(adminService, /donation\?\.currency.*\?\?|String\(donation\?\.currency/, 'adminDonationService must use challenge donation.currency as primary source for campaign currency');

// ── Fallback order: challenge.donation.currency → pledge currency → KES ────
assert.match(adminService, /donation\?\.currency[\s\S]{0,100}stats\.currency|donation\?\.currency[\s\S]{0,100}'KES'/, 'adminDonationService must fall back from donation.currency before using pledge currency or KES');
assert.doesNotMatch(adminService, /currency:\s*['"]KES['"][\s\S]{0,20}\/\/ cause campaign/, 'adminDonationService must not hardcode KES for cause campaigns');

// ── Campaign currency displayed from campaign.currency, not hardcoded ──────
assert.match(campaignsScreen, /campaign\.currency/, 'DonationCampaignsScreen must use campaign.currency for cause campaign display');
assert.doesNotMatch(campaignsScreen, /Campaign currency.*['"]KES['"]|['"]KES['"].*Campaign currency/, 'DonationCampaignsScreen must not hardcode KES as campaign currency label');

// ── Wizard: loadTemplate restores donationCurrency from template ────────────
assert.match(wizard, /setDonationCurrency/, 'CreateChallengeWizard must have a setDonationCurrency call');
assert.match(wizard, /template\.donation\.currency|template\.donation\?\.currency/, 'CreateChallengeWizard loadTemplate must read template.donation.currency when restoring donation state');
assert.match(wizard, /setDonationCurrency[\s\S]{0,200}template\.donation/, 'CreateChallengeWizard must call setDonationCurrency when loading a template with donation enabled');

// ── Wizard: donation payload saves currency correctly ──────────────────────
assert.match(wizard, /currency:\s*donationCurrency/, 'CreateChallengeWizard donation payload must save donationCurrency to challenge doc');

// ── Seed data: collective challenges include currency and correct field name ─
assert.match(seedScript, /targetAmountKes/, 'seedAppData must use targetAmountKes (not targetAmount) for challenge donation');
assert.doesNotMatch(seedScript, /targetAmount:\s*\d+[\s\S]{0,20}causeDescription|causeDescription[\s\S]{0,20}targetAmount:\s*\d+/, 'seedAppData must not use targetAmount (legacy field name) without the Kes suffix in donation context');
assert.match(seedScript, /currency.*KES|KES.*currency/, 'seedAppData seed collective challenges must include donation.currency field');
assert.match(seedScript, /causeName/, 'seedAppData seed collective challenges must include donation.causeName field');
assert.match(seedScript, /approvalStatus.*approved|approved.*approvalStatus/, 'seedAppData seed collective challenges must include approvalStatus: approved');

// ── No cause campaign defaults to KES before checking challenge.donation ────
assert.doesNotMatch(adminService, /currency:\s*['"]KES['"][\s\S]{0,50}challenge_cause|challenge_cause[\s\S]{0,200}currency:\s*['"]KES['"]/, 'adminDonationService must not hardcode KES currency for challenge_cause campaigns');

// ── Target amount reads targetAmountKes ───────────────────────────────────
assert.match(adminService, /targetAmountKes/, 'adminDonationService must read targetAmountKes from challenge donation object');

console.log('✅ All cause campaign currency source guards passed.');
