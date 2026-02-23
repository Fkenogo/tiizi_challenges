import { ArrowLeft, Camera, Shield } from 'lucide-react';
import { ChangeEvent, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Screen } from '../../components/Layout';
import { useToast } from '../../context/ToastContext';
import { useAuth } from '../../hooks/useAuth';
import { setActiveGroupId } from '../../hooks/useActiveGroup';
import { useCreateGroup } from '../../hooks/useGroups';
import { isPersistableImageSource, isValidImageUrl, readFileAsDataUrl, uploadImageFile } from '../../services/imageUploadService';
import { GroupBottomNav } from './components/GroupBottomNav';

function ToggleRow({ title, subtitle, value, onToggle }: { title: string; subtitle: string; value: boolean; onToggle: () => void }) {
  return (
    <div className="py-4 border-b border-slate-100 last:border-b-0">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-[16px] leading-[22px] font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-[14px] leading-[20px] text-[#60748f]">{subtitle}</p>
        </div>
        <button type="button" className={`h-8 w-14 rounded-full p-1 transition ${value ? 'bg-primary' : 'bg-slate-200'}`} onClick={onToggle}>
          <span className={`block h-6 w-6 rounded-full bg-white transition ${value ? 'translate-x-6' : ''}`} />
        </button>
      </div>
    </div>
  );
}

function CreateGroupScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const createGroup = useCreateGroup();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [coverImageUploadState, setCoverImageUploadState] = useState<'idle' | 'uploading'>('idle');
  const [isPrivate, setIsPrivate] = useState(false);
  const [allowMemberChallenges, setAllowMemberChallenges] = useState(true);
  const [requireAdminApproval, setRequireAdminApproval] = useState(false);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const canSubmit = useMemo(
    () => !!name.trim() && name.trim().length >= 3 && description.trim().length >= 10 && !!user?.uid && !createGroup.isPending,
    [name, description, user?.uid, createGroup.isPending],
  );

  const handleCreate = async () => {
    if (!canSubmit || !user?.uid) return;

    const normalizedCover = coverImageUrl.trim();
    const persistableCover = isPersistableImageSource(normalizedCover) ? normalizedCover : undefined;
    if (normalizedCover && !persistableCover) {
      showToast('Cover image preview kept locally. Group will be created without saving that image source.', 'info');
    }

    try {
      const created = await createGroup.mutateAsync({
        name: name.trim(),
        description: description.trim(),
        ownerId: user.uid,
        coverImageUrl: persistableCover,
        isPrivate,
        requireAdminApproval: isPrivate ? true : requireAdminApproval,
        allowMemberChallenges,
      });
      setActiveGroupId(created.id);
      showToast('Group created successfully.', 'success');
      navigate(`/app/group/${created.id}`);
    } catch {
      showToast('Could not create group.', 'error');
    }
  };

  const handleCoverUrlChange = (event: ChangeEvent<HTMLInputElement>) => {
    setCoverImageUrl(event.target.value);
  };

  const handleCoverFileSelected = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setCoverImageUploadState('uploading');
      const uploadedUrl = await uploadImageFile(file, 'group-covers', user?.uid);
      setCoverImageUrl(uploadedUrl);
      showToast('Group cover uploaded.', 'success');
    } catch (error) {
      console.error('Group cover upload failed:', error);
      try {
        const fallbackDataUrl = await readFileAsDataUrl(file);
        setCoverImageUrl(fallbackDataUrl);
        showToast('Using local image preview. Upload will depend on storage permissions.', 'info');
      } catch {
        showToast('Could not read selected image.', 'error');
      }
    } finally {
      setCoverImageUploadState('idle');
      if (event.target) event.target.value = '';
    }
  };

  return (
    <Screen noPadding noBottomPadding className="st-page">
      <div className="mx-auto max-w-mobile min-h-screen pb-[108px]">
        <header className="px-4 pt-6 pb-5 border-b border-slate-200 bg-white">
          <div className="flex items-center justify-between">
            <button className="h-10 w-10 flex items-center justify-center text-primary" onClick={() => navigate('/app/groups')}><ArrowLeft size={24} /></button>
            <h1 className="text-[20px] leading-[24px] font-black text-[#171212]">Create New Group</h1>
            <span className="w-10" />
          </div>
        </header>

        <main className="px-4 pt-5 space-y-5">
          <section>
            <h2 className="text-[16px] leading-[20px] font-bold text-primary">Group Identity</h2>
            <div className="mt-3 relative">
              <input value={name} onChange={(event) => setName(event.target.value.slice(0, 50))} placeholder="e.g., Morning Runners" className="w-full h-14 rounded-2xl border border-[#f9c6a7] bg-white px-4 pr-16 text-[16px] text-[#496284]" />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[14px] text-[#8da0ba]">{name.length}/50</span>
            </div>
            <textarea value={description} onChange={(event) => setDescription(event.target.value.slice(0, 240))} placeholder="What is this group about?" className="mt-3 w-full h-40 rounded-3xl border border-[#f9c6a7] bg-white px-4 py-4 text-[16px] leading-[22px] text-[#496284]" />
          </section>

          <section className="rounded-[24px] border-2 border-dashed border-[#f6c8a7] bg-[#fff7f2] p-5 text-center">
            <div className="mx-auto h-20 w-20 rounded-full bg-[#fde8d7] text-primary flex items-center justify-center"><Camera size={28} /></div>
            <p className="mt-4 text-[18px] leading-[24px] font-black text-slate-900">Upload Cover Image</p>
            <p className="mt-1 text-[14px] leading-[20px] text-[#60748f]">Tap to select or drag and drop</p>
            {coverImageUrl && (
              <div className="mt-4 overflow-hidden rounded-xl border border-[#f9c6a7]">
                <img src={coverImageUrl} alt="Group cover preview" className="h-28 w-full object-cover" />
              </div>
            )}
            <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleCoverFileSelected} />
            <button
              type="button"
              className="mt-4 h-11 rounded-xl bg-primary px-5 text-[14px] font-bold text-white disabled:opacity-60"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverImageUploadState === 'uploading'}
            >
              {coverImageUploadState === 'uploading' ? 'Uploading image...' : 'Choose Image'}
            </button>
            <input
              value={coverImageUrl}
              onChange={handleCoverUrlChange}
              placeholder="Paste image URL"
              className="mt-3 w-full h-11 rounded-xl border border-[#f9c6a7] bg-white px-4 text-[14px]"
            />
            {coverImageUrl.trim() && !isValidImageUrl(coverImageUrl) && !coverImageUrl.startsWith('data:image/') && (
              <p className="mt-2 text-[12px] leading-[16px] text-amber-600">Image URL should start with http:// or https://</p>
            )}
            {coverImageUrl.startsWith('data:image/') && !isPersistableImageSource(coverImageUrl) && (
              <p className="mt-2 text-[12px] leading-[16px] text-amber-600">Selected image is too large. Use a smaller file or paste an image URL.</p>
            )}
          </section>

          <section className="rounded-[24px] border border-slate-200 bg-white p-5">
            <div className="flex items-center gap-2">
              <Shield size={20} className="text-primary" />
              <h3 className="text-[18px] leading-[24px] font-black text-[#171212]">Rules & Privacy</h3>
            </div>
            <ToggleRow title="Private Group" subtitle="Only invited members can join and see posts" value={isPrivate} onToggle={() => { const next = !isPrivate; setIsPrivate(next); if (next) setRequireAdminApproval(true); }} />
            <ToggleRow title="Allow Member Challenges" subtitle="Let members create and host their own tasks" value={allowMemberChallenges} onToggle={() => setAllowMemberChallenges((prev) => !prev)} />
            <ToggleRow title="Require Admin Approval" subtitle="New members must be vetted before joining" value={requireAdminApproval} onToggle={() => setRequireAdminApproval((prev) => !prev)} />
          </section>

          <button className="w-full h-14 rounded-2xl bg-primary text-white text-[16px] font-bold shadow-[0_10px_24px_rgba(255,111,0,0.25)] disabled:opacity-60" onClick={handleCreate} disabled={!canSubmit}>
            {createGroup.isPending ? 'Creating...' : 'Create Group 🚀'}
          </button>
        </main>
      </div>

      <GroupBottomNav active="groups" />
    </Screen>
  );
}

export default CreateGroupScreen;
