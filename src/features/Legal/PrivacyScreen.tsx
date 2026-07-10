import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useAuth } from '../../hooks/useAuth';

function PrivacyScreen() {
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
          <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Privacy Policy</h1>
          <span className="w-10" />
        </header>

        <main className="px-4 py-4 space-y-4">
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[13px] leading-[19px] text-amber-800">
              <strong>Beta notice:</strong> Tiizi is currently in private beta. This Privacy Policy explains what
              information we collect and how we use it today. It has not yet been reviewed by a lawyer and should not
              be treated as final, legally certified terms — a full legal review is required before Tiizi is opened
              to the public.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[15px] leading-[22px] text-slate-700">
              Tiizi is a mobile-first fitness and wellness challenge app. This policy explains what data we collect
              when you use Tiizi, why we collect it, how it's used, and the choices you have over it.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">What information we collect</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              <strong>Account information:</strong> your name, email address, and login credentials.<br />
              <strong>Profile information:</strong> display name, photo, birthday, and any personal details you add
              during profile setup.<br />
              <strong>Wellness and fitness goals:</strong> the exercise interests, wellness topics, and health goals
              you select during onboarding, used to personalize your Tiizi experience.<br />
              <strong>Groups and challenges:</strong> which groups you join or create, your role, and your
              participation in challenges.<br />
              <strong>Activity logs:</strong> the workouts and wellness activities you log, including values, dates,
              and streaks — this is the core data that drives your progress and leaderboards.<br />
              <strong>Invites and sharing:</strong> invite codes you create or redeem, and referral/share links you
              generate.<br />
              <strong>Support and donations:</strong> payment references you submit for challenge or cause support
              (Tiizi does not store full payment card details).<br />
              <strong>Device and usage information:</strong> basic technical information (such as browser type and
              whether the app is installed to your home screen) used to keep Tiizi working correctly.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Why we collect it</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              We use this information to run the core Tiizi experience: creating your account, personalizing
              challenges and communities to your goals, calculating your progress and leaderboard standing, showing
              your group members relevant activity, letting you install and use Tiizi as an app, enabling sharing and
              invites, and reviewing donation/support references. We do not sell your personal information.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Who can see your information</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              Members of the same group may see safe summaries such as your display name, group activity feed posts,
              challenge progress, and leaderboard totals. Private group content is intended only for approved
              members. Tiizi administrators and authorized group managers may review records needed for safety,
              moderation, invite management, challenge approval, and manual donation verification. Confirmed public
              support totals do not show donor identities or transaction details.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Your control over your data</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              You can update your profile, wellness goals, and privacy settings at any time in the app. Your privacy
              settings control what parts of your profile other members can see. To request access to, correction of,
              or deletion of your data, contact support from the Help screen.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">How long we keep your data</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              We retain your account and activity data for as long as your account is active, so your progress and
              history remain available to you. If you delete your account, we will remove or anonymize your personal
              information within a reasonable period, except where we need to retain limited records for safety,
              fraud prevention, or legal reasons.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Security</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              We use industry-standard practices — including authenticated access controls and encrypted connections
              — to help protect your information. No system is perfectly secure, but we work to keep your data safe
              and to limit access to only what's needed to run the app.
            </p>

            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Health disclaimer</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">
              Wellness goals and activity data you provide are used only to personalize your Tiizi experience — they
              are not medical records, and Tiizi does not provide medical advice. See our Terms of Service for more.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[13px] leading-[20px] text-slate-500">
              Questions about your data or this policy? Contact support from the Help screen, or reach us at{' '}
              <span className="font-semibold text-slate-700">support@tiizichallenges.com</span> (placeholder — update
              with your real support contact before public launch).
            </p>
          </section>
        </main>
      </div>
    </Screen>
  );
}

export default PrivacyScreen;
