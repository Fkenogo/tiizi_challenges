import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';

// Pilot legal copy is intentionally in-app and editable here until Tiizi connects admin-managed content pages.
function TermsScreen() {
  const navigate = useNavigate();

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/settings')}>
            <ArrowLeft size={22} className="text-slate-900" />
          </button>
          <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Terms of Service</h1>
          <span className="w-10" />
        </header>

        <main className="px-4 py-4 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[15px] leading-[22px] text-slate-700">
              Tiizi is a pilot fitness challenge app for creating an account, completing a profile, joining groups, participating in challenges, logging workouts or wellness activities, viewing progress and leaderboards, receiving notifications, and submitting optional support or donation references.
            </p>
            <p className="text-[13px] leading-[20px] text-slate-500">
              This pilot notice is practical product guidance, not final legal advice.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Accounts and profile setup</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">You must use accurate account information and keep your login secure. Profile setup and privacy settings help Tiizi personalize the member experience and control supported profile visibility.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Groups, invites, and challenges</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Groups may be public or private. Private groups can require secure invites or approval. Challenge access, activity logging, and leaderboards depend on valid group and challenge membership.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Member responsibilities</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">You are responsible for the activity logs, group content, invite codes, join requests, and payment references you submit. Do not submit false activity, inflated scores, misleading payment references, abusive content, or content that violates another member's privacy.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Progress, rankings, and moderation</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Progress and leaderboards are generated from activity logs and server summaries. Group owners, moderators, and Tiizi administrators may review, remove, reject, or suspend content, challenges, memberships, or records that appear unsafe, fraudulent, or inconsistent with pilot rules.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Payments and donations</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Support and challenge donations are manual/direct for now. Tiizi does not automatically verify payment. A submitted payment reference remains pending until an admin reviews and confirms it.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Acceptable use</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Do not harass members, share harmful content, attempt to bypass private group access, manipulate scores, misuse invite codes, or interfere with Tiizi systems. Access may be limited during the pilot if needed to protect members and data.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Pilot status</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Tiizi is currently preparing for pilot use. Features may change as feedback is reviewed and safety checks are improved.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[13px] leading-[20px] text-slate-500">
              Questions about these terms? Contact support from the Help screen.
            </p>
          </section>
        </main>

        <BottomNav active="profile" />
      </div>
    </Screen>
  );
}

export default TermsScreen;
