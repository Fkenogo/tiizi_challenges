/**
 * TIIZI-FER-P1A-001 — the four public welcome slides.
 *
 * Product copy is Founder-specified (Experience Recovery Baseline 001 §B.1).
 * It describes Tiizi only: no migration or third-party-messaging narrative.
 */
export interface WelcomeSlide {
  id: 'together' | 'people' | 'challenge' | 'effort';
  title: string;
  body: string;
}

export const WELCOME_SLIDES: readonly WelcomeSlide[] = [
  {
    id: 'together',
    title: 'Move better, together',
    body: 'Tiizi is a voluntary group fitness and wellness community. Move at your own pace, with people who keep you accountable.',
  },
  {
    id: 'people',
    title: 'Find your people',
    body: 'Join a Group that fits you, or create your own. Groups are where encouragement and accountability happen.',
  },
  {
    id: 'challenge',
    title: 'Take on a Challenge',
    body: 'Together: everyone adds to one shared goal. Race: finishing order matters. Streak: show up every day.',
  },
  {
    id: 'effort',
    title: 'Every effort counts',
    body: 'Log what you do, see your progress, and cheer each other on.',
  },
] as const;

export const WELCOME_PATH = '/v2/welcome';
