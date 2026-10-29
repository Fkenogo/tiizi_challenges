/**
 * TIIZI-FER-P8A-001 — Support Tiizi content (PLACEHOLDER-COMPLETE, NOT PAYABLE).
 *
 * Single source for everything the Support Tiizi screen says. The wording is
 * PROPOSED and UNAPPROVED: it is drafted for Founder review (FDR-04, Q5) and
 * must not be treated as approved copy.
 *
 * Boundaries (FDR-04 / FD-PILOT-01 §16.3, §16.8):
 * - the Tiizi application processes nothing: no charge, pledge, subscription,
 *   receipt, total or confirmation, and nothing here is sent anywhere;
 * - recipient number, holder name and support WhatsApp contact are explicit
 *   non-payable placeholders. Real details may only be supplied by a later,
 *   separately authorized package (P8b) that also flips `activated`;
 * - this is a platform-level Profile journey, never a Challenge or Group
 *   setting and never a Cause.
 */
export const SUPPORT_TIIZI = {
  /** P8b flips this with Founder-verified details; until then nothing is actionable. */
  activated: false,
  title: 'Support Tiizi',
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
  amounts: [
    { id: '500', label: 'KES 500' },
    { id: '1000', label: 'KES 1,000' },
    { id: '2000', label: 'KES 2,000' },
    { id: '5000', label: 'KES 5,000' },
    { id: 'custom', label: 'Custom amount' },
  ],
  frequencyHeading: 'How often?',
  frequencyHint: 'Only a preference. This is not a subscription, and nothing repeats.',
  frequencies: [
    { id: 'once', label: 'Just once' },
    { id: 'occasionally', label: 'Occasionally, whenever able' },
    { id: 'monthly', label: 'Monthly' },
    { id: 'annually', label: 'Annually' },
  ],
  previewNote: 'This is only a preview of the choices. Nothing is saved, charged or sent.',
  detailsHeading: 'How to send support',
  detailsIntro: 'Mobile-money details will appear here once they have been confirmed.',
  placeholderMark: 'Placeholder – not payable',
  placeholders: [
    { id: 'recipient', label: 'Recipient number' },
    { id: 'holder', label: 'Account holder name' },
    { id: 'whatsapp', label: 'Support WhatsApp' },
  ],
  back: 'Back',
} as const;
