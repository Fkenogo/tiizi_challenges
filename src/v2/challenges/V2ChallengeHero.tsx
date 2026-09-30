import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import type { V2ChallengeDetail } from '../../api/v2ChallengeApi';
import { V2Sheet } from '../components/V2Primitives';
import { challengeTypeLabel, formatDayRange, timezoneLabel } from './challengeCreationDraft';
import { challengeCoverGradient } from './challengeCovers';

/**
 * CORR-002 §4 — Experience-Reference challenge hero (all three types).
 *
 * Consolidates challenge identity/context scattered across the previous
 * administrative cards into one participant-facing hero:
 * type badge, title, host Group, schedule/timezone, purpose statement and
 * the primary Log Activity CTA.
 *
 * Challenge background presentation is a governed catalogue id rendered as a
 * local CSS gradient. Legacy Challenges without an id use a type-tinted
 * fallback; no external image URL or upload provider is involved.
 */

const HERO_TONE: Record<string, string> = {
  collective: 'from-emerald-700 via-emerald-600 to-emerald-500',
  competitive: 'from-sky-800 via-sky-600 to-sky-500',
  streak: 'from-orange-700 via-orange-600 to-orange-500',
};

export function V2ChallengeHero({
  detail,
  groupName,
  groupId,
  loggable,
  onLogActivity,
  showLeave,
  onLeave,
}: {
  detail: V2ChallengeDetail;
  groupName: string;
  /**
   * S4a CORR-001 — hosting Group identity for the continuity link back to
   * Group Home. Composition only: the same governed truth, now navigable.
   */
  groupId: string;
  /** True while the canonical logging view permits a new submission. */
  loggable: boolean;
  onLogActivity: () => void;
  /**
   * CORR-003 — true for active participants: the hero carries a visually
   * secondary Leave action, clearly subordinate to the primary Log Activity
   * CTA. Selecting it only opens the confirmation dialog; it never leaves
   * directly. No explanatory history text lives in the hero.
   */
  showLeave: boolean;
  onLeave: () => void;
}) {
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const [descriptionTruncated, setDescriptionTruncated] = useState(false);
  const descriptionRef = useRef<HTMLParagraphElement>(null);
  const tone = HERO_TONE[detail.challengeType] ?? 'from-slate-800 via-slate-700 to-slate-600';

  useEffect(() => {
    const paragraph = descriptionRef.current;
    if (!paragraph || !detail.description) {
      setDescriptionTruncated(false);
      return;
    }
    const measure = () => {
      const clampedHeight = paragraph.clientHeight;
      const lineClamp = paragraph.style.getPropertyValue('-webkit-line-clamp');
      paragraph.style.setProperty('-webkit-line-clamp', 'unset');
      const naturalHeight = paragraph.scrollHeight;
      if (lineClamp) paragraph.style.setProperty('-webkit-line-clamp', lineClamp);
      else paragraph.style.removeProperty('-webkit-line-clamp');
      setDescriptionTruncated(naturalHeight > clampedHeight + 1);
    };
    measure();
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(paragraph);
    window.addEventListener('resize', measure);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [detail.description]);

  return (
    <section aria-label="Challenge overview" className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={`relative bg-gradient-to-br px-5 pb-5 pt-4 text-white sm:px-6 ${detail.coverId ? challengeCoverGradient(detail.coverId) : tone}`}>
        <div aria-hidden className="pointer-events-none absolute -right-10 -top-16 h-48 w-48 rounded-full bg-white/10" />
        <div aria-hidden className="pointer-events-none absolute -right-2 top-10 h-24 w-24 rounded-full bg-white/10" />
        <div className="relative flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-white/20 px-3 py-1 text-[11px] font-black uppercase tracking-wider backdrop-blur-sm">
            {challengeTypeLabel(detail.challengeType)} challenge
          </span>
          <span className="rounded-full bg-black/30 px-3 py-1 text-[11px] font-bold backdrop-blur-sm">
            {timezoneLabel(detail.timezone)}
          </span>
        </div>
        <p className="relative mt-3 text-xs font-bold uppercase tracking-wider text-white/80">
          Hosted by{' '}
          <Link to={`/v2/groups/${groupId}`} className="underline decoration-white/50 underline-offset-2 hover:text-white">
            {groupName}
          </Link>
        </p>
        <h1 className="relative mt-0.5 text-2xl font-black tracking-tight sm:text-3xl">
          {detail.title}
        </h1>
        <p className="relative mt-1.5 text-sm font-medium text-white/90">
          {formatDayRange(detail.startDate, detail.endDate)}
        </p>
      </div>

      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="min-w-0">
          {detail.description ? (
            <>
              <p
                ref={descriptionRef}
                className="overflow-hidden text-sm italic leading-6 text-slate-700"
                style={{ display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: 3 }}
              >
                “{detail.description}”
              </p>
              {descriptionTruncated && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  aria-expanded={descriptionOpen}
                  onClick={() => setDescriptionOpen(true)}
                  className="mt-1 text-sm font-bold text-primary underline underline-offset-2"
                >
                  Read more
                </button>
              )}
              <V2Sheet open={descriptionOpen} onClose={() => setDescriptionOpen(false)} title="Challenge description">
                <p className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-slate-700">{detail.description}</p>
              </V2Sheet>
            </>
          ) : (
            <p className="text-sm leading-6 text-slate-500">
              Take part with your group — log what counts and watch progress move.
            </p>
          )}
        </div>
        {(loggable || showLeave) && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            {loggable && (
              <button
                type="button"
                onClick={onLogActivity}
                className="w-full rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-orange-600/20 transition-all hover:brightness-95 sm:w-auto"
              >
                + Log activity
              </button>
            )}
            {showLeave && (
              <button
                type="button"
                onClick={onLeave}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-bold text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700 sm:w-auto"
              >
                Leave Challenge
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
