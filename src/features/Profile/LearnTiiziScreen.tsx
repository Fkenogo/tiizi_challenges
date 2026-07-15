import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { SlideShell } from '../Onboarding/SlideShell';
import { LEARN_TIIZI_SLIDES, sectionToIndex } from '../Onboarding/learnTiiziData';

const FONT = "'Plus Jakarta Sans', sans-serif";

function LearnTiiziScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [current, setCurrent] = useState(() => sectionToIndex(params.get('section')));
  const total = LEARN_TIIZI_SLIDES.length;
  const isLast = current === total - 1;
  const slide = LEARN_TIIZI_SLIDES[current];

  const handleNext = () => {
    if (!isLast) setCurrent((prev) => prev + 1);
    else navigate(-1);
  };

  const handleBack = () => {
    if (current > 0) setCurrent((prev) => prev - 1);
    else navigate(-1);
  };

  const closeButton = (
    <button
      onClick={() => navigate(-1)}
      aria-label="Close guide"
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.18)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        border: '1px solid rgba(255,255,255,0.25)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        color: '#fff',
        fontSize: 18,
        fontWeight: 700,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      ✕
    </button>
  );

  return (
    <SlideShell
      imageUrl={slide.imageUrl}
      title={slide.title}
      body={slide.body}
      current={current}
      total={total}
      topRight={closeButton}
    >
      <div className="flex gap-3 mt-8">
        {current > 0 && (
          <button
            onClick={handleBack}
            style={{
              flex: 1,
              height: 56,
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
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            ← Back
          </button>
        )}

        <button
          onClick={handleNext}
          style={{
            flex: 2,
            height: 56,
            borderRadius: 14,
            background: 'var(--primary)',
            color: '#fff',
            fontFamily: FONT,
            fontSize: 16,
            fontWeight: 700,
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            boxShadow: '0 8px 24px rgba(255,107,0,0.35)',
            WebkitTapHighlightColor: 'transparent',
          }}
        >
          {isLast ? 'Done' : 'Next →'}
        </button>
      </div>
    </SlideShell>
  );
}

export default LearnTiiziScreen;
