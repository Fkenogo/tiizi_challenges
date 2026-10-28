import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { V2GroupInvitePanel } from '../groups/V2GroupInvitePanel';
import { ORIENTATION_PATHS, ORIENTATION_SLIDES } from './orientationContent';
import { markOrientationSeen } from './orientationState';

/**
 * TIIZI — V2 Experience Recovery 001: first-run orientation (`/v2/welcome`).
 *
 * Informational and always skippable: no step is required to use Tiizi, and
 * every exit (Skip intro, Go to Today, Find a Group, Create a Group, opening a
 * Group from an invite code) records the per-device seen-state and leaves for
 * a V2 route. It creates no backend record. Community entry reuses the
 * existing governed invite-code panel (resolve + join/request through the
 * Group authority); this screen never joins anyone itself.
 */

const primaryButton =
  'min-h-12 w-full rounded-2xl bg-primary px-5 text-base font-black text-white shadow-lg transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
const quietButton =
  'min-h-11 rounded-xl px-4 text-sm font-bold text-white/90 transition hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';
const outlineButton =
  'min-h-11 flex-1 rounded-xl border border-white/40 bg-white/10 px-3 text-sm font-bold text-white transition hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-white';

export function V2OrientationScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [index, setIndex] = useState(0);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const total = ORIENTATION_SLIDES.length;
  const slide = ORIENTATION_SLIDES[index];
  const isLast = index === total - 1;

  useEffect(() => {
    headingRef.current?.focus();
  }, [index]);

  const leave = (path: string) => {
    if (user?.uid) markOrientationSeen(user.uid);
    navigate(path, { replace: true });
  };

  return (
    <div className="relative mx-auto flex min-h-[100dvh] w-full max-w-md flex-col overflow-hidden bg-slate-900 text-white">
      <img
        src={slide.image}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/55 to-black/25"
      />

      <header className="relative flex items-center justify-between px-5 pt-5">
        <span className="text-xl font-black tracking-tight">tiizi</span>
        <span className="rounded-full bg-white/15 px-3 py-1 text-[11px] font-bold uppercase tracking-wider backdrop-blur">
          Step {index + 1} of {total}
        </span>
      </header>

      <main
        aria-label="Welcome to Tiizi"
        className="relative mt-auto flex flex-col gap-4 px-5 pb-8 pt-24"
      >
        <ol aria-label="Progress" className="flex gap-1.5">
          {ORIENTATION_SLIDES.map((item, i) => (
            <li
              key={item.id}
              aria-current={i === index ? 'step' : undefined}
              className={`h-1.5 flex-1 rounded-full ${i === index ? 'bg-primary' : i < index ? 'bg-white/70' : 'bg-white/30'}`}
            />
          ))}
        </ol>

        <div aria-live="polite">
          <h1
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-black leading-tight tracking-tight outline-none"
          >
            {slide.title}
          </h1>
          <p className="mt-2 text-base leading-7 text-white/90">{slide.body}</p>
        </div>

        {!isLast ? (
          <div className="space-y-2">
            <button type="button" className={primaryButton} onClick={() => setIndex(index + 1)}>
              Next
            </button>
            <div className="flex items-center justify-between">
              {index > 0 ? (
                <button type="button" className={quietButton} onClick={() => setIndex(index - 1)}>
                  Back
                </button>
              ) : (
                <span aria-hidden />
              )}
              <button
                type="button"
                className={quietButton}
                onClick={() => leave(ORIENTATION_PATHS.today)}
              >
                Skip intro
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <V2GroupInvitePanel onOpen={(groupId) => leave(`/v2/groups/${groupId}`)} />
            <div className="flex gap-2">
              <button
                type="button"
                className={outlineButton}
                onClick={() => leave(ORIENTATION_PATHS.discover)}
              >
                Find a Group
              </button>
              <button
                type="button"
                className={outlineButton}
                onClick={() => leave(ORIENTATION_PATHS.createGroup)}
              >
                Create a Group
              </button>
            </div>
            <button type="button" className={primaryButton} onClick={() => leave(ORIENTATION_PATHS.today)}>
              Go to Today
            </button>
            <div className="flex items-center justify-start">
              <button type="button" className={quietButton} onClick={() => setIndex(index - 1)}>
                Back
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
