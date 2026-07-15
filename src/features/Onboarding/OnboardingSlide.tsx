import type { IntroSlide } from './onboardingData';
import { SlideShell } from './SlideShell';

interface Props {
  slide: IntroSlide;
  current: number;
  total: number;
  isLast: boolean;
  saving: boolean;
  onNext: () => void;
  onSkip: () => void;
}

const FONT = "'Plus Jakarta Sans', sans-serif";

export function OnboardingSlide({ slide, current, total, isLast, saving, onNext, onSkip }: Props) {
  return (
    <SlideShell
      imageUrl={slide.imageUrl}
      title={slide.title}
      body={slide.body}
      current={current}
      total={total}
    >
      <div className="flex flex-col gap-3 mt-8">
        <button
          onClick={onNext}
          disabled={saving}
          style={{
            width: '100%',
            height: 56,
            borderRadius: 14,
            background: saving ? 'rgba(255,107,0,0.6)' : 'var(--primary)',
            color: '#fff',
            fontFamily: FONT,
            fontSize: 16,
            fontWeight: 700,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            cursor: saving ? 'default' : 'pointer',
            boxShadow: '0 8px 24px rgba(255,107,0,0.35)',
            transition: 'opacity 200ms ease, transform 100ms ease',
            WebkitTapHighlightColor: 'transparent',
          }}
          onMouseDown={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
          onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
          onTouchStart={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(0.97)'; }}
          onTouchEnd={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = 'scale(1)'; }}
        >
          {saving ? 'Setting up…' : isLast ? 'Get Started' : 'Next →'}
        </button>

        {!isLast && (
          <button
            onClick={onSkip}
            style={{
              width: '100%',
              height: 52,
              borderRadius: 14,
              background: 'rgba(255,255,255,0.12)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: 'rgba(255,255,255,0.85)',
              fontFamily: FONT,
              fontSize: 15,
              fontWeight: 600,
              border: '1px solid rgba(255,255,255,0.2)',
              cursor: 'pointer',
              transition: 'background 200ms ease',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            Skip intro
          </button>
        )}
      </div>
    </SlideShell>
  );
}
