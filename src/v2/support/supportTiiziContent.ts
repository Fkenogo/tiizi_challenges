/**
 * TIIZI-FER-P8A — Support Tiizi content (PLACEHOLDER-COMPLETE, NOT PAYABLE).
 *
 * Three tiers, kept apart on purpose:
 *
 * 1. FOUNDER-APPROVED constants (recorded in TIIZI-FER-P8A-CORR-002): KES, the
 *    four suggested amounts, a custom amount option, the four frequency
 *    choices and the manual mobile-money operating model. Changing these needs
 *    a Founder decision.
 * 2. FOUNDER-SUPPLIED details, PENDING: recipient number, account-holder name
 *    and support WhatsApp contact. The Founder supplies them separately. They
 *    are not invented or inferred here; each stays an explicit non-payable
 *    placeholder with a `null` value that no screen reads. Real values may only
 *    arrive with the separately authorized, independently verified P8b
 *    activation, which also flips `activated`.
 * 3. PROPOSED explanatory wording (everything under `SUPPORT_TIIZI.copy`,
 *    including the title): still subject to Founder experience review; not
 *    approved copy. Frequency labels follow the FDR-04 wording.
 *
 * Boundaries (FDR-04 / FD-PILOT-01 §16.3, §16.8): the Tiizi application
 * processes nothing; no charge, pledge, subscription, recurring transfer,
 * receipt, total or confirmation; this is a platform-level Profile journey,
 * never a Group or Challenge setting and never a Cause.
 */

/** 1. Founder-approved constants. */
export const FOUNDER_APPROVED = {
  currency: 'KES',
  suggestedAmounts: [500, 1000, 2000, 5000],
  customAmount: true,
  frequencies: [
    { id: 'once', label: 'Just once' },
    { id: 'occasionally', label: 'Occasionally, whenever able' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'annually', label: 'Annually' },
  ],
  operatingModel: 'manual-mobile-money',
} as const;

/** 2. Founder-supplied details, pending. `value` stays null until P8b; no screen reads it. */
export const FOUNDER_SUPPLIED_PENDING: ReadonlyArray<{ id: string; label: string; value: null }> = [
  { id: 'recipient', label: 'Recipient number', value: null },
  { id: 'holder', label: 'Account holder name', value: null },
  { id: 'whatsapp', label: 'Support WhatsApp', value: null },
];

const amountLabel = (amount: number) => `${FOUNDER_APPROVED.currency} ${amount.toLocaleString('en-US')}`;

export const SUPPORT_TIIZI = {
  /** P8b flips this with Founder-verified details; until then nothing is actionable. */
  activated: false,
  // Tier 1, derived from FOUNDER_APPROVED (labels are formatting of approved values).
  amounts: [
    ...FOUNDER_APPROVED.suggestedAmounts.map((amount) => ({ id: String(amount), label: amountLabel(amount) })),
    ...(FOUNDER_APPROVED.customAmount ? [{ id: 'custom', label: 'Custom amount' }] : []),
  ],
  frequencies: FOUNDER_APPROVED.frequencies,
  // Tier 2: pending Founder-supplied details (null placeholders; no screen reads `value`).
  placeholders: FOUNDER_SUPPLIED_PENDING,
  /**
   * Tier 3: PROPOSED wording, pending Founder experience review. This includes
   * the screen title and the "Placeholder – not payable" mark (a required
   * non-payable label per the P8a plan, not a Founder-approved sentence).
   */
  copy: {
    title: 'Support Tiizi',
    placeholderMark: 'Placeholder – not payable',
    profileCard: {
      heading: 'Support Tiizi',
      body: 'Tiizi is free to use. See how you can choose to support the platform.',
      action: 'View Support Tiizi',
    },
    lead: 'Tiizi is free to use. Taking part in Groups and Challenges, and your results, never depend on supporting Tiizi.',
    about: 'Support Tiizi is voluntary and is for the Tiizi platform. It is separate from any Group or Challenge, and it never changes a Challenge, a Group or your results.',
    status: "Supporting Tiizi isn't open yet. You can look at the choices below, but nothing can be sent, charged or recorded here.",
    amountsHeading: 'Suggested amounts',
    amountsHint: 'These are suggestions only. Choose any amount you are comfortable with.',
    frequencyHeading: 'How often?',
    frequencyHint: 'Only a preference. This is not a subscription, and nothing repeats.',
    previewNote: 'This is only a preview of the choices. Nothing is saved, charged or sent.',
    detailsHeading: 'Mobile-money details',
    detailsIntro: 'These details are placeholders and cannot be used to send support.',
    back: 'Back',
  },
} as const;
