import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';

function TermsScreen() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate(isAuthenticated ? '/app/profile/settings' : '/app/welcome');
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-16">
        <header className="sticky top-0 z-10 px-4 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={handleBack} aria-label="Back">
            <ArrowLeft size={22} className="text-slate-900" />
          </button>
          <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Terms of Service</h1>
          <span className="w-10" />
        </header>

        <main className="px-4 py-4 space-y-4">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[13px] leading-[19px] text-amber-800">
              <strong>Beta notice:</strong> Tiizi is currently in private beta. These Terms describe how the app works
              today and what we expect from members while we test with a small group. This document has not yet been
              reviewed by a lawyer and should not be treated as final, legally certified terms — a full legal review
              is required before Tiizi is opened to the public.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[15px] leading-[22px] text-slate-700">
              Welcome to Tiizi — a mobile-first fitness and wellness challenge app. Tiizi lets you create an account,
              build a profile, join or create groups, take part in fitness and wellness challenges, log activities,
              track progress on leaderboards, install Tiizi to your phone's home screen, invite friends, and
              optionally support challenges or causes through donations. By creating an account or using Tiizi, you
              agree to these Terms.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">1. Your account</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              You must provide accurate information when creating your account and keep your login credentials
              secure. You're responsible for all activity that happens under your account. Tell us right away if you
              believe your account has been compromised.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">2. Groups, challenges, and activity logging</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              Groups may be public or private. Private groups may require an invite or approval to join. Once you're
              a member, you can participate in challenges tied to that group — collective, competitive, or
              streak-based — and log workouts or wellness activities toward them. Your logged activity is used to
              calculate your progress, your group's progress, and leaderboard standings. Log activity honestly:
              submitting false, inflated, or misleading activity data undermines the experience for everyone in your
              group and may result in your entry being removed or your account being restricted.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">3. Wellness goals and your profile</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              During onboarding you can set exercise interests, wellness topics, and personal health goals. Tiizi
              uses this information to personalize the challenges, communities, and content shown to you. You can
              update this information at any time from your profile settings, and you control what parts of your
              profile are visible to other members through your privacy settings.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">4. Health disclaimer</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              <strong>Tiizi is not a medical device, and nothing in the app is medical advice.</strong> Challenges,
              activity targets, streaks, and wellness content are provided for motivation and community accountability
              only. Talk to a qualified healthcare provider before starting any new exercise or wellness program,
              especially if you have an existing health condition, injury, or concern. You are responsible for
              exercising within your own physical limits. Tiizi is not liable for injury or health outcomes related
              to your use of the app.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">5. Installing Tiizi (add to home screen)</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              Tiizi can be installed to your phone's home screen as a Progressive Web App (PWA) for a faster,
              app-like experience. Installing Tiizi this way does not create a separate account or change these
              Terms — it's simply a shortcut to the same web app, and you can remove it from your home screen at any
              time the same way you'd remove any other app shortcut.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">6. Sharing and invites</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              Tiizi lets you share your achievements and invite friends to join Tiizi or specific groups. Only share
              invite links and codes with people you intend to invite — invite codes tied to private groups should be
              treated as access credentials, not shared publicly. Misusing invite codes to gain unauthorized access
              to a private group is not allowed.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">7. Donations and support</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              Tiizi may let you support causes or challenge campaigns through optional donations. During beta,
              donation and support references are reviewed manually — Tiizi does not automatically verify payments,
              and a submitted payment reference remains pending until confirmed by an admin. Donations are voluntary
              and, unless stated otherwise at the time of donation, non-refundable.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">8. Your responsibilities</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              Don't harass or abuse other members, post content that violates someone else's privacy or safety, submit
              false activity or payment information, attempt to bypass private group access, manipulate scores or
              leaderboards, misuse invite codes, or interfere with Tiizi's systems. Group owners, moderators, and
              Tiizi administrators may review, remove, or restrict content, challenges, memberships, or accounts that
              violate these Terms or put other members at risk.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">9. Beta status and changes</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              Tiizi is in active development. Features, screens, and these Terms may change as we learn from beta
              feedback and improve the app. We'll do our best to communicate significant changes to beta members.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[13px] leading-[20px] text-slate-500">
              Questions about these Terms? Contact support from the Help screen, or reach us at{' '}
              <span className="font-semibold text-slate-700">support@tiizichallenges.com</span>.
            </p>
          </section>
        </main>
      </div>
    </Screen>
  );
}

export default TermsScreen;
