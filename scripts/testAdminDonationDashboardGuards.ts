/**
 * Phase 18I-6Y — Admin Donation Campaign Management guards.
 * Run: npx tsx scripts/testAdminDonationDashboardGuards.ts
 */
import * as assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (rel: string) => readFileSync(resolve(root, rel), 'utf8');

const campaignsScreen = read('src/features/Admin/Donations/DonationCampaignsScreen.tsx');
const reportsScreen = read('src/features/Admin/Donations/DonationReportsScreen.tsx');
const adminService = read('src/services/adminDonationService.ts');
const adminHooks = read('src/hooks/useAdminDonations.ts');
const challengeDetail = read('src/features/Challenges/ChallengeDetailScreen.tsx');

// ── Platform vs Cause campaigns separated ──────────────────────────────────
assert.match(adminService, /platform_support.*challenge_cause|challenge_cause.*platform_support/s, 'adminDonationService must distinguish platform_support and challenge_cause sources');
assert.match(campaignsScreen, /platform_support.*challenge_cause|challenge_cause.*platform_support/s, 'DonationCampaignsScreen must have platform_support and challenge_cause filter options');
assert.match(campaignsScreen, /platform_support/, 'DonationCampaignsScreen must filter by platform_support');
assert.match(campaignsScreen, /filter.*challenge_cause|challenge_cause.*filter/i, 'DonationCampaignsScreen must filter by challenge_cause');

// ── Legacy campaigns excluded from Platform Support ───────────────────────
assert.match(adminService, /source.*legacy|legacy.*source/s, 'adminDonationService must mark donationCampaigns collection docs as legacy source');
assert.match(adminService, /'legacy' as const/, 'donationCampaigns collection docs must be classified as legacy source (not platform_support)');

