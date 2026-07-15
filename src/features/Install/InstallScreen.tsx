import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Download, Share2, Smartphone } from 'lucide-react';

const INSTALL_URL = 'https://www.tiizichallenges.com/install';
const APP_URL = 'https://www.tiizichallenges.com';

type Platform = 'ios' | 'android' | 'desktop' | 'other';

function detectPlatform(): Platform {
  const ua = navigator.userAgent;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;
  if (isStandalone) return 'other';
  if (/iPad|iPhone|iPod/.test(ua)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  if (!/Mobi|Android/i.test(ua)) return 'desktop';
  return 'other';
}

// beforeinstallprompt event is not in the standard TS lib
interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function InstallScreen() {
  const navigate = useNavigate();
  const platform = detectPlatform();
  const [copied, setCopied] = useState(false);
  const deferredPrompt = useRef<BeforeInstallPromptEvent | null>(null);
  const [canNativeInstall, setCanNativeInstall] = useState(false);
  const [nativeInstallDone, setNativeInstallDone] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt.current = e as BeforeInstallPromptEvent;
      setCanNativeInstall(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleNativeInstall = async () => {
    const prompt = deferredPrompt.current;
    if (!prompt) return;
    const { outcome } = await prompt.prompt();
    if (outcome === 'accepted' || outcome === 'dismissed') {
      deferredPrompt.current = null;
      setCanNativeInstall(false);
    }
    if (outcome === 'accepted') setNativeInstallDone(true);
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Join me on Tiizi',
          text: 'Tiizi helps you build healthy habits with group challenges. Add it to your home screen!',
          url: INSTALL_URL,
        });
        return;
      } catch {
        // fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(INSTALL_URL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* nothing */ }
  };

  const isAlreadyInstalled =
    window.matchMedia('(display-mode: standalone)').matches ||
    (navigator as { standalone?: boolean }).standalone === true;

  return (
    <div className="min-h-screen bg-[#fffaf7] flex flex-col">
      {/* Header */}
      <header className="mx-auto w-full max-w-mobile px-5 pt-8 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center">
            <Smartphone size={18} className="text-white" />
          </div>
          <span className="text-[18px] leading-[22px] font-black text-[#1c120d] tracking-[-0.02em]">Tiizi</span>
        </div>
      </header>

      <main className="flex-1 mx-auto w-full max-w-mobile px-5 pt-6 pb-10">
        {/* Hero */}
        <div className="text-center">
          <div className="mx-auto h-[88px] w-[88px] rounded-[24px] bg-primary flex items-center justify-center shadow-[0_12px_28px_rgba(255,111,0,0.28)]">
            <Smartphone size={40} className="text-white" />
          </div>
          <h1 className="mt-5 text-[28px] leading-[32px] tracking-[-0.03em] font-black text-[#1c120d]">
            Add Tiizi to your<br />home screen
          </h1>
          <p className="mt-3 text-[15px] leading-[22px] text-slate-500">
            Get the full app experience — challenges, groups, and progress tracking — right from your home screen.
          </p>
        </div>

        {/* Already installed */}
        {isAlreadyInstalled && (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="text-[15px] font-bold text-emerald-700">Tiizi is already installed ✓</p>
            <p className="mt-1 text-[13px] text-emerald-600">You're running the app from your home screen.</p>
          </div>
        )}

        {/* Native install prompt (Android Chrome when beforeinstallprompt fires) */}
        {!isAlreadyInstalled && canNativeInstall && !nativeInstallDone && (
          <div className="mt-8 rounded-2xl border border-primary/30 bg-primary/5 p-5">
            <p className="text-[13px] tracking-[0.12em] uppercase font-bold text-primary mb-2">Install Tiizi on Android</p>
            <p className="text-[14px] leading-[20px] text-slate-700 mb-4">
              Tap the button below to install Tiizi directly to your home screen.
            </p>
            <button
              onClick={handleNativeInstall}
              className="w-full h-12 rounded-2xl bg-primary text-white text-[15px] font-bold flex items-center justify-center gap-2 active:opacity-80"
              data-testid="native-install-btn"
            >
              <Download size={18} />
              Install Tiizi
            </button>
          </div>
        )}

        {nativeInstallDone && (
          <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 px-5 py-4 text-center">
            <p className="text-[15px] font-bold text-emerald-700">Installing Tiizi… ✓</p>
            <p className="mt-1 text-[13px] text-emerald-600">Once installed, Tiizi will appear like any other app on your phone. You can open it directly from your Home Screen.</p>
          </div>
        )}

        {/* Platform instructions (shown when no native prompt available) */}
        {!isAlreadyInstalled && !canNativeInstall && !nativeInstallDone && (
          <div className="mt-8">
            {platform === 'ios' && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                <p className="text-[13px] tracking-[0.12em] uppercase font-bold text-primary mb-3">Safari on iPhone / iPad</p>
                <ol className="space-y-3">
                  {[
                    'Open this page in Safari (not Chrome)',
                    'Tap the Share icon at the bottom of the screen',
                    'Scroll down and tap "Add to Home Screen"',
                    'Tap "Add" in the top right to confirm',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-[12px] font-black flex items-center justify-center">{i + 1}</span>
                      <span className="text-[14px] leading-[20px] text-slate-700">{step}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {platform === 'android' && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                <p className="text-[13px] tracking-[0.12em] uppercase font-bold text-primary mb-3">Install Tiizi on Android</p>
                <ol className="space-y-3">
                  {[
                    'Tap the Chrome menu ⋮ in the top right corner.',
                    'Look for one of these options: Install · Install app · Install and create shortcut · Add to Home screen',
                    'Follow the prompts to finish installation.',
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="shrink-0 h-6 w-6 rounded-full bg-primary/10 text-primary text-[12px] font-black flex items-center justify-center">{i + 1}</span>
                      <span className="text-[14px] leading-[20px] text-slate-700">{step}</span>
                    </li>
                  ))}
                </ol>
                <p className="mt-4 text-[12px] leading-[18px] text-slate-400 italic">
                  Menu names may vary depending on your Android phone, browser version, and manufacturer.
                </p>
                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3">
                  <p className="text-[13px] leading-[18px] text-slate-600">
                    Once installed, Tiizi will appear like any other app on your phone. You can open it directly from your Home Screen.
                  </p>
                </div>
              </div>
            )}

            {platform === 'desktop' && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                <p className="text-[13px] tracking-[0.12em] uppercase font-bold text-primary mb-3">On your phone</p>
                <p className="text-[14px] leading-[22px] text-slate-600">
                  For the best experience, open this link on your iPhone or Android phone and add Tiizi to your home screen.
                </p>
                <div className="mt-4 rounded-xl bg-slate-50 px-4 py-3 flex items-center justify-between gap-3">
                  <span className="text-[13px] font-semibold text-slate-600 truncate">{APP_URL}</span>
                  <button
                    onClick={handleShare}
                    className="shrink-0 h-8 px-3 rounded-lg bg-primary text-white text-[12px] font-bold active:opacity-80"
                  >
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>
            )}

            {platform === 'other' && (
              <div className="rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
                <p className="text-[13px] tracking-[0.12em] uppercase font-bold text-primary mb-3">Install Tiizi</p>
                <p className="text-[14px] leading-[22px] text-slate-600">
                  Open this page in your browser's menu and look for "Add to Home Screen", "Install", or "Install app".
                </p>
              </div>
            )}
          </div>
        )}

        {/* Invite card */}
        <div className="mt-6 rounded-2xl border border-slate-100 bg-white shadow-sm p-5">
          <p className="text-[14px] leading-[20px] font-bold text-slate-900">Know someone who'd love Tiizi?</p>
          <p className="mt-1 text-[13px] leading-[18px] text-slate-500">Share the install link and get healthier together.</p>
          <div className="mt-4 flex gap-3">
            <button
              onClick={handleShare}
              className="flex-1 h-11 rounded-xl bg-primary text-white text-[14px] font-bold flex items-center justify-center gap-2 active:opacity-80"
            >
              {copied ? <Check size={16} /> : <Share2 size={16} />}
              {copied ? 'Link copied!' : 'Share Tiizi'}
            </button>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(INSTALL_URL);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                } catch { /* nothing */ }
              }}
              className="h-11 w-11 rounded-xl border border-slate-200 flex items-center justify-center text-slate-500 active:opacity-70"
            >
              <Copy size={16} />
            </button>
          </div>
        </div>

        {/* CTA to app */}
        <button
          className="mt-6 w-full h-12 rounded-2xl border border-slate-200 bg-white text-[15px] font-bold text-slate-700 active:opacity-70"
          onClick={() => navigate('/app/home')}
        >
          Continue to Tiizi →
        </button>
      </main>
    </div>
  );
}

export default InstallScreen;
