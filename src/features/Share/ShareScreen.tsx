import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, Share2, Trophy, Users, Flame } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Screen, Section } from '../../components/Layout';
import { Card } from '../../components/Mobile';
import { useChallenge } from '../../hooks/useChallenges';
import { useGroup } from '../../hooks/useGroups';

function ShareScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();

  // Core identifiers
  const challengeId = params.get('challengeId') ?? undefined;
  const groupId = params.get('groupId') ?? undefined;

  // Enriched params passed by ChallengeCompletedScreen
  const challengeType = params.get('type') ?? '';          // 'collective' | 'competitive' | 'streak'
  const nameParam = params.get('name') ?? '';

  // Competitive + collective: just-logged value
  const lastValue = Number(params.get('lastValue') || 0);
  const lastUnit = params.get('lastUnit') ?? '';

  // Competitive: personal cumulative progress + rank
  const myProgress = Number(params.get('myProgress') || 0);
  const totalTarget = Number(params.get('totalTarget') || 0);
  const unit = params.get('unit') ?? lastUnit;

  // Competitive: rank
  const rank = params.get('rank') ? Number(params.get('rank')) : null;

  // Collective: team totals
  const teamTotal = Number(params.get('teamTotal') || 0);
  const teamTarget = Number(params.get('teamTarget') || 0);

  // Streak
  const streak = Number(params.get('streak') || 0);
  const totalDays = Number(params.get('totalDays') || 0);
  const daysRemaining = totalDays > 0 ? Math.max(0, totalDays - streak) : null;

  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  // Fetch for display names — hooks must always be called
  const { data: challenge } = useChallenge(challengeId);
  const { data: group } = useGroup(groupId);

  // Prefer name from URL param (already resolved by ChallengeCompletedScreen),
  // fall back to hook data if navigating here directly.
  const challengeName = nameParam || challenge?.name || null;
  const groupName = group?.name ?? null;

  // ── Type-specific achievement share text ────────────────────────────────────
  const shareText = useMemo(() => {
    const name = challengeName ?? 'a challenge';
    const valueStr = lastValue > 0 ? `${lastValue.toLocaleString()} ${lastUnit}`.trim() : null;

    if (challengeType === 'competitive') {
      const progressLine = myProgress > 0 && totalTarget > 0
        ? `\nCurrent progress: ${myProgress.toLocaleString()} / ${totalTarget.toLocaleString()} ${unit}`.trimEnd()
        : myProgress > 0
          ? `\nCurrent progress: ${myProgress.toLocaleString()} ${unit}`.trimEnd()
          : '';
      const rankLine = rank ? `\nRank: #${rank}. 💪` : ' 💪';
      const loggedLine = valueStr ? `I just logged ${valueStr} in ${name} on Tiizi.` : `I'm competing in ${name} on Tiizi.`;
      return `${loggedLine}${progressLine}${rankLine}\n#Tiizi`;
    }

    if (challengeType === 'collective') {
      const loggedLine = valueStr ? `I just added ${valueStr} to ${name} on Tiizi.` : `I contributed to ${name} on Tiizi.`;
      const teamLine = teamTotal > 0 && teamTarget > 0
        ? `\nTeam progress: ${teamTotal.toLocaleString()} / ${teamTarget.toLocaleString()} ${unit}`.trimEnd()
        : teamTotal > 0
          ? `\nTeam progress: ${teamTotal.toLocaleString()} ${unit}`.trimEnd()
          : '';
      return `${loggedLine}${teamLine}\nEvery contribution counts. 🔥\n#Tiizi`;
    }

    if (challengeType === 'streak') {
      const dayLine = streak > 0 ? `Day ${streak} completed in ${name} on Tiizi.` : `I'm on a streak in ${name} on Tiizi.`;
      const streakLine = streak > 0 ? `\nCurrent streak: ${streak} day${streak !== 1 ? 's' : ''}.` : '';
      const remainLine = daysRemaining !== null && daysRemaining > 0 ? `\n${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} to go. 🔥` : daysRemaining === 0 ? '\nStreak complete! 🎉' : ' 🔥';
      return `${dayLine}${streakLine}${remainLine}\n#Tiizi`;
    }

    // Fallback — generic achievement, still value-forward not invite-forward
    if (valueStr) return `I just logged ${valueStr} in ${name} on Tiizi. 💪\n#Tiizi`;
    return `I'm making progress in ${name} on Tiizi. 💪\n#Tiizi`;
  }, [challengeType, challengeName, lastValue, lastUnit, myProgress, totalTarget, unit, rank, teamTotal, teamTarget, streak, daysRemaining]);

  // Challenge detail route — never the template gallery
  const challengePreviewPath = challengeId
    ? `/app/challenge/${challengeId}${groupId ? `?groupId=${groupId}` : ''}`
    : null;

  // ── Share handlers ──────────────────────────────────────────────────────────
  const handleWebShare = async () => {
    if (!navigator.share) return false;
    try {
      await navigator.share({
        title: challengeName ? `Tiizi — ${challengeName}` : 'Tiizi Challenge',
        text: shareText,
      });
      setShared(true);
      setTimeout(() => setShared(false), 2000);
      return true;
    } catch {
      return false;
    }
  };

  const handleShare = async () => {
    const didShare = await handleWebShare();
    if (!didShare) {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch {
        // ignore — clipboard unavailable
      }
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      // ignore
    }
  };

  const handleWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const canWebShare = typeof navigator !== 'undefined' && !!navigator.share;

  // ── Preview card icon by type ───────────────────────────────────────────────
  const TypeIcon =
    challengeType === 'competitive' ? Trophy
    : challengeType === 'streak' ? Flame
    : Users;

  return (
    <Screen>
      <Section title="Share Achievement">
        <Card>
          <div className="flex items-center gap-2">
            <Share2 size={18} className="text-primary" />
            <p className="text-sm font-bold text-slate-900">Share your achievement</p>
          </div>

          {/* Rich preview card */}
          <div className="mt-3 rounded-xl border border-primary/20 bg-[#fff8f4] p-4">
            {/* Header row */}
            <div className="flex items-center gap-2 mb-3">
              <TypeIcon size={18} className="text-primary flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-[13px] font-black text-slate-900 leading-tight truncate">
                  {challengeName ?? 'Challenge'}
                </p>
                {groupName && (
                  <p className="text-[11px] text-slate-500 leading-tight truncate">with {groupName}</p>
                )}
              </div>
            </div>

            {/* Type-specific metrics */}
            {challengeType === 'competitive' && (
              <div className="space-y-1.5">
                {lastValue > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Just logged</span>
                    <span className="font-bold text-slate-900">{lastValue.toLocaleString()} {lastUnit}</span>
                  </div>
                )}
                {myProgress > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Progress</span>
                    <span className="font-bold text-slate-900">
                      {myProgress.toLocaleString()}{totalTarget > 0 ? ` / ${totalTarget.toLocaleString()}` : ''} {unit}
                    </span>
                  </div>
                )}
                {rank && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Rank</span>
                    <span className="font-bold text-primary">#{rank}</span>
                  </div>
                )}
              </div>
            )}

            {challengeType === 'collective' && (
              <div className="space-y-1.5">
                {lastValue > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Just added</span>
                    <span className="font-bold text-slate-900">{lastValue.toLocaleString()} {lastUnit}</span>
                  </div>
                )}
                {teamTotal > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Team total</span>
                    <span className="font-bold text-slate-900">
                      {teamTotal.toLocaleString()}{teamTarget > 0 ? ` / ${teamTarget.toLocaleString()}` : ''} {unit}
                    </span>
                  </div>
                )}
              </div>
            )}

            {challengeType === 'streak' && (
              <div className="space-y-1.5">
                {streak > 0 && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">Current streak</span>
                    <span className="font-bold text-primary">{streak} day{streak !== 1 ? 's' : ''}</span>
                  </div>
                )}
                {daysRemaining !== null && (
                  <div className="flex justify-between text-[12px]">
                    <span className="text-slate-500">{daysRemaining === 0 ? 'Status' : 'Days to go'}</span>
                    <span className="font-bold text-slate-900">
                      {daysRemaining === 0 ? 'Complete 🎉' : daysRemaining}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Tiizi branding footer */}
            <p className="mt-3 text-[10px] text-slate-400 text-right tracking-wide">tiizi.app · #Tiizi</p>
          </div>

          {/* Share text preview */}
          <div className="mt-3 rounded-xl bg-slate-50 border border-slate-200 p-3">
            <p className="text-xs text-slate-500 mb-1 font-semibold uppercase tracking-wider">Share text</p>
            <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">{shareText}</p>
          </div>

          <div className="mt-4 space-y-2">
            {/* Primary: Web Share API → image+text on supported mobile, text-only fallback */}
            {canWebShare ? (
              <button
                className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2"
                onClick={handleShare}
              >
                <Share2 size={15} />
                {shared ? 'Shared!' : 'Share'}
              </button>
            ) : (
              <button
                className="w-full h-11 rounded-xl bg-primary text-white text-sm font-bold flex items-center justify-center gap-2"
                onClick={handleCopy}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
            )}

            {/* WhatsApp — achievement text, not invite */}
            <button
              className="w-full h-11 rounded-xl bg-[#25d366] text-white text-sm font-bold"
              onClick={handleWhatsApp}
            >
              Share on WhatsApp
            </button>

            {/* Explicit copy when Web Share is also available */}
            {canWebShare && (
              <button
                className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold flex items-center justify-center gap-2"
                onClick={handleCopy}
              >
                {copied ? <Check size={15} /> : <Copy size={15} />}
                {copied ? 'Copied!' : 'Copy Text'}
              </button>
            )}

            {/* Open the actual challenge detail page */}
            {challengePreviewPath && (
              <button
                className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold flex items-center justify-center gap-2"
                onClick={() => navigate(challengePreviewPath)}
              >
                <ExternalLink size={14} />
                Open Challenge
              </button>
            )}

            <button
              className="w-full h-11 rounded-xl bg-slate-100 text-slate-700 text-sm font-bold"
              onClick={() => navigate(-1)}
            >
              Back
            </button>
          </div>
        </Card>
      </Section>
    </Screen>
  );
}

export default ShareScreen;
