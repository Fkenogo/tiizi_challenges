import type { ReactNode } from 'react';

interface SlideShellProps {
  imageUrl: string;
  title: string;
  body: string;
  current: number;
  total: number;
  /** Action buttons and any extra controls rendered below the body */
  children: ReactNode;
  /** Optional element rendered in the top-right corner (e.g. a Close button) */
  topRight?: ReactNode;
}

const FONT = "'Plus Jakarta Sans', sans-serif";

export function SlideShell({ imageUrl, title, body, current, total, children, topRight }: SlideShellProps) {
  return (
    <div
      className="relative h-screen w-full overflow-hidden flex flex-col"
      style={{ fontFamily: FONT }}
    >
      {/* Background image */}
      <img
        src={imageUrl}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 w-full h-full object-cover"
        style={{ zIndex: 0 }}
      />

      {/* Solid dark layer */}
      <div className="absolute inset-0" style={{ zIndex: 1, background: 'rgba(0,0,0,0.35)' }} />

      {/* Bottom-up gradient for text legibility */}
      <div
        className="absolute inset-0"
        style={{
          zIndex: 2,
          background: 'linear-gradient(to top, rgba(0,0,0,0.88) 0%, rgba(0,0,0,0.45) 45%, transparent 100%)',
        }}
      />

      {/* Top-right slot (e.g. Close button) */}
      {topRight && (
        <div className="absolute top-0 right-0" style={{ zIndex: 4, padding: '48px 20px 0' }}>
          {topRight}
        </div>
      )}

      {/* Content — anchored to bottom */}
      <div
        className="relative flex flex-col justify-end h-full w-full max-w-mobile mx-auto"
        style={{ zIndex: 3, paddingLeft: 24, paddingRight: 24, paddingBottom: 'calc(40px + env(safe-area-inset-bottom))' }}
      >
        <h1
          className="text-white"
          style={{ fontSize: 30, fontWeight: 700, lineHeight: '38px', letterSpacing: '-0.02em' }}
        >
          {title}
        </h1>

        <p
          className="text-white mt-4"
          style={{ fontSize: 15, fontWeight: 400, lineHeight: '22px', opacity: 0.9, whiteSpace: 'pre-line', maxWidth: 320 }}
        >
          {body}
        </p>

        {/* Progress dots */}
        <div className="flex gap-2 mt-8">
          {Array.from({ length: total }).map((_, idx) => (
            <div
              key={idx}
              style={{
                height: 6,
                width: idx === current ? 32 : 8,
                borderRadius: 9999,
                background: idx === current ? 'var(--primary)' : 'rgba(255,255,255,0.35)',
                transition: 'width 300ms ease, background 300ms ease',
              }}
            />
          ))}
        </div>

        {/* Caller-supplied action controls */}
        {children}
      </div>
    </div>
  );
}
