import { ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BottomNav, Screen } from '../../components/Layout';

// Pilot privacy copy is intentionally in-app and editable here until Tiizi connects admin-managed content pages.
function PrivacyScreen() {
  const navigate = useNavigate();

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen bg-slate-50 pb-[96px]">
        <header className="px-4 py-4 border-b border-slate-200 bg-white flex items-center justify-between">
          <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/profile/settings')}>
            <ArrowLeft size={22} className="text-slate-900" />
          </button>
          <h1 className="text-[18px] leading-[22px] font-black text-slate-900">Privacy Policy</h1>
          <span className="w-10" />
        </header>

        <main className="px-4 py-4 space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-2">
            <p className="text-[15px] leading-[22px] text-slate-700">
              Tiizi uses your account, profile, group, challenge, activity, notification, invite, and support information to provide the member experience during the pilot. Your privacy settings control what other members can see in supported profile surfaces.
            </p>
            <p className="text-[13px] leading-[20px] text-slate-500">
              This pilot privacy notice is product guidance, not final legal advice.
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 space-y-3">
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Information used in the app</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Tiizi stores account identifiers, profile details, privacy preferences, group memberships, private invite and join request records, challenge participation, workout logs, wellness logs, notification items, and support or donation intents needed to run the app.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Member visibility</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Members in the same group may see safe summaries such as display name, group activity feed items, member stats, rankings, challenge progress, and leaderboard totals. Private group content is intended for approved members only.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Admin and moderator access</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Tiizi administrators and authorized group managers may review records needed for safety, moderation, invite management, challenge approval, membership approval, support, and manual payment verification.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Activity and leaderboard data</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Raw workout and wellness activity writes are used to generate server-owned summaries for progress and leaderboards. Those summaries may be visible to relevant group members, while raw records are not intended for broad public browsing.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Support and payments</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">Support and donation references are used for manual admin review. Confirmed public support totals do not include donor identities or transaction details.</p>
            <h2 className="text-[15px] leading-[20px] font-black text-slate-900">Your choices</h2>
            <p className="text-[14px] leading-[21px] text-slate-600">You can update profile and privacy settings in the app. For account, data, payment-reference, or dispute questions, contact support from the Help screen.</p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[13px] leading-[20px] text-slate-500">
              To ask about your data or account, contact support from the Help screen.
            </p>
          </section>
        </main>

        <BottomNav active="profile" />
      </div>
    </Screen>
  );
}

export default PrivacyScreen;
