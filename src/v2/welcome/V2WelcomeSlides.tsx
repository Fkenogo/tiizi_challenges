import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { V2BrandMark } from '../brand';
import { useAuth } from '../../hooks/useAuth';
import { resolveV2NextPath, v2NextQuery } from '../auth/v2NextPath';
import { WelcomeArt } from './WelcomeArt';
import { WELCOME_SLIDES } from './welcomeContent';
import { clampSlide, markWelcomeSeen, slideFromScroll } from './welcomeState';

/**
 * TIIZI-FER-P1A-001 — public four-slide welcome (`/v2/welcome`).
 *
 * Public by design: it renders before registration, makes NO authenticated or
 * data calls, and only reads local session readiness to adapt its exits for a
 * signed-in member who replays it from Profile → Help. Mobile-first, swipeable
 * (native scroll-snap), keyboard operable, and motion-reduced when the device
 * asks for it. Skipping or finishing records a device-scoped "seen" flag; it
 * never gates sign-in or sign-up.
 */

const SLIDE_COUNT = WELCOME_SLIDES.length;

function prefersReducedMotion(): boolean {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
}

export function V2WelcomeSlides() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { isAuthenticated, isReady } = useAuth();
  const next = resolveV2NextPath(params.get('next'));
  const member = isReady && isAuthenticated;
  const [index, setIndex] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const primaryExitRef = useRef<HTMLAnchorElement>(null);
  // Programmatic scroll in flight: ignore intermediate scroll positions so the
  // active dot, last-slide actions and live announcement never flicker.
  const scrollTarget = useRef<number | null>(null);
  const scrollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const interacted = useRef(false);
  const last = index === SLIDE_COUNT - 1;
  const signUpPath = `/v2/sign-up${v2NextQuery(next)}`;
  const signInPath = `/v2/sign-in${v2NextQuery(next)}`;

  // Landing on the final slide counts as having seen the welcome.
  useEffect(() => {
    if (last) markWelcomeSeen();
  }, [last]);

  // Keyboard focus must survive Next being replaced by the exit actions.
  useEffect(() => {
    if (last && interacted.current) primaryExitRef.current?.focus();
  }, [last]);

  useEffect(() => () => {
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
  }, []);

  function releaseScrollTarget() {
    scrollTarget.current = null;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = null;
  }

  function goTo(target: number) {
    const track = trackRef.current;
    const clamped = clampSlide(target, SLIDE_COUNT);
    interacted.current = true;
    setIndex(clamped);
    if (!track) return;
    scrollTarget.current = clamped;
    if (scrollTimer.current) clearTimeout(scrollTimer.current);
    scrollTimer.current = setTimeout(releaseScrollTarget, 900); // safety net if the target is never reached
    track.scrollTo({ left: clamped * track.clientWidth, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  }

  /** Move relative to where the track really is, so rapid taps during a smooth scroll never use a stale index. */
  function step(delta: number) {
    const track = trackRef.current;
    const here = track ? slideFromScroll(track.scrollLeft, track.clientWidth, SLIDE_COUNT) : index;
    goTo(here + delta);
  }

  function onScroll() {
    const track = trackRef.current;
    if (!track) return;
    const here = slideFromScroll(track.scrollLeft, track.clientWidth, SLIDE_COUNT);
    if (scrollTarget.current !== null) {
      if (here !== scrollTarget.current) return; // still travelling
      releaseScrollTarget();
    }
    setIndex(here);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === 'ArrowRight') { event.preventDefault(); step(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); step(-1); }
    else if (event.key === 'Home') { event.preventDefault(); goTo(0); }
    else if (event.key === 'End') { event.preventDefault(); goTo(SLIDE_COUNT - 1); }
  }

  function skip() {
    markWelcomeSeen();
    navigate(member ? '/v2/profile' : signUpPath);
  }

  // Wait for the local session check so a signed-in replay never flashes the visitor exits.
  if (!isReady) return <div className="min-h-screen bg-slate-50" aria-busy="true" />;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <main className="mx-auto flex min-h-screen w-full max-w-md flex-col px-4 pb-6 pt-4 sm:px-6">
        <header className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <V2BrandMark size={30} />
            <span className="text-lg font-black tracking-tight">tiizi</span>
          </span>
          <button
            type="button"
            onClick={skip}
            className="rounded-lg px-3 py-2 text-sm font-bold text-slate-600 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {member ? 'Close' : 'Skip'}
          </button>
        </header>

        <h1 className="sr-only">Welcome to Tiizi</h1>
        <section
          aria-roledescription="carousel"
          aria-label="Welcome to Tiizi"
          className="mt-4 flex flex-1 flex-col"
        >
          <div
            ref={trackRef}
            role="group"
            aria-label="Welcome slides. Use the arrow keys or swipe."
            onScroll={onScroll}
            onPointerDown={releaseScrollTarget}
            onWheel={releaseScrollTarget}
            onKeyDown={onKeyDown}
            tabIndex={0}
            className="flex flex-1 snap-x snap-mandatory overflow-x-auto overscroll-x-contain [scrollbar-width:none] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary [&::-webkit-scrollbar]:hidden"
          >
            {WELCOME_SLIDES.map((slide, i) => (
              <div
                key={slide.id}
                role="group"
                aria-roledescription="slide"
                aria-label={`${i + 1} of ${SLIDE_COUNT}`}
                className="flex w-full shrink-0 snap-center flex-col items-center justify-center px-2 text-center"
              >
                <div className="h-44 w-full max-w-xs">
                  <WelcomeArt id={slide.id} />
                </div>
                <h2 className="mt-8 text-2xl font-black tracking-tight">{slide.title}</h2>
                <p className="mt-3 max-w-xs text-base leading-7 text-slate-600">{slide.body}</p>
              </div>
            ))}
          </div>
          <p className="sr-only" aria-live="polite">
            Slide {index + 1} of {SLIDE_COUNT}: {WELCOME_SLIDES[index].title}
          </p>

          <div className="mt-4 flex justify-center gap-2" role="group" aria-label="Choose a slide">
            {WELCOME_SLIDES.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                onClick={() => goTo(i)}
                aria-label={`Go to slide ${i + 1}: ${slide.title}`}
                aria-current={i === index ? 'true' : undefined}
                className={`h-2.5 rounded-full motion-safe:transition-all ${i === index ? 'w-6 bg-primary' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`}
              />
            ))}
          </div>
        </section>

        <div className="mt-6 space-y-3">
          {last ? (
            member ? (
              <Link
                ref={primaryExitRef}
                to="/v2/profile"
                className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
              >
                Back to your profile
              </Link>
            ) : (
              <>
                <Link
                  ref={primaryExitRef}
                  to={signUpPath}
                  onClick={() => markWelcomeSeen()}
                  className="flex h-12 w-full items-center justify-center rounded-xl bg-primary text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
                >
                  Create an account
                </Link>
                <Link
                  to={signInPath}
                  onClick={() => markWelcomeSeen()}
                  className="flex h-12 w-full items-center justify-center rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-900 hover:bg-slate-50"
                >
                  Sign in
                </Link>
              </>
            )
          ) : (
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => step(-1)}
                disabled={index === 0}
                className="h-12 flex-1 rounded-xl border border-slate-200 bg-white text-sm font-bold text-slate-700 disabled:opacity-40"
              >
                Back
              </button>
              <button
                type="button"
                onClick={() => step(1)}
                className="h-12 flex-1 rounded-xl bg-primary text-sm font-bold text-white shadow-sm hover:bg-primary-dark"
              >
                Next
              </button>
            </div>
          )}
          {!member && !last && (
            <p className="text-center text-sm text-slate-500">
              Already have an account?{' '}
              <Link to={signInPath} onClick={() => markWelcomeSeen()} className="font-bold text-primary underline underline-offset-2">
                Sign in
              </Link>
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
