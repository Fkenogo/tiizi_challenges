import { ArrowLeft, ExternalLink, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useJoinGroup } from '../../hooks/useGroups';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { GroupBottomNav } from './components/GroupBottomNav';

function JoinGroupScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const joinGroup = useJoinGroup();

  const [inviteCode, setInviteCode] = useState('');
  const [previewAccepted, setPreviewAccepted] = useState(false);

  const formattedCode = useMemo(() => inviteCode.toUpperCase().replace(/[^A-Z0-9-]/g, ''), [inviteCode]);

  const handleJoin = async () => {
    if (!formattedCode || !previewAccepted) return;

    try {
      const result = await joinGroup.mutateAsync({ inviteCode: formattedCode });
      if (!result) {
        showToast('Invite code not found.', 'error');
        return;
      }
      setActiveGroupId(result.group.id);
      if (result.status === 'pending') {
        showToast('Request sent. Waiting for admin approval.', 'success');
        return;
      }
      showToast('Joined group.', 'success');
      navigate(`/app/group/${result.group.id}`);
    } catch {
      showToast('Could not join group.', 'error');
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[108px]">
        <header className="px-4 pt-6 pb-5 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center text-slate-900" onClick={() => navigate('/app/groups')}><ArrowLeft size={24} /></button>
            <h1 className="text-[22px] leading-[28px] font-black text-[#171212]">Join a Group</h1>
            <span className="w-10" />
          </div>
        </header>

        <main className="px-4 pt-5">
          <section className="rounded-[110px] bg-[#fbe9d9] p-6 text-center">
            <div className="mx-auto h-24 w-24 rounded-full bg-[#f6d7bc] text-primary flex items-center justify-center"><Users size={40} /></div>
            <h2 className="mt-4 text-[24px] leading-[30px] tracking-[-0.02em] font-black text-[#171212]">Join the Community</h2>
            <p className="mt-2 text-[16px] leading-[24px] text-[#5d7390]">Enter the invite code shared by your group leader to get started.</p>
          </section>

          <section className="mt-5">
            <label htmlFor="invite-code" className="text-[16px] leading-[20px] font-bold text-[#1f334f]">Invite Code</label>
            <input id="invite-code" value={formattedCode} onChange={(event) => setInviteCode(event.target.value)} placeholder="E.G. TZI-2024" className="mt-2 w-full h-14 rounded-2xl border border-[#d8e2f0] bg-white px-4 text-[16px] tracking-[0.1em] font-bold text-[#8ea1bb] uppercase" />

            <div className="mt-4 rounded-3xl border border-slate-200 bg-white p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-16 w-16 rounded-2xl bg-[#fbe9d9] text-primary flex items-center justify-center">🏋️</div>
                <div>
                  <p className="text-[16px] leading-[22px] font-bold text-slate-900">Preview matched group</p>
                  <p className="text-[14px] leading-[20px] text-[#60748f]">Toggle when the code looks right.</p>
                </div>
              </div>
              <button className={`h-10 w-10 rounded-full border-2 ${previewAccepted ? 'bg-primary border-primary text-white' : 'border-[#f4d4bf] text-[#f4d4bf]'}`} onClick={() => setPreviewAccepted((prev) => !prev)}>✓</button>
            </div>

            <button className="mt-4 w-full h-14 rounded-2xl bg-primary text-white text-[16px] font-bold disabled:opacity-60" disabled={!formattedCode || !previewAccepted || joinGroup.isPending} onClick={handleJoin}>
              {joinGroup.isPending ? 'Joining...' : 'Join Group ⚡'}
            </button>

            <div className="mt-12 text-center">
              <p className="text-[15px] leading-[20px] text-[#60748f]">Have an invite link?</p>
              <button className="mt-2 inline-flex items-center gap-2 text-[16px] leading-[20px] font-bold text-primary" onClick={() => showToast('Deep-link invite handling is ready. Open app link from message.', 'success')}>
                Tap here to join automatically <ExternalLink size={16} />
              </button>
            </div>
          </section>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default JoinGroupScreen;
