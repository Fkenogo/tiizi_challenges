import { V2Placeholder } from '../components/V2Placeholder';

/**
 * TIIZI S1 — Operator placeholder surfaces.
 *
 * Desktop-first console, bounded placeholders. No operator
 * authority/RBAC is implemented: every surface states intent only.
 * Operator copy may name the section plainly; member-facing jargon
 * rules do not apply here, but no real data is shown.
 */

type OperatorPageSpec = {
  title: string;
  explanation: string;
  emptyTitle: string;
  emptyMessage: string;
};

const PAGES: Record<string, OperatorPageSpec> = {
  overview: {
    title: 'Overview',
    explanation: 'The health of Tiizi at a glance — what needs attention first, and where things stand.',
    emptyTitle: 'Overview is getting ready',
    emptyMessage: 'Live platform signals will appear here once the console is connected. For now, browse the sections on the left.',
  },
  users: {
    title: 'Users',
    explanation: 'Find members, see how they are doing, and help when something goes wrong.',
    emptyTitle: 'User tools arrive in a later slice',
    emptyMessage: 'Search, profiles, and support actions will live here. Nothing here changes member data yet.',
  },
  groups: {
    title: 'Groups',
    explanation: 'See how groups are doing and step in when a group needs help.',
    emptyTitle: 'Group tools arrive in a later slice',
    emptyMessage: 'Group health, requests, and moderation queues will live here.',
  },
  activities: {
    title: 'Activities & Knowledge',
    explanation: 'The shared library of activities and know-how that powers challenges and the guide.',
    emptyTitle: 'Knowledge tools arrive in a later slice',
    emptyMessage: 'Reviewing and publishing activities will live here.',
  },
  challenges: {
    title: 'Challenges',
    explanation: 'Follow live and upcoming challenges and spot the ones that need a nudge.',
    emptyTitle: 'Challenge tools arrive in a later slice',
    emptyMessage: 'Challenge oversight and interventions will live here.',
  },
  templates: {
    title: 'Templates',
    explanation: 'Reusable starting points that help members create great challenges in minutes.',
    emptyTitle: 'Template tools arrive in a later slice',
    emptyMessage: 'Drafting, review, and publishing of templates will live here.',
  },
  review: {
    title: 'Review & Attention',
    explanation: 'One queue for everything waiting on a human decision — oldest and riskiest first.',
    emptyTitle: 'Nothing waiting right now',
    emptyMessage: 'When members submit something for review, it will queue up here.',
  },
  support: {
    title: 'Donations & Support',
    explanation: 'How members support Tiizi, and where that support goes.',
    emptyTitle: 'Support tools arrive in a later slice',
    emptyMessage: 'Campaigns, contributions, and support messages will live here.',
  },
  content: {
    title: 'Content & Localisation',
    explanation: 'Words, languages, and pages — keeping Tiizi clear and welcoming for everyone.',
    emptyTitle: 'Content tools arrive in a later slice',
    emptyMessage: 'Languages, onboarding copy, and content pages will live here.',
  },
  access: {
    title: 'Access & Roles',
    explanation: 'Who can do what inside the console. Roles are read-only in this preview.',
    emptyTitle: 'Access stays locked in this preview',
    emptyMessage: 'Role assignment is intentionally disabled until operator authority is implemented.',
  },
  health: {
    title: 'Platform Health',
    explanation: 'Is Tiizi running well? Signals and incidents live here.',
    emptyTitle: 'No incidents to show',
    emptyMessage: 'Service signals will appear here once the console is connected.',
  },
  audit: {
    title: 'Audit Log',
    explanation: 'A tamper-evident trail of who did what, and when.',
    emptyTitle: 'No audited actions yet',
    emptyMessage: 'Every console action will be recorded here once authority is implemented.',
  },
  settings: {
    title: 'Settings',
    explanation: 'Console preferences and platform defaults.',
    emptyTitle: 'Settings arrive in a later slice',
    emptyMessage: 'Nothing here changes the platform yet.',
  },
};

export function V2OperatorPage({ section }: { section: keyof typeof PAGES }) {
  const spec = PAGES[section];
  return (
    <V2Placeholder
      wide
      eyebrow="Operator"
      title={spec.title}
      explanation={`${spec.explanation} This preview shows intent only — no permissions are granted and no data is changed.`}
      emptyTitle={spec.emptyTitle}
      emptyMessage={spec.emptyMessage}
      nextSlice="Operator surfaces (S9)"
    />
  );
}

export const V2_OPERATOR_SECTIONS = Object.keys(PAGES);
