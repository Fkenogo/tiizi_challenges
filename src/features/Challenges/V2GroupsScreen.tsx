/**
 * EBC-05 V2 Group screen (Founder Preview).
 *
 * Group create/join for the V2 flow go ONLY through the governed EBC-01
 * server boundary (POST /v1/groups, POST /v1/groups/:id/join). Listing
 * reads the PostgreSQL membership shadow. No direct client Firestore
 * mutation paths are added here; the legacy V1 Group product is untouched.
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Plus, Users } from 'lucide-react';
import { BottomNav, Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { isV2ChallengesEnabled } from '../../api/v2ChallengeMode';
import {
  useV2CreateGroup,
  useV2JoinGroup,
  useV2MyGroups,
} from '../../hooks/useV2Challenges';

function V2GroupsScreen() {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const enabled = isV2ChallengesEnabled();
  const { data, isLoading, isError, refetch } = useV2MyGroups();
  const create = useV2CreateGroup();
  const join = useV2JoinGroup();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [joinId, setJoinId] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!enabled) {
    return (
      <Screen noPadding noBottomPadding className="st-page">
        <div className="st-frame st-bottom-safe pb-[108px]">
          <main className="st-form-max mt-10 text-center">
            <p className="text-[15px] font-bold text-slate-900">V2 Challenges are not enabled.</p>
            <button className="st-btn-primary mt-6" onClick={() => navigate('/app/challenges')}>
              Back to Challenges
            </button>
          </main>
        </div>
        <BottomNav active="home" />
      </Screen>
    );
  }

  const handleCreate = async () => {
    if (!name.trim()) {
      setError('Give the group a name.');
      return;
    }
    setError(null);
    try {
      const group = await create.mutateAsync({
        name: name.trim(),
        ...(description.trim() ? { description: description.trim() } : {}),
        allowMemberChallenges: true,
      });
      setName('');
      setDescription('');
      showToast(`Group “${group.name}” created — you are ${group.role}.`, 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not create this group.';
      setError(message);
      showToast(message, 'error');
    }
  };

  const handleJoin = async () => {
    if (!joinId.trim()) {
      setError('Paste a group ID to join.');
      return;
    }
    setError(null);
    try {
      const result = await join.mutateAsync(joinId.trim());
      setJoinId('');
      showToast(result.status === 'pending' ? 'Join request sent for approval.' : 'Group joined.', 'success');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not join this group.';
      setError(message);
      showToast(message, 'error');
    }
  };

  const memberships = data?.memberships ?? [];

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="st-frame st-bottom-safe pb-[108px]">
        <div className="sticky top-0 z-20 bg-slate-50 border-b border-slate-200 pb-3">
          <header className="st-form-max flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center" onClick={() => navigate('/app/challenges/v2')}>
              <ArrowLeft size={22} className="text-slate-900" />
            </button>
            <h1 className="st-page-title">V2 Groups</h1>
            <span className="w-10" />
          </header>
        </div>
        <main className="st-form-max mt-5 space-y-4">
          <section className="space-y-2">
            <h2 className="st-section-title">My groups</h2>
            {isLoading && <p className="text-[14px] text-slate-500">Loading groups…</p>}
            {isError && (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
                <p className="text-[14px] font-bold text-red-700">Could not load groups.</p>
                <button className="mt-2 text-[13px] font-bold text-red-600 underline" onClick={() => refetch()}>
                  Retry
                </button>
              </div>
            )}
            {!isLoading && !isError && memberships.length === 0 && (
              <p className="text-[14px] text-slate-500">No groups yet — create one below.</p>
            )}
            {memberships.map((membership) => (
              <div key={membership.groupId} className="st-card px-4 py-3 flex items-center gap-3">
                <Users size={16} className="text-primary flex-shrink-0" />
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-slate-900 truncate">{membership.group.name}</p>
                  <p className="text-[12px] text-slate-500">
                    {membership.role} · {membership.status}
                  </p>
                </div>
              </div>
            ))}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-2">
            <h2 className="st-section-title">Create group</h2>
            <input
              className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
              placeholder="Group name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
            <input
              className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
              placeholder="Description (optional)"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
            <button
              className="w-full h-12 rounded-2xl bg-primary text-white text-[15px] font-black disabled:opacity-60 flex items-center justify-center gap-2"
              disabled={create.isPending}
              onClick={handleCreate}
            >
              <Plus size={17} />
              {create.isPending ? 'Creating…' : 'Create group'}
            </button>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white px-4 py-3 space-y-2">
            <h2 className="st-section-title">Join group</h2>
            <input
              className="w-full h-12 rounded-2xl border border-slate-200 px-3 text-[14px]"
              placeholder="Paste a group ID"
              value={joinId}
              onChange={(event) => setJoinId(event.target.value)}
            />
            <button
              className="w-full h-12 rounded-2xl bg-slate-900 text-white text-[14px] font-black disabled:opacity-60"
              disabled={join.isPending}
              onClick={handleJoin}
            >
              {join.isPending ? 'Joining…' : 'Join group'}
            </button>
          </section>

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3">
              <p className="text-[13px] font-bold text-red-700">{error}</p>
            </div>
          )}
        </main>
      </div>
      <BottomNav active="home" />
    </Screen>
  );
}

export default V2GroupsScreen;
