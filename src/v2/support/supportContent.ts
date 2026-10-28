/**
 * TIIZI — V2 Experience Recovery 001: Support Tiizi member-facing content.
 *
 * Product Truth: Tiizi is free to use (T1 §V.1); Support Tiizi is voluntary
 * and separate from participation (§V.2, FR-V2-153/154/159); it must not
 * affect eligibility, Activity, progress, completion, ranking, Streak or
 * Recognition (FR-V2-160); contributions are intended for the Tiizi Platform
 * and distinct from any Challenge cause (FR-V2-161); no payment provider is
 * selected or implied (FR-V2-162).
 *
 * This is an INFORMATION-ONLY journey. It collects nothing, records nothing
 * and executes no contribution. It states no amount, destination, provider,
 * total, goal or progress. Contribution execution is a separate Founder
 * decision and is intentionally absent.
 */

/** Founder-confirmed Tiizi contact (mailbox handling is confirmed separately). */
export const SUPPORT_CONTACT_EMAIL = 'support@tiizichallenges.com';

export const SUPPORT_PATH = '/v2/support';

export interface SupportSection {
  id: string;
  title: string;
  body: string;
}

export const SUPPORT_HEADLINE = {
  eyebrow: 'Support Tiizi',
  title: 'Tiizi is free. Support is a choice.',
  description:
    'Tiizi is free to use. Supporting it is entirely voluntary, and it never changes your experience.',
};

export const SUPPORT_SECTIONS: readonly SupportSection[] = [
  {
    id: 'free',
    title: 'Free to use',
    body: 'Joining Groups, taking part in Challenges and logging your activities does not cost anything.',
  },
  {
    id: 'voluntary',
    title: 'Supporting Tiizi is voluntary',
    body: 'If Tiizi helps you and your people move, you may choose to support it. It is always your decision, with no pressure and no minimum.',
  },
  {
    id: 'no-effect',
    title: 'It never affects your experience',
    body: 'Supporting Tiizi never affects Group membership, Challenge participation, progress, ranking or results. Members who do not support Tiizi are treated exactly the same.',
  },
  {
    id: 'separate',
    title: 'Separate from supporting a cause',
    body: 'A Challenge may one day name a cause that its creator cares about. Supporting Tiizi, the platform, is separate. Contributions to Tiizi are intended for the Tiizi platform and are kept distinct from any cause.',
  },
] as const;

export const SUPPORT_STATUS = {
  title: 'Contributions are not open yet',
  body: 'There is nothing to pay and nothing to set up. If ways to support Tiizi are offered, you will find them here, with the details clearly explained first.',
};

export const SUPPORT_NEXT_STEP = {
  title: 'Questions or ideas?',
  body: 'If you would like to talk about supporting Tiizi, email us.',
};

/** Short summary shown on the Profile card. */
export const SUPPORT_PROFILE_CARD = {
  title: 'Support Tiizi',
  body: 'Tiizi is free to use. Supporting it is voluntary and never affects your Groups, Challenges, progress or results.',
  action: 'About supporting Tiizi',
};
