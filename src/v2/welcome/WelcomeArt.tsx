import type { WelcomeSlide } from './welcomeContent';

/**
 * Original, dependency-free slide artwork (inline SVG, authored for Tiizi).
 * Simple shapes in the brand palette; decorative only (aria-hidden).
 */
const ORANGE = '#ff6b00';
const SOFT = '#ffe7d6';
const SLATE = '#0f172a';

export function WelcomeArt({ id }: { id: WelcomeSlide['id'] }) {
  return (
    <svg viewBox="0 0 220 150" className="h-full w-full" aria-hidden="true" focusable="false">
      <rect x="0" y="0" width="220" height="150" rx="24" fill={SOFT} />
      {id === 'together' && (
        <g>
          <circle cx="78" cy="58" r="16" fill={ORANGE} />
          <path d="M52 112c0-18 11-30 26-30s26 12 26 30" fill={ORANGE} />
          <circle cx="142" cy="58" r="16" fill={SLATE} />
          <path d="M116 112c0-18 11-30 26-30s26 12 26 30" fill={SLATE} />
          <path d="M96 34c10-12 28-12 38 0" stroke={ORANGE} strokeWidth="5" strokeLinecap="round" fill="none" />
        </g>
      )}
      {id === 'people' && (
        <g>
          <g stroke={ORANGE} strokeWidth="4" strokeLinecap="round">
            <path d="M110 75 60 50M110 75l50-25M110 75 70 110M110 75l40 35" />
          </g>
          <circle cx="110" cy="75" r="18" fill={ORANGE} />
          <circle cx="60" cy="50" r="11" fill={SLATE} />
          <circle cx="160" cy="50" r="11" fill={SLATE} />
          <circle cx="70" cy="110" r="11" fill={SLATE} />
          <circle cx="150" cy="110" r="11" fill={SLATE} />
        </g>
      )}
      {id === 'challenge' && (
        <g>
          <circle cx="62" cy="75" r="26" fill="none" stroke={ORANGE} strokeWidth="6" />
          <circle cx="62" cy="75" r="9" fill={ORANGE} />
          <path d="M104 106V56m0 0 22 12-22 12" stroke={SLATE} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <g fill={ORANGE}>
            <rect x="146" y="92" width="10" height="20" rx="3" />
            <rect x="162" y="76" width="10" height="36" rx="3" />
            <rect x="178" y="58" width="10" height="54" rx="3" />
          </g>
        </g>
      )}
      {id === 'effort' && (
        <g>
          <path d="M40 112 80 86l30 14 40-40 30 12" stroke={ORANGE} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          <circle cx="180" cy="72" r="7" fill={ORANGE} />
          <path d="M110 44c-6-12-24-8-24 6 0 10 12 16 24 26 12-10 24-16 24-26 0-14-18-18-24-6z" fill={SLATE} />
        </g>
      )}
    </svg>
  );
}