// ── Confirmed totals only count status === confirmed ──────────────────────
assert.match(adminService, /status.*===.*['"]confirmed['"]/, 'adminDonationService must filter confirmed pledges by status === "confirmed"');
assert.match(adminService, /confirmedAmount/, 'adminDonationService must track confirmedAmount separate from pendingAmount');
assert.match(adminService, /pendingAmount/, 'adminDonationService must track pendingAmount');
assert.doesNotMatch(adminService, /status\s*!==\s*['"]pledged['"][\s\S]{0,50}confirmed/, 'confirmed totals must not include pledged status');

// ── Pending pledges count status === pledged ──────────────────────────────
assert.match(adminService, /status.*===.*['"]pledged['"]/, 'adminDonationService must aggregate pledged status for pending amounts');

// ── KPI cards present in campaigns screen ─────────────────────────────────
assert.match(campaignsScreen, /Active campaigns|active.*campaigns/i, 'DonationCampaignsScreen must show active campaigns KPI');
assert.match(campaignsScreen, /Confirmed raised|confirmedAmount/i, 'DonationCampaignsScreen must show confirmed raised KPI');
assert.match(campaignsScreen, /Pending|pendingAmount/, 'DonationCampaignsScreen must show pending pledges KPI');
assert.match(campaignsScreen, /contributors|contributorCount/i, 'DonationCampaignsScreen must show contributors KPI');
assert.match(campaignsScreen, /Platform support|platform.*support/i, 'DonationCampaignsScreen must show platform support KPI');
assert.match(campaignsScreen, /Cause campaigns|cause.*campaigns/i, 'DonationCampaignsScreen must show cause campaigns KPI');

// ── Campaign status actions: pause / resume / complete / suspend ─────────
assert.match(campaignsScreen, /[Pp]ause/, 'DonationCampaignsScreen must have Pause action');
assert.match(campaignsScreen, /[Rr]esume/, 'DonationCampaignsScreen must have Resume action');
assert.match(campaignsScreen, /[Cc]omplete|Mark Completed/, 'DonationCampaignsScreen must have Complete action');
assert.match(campaignsScreen, /[Ss]uspend/, 'DonationCampaignsScreen must have Suspend action');
assert.match(adminService, /updateCampaignStatus/, 'adminDonationService must have updateCampaignStatus method');
assert.match(adminHooks, /useUpdateCampaignStatus/, 'useAdminDonations must export useUpdateCampaignStatus hook');

// ── No deletion action ────────────────────────────────────────────────────
assert.doesNotMatch(campaignsScreen, /[Dd]elete.*[Cc]ampaign|[Cc]ampaign.*[Dd]elete/, 'DonationCampaignsScreen must not have a delete campaign action');
assert.doesNotMatch(adminService, /deleteCampaign|removeChallenge/, 'adminDonationService must not have delete campaign method');

// ── Campaign detail view exists ───────────────────────────────────────────
assert.match(campaignsScreen, /CampaignDetailPanel|[Dd]etail.*[Pp]anel/, 'DonationCampaignsScreen must have a campaign detail view');
assert.match(campaignsScreen, /View Details|viewDetails/, 'DonationCampaignsScreen must have View Details button');

// ── Contribution list includes required fields ────────────────────────────
assert.match(campaignsScreen, /pledgedAmount|[Aa]mount/, 'Campaign detail contribution list must show amount');
assert.match(campaignsScreen, /currency/, 'Campaign detail contribution list must show currency');
assert.match(campaignsScreen, /status.*pledged|pledged.*status/i, 'Campaign detail contribution list must show pledge status');
assert.match(campaignsScreen, /createdAt|Pledged/, 'Campaign detail contribution list must show created date');
assert.match(campaignsScreen, /confirmedAt|[Cc]onfirmed/, 'Campaign detail contribution list must show confirmed date');

// ── UI avoids "payment verified" / "payment successful" ──────────────────
assert.doesNotMatch(campaignsScreen, /[Pp]ayment verified/, 'DonationCampaignsScreen must not say "payment verified"');
assert.doesNotMatch(campaignsScreen, /[Pp]ayment successful/, 'DonationCampaignsScreen must not say "payment successful"');
assert.doesNotMatch(reportsScreen, /[Pp]ayment verified/, 'DonationReportsScreen must not say "payment verified"');
assert.doesNotMatch(reportsScreen, /[Pp]ayment successful/, 'DonationReportsScreen must not say "payment successful"');

// ── "Marked as sent" / self-reported copy present ────────────────────────
assert.match(campaignsScreen, /[Mm]arked as sent|self.report/i, 'DonationCampaignsScreen must use "marked as sent" terminology');

// ── Cause campaign target treated as total campaign target ────────────────
assert.match(campaignsScreen, /total/, 'Campaign display must clarify target is total campaign amount');
assert.match(adminService, /targetAmountKes|goalAmount/, 'adminDonationService must track campaign target/goalAmount');

// ── No unapproved payment details exposed ────────────────────────────────
// The campaigns screen must note that payment details are subject to approval
assert.match(campaignsScreen, /approval|Tiizi does not verify/i, 'DonationCampaignsScreen must note payment details require approval or Tiizi does not verify');

// ── DonationTransaction status uses correct terminology ──────────────────
assert.match(adminService, /confirmed_by_user/, 'adminDonationService transactions must use confirmed_by_user status (not "success" for manual payments)');
assert.doesNotMatch(adminService, /status.*success.*cause|challenge_cause.*success/, 'Cause pledge transactions must not use "success" status');

// ── Per-currency breakdowns (no hardcoded KES in summary rendering) ───────
assert.match(adminService, /confirmedByCurrency/, 'adminDonationService must track confirmedByCurrency breakdown');
assert.match(adminService, /pendingByCurrency/, 'adminDonationService must track pendingByCurrency breakdown');
assert.match(campaignsScreen, /confirmedByCurrency/, 'DonationCampaignsScreen must use confirmedByCurrency in summary rendering');
assert.match(campaignsScreen, /pendingByCurrency/, 'DonationCampaignsScreen must use pendingByCurrency in summary rendering');
assert.match(campaignsScreen, /CurrencyBreakdown/, 'DonationCampaignsScreen must use a CurrencyBreakdown component');
assert.match(campaignsScreen, /See currency breakdown/, 'DonationCampaignsScreen must show "See currency breakdown" when remaining is unreliable due to mixed currencies');
assert.match(campaignsScreen, /campaign\.currency.*toLocaleString|confirmedByCurrency/s, 'Cause campaign confirmed amount must use per-currency breakdown, not hardcoded currency');

// ── Platform Support: no hardcoded KES amounts / no single total pretending it is KES ──
assert.match(adminService, /platformConfirmedByCurrency|confirmedByCurrency.*platform|platform.*confirmedByCurrency/s, 'Platform support campaign must compute per-currency confirmed breakdown');
assert.doesNotMatch(adminService, /currency.*'KES'[\s\S]{0,5}goalAmount.*0[\s\S]{0,100}confirmedAmount/s, 'Platform support campaign currency field must not be hardcoded to KES while being used as a single total');
assert.match(campaignsScreen, /mixed.*currencies|KES.*RWF.*UGX|currencies.*mixed/i, 'Platform Support detail must note mixed currencies instead of showing a single KES total');

// ── Platform Support records: table always rendered with headers ──────────
assert.match(campaignsScreen, /No support records yet.*When users|When users.*No support records/s, 'Platform Support empty state must explain what will be tracked');
assert.match(campaignsScreen, /self-reported until payment integration/, 'Platform Support records must include admin note about self-reporting');
assert.match(campaignsScreen, /Created[\s\S]{0,200}Confirmed|Confirmed[\s\S]{0,200}Created/s, 'Platform Support table must have Created and Confirmed date columns');
assert.match(campaignsScreen, /Currency[\s\S]{0,200}Frequency|Frequency[\s\S]{0,200}Currency/s, 'Platform Support table must have Currency and Frequency columns');

// ── User identity resolved (display name + email, not raw userId) ─────────
assert.match(adminService, /getUserDisplayMap/, 'adminDonationService must have getUserDisplayMap for resolving contributor identities');
assert.match(adminService, /displayName/, 'adminDonationService must resolve displayName for pledge contributors');
assert.match(campaignsScreen, /displayName|donorName/, 'DonationCampaignsScreen contribution rows must show display name, not raw userId');

// ── Platform Support detail view (supportDonations records) ──────────────
assert.match(adminService, /getPlatformSupportForDetail/, 'adminDonationService must have getPlatformSupportForDetail for platform support records');
assert.match(adminHooks, /usePlatformSupportForDetail/, 'useAdminDonations must export usePlatformSupportForDetail hook');
assert.match(campaignsScreen, /platform_support[\s\S]{0,400}supportRecords|supportRecords[\s\S]{0,400}platform_support/s, 'DonationCampaignsScreen must render platform support records in detail panel');

// ── Cause campaign duration (timingStartDate / timingEndDate) ─────────────
assert.match(adminService, /timingStartDate|timingEndDate/, 'adminDonationService DonationCampaign must include timing dates');
assert.match(adminService, /isExpired/, 'adminDonationService must compute isExpired for expired cause campaigns');
assert.match(campaignsScreen, /timingEndDate|timingStartDate/, 'DonationCampaignsScreen must display campaign timing dates in detail panel');
assert.match(challengeDetail, /isExpired/, 'ChallengeDetailScreen must compute isExpired from timingEndDate');

// ── getChallengePledgesForAdmin present ───────────────────────────────────
assert.match(adminService, /getChallengePledgesForAdmin/, 'adminDonationService must have getChallengePledgesForAdmin method');
assert.match(adminHooks, /useChallengePledgesAdmin/, 'useAdminDonations must export useChallengePledgesAdmin hook');

// ── Campaign status enforcement on user-facing challenge detail ───────────
assert.match(challengeDetail, /campaignSuspended|campaignStatus.*paused|paused.*campaignStatus/, 'ChallengeDetailScreen must enforce campaign paused/suspended status');
assert.match(challengeDetail, /temporarily unavailable|Support.*unavailable/i, 'ChallengeDetailScreen must show unavailable message when campaign is paused/suspended');

// ── Reports screen: no hardcoded KES for totals ───────────────────────────
assert.doesNotMatch(reportsScreen, /totalDonationsAllTime[\s\S]{0,20}KES/, 'DonationReportsScreen must not hardcode KES next to all-time total');
assert.match(reportsScreen, /mixed currencies|currency/, 'DonationReportsScreen must note mixed currencies');

console.log('✅ All admin donation dashboard guards passed.');
